import RGA from '../../src/crdt/RGA.js';

/**
 * Teste de Convergência do RGA CRDT
 * 
 * Este teste simula o cenário exato descrito na análise:
 * - Replica A insere "X" após "Inicio"
 * - Replica B insere "Y" após "Inicio" (concorrentemente)
 * - As operações chegam em diferentes ordens
 * 
 * O teste verifica que ambas as réplicas convergem para o MESMO texto final.
 */

function testConvergence() {
    console.log('=== Teste de Convergência RGA ===\n');

    // Cria duas réplicas com o MESMO estado inicial
    // Ambas têm o texto "Inicio" com a mesma estrutura

    // Primeiro, cria a réplica A e gera as operações para "Inicio"
    const replicaA = new RGA('A');
    const operations = [];
    let lastNodeId = 'root';

    for (const char of 'Inicio') {
        const node = replicaA.add(char, lastNodeId);
        operations.push({
            type: 'insert',
            id: node.id,
            value: node.value,
            origin: node.origin
        });
        lastNodeId = node.id;
    }

    // Aplica as mesmas operações na réplica B
    const replicaB = new RGA('B');
    for (const op of operations) {
        replicaB.applyRemoteOperation(op);
    }

    // O lastNodeId é o ID do último caractere 'o' em "Inicio"
    const afterId = lastNodeId;

    console.log('Estado inicial:');
    console.log(`  Replica A: "${replicaA.getText()}" (counter: ${replicaA.counter})`);
    console.log(`  Replica B: "${replicaB.getText()}" (counter: ${replicaB.counter})`);
    console.log(`  Último nó: ${afterId}`);
    console.log();

    // Agora simula edição CONCORRENTE (inserindo após o MESMO nó)
    const nodeA = replicaA.add('X', afterId);
    const opA = { type: 'insert', id: nodeA.id, value: nodeA.value, origin: nodeA.origin };
    console.log(`Replica A insere "X" após "o" - id: ${opA.id}`);

    const nodeB = replicaB.add('Y', afterId);
    const opB = { type: 'insert', id: nodeB.id, value: nodeB.value, origin: nodeB.origin };
    console.log(`Replica B insere "Y" após "o" - id: ${opB.id}`);
    console.log();

    // CENÁRIO 1: A aplica sua operação local, depois recebe B
    console.log('--- Cenário 1: A aplica localmente, depois recebe B ---');
    console.log(`  A antes de receber B: "${replicaA.getText()}"`);
    replicaA.applyRemoteOperation(opB);
    console.log(`  A depois de receber B: "${replicaA.getText()}"`);

    // CENÁRIO 2: B aplica sua operação local, depois recebe A
    console.log('\n--- Cenário 2: B aplica localmente, depois recebe A ---');
    console.log(`  B antes de receber A: "${replicaB.getText()}"`);
    replicaB.applyRemoteOperation(opA);
    console.log(`  B depois de receber A: "${replicaB.getText()}"`);

    console.log();

    // Verifica convergência
    const resultA = replicaA.getText();
    const resultB = replicaB.getText();

    if (resultA === resultB) {
        console.log('✅ SUCESSO: Ambas as réplicas convergiram para o mesmo texto!');
        console.log(`   Texto final: "${resultA}"`);
    } else {
        console.log('❌ FALHA: As réplicas NÃO convergiram!');
        console.log(`   Replica A vê: "${resultA}"`);
        console.log(`   Replica B vê: "${resultB}"`);
        process.exit(1);
    }

    console.log();

    // Debug: mostra a estrutura interna
    console.log('=== Estrutura Interna ===');
    console.log('\nRéplica A nodes:');
    let id = replicaA.nodes.get('root').next;
    while (id) {
        const n = replicaA.nodes.get(id);
        console.log(`  ${id} -> value: "${n.value}", origin: ${n.origin}, next: ${n.next}`);
        id = n.next;
    }

    console.log('\nRéplica B nodes:');
    id = replicaB.nodes.get('root').next;
    while (id) {
        const n = replicaB.nodes.get(id);
        console.log(`  ${id} -> value: "${n.value}", origin: ${n.origin}, next: ${n.next}`);
        id = n.next;
    }

    console.log();

    // Teste adicional: 3 inserções concorrentes
    console.log('=== Teste Adicional: 3 Inserções Concorrentes ===\n');

    // Cria 3 réplicas com estado inicial
    const r1 = new RGA('A');
    const r2 = new RGA('B');
    const r3 = new RGA('C');

    // Insere "AB" em r1 e sincroniza
    const initOps = [];
    let lastId = 'root';
    for (const char of 'AB') {
        const node = r1.add(char, lastId);
        initOps.push({ type: 'insert', id: node.id, value: node.value, origin: node.origin });
        lastId = node.id;
    }

    // Aplica em r2 e r3
    for (const op of initOps) {
        r2.applyRemoteOperation(op);
        r3.applyRemoteOperation(op);
    }

    const sharedAfter = lastId;
    console.log(`Estado inicial: "${r1.getText()}"`);
    console.log(`Inserindo após nó: ${sharedAfter}\n`);

    // Inserções concorrentes no MESMO ponto
    const node1 = r1.add('1', sharedAfter);
    const op1 = { type: 'insert', id: node1.id, value: node1.value, origin: node1.origin };

    const node2 = r2.add('2', sharedAfter);
    const op2 = { type: 'insert', id: node2.id, value: node2.value, origin: node2.origin };

    const node3 = r3.add('3', sharedAfter);
    const op3 = { type: 'insert', id: node3.id, value: node3.value, origin: node3.origin };

    console.log('Operações concorrentes:');
    console.log(`  r1 insere "1" - id=${op1.id}`);
    console.log(`  r2 insere "2" - id=${op2.id}`);
    console.log(`  r3 insere "3" - id=${op3.id}`);
    console.log();

    // Aplica em diferentes ordens
    // r1 recebe: op2, op3
    r1.applyRemoteOperation(op2);
    r1.applyRemoteOperation(op3);

    // r2 recebe: op3, op1
    r2.applyRemoteOperation(op3);
    r2.applyRemoteOperation(op1);

    // r3 recebe: op1, op2
    r3.applyRemoteOperation(op1);
    r3.applyRemoteOperation(op2);

    console.log('Resultados:');
    console.log(`  r1: "${r1.getText()}"`);
    console.log(`  r2: "${r2.getText()}"`);
    console.log(`  r3: "${r3.getText()}"`);

    if (r1.getText() === r2.getText() && r2.getText() === r3.getText()) {
        console.log('\n✅ SUCESSO: Todas as 3 réplicas convergiram!');
        return true;
    } else {
        console.log('\n❌ FALHA: As réplicas NÃO convergiram!');
        process.exit(1);
    }
}

testConvergence();
