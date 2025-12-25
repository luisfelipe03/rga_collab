import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import '../styles/Trash.css';

const Trash = ({ onClose }) => {
  const { socket } = useSocket();
  const [trashedDocs, setTrashedDocs] = useState([]);

  useEffect(() => {
    if (!socket) return;

    // Request trash list
    socket.emit('list-trash');

    // Listen for trash list
    const handleTrashList = (docs) => {
      setTrashedDocs(docs);
    };

    // Listen for trash updates
    const handleTrashUpdated = () => {
      socket.emit('list-trash');
    };

    socket.on('trash-list', handleTrashList);
    socket.on('trash-updated', handleTrashUpdated);

    return () => {
      socket.off('trash-list', handleTrashList);
      socket.off('trash-updated', handleTrashUpdated);
    };
  }, [socket]);

  const handleRestore = (documentId) => {
    if (socket) {
      socket.emit('restore-document', { documentId });
    }
  };

  const handlePermanentDelete = (documentId, title) => {
    if (
      window.confirm(
        `Tem certeza que deseja excluir permanentemente "${title}"? Esta ação não pode ser desfeita.`
      )
    ) {
      if (socket) {
        socket.emit('permanently-delete-document', { documentId });
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="trash-overlay" onClick={onClose}>
      <div className="trash-container" onClick={(e) => e.stopPropagation()}>
        <div className="trash-header">
          <h2>Lixeira</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="trash-content">
          {trashedDocs.length === 0 ? (
            <div className="trash-empty">
              <p>A lixeira está vazia</p>
              <p className="trash-empty-subtitle">
                Documentos excluídos aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="trash-list">
              {trashedDocs.map((doc) => (
                <div key={doc.documentId} className="trash-item">
                  <div className="trash-item-info">
                    <h3>{doc.title}</h3>
                    <span className="trash-item-date">
                      Excluído em: {formatDate(doc.deletedAt)}
                    </span>
                  </div>
                  <div className="trash-item-actions">
                    <button
                      onClick={() => handleRestore(doc.documentId)}
                      className="btn-restore"
                    >
                      Restaurar
                    </button>
                    <button
                      onClick={() =>
                        handlePermanentDelete(doc.documentId, doc.title)
                      }
                      className="btn-delete-permanent"
                    >
                      Excluir Permanentemente
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Trash;
