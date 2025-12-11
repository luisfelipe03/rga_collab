import Document from '../models/Document.js';
import RGA from '../crdt/RGA.js';
import { randomUUID } from 'crypto';

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
    console.log(
      `Document loaded: ${documentId}, content length: ${content.length}`
    );

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
      rga.applyOperation(operation);
      rgaOperation = operation;
    }

    if (!rgaOperation) {
      return { content: rga.getText(), operation: null };
    }

    // Save operation to database
    await Document.findOneAndUpdate(
      { documentId },
      {
        $push: { operations: rgaOperation },
        rgaState: rga.getState(),
      }
    );

    console.log(
      `RGA operation applied: ${rgaOperation.type}, content: "${rga.getText()}"`
    );

    return {
      content: rga.getText(),
      operation: rgaOperation,
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
   * List all documents
   */
  async listDocuments() {
    return await Document.find(
      {},
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
}

export default new DocumentService();
