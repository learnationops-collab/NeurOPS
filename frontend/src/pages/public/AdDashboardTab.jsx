import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Megaphone, RefreshCw, TrendingUp, Users, DollarSign, Activity, CalendarDays, HelpCircle, LayoutGrid, List } from 'lucide-react';
import AdDetailModal from '../../components/modals/AdDetailModal';



const AdDashboardTab = () => {
    const [stats, setStats] = useState({ ad_stats: [], setter_stats: [] });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedAdId, setSelectedAdId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState('gallery'); // 'gallery' | 'list'
    
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
                    
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner ml-2">
                        <button
                            onClick={() => setViewMode('gallery')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'gallery' ? 'bg-slate-800 text-blue-400 shadow' : 'text-slate-500 hover:text-slate-300'}`}
                            title="Vista Galería"
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-800 text-blue-400 shadow' : 'text-slate-500 hover:text-slate-300'}`}
                            title="Vista Lista"
                        >
                            <List size={16} />
                        </button>
                    </div>
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
                    ) : viewMode === 'list' ? (
                        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-x-auto shadow-xl">
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-slate-800/80 bg-slate-950/50">
                                        <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Anuncio</th>
                                        <th className="py-4 px-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Inversión</th>
                                        <th className="py-4 px-5 text-[10px] font-black text-blue-400 uppercase tracking-widest text-center">Leads</th>
                                        <th className="py-4 px-5 text-[10px] font-black text-blue-400 uppercase tracking-widest text-right">CPL</th>
                                        <th className="py-4 px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">% Cual.</th>
                                        <th className="py-4 px-5 text-[10px] font-black text-emerald-400 uppercase tracking-widest text-right">CPQL</th>
                                        <th className="py-4 px-5 text-[10px] font-black text-emerald-400 uppercase tracking-widest text-center">Agendas</th>
                                        <th className="py-4 px-5 text-[10px] font-black text-emerald-400 uppercase tracking-widest text-right">CPA</th>
                                        <th className="py-4 px-5 text-[10px] font-black text-amber-400 uppercase tracking-widest text-center">Ventas</th>
                                        <th className="py-4 px-5 text-[10px] font-black text-amber-400 uppercase tracking-widest text-right">CPV</th>
                                        <th className="py-4 px-5 text-[10px] font-black text-emerald-400 uppercase tracking-widest text-right">Cash Col.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {(() => {
                                        const totals = stats.ad_stats.reduce((acc, curr) => {
                                            acc.spend += (curr.spend || 0);
                                            acc.total_leads += (curr.total_leads || 0);
                                            acc.agendas += (curr.agendas || 0);
                                            acc.ventas += (curr.ventas || 0);
                                            
                                            // Cash collect average accumulator
                                            if (curr.avg_cash_collect > 0) {
                                                acc.cc_sum += curr.avg_cash_collect;
                                                acc.cc_count += 1;
                                            }

                                            const qual = Math.round(((curr.qualified_percentage || 0) / 100) * (curr.total_leads || 0));
                                            acc.total_qualified += qual;
                                            return acc;
                                        }, { spend: 0, total_leads: 0, agendas: 0, ventas: 0, total_qualified: 0, cc_sum: 0, cc_count: 0 });

                                        const totalCPL = totals.total_leads > 0 ? (totals.spend / totals.total_leads).toFixed(2) : '0';
                                        const totalCPQL = totals.total_qualified > 0 ? (totals.spend / totals.total_qualified).toFixed(2) : '0';
                                        const totalCPA = totals.agendas > 0 ? (totals.spend / totals.agendas).toFixed(2) : '0';
                                        const totalCPV = totals.ventas > 0 ? (totals.spend / totals.ventas).toFixed(2) : '0';
                                        const totalAvgCC = totals.cc_count > 0 ? (totals.cc_sum / totals.cc_count).toFixed(2) : '0';
                                        const totalQualPercentage = totals.total_leads > 0 ? Math.round((totals.total_qualified / totals.total_leads) * 100) : 0;

                                        let qualColor = "text-slate-400";
                                        if (totalQualPercentage >= 50) qualColor = "text-emerald-400";
                                        else if (totalQualPercentage >= 20) qualColor = "text-yellow-400";
                                        else if (totals.total_leads > 0 && totalQualPercentage < 20) qualColor = "text-red-400";

                                        return (
                                            <>
                                                <tr className="bg-slate-800/80 border-b-2 border-slate-700/50 shadow-md relative z-10">
                                                    <td className="py-4 px-5">
                                                        <span className="text-sm font-black text-white uppercase tracking-widest">Total General</span>
                                                    </td>
                                                    <td className="py-4 px-5 text-center text-xs font-black text-white">${totals.spend.toLocaleString()}</td>
                                                    <td className="py-4 px-5 text-center text-xs font-black text-white">{totals.total_leads}</td>
                                                    <td className="py-4 px-5 text-right text-xs font-black text-blue-400">${totalCPL}</td>
                                                    <td className={`py-4 px-5 text-center text-xs font-black ${qualColor}`}>{totalQualPercentage}%</td>
                                                    <td className="py-4 px-5 text-right text-xs font-black text-emerald-400">${totalCPQL}</td>
                                                    <td className="py-4 px-5 text-center text-xs font-black text-white">{totals.agendas}</td>
                                                    <td className="py-4 px-5 text-right text-xs font-black text-emerald-400">${totalCPA}</td>
                                                    <td className="py-4 px-5 text-center text-xs font-black text-white">{totals.ventas}</td>
                                                    <td className="py-4 px-5 text-right text-xs font-black text-amber-400">${totalCPV}</td>
                                                    <td className="py-4 px-5 text-right text-xs font-black text-emerald-400">${totalAvgCC}</td>
                                                </tr>
                                                {stats.ad_stats.map((stat, index) => {
                                                    let qualColorStat = "text-slate-400";
                                                    if (stat.qualified_percentage >= 50) qualColorStat = "text-emerald-400";
                                                    else if (stat.qualified_percentage >= 20) qualColorStat = "text-yellow-400";
                                                    else if (stat.total_leads > 0 && stat.qualified_percentage < 20) qualColorStat = "text-red-400";

                                                    return (
                                            <tr 
                                                key={stat.ad_id} 
                                                onClick={() => { setSelectedAdId(stat.ad_id); setIsModalOpen(true); }}
                                                className="group hover:bg-slate-800/40 transition-colors cursor-pointer"
                                            >
                                                <td className="py-4 px-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[9px] font-black text-slate-400">
                                                            {index + 1}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-black text-white uppercase tracking-tight max-w-[200px] truncate">{stat.ad_name}</h4>
                                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                                                <Activity size={10} className="text-blue-500" /> #{stat.ad_id}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-5 text-center text-xs font-black text-white">${(stat.spend||0).toLocaleString()}</td>
                                                <td className="py-4 px-5 text-center text-xs font-black text-white">{stat.total_leads}</td>
                                                <td className="py-4 px-5 text-right text-xs font-black text-blue-400">${stat.cpl || '0'}</td>
                                                <td className={`py-4 px-5 text-center text-xs font-black ${qualColor}`}>{stat.qualified_percentage}%</td>
                                                <td className="py-4 px-5 text-right text-xs font-black text-emerald-400">${stat.cpql || '0'}</td>
                                                <td className="py-4 px-5 text-center text-xs font-black text-white">{stat.agendas || 0}</td>
                                                <td className="py-4 px-5 text-right text-xs font-black text-emerald-400">${stat.cpa || '0'}</td>
                                                <td className="py-4 px-5 text-center text-xs font-black text-white">{stat.ventas || 0}</td>
                                                <td className="py-4 px-5 text-right text-xs font-black text-amber-400">${stat.cpv || '0'}</td>
                                                <td className="py-4 px-5 text-right text-xs font-black text-emerald-400">${stat.avg_cash_collect || '0'}</td>
                                                </tr>
                                                    );
                                                })}
                                            </>
                                        );
                                    })()}
                                </tbody>
                            </table>
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
                                            <div className="grid grid-cols-2 gap-3 mb-4 overflow-visible">
                                                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/50 relative group/tooltip overflow-visible">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-1.5 opacity-70">
                                                            <Users size={12} className="text-blue-400" />
                                                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-wider">Leads</p>
                                                        </div>
                                                        <HelpCircle size={10} className="text-slate-600 cursor-help hover:text-white transition-colors" />
                                                    </div>
                                                    <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50 shadow-xl border border-slate-700/50">
                                                        Suma total de leads registrados para este anuncio en el periodo seleccionado.
                                                        <div className="absolute top-full right-1.5 border-4 border-transparent border-t-slate-800"></div>
                                                    </div>
                                                    <p className="text-2xl font-black text-white leading-none">{stat.total_leads}</p>
                                                </div>

                                                <div className={`rounded-xl p-3 border ${qualBg.replace('10', '20').replace('bg-', 'border-')} relative group/tooltip overflow-visible`}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-1.5 opacity-70">
                                                            <TrendingUp size={12} className={qualColor} />
                                                            <p className={`text-[9px] font-black uppercase tracking-wider ${qualColor}`}>% Cual.</p>
                                                        </div>
                                                        <HelpCircle size={10} className="text-slate-600 cursor-help hover:text-white transition-colors" />
                                                    </div>
                                                    <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50 shadow-xl border border-slate-700/50">
                                                        Porcentaje de leads marcados como cualificados. Cálculo: (Cualificados / Total Leads).
                                                        <div className="absolute top-full right-1.5 border-4 border-transparent border-t-slate-800"></div>
                                                    </div>
                                                    <p className={`text-2xl font-black leading-none ${qualColor}`}>{stat.qualified_percentage}%</p>
                                                </div>
                                            </div>

                                            {/* Conversion Metrics (Agendas/Sales) */}
                                            <div className="grid grid-cols-2 gap-3 mb-4 overflow-visible">
                                                <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/30 relative group/tooltip overflow-visible">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-1.5 opacity-70">
                                                            <CalendarDays size={12} className="text-emerald-400" />
                                                            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Agendas</p>
                                                        </div>
                                                        <HelpCircle size={10} className="text-slate-600 cursor-help hover:text-white transition-colors" />
                                                    </div>
                                                    <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50 shadow-xl border border-slate-700/50">
                                                        Cantidad de leads que agendaron una llamada o cita.
                                                        <div className="absolute top-full right-1.5 border-4 border-transparent border-t-slate-800"></div>
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

                                                <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/30 relative group/tooltip overflow-visible">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-1.5 opacity-70">
                                                            <DollarSign size={12} className="text-amber-400" />
                                                            <p className="text-[9px] font-black text-amber-400 uppercase tracking-wider">Ventas</p>
                                                        </div>
                                                        <HelpCircle size={10} className="text-slate-600 cursor-help hover:text-white transition-colors" />
                                                    </div>
                                                    <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50 shadow-xl border border-slate-700/50">
                                                        Cantidad de leads que terminaron en una venta cerrada.
                                                        <div className="absolute top-full right-1.5 border-4 border-transparent border-t-slate-800"></div>
                                                    </div>
                                                    <p className="text-xl font-black text-white leading-none">{stat.ventas || 0}</p>
                                                </div>
                                            </div>

                                            {/* Financial Metrics (CPL, CPA, CPV) */}
                                            <div className="pt-4 border-t border-slate-800/50 overflow-visible">
                                                <div className="flex items-center justify-between gap-2 overflow-visible">
                                                    <div className="flex flex-col relative group/tooltip overflow-visible">
                                                        <div className="flex items-center gap-1">
                                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Inversión</p>
                                                            <HelpCircle size={8} className="text-slate-600 cursor-help" />
                                                        </div>
                                                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50 shadow-xl border border-slate-700/50">
                                                            Gasto total reportado en la plataforma de anuncios para este periodo.
                                                            <div className="absolute top-full left-2 border-4 border-transparent border-t-slate-800"></div>
                                                        </div>
                                                        <p className="text-xs font-black text-white">${(stat.spend||0).toLocaleString()}</p>
                                                    </div>
                                                    <div className="flex flex-col text-center relative group/tooltip overflow-visible">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">CPL</p>
                                                            <HelpCircle size={8} className="text-slate-600 cursor-help" />
                                                        </div>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50 shadow-xl border border-slate-700/50">
                                                            CPL: Costo por cada lead generado (Inversión / Total Leads).<br/>
                                                            CPQL: Costo por Lead Cualificado (Inversión / Cualificados).
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                                        </div>
                                                        <p className="text-xs font-black text-blue-400">${stat.cpl || '0'}</p>
                                                        <div className="mt-1 flex flex-col items-center">
                                                            <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">CPQL</p>
                                                            <p className="text-[10px] font-black text-emerald-400">${stat.cpql || '0'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col text-center relative group/tooltip overflow-visible">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">CPA</p>
                                                            <HelpCircle size={8} className="text-slate-600 cursor-help" />
                                                        </div>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50 shadow-xl border border-slate-700/50">
                                                            Costo por cada agenda conseguida. Cálculo: (Inversión / Agendas).
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                                        </div>
                                                        <p className="text-xs font-black text-emerald-400">${stat.cpa || '0'}</p>
                                                    </div>
                                                    <div className="flex flex-col text-right relative group/tooltip overflow-visible">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">CPV</p>
                                                            <HelpCircle size={8} className="text-slate-600 cursor-help" />
                                                        </div>
                                                        <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50 shadow-xl border border-slate-700/50">
                                                            Costo por cada venta cerrada. Cálculo: (Inversión / Ventas).
                                                            <div className="absolute top-full right-2 border-4 border-transparent border-t-slate-800"></div>
                                                        </div>
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
