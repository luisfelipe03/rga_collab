import { randomUUID } from 'crypto';

/**
 * RGA (Replicated Growable Array) CRDT Implementation
 * Used for collaborative text editing
 */
class RGA {
  constructor(replicaId) {
    this.replicaId = replicaId; // Unique identifier for this replica
    this.vertices = new Map(); // Map of vertex ID to vertex object
    this.head = null; // Points to the first vertex
    this.timestamp = 0; // Logical clock
    this.delta = new Map(); // Delta state for Delta-CRDT
    this.causalContext = new Set(); // Causal context for delta operations
  }

  /**
   * Insert a character at a specific position
   */
  insert(value, afterVertexId = null) {
    this.timestamp++;

    const vertexId = `${this.replicaId}:${this.timestamp}`;
    const vertex = {
      id: vertexId,
      value: value,
      timestamp: this.timestamp,
      replicaId: this.replicaId,
      afterId: afterVertexId,
      isTombstone: false,
      next: null,
    };

    this.vertices.set(vertexId, vertex);

    // Insert at head if no afterVertexId
    if (!afterVertexId) {
      if (this.head) {
        vertex.next = this.head;
      }
      this.head = vertexId;
    } else {
      // Find the vertex to insert after
      const afterVertex = this.vertices.get(afterVertexId);
      if (afterVertex) {
        vertex.next = afterVertex.next;
        afterVertex.next = vertexId;
      }
    }

    return {
      type: 'insert',
      vertexId,
      value,
      afterId: afterVertexId,
      timestamp: this.timestamp,
      replicaId: this.replicaId,
    };
  }

  /**
   * Delete a character (tombstone approach)
   */
  delete(vertexId) {
    const vertex = this.vertices.get(vertexId);
    if (vertex && !vertex.isTombstone) {
      vertex.isTombstone = true;
      this.timestamp++;

      return {
        type: 'delete',
        vertexId,
        timestamp: this.timestamp,
        replicaId: this.replicaId,
      };
    }
    return null;
  }

  /**
   * Apply remote operation
   */
  applyOperation(operation) {
    if (operation.type === 'insert') {
      // Check if vertex already exists
      if (this.vertices.has(operation.vertexId)) {
        return;
      }

      const vertex = {
        id: operation.vertexId,
        value: operation.value,
        timestamp: operation.timestamp,
        replicaId: operation.replicaId,
        afterId: operation.afterId,
        isTombstone: false,
        next: null,
      };

      this.vertices.set(operation.vertexId, vertex);

      // Insert in the correct position
      if (!operation.afterId) {
        if (this.head) {
          vertex.next = this.head;
        }
        this.head = operation.vertexId;
      } else {
        const afterVertex = this.vertices.get(operation.afterId);
        if (afterVertex) {
          vertex.next = afterVertex.next;
          afterVertex.next = operation.vertexId;
        }
      }
    } else if (operation.type === 'delete') {
      const vertex = this.vertices.get(operation.vertexId);
      if (vertex) {
        vertex.isTombstone = true;
      }
    }
  }

  /**
   * Get the current text content
   */
  getText() {
    const chars = [];
    let currentId = this.head;

    while (currentId) {
      const vertex = this.vertices.get(currentId);
      if (vertex && !vertex.isTombstone) {
        chars.push(vertex.value);
      }
      currentId = vertex ? vertex.next : null;
    }

    return chars.join('');
  }

  /**
   * Get vertex at position (for editing operations)
   */
  getVertexAtPosition(position) {
    let currentPos = 0;
    let currentId = this.head;

    while (currentId) {
      const vertex = this.vertices.get(currentId);
      if (vertex && !vertex.isTombstone) {
        if (currentPos === position) {
          return vertex.id;
        }
        currentPos++;
      }
      currentId = vertex ? vertex.next : null;
    }

    return null;
  }

  /**
   * Get vertex ID before a position (for inserting after)
   * Returns null if inserting at position 0 (head)
   */
  getVertexBeforePosition(position) {
    if (position === 0) {
      return null;
    }

    let currentPos = 0;
    let currentId = this.head;
    let lastVisibleId = null;

    while (currentId) {
      const vertex = this.vertices.get(currentId);
      if (vertex && !vertex.isTombstone) {
        if (currentPos === position - 1) {
          return vertex.id;
        }
        lastVisibleId = vertex.id;
        currentPos++;
      }
      currentId = vertex ? vertex.next : null;
    }

    // If position is at the end, return last visible vertex
    return lastVisibleId;
  }

  /**
   * Insert at a specific text position
   */
  insertAtPosition(value, position, replicaId) {
    this.timestamp++;

    const afterVertexId = this.getVertexBeforePosition(position);
    const vertexId = `${replicaId}:${Date.now()}:${this.timestamp}`;

    const vertex = {
      id: vertexId,
      value: value,
      timestamp: this.timestamp,
      replicaId: replicaId,
      afterId: afterVertexId,
      isTombstone: false,
      next: null,
    };

    this.vertices.set(vertexId, vertex);

    // Insert at head if no afterVertexId
    if (!afterVertexId) {
      if (this.head) {
        vertex.next = this.head;
      }
      this.head = vertexId;
    } else {
      // Find the vertex to insert after
      const afterVertex = this.vertices.get(afterVertexId);
      if (afterVertex) {
        vertex.next = afterVertex.next;
        afterVertex.next = vertexId;
      }
    }

    return {
      type: 'insert',
      vertexId,
      value,
      afterId: afterVertexId,
      position,
      timestamp: this.timestamp,
      replicaId: replicaId,
    };
  }

  /**
   * Delete at a specific text position
   */
  deleteAtPosition(position, replicaId) {
    const vertexId = this.getVertexAtPosition(position);

    if (!vertexId) {
      return null;
    }

    const vertex = this.vertices.get(vertexId);
    if (vertex && !vertex.isTombstone) {
      vertex.isTombstone = true;
      this.timestamp++;

      return {
        type: 'delete',
        vertexId,
        position,
        timestamp: this.timestamp,
        replicaId: replicaId,
      };
    }
    return null;
  }

  /**
   * Get the state for synchronization
   */
  getState() {
    return {
      replicaId: this.replicaId,
      vertices: Array.from(this.vertices.values()),
      head: this.head,
      timestamp: this.timestamp,
    };
  }

  /**
   * Load state from database (complete state restoration)
   */
  loadState(state) {
    // Clear current state
    this.vertices.clear();
    this.head = state.head;
    this.timestamp = state.timestamp || 0;

    // Restore all vertices
    if (state.vertices && Array.isArray(state.vertices)) {
      state.vertices.forEach((vertex) => {
        this.vertices.set(vertex.id, { ...vertex });
      });
    }
  }

  /**
   * Merge state from another replica
   */
  mergeState(state) {
    state.vertices.forEach((vertex) => {
      if (!this.vertices.has(vertex.id)) {
        this.vertices.set(vertex.id, { ...vertex });
      }
    });

    // Rebuild the linked list structure
    this.rebuildStructure();

    // Update timestamp
    this.timestamp = Math.max(this.timestamp, state.timestamp);
  }

  /**
   * Rebuild the linked list structure after merging
   */
  rebuildStructure() {
    // Clear next pointers
    this.vertices.forEach((vertex) => {
      vertex.next = null;
    });

    // Sort vertices by timestamp and replicaId for deterministic ordering
    const sortedVertices = Array.from(this.vertices.values()).sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.replicaId.localeCompare(b.replicaId);
    });

    // Rebuild based on afterId relationships
    sortedVertices.forEach((vertex) => {
      if (!vertex.afterId) {
        if (this.head) {
          vertex.next = this.head;
        }
        this.head = vertex.id;
      } else {
        const afterVertex = this.vertices.get(vertex.afterId);
        if (afterVertex) {
          vertex.next = afterVertex.next;
          afterVertex.next = vertex.id;
        }
      }
    });
  }

  /**
   * Delta-CRDT: Get delta state (only new changes since last sync)
   */
  getDelta() {
    const deltaVertices = Array.from(this.delta.values());
    const deltaState = {
      replicaId: this.replicaId,
      vertices: deltaVertices,
      timestamp: this.timestamp,
      causalContext: Array.from(this.causalContext),
    };

    // Clear delta after getting it
    this.delta.clear();

    return deltaState;
  }

  /**
   * Delta-CRDT: Apply delta state from another replica
   */
  applyDelta(delta) {
    if (!delta || !delta.vertices) return;

    delta.vertices.forEach((vertex) => {
      if (!this.vertices.has(vertex.id)) {
        this.vertices.set(vertex.id, { ...vertex });

        // Update causal context
        this.causalContext.add(vertex.id);
      }
    });

    // Rebuild structure if needed
    if (delta.vertices.length > 0) {
      this.rebuildStructure();
    }

    // Update timestamp
    this.timestamp = Math.max(this.timestamp, delta.timestamp || 0);
  }

  /**
   * Add operation to delta for Delta-CRDT propagation
   */
  addToDelta(vertex) {
    this.delta.set(vertex.id, vertex);
    this.causalContext.add(vertex.id);
  }

  /**
   * Get metrics about the RGA structure
   */
  getMetrics() {
    const totalNodes = this.vertices.size;
    const activeNodes = Array.from(this.vertices.values()).filter(
      (v) => !v.isTombstone
    ).length;
    const tombstoneNodes = totalNodes - activeNodes;
    const textLength = this.getText().length;

    return {
      totalNodes,
      activeNodes,
      tombstoneNodes,
      textLength,
      compressionRatio:
        totalNodes > 0 ? ((textLength / totalNodes) * 100).toFixed(2) : 0,
    };
  }
}

export default RGA;
