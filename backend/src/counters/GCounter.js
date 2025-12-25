/**
 * GCounter - Grow-only Counter CRDT
 * A conflict-free replicated data type that only allows increments
 * Perfect for counting operations in distributed systems
 */
class GCounter {
  constructor(replicaId) {
    this.replicaId = replicaId;
    // Map of replicaId -> count
    this.counts = new Map();
    this.counts.set(replicaId, 0);
  }

  /**
   * Increment the counter for this replica
   * @param {number} delta - Amount to increment (default: 1)
   */
  increment(delta = 1) {
    if (delta < 0) {
      throw new Error(
        'GCounter can only increment (use PN-Counter for decrements)'
      );
    }
    const currentCount = this.counts.get(this.replicaId) || 0;
    this.counts.set(this.replicaId, currentCount + delta);
  }

  /**
   * Get the total value across all replicas
   * @returns {number} Sum of all replica counts
   */
  value() {
    let sum = 0;
    for (const count of this.counts.values()) {
      sum += count;
    }
    return sum;
  }

  /**
   * Merge with another GCounter (for replication)
   * Takes the maximum value for each replica
   * @param {GCounter} other - Another GCounter to merge with
   */
  merge(other) {
    for (const [replicaId, count] of other.counts.entries()) {
      const currentCount = this.counts.get(replicaId) || 0;
      this.counts.set(replicaId, Math.max(currentCount, count));
    }
  }

  /**
   * Get the state for serialization
   * @returns {Object} Serializable state
   */
  getState() {
    return {
      replicaId: this.replicaId,
      counts: Array.from(this.counts.entries()),
    };
  }

  /**
   * Load state from serialized data
   * @param {Object} state - State to load
   */
  loadState(state) {
    this.replicaId = state.replicaId;
    this.counts = new Map(state.counts);
  }

  /**
   * Compare with another GCounter
   * @param {GCounter} other - Another GCounter
   * @returns {boolean} True if causally equal
   */
  equals(other) {
    if (this.counts.size !== other.counts.size) {
      return false;
    }

    for (const [replicaId, count] of this.counts.entries()) {
      if (other.counts.get(replicaId) !== count) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all replica counts (for debugging)
   * @returns {Map} Map of replicaId -> count
   */
  getCounts() {
    return new Map(this.counts);
  }
}

export default GCounter;
