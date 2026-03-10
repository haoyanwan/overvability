import os
import dotenv
import logging
import time
from datetime import datetime

logger = logging.getLogger(__name__)
dotenv.load_dotenv()


class PrometheusService:
    """Service for querying Prometheus metrics for VMs."""

    def __init__(self):
        self.url = os.getenv("PROMETHEUS_URL", "")
        self.prom = None
        self._connect()

    def _connect(self):
        """Initialize Prometheus connection if URL is configured."""
        if not self.url:
            logger.warning(
                "PROMETHEUS_URL not configured - metrics will be unavailable"
            )
            return

        try:
            from prometheus_api_client import PrometheusConnect

            self.prom = PrometheusConnect(url=self.url, disable_ssl=True)
            logger.info("Connected to Prometheus at %s", self.url)
        except Exception as e:
            logger.error("Failed to connect to Prometheus: %s", e)
            self.prom = None

    def is_available(self):
        """Check if Prometheus is configured and reachable."""
        if not self.prom:
            return False
        try:
            self.prom.custom_query("up")
            return True
        except Exception:
            return False

    def _query(self, query):
        """Execute a PromQL query and return the first numeric result."""
        if not self.prom:
            return None
        try:
            result = self.prom.custom_query(query)
            if result and len(result) > 0:
                value = result[0].get("value", [None, None])
                if len(value) >= 2 and value[1] is not None:
                    return round(float(value[1]), 1)
        except Exception as e:
            logger.debug("Query failed: %s... Error: %s", query[:50], e)
        return None

    def get_vm_metrics(self, vm_ip):
        """
        Get CPU, memory, and storage metrics for a specific VM by IP.
        Returns 30-day aggregates (peak, avg, low) for CPU and memory,
        plus current /data mount usage.
        """
        result = {
            "cpu": {"peak": None, "avg": None, "low": None},
            "memory": {"peak": None, "avg": None, "low": None},
            "storage": {"rootMount": None, "dataMount": None},
            "lastUpdated": None,
        }

        if not self.prom or not vm_ip:
            return result

        try:
            cpu_base = '100 - (avg(rate(node_cpu_seconds_total{{instance=~"{ip}:.*",mode="idle"}}[5m])) * 100)'.format(
                ip=vm_ip
            )

            result["cpu"]["peak"] = self._query(
                "max_over_time(({base})[1h:])".format(base=cpu_base)
            )
            result["cpu"]["avg"] = self._query(
                "avg_over_time(({base})[1h:])".format(base=cpu_base)
            )
            result["cpu"]["low"] = self._query(
                "min_over_time(({base})[1h:])".format(base=cpu_base)
            )

            mem_base = '(1 - (node_memory_MemAvailable_bytes{{instance=~"{ip}:.*"}} / node_memory_MemTotal_bytes{{instance=~"{ip}:.*"}})) * 100'.format(
                ip=vm_ip
            )

            result["memory"]["peak"] = self._query(
                "max_over_time(({base})[1h:])".format(base=mem_base)
            )
            result["memory"]["avg"] = self._query(
                "avg_over_time(({base})[1h:])".format(base=mem_base)
            )
            result["memory"]["low"] = self._query(
                "min_over_time(({base})[1h:])".format(base=mem_base)
            )

            root_storage_query = '100 - ((node_filesystem_avail_bytes{{instance=~"{ip}:.*",mountpoint="/"}} * 100) / node_filesystem_size_bytes{{instance=~"{ip}:.*",mountpoint="/"}})'.format(
                ip=vm_ip
            )
            result["storage"]["rootMount"] = self._query(root_storage_query)

            data_storage_query = '100 - ((node_filesystem_avail_bytes{{instance=~"{ip}:.*",mountpoint="/data"}} * 100) / node_filesystem_size_bytes{{instance=~"{ip}:.*",mountpoint="/data"}})'.format(
                ip=vm_ip
            )
            result["storage"]["dataMount"] = self._query(data_storage_query)

            has_any_metric = any(
                [
                    result["cpu"]["peak"] is not None,
                    result["memory"]["peak"] is not None,
                    result["storage"]["dataMount"] is not None,
                ]
            )
            if has_any_metric:
                result["lastUpdated"] = datetime.utcnow().isoformat() + "Z"

        except Exception as e:
            logger.error("Error fetching metrics for %s: %s", vm_ip, e)

        return result

    def get_bulk_metrics(self, vm_ips):
        """Get metrics for all VMs using bulk queries (7 queries total)."""
        start = time.time()

        unique_ips = list(set(ip for ip in vm_ips if ip))
        if not unique_ips or not self.prom:
            return {}

        # Build regex pattern: "ip1:.*|ip2:.*|ip3:.*"
        ip_pattern = "|".join(f"{ip}:.*" for ip in unique_ips)

        # Initialize results
        metrics = {ip: {
            "cpu": {"peak": None, "avg": None, "low": None},
            "memory": {"peak": None, "avg": None, "low": None},
            "storage": {"rootMount": None, "dataMount": None},
            "lastUpdated": None,
        } for ip in unique_ips}

        # CPU queries (3 total)
        cpu_base = f'100 - (avg by (instance) (rate(node_cpu_seconds_total{{instance=~"{ip_pattern}",mode="idle"}}[5m])) * 100)'
        self._bulk_query_and_assign(metrics, f'max_over_time(({cpu_base})[1h:])', 'cpu', 'peak')
        self._bulk_query_and_assign(metrics, f'avg_over_time(({cpu_base})[1h:])', 'cpu', 'avg')
        self._bulk_query_and_assign(metrics, f'min_over_time(({cpu_base})[1h:])', 'cpu', 'low')

        # Memory queries (3 total)
        mem_base = f'(1 - (node_memory_MemAvailable_bytes{{instance=~"{ip_pattern}"}} / node_memory_MemTotal_bytes{{instance=~"{ip_pattern}"}})) * 100'
        self._bulk_query_and_assign(metrics, f'max_over_time(({mem_base})[1h:])', 'memory', 'peak')
        self._bulk_query_and_assign(metrics, f'avg_over_time(({mem_base})[1h:])', 'memory', 'avg')
        self._bulk_query_and_assign(metrics, f'min_over_time(({mem_base})[1h:])', 'memory', 'low')

        # Storage queries (2 total)
        root_storage_query = f'100 - ((node_filesystem_avail_bytes{{instance=~"{ip_pattern}",mountpoint="/"}} * 100) / node_filesystem_size_bytes{{instance=~"{ip_pattern}",mountpoint="/"}})'
        data_storage_query = f'100 - ((node_filesystem_avail_bytes{{instance=~"{ip_pattern}",mountpoint="/data"}} * 100) / node_filesystem_size_bytes{{instance=~"{ip_pattern}",mountpoint="/data"}})'
        self._bulk_query_and_assign(metrics, root_storage_query, 'storage', 'rootMount')
        self._bulk_query_and_assign(metrics, data_storage_query, 'storage', 'dataMount')

        # Set lastUpdated for VMs with data
        now = datetime.utcnow().isoformat() + "Z"
        for ip, data in metrics.items():
            if any([data["cpu"]["peak"], data["memory"]["peak"], data["storage"]["dataMount"]]):
                data["lastUpdated"] = now

        print(f"[Metrics] Total fetch time: {time.time() - start:.2f}s for {len(unique_ips)} VMs (7 queries)")
        return metrics

    def _bulk_query_and_assign(self, metrics, query, category, field):
        """Execute bulk query and assign results to metrics dict by IP."""
        try:
            results = self.prom.custom_query(query)
            for item in results:
                instance = item.get("metric", {}).get("instance", "")
                # Extract IP from instance (format: "10.0.0.1:9100")
                ip = instance.split(":")[0] if instance else None
                if ip and ip in metrics:
                    value = item.get("value", [None, None])
                    if len(value) >= 2 and value[1] is not None:
                        metrics[ip][category][field] = round(float(value[1]), 1)
        except Exception as e:
            logger.debug(f"Bulk query failed: {query[:50]}... Error: {e}")


# Singleton instance
prometheus_service = PrometheusService()
