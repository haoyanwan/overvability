import os
import json
import time
import threading
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from azure.identity import ClientSecretCredential
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.subscription import SubscriptionClient
from prometheus_service import prometheus_service
from database import (
    save_vm_data,
    read_vm_data,
    save_metrics_data,
    read_metrics_data,
    get_all_vm_ips,
    get_layout_path,
)
from environment_config import (
    VALID_ENVIRONMENTS,
    DEFAULT_ENVIRONMENT,
    filter_services_by_environment,
    is_valid_environment,
)

load_dotenv()

app = Flask(__name__)
CORS(app)

VM_DATA_INTERVAL = 30 * 60  # 30 minutes for Azure VM data
METRICS_INTERVAL = int(
    os.getenv("METRICS_INTERVAL", "30")
)  # seconds for Prometheus metrics


def validate_env(env: str) -> str:
    """Validate and return environment, defaulting if invalid."""
    return env if is_valid_environment(env) else DEFAULT_ENVIRONMENT


def get_credential():
    return ClientSecretCredential(
        tenant_id=os.getenv("AZURE_TENANT_ID"),
        client_id=os.getenv("AZURE_CLIENT_ID"),
        client_secret=os.getenv("AZURE_CLIENT_SECRET"),
    )


def fetch_all_vm_data():
    """Fetch all VM data from Azure and return as dict."""
    credential = get_credential()
    subscription_client = SubscriptionClient(credential)
    services = {}

    for sub in subscription_client.subscriptions.list():
        compute_client = ComputeManagementClient(credential, sub.subscription_id)
        network_client = NetworkManagementClient(credential, sub.subscription_id)

        # Get VM sizes
        vm_sizes = {}
        for loc in ["westeurope", "germanywestcentral", "eastus", "westus"]:
            try:
                for size in compute_client.virtual_machine_sizes.list(loc):
                    vm_sizes[size.name] = {
                        "cores": size.number_of_cores,
                        "memory_gb": size.memory_in_mb // 1024,
                    }
            except Exception:
                pass

        for vm in compute_client.virtual_machines.list_all():
            tags = vm.tags or {}
            if "service" not in tags:
                continue

            service_name = tags["service"]
            resource_group = vm.id.split("/resourceGroups/")[1].split("/")[0]

            # Get VM status
            status = "unknown"
            try:
                instance_view = compute_client.virtual_machines.instance_view(
                    resource_group, vm.name
                )
                for s in instance_view.statuses or []:
                    if s.code and s.code.startswith("PowerState/"):
                        status = s.code.replace("PowerState/", "")
                        break
            except Exception:
                pass

            # Get OS info
            os_info = "unknown"
            if vm.storage_profile and vm.storage_profile.image_reference:
                img = vm.storage_profile.image_reference
                if img.offer and img.sku:
                    os_info = f"{img.offer} {img.sku}"
                elif img.id:
                    os_info = img.id.split("/")[-1]

            # Get size info
            size_name = vm.hardware_profile.vm_size if vm.hardware_profile else ""
            size_info = vm_sizes.get(size_name, {})

            # Get private IP
            private_ip = ""
            if vm.network_profile and vm.network_profile.network_interfaces:
                for nic_ref in vm.network_profile.network_interfaces:
                    try:
                        parts = nic_ref.id.split("/")
                        nic_rg = parts[parts.index("resourceGroups") + 1]
                        nic_name = parts[parts.index("networkInterfaces") + 1]
                        nic = network_client.network_interfaces.get(nic_rg, nic_name)
                        for ip_config in nic.ip_configurations or []:
                            if ip_config.private_ip_address:
                                private_ip = ip_config.private_ip_address
                                break
                    except Exception:
                        pass
                    if private_ip:
                        break

            # Split service names containing "/" into separate services
            # e.g., "nacos/gateway" becomes two services: "nacos" and "gateway"
            service_names = [s.strip() for s in service_name.split("/") if s.strip()]

            vm_info = {
                "name": vm.name,
                "ip": private_ip,
                "coreCount": size_info.get("cores", 0),
                "memory": f"{size_info.get('memory_gb', 0)}GB",
                "os": os_info,
                "status": status,
                "subscriptionId": sub.subscription_id,
                "resourceGroup": resource_group,
            }

            for svc_name in service_names:
                if svc_name not in services:
                    services[svc_name] = {
                        "service": svc_name,
                        "businessOwner": tags.get("proj", ""),
                        "resourceGroup": resource_group,
                        "location": vm.location,
                        "vms": [],
                    }
                services[svc_name]["vms"].append(vm_info.copy())

    return {"services": list(services.values())}


def background_vm_fetch():
    """Background thread that fetches VM data and distributes to all environments."""
    while True:
        try:
            all_data = fetch_all_vm_data()
            for env in VALID_ENVIRONMENTS:
                filtered = filter_services_by_environment(
                    all_data.get("services", []), env
                )
                save_vm_data({"services": filtered}, env)
            print(
                f"[VM Sync] Updated VM data for all environments at {datetime.utcnow().isoformat()}"
            )
        except Exception as e:
            print(f"[VM Sync] Error: {e}")
        time.sleep(VM_DATA_INTERVAL)


def background_metrics_fetch():
    """Background thread that fetches metrics for all environments."""
    while True:
        try:
            for env in VALID_ENVIRONMENTS:
                ips = get_all_vm_ips(env)
                if ips:
                    metrics = prometheus_service.get_bulk_metrics(ips)
                    save_metrics_data(metrics, env)
                    print(f"[Metrics Sync] Updated metrics for {len(ips)} VMs in {env}")
        except Exception as e:
            print(f"[Metrics Sync] Error: {e}")
        time.sleep(METRICS_INTERVAL)


# Environment-aware API endpoints
@app.route("/api/<env>/vms")
def get_vms(env: str):
    """Get VM data for specific environment."""
    env = validate_env(env)
    data = read_vm_data(env)
    if data:
        return jsonify({"services": data.get("services", []), "environment": env})
    return jsonify({"services": [], "environment": env, "error": "No data available yet"})


@app.route("/api/<env>/metrics")
def get_metrics(env: str):
    """Get metrics for specific environment."""
    env = validate_env(env)
    data = read_metrics_data(env)
    if data:
        return jsonify(data.get("metrics_by_ip", {}))
    return jsonify({})


@app.route("/api/<env>/layout", methods=["GET"])
def get_layout(env: str):
    """Get saved layout for specific environment."""
    env = validate_env(env)
    layout_file = get_layout_path(env)
    if os.path.exists(layout_file):
        with open(layout_file, "r") as f:
            return jsonify(json.load(f))
    return jsonify({})


@app.route("/api/<env>/layout", methods=["POST"])
def save_layout(env: str):
    """Save layout for specific environment."""
    env = validate_env(env)
    layout_file = get_layout_path(env)
    data = request.get_json()
    with open(layout_file, "w") as f:
        json.dump(data, f)
    return jsonify({"success": True, "environment": env})


@app.route("/api/<env>/layout", methods=["DELETE"])
def delete_layout(env: str):
    """Delete saved layout for specific environment."""
    env = validate_env(env)
    layout_file = get_layout_path(env)
    if os.path.exists(layout_file):
        os.remove(layout_file)
    return jsonify({"success": True, "environment": env})


# Environment-agnostic endpoints
@app.route("/api/prometheus/status")
def prometheus_status():
    """Check Prometheus availability."""
    return jsonify(
        {
            "available": prometheus_service.is_available(),
            "url": prometheus_service.url if prometheus_service.url else None,
        }
    )


@app.route("/api/environments")
def list_environments():
    """List available environments."""
    return jsonify(
        {
            "environments": VALID_ENVIRONMENTS,
            "default": DEFAULT_ENVIRONMENT,
        }
    )


if __name__ == "__main__":
    # Run initial VM fetch and distribute to all environments
    print("[Startup] Fetching initial VM data for all environments...")
    try:
        all_data = fetch_all_vm_data()
        for env in VALID_ENVIRONMENTS:
            filtered = filter_services_by_environment(all_data.get("services", []), env)
            save_vm_data({"services": filtered}, env)
            print(f"[Startup] Initial VM data saved for {env}")
    except Exception as e:
        print(f"[Startup] Initial VM fetch failed: {e}")

    # Start background VM fetch thread (every 30 minutes)
    vm_thread = threading.Thread(target=background_vm_fetch, daemon=True)
    vm_thread.start()

    # Start background metrics fetch thread (every 30 seconds)
    metrics_thread = threading.Thread(target=background_metrics_fetch, daemon=True)
    metrics_thread.start()

    app.run(port=5000, debug=True, threaded=True)
