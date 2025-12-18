import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useSocket } from '../context/SocketContext';
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
    editorContent,
    setEditorContent,
    leaveDocument,
    sendOperation,
  } = useApp();
  const { socket } = useSocket();
  const textareaRef = useRef(null);
  const [lastContent, setLastContent] = useState('');
  const [remoteCursors, setRemoteCursors] = useState({});

  useEffect(() => {
    setLastContent(editorContent);
  }, [editorContent]);

  useEffect(() => {
    if (!socket || !currentDocument) return;

    const handleOperation = ({ operation, userId }) => {
      if (operation.type === 'insert') {
        setEditorContent((currentContent) => {
          const newContent =
            currentContent.slice(0, operation.position) +
            operation.value +
            currentContent.slice(operation.position);
          setLastContent(newContent);
          return newContent;
        });

        // Atualizar posições dos cursores remotos após inserção
        setRemoteCursors((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((id) => {
            if (updated[id] && updated[id].position >= operation.position) {
              updated[id] = {
                ...updated[id],
                position: updated[id].position + 1,
              };
            }
          });
          return updated;
        });
      } else if (operation.type === 'delete') {
        setEditorContent((currentContent) => {
          const newContent =
            currentContent.slice(0, operation.position) +
            currentContent.slice(operation.position + 1);
          setLastContent(newContent);
          return newContent;
        });

        // Atualizar posições dos cursores remotos após deleção
        setRemoteCursors((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((id) => {
            if (updated[id] && updated[id].position > operation.position) {
              updated[id] = {
                ...updated[id],
                position: updated[id].position - 1,
              };
            }
          });
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
  }, [socket, currentDocument, setEditorContent]);

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

  const handleTextChange = (e) => {
    const newContent = e.target.value;
    const oldContent = lastContent;

    if (newContent === oldContent) return;

    // Atualizar lastContent IMEDIATAMENTE antes de processar operações
    setLastContent(newContent);
    setEditorContent(newContent);

    if (newContent.length > oldContent.length) {
      const position = findInsertPosition(oldContent, newContent);
      const char = newContent[position];

      if (char !== undefined) {
        sendOperation({
          type: 'insert',
          position,
          value: char,
          replicaId: currentUser.id,
        });

        // Enviar atualização do cursor após inserção
        setTimeout(() => {
          if (textareaRef.current) {
            handleSelectionChange();
          }
        }, 0);
      }
    } else if (newContent.length < oldContent.length) {
      const position = findDeletePosition(oldContent, newContent);

      sendOperation({
        type: 'delete',
        position,
        replicaId: currentUser.id,
      });

      // Enviar atualização do cursor após deleção
      setTimeout(() => {
        if (textareaRef.current) {
          handleSelectionChange();
        }
      }, 0);
    }
  };

  const handleSelectionChange = () => {
    if (!textareaRef.current || !socket || !currentDocument) return;

    const position = textareaRef.current.selectionStart;
    socket.emit('cursor-update', {
      documentId: currentDocument.documentId,
      position,
    });
  };

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
            ← Back
          </button>
          <div className="document-info">
            <h2>{currentDocument?.title || 'Document'}</h2>
            <span
              className="document-id"
              onClick={handleCopyDocumentId}
              title="Click to copy"
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
              value={editorContent}
              onChange={handleTextChange}
              onSelect={handleSelectionChange}
              onClick={handleSelectionChange}
              onKeyUp={handleSelectionChange}
              placeholder="Start typing..."
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
