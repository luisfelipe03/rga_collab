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

    if (!rga) {
      // Load from database
      const document = await Document.findOne({ documentId });

      if (!document) {
        throw new Error('Document not found');
      }

      // Recreate RGA from state
      rga = new RGA(document.rgaState.replicaId);
      if (document.rgaState.vertices) {
        rga.mergeState(document.rgaState);
      }

      this.activeDocuments.set(documentId, rga);

      // Add user as collaborator if not already
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

    return {
      documentId,
      content: rga.getText(),
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

    // Apply operation to RGA
    rga.applyOperation(operation);

    // Save operation to database
    await Document.findOneAndUpdate(
      { documentId },
      {
        $push: { operations: operation },
        rgaState: rga.getState(),
      }
    );

    return {
      content: rga.getText(),
      operation,
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
