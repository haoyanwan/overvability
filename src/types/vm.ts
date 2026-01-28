// Metric aggregate (peak/avg/low over 30 days)
export interface MetricAggregate {
  peak: number | null;
  avg: number | null;
  low: number | null;
}

// Storage metrics
export interface StorageMetrics {
  dataMount: number | null;  // /data usage %
}

// Complete VM metrics from Prometheus
export interface VmMetrics {
  cpu: MetricAggregate;
  memory: MetricAggregate;
  storage: StorageMetrics;
  lastUpdated: string | null;
}

export interface VmInfo {
  name: string;
  ip: string;
  coreCount: number;
  memory: string;
  os: string;
  status?: string;
  metrics?: VmMetrics;
  subscriptionId?: string;
  resourceGroup?: string;
}

// Build Azure portal URL for a VM
export function getAzurePortalVmUrl(vm: VmInfo): string | null {
  if (!vm.subscriptionId || !vm.resourceGroup || !vm.name) return null;
  const tenant = 'ninebotxmeco.onmicrosoft.com';
  return `https://portal.azure.com/#@${tenant}/resource/subscriptions/${vm.subscriptionId}/resourceGroups/${vm.resourceGroup}/providers/Microsoft.Compute/virtualMachines/${vm.name}/overview`;
}
