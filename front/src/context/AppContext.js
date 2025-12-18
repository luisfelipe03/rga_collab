import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useSocket } from './SocketContext';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const { socket } = useSocket();
  const [currentUser, setCurrentUser] = useState(null);
  const [currentDocument, setCurrentDocument] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [editorContent, setEditorContent] = useState('');

  useEffect(() => {
    if (!socket) return;

    socket.on('registered', (user) => {
      setCurrentUser(user);
    });

    socket.on('documents-list', (docs) => {
      setDocuments(docs);
    });

    socket.on('document-created', (doc) => {
      setDocuments((prev) => [doc, ...prev]);
    });

    socket.on('document-loaded', (doc) => {
      setCurrentDocument(doc);
      setEditorContent(doc.content || '');
    });

    socket.on('room-users', (users) => {
      // Set all current users in the room - this is the single source of truth
      setCollaborators(
        users.map((u) => ({
          userId: u.userId,
          username: u.username,
          active: true,
        }))
      );
    });

    socket.on('metrics-update', (newMetrics) => {
      setMetrics(newMetrics);
    });

    socket.on('documents-updated', () => {
      // Reload documents list when a document is deleted or restored
      socket.emit('list-documents');
    });

    socket.on('document-deleted', ({ message }) => {
      alert(message);
      socket.emit('list-documents');
    });

    socket.on('document-restored', ({ message }) => {
      alert(message);
      socket.emit('list-documents');
    });

    socket.on('error', ({ message }) => {
      console.error('Socket error:', message);
      alert(`Erro: ${message}`);
    });

    return () => {
      socket.off('registered');
      socket.off('documents-list');
      socket.off('document-created');
      socket.off('document-loaded');
      socket.off('room-users');
      socket.off('metrics-update');
      socket.off('documents-updated');
      socket.off('document-deleted');
      socket.off('document-restored');
      socket.off('error');
    };
  }, [socket]);

  const login = (username) => {
    if (socket) {
      socket.emit('register', username);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setCurrentDocument(null);
    setCollaborators([]);
    setMetrics(null);
  };

  const createDocument = useCallback(
    (title) => {
      if (socket && currentUser) {
        socket.emit('create-document', {
          userId: currentUser.id,
          username: currentUser.username,
          title,
        });
      }
    },
    [socket, currentUser]
  );

  const loadDocuments = useCallback(() => {
    if (socket) {
      socket.emit('list-documents');
    }
  }, [socket]);

  const joinDocument = useCallback(
    (documentId) => {
      if (socket && currentUser) {
        socket.emit('join-document', {
          documentId,
          userId: currentUser.id,
          username: currentUser.username,
        });
      }
    },
    [socket, currentUser]
  );

  const leaveDocument = useCallback(() => {
    if (socket && currentDocument) {
      socket.emit('leave-document', {
        documentId: currentDocument.documentId,
      });
      setCurrentDocument(null);
      setCollaborators([]);
      setMetrics(null);
    }
  }, [socket, currentDocument]);

  const sendOperation = useCallback(
    (operation) => {
      if (socket && currentDocument) {
        socket.emit('operation', {
          documentId: currentDocument.documentId,
          operation,
        });
      }
    },
    [socket, currentDocument]
  );

  return (
    <AppContext.Provider
      value={{
        currentUser,
        currentDocument,
        documents,
        collaborators,
        metrics,
        editorContent,
        setEditorContent,
        login,
        logout,
        createDocument,
        loadDocuments,
        joinDocument,
        leaveDocument,
        sendOperation,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
