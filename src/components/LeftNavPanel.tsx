import { useState } from 'react';
import { BusinessOwnerNav } from './BusinessOwnerNav';
import { LayoutControls } from './LayoutControls';
import './LeftNavPanel.css';

interface LeftNavPanelProps {
  owners: string[];
  onSave: () => void;
  onReset: () => void;
  onRefresh: () => Promise<void>;
}

export function LeftNavPanel({ owners, onSave, onReset, onRefresh }: LeftNavPanelProps) {
  const [businessOwnerOpen, setBusinessOwnerOpen] = useState(true);
  const [layoutControlsOpen, setLayoutControlsOpen] = useState(true);

  return (
    <div className="left-nav-panel">
      <div className="left-nav-panel__header">
        <span className="left-nav-panel__title">导航</span>
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
    </div>
  );
}
