import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Megaphone, RefreshCw, TrendingUp, Users, DollarSign, Activity, CalendarDays, HelpCircle, LayoutGrid, List, Settings, ArrowUpDown, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { ResponsiveContainer, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ComposedChart } from 'recharts';
import AdDetailModal from '../../components/modals/AdDetailModal';
import usePersistentFilters from '../../hooks/usePersistentFilters';
import ColumnSettings from '../../components/marketing/ColumnSettings';
import GradientSettings from '../../components/marketing/GradientSettings';

const defaultThresholds = {
    spend: { optimal: 100, tolerable: 50, mode: 'higher' },
    total_leads: { optimal: 100, tolerable: 30, mode: 'higher' },
    cpl: { optimal: 3, tolerable: 6, mode: 'lower' },
    qualified_percentage: { optimal: 40, tolerable: 20, mode: 'higher' },
    cpql: { optimal: 10, tolerable: 20, mode: 'lower' },
    agendas: { optimal: 20, tolerable: 5, mode: 'higher' },
    cpa: { optimal: 20, tolerable: 40, mode: 'lower' },
    ventas: { optimal: 10, tolerable: 3, mode: 'higher' },
    cpv: { optimal: 50, tolerable: 100, mode: 'lower' },
    cash_collect: { optimal: 500, tolerable: 100, mode: 'higher' },
    roas: { optimal: 3, tolerable: 1, mode: 'higher' },
};

const initialColumns = [
    { id: 'ad_name', label: 'Anuncio', visible: true, align: 'left' },
    { id: 'spend', label: 'Inversión', visible: true, align: 'center' },
    { id: 'total_leads', label: 'Leads', visible: true, align: 'center', color: 'text-blue-400' },
    { id: 'cpl', label: 'CPL', visible: true, align: 'right', color: 'text-blue-400' },
    { id: 'qualified_percentage', label: '% Cual.', visible: true, align: 'center' },
    { id: 'cpql', label: 'CPQL', visible: true, align: 'right', color: 'text-emerald-400' },
    { id: 'agendas', label: 'Agendas', visible: true, align: 'center', color: 'text-emerald-400' },
    { id: 'cpa', label: 'CPA', visible: true, align: 'right', color: 'text-emerald-400' },
    { id: 'ventas', label: 'Ventas', visible: true, align: 'center', color: 'text-amber-400' },
    { id: 'cpv', label: 'CPV', visible: true, align: 'right', color: 'text-amber-400' },
    { id: 'cash_collect', label: 'Cash Col.', visible: true, align: 'right', color: 'text-emerald-400' },
    { id: 'roas', label: 'ROAS', visible: true, align: 'right', color: 'text-indigo-400' },
];



const AdDashboardTab = () => {
    const [stats, setStats] = useState({ ad_stats: [], setter_stats: [] });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedAdId, setSelectedAdId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState('list'); // 'gallery' | 'list'
    const [showChart, setShowChart] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });
    
    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const isAllZero = (stat) => {
        return (stat.spend || 0) === 0 && (stat.total_leads || 0) === 0 && (stat.agendas || 0) === 0 && (stat.ventas || 0) === 0;
    };

    const { filters: hiddenAdsFilters, updateFilter: setHiddenAdsFilters } = usePersistentFilters('hidden_ads_v1', { hidden: [] });
    const hiddenAds = hiddenAdsFilters.hidden || [];
    const [showHiddenAds, setShowHiddenAds] = useState(false);

    const handleToggleHideAd = (e, adId) => {
        e.stopPropagation(); // Evitar abrir el modal del anuncio al hacer clic en el ojo
        if (hiddenAds.includes(adId)) {
            setHiddenAdsFilters({ hidden: hiddenAds.filter(id => id !== adId) });
        } else {
            setHiddenAdsFilters({ hidden: [...hiddenAds, adId] });
        }
    };

    const activeAdStats = showHiddenAds 
        ? stats.ad_stats 
        : stats.ad_stats.filter(stat => !hiddenAds.includes(stat.ad_id));

    // Calcular totales generales usando activeAdStats (después de su inicialización)
    const totals = React.useMemo(() => {
        return activeAdStats.reduce((acc, curr) => {
            acc.spend += (curr.spend || 0);
            acc.total_leads += (curr.total_leads || 0);
            acc.agendas += (curr.agendas || 0);
            acc.ventas += (curr.ventas || 0);
            acc.cash_collect += (curr.cash_collect || 0);

            const qual = Math.round(((curr.qualified_percentage || 0) / 100) * (curr.total_leads || 0));
            acc.total_qualified += qual;
            return acc;
        }, { spend: 0, total_leads: 0, agendas: 0, ventas: 0, total_qualified: 0, cash_collect: 0 });
    }, [activeAdStats]);

    const totalCPL = React.useMemo(() => totals.total_leads > 0 ? (totals.spend / totals.total_leads).toFixed(2) : '0.00', [totals]);
    const totalCPQL = React.useMemo(() => totals.total_qualified > 0 ? (totals.spend / totals.total_qualified).toFixed(2) : '0.00', [totals]);
    const totalCPA = React.useMemo(() => totals.agendas > 0 ? (totals.spend / totals.agendas).toFixed(2) : '0.00', [totals]);
    const totalCPV = React.useMemo(() => totals.ventas > 0 ? (totals.spend / totals.ventas).toFixed(2) : '0.00', [totals]);
    const totalCashCollect = React.useMemo(() => totals.cash_collect.toFixed(2), [totals]);
    const totalROAS = React.useMemo(() => totals.spend > 0 ? (totals.cash_collect / totals.spend).toFixed(2) : '0.00', [totals]);
    const totalQualPercentage = React.useMemo(() => totals.total_leads > 0 ? Math.round((totals.total_qualified / totals.total_leads) * 100) : 0, [totals]);

    const getSortedAdStats = () => {
        let sortableData = [...activeAdStats];
        if (sortConfig.key) {
            sortableData.sort((a, b) => {
                const aZero = isAllZero(a);
                const bZero = isAllZero(b);
                if (aZero && !bZero) return 1;
                if (!aZero && bZero) return -1;

                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];
                
                if (aValue == null) aValue = '';
                if (bValue == null) bValue = '';
                
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                } else if (typeof aValue === 'string') {
                    const parsedA = parseFloat(aValue.replace(/[^0-9.-]+/g,""));
                    if(!isNaN(parsedA)) aValue = parsedA;
                } else if (typeof bValue === 'string') {
                    const parsedB = parseFloat(bValue.replace(/[^0-9.-]+/g,""));
                    if(!isNaN(parsedB)) bValue = parsedB;
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            sortableData.sort((a, b) => {
                const aZero = isAllZero(a);
                const bZero = isAllZero(b);
                if (aZero && !bZero) return 1;
                if (!aZero && bZero) return -1;
                return 0;
            });
        }
        return sortableData;
    };
    
    const { filters: columns, updateFilter: setColumns } = usePersistentFilters('ad_dashboard_columns_v3', initialColumns);
    const visibleColumns = columns.filter(c => c.visible);
    const { filters: colorThresholds, updateFilter: setColorThresholds } = usePersistentFilters('ad_dashboard_thresholds_v1', defaultThresholds);

    
    // Filtros de periodo
    const [period, setPeriod] = useState('this_month');
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
        { id: 'this_month', label: 'Este mes' },
        { id: 'last_month', label: 'Últ. 30 días' },
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
                    
                    <ColumnSettings columns={columns} setColumns={setColumns} />
                    <GradientSettings sortKey={sortConfig.key} thresholds={colorThresholds} setThresholds={setColorThresholds} columns={initialColumns} />
                    
                    {hiddenAds.length > 0 && (
                        <button 
                            onClick={() => setShowHiddenAds(!showHiddenAds)} 
                            className={`text-[10px] font-black uppercase px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 border ${showHiddenAds ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/50'}`}
                        >
                            {showHiddenAds ? <EyeOff size={12} /> : <Eye size={12} />}
                            {showHiddenAds ? 'Ocultar Archivados' : `Mostrar Archivados (${hiddenAds.length})`}
                        </button>
                    )}

                    
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

            {/* Grid de KPIs Generales */}
            {!loading && activeAdStats.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {/* Tarjeta 1: Inversión */}
                    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl hover:border-slate-700/80 transition-all group duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Inversión</span>
                            <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
                                <DollarSign size={14} />
                            </div>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-white italic tracking-tight">${Number(totals.spend).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Inversión Total</span>
                        </div>
                    </div>

                    {/* Tarjeta 2: Leads */}
                    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl hover:border-slate-700/80 transition-all group duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Leads</span>
                            <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
                                <Users size={14} />
                            </div>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-white italic tracking-tight">{totals.total_leads}</p>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                {totalQualPercentage}% Cualificados
                            </span>
                        </div>
                    </div>

                    {/* Tarjeta 3: CPL / CPQL */}
                    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl hover:border-slate-700/80 transition-all group duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Costo x Lead</span>
                            <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 group-hover:scale-110 transition-transform">
                                <TrendingUp size={14} />
                            </div>
                        </div>
                        <div>
                            <p className="text-xl font-black text-white italic tracking-tight">CPL: ${totalCPL}</p>
                            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest block mt-0.5">
                                CPQL: ${totalCPQL}
                            </span>
                        </div>
                    </div>

                    {/* Tarjeta 4: Agendas */}
                    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl hover:border-slate-700/80 transition-all group duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Agendas</span>
                            <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 group-hover:scale-110 transition-transform">
                                <CalendarDays size={14} />
                            </div>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-white italic tracking-tight">{totals.agendas}</p>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                CPA: ${totalCPA}
                            </span>
                        </div>
                    </div>

                    {/* Tarjeta 5: Ventas */}
                    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl hover:border-slate-700/80 transition-all group duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Ventas</span>
                            <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400 group-hover:scale-110 transition-transform">
                                <Activity size={14} />
                            </div>
                        </div>
                        <div>
                            <p className="text-2xl font-black text-white italic tracking-tight">{totals.ventas}</p>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                CPV: ${totalCPV}
                            </span>
                        </div>
                    </div>

                    {/* Tarjeta 6: Cash & ROAS */}
                    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl hover:border-slate-700/80 transition-all group duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Cash Col.</span>
                            <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:scale-110 transition-transform">
                                <DollarSign size={14} />
                            </div>
                        </div>
                        <div>
                            <p className="text-xl font-black text-emerald-400 italic tracking-tight">${Number(totals.cash_collect).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block mt-0.5">
                                ROAS: {totalROAS}x
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Rendimiento por Fuente (Setter) */}
            {!loading && stats.setter_stats && stats.setter_stats.length > 0 && (
                <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800/50 shadow-xl">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2">
                            <Users className="text-slate-400" size={16} />
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Rendimiento por Fuente</h4>
                        </div>
                        <button 
                            onClick={() => setShowChart(!showChart)}
                            className="p-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-700/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                        >
                            {showChart ? (
                                <>
                                    <ChevronUp size={12} /> Ocultar Gráfico
                                </>
                            ) : (
                                <>
                                    <ChevronDown size={12} /> Mostrar Gráfico
                                </>
                            )}
                        </button>
                    </div>
                    {showChart && (
                        <div className="h-48 w-full animate-in fade-in slide-in-from-top-1 duration-200">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={stats.setter_stats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                                        itemStyle={{ fontWeight: 'bold' }}
                                        cursor={{ fill: '#1e293b', opacity: 0.4 }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                    <Bar dataKey="agendas" name="Agendas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    <Bar dataKey="ventas" name="Ventas" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-blue-500" size={28} />
                </div>
            ) : (
                <div className="space-y-6">
                    {activeAdStats.length === 0 ? (
                        <div className="text-center py-20 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                            {hiddenAds.length > 0 ? (
                                <>
                                    <EyeOff size={40} className="mx-auto mb-3 opacity-20 text-indigo-400" />
                                    <p className="font-bold text-slate-500 uppercase tracking-widest text-sm">Todos los anuncios están archivados/ocultos</p>
                                    <button 
                                        onClick={() => setShowHiddenAds(true)}
                                        className="mt-3 text-[10px] font-black uppercase px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition-colors"
                                    >
                                        Mostrar Anuncios Archivados
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Megaphone size={40} className="mx-auto mb-3 opacity-20" />
                                    <p className="font-bold text-slate-500 uppercase tracking-widest text-sm">Sin datos para este periodo</p>
                                </>
                            )}
                        </div>
                    ) : viewMode === 'list' ? (
                        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-x-auto shadow-xl">
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                                <thead className="sticky top-0 z-20">
                                    <tr className="border-b border-slate-800/80 bg-slate-950/50">
                                        {visibleColumns.map(col => (
                                            <th 
                                                key={col.id}
                                                onClick={() => handleSort(col.id)} 
                                                className={`py-4 px-5 text-[10px] font-black uppercase tracking-widest cursor-pointer group/th hover:text-white transition-colors ${
                                                    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                                                } ${col.color || 'text-slate-500'}`}
                                            >
                                                <div className={`flex items-center gap-1.5 ${
                                                    col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : 'justify-start'
                                                }`}>
                                                    {col.label}
                                                    {sortConfig.key === col.id ? (
                                                        sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-blue-400" /> : <ChevronDown size={12} className="text-blue-400" />
                                                    ) : (
                                                        <ArrowUpDown size={12} className="opacity-30 group-hover/th:opacity-100 transition-opacity" />
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {getSortedAdStats().map((stat, index, array) => {
                                        let qualColorStat = "text-slate-400";
                                        if (stat.qualified_percentage >= 50) qualColorStat = "text-emerald-400";
                                        else if (stat.qualified_percentage >= 20) qualColorStat = "text-yellow-400";
                                        else if (stat.total_leads > 0 && stat.qualified_percentage < 20) qualColorStat = "text-red-400";

                                        const zeroRow = isAllZero(stat);
                                        
                                        // Determine background based on rank
                                        const totalValid = array.filter(a => !isAllZero(a)).length;
                                        let rankColor = "hover:bg-slate-800/40"; // fallback
                                        
                                        const colorEmerald = "bg-emerald-500/10 hover:bg-emerald-400/25";
                                        const colorAmber = "bg-amber-500/10 hover:bg-amber-400/25";
                                        const colorRed = "bg-red-500/10 hover:bg-red-400/25";

                                        if (zeroRow) {
                                            rankColor = "bg-red-950/30 hover:bg-red-900/40";
                                        } else if (sortConfig.key && colorThresholds[sortConfig.key]) {
                                            const conf = colorThresholds[sortConfig.key];
                                            const val = parseFloat(stat[sortConfig.key] || 0);
                                            
                                            if (conf.mode === 'higher') {
                                                if (val >= conf.optimal) rankColor = colorEmerald;
                                                else if (val >= conf.tolerable) rankColor = colorAmber;
                                                else rankColor = colorRed;
                                            } else {
                                                if (val <= conf.optimal) rankColor = colorEmerald;
                                                else if (val <= conf.tolerable) rankColor = colorAmber;
                                                else rankColor = colorRed;
                                            }
                                        } else if (totalValid > 0) {
                                            const rankRatio = index / totalValid;
                                            if (rankRatio <= 0.33) {
                                                rankColor = colorEmerald;
                                            } else if (rankRatio <= 0.66) {
                                                rankColor = colorAmber;
                                            } else {
                                                rankColor = colorRed;
                                            }
                                        }

                                        return (
                                            <tr 
                                                key={stat.ad_id} 
                                                onClick={() => { if (stat.ad_id !== 0) { setSelectedAdId(stat.ad_id); setIsModalOpen(true); } }}
                                                className={`group transition-colors ${stat.ad_id !== 0 ? 'cursor-pointer hover:bg-slate-800/40' : 'cursor-default'} ${rankColor} ${zeroRow ? 'opacity-80' : ''}`}
                                            >
                                                {visibleColumns.map(col => {
                                                    let content;
                                                    let color = "text-white";

                                                    if (col.id === 'ad_name') {
                                                        const isAdHidden = hiddenAds.includes(stat.ad_id);
                                                        content = (
                                                            <div className="flex items-center gap-3">
                                                                {stat.ad_id !== 0 ? (
                                                                    <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[9px] font-black text-slate-400">
                                                                        {index + 1}
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[9px] font-black text-emerald-400">
                                                                        ★
                                                                    </div>
                                                                )}
                                                                <div className="flex-1 min-w-0 relative group/tooltip overflow-visible">
                                                                    <div className="flex items-center gap-2">
                                                                        <h4 className={`text-sm font-black uppercase tracking-tight max-w-[200px] truncate ${zeroRow ? 'text-red-400' : 'text-white'}`}>{stat.ad_name}</h4>
                                                                        {stat.ad_id !== 0 && (
                                                                            <button 
                                                                                onClick={(e) => handleToggleHideAd(e, stat.ad_id)}
                                                                                className="p-1 text-slate-500 hover:text-slate-200 transition-colors rounded hover:bg-slate-800"
                                                                                title={isAdHidden ? "Desarchivar / Mostrar anuncio" : "Archivar / Ocultar anuncio"}
                                                                            >
                                                                                {isAdHidden ? <Eye size={12} className="text-indigo-400" /> : <EyeOff size={12} />}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <p className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 ${zeroRow ? 'text-red-500' : 'text-slate-500'}`}>
                                                                        {stat.ad_id !== 0 ? (
                                                                            <>
                                                                                <Activity size={10} className={zeroRow ? 'text-red-400' : 'text-blue-500'} /> #{stat.ad_id}
                                                                            </>
                                                                        ) : (
                                                                            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Desatribuido</span>
                                                                        )}
                                                                        {isAdHidden && <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest ml-1">Archivado</span>}
                                                                    </p>

                                                                    {/* Tooltip para mostrar Campaña y Conjunto de Anuncios */}
                                                                    {(stat.campaign_name || stat.ad_set_name) && (
                                                                        <div className="absolute top-full left-0 mt-1.5 w-64 bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-2xl opacity-0 group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto pointer-events-none transition-all duration-200 z-[100] text-left whitespace-normal leading-normal font-normal normal-case">
                                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Estructura del Anuncio</p>
                                                                            {stat.campaign_name && (
                                                                                <div className="mb-1.5">
                                                                                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-wider block leading-none mb-0.5">Campaña</span>
                                                                                    <span className="text-xs text-white font-bold block">{stat.campaign_name}</span>
                                                                                </div>
                                                                            )}
                                                                            {stat.ad_set_name && (
                                                                                <div>
                                                                                    <span className="text-[8px] font-black text-blue-400 uppercase tracking-wider block leading-none mb-0.5">Conjunto de Anuncios</span>
                                                                                    <span className="text-xs text-white font-bold block">{stat.ad_set_name}</span>
                                                                                </div>
                                                                            )}
                                                                            <div className="absolute bottom-full left-4 border-4 border-transparent border-b-slate-900"></div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                                else if (col.id === 'spend') content = `$${(stat.spend||0).toLocaleString()}`;
                                                                else if (col.id === 'total_leads') content = stat.total_leads;
                                                                else if (col.id === 'cpl') { content = `$${stat.cpl || '0'}`; color = "text-blue-400"; }
                                                                else if (col.id === 'qualified_percentage') { content = `${stat.qualified_percentage}%`; color = qualColorStat; }
                                                                else if (col.id === 'cpql') { content = `$${stat.cpql || '0'}`; color = "text-emerald-400"; }
                                                                else if (col.id === 'agendas') content = stat.agendas || 0;
                                                                else if (col.id === 'cpa') { content = `$${stat.cpa || '0'}`; color = "text-emerald-400"; }
                                                                else if (col.id === 'ventas') content = stat.ventas || 0;
                                                                else if (col.id === 'cpv') { content = `$${stat.cpv || '0'}`; color = "text-amber-400"; }
                                                                else if (col.id === 'cash_collect') { content = `$${stat.cash_collect || '0'}`; color = "text-emerald-400"; }
                                                                else if (col.id === 'roas') { content = `${stat.roas || '0'}x`; color = parseFloat(stat.roas || 0) >= 1 ? 'text-emerald-400' : 'text-red-400'; }

                                                                return (
                                                                    <td key={col.id} className={`py-4 px-5 text-xs font-black ${zeroRow ? 'text-red-300 opacity-60' : color} ${
                                                                        col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                                                                    }`}>
                                                                        {content}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {getSortedAdStats().map((stat, index) => {
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

                                const isAdHidden = hiddenAds.includes(stat.ad_id);
                                    
                                return (
                                        <div 
                                            key={stat.ad_id} 
                                            onClick={() => {
                                                if (stat.ad_id !== 0) {
                                                    setSelectedAdId(stat.ad_id);
                                                    setIsModalOpen(true);
                                                }
                                            }}
                                            className={`bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 hover:bg-slate-800/60 hover:border-blue-500/30 transition-all relative overflow-hidden group shadow-xl ${stat.ad_id !== 0 ? 'cursor-pointer' : 'cursor-default'} ${isAdHidden ? 'opacity-50 grayscale hover:grayscale-0 hover:opacity-100' : ''}`}
                                        >
                                            <div className="relative">
                                                {/* Header */}
                                                <div className="flex items-start justify-between mb-5">
                                                    <div className="flex-1 min-w-0 relative group/tooltip overflow-visible">
                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                            {stat.ad_id !== 0 ? (
                                                                <>
                                                                    <Activity size={10} className="text-blue-500" />
                                                                    Anuncio #{stat.ad_id}
                                                                </>
                                                            ) : (
                                                                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                                                                    ★ Ventas desatribuidas
                                                                </span>
                                                            )}
                                                            {isAdHidden && <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest ml-1">Archivado</span>}
                                                        </p>
                                                        <h4 className="text-sm font-black text-white italic tracking-tight leading-tight line-clamp-2 uppercase">
                                                            {stat.ad_name}
                                                        </h4>

                                                        {/* Tooltip para mostrar Campaña y Conjunto de Anuncios */}
                                                        {(stat.campaign_name || stat.ad_set_name) && (
                                                            <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-2xl opacity-0 group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto pointer-events-none transition-all duration-200 z-[100] text-left whitespace-normal leading-normal font-normal normal-case">
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Estructura del Anuncio</p>
                                                                {stat.campaign_name && (
                                                                    <div className="mb-1.5">
                                                                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-wider block leading-none mb-0.5">Campaña</span>
                                                                        <span className="text-xs text-white font-bold block">{stat.campaign_name}</span>
                                                                    </div>
                                                                )}
                                                                {stat.ad_set_name && (
                                                                    <div>
                                                                        <span className="text-[8px] font-black text-blue-400 uppercase tracking-wider block leading-none mb-0.5">Conjunto de Anuncios</span>
                                                                        <span className="text-xs text-white font-bold block">{stat.ad_set_name}</span>
                                                                    </div>
                                                                )}
                                                                <div className="absolute bottom-full left-4 border-4 border-transparent border-b-slate-900"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                        {stat.ad_id !== 0 ? (
                                                            <>
                                                                <button 
                                                                    onClick={(e) => handleToggleHideAd(e, stat.ad_id)}
                                                                    className="p-1 text-slate-500 hover:text-slate-200 transition-colors rounded hover:bg-slate-800"
                                                                    title={isAdHidden ? "Desarchivar / Mostrar anuncio" : "Archivar / Ocultar anuncio"}
                                                                >
                                                                    {isAdHidden ? <Eye size={12} className="text-indigo-400" /> : <EyeOff size={12} />}
                                                                </button>
                                                                <span className="text-slate-700 text-[10px] font-black tracking-tighter">#{index + 1}</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-emerald-500 text-[10px] font-black tracking-tighter bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">Orgánico</span>
                                                        )}
                                                    </div>
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

                                            {/* Cash Collect & ROAS */}
                                            {(stat.cash_collect > 0 || stat.roas > 0) && (
                                                <div className="mt-3 pt-3 border-t border-slate-800/50 grid grid-cols-2 gap-2">
                                                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-2 text-center">
                                                        <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">Cash Col.</p>
                                                        <p className="text-xs font-black text-emerald-400">${(stat.cash_collect || 0).toLocaleString()}</p>
                                                    </div>
                                                    <div className={`border rounded-xl p-2 text-center ${parseFloat(stat.roas || 0) >= 1 ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                                                        <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${parseFloat(stat.roas || 0) >= 1 ? 'text-indigo-400' : 'text-red-400'}`}>ROAS</p>
                                                        <p className={`text-xs font-black ${parseFloat(stat.roas || 0) >= 1 ? 'text-indigo-400' : 'text-red-400'}`}>{stat.roas || '0'}x</p>
                                                    </div>
                                                </div>
                                            )}
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
