import React from 'react';
import '../styles/About.css';

const About = ({ onClose }) => {
  return (
    <div className="about-overlay">
      <div className="about-container">
        <button className="close-button" onClick={onClose}>
          ×
        </button>

        <div className="about-header">
          <div className="header-content">
            <img
              src="/ufape-logo.png"
              alt="UFAPE"
              className="university-logo"
            />
            <div className="header-text">
              <h1>RGA collab</h1>
              <p className="subtitle">
                Editor de Texto Colaborativo Baseado em CRDT
              </p>
              <p className="authors">
                Desenvolvido por: Alex Lopes, Emanuel Reino, Fernando Emidio, Luis Andrade
                <br />
                Projeto Acadêmico - Universidade Federal do Agreste de Pernambuco (UFAPE)
              </p>
            </div>
          </div>
        </div>

        <div className="about-content">
          <section className="about-section overview">
            <h2>Visão Geral do Projeto</h2>
            <p>
              O <strong>RGA collab</strong> é um editor de texto colaborativo em tempo real 
              desenvolvido como projeto de pesquisa na UFAPE. Nosso objetivo foi criar uma 
              plataforma onde múltiplos usuários podem editar documentos simultaneamente, 
              mantendo a consistência dos dados sem depender de coordenação centralizada.
            </p>
            <p>
              Diferente de editores colaborativos tradicionais que usam algoritmos de 
              transformação operacional (OT), implementamos uma abordagem baseada em 
              CRDTs (Conflict-free Replicated Data Types), que garante convergência 
              automática mesmo durante edições concorrentes.
            </p>
          </section>

          <section className="about-section">
            <h2>Tecnologia CRDT</h2>
            <p>
              A tecnologia central do nosso projeto são os CRDTs - estruturas de dados 
              replicadas sem conflitos. Esta abordagem permite que cada usuário trabalhe 
              em sua própria cópia local do documento, com as mudanças sendo sincronizadas 
              automaticamente quando a conexão estiver disponível.
            </p>
            
            <div className="algorithm-grid">
              <div className="algorithm-card">
                <h3>RGA (Replicated Growable Array)</h3>
                <p>
                  O coração do nosso editor. Esta estrutura mantém o texto como uma 
                  sequência ordenada de caracteres, onde cada inserção ou deleção recebe 
                  um identificador único que permite ordenação consistente entre todos 
                  os usuários.
                </p>
              </div>
              <div className="algorithm-card">
                <h3>GCounter (Grow-only Counter)</h3>
                <p>
                  Usamos este contador distribuído para acompanhar estatísticas do sistema, 
                  como o número total de operações realizadas. Cada usuário mantém sua 
                  própria contagem, que é combinada para gerar o total global.
                </p>
              </div>
              <div className="algorithm-card">
                <h3>Delta-CRDT</h3>
                <p>
                  Para otimizar o uso de rede, implementamos esta variação que transmite 
                  apenas as mudanças recentes (deltas) em vez do estado completo do 
                  documento. Isso reduz significativamente o consumo de banda.
                </p>
              </div>
              <div className="algorithm-card">
                <h3>LWW-Register (Last-Write-Wins)</h3>
                <p>
                  Utilizado para metadados como título do documento e informações de 
                  autoria. Quando há conflitos, prevalece a última modificação, usando 
                  timestamps para determinar a ordem.
                </p>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>Arquitetura do Sistema</h2>
            <p>
              Nosso sistema segue uma arquitetura cliente-servidor com comunicação em 
              tempo real via WebSockets. O servidor atua como um ponto central para 
              distribuir as mudanças entre todos os participantes de um documento.
            </p>

            <div className="architecture-details">
              <h3>Componentes Principais</h3>
              <ul className="architecture-list">
                <li>
                  <strong>Interface Web (Frontend):</strong> Desenvolvida em React, 
                  permite a edição colaborativa em tempo real com feedback visual imediato
                </li>
                <li>
                  <strong>Servidor de Sincronização:</strong> Implementado em Node.js, 
                  gerencia as conexões WebSocket e distribui operações entre participantes
                </li>
                <li>
                  <strong>Persistência de Dados:</strong> Usamos MongoDB para armazenar 
                  documentos e histórico de operações, permitindo recuperação após desconexões
                </li>
                <li>
                  <strong>Sistema de Métricas:</strong> Coleta dados de desempenho em 
                  tempo real para análise e otimização
                </li>
              </ul>
            </div>
          </section>

          <section className="about-section">
            <h2>Tecnologias Utilizadas</h2>
            <div className="tech-grid">
              <div className="tech-category">
                <h3>Frontend</h3>
                <ul>
                  <li>React 19.2.3 - Interface do usuário</li>
                  <li>Socket.IO Client 4.8.1 - Comunicação em tempo real</li>
                  <li>Context API - Gerenciamento de estado</li>
                  <li>CSS3 - Estilização responsiva</li>
                </ul>
              </div>
              <div className="tech-category">
                <h3>Backend</h3>
                <ul>
                  <li>Node.js - Ambiente de execução</li>
                  <li>Express 5.2.1 - Servidor web</li>
                  <li>Socket.IO 4.8.1 - WebSocket server</li>
                  <li>Mongoose 8.8.4 - Interface com MongoDB</li>
                </ul>
              </div>
              <div className="tech-category">
                <h3>Banco de Dados</h3>
                <ul>
                  <li>MongoDB Atlas - Banco de dados em nuvem</li>
                  <li>Schema especializado para CRDTs</li>
                  <li>Backup automático e alta disponibilidade</li>
                </ul>
              </div>
              <div className="tech-category">
                <h3>Infraestrutura</h3>
                <ul>
                  <li>WebSockets - Comunicação bidirecional</li>
                  <li>Arquitetura baseada em salas - Isolamento por documento</li>
                  <li>Compressão de mensagens - Otimização de rede</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>Métricas e Monitoramento</h2>
            <p>
              Implementamos um sistema abrangente de coleta de métricas para avaliar 
              o desempenho do sistema e identificar oportunidades de otimização:
            </p>
            
            <div className="metrics-grid">
              <div className="metric-item">
                <h4>Latência de Operações</h4>
                <p>
                  Medimos o tempo desde que um usuário digita até que a alteração apareça 
                  para outros participantes. Usamos timestamps de alta precisão (nanossegundos).
                </p>
              </div>
              <div className="metric-item">
                <h4>Contagem de Operações</h4>
                <p>
                  Acompanhamos todas as inserções e deleções realizadas, permitindo 
                  analisar padrões de uso e carga do sistema.
                </p>
              </div>
              <div className="metric-item">
                <h4>Eficiência de Transmissão</h4>
                <p>
                  Calculamos o tamanho médio das atualizações enviadas pela rede, 
                  demonstrando a eficácia da otimização Delta-CRDT.
                </p>
              </div>
              <div className="metric-item">
                <h4>Estatísticas de Rede</h4>
                <p>
                  Monitoramos uso de banda, taxas de transferência e qualidade da 
                  conexão para identificar problemas de rede.
                </p>
              </div>
              <div className="metric-item">
                <h4>Estrutura Interna</h4>
                <p>
                  Analisamos a relação entre elementos ativos e removidos no RGA, 
                  importante para otimização de memória.
                </p>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>Resultados e Próximos Passos</h2>
            <p>
              O <strong>RGA collab</strong> demonstrou ser uma solução viável para 
              edição colaborativa, oferecendo baixa latência e consistência forte 
              eventual. A arquitetura CRDT mostrou-se particularmente adequada para 
              cenários com conectividade intermitente ou alta latência de rede.
            </p>
            <p>
              Para o futuro, planejamos implementar funcionalidades adicionais como 
              formatação de texto rica, comentários colaborativos, controle de versões 
              e suporte a documentos maiores. Também estamos interessados em explorar 
              técnicas de compressão mais avançadas e melhorias na interface do usuário.
            </p>
          </section>

          <section className="about-section references">
            <h2>Referências Técnicas</h2>
            <p className="references-intro">
              Nosso projeto foi baseado em pesquisas acadêmicas sobre CRDTs e 
              sistemas colaborativos:
            </p>
            <ul className="references-list">
              <li>
                <strong>Preguiça, N., Baquero, C., & Shapiro, M.</strong> (2018). 
                Conflict-free Replicated Data Types (CRDTs). Encyclopedia of Big Data Technologies.
              </li>
              <li>
                <strong>Shapiro, M., Preguiça, N., Baquero, C., & Zawirski, M.</strong> (2011). 
                A comprehensive study of Convergent and Commutative Replicated Data Types.
              </li>
              <li>
                <strong>Almeida, P. S., Shoker, A., & Baquero, C.</strong> (2018). 
                Delta State Replicated Data Types. Journal of Parallel and Distributed Computing.
              </li>
              <li>
                <strong>Kleppmann, M., & Beresford, A. R.</strong> (2017). 
                A Conflict-Free Replicated JSON Datatype. IEEE Transactions on Parallel and Distributed Systems.
              </li>
              <li>
                <strong>Roh, H. G., et al.</strong> (2011). 
                Replicated abstract data types: Building blocks for collaborative applications.
              </li>
              <li>
                <strong>Oster, G., et al.</strong> (2006). 
                Data consistency for P2P collaborative editing. CSCW 2006.
              </li>
            </ul>
          </section>

          <section className="about-section footer-section">
            <div className="footer-content">
              <p className="university-name">
                Universidade Federal do Agreste de Pernambuco - UFAPE
              </p>
              <p className="motto">Vertendo Per Educationem</p>
              <p className="project-info">
                Projeto de Pesquisa em Sistemas Distribuídos | Departamento de Computação
              </p>
              <p className="version">Versão 1.0.0 | Dezembro 2025</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default About;