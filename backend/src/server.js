import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import connectDB from './config/database.js';
import DocumentService from './services/DocumentService.js';
import MetricsService from './services/MetricsService.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is running');
});

// Metrics endpoints
app.get('/api/metrics', (req, res) => {
  const allMetrics = MetricsService.getAllMetrics();
  res.json(allMetrics);
});

app.get('/api/metrics/:documentId', (req, res) => {
  const { documentId } = req.params;
  const metrics = DocumentService.getDocumentMetrics(documentId);
  if (!metrics) {
    return res.status(404).json({ error: 'Document not found or not loaded' });
  }
  res.json(metrics);
});

// Store connected users and their current documents
const users = new Map();
const documentRooms = new Map(); // documentId -> Set of socket IDs

io.on('connection', (socket) => {
  // Handle user registration
  socket.on('register', (username) => {
    const userId = randomUUID();
    const user = {
      id: userId,
      socketId: socket.id,
      username: username || `User-${userId.slice(0, 8)}`,
      currentDocument: null,
    };

    users.set(socket.id, user);

    socket.emit('registered', user);
    io.emit('users', Array.from(users.values()));
  });

  // Create new document
  socket.on('create-document', async ({ userId, username, title }) => {
    try {
      const user = users.get(socket.id);
      if (!user) {
        socket.emit('error', { message: 'User not registered' });
        return;
      }

      const document = await DocumentService.createDocument(
        userId,
        username,
        title
      );
      socket.emit('document-created', document);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // List documents
  socket.on('list-documents', async () => {
    try {
      const documents = await DocumentService.listDocuments();

      // Add active collaborators count for each document
      const documentsWithActiveCount = documents.map((doc) => {
        const activeCount = documentRooms.get(doc.documentId)?.size || 0;
        return {
          ...doc.toObject(),
          activeCollaborators: activeCount,
        };
      });

      socket.emit('documents-list', documentsWithActiveCount);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Join a document room
  socket.on('join-document', async ({ documentId, userId, username }) => {
    try {
      const user = users.get(socket.id);
      if (!user) {
        socket.emit('error', { message: 'User not registered' });
        return;
      }

      // Leave previous document room if any
      if (user.currentDocument) {
        socket.leave(user.currentDocument);
        const prevRoom = documentRooms.get(user.currentDocument);
        if (prevRoom) {
          prevRoom.delete(socket.id);
        }
      }

      // Join new document room
      socket.join(documentId);
      user.currentDocument = documentId;

      if (!documentRooms.has(documentId)) {
        documentRooms.set(documentId, new Set());
      }
      documentRooms.get(documentId).add(socket.id);

      // Load document
      const document = await DocumentService.getDocument(
        documentId,
        userId,
        username
      );

      socket.emit('document-loaded', document);

      // Get ALL users currently in the room (including the one who just joined)
      const roomUsers = [];
      const socketsInRoom = documentRooms.get(documentId);
      if (socketsInRoom) {
        for (const socketId of socketsInRoom) {
          const roomUser = users.get(socketId);
          if (roomUser) {
            roomUsers.push({
              userId: roomUser.id,
              username: roomUser.username,
            });
          }
        }
      }

      // Send complete room users list to ALL users in the room
      io.to(documentId).emit('room-users', roomUsers);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Handle cursor updates
  socket.on('cursor-update', ({ documentId, position }) => {
    const user = users.get(socket.id);
    if (user && user.currentDocument === documentId) {
      socket.to(documentId).emit('cursor-move', {
        userId: user.id,
        username: user.username,
        position,
      });
    }
  });

  // Handle text operations
  socket.on('operation', async ({ documentId, operation }) => {
    try {
      const user = users.get(socket.id);
      if (!user || user.currentDocument !== documentId) {
        socket.emit('error', { message: 'Not in document' });
        return;
      }

      // Apply operation and get the RGA operation
      const result = await DocumentService.applyOperation(
        documentId,
        operation
      );

      if (result.operation) {
        // Broadcast the RGA operation and delta to all users in the document room except sender
        socket.to(documentId).emit('operation', {
          operation: result.operation,
          delta: result.delta,
          userId: user.id,
          username: user.username,
        });

        // Send metrics update to all users in the room
        const metrics = DocumentService.getDocumentMetrics(documentId);
        io.to(documentId).emit('metrics-update', metrics);
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Leave document
  socket.on('leave-document', ({ documentId }) => {
    const user = users.get(socket.id);
    if (user && user.currentDocument === documentId) {
      socket.leave(documentId);
      user.currentDocument = null;

      const room = documentRooms.get(documentId);
      if (room) {
        room.delete(socket.id);
      }

      // Get updated list of users in the room
      const roomUsers = [];
      if (room) {
        for (const socketId of room) {
          const roomUser = users.get(socketId);
          if (roomUser) {
            roomUsers.push({
              userId: roomUser.id,
              username: roomUser.username,
            });
          }
        }
      }

      // Send updated user list to remaining users
      io.to(documentId).emit('room-users', roomUsers);
    }
  });

  // Delete document (soft delete)
  socket.on('delete-document', async ({ documentId, userId }) => {
    try {
      const user = users.get(socket.id);
      if (!user) {
        socket.emit('error', { message: 'User not registered' });
        return;
      }

      // Check if anyone is editing
      const activeCount = documentRooms.get(documentId)?.size || 0;
      if (activeCount > 0) {
        socket.emit('error', {
          message: 'Cannot delete document while users are editing',
        });
        return;
      }

      const result = await DocumentService.deleteDocument(documentId, userId);
      socket.emit('document-deleted', result);

      // Notify all clients to refresh document list
      io.emit('documents-updated');
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // List trash
  socket.on('list-trash', async () => {
    try {
      const documents = await DocumentService.listDeletedDocuments();
      socket.emit('trash-list', documents);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Restore document
  socket.on('restore-document', async ({ documentId }) => {
    try {
      const result = await DocumentService.restoreDocument(documentId);
      socket.emit('document-restored', result);

      // Notify all clients to refresh document list
      io.emit('documents-updated');
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Permanently delete document
  socket.on('permanently-delete-document', async ({ documentId }) => {
    try {
      const result = await DocumentService.permanentlyDeleteDocument(
        documentId
      );
      socket.emit('document-permanently-deleted', result);

      // Notify all clients to refresh trash
      io.emit('trash-updated');
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      // Leave document room
      if (user.currentDocument) {
        const room = documentRooms.get(user.currentDocument);
        if (room) {
          room.delete(socket.id);
        }

        // Get updated list of users in the room
        const roomUsers = [];
        if (room) {
          for (const socketId of room) {
            const roomUser = users.get(socketId);
            if (roomUser) {
              roomUsers.push({
                userId: roomUser.id,
                username: roomUser.username,
              });
            }
          }
        }

        // Send updated user list to remaining users
        io.to(user.currentDocument).emit('room-users', roomUsers);
      }

      // Remove user from users map
      users.delete(socket.id);
      io.emit('users', Array.from(users.values()));
    }
  });
});

httpServer.listen(PORT);
