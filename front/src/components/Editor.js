import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useSocket } from '../context/SocketContext';
import RGA from '../crdt/RGA.js';
import UsersPanel from './UsersPanel';
import MetricsPanel from './MetricsPanel';
import RemoteCursors from './RemoteCursors';
import '../styles/Editor.css';

const Editor = () => {
  const {
    currentUser,
    currentDocument,
    collaborators,
    metrics,
    leaveDocument,
  } = useApp();
  const { socket } = useSocket();
  const textareaRef = useRef(null);
  const rgaRef = useRef(null);
  const [content, setContent] = useState('');
  const [remoteCursors, setRemoteCursors] = useState({});
  const [showDebug, setShowDebug] = useState(false); // Estado para toggle de debug

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

      rga.applyRemoteOperation(operation);
      setContent(rga.getText());
    };

    // Handler para batch de operações
    const handleOperations = ({ operations }) => {
      const rga = rgaRef.current;
      if (!rga || !Array.isArray(operations)) return;

      rga.applyRemoteOperations(operations);  // Usa o novo método
      setContent(rga.getText());
    };

    const handleCursorMove = ({ userId, username, position }) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [userId]: { username, position, timestamp: Date.now() },
      }));
    };

    socket.on('operation', handleOperation);
    socket.on('operations', handleOperations);  // Novo: batch
    socket.on('cursor-move', handleCursorMove);

    return () => {
      socket.off('operation', handleOperation);
      socket.off('operations', handleOperations);  // Novo: batch
      socket.off('cursor-move', handleCursorMove);
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

  const handleTextChange = useCallback(
    (e) => {
      const rga = rgaRef.current;
      if (!rga || !socket || !currentDocument) return;

      const newContent = e.target.value;
      const oldContent = content;

      if (newContent === oldContent) return;

      const operations = [];  // Coleta operações para batch

      // Detecta inserção (pode ser múltiplos caracteres - paste)
      if (newContent.length > oldContent.length) {
        const position = findInsertPosition(oldContent, newContent);
        const insertedCount = newContent.length - oldContent.length;

        // Insere cada caractere individualmente
        for (let i = 0; i < insertedCount; i++) {
          const char = newContent[position + i];
          if (char !== undefined) {
            const operation = rga.insertAtPosition(char, position + i);
            if (operation) {
              operations.push(operation);
            }
          }
        }
      }
      // Detecta deleção (pode ser múltiplos caracteres - seleção + delete)
      else if (newContent.length < oldContent.length) {
        const position = findDeletePosition(oldContent, newContent);
        const deletedCount = oldContent.length - newContent.length;

        // Remove cada caractere individualmente
        for (let i = 0; i < deletedCount; i++) {
          const operation = rga.removeAtPosition(position);
          if (operation) {
            operations.push(operation);
          }
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
    [content, socket, currentDocument]
  );

  const handleSelectionChange = useCallback(() => {
    if (!textareaRef.current || !socket || !currentDocument) return;

    const position = textareaRef.current.selectionStart;
    socket.emit('cursor-update', {
      documentId: currentDocument.documentId,
      position,
    });
  }, [socket, currentDocument]);

  const findInsertPosition = (oldStr, newStr) => {
    for (let i = 0; i < newStr.length; i++) {
      if (i >= oldStr.length || oldStr[i] !== newStr[i]) {
        return i;
      }
    }
    return newStr.length - 1;
  };

  const findDeletePosition = (oldStr, newStr) => {
    for (let i = 0; i < oldStr.length; i++) {
      if (i >= newStr.length || oldStr[i] !== newStr[i]) {
        return i;
      }
    }
    return oldStr.length - 1;
  };

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
      </header>

      <div className="editor-content">
        <UsersPanel collaborators={collaborators} currentUser={currentUser} />

        <div className="editor-main">
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


        </div>

        <MetricsPanel metrics={metrics} />
      </div>
    </div>
  );
};

export default Editor;
