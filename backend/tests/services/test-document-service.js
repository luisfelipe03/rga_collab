import RGA from '../../src/crdt/RGA.js';

/**
 * Teste do DocumentService (simulado sem MongoDB)
 * 
 * Este teste simula o comportamento do DocumentService com múltiplas
 * operações de inserção e deleção, verificando se as operações RGA
 * funcionam corretamente quando processadas via posição.
 */

function testDocumentServiceOperations() {
    console.log('=== Teste de Operações do DocumentService ===\n');

    // Simula o RGA do servidor (como DocumentService faria)
    const serverRGA = new RGA('server-doc123');

    // Simula operações enviadas por clientes via posição
    const operations = [
        { type: 'insert', position: 0, value: 'H' },
        { type: 'insert', position: 1, value: 'e' },
        { type: 'insert', position: 2, value: 'l' },
        { type: 'insert', position: 3, value: 'l' },
        { type: 'insert', position: 4, value: 'o' },
    ];

    console.log('1. Inserindo "Hello" via posição:');
    const rgaOperations = [];

    operations.forEach((op, i) => {
        if (op.type === 'insert') {
            const rgaOp = serverRGA.insertAtPosition(op.value, op.position);
            rgaOperations.push(rgaOp);
            console.log(`   Passo ${i + 1}: insert "${op.value}" @ pos ${op.position} -> id: ${rgaOp.id}`);
        }
    });

    console.log(`   Resultado: "${serverRGA.getText()}"`);
    console.log();

    // Simula um cliente recebendo as operações
    console.log('2. Cliente recebe operações e aplica no RGA local:');
    const clientRGA = new RGA('client-user1');

    rgaOperations.forEach((op) => {
        clientRGA.applyRemoteOperation(op);
    });

    console.log(`   Cliente vê: "${clientRGA.getText()}"`);

    if (serverRGA.getText() === clientRGA.getText()) {
        console.log('   ✅ Servidor e cliente estão sincronizados!\n');
    } else {
        console.log('   ❌ FALHA: Servidor e cliente divergem!\n');
        process.exit(1);
    }

    // Testa deleção
    console.log('3. Deletando caractere na posição 1 (o "e"):');
    const deleteOp = serverRGA.removeAtPosition(1);
    console.log(`   Operação de delete: id=${deleteOp.id}`);
    console.log(`   Servidor vê: "${serverRGA.getText()}"`);

    // Cliente aplica deleção
    clientRGA.applyRemoteOperation(deleteOp);
    console.log(`   Cliente vê: "${clientRGA.getText()}"`);

    if (serverRGA.getText() === clientRGA.getText()) {
        console.log('   ✅ Deleção sincronizada!\n');
    } else {
        console.log('   ❌ FALHA: Deleção não sincronizou!\n');
        process.exit(1);
    }

    // Testa getDelta (para métricas)
    console.log('4. Testando getDelta() para métricas:');

    // Adiciona mais caracteres
    serverRGA.insertAtPosition('X', 0);
    serverRGA.insertAtPosition('Y', 1);

    const delta = serverRGA.getDelta();
    console.log(`   Delta contém ${delta.nodes.length} nós`);
    console.log(`   Nós: ${delta.nodes.map(n => `"${n.value}"`).join(', ')}`);

    // getDelta deve limpar o buffer
    const delta2 = serverRGA.getDelta();
    console.log(`   Após segunda chamada, delta tem ${delta2.nodes.length} nós (deve ser 0)`);

    if (delta2.nodes.length === 0) {
        console.log('   ✅ Buffer de delta limpo corretamente!\n');
    } else {
        console.log('   ❌ FALHA: Buffer de delta não foi limpo!\n');
        process.exit(1);
    }

    // Testa getState/loadState
    console.log('5. Testando getState() e loadState():');
    const state = serverRGA.getState();
    console.log(`   Estado serializado: ${state.nodes.length} nós, counter=${state.counter}`);

    const restoredRGA = new RGA('restored');
    restoredRGA.loadState(state);
    console.log(`   RGA restaurado vê: "${restoredRGA.getText()}"`);

    if (serverRGA.getText() === restoredRGA.getText()) {
        console.log('   ✅ Estado restaurado corretamente!\n');
    } else {
        console.log('   ❌ FALHA: Estado não restaurou corretamente!\n');
        process.exit(1);
    }

    // Testa métricas
    console.log('6. Testando getMetrics():');
    const metrics = serverRGA.getMetrics();
    console.log(`   Total de nós: ${metrics.totalNodes}`);
    console.log(`   Nós ativos: ${metrics.activeNodes}`);
    console.log(`   Tombstones: ${metrics.tombstoneNodes}`);
    console.log(`   Tamanho do texto: ${metrics.textLength}`);
    console.log(`   Taxa de compressão: ${metrics.compressionRatio}%`);

    if (metrics.tombstoneNodes === 1) { // Deletamos 1 caractere
        console.log('   ✅ Métricas corretas!\n');
    } else {
        console.log('   ❌ FALHA: Métricas incorretas!\n');
        process.exit(1);
    }

    console.log('=== Todos os testes passaram! ===');
    return true;
}

testDocumentServiceOperations();
