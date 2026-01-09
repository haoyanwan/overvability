import os
import dotenv
import logging
from typing import Dict, List, Optional, Any
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
            logger.info(f"Connected to Prometheus at {self.url}")
        except Exception as e:
            logger.error(f"Failed to connect to Prometheus: {e}")
            self.prom = None

    def is_available(self) -> bool:
        """Check if Prometheus is configured and reachable."""
        if not self.prom:
            return False
        try:
            self.prom.custom_query("up")
            return True
        except Exception:
            return False

    def _query(self, query: str) -> Optional[float]:
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
            logger.debug(f"Query failed: {query[:50]}... Error: {e}")
        return None

    def get_vm_metrics(self, vm_ip: str) -> Dict[str, Any]:
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
            # CPU base query (idle percentage inverted to usage)
            cpu_base = f'100 - (avg(rate(node_cpu_seconds_total{{instance=~"{vm_ip}:.*",mode="idle"}}[5m])) * 100)'

            # CPU 30-day aggregates
            result["cpu"]["peak"] = self._query(f"max_over_time(({cpu_base})[30d:])")
            result["cpu"]["avg"] = self._query(f"avg_over_time(({cpu_base})[30d:])")
            result["cpu"]["low"] = self._query(f"min_over_time(({cpu_base})[30d:])")

            # Memory base query (used percentage)
            mem_base = f'(1 - (node_memory_MemAvailable_bytes{{instance=~"{vm_ip}:.*"}} / node_memory_MemTotal_bytes{{instance=~"{vm_ip}:.*"}})) * 100'

            # Memory 30-day aggregates
            result["memory"]["peak"] = self._query(f"max_over_time(({mem_base})[30d:])")
            result["memory"]["avg"] = self._query(f"avg_over_time(({mem_base})[30d:])")
            result["memory"]["low"] = self._query(f"min_over_time(({mem_base})[30d:])")

            # Storage /data mount usage (current)
            storage_query = f'100 - ((node_filesystem_avail_bytes{{instance=~"{vm_ip}:.*",mountpoint="/data"}} * 100) / node_filesystem_size_bytes{{instance=~"{vm_ip}:.*",mountpoint="/data"}})'
            result["storage"]["dataMount"] = self._query(storage_query)

            # Set timestamp if any metrics were retrieved
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
            logger.error(f"Error fetching metrics for {vm_ip}: {e}")

        return result

    def get_bulk_metrics(self, vm_ips: List[str]) -> Dict[str, Dict[str, Any]]:
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
