import si from 'systeminformation';
import GCounter from '../counters/GCounter.js';

class MetricsService {
  constructor() {
    // Per-document metrics storage
    this.documentMetrics = new Map();

    // Network metrics
    this.networkStats = {
      rx_bytes: 0,
      tx_bytes: 0,
      timestamp: Date.now(),
    };

    // Start network monitoring
    this.startNetworkMonitoring();
  }

  // Initialize metrics for a document
  initDocumentMetrics(documentId) {
    if (!this.documentMetrics.has(documentId)) {
      this.documentMetrics.set(documentId, {
        // GCounters for distributed counting
        operationCounter: new GCounter(`metrics-${documentId}`),
        insertCounter: new GCounter(`insert-${documentId}`),
        deleteCounter: new GCounter(`delete-${documentId}`),
        // Regular counters
        characterCount: 0,
        nodeCount: 0,
        latencies: [],
        deltaStates: [],
        createdAt: Date.now(),
      });
    }
  }

  // Record operation
  recordOperation(documentId, operationType, latency, deltaSize = 0) {
    this.initDocumentMetrics(documentId);
    const metrics = this.documentMetrics.get(documentId);

    // Increment GCounters (conflict-free)
    metrics.operationCounter.increment();
    if (operationType === 'insert') {
      metrics.insertCounter.increment();
    } else if (operationType === 'delete') {
      metrics.deleteCounter.increment();
    }

    if (latency !== undefined && latency !== null) {
      metrics.latencies.push(latency);
    }

    if (deltaSize > 0) {
      metrics.deltaStates.push({
        timestamp: Date.now(),
        size: deltaSize,
      });
    }
  }

  // Update character count
  updateCharacterCount(documentId, count) {
    this.initDocumentMetrics(documentId);
    const metrics = this.documentMetrics.get(documentId);
    metrics.characterCount = count;
  }

  // Update node count
  updateNodeCount(documentId, count) {
    this.initDocumentMetrics(documentId);
    const metrics = this.documentMetrics.get(documentId);
    metrics.nodeCount = count;
  }

  // Get document metrics
  getDocumentMetrics(documentId) {
    this.initDocumentMetrics(documentId);
    const metrics = this.documentMetrics.get(documentId);

    const avgLatency =
      metrics.latencies.length > 0
        ? metrics.latencies.reduce((a, b) => a + b, 0) /
        metrics.latencies.length
        : 0;

    const totalDeltaSize = metrics.deltaStates.reduce(
      (sum, delta) => sum + delta.size,
      0
    );
    const avgDeltaSize =
      metrics.deltaStates.length > 0
        ? totalDeltaSize / metrics.deltaStates.length
        : 0;

    return {
      operationCount: metrics.operationCounter.value(),
      characterCount: metrics.characterCount,
      nodeCount: metrics.nodeCount,
      insertOperations: metrics.insertCounter.value(),
      deleteOperations: metrics.deleteCounter.value(),
      averageLatency: avgLatency.toFixed(4),
      totalDeltaSize,
      averageDeltaSize: avgDeltaSize.toFixed(2),
      networkStats: this.getCurrentNetworkStats(),
    };
  }

  // Get all metrics
  getAllMetrics() {
    const allMetrics = {};
    for (const [docId, _] of this.documentMetrics) {
      allMetrics[docId] = this.getDocumentMetrics(docId);
    }
    return allMetrics;
  }

  // Network monitoring
  async startNetworkMonitoring() {
    try {
      const initialStats = await si.networkStats();
      if (initialStats && initialStats.length > 0) {
        const primary = initialStats[0];
        this.networkStats.rx_bytes = primary.rx_bytes;
        this.networkStats.tx_bytes = primary.tx_bytes;
      }
    } catch (error) {
      console.error('Network monitoring error:', error);
    }

    // Update every 5 seconds
    setInterval(async () => {
      try {
        const stats = await si.networkStats();
        if (stats && stats.length > 0) {
          const primary = stats[0];
          const now = Date.now();
          const timeDiff = (now - this.networkStats.timestamp) / 1000; // seconds

          const rxDiff = primary.rx_bytes - this.networkStats.rx_bytes;
          const txDiff = primary.tx_bytes - this.networkStats.tx_bytes;

          this.networkStats = {
            rx_bytes: primary.rx_bytes,
            tx_bytes: primary.tx_bytes,
            timestamp: now,
            rx_rate: rxDiff / timeDiff, // bytes/sec
            tx_rate: txDiff / timeDiff, // bytes/sec
          };
        }
      } catch (error) {
        console.error('Network monitoring update error:', error);
      }
    }, 5000);
  }

  getCurrentNetworkStats() {
    return {
      rx_bytes: this.networkStats.rx_bytes,
      tx_bytes: this.networkStats.tx_bytes,
      rx_rate: this.networkStats.rx_rate || 0,
      tx_rate: this.networkStats.tx_rate || 0,
      rx_rate_mbps: ((this.networkStats.rx_rate || 0) * 8) / 1_000_000,
      tx_rate_mbps: ((this.networkStats.tx_rate || 0) * 8) / 1_000_000,
    };
  }

  // Reset metrics for a document
  resetDocumentMetrics(documentId) {
    this.documentMetrics.delete(documentId);
  }

  /**
   * Merge metrics from another replica (for distributed systems)
   * GCounters guarantee conflict-free convergence
   */
  mergeMetrics(documentId, remoteMetrics) {
    this.initDocumentMetrics(documentId);
    const localMetrics = this.documentMetrics.get(documentId);

    // Merge GCounters (conflict-free!)
    if (remoteMetrics.operationCounter) {
      const remoteCounter = new GCounter(
        remoteMetrics.operationCounter.replicaId
      );
      remoteCounter.loadState(remoteMetrics.operationCounter);
      localMetrics.operationCounter.merge(remoteCounter);
    }

    if (remoteMetrics.insertCounter) {
      const remoteCounter = new GCounter(remoteMetrics.insertCounter.replicaId);
      remoteCounter.loadState(remoteMetrics.insertCounter);
      localMetrics.insertCounter.merge(remoteCounter);
    }

    if (remoteMetrics.deleteCounter) {
      const remoteCounter = new GCounter(remoteMetrics.deleteCounter.replicaId);
      remoteCounter.loadState(remoteMetrics.deleteCounter);
      localMetrics.deleteCounter.merge(remoteCounter);
    }
  }

  /**
   * Get serializable state for sharing with other replicas
   */
  getMetricsState(documentId) {
    this.initDocumentMetrics(documentId);
    const metrics = this.documentMetrics.get(documentId);

    return {
      operationCounter: metrics.operationCounter.getState(),
      insertCounter: metrics.insertCounter.getState(),
      deleteCounter: metrics.deleteCounter.getState(),
      characterCount: metrics.characterCount,
      nodeCount: metrics.nodeCount,
      latencies: metrics.latencies.slice(-100), // Last 100 samples
      deltaStates: metrics.deltaStates.slice(-100),
    };
  }
}

export default new MetricsService();
