import React, { useEffect, useState, useRef } from 'react';

const RemoteCursors = ({ cursors, textareaRef, collaborators }) => {
  const [cursorPositions, setCursorPositions] = useState({});
  const mirrorRef = useRef(null);

  const getColorFromString = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  useEffect(() => {
    const updatePositions = () => {
      if (!textareaRef.current) return;

      const textarea = textareaRef.current;
      const {
        paddingTop,
        paddingLeft,
        paddingRight,
        paddingBottom,
        fontSize,
        lineHeight,
        fontFamily,
        fontWeight,
        width,
        height,
      } = window.getComputedStyle(textarea);

      // Cria ou atualiza o mirror div para cálculo preciso
      let mirror = mirrorRef.current;
      if (!mirror) {
        mirror = document.createElement('div');
        mirror.style.position = 'absolute';
        mirror.style.visibility = 'hidden';
        mirror.style.whiteSpace = 'pre-wrap';
        mirror.style.wordWrap = 'break-word';
        mirror.style.overflow = 'hidden';
        mirrorRef.current = mirror;
        document.body.appendChild(mirror);
      }

      // Sincroniza estilos do textarea com o mirror
      mirror.style.fontSize = fontSize;
      mirror.style.fontFamily = fontFamily;
      mirror.style.lineHeight = lineHeight;
      mirror.style.fontWeight = fontWeight;
      mirror.style.paddingTop = paddingTop;
      mirror.style.paddingLeft = paddingLeft;
      mirror.style.paddingRight = paddingRight;
      mirror.style.paddingBottom = paddingBottom;
      mirror.style.width = width;
      mirror.style.height = height;

      const positions = {};

      Object.entries(cursors).forEach(([userId, cursorData]) => {
        if (!cursorData) return;

        const { position, username } = cursorData;
        const text = textarea.value;

        // Se a posição for maior que o texto atual, limita ao final
        const safePosition = Math.min(position, text.length);

        // Preenche o mirror com o texto até a posição do cursor
        const textBefore = text.substring(0, safePosition);
        const textAfter = text.substring(safePosition);

        mirror.textContent = textBefore;
        const span = document.createElement('span');
        span.textContent = textAfter.substring(0, 1) || '\u00a0'; // Caractere invisível se no fim
        mirror.appendChild(span);

        // Calcula coordenadas relativas ao textarea
        const rect = span.getBoundingClientRect();
        const mirrorRect = mirror.getBoundingClientRect();

        const top = rect.top - mirrorRect.top - textarea.scrollTop;
        const left = rect.left - mirrorRect.left - textarea.scrollLeft;

        // Verifica se o cursor está visível na área do textarea
        const isVisible = 
          top >= 0 && 
          top <= parseFloat(height) && 
          left >= 0 && 
          left <= parseFloat(width);

        if (isVisible) {
          positions[userId] = {
            top,
            left,
            username,
            color: getColorFromString(userId),
          };
        }
      });

      setCursorPositions(positions);
    };

    // Atualiza em mudanças de cursores, redimensionamento ou scroll
    updatePositions();
    
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('scroll', updatePositions);
      window.addEventListener('resize', updatePositions);
    }

    return () => {
      if (textarea) {
        textarea.removeEventListener('scroll', updatePositions);
      }
      window.removeEventListener('resize', updatePositions);
      if (mirrorRef.current) {
        document.body.removeChild(mirrorRef.current);
        mirrorRef.current = null;
      }
    };
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
