import os
import threading
from datetime import datetime
from tinydb import TinyDB, Query

from environment_config import VALID_ENVIRONMENTS, DEFAULT_ENVIRONMENT

# Thread-safe database instances per environment
_db_lock = threading.Lock()
_db_instances: dict = {}


def get_db_path(env: str) -> str:
    """Get database file path for specific environment."""
    if env not in VALID_ENVIRONMENTS:
        env = DEFAULT_ENVIRONMENT
    return os.path.join(os.path.dirname(__file__), f"data_{env}.json")


def get_layout_path(env: str) -> str:
    """Get layout file path for specific environment."""
    if env not in VALID_ENVIRONMENTS:
        env = DEFAULT_ENVIRONMENT
    return os.path.join(os.path.dirname(__file__), f"layout_{env}.json")


def get_db(env: str) -> TinyDB:
    """Get or create the TinyDB instance for specific environment (thread-safe)."""
    if env not in VALID_ENVIRONMENTS:
        env = DEFAULT_ENVIRONMENT

    if env not in _db_instances:
        with _db_lock:
            if env not in _db_instances:
                _db_instances[env] = TinyDB(get_db_path(env))
    return _db_instances[env]


def get_vms_table(env: str):
    """Get the VMs table for specific environment."""
    return get_db(env).table("vms")


def get_metrics_table(env: str):
    """Get the metrics table for specific environment."""
    return get_db(env).table("metrics")


def save_vm_data(services_data, env: str):
    """Save VM data to TinyDB for specific environment."""
    table = get_vms_table(env)
    VmData = Query()

    record = {
        "type": "vm_data",
        "services": services_data.get("services", []),
        "last_updated": datetime.utcnow().isoformat() + "Z",
    }

    table.upsert(record, VmData.type == "vm_data")


def read_vm_data(env: str):
    """Read VM data from TinyDB for specific environment."""
    table = get_vms_table(env)
    VmData = Query()

    result = table.search(VmData.type == "vm_data")
    return result[0] if result else None


def save_metrics_data(metrics_by_ip, env: str):
    """Save metrics data to TinyDB for specific environment."""
    table = get_metrics_table(env)
    MetricsData = Query()

    record = {
        "type": "metrics_data",
        "metrics_by_ip": metrics_by_ip,
        "last_updated": datetime.utcnow().isoformat() + "Z",
    }

    table.upsert(record, MetricsData.type == "metrics_data")


def read_metrics_data(env: str):
    """Read metrics data from TinyDB for specific environment."""
    table = get_metrics_table(env)
    MetricsData = Query()

    result = table.search(MetricsData.type == "metrics_data")
    return result[0] if result else None


def get_all_vm_ips(env: str):
    """Extract all VM IPs from stored VM data for specific environment."""
    vm_data = read_vm_data(env)
    if not vm_data:
        return []

    ips = []
    for service in vm_data.get("services", []):
        for vm in service.get("vms", []):
            ip = vm.get("ip")
            if ip:
                ips.append(ip)
    return ips
