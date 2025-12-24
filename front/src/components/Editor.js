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

  // Inicializa o RGA quando o documento é carregado
  useEffect(() => {
    if (!currentDocument || !currentUser) return;

    // Cria uma nova instância do RGA para este cliente
    const rga = new RGA(currentUser.id);

    // Se o servidor enviou o estado do RGA, carrega ele
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

    const handleOperation = ({ operation }) => {
      const rga = rgaRef.current;
      if (!rga) return;

      // Aplica a operação remota no RGA local
      rga.applyRemoteOperation(operation);

      // Atualiza o conteúdo do textarea
      const newContent = rga.getText();
      setContent(newContent);

      // Atualiza posições dos cursores remotos
      if (operation.type === 'insert') {
        // Encontra a posição visual do nó inserido
        const nodes = rga.toArrayWithIds();
        const insertedIndex = nodes.findIndex((n) => n.id === operation.id);

        if (insertedIndex !== -1) {
          setRemoteCursors((prev) => {
            const updated = { ...prev };
            Object.keys(updated).forEach((id) => {
              if (updated[id] && updated[id].position >= insertedIndex) {
                updated[id] = {
                  ...updated[id],
                  position: updated[id].position + 1,
                };
              }
            });
            return updated;
          });
        }
      } else if (operation.type === 'remove') {
        // Para remoção, precisamos ajustar cursores
        setRemoteCursors((prev) => {
          const updated = { ...prev };
          // Simplificação: decrementar cursores após a posição removida
          // Idealmente deveríamos rastrear a posição exata
          return updated;
        });
      }
    };

    const handleCursorMove = ({ userId, username, position }) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [userId]: { username, position, timestamp: Date.now() },
      }));
    };

    socket.on('operation', handleOperation);
    socket.on('cursor-move', handleCursorMove);

    return () => {
      socket.off('operation', handleOperation);
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

      // Detecta inserção
      if (newContent.length > oldContent.length) {
        const position = findInsertPosition(oldContent, newContent);
        const char = newContent[position];

        if (char !== undefined) {
          // Insere no RGA local
          const operation = rga.insertAtPosition(char, position);

          if (operation) {
            // Envia a operação para o servidor
            socket.emit('operation', {
              documentId: currentDocument.documentId,
              operation,
            });
          }

          // Atualiza o estado local
          setContent(rga.getText());

          // Atualiza cursor
          setTimeout(() => {
            if (textareaRef.current) {
              handleSelectionChange();
            }
          }, 0);
        }
      }
      // Detecta deleção
      else if (newContent.length < oldContent.length) {
        const position = findDeletePosition(oldContent, newContent);

        // Remove no RGA local
        const operation = rga.removeAtPosition(position);

        if (operation) {
          // Envia a operação para o servidor
          socket.emit('operation', {
            documentId: currentDocument.documentId,
            operation,
          });
        }

        // Atualiza o estado local
        setContent(rga.getText());

        // Atualiza cursor
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
          <div className="editor-wrapper">
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
          </div>
        </div>

        <MetricsPanel metrics={metrics} />
      </div>
    </div>
  );
};

export default Editor;
