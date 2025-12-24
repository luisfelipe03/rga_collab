/**
 * RGA (Replicated Growable Array) CRDT Implementation
 * Versão simplificada e correta para edição colaborativa de texto
 */
class RGA {
    constructor(replicaId) {
        this.id = replicaId;
        this.counter = 0;

        // Armazena TODOS os nós (id -> Node)
        // Node: { id, value, next, origin, tombstone }
        this.nodes = new Map();

        // Nó raiz invisível (começo da lista)
        this.nodes.set('root', {
            id: 'root',
            next: null,
            origin: null,
            tombstone: true,
        });

        // Buffer para rastrear nós adicionados desde último getDelta (para métricas)
        this.deltaBuffer = [];
    }

    // Gera ID único: "contador@replica" (Ex: "1@alice")
    _genId() {
        this.counter++;
        return `${this.counter}@${this.id}`;
    }

    // Analisa IDs para desempate (Timestamp maior ganha, depois ID da réplica)
    _isHigherPriority(idA, idB) {
        const [timeA, userA] = idA.split('@');
        const [timeB, userB] = idB.split('@');
        if (parseInt(timeA) !== parseInt(timeB))
            return parseInt(timeA) > parseInt(timeB);
        return userA > userB;
    }

    // --- Operação 1: Inserção (Local e Remota) ---
    add(value, parentId = 'root', forcedId = null) {
        const newId = forcedId || this._genId();

        // Idempotência: se já existe, ignora
        if (this.nodes.has(newId)) return;

        // 1. Cria o nó (mas não liga ainda)
        const newNode = {
            id: newId,
            value: value,
            origin: parentId, // Quem era o pai original na hora que foi criado
            next: null,
            tombstone: false,
        };
        this.nodes.set(newId, newNode);

        // 2. Acha onde ligar (O algoritmo RGA real)
        let currentId = parentId;
        let childId = this.nodes.get(currentId).next;

        // Percorre os "irmãos" que estão na frente
        while (childId) {
            const child = this.nodes.get(childId);

            // Se o vizinho também é filho do mesmo pai (concorrente)...
            if (child.origin === parentId) {
                // ...e ele tem prioridade maior (foi criado depois ou tem ID maior)
                if (this._isHigherPriority(child.id, newId)) {
                    // PULA ele. Nosso lugar é depois dele.
                    currentId = childId;
                    childId = child.next;
                    continue;
                }
            }
            // Se não for concorrente ou tiver prioridade menor, PARE. Achamos o lugar.
            break;
        }

        // 3. Liga os ponteiros (Sem rebuild!)
        const prevNode = this.nodes.get(currentId);
        newNode.next = prevNode.next;
        prevNode.next = newId;

        // Se for remoto, atualiza relógio para não gerar IDs repetidos no futuro
        if (forcedId) {
            const [time] = forcedId.split('@');
            this.counter = Math.max(this.counter, parseInt(time));
        }

        // Registra no buffer de delta para métricas
        this.deltaBuffer.push({
            id: newNode.id,
            value: newNode.value,
            origin: newNode.origin,
        });

        return newNode; // Retorna para você enviar via rede
    }

    // --- Operação 2: Remoção (Apenas marcação) ---
    remove(id) {
        const node = this.nodes.get(id);
        if (node) node.tombstone = true;
        return { type: 'remove', id };
    }

    // --- Leitura: Transforma em Array ---
    toArray() {
        const result = [];
        let curr = this.nodes.get('root').next;
        while (curr) {
            const node = this.nodes.get(curr);
            if (!node.tombstone) {
                result.push(node.value);
            }
            curr = node.next;
        }
        return result;
    }

    // --- Leitura: Transforma em String ---
    getText() {
        return this.toArray().join('');
    }

    // --- Helper: Retorna array de nós visíveis (para UI que precisa do ID) ---
    toArrayWithIds() {
        const result = [];
        let curr = this.nodes.get('root').next;
        while (curr) {
            const node = this.nodes.get(curr);
            if (!node.tombstone) {
                result.push({ id: node.id, value: node.value });
            }
            curr = node.next;
        }
        return result;
    }

    // --- Helper: Encontra o ID do nó na posição especificada (0-indexed) ---
    getNodeIdAtPosition(position) {
        let currentPos = 0;
        let curr = this.nodes.get('root').next;

        while (curr) {
            const node = this.nodes.get(curr);
            if (!node.tombstone) {
                if (currentPos === position) {
                    return node.id;
                }
                currentPos++;
            }
            curr = node.next;
        }

        return null;
    }

    // --- Helper: Encontra o ID do nó ANTES da posição (para inserção) ---
    getNodeIdBeforePosition(position) {
        if (position === 0) {
            return 'root';
        }

        let currentPos = 0;
        let curr = this.nodes.get('root').next;
        let lastVisibleId = 'root';

        while (curr) {
            const node = this.nodes.get(curr);
            if (!node.tombstone) {
                if (currentPos === position - 1) {
                    return node.id;
                }
                lastVisibleId = node.id;
                currentPos++;
            }
            curr = node.next;
        }

        // Se a posição é no final, retorna o último nó visível
        return lastVisibleId;
    }

    // --- Inserção por posição (para integração com UI) ---
    insertAtPosition(value, position) {
        const parentId = this.getNodeIdBeforePosition(position);
        const node = this.add(value, parentId);

        if (node) {
            return {
                type: 'insert',
                id: node.id,
                value: node.value,
                origin: node.origin,
            };
        }
        return null;
    }

    // --- Remoção por posição (para integração com UI) ---
    removeAtPosition(position) {
        const nodeId = this.getNodeIdAtPosition(position);

        if (nodeId) {
            return this.remove(nodeId);
        }
        return null;
    }

    // ===========================================================================
    // MÉTODOS DE SINCRONIZAÇÃO ENTRE RÉPLICAS
    // ===========================================================================

    // --- Aplicar operação remota ---
    applyRemoteOperation(operation) {
        if (operation.type === 'insert') {
            // A função add já é idempotente e usa o algoritmo RGA correto
            this.add(operation.value, operation.origin, operation.id);
        } else if (operation.type === 'remove') {
            this.remove(operation.id);
        }
    }

    // --- Estado para sincronização ---
    getState() {
        return {
            replicaId: this.id,
            counter: this.counter,
            nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
                id: node.id,
                value: node.value,
                origin: node.origin,
                next: node.next,
                tombstone: node.tombstone,
            })),
        };
    }

    // --- Carregar estado de outro replica/banco de dados ---
    loadState(state) {
        this.nodes.clear();

        // Restaura todos os nós
        if (state.nodes && Array.isArray(state.nodes)) {
            state.nodes.forEach((node) => {
                this.nodes.set(node.id, { ...node });
            });
        }

        // Atualiza o contador para evitar conflitos de ID
        this.counter = state.counter || 0;
    }

    // --- Merge de estado de outra réplica (para sincronização) ---
    mergeRemoteState(state) {
        if (!state.nodes) return;

        // Para cada nó do estado remoto
        state.nodes.forEach((remoteNode) => {
            // Ignora o nó root, ele já existe
            if (remoteNode.id === 'root') return;

            // Se não temos esse nó, aplicamos como operação de insert
            if (!this.nodes.has(remoteNode.id)) {
                this.add(remoteNode.value, remoteNode.origin, remoteNode.id);
            }

            // Se o nó remoto está como tombstone, marcamos o local também
            if (remoteNode.tombstone) {
                const localNode = this.nodes.get(remoteNode.id);
                if (localNode) {
                    localNode.tombstone = true;
                }
            }
        });

        // Atualiza o contador para o maior valor
        this.counter = Math.max(this.counter, state.counter || 0);
    }

    // ===========================================================================
    // MÉTODOS DE MÉTRICAS E DELTA
    // ===========================================================================

    // --- Delta: Retorna nós adicionados desde última chamada (para métricas) ---
    getDelta() {
        const delta = {
            replicaId: this.id,
            nodes: [...this.deltaBuffer],
            counter: this.counter,
        };
        // Limpa o buffer após retornar
        this.deltaBuffer = [];
        return delta;
    }

    // --- Métricas para debug ---
    getMetrics() {
        const totalNodes = this.nodes.size - 1; // -1 para não contar o root
        const activeNodes = Array.from(this.nodes.values()).filter(
            (n) => !n.tombstone && n.id !== 'root'
        ).length;
        const tombstoneNodes = totalNodes - activeNodes;
        const textLength = this.getText().length;

        return {
            totalNodes,
            activeNodes,
            tombstoneNodes,
            textLength,
            compressionRatio:
                totalNodes > 0 ? ((textLength / totalNodes) * 100).toFixed(2) : 0,
        };
    }
}

export default RGA;
