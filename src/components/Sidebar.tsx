import type { Node } from '@xyflow/react';
import { javaProcessLabels, vmLabels, vmMetricsLabels, getAzurePortalVmUrl, type VmInfo } from '../types/nodes';
import './Sidebar.css';

interface SidebarProps {
  node: Node | null;
  onClose: () => void;
}

// Map node types to their labels and titles
const nodeConfig: Record<string, { title: string; labels: Record<string, string> }> = {
  javaProcess: { title: '服务详情', labels: javaProcessLabels },
};

// Format metric value with percentage
function formatMetric(value: number | null): string {
  return value !== null ? `${value.toFixed(1)}%` : 'N/A';
}

// Get color class based on value threshold
function getMetricColorClass(value: number | null): string {
  if (value === null) return 'metric-na';
  if (value < 50) return 'metric-good';
  if (value < 80) return 'metric-warning';
  return 'metric-critical';
}

export function Sidebar({ node, onClose }: SidebarProps) {
  // Only show when a node is selected
  if (!node) {
    return null;
  }

  const config = node.type ? nodeConfig[node.type] : null;
  const title = config?.title || '节点详情';
  const labels = config?.labels || {};
  const vms = (node.data?.vms as VmInfo[]) || [];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>{title}</h3>
        <button onClick={onClose}>&times;</button>
      </div>
      <div className="sidebar-content">
        {Object.entries(labels).map(([key, label]) => {
          const value = node.data?.[key];
          if (value === undefined || value === null || value === '') return null;
          return (
            <div key={key} className="sidebar-field">
              <label>{label}</label>
              <span>{String(value)}</span>
            </div>
          );
        })}

        {vms.length > 0 && (
          <div className="sidebar-vms">
            <label className="sidebar-vms-title">虚拟机 ({vms.length})</label>
            {vms.map((vm, index) => (
              <div key={index} className="sidebar-vm">
                {Object.entries(vmLabels).map(([key, label]) => {
                  const value = vm[key as keyof VmInfo];
                  const azureUrl = key === 'ip' ? getAzurePortalVmUrl(vm) : null;

                  return (
                    <div key={key} className="sidebar-vm-field">
                      <span className="sidebar-vm-label">{label}</span>
                      {azureUrl ? (
                        <a
                          href={azureUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sidebar-vm-value sidebar-vm-link"
                        >
                          {String(value)}
                        </a>
                      ) : (
                        <span className="sidebar-vm-value">{String(value)}</span>
                      )}
                    </div>
                  );
                })}

                {/* Metrics section */}
                {vm.metrics && (
                  <div className="sidebar-vm-metrics">
                    <div className="sidebar-vm-metrics-header">Prometheus 指标 (30天)</div>

                    {/* CPU metrics */}
                    <div className="sidebar-vm-metrics-group">
                      <div className="sidebar-vm-metrics-group-title">CPU</div>
                      <div className="sidebar-vm-metrics-row">
                        <span className="sidebar-vm-metrics-label">{vmMetricsLabels.cpu.peak}</span>
                        <span className={`sidebar-vm-metrics-value ${getMetricColorClass(vm.metrics.cpu.peak)}`}>
                          {formatMetric(vm.metrics.cpu.peak)}
                        </span>
                      </div>
                      <div className="sidebar-vm-metrics-row">
                        <span className="sidebar-vm-metrics-label">{vmMetricsLabels.cpu.avg}</span>
                        <span className={`sidebar-vm-metrics-value ${getMetricColorClass(vm.metrics.cpu.avg)}`}>
                          {formatMetric(vm.metrics.cpu.avg)}
                        </span>
                      </div>
                      <div className="sidebar-vm-metrics-row">
                        <span className="sidebar-vm-metrics-label">{vmMetricsLabels.cpu.low}</span>
                        <span className={`sidebar-vm-metrics-value ${getMetricColorClass(vm.metrics.cpu.low)}`}>
                          {formatMetric(vm.metrics.cpu.low)}
                        </span>
                      </div>
                    </div>

                    {/* Memory metrics */}
                    <div className="sidebar-vm-metrics-group">
                      <div className="sidebar-vm-metrics-group-title">内存</div>
                      <div className="sidebar-vm-metrics-row">
                        <span className="sidebar-vm-metrics-label">{vmMetricsLabels.memory.peak}</span>
                        <span className={`sidebar-vm-metrics-value ${getMetricColorClass(vm.metrics.memory.peak)}`}>
                          {formatMetric(vm.metrics.memory.peak)}
                        </span>
                      </div>
                      <div className="sidebar-vm-metrics-row">
                        <span className="sidebar-vm-metrics-label">{vmMetricsLabels.memory.avg}</span>
                        <span className={`sidebar-vm-metrics-value ${getMetricColorClass(vm.metrics.memory.avg)}`}>
                          {formatMetric(vm.metrics.memory.avg)}
                        </span>
                      </div>
                      <div className="sidebar-vm-metrics-row">
                        <span className="sidebar-vm-metrics-label">{vmMetricsLabels.memory.low}</span>
                        <span className={`sidebar-vm-metrics-value ${getMetricColorClass(vm.metrics.memory.low)}`}>
                          {formatMetric(vm.metrics.memory.low)}
                        </span>
                      </div>
                    </div>

                    {/* Storage metrics */}
                    <div className="sidebar-vm-metrics-group">
                      <div className="sidebar-vm-metrics-group-title">存储</div>
                      <div className="sidebar-vm-metrics-row">
                        <span className="sidebar-vm-metrics-label">{vmMetricsLabels.storage.dataMount}</span>
                        <span className={`sidebar-vm-metrics-value ${getMetricColorClass(vm.metrics.storage.dataMount)}`}>
                          {formatMetric(vm.metrics.storage.dataMount)}
                        </span>
                      </div>
                    </div>

                    {/* Last updated */}
                    {vm.metrics.lastUpdated && (
                      <div className="sidebar-vm-metrics-updated">
                        更新于: {new Date(vm.metrics.lastUpdated).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
