export type NodeStatus = 'healthy' | 'warning' | 'error';

// Environment types
export type Environment = 'fra' | 'dev' | 'release';

// Environment mapping by resource group (expandable)
export const environmentMap: Record<string, Environment> = {
  'NINEBOT-WILLAND': 'fra',
  // Add more mappings as needed:
  // 'NINEBOT-DEV': 'dev',
  // 'NINEBOT-RELEASE': 'release',
};

export const DEFAULT_ENVIRONMENT: Environment = 'dev';

// Get environment from resource group
export function getEnvironment(resourceGroup: string): Environment {
  return environmentMap[resourceGroup.toUpperCase()] || DEFAULT_ENVIRONMENT;
}

// Environment colors for visual distinction
export const environmentColors: Record<Environment, { bg: string; text: string }> = {
  dev: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  fra: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
  release: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
};

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

export interface JavaProcessNodeData {
  [key: string]: unknown;
  service: string;
  businessOwner: string;
  environment: Environment;
  resourceGroup: string;
  port: string;
  vms: VmInfo[];
  status?: NodeStatus;
}

// Group node data for businessOwner containers
export interface GroupNodeData {
  [key: string]: unknown;
  businessOwner: string;
  label: string;
  childCount: number;
}

// Business owner color schemes for visual distinction
export const businessOwnerColors: Record<string, { bg: string; border: string; text: string }> = {
  fleet: { bg: 'rgba(59, 130, 246, 0.08)', border: '#3b82f6', text: '#3b82f6' },
  mowerbot: { bg: 'rgba(16, 185, 129, 0.08)', border: '#10b981', text: '#10b981' },
  base: { bg: 'rgba(245, 158, 11, 0.08)', border: '#f59e0b', text: '#f59e0b' },
  bigData: { bg: 'rgba(139, 92, 246, 0.08)', border: '#8b5cf6', text: '#8b5cf6' },
  o2o: { bg: 'rgba(236, 72, 153, 0.08)', border: '#ec4899', text: '#ec4899' },
  SRE: { bg: 'rgba(239, 68, 68, 0.08)', border: '#ef4444', text: '#ef4444' },
  default: { bg: 'rgba(107, 114, 128, 0.08)', border: '#6b7280', text: '#6b7280' },
};

// Labels for displaying JavaProcessNodeData in sidebar
export const javaProcessLabels: Record<string, string> = {
  service: '服务',
  businessOwner: '业务方',
  environment: '环境',
  port: '端口',
};

// Labels for VM info
export const vmLabels: Record<string, string> = {
  name: '名字',
  ip: 'IP',
  coreCount: '核心数',
  memory: '内存',
  os: '操作系统',
};

// Labels for VM metrics
export const vmMetricsLabels = {
  cpu: { peak: 'CPU 峰值', avg: 'CPU 平均', low: 'CPU 最低' },
  memory: { peak: '内存峰值', avg: '内存平均', low: '内存最低' },
  storage: { dataMount: '/data 使用率' },
};
