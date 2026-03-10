import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BusinessOwnerNav } from './BusinessOwnerNav';
import { LayoutControls } from './LayoutControls';
import { EnvironmentSelector } from './EnvironmentSelector';
import './LeftNavPanel.css';

interface RefreshOption { label: string; value: number; }

interface LeftNavPanelProps {
  owners: string[];
  onSave: () => void;
  onReset: () => void;
  onRefresh: () => Promise<void>;
  metricsRefreshInterval: number;
  onMetricsRefreshChange: (interval: number) => void;
  metricsRefreshOptions: RefreshOption[];
}

export function LeftNavPanel({ owners, onSave, onReset, onRefresh, metricsRefreshInterval, onMetricsRefreshChange, metricsRefreshOptions }: LeftNavPanelProps) {
  const [environmentOpen, setEnvironmentOpen] = useState(true);
  const [businessOwnerOpen, setBusinessOwnerOpen] = useState(true);
  const [layoutControlsOpen, setLayoutControlsOpen] = useState(true);
  const [metricsOpen, setMetricsOpen] = useState(true);

  return (
    <div className="left-nav-panel">
      <div className="left-nav-panel__header">
        <span className="left-nav-panel__title">导航</span>
      </div>

      {/* Environment Section */}
      <div className="left-nav-panel__section">
        <button
          className="left-nav-panel__section-header"
          onClick={() => setEnvironmentOpen(!environmentOpen)}
        >
          <span className="left-nav-panel__section-icon">
            {environmentOpen ? '▼' : '▶'}
          </span>
          <span>环境</span>
        </button>
        {environmentOpen && (
          <div className="left-nav-panel__section-content">
            <EnvironmentSelector />
          </div>
        )}
      </div>

      {/* Business Owner Section */}
      <div className="left-nav-panel__section">
        <button
          className="left-nav-panel__section-header"
          onClick={() => setBusinessOwnerOpen(!businessOwnerOpen)}
        >
          <span className="left-nav-panel__section-icon">
            {businessOwnerOpen ? '▼' : '▶'}
          </span>
          <span>业务方</span>
        </button>
        {businessOwnerOpen && (
          <div className="left-nav-panel__section-content">
            <BusinessOwnerNav owners={owners} />
          </div>
        )}
      </div>

      {/* Layout Controls Section */}
      <div className="left-nav-panel__section">
        <button
          className="left-nav-panel__section-header"
          onClick={() => setLayoutControlsOpen(!layoutControlsOpen)}
        >
          <span className="left-nav-panel__section-icon">
            {layoutControlsOpen ? '▼' : '▶'}
          </span>
          <span>布局控制</span>
        </button>
        {layoutControlsOpen && (
          <div className="left-nav-panel__section-content">
            <LayoutControls onSave={onSave} onReset={onReset} onRefresh={onRefresh} />
          </div>
        )}
      </div>

      {/* Metrics Refresh Section */}
      <div className="left-nav-panel__section">
        <button
          className="left-nav-panel__section-header"
          onClick={() => setMetricsOpen(!metricsOpen)}
        >
          <span className="left-nav-panel__section-icon">
            {metricsOpen ? '▼' : '▶'}
          </span>
          <span>指标刷新</span>
        </button>
        {metricsOpen && (
          <div className="left-nav-panel__section-content">
            <div className="metrics-refresh-control">
              <div className="metrics-refresh-control__options">
                {metricsRefreshOptions.map(option => (
                  <button
                    key={option.value}
                    className={`metrics-refresh-control__btn${metricsRefreshInterval === option.value ? ' active' : ''}`}
                    onClick={() => onMetricsRefreshChange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="left-nav-panel__footer">
        <Link to="/docs" className="left-nav-panel__docs-link">API 文档</Link>
      </div>
    </div>
  );
}
