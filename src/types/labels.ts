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
