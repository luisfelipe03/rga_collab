import React, { useEffect, useState } from 'react';

const RemoteCursors = ({ cursors, textareaRef, collaborators }) => {
  const [cursorPositions, setCursorPositions] = useState({});

  const getColorFromString = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  useEffect(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(computedStyle.lineHeight);
    const fontSize = parseFloat(computedStyle.fontSize);
    const padding = parseFloat(computedStyle.padding);

    const positions = {};

    Object.entries(cursors).forEach(([userId, cursorData]) => {
      if (!cursorData) return;

      const { position, username } = cursorData;

      // Get text before cursor position
      const textBeforeCursor = textarea.value.substring(0, position);
      const lines = textBeforeCursor.split('\n');
      const lineNumber = lines.length - 1;
      const columnNumber = lines[lines.length - 1].length;

      // Calculate approximate position
      const top = padding + lineNumber * lineHeight;
      const left = padding + columnNumber * (fontSize * 0.6); // Approximate character width

      positions[userId] = {
        top,
        left,
        username,
        color: getColorFromString(userId),
      };
    });

    setCursorPositions(positions);
  }, [cursors, textareaRef]);

  return (
    <>
      {Object.entries(cursorPositions).map(([userId, pos]) => (
        <div
          key={userId}
          className="remote-cursor"
          style={{
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            borderLeftColor: pos.color,
          }}
        >
          <div className="cursor-label" style={{ backgroundColor: pos.color }}>
            {pos.username}
          </div>
        </div>
      ))}
    </>
  );
};

export default RemoteCursors;
