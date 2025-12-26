import { io } from "socket.io-client";

// CONFIGURAÇÕES DO TESTE
const SERVER_URL = "http://localhost:3000";
const NUM_CLIENTS = 80;          // Quantos usuários simultâneos
const DURATION_MS = 60000;       // Duração do teste
const CHURN_RATE = 0.9;          // 20% de chance de desconectar/reconectar a cada ciclo
const OPERATION_INTERVAL = 500;  // ms entre operações de escrita

const clients = [];
let documentId = "";
let metricsLog = [];

console.log(`=== INICIANDO TESTE DE CARGA RGA ===`);
console.log(`Usuários: ${NUM_CLIENTS}, Churn: ${CHURN_RATE * 100}%`);

// 1. Criar um cliente "Mestre" para criar o documento
const masterClient = io(SERVER_URL);

masterClient.on("connect", () => {
    console.log("Mestre conectado. Criando documento...");
    masterClient.emit("register", "MasterUser");
});

masterClient.on("registered", (user) => {
    masterClient.emit("create-document", {
        userId: user.id,
        username: "MasterUser",
        title: "Load Test Document"
    });
});

masterClient.on("document-created", (doc) => {
    documentId = doc.documentId;
    console.log(`Documento criado: ${documentId}`);
    startLoadTest();
});

async function startLoadTest() {
    // 2. Inicializar Bots
    for (let i = 0; i < NUM_CLIENTS; i++) {
        createBot(i);
        // Pequeno delay para não conectar todos milimetricamente juntos
        await new Promise(r => setTimeout(r, 50));
    }

    // 3. Parar teste após DURATION_MS
    setTimeout(async () => {
        console.log("\n=== FIM DO TESTE ===");
        await analyzeMetrics();
        process.exit(0);
    }, DURATION_MS);
}

function createBot(index) {
    const socket = io(SERVER_URL);
    let myUser = null;
    let isConnected = false;

    socket.on("connect", () => {
        socket.emit("register", `Bot-${index}`);
    });

    socket.on("registered", (user) => {
        myUser = user;
        socket.emit("join-document", {
            documentId,
            userId: user.id,
            username: user.username
        });
    });

    socket.on("document-loaded", () => {
        isConnected = true;
        // Inicia loop de operações
        performActions(socket, index);
    });

    clients.push({ socket, index });
}

function performActions(socket, index) {
    const interval = setInterval(() => {
        if (!socket.connected) {
            clearInterval(interval);
            return;
        }

        // --- SIMULAÇÃO DE CHURN (Entrada e Saída) ---
        if (Math.random() < CHURN_RATE / 10) { // Probabilidade pequena a cada tick
            console.log(`[Churn] Bot-${index} saindo...`);
            socket.disconnect();

            // Reconecta após alguns segundos
            setTimeout(() => {
                console.log(`[Churn] Bot-${index} voltando...`);
                socket.connect();
            }, 2000);
            return;
        }

        // --- SIMULAÇÃO DE EDIÇÃO ---
        // 80% chance de inserir, 20% de deletar (simula crescimento do doc)
        const opType = Math.random() > 0.2 ? 'insert' : 'delete';

        // Enviamos operação "burra" (insert no fim ou delete na pos 0)
        // O servidor calculará a latência real do processamento RGA
        if (opType === 'insert') {
            socket.emit('operation', {
                documentId,
                operation: {
                    type: 'insert',
                    position: 0, // Insere sempre no começo para estressar o RGA
                    value: String.fromCharCode(65 + (Math.random() * 26)) // Letra aleatória
                }
            });
        } else {
            socket.emit('operation', {
                documentId,
                operation: {
                    type: 'delete',
                    position: 0
                }
            });
        }

    }, OPERATION_INTERVAL + (Math.random() * 500)); // Intervalo variável
}

// Escuta métricas globais do servidor (você precisa garantir que o servidor emita isso ou fazer fetch na API)
// Como seu server tem um endpoint GET /api/metrics/:id, vamos usar fetch no final
async function analyzeMetrics() {
    try {
        const response = await fetch(`${SERVER_URL}/api/metrics/${documentId}`);
        const metrics = await response.json();

        console.log("\nRELATÓRIO DE DESEMPENHO:");
        console.table({
            "Total de Nós (Memória)": metrics.totalNodes,
            "Nós Ativos (Texto Visual)": metrics.activeNodes,
            "Tombstones (Lixo/Overhead)": metrics.tombstoneNodes,
            "Latência Média (ms)": metrics.averageLatency,
            "Tamanho Médio Delta (bytes)": metrics.averageDeltaSize,
            "Operações Totais": metrics.operationCount,
            "Uso de Banda TX (Mbps)": metrics.networkStats?.tx_rate_mbps || "N/A"
        });

        console.log("\nANÁLISE:");
        console.log(`> Eficiência de Armazenamento: ${(metrics.activeNodes / metrics.totalNodes * 100).toFixed(2)}% (quanto menor, mais lixo/tombstones)`);
        console.log(`> Otimização Delta: Cada operação custou em média apenas ${metrics.averageDeltaSize} bytes.`);

    } catch (e) {
        console.error("Erro ao buscar métricas finais:", e);
    }
}