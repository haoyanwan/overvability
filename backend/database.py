import os
import threading
from datetime import datetime
from tinydb import TinyDB, Query

from environment_config import VALID_ENVIRONMENTS, DEFAULT_ENVIRONMENT

# Thread-safe database instances per environment
_db_lock = threading.Lock()
_db_instances: dict = {}
_write_locks: dict = {}  # Per-environment write locks


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
                _write_locks[env] = threading.Lock()
    return _db_instances[env]


def get_write_lock(env: str) -> threading.Lock:
    """Get the write lock for specific environment."""
    if env not in VALID_ENVIRONMENTS:
        env = DEFAULT_ENVIRONMENT
    get_db(env)  # Ensure lock exists
    return _write_locks[env]


def get_vms_table(env: str):
    """Get the VMs table for specific environment."""
    return get_db(env).table("vms")


def save_vm_data(services_data, env: str):
    """Save VM data to TinyDB for specific environment."""
    with get_write_lock(env):
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
    with get_write_lock(env):
        table = get_vms_table(env)
        VmData = Query()

        result = table.search(VmData.type == "vm_data")
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


# Jenkins data functions (environment-agnostic, uses default env db)
def get_jenkins_table():
    """Get the Jenkins table (stored in default environment db)."""
    return get_db(DEFAULT_ENVIRONMENT).table("jenkins")


def save_jenkins_data(jobs_data):
    """Save Jenkins build data to TinyDB."""
    with get_write_lock(DEFAULT_ENVIRONMENT):
        table = get_jenkins_table()
        JenkinsData = Query()

        record = {
            "type": "jenkins_data",
            "jobs": jobs_data,
            "last_updated": datetime.utcnow().isoformat() + "Z",
        }

        table.upsert(record, JenkinsData.type == "jenkins_data")


def read_jenkins_data():
    """Read Jenkins build data from TinyDB."""
    with get_write_lock(DEFAULT_ENVIRONMENT):
        table = get_jenkins_table()
        JenkinsData = Query()

        result = table.search(JenkinsData.type == "jenkins_data")
        return result[0] if result else None
