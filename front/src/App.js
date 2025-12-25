import React from 'react';
import { SocketProvider } from './context/SocketContext';
import { AppProvider, useApp } from './context/AppContext';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';
import './App.css';

const AppContent = () => {
  const { currentUser, currentDocument } = useApp();

  if (!currentUser) {
    return <LoginScreen />;
  }

  if (currentDocument) {
    return <Editor />;
  }

  return <Dashboard />;
};

function App() {
  return (
    <SocketProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </SocketProvider>
  );
}

export default App;
