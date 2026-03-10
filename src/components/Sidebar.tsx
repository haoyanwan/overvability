import { useState, useEffect } from 'react';
import type { Node } from '@xyflow/react';
import { nodeConfigs } from '../nodes';
import { vmLabels, vmMetricsLabels, getAzurePortalVmUrl, type VmInfo, type NodeType } from '../types';
import type { JenkinsJob } from '../types/api';
import './Sidebar.css';

interface SidebarProps {
  node: Node | null;
  onClose: () => void;
  jenkinsJobs?: string[];
  onJenkinsJobChange?: (serviceName: string, jenkinsJob: string | null) => void;
}

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

function formatBuildTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getJenkinsStatusClass(color: string): string {
  if (color.startsWith('blue')) return 'jenkins-success';
  if (color.startsWith('red')) return 'jenkins-failure';
  return 'jenkins-unknown';
}

export function Sidebar({ node, onClose, jenkinsJobs, onJenkinsJobChange }: SidebarProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [jenkinsJobDetails, setJenkinsJobDetails] = useState<JenkinsJob | null>(null);
  const [loadingJenkins, setLoadingJenkins] = useState(false);

  useEffect(() => {
    const jenkinsJobName = node?.data?.jenkinsJob as string | undefined;
    if (jenkinsJobName) {
      setLoadingJenkins(true);
      fetch(`/api/jenkins/job/${encodeURIComponent(jenkinsJobName)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => setJenkinsJobDetails(data?.job || null))
        .catch(() => setJenkinsJobDetails(null))
        .finally(() => setLoadingJenkins(false));
    } else {
      setJenkinsJobDetails(null);
    }
  }, [node?.data?.jenkinsJob]);

  // Only show when a node is selected
  if (!node) {
    return null;
  }

  const config = node.type ? nodeConfigs[node.type as NodeType] : null;
  const title = config?.title || '节点详情';
  const labels = config?.labels || {};
  const vms = (node.data?.vms as VmInfo[]) || [];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>{title}</h3>
        <div className="sidebar-header-actions">
          <button
            className="sidebar-edit-btn"
            onClick={() => setIsEditMode(!isEditMode)}
          >
            {isEditMode ? 'Done' : 'Edit'}
          </button>
          <button className="sidebar-close-btn" onClick={onClose}>&times;</button>
        </div>
      </div>
      <div className="sidebar-content">
        {Object.entries(labels).map(([key, label]) => {
          const value = node.data?.[key];
          if (value === undefined || value === null || value === '') return null;
          return (
            <div key={key} className="sidebar-field">
              <label>{String(label)}</label>
              <span>{String(value)}</span>
            </div>
          );
        })}

        {/* Jenkins Job section */}
        <div className="sidebar-field sidebar-jenkins">
          <label>Jenkins Job</label>
          {isEditMode ? (
            <select
              className="sidebar-jenkins-select"
              value={String(node.data?.jenkinsJob ?? '')}
              onChange={(e) => {
                const value = e.target.value || null;
                onJenkinsJobChange?.(String(node.data?.service ?? ''), value);
              }}
            >
              <option value="">-- None --</option>
              {jenkinsJobs?.map(job => (
                <option key={job} value={job}>{job}</option>
              ))}
            </select>
          ) : (
            <span className="sidebar-jenkins-value">
              {node.data?.jenkinsJob ? String(node.data.jenkinsJob) : '-- None --'}
            </span>
          )}
        </div>

        {/* Jenkins Build Details */}
        {Boolean(node.data?.jenkinsJob) && (
          <div className="sidebar-jenkins-details">
            {loadingJenkins ? (
              <div className="sidebar-jenkins-loading">加载构建信息...</div>
            ) : jenkinsJobDetails ? (
              <>
                <div className={`jenkins-status-badge ${getJenkinsStatusClass(jenkinsJobDetails.color)}`}>
                  {jenkinsJobDetails.color.startsWith('blue') ? '通过' :
                    jenkinsJobDetails.color.startsWith('red') ? '失败' : '未知'}
                </div>

                  {jenkinsJobDetails.lastBuild && (
                    <div className="sidebar-jenkins-build">
                      <div className="sidebar-jenkins-build-title">最新构建</div>
                      <div className="sidebar-jenkins-build-info">
                        <span className="sidebar-jenkins-build-label">构建号</span>
                        <span className="sidebar-jenkins-build-value">{jenkinsJobDetails.lastBuild.number}</span>
                      </div>
                      <div className="sidebar-jenkins-build-info">
                        <span className="sidebar-jenkins-build-label">开始时间</span>
                        <span className="sidebar-jenkins-build-value">{formatBuildTime(jenkinsJobDetails.lastBuild.timestamp)}</span>
                      </div>
                      {jenkinsJobDetails.lastBuild.duration !== undefined && (
                        <div className="sidebar-jenkins-build-info">
                          <span className="sidebar-jenkins-build-label">结束时间</span>
                          <span className="sidebar-jenkins-build-value">{formatBuildTime(jenkinsJobDetails.lastBuild.timestamp + jenkinsJobDetails.lastBuild.duration)}</span>
                        </div>
                      )}
                      <a href={jenkinsJobDetails.lastBuild.url} target="_blank" rel="noopener noreferrer" className="sidebar-jenkins-link">
                        查看Jenkins
                      </a>
                    </div>
                  )}

                  {jenkinsJobDetails.lastSuccessfulBuild &&
                    jenkinsJobDetails.lastSuccessfulBuild.number !== jenkinsJobDetails.lastBuild?.number && (
                      <div className="sidebar-jenkins-build sidebar-jenkins-build-success">
                        <div className="sidebar-jenkins-build-title">最新成功</div>
                        <div className="sidebar-jenkins-build-info">
                          <span className="sidebar-jenkins-build-label">构建号</span>
                          <span className="sidebar-jenkins-build-value">{jenkinsJobDetails.lastSuccessfulBuild.number}</span>
                        </div>
                        <div className="sidebar-jenkins-build-info">
                          <span className="sidebar-jenkins-build-label">开始时间</span>
                          <span className="sidebar-jenkins-build-value">{formatBuildTime(jenkinsJobDetails.lastSuccessfulBuild.timestamp)}</span>
                        </div>
                        {jenkinsJobDetails.lastSuccessfulBuild.duration !== undefined && (
                          <div className="sidebar-jenkins-build-info">
                            <span className="sidebar-jenkins-build-label">结束时间</span>
                            <span className="sidebar-jenkins-build-value">{formatBuildTime(jenkinsJobDetails.lastSuccessfulBuild.timestamp + jenkinsJobDetails.lastSuccessfulBuild.duration)}</span>
                          </div>
                        )}
                      </div>
                    )}

                  {jenkinsJobDetails.lastFailedBuild &&
                    jenkinsJobDetails.lastFailedBuild.number !== jenkinsJobDetails.lastBuild?.number && (
                      <div className="sidebar-jenkins-build sidebar-jenkins-build-failure">
                        <div className="sidebar-jenkins-build-title">最新失败</div>
                        <div className="sidebar-jenkins-build-info">
                          <span className="sidebar-jenkins-build-label">构建号</span>
                          <span className="sidebar-jenkins-build-value">{jenkinsJobDetails.lastFailedBuild.number}</span>
                        </div>
                        <div className="sidebar-jenkins-build-info">
                          <span className="sidebar-jenkins-build-label">开始时间</span>
                          <span className="sidebar-jenkins-build-value">{formatBuildTime(jenkinsJobDetails.lastFailedBuild.timestamp)}</span>
                        </div>
                        {jenkinsJobDetails.lastFailedBuild.duration !== undefined && (
                          <div className="sidebar-jenkins-build-info">
                            <span className="sidebar-jenkins-build-label">结束时间</span>
                            <span className="sidebar-jenkins-build-value">{formatBuildTime(jenkinsJobDetails.lastFailedBuild.timestamp + jenkinsJobDetails.lastFailedBuild.duration)}</span>
                          </div>
                        )}
                      </div>
                    )}
              </>
            ) : (
              <div className="sidebar-jenkins-error">构建信息不可用</div>
            )}
          </div>
        )}

        {vms.length > 0 && (
          <div className="sidebar-vms">
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
                        <span className="sidebar-vm-metrics-label">{vmMetricsLabels.storage.rootMount}</span>
                        <span className={`sidebar-vm-metrics-value ${getMetricColorClass(vm.metrics.storage.rootMount)}`}>
                          {formatMetric(vm.metrics.storage.rootMount)}
                        </span>
                      </div>
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
                        更新于: {new Date(vm.metrics.lastUpdated).toLocaleString('zh-CN', {
                          timeZone: 'Asia/Shanghai',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
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