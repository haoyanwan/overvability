import os
import threading
from datetime import datetime
from tinydb import TinyDB, Query

# Database file location (same directory as this file)
DB_FILE = os.path.join(os.path.dirname(__file__), "data.json")

# Thread-safe singleton pattern
_db_lock = threading.Lock()
_db = None


def get_db():
    """Get or create the TinyDB instance (thread-safe singleton)."""
    global _db
    if _db is None:
        with _db_lock:
            if _db is None:
                _db = TinyDB(DB_FILE)
    return _db


def get_vms_table():
    """Get the VMs table."""
    return get_db().table("vms")


def get_metrics_table():
    """Get the metrics table."""
    return get_db().table("metrics")


def save_vm_data(services_data):
    """Save VM data to TinyDB, replacing any existing data."""
    table = get_vms_table()
    VmData = Query()

    record = {
        "type": "vm_data",
        "services": services_data.get("services", []),
        "last_updated": datetime.utcnow().isoformat() + "Z",
    }

    # Upsert - replace existing or insert new
    table.upsert(record, VmData.type == "vm_data")


def read_vm_data():
    """Read VM data from TinyDB."""
    table = get_vms_table()
    VmData = Query()

    result = table.search(VmData.type == "vm_data")
    return result[0] if result else None


def save_metrics_data(metrics_by_ip):
    """Save metrics data to TinyDB, replacing any existing data."""
    table = get_metrics_table()
    MetricsData = Query()

    record = {
        "type": "metrics_data",
        "metrics_by_ip": metrics_by_ip,
        "last_updated": datetime.utcnow().isoformat() + "Z",
    }

    table.upsert(record, MetricsData.type == "metrics_data")


def read_metrics_data():
    """Read metrics data from TinyDB."""
    table = get_metrics_table()
    MetricsData = Query()

    result = table.search(MetricsData.type == "metrics_data")
    return result[0] if result else None


def get_all_vm_ips():
    """Extract all VM IPs from stored VM data."""
    vm_data = read_vm_data()
    if not vm_data:
        return []

    ips = []
    for service in vm_data.get("services", []):
        for vm in service.get("vms", []):
            ip = vm.get("ip")
            if ip:
                ips.append(ip)
    return ips
