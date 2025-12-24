import Document from '../models/Document.js';
import RGA from '../crdt/RGA.js';
import { randomUUID } from 'crypto';
import MetricsService from './MetricsService.js';

class DocumentService {
  constructor() {
    // Store active RGA instances in memory (documentId -> RGA instance)
    this.activeDocuments = new Map();
  }

  /**
   * Create a new document
   */
  async createDocument(userId, username, title = 'Untitled Document') {
    const documentId = randomUUID();
    const replicaId = `server-${documentId}`;

    // Create RGA instance
    const rga = new RGA(replicaId);

    // Create document in database
    const document = new Document({
      documentId,
      title,
      createdBy: userId,
      collaborators: [
        {
          userId,
          username,
          lastActive: new Date(),
        },
      ],
      rgaState: rga.getState(),
    });

    await document.save();

    // Store in memory
    this.activeDocuments.set(documentId, rga);

    return {
      documentId,
      title,
      content: '',
      collaborators: document.collaborators,
    };
  }

  /**
   * Get or load a document
   */
  async getDocument(documentId, userId, username) {
    // Check if already loaded in memory
    let rga = this.activeDocuments.get(documentId);
    let document;

    if (!rga) {
      // Load from database
      document = await Document.findOne({ documentId });

      if (!document) {
        throw new Error('Document not found');
      }

      // Recreate RGA from state
      const replicaId = document.rgaState?.replicaId || `server-${documentId}`;
      rga = new RGA(replicaId);

      // Load complete state from database
      if (
        document.rgaState &&
        document.rgaState.vertices &&
        document.rgaState.vertices.length > 0
      ) {
        rga.loadState(document.rgaState);
      }

      this.activeDocuments.set(documentId, rga);
    } else {
      // Document already in memory, get from DB for collaborator info
      document = await Document.findOne({ documentId });
    }

    // Add user as collaborator if not already
    if (document) {
      const isCollaborator = document.collaborators.some(
        (c) => c.userId === userId
      );
      if (!isCollaborator) {
        document.collaborators.push({
          userId,
          username,
          lastActive: new Date(),
        });
        await document.save();
      }
    }

    const content = rga.getText();

    return {
      documentId,
      title: document?.title || 'Untitled Document',
      content: content,
      rgaState: rga.getState(),
    };
  }

  /**
   * Apply an operation to a document
   */
  async applyOperation(documentId, operation) {
    const startTime = process.hrtime.bigint();

    const rga = this.activeDocuments.get(documentId);

    if (!rga) {
      throw new Error('Document not loaded');
    }

    let rgaOperation;

    // Convert position-based operation to RGA operation
    if (operation.type === 'insert' && operation.position !== undefined) {
      rgaOperation = rga.insertAtPosition(
        operation.value,
        operation.position,
        operation.replicaId
      );
    } else if (
      operation.type === 'delete' &&
      operation.position !== undefined
    ) {
      rgaOperation = rga.deleteAtPosition(
        operation.position,
        operation.replicaId
      );
    } else {
      // Already an RGA operation with vertexId
      rga.applyRemoteOperation(operation);
      rgaOperation = operation;
    }

    if (!rgaOperation) {
      return { content: rga.getText(), operation: null };
    }

    // Calculate latency with microsecond precision
    const endTime = process.hrtime.bigint();
    const latency = Number(endTime - startTime) / 1000000; // Convert nanoseconds to milliseconds

    // Get delta size for metrics
    const delta = rga.getDelta();
    const deltaSize = JSON.stringify(delta).length;

    // Record metrics
    MetricsService.recordOperation(
      documentId,
      rgaOperation.type,
      latency,
      deltaSize
    );

    // Update character and node counts
    const rgaMetrics = rga.getMetrics();
    MetricsService.updateCharacterCount(documentId, rgaMetrics.textLength);
    MetricsService.updateNodeCount(documentId, rgaMetrics.totalNodes);

    // Save operation to database
    await Document.findOneAndUpdate(
      { documentId },
      {
        $push: { operations: rgaOperation },
        rgaState: rga.getState(),
      }
    );

    return {
      content: rga.getText(),
      operation: rgaOperation,
      latency,
      delta,
    };
  }

  /**
   * Save document state to database
   */
  async saveDocument(documentId) {
    const rga = this.activeDocuments.get(documentId);

    if (!rga) {
      throw new Error('Document not loaded');
    }

    await Document.findOneAndUpdate(
      { documentId },
      { rgaState: rga.getState() }
    );
  }

  /**
   * Get RGA instance for a document
   */
  getRGA(documentId) {
    return this.activeDocuments.get(documentId);
  }

  /**
   * Get metrics for a document
   */
  getDocumentMetrics(documentId) {
    const rga = this.activeDocuments.get(documentId);
    if (!rga) {
      return null;
    }

    const rgaMetrics = rga.getMetrics();
    const serviceMetrics = MetricsService.getDocumentMetrics(documentId);

    return {
      ...rgaMetrics,
      ...serviceMetrics,
    };
  }

  /**
   * List all documents
   */
  async listDocuments() {
    return await Document.find(
      { deleted: false },
      {
        documentId: 1,
        title: 1,
        createdBy: 1,
        collaborators: 1,
        createdAt: 1,
        updatedAt: 1,
      }
    ).sort({ updatedAt: -1 });
  }

  /**
   * List deleted documents (trash)
   */
  async listDeletedDocuments() {
    return await Document.find(
      { deleted: true },
      {
        documentId: 1,
        title: 1,
        createdBy: 1,
        deletedAt: 1,
        deletedBy: 1,
      }
    ).sort({ deletedAt: -1 });
  }

  /**
   * Soft delete a document
   */
  async deleteDocument(documentId, userId) {
    const doc = await Document.findOne({ documentId });
    if (!doc) {
      throw new Error('Document not found');
    }

    if (doc.deleted) {
      throw new Error('Document already deleted');
    }

    doc.deleted = true;
    doc.deletedAt = new Date();
    doc.deletedBy = userId;
    await doc.save();

    return { success: true, message: 'Document moved to trash' };
  }

  /**
   * Restore a deleted document
   */
  async restoreDocument(documentId) {
    const doc = await Document.findOne({ documentId });
    if (!doc) {
      throw new Error('Document not found');
    }

    if (!doc.deleted) {
      throw new Error('Document is not deleted');
    }

    doc.deleted = false;
    doc.deletedAt = undefined;
    doc.deletedBy = undefined;
    await doc.save();

    return { success: true, message: 'Document restored' };
  }

  /**
   * Permanently delete a document
   */
  async permanentlyDeleteDocument(documentId) {
    const result = await Document.deleteOne({ documentId, deleted: true });
    if (result.deletedCount === 0) {
      throw new Error('Document not found in trash');
    }

    // Remove from loaded instances
    this.documents.delete(documentId);

    return { success: true, message: 'Document permanently deleted' };
  }
}

export default new DocumentService();
