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

  // Refs para acesso dentro dos callbacks do socket
  const currentUserRef = React.useRef(currentUser);
  const currentDocumentRef = React.useRef(currentDocument);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    currentDocumentRef.current = currentDocument;
  }, [currentDocument]);

  useEffect(() => {
    if (!socket) return;

    // Handler de conexão/reconexão
    const handleConnect = () => {
      if (currentUserRef.current) {
        console.log('Socket reconnected, restoring session...');
        socket.emit('register', currentUserRef.current.username);
      }
    };

    socket.on('connect', handleConnect);

    socket.on('registered', (user) => {
      console.log('User registered:', user);
      setCurrentUser(user);

      // Se havia um documento ativo, tenta reentrar nele
      if (currentDocumentRef.current) {
        console.log('Rejoining document:', currentDocumentRef.current.documentId);
        socket.emit('join-document', {
          documentId: currentDocumentRef.current.documentId,
          userId: user.id,
          username: user.username,
        });
      }
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

    socket.on('collaborators-changed', () => {
      // Update document list when collaborators count changes
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
      // Ignora erro de "User not registered" se estivermos em processo de reconexão?
      // Por enquanto, mostra todos os erros, mas o usuário não deve ver esse se a reconexão funcionar rápido.
      if (message !== 'User not registered') {
        alert(`Erro: ${message}`);
      } else {
        console.warn('Suppressing expected "User not registered" error during reconnection');
      }
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('registered');
      socket.off('documents-list');
      socket.off('document-created');
      socket.off('document-loaded');
      socket.off('room-users');
      socket.off('metrics-update');
      socket.off('documents-updated');
      socket.off('collaborators-changed');
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
