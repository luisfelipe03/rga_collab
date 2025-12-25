# Backend - RGA Collaborative Editor

Servidor Node.js com RGA CRDT, Socket.IO e MongoDB.

## 🚀 Instalação

```bash
npm install
```

## ⚡ Execução

```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## 🧪 Testes

```bash
# Teste de convergência do RGA
node tests/crdt/test-convergence.js

# Teste de operações do DocumentService
node tests/services/test-document-service.js
```

## 📁 Estrutura

```
backend/
├── src/
│   ├── crdt/
│   │   └── RGA.js           # Implementação do RGA CRDT
│   ├── services/
│   │   └── DocumentService.js
│   ├── models/
│   │   └── Document.js
│   └── server.js
└── tests/
    └── crdt/
        └── test-convergence.js
```

## 🔧 RGA API

### Operações Locais
- `add(value, parentId)` - Insere caractere
- `remove(id)` - Remove caractere (tombstone)
- `getText()` - Retorna texto atual
- `toArray()` - Retorna array de valores

### Sincronização Entre Réplicas
- `applyRemoteOperation(op)` - Aplica operação remota
- `getState()` - Serializa estado para persistência
- `loadState(state)` - Restaura estado do banco
- `mergeRemoteState(state)` - Merge de estados

## 📊 Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/metrics` | Métricas de todos documentos |
| GET | `/api/metrics/:id` | Métricas de um documento |
