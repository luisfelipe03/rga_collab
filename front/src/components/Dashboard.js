import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useSocket } from '../context/SocketContext';
import About from './About';
import Trash from './Trash';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const {
    currentUser,
    documents,
    loadDocuments,
    createDocument,
    joinDocument,
    logout,
  } = useApp();
  const { socket, connected } = useSocket();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [showAbout, setShowAbout] = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleCreateDocument = (e) => {
    e.preventDefault();
    if (newDocTitle.trim()) {
      createDocument(newDocTitle.trim());
      setNewDocTitle('');
      setShowCreateModal(false);
    }
  };

  const handleJoinDocument = (documentId) => {
    joinDocument(documentId);
  };

  const handleDeleteDocument = (documentId, title, activeCollaborators) => {
    if (activeCollaborators > 0) {
      alert(
        'Não é possível excluir o documento enquanto houver usuários editando.'
      );
      return;
    }

    if (
      window.confirm(`Tem certeza que deseja mover "${title}" para a lixeira?`)
    ) {
      if (socket && currentUser) {
        socket.emit('delete-document', { documentId, userId: currentUser.id });
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <img src="/ufape-logo.png" alt="UFAPE" className="dashboard-logo" />
          <div className="header-title-group">
            <h1>RGA collab</h1>
            <span className="header-subtitle">
              Sistema de Edição Colaborativa
            </span>
          </div>
          <div className="connection-status">
            <span
              className={`status-indicator ${
                connected ? 'connected' : 'disconnected'
              }`}
            />
            {connected ? 'Conectado' : 'Desconectado'}
          </div>
        </div>

        <div className="header-right">
          <span className="username">{currentUser?.username}</span>
          <button onClick={() => setShowTrash(true)} className="btn-secondary">
            Lixeira
          </button>
          <button onClick={() => setShowAbout(true)} className="btn-secondary">
            Sobre
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Novo Documento
          </button>
          <button onClick={logout} className="btn-secondary">
            Sair
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="documents-grid">
          {documents.length === 0 ? (
            <div className="empty-state">
              <p>Nenhum documento ainda</p>
              <p className="empty-state-subtitle">
                Crie seu primeiro documento para começar
              </p>
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.documentId} className="document-card">
                <h3>{doc.title}</h3>
                <div className="document-meta">
                  <span>Criado em: {formatDate(doc.createdAt)}</span>
                  <span>Colaboradores: {doc.activeCollaborators || 0}</span>
                </div>
                <div className="document-card-actions">
                  <button
                    onClick={() => handleJoinDocument(doc.documentId)}
                    className="btn-open"
                  >
                    Abrir
                  </button>
                  <button
                    onClick={() =>
                      handleDeleteDocument(
                        doc.documentId,
                        doc.title,
                        doc.activeCollaborators
                      )
                    }
                    className="btn-delete"
                    disabled={doc.activeCollaborators > 0}
                    title={
                      doc.activeCollaborators > 0
                        ? 'Não é possível excluir enquanto houver usuários editando'
                        : 'Mover para lixeira'
                    }
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Criar Novo Documento</h2>
            <form onSubmit={handleCreateDocument}>
              <div className="form-group">
                <label htmlFor="doc-title">Título do Documento</label>
                <input
                  id="doc-title"
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="Digite o título do documento"
                  autoFocus
                  required
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAbout && <About onClose={() => setShowAbout(false)} />}
      {showTrash && <Trash onClose={() => setShowTrash(false)} />}
    </div>
  );
};

export default Dashboard;
