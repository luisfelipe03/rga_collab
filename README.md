# RGA Collaborative Editor - Projeto Acadêmico

Editor de texto colaborativo utilizando **RGA (Replicated Growable Array)** combinado com **Delta-CRDTs** para sincronização eficiente.

## 📚 Objetivo do Projeto

> Integra a eficiência das Delta-CRDTs com a robustez do RGA, validando empiricamente o impacto na latência e uso de banda.

## 🎯 Características Principais

### 1. **RGA CRDT**
- Estrutura de dados replicada para texto colaborativo
- Resolução automática de conflitos
- Operações comutativas e associativas
- Suporte a tombstones para deleções

### 2. **Delta-CRDT**
- Propagação incremental de estados
- Redução significativa do uso de banda
- Sincronização baseada em deltas
- Contexto causal para ordenação

### 3. **Métricas em Tempo Real**
- **Documento:**
  - Contagem de caracteres
  - Número total de nós RGA
  - Nós ativos vs tombstones
  
- **Operações:**
  - Total de operações
  - Inserções vs deleções
  
- **Performance:**
  - Latência média de operações (ms)
  - Tamanho médio de deltas (bytes)
  
- **Rede:**
  - Taxa de recepção (Mbps)
  - Taxa de transmissão (Mbps)

### 4. **Monitoramento**
- **OpenTelemetry:** Medição de latência
- **Systeminformation:** Monitoramento de banda de rede
- **Prometheus:** Exportação de métricas (porta 9464)

## 🛠 Tecnologias

### Backend
- Node.js + Express
- Socket.IO (WebSocket)
- MongoDB + Mongoose
- OpenTelemetry
- Systeminformation
- Prometheus Exporter

### Frontend
- Vanilla JavaScript
- Vite
- Socket.IO Client
- CSS3

## 📊 Arquitetura

```
┌─────────────┐         WebSocket          ┌─────────────┐
│   Cliente   │◄──────────────────────────►│   Servidor  │
│  (Frontend) │                             │  (Backend)  │
└─────────────┘                             └──────┬──────┘
      │                                             │
      │                                             │
      ▼                                             ▼
┌─────────────┐                            ┌──────────────┐
│  Métricas   │                            │  MongoDB     │
│  em Tempo   │                            │  + RGA State │
│  Real       │                            └──────────────┘
└─────────────┘                                    │
                                                   ▼
                                          ┌─────────────────┐
                                          │  Prometheus     │
                                          │  Metrics        │
                                          │  :9464/metrics  │
                                          └─────────────────┘
```

## 🚀 Instalação e Execução

### 1. Instalar dependências

**Backend:**
\`\`\`bash
cd backend
npm install
\`\`\`

**Frontend:**
\`\`\`bash
cd frontend
npm install
\`\`\`

### 2. Configurar ambiente

Criar arquivo \`.env\` no backend:
\`\`\`env
PORT=3000
MONGODB_URI=mongodb+srv://seu_usuario:senha@cluster.mongodb.net/
\`\`\`

### 3. Executar

**Backend (porta 3000):**
\`\`\`bash
cd backend
npm run dev
\`\`\`

**Frontend (porta 5173):**
\`\`\`bash
cd frontend
npm run dev
\`\`\`

**Acessar:**
- Frontend: http://localhost:5173
- Métricas Prometheus: http://localhost:9464/metrics
- API Métricas: http://localhost:3000/api/metrics

## 📈 Endpoints de Métricas

### GET /api/metrics
Retorna métricas de todos os documentos ativos.

### GET /api/metrics/:documentId
Retorna métricas específicas de um documento.

**Exemplo de resposta:**
\`\`\`json
{
  "totalNodes": 45,
  "activeNodes": 42,
  "tombstoneNodes": 3,
  "textLength": 42,
  "compressionRatio": "93.33",
  "operationCount": 45,
  "characterCount": 42,
  "insertOperations": 42,
  "deleteOperations": 3,
  "averageLatency": "2.45",
  "totalDeltaSize": 3420,
  "averageDeltaSize": "76.00",
  "networkStats": {
    "rx_bytes": 152400,
    "tx_bytes": 98600,
    "rx_rate": 1250.5,
    "tx_rate": 850.3,
    "rx_rate_mbps": "0.01",
    "tx_rate_mbps": "0.01"
  }
}
\`\`\`

## 🧪 Metodologia de Validação

### 1. Latência de Operações
- Medição do tempo entre envio e aplicação de operações
- Agregação de latências médias, mínimas e máximas
- Análise de impacto do Delta-CRDT na latência

### 2. Uso de Banda
- Monitoramento de bytes transmitidos/recebidos
- Comparação entre full-state sync vs delta sync
- Medição do tamanho médio de deltas

### 3. Escalabilidade
- Teste com múltiplos usuários simultâneos
- Análise de crescimento de nós RGA
- Impacto de tombstones na performance

## 📝 Resultados Esperados

1. **Redução de Banda:** Delta-CRDTs devem reduzir significativamente o tráfego de rede comparado a full-state sync

2. **Latência Consistente:** Operações devem manter latência baixa mesmo com aumento de colaboradores

3. **Convergência Garantida:** Todos os clientes devem convergir para o mesmo estado final independente da ordem de operações

## 🔬 Métricas Coletadas

- **Tempo de resposta:** ms por operação
- **Throughput:** operações/segundo
- **Banda utilizada:** bytes/segundo
- **Taxa de compressão:** caracteres/nós RGA
- **Overhead de tombstones:** nós deletados/nós totais

## 📚 Referências

1. Shapiro, M., Preguiça, N., Baquero, C., & Zawirski, M. (2011). *Conflict-free replicated data types*
2. Almeida, P. S., Shoker, A., & Baquero, C. (2018). *Delta state replicated data types*
3. Roh, H. G., Jeon, M., Kim, J. S., & Lee, J. (2011). *Replicated abstract data types: Building blocks for collaborative applications*

## 👥 Autores

Projeto acadêmico desenvolvido para estudo de CRDTs em aplicações colaborativas.

## 📄 Licença

MIT License
