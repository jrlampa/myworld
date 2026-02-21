/**
 * AnalyticsDashboard — Dashboard de métricas de uso SaaS do sisRUA
 *
 * Interface em pt-BR. Dark/Light mode. Thin frontend — apenas exibe dados do backend.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    LineChart, Line, CartesianGrid, Legend
} from 'recharts';
import { fetchAnalyticsSummary, AnalyticsSummary } from '../services/analyticsService';

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}h`);

const CHART_COLORS = {
    success: '#4ade80',
    error: '#f87171',
    batch: '#60a5fa',
    single: '#facc15',
};

const REGION_RANK_COLORS = [
    'bg-yellow-500',
    'bg-slate-400',
    'bg-amber-700',
    'bg-slate-500',
    'bg-slate-600',
] as const;

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(ts: number): string {
    return new Date(ts).toLocaleString('pt-BR', {
        year: '2-digit', day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

interface Props {
    isDark: boolean;
}

const AnalyticsDashboard: React.FC<Props> = ({ isDark }) => {
    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAnalyticsSummary();
            setSummary(data);
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar métricas');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
    const cardBg = isDark ? 'bg-slate-800/60' : 'bg-white/80';
    const border = isDark ? 'border-slate-700' : 'border-slate-200';
    const textMain = isDark ? 'text-slate-100' : 'text-slate-800';

    if (loading) {
        return (
            <div className={`flex items-center justify-center py-16 ${textMuted}`}>
                <span>Carregando métricas...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center gap-3 py-12">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                    onClick={load}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 transition-colors"
                >
                    Tentar novamente
                </button>
            </div>
        );
    }

    if (!summary) return null;

    const hourData = summary.exportsByHour.map((count, i) => ({
        hora: HOUR_LABELS[i],
        exportações: count,
    }));

    const typeData = [
        { tipo: 'Individuais', valor: summary.singleExports, cor: CHART_COLORS.single },
        { tipo: 'Lote', valor: summary.batchExports, cor: CHART_COLORS.batch },
    ];

    const statusData = [
        { status: 'Sucesso', valor: summary.successfulExports, cor: CHART_COLORS.success },
        { status: 'Falha', valor: summary.failedExports, cor: CHART_COLORS.error },
    ];

    return (
        <div className="space-y-4 py-2">
            {/* Atualizar */}
            <div className="flex justify-between items-center">
                <h2 className={`text-sm font-bold uppercase tracking-wider ${textMuted}`}>
                    Métricas de Uso
                </h2>
                <button
                    onClick={load}
                    className={`text-xs px-3 py-1 rounded-full border ${border} ${textMuted} hover:text-blue-400 transition-colors`}
                >
                    ↻ Atualizar
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-2">
                <div className={`${cardBg} border ${border} rounded-xl p-3`}>
                    <p className={`text-xs ${textMuted} uppercase tracking-wider`}>Total DXF</p>
                    <p className={`text-2xl font-bold ${textMain}`}>{summary.totalExports}</p>
                </div>
                <div className={`${cardBg} border ${border} rounded-xl p-3`}>
                    <p className={`text-xs ${textMuted} uppercase tracking-wider`}>Últimas 24h</p>
                    <p className="text-2xl font-bold text-blue-400">{summary.exportsLast24h}</p>
                </div>
                <div className={`${cardBg} border ${border} rounded-xl p-3`}>
                    <p className={`text-xs ${textMuted} uppercase tracking-wider`}>Taxa Sucesso</p>
                    <p className={`text-2xl font-bold ${summary.successRate >= 90 ? 'text-green-400' : summary.successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {summary.successRate.toFixed(1)}%
                    </p>
                </div>
                <div className={`${cardBg} border ${border} rounded-xl p-3`}>
                    <p className={`text-xs ${textMuted} uppercase tracking-wider`}>Tempo Médio</p>
                    <p className={`text-2xl font-bold ${textMain}`}>{formatDuration(summary.avgDurationMs)}</p>
                </div>
                <div className={`${cardBg} border ${border} rounded-xl p-3`}>
                    <p className={`text-xs ${textMuted} uppercase tracking-wider`}>Raio Médio</p>
                    <p className={`text-2xl font-bold text-purple-400`}>{summary.avgRadius}m</p>
                </div>
                <div className={`${cardBg} border ${border} rounded-xl p-3`}>
                    <p className={`text-xs ${textMuted} uppercase tracking-wider`}>Últimos 7 dias</p>
                    <p className={`text-2xl font-bold ${textMain}`}>{summary.exportsLast7d}</p>
                </div>
            </div>

            {/* Gráfico por hora */}
            <div className={`${cardBg} border ${border} rounded-xl p-3`}>
                <p className={`text-xs font-semibold ${textMuted} mb-2 uppercase tracking-wider`}>
                    Exportações por Hora do Dia
                </p>
                <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                            <XAxis dataKey="hora" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 9 }} interval={3} />
                            <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 9 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: 'none', borderRadius: '8px', fontSize: '11px' }}
                                labelStyle={{ color: isDark ? '#e2e8f0' : '#1e293b' }}
                            />
                            <Bar dataKey="exportações" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Tipo e Status */}
            <div className="grid grid-cols-2 gap-2">
                <div className={`${cardBg} border ${border} rounded-xl p-3`}>
                    <p className={`text-xs font-semibold ${textMuted} mb-2 uppercase tracking-wider`}>Tipo</p>
                    <div className="h-24">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={typeData} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: -10 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="tipo" type="category" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} width={55} />
                                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: 'none', borderRadius: '8px', fontSize: '11px' }} />
                                <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={16}>
                                    {typeData.map((entry, i) => <Cell key={i} fill={entry.cor} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className={`${cardBg} border ${border} rounded-xl p-3`}>
                    <p className={`text-xs font-semibold ${textMuted} mb-2 uppercase tracking-wider`}>Status</p>
                    <div className="h-24">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={statusData} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: -10 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="status" type="category" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} width={55} />
                                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: 'none', borderRadius: '8px', fontSize: '11px' }} />
                                <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={16}>
                                    {statusData.map((entry, i) => <Cell key={i} fill={entry.cor} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Top Regiões */}
            {summary.topRegions.length > 0 && (
                <div className={`${cardBg} border ${border} rounded-xl p-3`}>
                    <p className={`text-xs font-semibold ${textMuted} mb-2 uppercase tracking-wider`}>
                        Regiões Mais Solicitadas
                    </p>
                    <div className="space-y-1">
                        {summary.topRegions.map((region, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white font-bold ${REGION_RANK_COLORS[i] ?? 'bg-slate-600'}`} style={{ fontSize: 9 }}>
                                    {i + 1}
                                </span>
                                <span className={textMuted}>{region.label}</span>
                                <span className={`ml-auto font-semibold ${textMain}`}>{region.count}×</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Eventos Recentes */}
            {summary.recentEvents.length > 0 && (
                <div className={`${cardBg} border ${border} rounded-xl p-3`}>
                    <p className={`text-xs font-semibold ${textMuted} mb-2 uppercase tracking-wider`}>
                        Exportações Recentes
                    </p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                        {summary.recentEvents.slice(0, 8).map((ev, i) => (
                            <div key={i} className={`flex items-center gap-2 text-xs py-1 border-b ${border} last:border-0`}>
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ev.success ? 'bg-green-400' : 'bg-red-400'}`} />
                                <span className={textMuted}>{formatDate(ev.timestamp)}</span>
                                <span className={`ml-auto font-mono ${textMuted}`}>{ev.radius}m</span>
                                <span className={`font-mono ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>{formatDuration(ev.durationMs)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {summary.totalExports === 0 && (
                <div className={`text-center py-8 ${textMuted} text-sm`}>
                    Nenhuma exportação registrada ainda.<br />
                    <span className="text-xs">Gere um DXF para ver as métricas.</span>
                </div>
            )}
        </div>
    );
};

export default AnalyticsDashboard;
