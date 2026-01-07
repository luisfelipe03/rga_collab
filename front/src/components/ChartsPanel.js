import React from 'react';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import '../styles/ChartsPanel.css';

const ChartsPanel = ({ data }) => {
    if (!data || data.length === 0) return (
        <div className="charts-container empty">
            <div className="chart-card">
                <p>Aguardando dados das métricas...</p>
            </div>
        </div>
    );

    // Formata o timestamp para hora:minuto:segundo
    const formatXAxis = (tickItem) => {
        if (!tickItem) return '';
        const date = new Date(tickItem);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    };

    // Formatador inteligente para Mbps
    const formatMbps = (value) => {
        const num = Number(value);
        if (isNaN(num)) return '0.000';
        if (num > 100) return num.toFixed(1);
        if (num > 1) return num.toFixed(2);
        return num.toFixed(4);
    };

    return (
        <div className="charts-container">
            {/* GRÁFICO 1: Eficiência do CRDT (Nodes vs Tombstones) */}
            <div className="chart-card">
                <h3>
                    <span role="img" aria-label="memory">🧠</span> Estrutura do RGA (Memória vs Texto)
                </h3>
                <p className="chart-desc">
                    Monitoramento do crescimento de nós em memória comparado ao texto visível.
                    A diferença representa os tombstones (nós excluídos ainda em memória).
                </p>
                <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} syncId="crdtMetrics">
                            <defs>
                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="timestamp"
                                tickFormatter={formatXAxis}
                                hide
                            />
                            <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                            <Tooltip
                                labelFormatter={formatXAxis}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            />
                            <Legend verticalAlign="top" height={36} />
                            <Area
                                type="monotone"
                                dataKey="totalNodes"
                                stroke="#8884d8"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorTotal)"
                                name="Total de Nós (Memória)"
                                isAnimationActive={false}
                            />
                            <Area
                                type="monotone"
                                dataKey="activeNodes"
                                stroke="#82ca9d"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorActive)"
                                name="Texto Visível"
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* GRÁFICO 2: Latência */}
            <div className="chart-card">
                <h3>
                    <span role="img" aria-label="latency">⚡</span> Latência de Operação (ms)
                </h3>
                <p className="chart-desc">
                    Tempo de resposta do servidor para processar cada operação RGA.
                </p>
                <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} syncId="crdtMetrics">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="timestamp" tickFormatter={formatXAxis} hide />
                            <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                            <Tooltip
                                labelFormatter={formatXAxis}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="averageLatency"
                                stroke="#ff7300"
                                strokeWidth={3}
                                dot={false}
                                name="Latência Média"
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* GRÁFICO 3: Uso de Rede */}
            <div className="chart-card">
                <h3>
                    <span role="img" aria-label="network">🌐</span> Tráfego de Rede (Mbps)
                </h3>
                <p className="chart-desc">
                    Consumo de banda para sincronização de deltas em tempo real.
                </p>
                <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} syncId="crdtMetrics">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="timestamp" tickFormatter={formatXAxis} hide />
                            <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                            <Tooltip
                                labelFormatter={formatXAxis}
                                formatter={(value, name) => [`${formatMbps(value)} Mbps`, name]}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            />
                            <Legend verticalAlign="top" height={36} />
                            <Line
                                type="monotone"
                                dataKey="networkStats.rx_rate_mbps"
                                stroke="#2563eb"
                                strokeWidth={2}
                                dot={false}
                                name="Recebido (RX)"
                                isAnimationActive={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="networkStats.tx_rate_mbps"
                                stroke="#ef4444"
                                strokeWidth={2}
                                dot={false}
                                name="Enviado (TX)"
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default ChartsPanel;
