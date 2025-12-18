import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useSocket } from '../context/SocketContext';
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
  const { connected } = useSocket();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');

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
          <h1>Documents</h1>
          <div className="connection-status">
            <span
              className={`status-indicator ${
                connected ? 'connected' : 'disconnected'
              }`}
            />
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        <div className="header-right">
          <span className="username">{currentUser?.username}</span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            New Document
          </button>
          <button onClick={logout} className="btn-secondary">
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="documents-grid">
          {documents.length === 0 ? (
            <div className="empty-state">
              <p>No documents yet</p>
              <p className="empty-state-subtitle">
                Create your first document to get started
              </p>
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.documentId} className="document-card">
                <h3>{doc.title}</h3>
                <div className="document-meta">
                  <span>Created: {formatDate(doc.createdAt)}</span>
                  <span>Collaborators: {doc.collaborators?.length || 0}</span>
                </div>
                <button
                  onClick={() => handleJoinDocument(doc.documentId)}
                  className="btn-open"
                >
                  Open
                </button>
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
            <h2>Create New Document</h2>
            <form onSubmit={handleCreateDocument}>
              <div className="form-group">
                <label htmlFor="doc-title">Document Title</label>
                <input
                  id="doc-title"
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder="Enter document title"
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
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
