import React from 'react';
import '../styles/MetricsPanel.css';

const MetricsPanel = ({ metrics }) => {
  if (!metrics) {
    return (
      <aside className="metrics-panel">
        <h3>Metrics</h3>
        <div className="metrics-empty">No data available</div>
      </aside>
    );
  }

  return (
    <aside className="metrics-panel">
      <h3>Performance Metrics</h3>

      <div className="metrics-section">
        <h4>Document</h4>
        <div className="metric-row">
          <span className="metric-label">Characters:</span>
          <span className="metric-value">
            {metrics.textLength || metrics.characterCount || 0}
          </span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Total Nodes:</span>
          <span className="metric-value">{metrics.totalNodes || 0}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Active Nodes:</span>
          <span className="metric-value">{metrics.activeNodes || 0}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Tombstones:</span>
          <span className="metric-value">{metrics.tombstoneNodes || 0}</span>
        </div>
      </div>

      <div className="metrics-section">
        <h4>Operations</h4>
        <div className="metric-row">
          <span className="metric-label">Total:</span>
          <span className="metric-value">{metrics.operationCount || 0}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Inserts:</span>
          <span className="metric-value">{metrics.insertOperations || 0}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Deletes:</span>
          <span className="metric-value">{metrics.deleteOperations || 0}</span>
        </div>
      </div>

      <div className="metrics-section">
        <h4>Performance</h4>
        <div className="metric-row">
          <span className="metric-label">Avg Latency:</span>
          <span className="metric-value">{metrics.averageLatency || 0} ms</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Avg Delta Size:</span>
          <span className="metric-value">
            {metrics.averageDeltaSize || 0} B
          </span>
        </div>
        {metrics.compressionRatio && (
          <div className="metric-row">
            <span className="metric-label">Compression:</span>
            <span className="metric-value">{metrics.compressionRatio}%</span>
          </div>
        )}
      </div>

      {metrics.networkStats && (
        <div className="metrics-section">
          <h4>Network</h4>
          <div className="metric-row">
            <span className="metric-label">RX Rate:</span>
            <span className="metric-value">
              {metrics.networkStats.rx_rate_mbps} Mbps
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">TX Rate:</span>
            <span className="metric-value">
              {metrics.networkStats.tx_rate_mbps} Mbps
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};

export default MetricsPanel;
