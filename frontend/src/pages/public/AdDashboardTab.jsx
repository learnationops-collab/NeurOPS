import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Megaphone, RefreshCw, TrendingUp, Users, DollarSign, Activity, CalendarDays } from 'lucide-react';
import AdDetailModal from '../../components/modals/AdDetailModal';



const AdDashboardTab = () => {
    const [stats, setStats] = useState({ ad_stats: [], setter_stats: [] });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedAdId, setSelectedAdId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Filtros de periodo
    const [period, setPeriod] = useState('last_month');
    const [customDates, setCustomDates] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchStats();
    }, [period, customDates]);

    const fetchStats = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const params = { period };
            if (period === 'custom') {
                params.start_date = customDates.start;
                params.end_date = customDates.end;
            }
            const adsRes = await api.get('/manychat-webhook/stats/dashboard', { params });
            // Asegurar que siempre tengamos la estructura esperada
            const data = adsRes.data || {};
            setStats({
                ad_stats: Array.isArray(data.ad_stats) ? data.ad_stats : [],
                setter_stats: Array.isArray(data.setter_stats) ? data.setter_stats : []
            });
        } catch (err) {
            console.error('Error fetching ad stats:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const periods = [
        { id: 'yesterday', label: 'Ayer' },
        { id: 'last_week', label: 'Semana' },
        { id: 'last_month', label: 'Mes' },
        { id: 'custom', label: 'Personalizado' }
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/40 p-5 rounded-2xl border border-slate-800/50">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 rounded-xl">
                        <Megaphone className="text-blue-400" size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-white italic">Rendimiento por Anuncio</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Atribución de ventas y agendas por periodo</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
                        {periods.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setPeriod(p.id)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all
                                    ${period === p.id 
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                        : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {period === 'custom' && (
                        <div className="flex items-center gap-2 animate-in zoom-in-95 duration-300">
                            <div className="relative group">
                                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 group-hover:text-blue-300 transition-colors pointer-events-none z-10" size={12} />
                                <input 
                                    type="date"
                                    value={customDates.start}
                                    onChange={e => setCustomDates({...customDates, start: e.target.value})}
                                    onClick={(e) => e.currentTarget.showPicker?.()}
                                    className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-2 py-1.5 text-[8px] font-black text-white/70 outline-none focus:border-blue-500 focus:text-white transition-all cursor-pointer shadow-inner w-32 relative"
                                />
                            </div>
                            <span className="text-slate-600 font-black text-[10px] uppercase">a</span>
                            <div className="relative group">
                                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 group-hover:text-blue-300 transition-colors pointer-events-none z-10" size={12} />
                                <input 
                                    type="date"
                                    value={customDates.end}
                                    onChange={e => setCustomDates({...customDates, end: e.target.value})}
                                    onClick={(e) => e.currentTarget.showPicker?.()}
                                    className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-2 py-1.5 text-[8px] font-black text-white/70 outline-none focus:border-blue-500 focus:text-white transition-all cursor-pointer shadow-inner w-32 relative"
                                />
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => fetchStats(true)}
                        disabled={refreshing}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700/50"
                        title="Actualizar"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>


            {/* Rendimiento por Fuente (Setter) */}
            {!loading && stats.setter_stats && stats.setter_stats.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <Users className="text-slate-400" size={16} />
                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Rendimiento por Fuente (Setter)</h4>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {stats.setter_stats.map(setter => (
                            <div key={setter.name} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-emerald-500/50 transition-all shadow-lg">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 group-hover:text-emerald-400 transition-colors">{setter.name}</p>
                                <div className="flex items-center gap-4">
                                    <div className="text-center">
                                        <p className="text-xl font-black text-white">{setter.agendas}</p>
                                        <p className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter">Agendas</p>
                                    </div>
                                    <div className="w-px h-6 bg-slate-800" />
                                    <div className="text-center">
                                        <p className="text-xl font-black text-amber-400">{setter.ventas || 0}</p>
                                        <p className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter">Ventas</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-blue-500" size={28} />
                </div>
            ) : (
                <div className="space-y-6">
                    {stats.ad_stats.length === 0 ? (
                        <div className="text-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                            <Megaphone size={40} className="mx-auto mb-3 opacity-20" />
                            <p className="font-bold text-slate-500 uppercase tracking-widest text-sm">Sin datos para este periodo</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {stats.ad_stats.map((stat, index) => {
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

                                return (
                                    <div 
                                        key={stat.ad_id} 
                                        onClick={() => {
                                            setSelectedAdId(stat.ad_id);
                                            setIsModalOpen(true);
                                        }}
                                        className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 hover:bg-slate-800/60 hover:border-blue-500/30 transition-all relative overflow-hidden group cursor-pointer shadow-xl"
                                    >
                                        <div className="relative">
                                            {/* Header */}
                                            <div className="flex items-start justify-between mb-5">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                        <Activity size={10} className="text-blue-500" />
                                                        Anuncio #{stat.ad_id}
                                                    </p>
                                                    <h4 className="text-sm font-black text-white italic tracking-tight leading-tight line-clamp-2 uppercase">
                                                        {stat.ad_name}
                                                    </h4>
                                                </div>
                                                <span className="text-slate-700 text-[10px] font-black tracking-tighter">#{index + 1}</span>
                                            </div>

                                            {/* Main Metrics (Leads/Qual) */}
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/50">
                                                    <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                                        <Users size={12} className="text-blue-400" />
                                                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-wider">Leads</p>
                                                    </div>
                                                    <p className="text-2xl font-black text-white leading-none">{stat.total_leads}</p>
                                                </div>

                                                <div className={`rounded-xl p-3 border ${qualBg.replace('10', '20').replace('bg-', 'border-')}`}>
                                                    <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                                        <TrendingUp size={12} className={qualColor} />
                                                        <p className={`text-[9px] font-black uppercase tracking-wider ${qualColor}`}>% Cual.</p>
                                                    </div>
                                                    <p className={`text-2xl font-black leading-none ${qualColor}`}>{stat.qualified_percentage}%</p>
                                                </div>
                                            </div>

                                            {/* Conversion Metrics (Agendas/Sales) */}
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/30">
                                                    <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                                        <CalendarDays size={12} className="text-emerald-400" />
                                                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Agendas</p>
                                                    </div>
                                                    <p className="text-xl font-black text-white leading-none">{stat.agendas || 0}</p>
                                                    {/* Setter Breakdown */}
                                                    {stat.setter_breakdown && Object.keys(stat.setter_breakdown).length > 0 && (
                                                        <div className="mt-2 pt-2 border-t border-slate-800/50 space-y-1">
                                                            {Object.entries(stat.setter_breakdown).map(([setter, count]) => (
                                                                <div key={setter} className="flex items-center justify-between text-[9px] font-bold text-slate-400">
                                                                    <span className="truncate pr-2">{setter}:</span>
                                                                    <span className="text-emerald-400 font-black">{count}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/30">
                                                    <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                                        <DollarSign size={12} className="text-amber-400" />
                                                        <p className="text-[9px] font-black text-amber-400 uppercase tracking-wider">Ventas</p>
                                                    </div>
                                                    <p className="text-xl font-black text-white leading-none">{stat.ventas || 0}</p>
                                                </div>
                                            </div>

                                            {/* Financial Metrics (CPL, CPA, CPV) */}
                                            <div className="pt-4 border-t border-slate-800/50">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex flex-col">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Inversión</p>
                                                        <p className="text-xs font-black text-white">${(stat.spend||0).toLocaleString()}</p>
                                                    </div>
                                                    <div className="flex flex-col text-center">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">CPL</p>
                                                        <p className="text-xs font-black text-blue-400">${stat.cpl || '0'}</p>
                                                    </div>
                                                    <div className="flex flex-col text-center">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">CPA</p>
                                                        <p className="text-xs font-black text-emerald-400">${stat.cpa || '0'}</p>
                                                    </div>
                                                    <div className="flex flex-col text-right">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">CPV</p>
                                                        <p className="text-xs font-black text-amber-400">${stat.cpv || '0'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                        </div>
                    )}
                </div>
            )}

            <AdDetailModal 
                isOpen={isModalOpen} 
                adId={selectedAdId} 
                onClose={() => setIsModalOpen(false)} 
            />
        </div>
    );
};

export default AdDashboardTab;
