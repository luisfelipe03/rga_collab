import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import '../styles/LoginScreen.css';

const LoginScreen = () => {
  const [username, setUsername] = useState('');
  const { login } = useApp();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      login(username.trim());
    }
  };

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-header">
          <h1>RGA Collaborative Editor</h1>
          <p className="login-subtitle">
            Real-time collaborative text editing with CRDT technology
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoFocus
              required
            />
          </div>

          <button type="submit" className="btn-primary">
            Enter
          </button>
        </form>

        <div className="login-footer">
          <p>Delta-CRDT Implementation for Academic Research</p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
