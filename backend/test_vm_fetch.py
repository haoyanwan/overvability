"""Standalone script to test VM data fetching from Azure."""
import os
import json
from datetime import datetime
from dotenv import load_dotenv
from azure.identity import ClientSecretCredential
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.subscription import SubscriptionClient
from environment_config import VALID_ENVIRONMENTS, filter_services_by_environment

load_dotenv()


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
        print(f"[Scanning] Subscription: {sub.display_name} ({sub.subscription_id})")
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

        vm_count = 0
        for vm in compute_client.virtual_machines.list_all():
            tags = vm.tags or {}
            if "service" not in tags:
                continue

            vm_count += 1
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

        print(f"  Found {vm_count} tagged VMs")

    return {"services": list(services.values())}


if __name__ == "__main__":
    print(f"[{datetime.utcnow().isoformat()}] Starting VM fetch test...\n")

    all_data = fetch_all_vm_data()
    total_services = len(all_data["services"])
    total_vms = sum(len(s["vms"]) for s in all_data["services"])

    print(f"\n--- Results ---")
    print(f"Total services: {total_services}")
    print(f"Total VMs: {total_vms}")

    print(f"\n--- Per Environment ---")
    for env in VALID_ENVIRONMENTS:
        filtered = filter_services_by_environment(all_data["services"], env)
        env_vms = sum(len(s["vms"]) for s in filtered)
        print(f"  {env}: {len(filtered)} services, {env_vms} VMs")

    print(f"\n--- Services ---")
    for svc in sorted(all_data["services"], key=lambda s: s["service"]):
        vm_names = [vm["name"] for vm in svc["vms"]]
        print(f"  {svc['service']} ({svc['resourceGroup']}): {vm_names}")

    # Dump full output
    print(f"\n--- Full JSON output saved to vm_fetch_output.json ---")
    with open(os.path.join(os.path.dirname(__file__), "vm_fetch_output.json"), "w") as f:
        json.dump(all_data, f, indent=2)
