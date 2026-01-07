import React from 'react';
import '../styles/CollaboratorsList.css';

const CollaboratorsList = ({ collaborators, currentUser }) => {
  const getInitials = (username) => {
    return username
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getColorFromString = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 60%, 50%)`;
  };

  return (
    <div className="collaborators-list">
      <span className="collaborators-label">Active Users:</span>
      <div className="collaborators-avatars">
        {collaborators.map((collab) => (
          <div
            key={collab.userId}
            className="collaborator-avatar"
            style={{ backgroundColor: getColorFromString(collab.userId) }}
            title={collab.username}
          >
            {getInitials(collab.username)}
          </div>
        ))}
        {collaborators.length === 0 && (
          <span className="no-collaborators">Only you</span>
        )}
      </div>
    </div>
  );
};

export default CollaboratorsList;
