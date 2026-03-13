import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Hash, RefreshCw, TrendingUp, Users } from 'lucide-react';

const KeywordDashboardTab = () => {
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await api.get('/manychat-webhook/stats/keywords');
            setStats(res.data);
        } catch (err) {
            console.error('Error fetching keyword stats:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const maxLeads = Math.max(...stats.map(s => s.total_leads), 1);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 rounded-xl">
                        <Hash className="text-blue-400" size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-white">Rendimiento por Keyword</h3>
                        <p className="text-xs text-slate-500">Comparativa de leads entrantes y % de cualificación</p>
                    </div>
                </div>
                <button
                    onClick={() => fetchStats(true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                    Actualizar
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-blue-500" size={28} />
                </div>
            ) : stats.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <Hash size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="font-medium text-sm">Sin datos suficientes</p>
                    <p className="text-xs mt-1">Aún no hay leads registrados con keywords asociadas</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.map((stat, index) => {
                        // Determinar color de cualificación basado en el %
                        let qualColor = "text-slate-400";
                        let qualBg = "bg-slate-500/10";
                        if (stat.qualified_percentage >= 50) {
                            qualColor = "text-emerald-400";
                            qualBg = "bg-emerald-500/10";
                        } else if (stat.qualified_percentage >= 20) {
                            qualColor = "text-yellow-400";
                            qualBg = "bg-yellow-500/10";
                        } else if (stat.total_leads > 0 && stat.qualified_percentage < 20) {
                            qualColor = "text-red-400";
                            qualBg = "bg-red-500/10";
                        }

                        // Ancho de la barra de progreso relativo al máximo volumen de leads global
                        const barWidth = `${(stat.total_leads / maxLeads) * 100}%`;

                        return (
                            <div key={stat.keyword} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 transition-colors relative overflow-hidden group">
                                {/* Decoración de fondo topo-izq */}
                                <div className="absolute -top-4 -left-4 w-16 h-16 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-colors"></div>

                                <div className="relative">
                                    {/* Header de la tarjeta */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Keyword</p>
                                            <h4 className="text-lg font-black text-white px-2 py-0.5 bg-slate-900 rounded inline-block font-mono border border-slate-700">
                                                {stat.keyword}
                                            </h4>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-slate-600 text-[10px] font-bold">#{index + 1}</span>
                                        </div>
                                    </div>

                                    {/* Métricas Principales */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800">
                                            <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                                <Users size={12} className="text-blue-400" />
                                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-wider">Entrantes</p>
                                            </div>
                                            <p className="text-2xl font-black text-white leading-none">{stat.total_leads}</p>
                                        </div>

                                        <div className={`rounded-xl p-3 border ${qualBg.replace('10', '20').replace('bg-', 'border-')}`}>
                                            <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                                <TrendingUp size={12} className={qualColor} />
                                                <p className={`text-[9px] font-black uppercase tracking-wider ${qualColor}`}>% Cualificados</p>
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <p className={`text-2xl font-black leading-none ${qualColor}`}>{stat.qualified_percentage}%</p>
                                                <span className="text-[10px] text-slate-500 font-bold">({stat.qualified_leads})</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Barra de progreso visual (Volumen comparativo) */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[9px] font-bold text-slate-500">
                                            <span>Volumen Relativo</span>
                                            <span>{stat.total_leads} / {maxLeads} MAX</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 rounded-full"
                                                style={{ width: barWidth }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default KeywordDashboardTab;
