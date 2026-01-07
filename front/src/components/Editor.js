import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useSocket } from '../context/SocketContext';
import RGA from '../crdt/RGA.js';
import UsersPanel from './UsersPanel';
import MetricsPanel from './MetricsPanel';
import RemoteCursors from './RemoteCursors';
import ChartsPanel from './ChartsPanel';
import '../styles/Editor.css';

const Editor = () => {
  const {
    currentUser,
    currentDocument,
    collaborators,
    metrics,
    leaveDocument,
  } = useApp();
  const { socket, connected } = useSocket();
  const textareaRef = useRef(null);
  const rgaRef = useRef(null);
  const [content, setContent] = useState('');
  const [remoteCursors, setRemoteCursors] = useState({});
  const [showDebug, setShowDebug] = useState(false); // Estado para toggle de debug
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [showCharts, setShowCharts] = useState(false); // Toggle para ver gráficos

  // Inicializa o RGA quando o documento é carregado
  useEffect(() => {
    if (!currentDocument || !currentUser) return;

    const rga = new RGA(currentUser.id);

    if (currentDocument.rgaState) {
      rga.loadState(currentDocument.rgaState);
    }

    rgaRef.current = rga;
    setContent(rga.getText());

    return () => {
      rgaRef.current = null;
    };
  }, [currentDocument, currentUser]);

  // Escuta operações remotas
  useEffect(() => {
    if (!socket || !currentDocument) return;

    // Handler para operação única
    const handleOperation = ({ operation }) => {
      const rga = rgaRef.current;
      if (!rga) return;

      // Salva posição do cursor baseada no ID do nó anterior para manter consistência
      const textarea = textareaRef.current;
      const cursorStart = textarea ? textarea.selectionStart : null;
      const cursorEnd = textarea ? textarea.selectionEnd : null;

      const idBeforeStart = cursorStart !== null ? rga.getNodeIdBeforePosition(cursorStart) : null;
      const idBeforeEnd = cursorEnd !== null ? rga.getNodeIdBeforePosition(cursorEnd) : null;

      rga.applyRemoteOperation(operation);
      setContent(rga.getText());

      // Restaura posição do cursor após o render do React
      if (textarea && idBeforeStart !== null && idBeforeEnd !== null) {
        setTimeout(() => {
          const newStart = rga.getPositionOfNodeId(idBeforeStart);
          const newEnd = rga.getPositionOfNodeId(idBeforeEnd);
          textarea.setSelectionRange(newStart, newEnd);
        }, 0);
      }
    };

    // Handler para batch de operações
    const handleOperations = ({ operations }) => {
      const rga = rgaRef.current;
      if (!rga || !Array.isArray(operations)) return;

      // Salva posição do cursor baseada no ID do nó anterior
      const textarea = textareaRef.current;
      const cursorStart = textarea ? textarea.selectionStart : null;
      const cursorEnd = textarea ? textarea.selectionEnd : null;

      const idBeforeStart = cursorStart !== null ? rga.getNodeIdBeforePosition(cursorStart) : null;
      const idBeforeEnd = cursorEnd !== null ? rga.getNodeIdBeforePosition(cursorEnd) : null;

      rga.applyRemoteOperations(operations);  // Usa o novo método
      setContent(rga.getText());

      // Restaura posição do cursor após o render do React
      if (textarea && idBeforeStart !== null && idBeforeEnd !== null) {
        setTimeout(() => {
          const newStart = rga.getPositionOfNodeId(idBeforeStart);
          const newEnd = rga.getPositionOfNodeId(idBeforeEnd);
          textarea.setSelectionRange(newStart, newEnd);
        }, 0);
      }
    };

    const handleCursorMove = ({ userId, username, position }) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [userId]: { username, position, timestamp: Date.now() },
      }));
    };

    const handleMetricsUpdate = (newMetrics) => {
      setMetricsHistory((prev) => {
        const now = Date.now();
        // Mantém apenas os últimos 120 pontos de dados (aprox. 2-4 minutos)
        // para não pesar a memória do navegador
        const newHistory = [...prev, { ...newMetrics, timestamp: now }];
        if (newHistory.length > 120) {
          return newHistory.slice(newHistory.length - 120);
        }
        return newHistory;
      });
    };

    socket.on('operation', handleOperation);
    socket.on('operations', handleOperations);  // Novo: batch
    socket.on('cursor-move', handleCursorMove);
    socket.on('metrics-update', handleMetricsUpdate);

    return () => {
      socket.off('operation', handleOperation);
      socket.off('operations', handleOperations);  // Novo: batch
      socket.off('cursor-move', handleCursorMove);
      socket.off('metrics-update', handleMetricsUpdate);
    };
  }, [socket, currentDocument]);

  // Limpar cursores de usuários que saíram
  useEffect(() => {
    if (!collaborators) return;

    const activeUserIds = new Set(collaborators.map((c) => c.userId));
    setRemoteCursors((prev) => {
      const newCursors = { ...prev };
      let changed = false;

      Object.keys(newCursors).forEach((userId) => {
        if (!activeUserIds.has(userId)) {
          delete newCursors[userId];
          changed = true;
        }
      });

      return changed ? newCursors : prev;
    });
  }, [collaborators]);

  const handleSelectionChange = useCallback(() => {
    if (!textareaRef.current || !socket || !currentDocument) return;

    const position = textareaRef.current.selectionStart;
    socket.emit('cursor-update', {
      documentId: currentDocument.documentId,
      position,
    });
  }, [socket, currentDocument]);

  const handleTextChange = useCallback(
    (e) => {
      const rga = rgaRef.current;
      if (!rga || !socket || !currentDocument) return;

      const newContent = e.target.value;
      const oldContent = content;

      if (newContent === oldContent) return;

      // Algoritmo de diff simples para detectar mudanças (prefixo/sufixo comum)
      let start = 0;
      while (
        start < oldContent.length &&
        start < newContent.length &&
        oldContent[start] === newContent[start]
      ) {
        start++;
      }

      let endOld = oldContent.length - 1;
      let endNew = newContent.length - 1;
      while (
        endOld >= start &&
        endNew >= start &&
        oldContent[endOld] === newContent[endNew]
      ) {
        endOld--;
        endNew--;
      }

      const deletedCount = endOld - start + 1;
      const insertedText = newContent.substring(start, endNew + 1);

      const operations = [];

      // 1. Processa Deleções
      for (let i = 0; i < deletedCount; i++) {
        const operation = rga.removeAtPosition(start);
        if (operation) {
          operations.push(operation);
        }
      }

      // 2. Processa Inserções
      for (let i = 0; i < insertedText.length; i++) {
        const char = insertedText[i];
        const operation = rga.insertAtPosition(char, start + i);
        if (operation) {
          operations.push(operation);
        }
      }

      // Envia todas as operações em batch (se houver mais de uma)
      if (operations.length > 0) {
        if (operations.length === 1) {
          // Operação única - usa o evento singular para compatibilidade
          socket.emit('operation', {
            documentId: currentDocument.documentId,
            operation: operations[0],
          });
        } else {
          // Múltiplas operações - envia em batch
          socket.emit('operations', {
            documentId: currentDocument.documentId,
            operations,
          });
        }

        setContent(rga.getText());

        setTimeout(() => {
          if (textareaRef.current) {
            handleSelectionChange();
          }
        }, 0);
      }
    },
    [content, socket, currentDocument, handleSelectionChange]
  );

  const handleCopyDocumentId = () => {
    if (currentDocument) {
      navigator.clipboard.writeText(currentDocument.documentId);
    }
  };

  // Renderiza texto rico com tombstones para debug
  const renderRichText = () => {
    if (!rgaRef.current) return null;

    // Usa getStructure e filtra o root
    const nodes = rgaRef.current.getStructure().filter(n => !n.isRoot);

    return (
      <div className="rich-editor-view">
        {nodes.map((node, index) => (
          <span
            key={`${node.id}-${index}`}
            className={node.tombstone ? 'char-tombstone' : 'char-normal'}
            title={`ID: ${node.id} | Origin: ${node.origin}`}
          >
            {node.value}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="editor-container">
      <header className="editor-header">
        <div className="header-left">
          <button onClick={leaveDocument} className="btn-back">
            ← Voltar
          </button>
          <button
            className={`btn-secondary ${showCharts ? 'active' : ''}`}
            style={{ marginLeft: '10px' }}
            onClick={() => setShowCharts(!showCharts)}
          >
            📊 Gráficos
          </button>
          <div className="document-info">
            <h2>{currentDocument?.title || 'Documento'}</h2>
            <span
              className="document-id"
              onClick={handleCopyDocumentId}
              title="Clique para copiar"
            >
              ID: {currentDocument?.documentId?.slice(0, 8)}...
            </span>
          </div>
        </div>

        <div className="header-right">
          <div className="active-users-badge" title="Usuários ativos no documento">
            <span className="users-icon">👥</span>
            <span className="users-count">{collaborators?.length || 0}</span>
          </div>

          <div className={`connection-status ${connected ? 'is-connected' : 'is-disconnected'}`}>
            <span className="status-dot"></span>
            <span className="status-text">{connected ? 'Online' : 'Conectando...'}</span>
          </div>
        </div>
      </header>

      <div className="editor-content">
        <UsersPanel collaborators={collaborators} currentUser={currentUser} />

        <div className="editor-main">
          {showCharts ? (
            <ChartsPanel data={metricsHistory} />
          ) : (
            <>
              {/* Debug Toolbar */}
              <div className="debug-toolbar">
                <div className="debug-toggle">
                  <input
                    type="checkbox"
                    id="debug-mode"
                    checked={showDebug}
                    onChange={() => setShowDebug(!showDebug)}
                  />
                  <label htmlFor="debug-mode">
                    Mostrar Excluídos
                  </label>
                </div>
              </div>

              <div className="editor-wrapper">
                {showDebug ? (
                  // Modo Debug: Renderização rica
                  renderRichText()
                ) : (
                  // Modo Edição: Textarea normal
                  <>
                    <textarea
                      ref={textareaRef}
                      className="editor-textarea"
                      value={content}
                      onChange={handleTextChange}
                      onSelect={handleSelectionChange}
                      onClick={handleSelectionChange}
                      onKeyUp={handleSelectionChange}
                      placeholder="Comece a digitar..."
                      spellCheck="false"
                    />
                    <RemoteCursors
                      cursors={remoteCursors}
                      textareaRef={textareaRef}
                      collaborators={collaborators}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <MetricsPanel metrics={metrics} />
      </div>
    </div>
  );
};

export default Editor;
