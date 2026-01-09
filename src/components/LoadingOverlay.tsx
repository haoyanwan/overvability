import './LoadingOverlay.css';

export function LoadingOverlay() {
    return (
        <div className="loading-overlay">
            <div className="loading-content">
                <div className="loading-spinner" />
                <span className="loading-text">正在加载数据...</span>
            </div>
        </div>
    );
}
