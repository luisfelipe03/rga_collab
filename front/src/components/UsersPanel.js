import React from 'react';
import '../styles/UsersPanel.css';

const UsersPanel = ({ collaborators, currentUser }) => {
  const getColorFromString = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 60%, 50%)`;
  };

  const getInitials = (username) => {
    return username
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Criar lista com todos os usuários, incluindo o atual
  const allUsers = [...collaborators];

  // Adicionar usuário atual se não estiver na lista
  if (currentUser && !allUsers.find((u) => u.userId === currentUser.id)) {
    allUsers.unshift({
      userId: currentUser.id,
      username: currentUser.username,
      active: true,
    });
  }

  return (
    <aside className="users-panel">
      <h3>Active Users</h3>
      <div className="users-list">
        {allUsers.length === 0 ? (
          <div className="no-users">No users in document</div>
        ) : (
          allUsers.map((user) => {
            const isCurrentUser = currentUser && user.userId === currentUser.id;
            return (
              <div key={user.userId} className="user-item">
                <div
                  className="user-avatar"
                  style={{ backgroundColor: getColorFromString(user.userId) }}
                >
                  {getInitials(user.username)}
                </div>
                <div className="user-info">
                  <span className="user-name">
                    {user.username}
                    {isCurrentUser && <span className="you-badge">(you)</span>}
                  </span>
                  <span className="user-status">Online</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default UsersPanel;
