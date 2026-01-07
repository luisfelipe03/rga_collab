import React from 'react';
import '../styles/MetricsPanel.css';

// Formatador inteligente para taxas de rede
const formatNetworkRate = (value) => {
  if (value === undefined || value === null) return '0.000';
  const num = Number(value);
  if (num > 100) return num.toFixed(1);  // > 100 Mbps: 1 casa (ex: 281.5)
  if (num > 1) return num.toFixed(2);    // > 1 Mbps: 2 casas (ex: 5.42)
  return num.toFixed(4);                  // < 1 Mbps: 4 casas (ex: 0.0045)
};

const MetricsPanel = ({ metrics }) => {
  if (!metrics) {
    return (
      <aside className="metrics-panel">
        <h3>Métricas</h3>
        <div className="metrics-empty">Nenhum dado disponível</div>
      </aside>
    );
  }

  return (
    <aside className="metrics-panel">
      <h3>Métricas de Performance</h3>

      <div className="metrics-section">
        <h4>Documento</h4>
        <div className="metric-row">
          <span className="metric-label">Caracteres:</span>
          <span className="metric-value">
            {metrics.textLength || metrics.characterCount || 0}
          </span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Nós Totais:</span>
          <span className="metric-value">{metrics.totalNodes || 0}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Nós Ativos:</span>
          <span className="metric-value">{metrics.activeNodes || 0}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Tombstones:</span>
          <span className="metric-value">{metrics.tombstoneNodes || 0}</span>
        </div>
      </div>

      <div className="metrics-section">
        <h4>Operações</h4>
        <div className="metric-row">
          <span className="metric-label">Total:</span>
          <span className="metric-value">{metrics.operationCount || 0}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Inserções:</span>
          <span className="metric-value">{metrics.insertOperations || 0}</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Deleções:</span>
          <span className="metric-value">{metrics.deleteOperations || 0}</span>
        </div>
      </div>

      <div className="metrics-section">
        <h4>Performance</h4>
        <div className="metric-row">
          <span className="metric-label">Latência Média:</span>
          <span className="metric-value">{metrics.averageLatency || 0} ms</span>
        </div>
        <div className="metric-row">
          <span className="metric-label">Tamanho Médio Delta:</span>
          <span className="metric-value">
            {metrics.averageDeltaSize || 0} B
          </span>
        </div>
        {metrics.compressionRatio && (
          <div className="metric-row">
            <span className="metric-label">Compressão:</span>
            <span className="metric-value">{metrics.compressionRatio}%</span>
          </div>
        )}
      </div>

      {metrics.networkStats && (
        <div className="metrics-section">
          <h4>Rede</h4>
          <div className="metric-row">
            <span className="metric-label">Taxa RX:</span>
            <span className="metric-value">
              {formatNetworkRate(metrics.networkStats.rx_rate_mbps)} Mbps
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Taxa TX:</span>
            <span className="metric-value">
              {formatNetworkRate(metrics.networkStats.tx_rate_mbps)} Mbps
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};

export default MetricsPanel;
