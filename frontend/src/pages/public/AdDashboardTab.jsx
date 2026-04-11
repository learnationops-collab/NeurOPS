import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Megaphone, RefreshCw, TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import AdDetailModal from '../../components/modals/AdDetailModal';


const AdDashboardTab = () => {
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedAdId, setSelectedAdId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Filtros de periodo
    const [period, setPeriod] = useState('last_month');

    useEffect(() => {
        fetchStats();
    }, [period]);

    const fetchStats = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const params = { period };
            const adsRes = await api.get('/manychat-webhook/stats/dashboard', { params });
            setStats(adsRes.data);
        } catch (err) {
            console.error('Error fetching ad stats:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const periods = [
        { id: 'yesterday', label: 'Ayer' },
        { id: 'last_week', label: 'Última Semana' },
        { id: 'last_month', label: 'Último Mes' }
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
                
                <div className="flex items-center gap-2">
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                        {periods.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setPeriod(p.id)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all
                                    ${period === p.id 
                                        ? 'bg-slate-800 text-white shadow-lg' 
                                        : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
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

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-blue-500" size={28} />
                </div>
            ) : (
                <div className="space-y-6">
                    {stats.length === 0 ? (
                        <div className="text-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                            <Megaphone size={40} className="mx-auto mb-3 opacity-20" />
                            <p className="font-bold text-slate-500 uppercase tracking-widest text-sm">Sin datos para este periodo</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {stats.map((stat, index) => {
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
