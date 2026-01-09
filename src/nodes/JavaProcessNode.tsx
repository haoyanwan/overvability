import { Handle, Position } from '@xyflow/react';
import type { JavaProcessNodeData, VmInfo } from '../types/nodes';
import './JavaProcessNode.css';

interface JavaProcessNodeProps {
    data: JavaProcessNodeData;
    selected?: boolean;
}

// Calculate aggregated metrics across all VMs in the service
function getAggregatedMetrics(vms: VmInfo[]) {
    const cpuPeaks: number[] = [];
    const cpuAvgs: number[] = [];
    const memPeaks: number[] = [];
    const memAvgs: number[] = [];
    const storages: number[] = [];

    for (const vm of vms) {
        if (vm.metrics) {
            if (vm.metrics.cpu.peak !== null) cpuPeaks.push(vm.metrics.cpu.peak);
            if (vm.metrics.cpu.avg !== null) cpuAvgs.push(vm.metrics.cpu.avg);
            if (vm.metrics.memory.peak !== null) memPeaks.push(vm.metrics.memory.peak);
            if (vm.metrics.memory.avg !== null) memAvgs.push(vm.metrics.memory.avg);
            if (vm.metrics.storage.dataMount !== null) storages.push(vm.metrics.storage.dataMount);
        }
    }

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const max = (arr: number[]) => arr.length > 0 ? Math.max(...arr) : null;

    return {
        cpuPeak: max(cpuPeaks),
        cpuAvg: avg(cpuAvgs),
        memPeak: max(memPeaks),
        memAvg: avg(memAvgs),
        storageAvg: avg(storages),
    };
}

// Get color class based on value threshold
function getMetricColorClass(value: number | null): string {
    if (value === null) return 'metric-na';
    if (value < 50) return 'metric-good';
    if (value < 80) return 'metric-warning';
    return 'metric-critical';
}

// Format metric value
function formatMetric(value: number | null): string {
    return value !== null ? `${Math.round(value)}%` : 'N/A';
}

export function JavaProcessNode({ data, selected }: JavaProcessNodeProps) {
    const status = data.status || 'healthy';
    const vmCount = data.vms?.length || 0;
    const metrics = getAggregatedMetrics(data.vms || []);

    return (
        <div className={`service-node service-node--${status}${selected ? ' selected' : ''}`}>
            <Handle type="target" position={Position.Top} />
            <div className="service-node__status-bar">
                <div className="service-node__status-indicator" />
                <span className="service-node__status-text">{status === 'healthy' ? '在线' : '离线'}</span>
            </div>
            <div className="service-node__body">
                <div className="service-node__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <line x1="2" y1="8" x2="22" y2="8" />
                        <circle cx="6" cy="5.5" r="0.5" fill="currentColor" />
                        <circle cx="9" cy="5.5" r="0.5" fill="currentColor" />
                        <line x1="6" y1="11" x2="18" y2="11" />
                        <line x1="6" y1="14" x2="14" y2="14" />
                        <line x1="8" y1="17" x2="8" y2="21" />
                        <line x1="16" y1="17" x2="16" y2="21" />
                    </svg>
                </div>
                <div className="service-node__content">
                    <div className="service-node__service">{data.service}</div>
                    <div className="service-node__meta">
                        <span className="service-node__owner">{data.businessOwner}</span>
                        <span className="service-node__vms">{vmCount} 台虚拟机</span>
                    </div>
                </div>
            </div>
            <div className="service-node__metrics">
                <div className="service-node__metrics-row">
                    <span className="service-node__metrics-label">CPU</span>
                    <span className={`service-node__metrics-value ${getMetricColorClass(metrics.cpuPeak)}`}>
                        峰值 {formatMetric(metrics.cpuPeak)}
                    </span>
                    <span className={`service-node__metrics-value ${getMetricColorClass(metrics.cpuAvg)}`}>
                        平均 {formatMetric(metrics.cpuAvg)}
                    </span>
                </div>
                <div className="service-node__metrics-row">
                    <span className="service-node__metrics-label">内存</span>
                    <span className={`service-node__metrics-value ${getMetricColorClass(metrics.memPeak)}`}>
                        峰值 {formatMetric(metrics.memPeak)}
                    </span>
                    <span className={`service-node__metrics-value ${getMetricColorClass(metrics.memAvg)}`}>
                        平均 {formatMetric(metrics.memAvg)}
                    </span>
                </div>
                <div className="service-node__metrics-row">
                    <span className="service-node__metrics-label">存储</span>
                    <span className={`service-node__metrics-value service-node__metrics-value--wide ${getMetricColorClass(metrics.storageAvg)}`}>
                        {formatMetric(metrics.storageAvg)}
                    </span>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
}