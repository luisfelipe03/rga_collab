import { io } from 'socket.io-client';

// WebSocket connection
const socket = io('http://localhost:3000');

// State
let currentUser = null;
let currentDocument = null;
let isTyping = false;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const editorScreen = document.getElementById('editor-screen');

const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');

const currentUsernameEl = document.getElementById('current-username');
const logoutBtn = document.getElementById('logout-btn');
const createDocBtn = document.getElementById('create-doc-btn');
const refreshDocsBtn = document.getElementById('refresh-docs-btn');
const documentsList = document.getElementById('documents-list');

const backBtn = document.getElementById('back-btn');
const documentTitle = document.getElementById('document-title');
const collaboratorsList = document.getElementById('collaborators-list');
const editor = document.getElementById('editor');
const documentIdEl = document.getElementById('document-id');
const connectionStatus = document.getElementById('connection-status');

const createModal = document.getElementById('create-modal');
const docTitleInput = document.getElementById('doc-title-input');
const cancelCreateBtn = document.getElementById('cancel-create-btn');
const confirmCreateBtn = document.getElementById('confirm-create-btn');

// Socket event handlers
socket.on('connect', () => {
  connectionStatus.textContent = '🟢 Conectado';
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  connectionStatus.textContent = '🔴 Desconectado';
  console.log('Disconnected from server');
});

socket.on('registered', (user) => {
  currentUser = user;
  currentUsernameEl.textContent = user.username;
  showDashboard();
  loadDocuments();
});

socket.on('document-created', (doc) => {
  createModal.classList.add('hidden');
  docTitleInput.value = '';
  loadDocuments();
  // Auto-join the new document
  joinDocument(doc.documentId);
});

socket.on('documents-list', (documents) => {
  renderDocuments(documents);
});

socket.on('document-loaded', (doc) => {
  currentDocument = doc;
  documentTitle.textContent = doc.title || 'Documento';
  documentIdEl.textContent = `ID: ${doc.documentId}`;
  editor.value = doc.content || '';
  lastContent = editor.value; // Sync lastContent with loaded content
  console.log(
    `Document loaded with content length: ${doc.content?.length || 0}`
  );
  showEditor();
});

socket.on('operation', ({ operation, userId, username }) => {
  if (!currentDocument) return;

  // Apply remote operation to local editor
  applyRemoteOperation(operation);

  // Update collaborators
  updateCollaboratorIndicator(username);
});

socket.on('user-joined', ({ userId, username }) => {
  addCollaborator(username);
  console.log(`${username} joined the document`);
});

socket.on('user-left', ({ userId, username }) => {
  removeCollaborator(username);
  console.log(`${username} left the document`);
});

socket.on('error', ({ message }) => {
  alert(`Erro: ${message}`);
});

socket.on('metrics-update', (metrics) => {
  updateMetricsDisplay(metrics);
});

// UI Functions
function showLogin() {
  loginScreen.classList.remove('hidden');
  dashboardScreen.classList.add('hidden');
  editorScreen.classList.add('hidden');
}

function showDashboard() {
  loginScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');
  editorScreen.classList.add('hidden');
}

function showEditor() {
  loginScreen.classList.add('hidden');
  dashboardScreen.classList.add('hidden');
  editorScreen.classList.remove('hidden');
  editor.focus();
}

function renderDocuments(documents) {
  if (documents.length === 0) {
    documentsList.innerHTML = `
      <div class="empty-state">
        <h3>Nenhum documento ainda</h3>
        <p>Crie seu primeiro documento para começar!</p>
      </div>
    `;
    return;
  }

  documentsList.innerHTML = documents
    .map(
      (doc) => `
    <div class="document-card" data-id="${doc.documentId}">
      <h3>${doc.title || 'Untitled Document'}</h3>
      <div class="meta">
        <div>${new Date(doc.createdAt).toLocaleDateString('pt-BR')}</div>
        <div>${doc.collaborators?.length || 0} colaborador(es)</div>
      </div>
    </div>
  `
    )
    .join('');

  // Add click handlers
  document.querySelectorAll('.document-card').forEach((card) => {
    card.addEventListener('click', () => {
      const docId = card.dataset.id;
      joinDocument(docId);
    });
  });
}

function loadDocuments() {
  socket.emit('list-documents');
}

function joinDocument(documentId) {
  if (!currentUser) return;

  socket.emit('join-document', {
    documentId,
    userId: currentUser.id,
    username: currentUser.username,
  });
}

function addCollaborator(username) {
  if (!collaboratorsList.querySelector(`[data-username="${username}"]`)) {
    const badge = document.createElement('div');
    badge.className = 'collaborator-badge';
    badge.dataset.username = username;
    badge.textContent = username;
    collaboratorsList.appendChild(badge);
  }
}

function removeCollaborator(username) {
  const badge = collaboratorsList.querySelector(
    `[data-username="${username}"]`
  );
  if (badge) {
    badge.remove();
  }
}

function updateCollaboratorIndicator(username) {
  const badge = collaboratorsList.querySelector(
    `[data-username="${username}"]`
  );
  if (badge) {
    badge.style.background = 'rgba(255, 255, 255, 0.4)';
    setTimeout(() => {
      badge.style.background = 'rgba(255, 255, 255, 0.2)';
    }, 300);
  }
}

// Editor Operations
let lastContent = '';
let lastCursorPosition = 0;

editor.addEventListener('input', (e) => {
  if (isTyping) return;

  const currentContent = editor.value;
  const cursorPosition = editor.selectionStart;

  // Detect what changed
  if (currentContent.length > lastContent.length) {
    // Insertion
    const insertedChar = currentContent[cursorPosition - 1];
    const position = cursorPosition - 1;

    const operation = {
      type: 'insert',
      value: insertedChar,
      position: position,
      timestamp: Date.now(),
      replicaId: currentUser.id,
    };

    socket.emit('operation', {
      documentId: currentDocument.documentId,
      operation,
    });
  } else if (currentContent.length < lastContent.length) {
    // Deletion
    const position = cursorPosition;

    const operation = {
      type: 'delete',
      position: position,
      timestamp: Date.now(),
      replicaId: currentUser.id,
    };

    socket.emit('operation', {
      documentId: currentDocument.documentId,
      operation,
    });
  }

  lastContent = currentContent;
  lastCursorPosition = cursorPosition;
});

function applyRemoteOperation(operation) {
  isTyping = true;
  const currentCursor = editor.selectionStart;
  let newCursor = currentCursor;

  if (operation.type === 'insert') {
    const before = editor.value.slice(0, operation.position);
    const after = editor.value.slice(operation.position);
    editor.value = before + operation.value + after;

    if (operation.position < currentCursor) {
      newCursor++;
    }
  } else if (operation.type === 'delete') {
    const before = editor.value.slice(0, operation.position);
    const after = editor.value.slice(operation.position + 1);
    editor.value = before + after;

    if (operation.position < currentCursor) {
      newCursor--;
    }
  }

  editor.setSelectionRange(newCursor, newCursor);
  lastContent = editor.value;

  setTimeout(() => {
    isTyping = false;
  }, 50);
}

// Event Listeners
loginBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  if (username) {
    socket.emit('register', username);
  }
});

usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    loginBtn.click();
  }
});

logoutBtn.addEventListener('click', () => {
  if (currentDocument) {
    socket.emit('leave-document', { documentId: currentDocument.documentId });
  }
  currentUser = null;
  currentDocument = null;
  showLogin();
});

createDocBtn.addEventListener('click', () => {
  createModal.classList.remove('hidden');
  docTitleInput.focus();
});

cancelCreateBtn.addEventListener('click', () => {
  createModal.classList.add('hidden');
  docTitleInput.value = '';
});

confirmCreateBtn.addEventListener('click', () => {
  const title = docTitleInput.value.trim() || 'Untitled Document';
  socket.emit('create-document', {
    userId: currentUser.id,
    username: currentUser.username,
    title,
  });
});

docTitleInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    confirmCreateBtn.click();
  }
});

refreshDocsBtn.addEventListener('click', () => {
  loadDocuments();
});

backBtn.addEventListener('click', () => {
  if (currentDocument) {
    socket.emit('leave-document', { documentId: currentDocument.documentId });
    currentDocument = null;
    collaboratorsList.innerHTML = '';
  }
  showDashboard();
  loadDocuments();
});

// Metrics display function
function updateMetricsDisplay(metrics) {
  if (!metrics) return;

  document.getElementById('metric-chars').textContent =
    metrics.textLength || metrics.characterCount || 0;
  document.getElementById('metric-nodes').textContent = metrics.totalNodes || 0;
  document.getElementById('metric-active-nodes').textContent =
    metrics.activeNodes || 0;
  document.getElementById('metric-tombstones').textContent =
    metrics.tombstoneNodes || 0;

  document.getElementById('metric-operations').textContent =
    metrics.operationCount || 0;
  document.getElementById('metric-inserts').textContent =
    metrics.insertOperations || 0;
  document.getElementById('metric-deletes').textContent =
    metrics.deleteOperations || 0;

  document.getElementById('metric-latency').textContent = `${
    metrics.averageLatency || 0
  } ms`;
  document.getElementById('metric-delta').textContent = `${
    metrics.averageDeltaSize || 0
  } B`;

  if (metrics.networkStats) {
    document.getElementById('metric-rx').textContent =
      metrics.networkStats.rx_rate_mbps || '0.00';
    document.getElementById('metric-tx').textContent =
      metrics.networkStats.tx_rate_mbps || '0.00';
  }
}

// Initialize
lastContent = editor.value;
