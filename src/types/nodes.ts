export type NodeStatus = 'healthy' | 'warning' | 'error';

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
}

export interface JavaProcessNodeData {
  [key: string]: unknown;
  service: string;
  businessOwner: string;
  port: string;
  vms: VmInfo[];
  status?: NodeStatus;
}

// Labels for displaying JavaProcessNodeData in sidebar
export const javaProcessLabels: Record<string, string> = {
  service: '服务',
  businessOwner: '业务方',
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
