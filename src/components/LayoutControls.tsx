import { useState, useEffect } from 'react';
import './LayoutControls.css';

interface LayoutControlsProps {
  onSave: () => void;
  onReset: () => void;
  onRefresh: () => Promise<void>;
}

export function LayoutControls({ onSave, onReset, onRefresh }: LayoutControlsProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('color-mode');
    return saved !== 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('color-mode', isDark ? 'dark' : 'light');
  }, [isDark]);

  const handleSave = () => {
    onSave();
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleRefresh = async () => {
    setRefreshStatus('loading');
    try {
      await onRefresh();
      setRefreshStatus('done');
      setTimeout(() => setRefreshStatus('idle'), 2000);
    } catch {
      setRefreshStatus('error');
      setTimeout(() => setRefreshStatus('idle'), 3000);
    }
  };

  const getRefreshButtonText = () => {
    switch (refreshStatus) {
      case 'loading': return '刷新中...';
      case 'done': return '已刷新!';
      case 'error': return '刷新失败';
      default: return '刷新数据';
    }
  };

  return (
    <div className="layout-controls">
      <button
        className={`layout-controls__btn ${saveStatus === 'saved' ? 'saved' : ''}`}
        onClick={handleSave}
      >
        {saveStatus === 'saved' ? '保存!' : '保存布局'}
      </button>
      <button
        className="layout-controls__btn"
        onClick={onReset}
      >
        重置布局
      </button>
      <button
        className={`layout-controls__btn ${refreshStatus === 'done' ? 'saved' : refreshStatus === 'error' ? 'error' : ''}`}
        onClick={handleRefresh}
        disabled={refreshStatus === 'loading'}
      >
        {getRefreshButtonText()}
      </button>
      <button
        className="layout-controls__btn"
        onClick={() => setIsDark(!isDark)}
      >
        {isDark ? '浅色模式' : '深色模式'}
      </button>
    </div>
  );
}
