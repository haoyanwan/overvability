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
from database import save_vm_data, read_vm_data, save_metrics_data, read_metrics_data, get_all_vm_ips

load_dotenv()

app = Flask(__name__)
CORS(app)

VM_DATA_INTERVAL = 30 * 60  # 30 minutes for Azure VM data
METRICS_INTERVAL = int(
    os.getenv("METRICS_INTERVAL", "30")
)  # seconds for Prometheus metrics
LAYOUT_FILE = os.path.join(os.path.dirname(__file__), "layout.json")


def get_credential():
    return ClientSecretCredential(
        tenant_id=os.getenv("AZURE_TENANT_ID"),
        client_id=os.getenv("AZURE_CLIENT_ID"),
        client_secret=os.getenv("AZURE_CLIENT_SECRET"),
    )


def fetch_vm_data():
    """Fetch VM data from Azure and return as dict."""
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

            if service_name not in services:
                services[service_name] = {
                    "service": service_name,
                    "businessOwner": tags.get("proj", ""),
                    "resourceGroup": resource_group,
                    "location": vm.location,
                    "vms": [],
                }

            services[service_name]["vms"].append(
                {
                    "name": vm.name,
                    "ip": private_ip,
                    "coreCount": size_info.get("cores", 0),
                    "memory": f"{size_info.get('memory_gb', 0)}GB",
                    "os": os_info,
                    "status": status,
                }
            )

    return {"services": list(services.values())}


def background_vm_fetch():
    """Background thread that fetches VM data from Azure and writes to TinyDB."""
    while True:
        try:
            data = fetch_vm_data()
            save_vm_data(data)
            print(f"[VM Sync] Updated VM data at {datetime.utcnow().isoformat()}")
        except Exception as e:
            print(f"[VM Sync] Error: {e}")
        time.sleep(VM_DATA_INTERVAL)


def background_metrics_fetch():
    """Background thread that fetches metrics from Prometheus and writes to TinyDB."""
    while True:
        try:
            ips = get_all_vm_ips()
            if ips:
                metrics = prometheus_service.get_bulk_metrics(ips)
                save_metrics_data(metrics)
                print(f"[Metrics Sync] Updated metrics for {len(ips)} VMs")
        except Exception as e:
            print(f"[Metrics Sync] Error: {e}")
        time.sleep(METRICS_INTERVAL)


@app.route("/api/vms")
def get_vms():
    """Get VM data from TinyDB cache."""
    data = read_vm_data()
    if data:
        return jsonify({"services": data.get("services", [])})
    return jsonify({"services": [], "error": "No data available yet"})


@app.route("/api/prometheus/status")
def prometheus_status():
    """Check Prometheus availability."""
    return jsonify(
        {
            "available": prometheus_service.is_available(),
            "url": prometheus_service.url if prometheus_service.url else None,
        }
    )


@app.route("/api/metrics")
def get_metrics():
    """Get all metrics from TinyDB cache."""
    data = read_metrics_data()
    if data:
        return jsonify(data.get("metrics_by_ip", {}))
    return jsonify({})


@app.route("/api/layout", methods=["GET"])
def get_layout():
    """Get saved layout."""
    if os.path.exists(LAYOUT_FILE):
        with open(LAYOUT_FILE, "r") as f:
            return jsonify(json.load(f))
    return jsonify({})


@app.route("/api/layout", methods=["POST"])
def save_layout():
    """Save layout."""
    data = request.get_json()
    with open(LAYOUT_FILE, "w") as f:
        json.dump(data, f)
    return jsonify({"success": True})


@app.route("/api/layout", methods=["DELETE"])
def delete_layout():
    """Delete saved layout."""
    if os.path.exists(LAYOUT_FILE):
        os.remove(LAYOUT_FILE)
    return jsonify({"success": True})


if __name__ == "__main__":
    # Run initial VM fetch to populate database
    print("[Startup] Fetching initial VM data...")
    try:
        data = fetch_vm_data()
        save_vm_data(data)
        print("[Startup] Initial VM data saved to TinyDB")
    except Exception as e:
        print(f"[Startup] Initial VM fetch failed: {e}")

    # Start background VM fetch thread (every 30 minutes)
    vm_thread = threading.Thread(target=background_vm_fetch, daemon=True)
    vm_thread.start()

    # Start background metrics fetch thread (every 30 seconds)
    metrics_thread = threading.Thread(target=background_metrics_fetch, daemon=True)
    metrics_thread.start()

    app.run(port=5000, debug=True, threaded=True)
