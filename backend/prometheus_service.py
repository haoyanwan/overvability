import os
import dotenv
import logging
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
            "storage": {"dataMount": None},
            "lastUpdated": None,
        }

        if not self.prom or not vm_ip:
            return result

        try:
            cpu_base = '100 - (avg(rate(node_cpu_seconds_total{{instance=~"{ip}:.*",mode="idle"}}[5m])) * 100)'.format(ip=vm_ip)

            result["cpu"]["peak"] = self._query("max_over_time(({base})[30d:])".format(base=cpu_base))
            result["cpu"]["avg"] = self._query("avg_over_time(({base})[30d:])".format(base=cpu_base))
            result["cpu"]["low"] = self._query("min_over_time(({base})[30d:])".format(base=cpu_base))

            mem_base = '(1 - (node_memory_MemAvailable_bytes{{instance=~"{ip}:.*"}} / node_memory_MemTotal_bytes{{instance=~"{ip}:.*"}})) * 100'.format(ip=vm_ip)

            result["memory"]["peak"] = self._query("max_over_time(({base})[30d:])".format(base=mem_base))
            result["memory"]["avg"] = self._query("avg_over_time(({base})[30d:])".format(base=mem_base))
            result["memory"]["low"] = self._query("min_over_time(({base})[30d:])".format(base=mem_base))

            storage_query = '100 - ((node_filesystem_avail_bytes{{instance=~"{ip}:.*",mountpoint="/data"}} * 100) / node_filesystem_size_bytes{{instance=~"{ip}:.*",mountpoint="/data"}})'.format(ip=vm_ip)
            result["storage"]["dataMount"] = self._query(storage_query)

            has_any_metric = any([
                result["cpu"]["peak"] is not None,
                result["memory"]["peak"] is not None,
                result["storage"]["dataMount"] is not None,
            ])
            if has_any_metric:
                result["lastUpdated"] = datetime.utcnow().isoformat() + "Z"

        except Exception as e:
            logger.error("Error fetching metrics for %s: %s", vm_ip, e)

        return result

    def get_bulk_metrics(self, vm_ips):
        """
        Get metrics for multiple VMs at once.
        Returns a dict keyed by VM IP.
        """
        metrics = {}
        for ip in vm_ips:
            if ip:
                metrics[ip] = self.get_vm_metrics(ip)
        return metrics


# Singleton instance
prometheus_service = PrometheusService()
