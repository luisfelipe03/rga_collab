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

    const handleOperation = ({ operation }) => {
      if (!textareaRef.current) return;

      const textarea = textareaRef.current;
      const currentContent = textarea.value;

      if (operation.type === 'insert') {
        const newContent =
          currentContent.slice(0, operation.position) +
          operation.value +
          currentContent.slice(operation.position);

        setEditorContent(newContent);
        setLastContent(newContent);
      } else if (operation.type === 'delete') {
        const newContent =
          currentContent.slice(0, operation.position) +
          currentContent.slice(operation.position + 1);

        setEditorContent(newContent);
        setLastContent(newContent);
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
      }
    } else if (newContent.length < oldContent.length) {
      const position = findDeletePosition(oldContent, newContent);

      sendOperation({
        type: 'delete',
        position,
        replicaId: currentUser.id,
      });
    }

    setLastContent(newContent);
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
