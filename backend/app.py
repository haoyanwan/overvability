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
import requests
from prometheus_service import prometheus_service
from database import (
    save_vm_data,
    read_vm_data,
    save_metrics_data,
    read_metrics_data,
    get_all_vm_ips,
    get_layout_path,
    save_jenkins_data,
    read_jenkins_data,
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
    os.getenv("METRICS_INTERVAL", "20")
)  # seconds for Prometheus metrics
JENKINS_INTERVAL = int(
    os.getenv("JENKINS_INTERVAL", "30")
)  # seconds for Jenkins builds


def validate_env(env: str) -> str:
    """Validate and return environment, defaulting if invalid."""
    return env if is_valid_environment(env) else DEFAULT_ENVIRONMENT


def get_credential():
    return ClientSecretCredential(
        tenant_id=os.getenv("AZURE_TENANT_ID"),
        client_id=os.getenv("AZURE_CLIENT_ID"),
        client_secret=os.getenv("AZURE_CLIENT_SECRET"),
    )


def get_jenkins_auth():
    return (os.getenv("JENKINS_USER"), os.getenv("JENKINS_PASSWORD"))


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

                # Preserve jenkinsJob from existing data
                existing = read_vm_data(env)
                if existing:
                    existing_jobs = {
                        s["service"]: s.get("jenkinsJob")
                        for s in existing.get("services", [])
                    }
                    for service in filtered:
                        service["jenkinsJob"] = existing_jobs.get(service["service"])

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


def fetch_jenkins_data():
    """Fetch Jenkins build data from API."""
    jenkins_url = os.getenv("JENKINS_URL").rstrip("/")
    tree = "jobs[name,url,color,lastBuild[number,url,result,timestamp,duration],lastSuccessfulBuild[number,url,timestamp,duration],lastFailedBuild[number,url,timestamp,duration]]"
    api_url = f"{jenkins_url}/api/json?tree={tree}"

    response = requests.get(api_url, auth=get_jenkins_auth(), timeout=30)
    response.raise_for_status()

    return response.json().get("jobs", [])


def background_jenkins_fetch():
    """Background thread that fetches Jenkins build data."""
    while True:
        try:
            jobs = fetch_jenkins_data()
            save_jenkins_data(jobs)
            print(
                f"[Jenkins Sync] Updated {len(jobs)} jobs at {datetime.utcnow().isoformat()}"
            )
        except Exception as e:
            print(f"[Jenkins Sync] Error: {e}")
        time.sleep(JENKINS_INTERVAL)


# Environment-aware API endpoints
@app.route("/api/<env>/vms")
def get_vms(env: str):
    """Get VM data for specific environment."""
    env = validate_env(env)
    data = read_vm_data(env)
    if data:
        return jsonify({"services": data.get("services", []), "environment": env})
    return jsonify(
        {"services": [], "environment": env, "error": "No data available yet"}
    )


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


@app.route("/api/jenkins/builds")
def get_jenkins_builds():
    """Get all Jenkins build information from database."""
    data = read_jenkins_data()
    if data:
        return jsonify(
            {"jobs": data.get("jobs", []), "last_updated": data.get("last_updated")}
        )
    return jsonify({"jobs": [], "error": "No data available yet"})


@app.route("/api/jenkins/job/<job_name>")
def get_jenkins_job(job_name: str):
    """Get detailed Jenkins job information by name."""
    data = read_jenkins_data()
    if not data:
        return jsonify({"error": "No Jenkins data available"}), 404

    jobs = data.get("jobs", [])
    for job in jobs:
        if job.get("name") == job_name:
            return jsonify({"job": job, "last_updated": data.get("last_updated")})

    return jsonify({"error": f"Job '{job_name}' not found"}), 404


@app.route("/api/<env>/services/<service_name>/jenkins", methods=["PUT"])
def set_service_jenkins(env: str, service_name: str):
    """Set Jenkins job for a service."""
    env = validate_env(env)
    data = request.get_json()
    jenkins_job = data.get("jenkinsJob")

    # Read current VM data
    vm_data = read_vm_data(env)
    if not vm_data:
        return jsonify({"error": "No VM data available"}), 404

    # Find and update the service
    services = vm_data.get("services", [])
    found = False
    for service in services:
        if service["service"] == service_name:
            service["jenkinsJob"] = jenkins_job
            found = True
            break

    if not found:
        return jsonify({"error": f"Service '{service_name}' not found"}), 404

    # Save updated data
    save_vm_data({"services": services}, env)
    return jsonify({"success": True})


if __name__ == "__main__":

    # Start background VM fetch thread (every 30 minutes)
    vm_thread = threading.Thread(target=background_vm_fetch, daemon=True)
    vm_thread.start()

    # Start background metrics fetch thread (every 10 seconds)
    metrics_thread = threading.Thread(target=background_metrics_fetch, daemon=True)
    metrics_thread.start()

    # Start background Jenkins fetch thread
    jenkins_thread = threading.Thread(target=background_jenkins_fetch, daemon=True)
    jenkins_thread.start()

    app.run(port=5000, debug=True, threaded=True)

    # Run initial VM fetch and distribute to all environments
    print("[Startup] Fetching initial VM data for all environments...")
    try:
        all_data = fetch_all_vm_data()
        for env in VALID_ENVIRONMENTS:
            filtered = filter_services_by_environment(all_data.get("services", []), env)

            # Preserve jenkinsJob from existing data
            existing = read_vm_data(env)
            if existing:
                existing_jobs = {
                    s["service"]: s.get("jenkinsJob")
                    for s in existing.get("services", [])
                }
                for service in filtered:
                    service["jenkinsJob"] = existing_jobs.get(service["service"])

            save_vm_data({"services": filtered}, env)
            print(f"[Startup] Initial VM data saved for {env}")
    except Exception as e:
        print(f"[Startup] Initial VM fetch failed: {e}")
