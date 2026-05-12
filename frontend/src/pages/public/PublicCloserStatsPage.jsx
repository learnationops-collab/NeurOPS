import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import {
    Loader2, BarChart3, DollarSign, Phone, Target,
    CalendarDays, Layers, TrendingUp, Users,
    CheckCircle, XCircle, PhoneOff, RefreshCw, Table, List,
    PenTool, Info
} from 'lucide-react';
import CloserAdvancedStatsView from './CloserAdvancedStatsView';
import CloserReportsTable from './CloserReportsTable';
import FunnelChart from '../../components/charts/FunnelChart';
import PublicFinancialSalesPage from './PublicFinancialSalesPage';
import CloserClientsPage from '../closer/clients/ClientsPage';
import FinancialAgendasPage from '../admin/reports/FinancialAgendasPage';

const PublicCloserStatsPage = () => {
    const auth = useAuth();
    const user = auth?.user || { role: 'admin' };
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('general'); // 'general', 'advanced', 'history'
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [closers, setClosers] = useState([]);
    const [filters, setFilters] = useState({
        closer_id: user.role === 'closer' && user.id ? user.id.toString() : '',
        start_date: '',
        end_date: '',
        agg_type: 'sum',
        time_preset: 'last_days',
        custom_days: 7
    });

    // Cálculo de fechas según preset
    useEffect(() => {
        if (filters.time_preset === 'custom') return;
        const now = new Date();
        let start = '';
        let end = now.toISOString().split('T')[0];

        if (filters.time_preset === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(now.getDate() - 1);
            start = yesterday.toISOString().split('T')[0];
            end = start;
        } else if (filters.time_preset === 'last_days') {
            const d = new Date();
            d.setDate(now.getDate() - parseInt(filters.custom_days || 7));
            start = d.toISOString().split('T')[0];
        } else if (filters.time_preset === 'all_time') {
            start = '';
            end = '';
        }

        setFilters(prev => ({ ...prev, start_date: start, end_date: end }));
    }, [filters.time_preset, filters.custom_days]);

    // Fetch closers
    useEffect(() => {
        const fetchClosers = async () => {
            try {
                const res = await api.get('/public/active-closers');
                setClosers(res.data);
            } catch (e) { console.error(e); }
        };
        fetchClosers();
    }, []);

    // Fetch stats
    useEffect(() => {
        if (activeTab === 'history') return; // History handles its own fetch
        fetchStats();
    }, [filters, activeTab]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.closer_id) params.append('closer_id', filters.closer_id);
            if (filters.start_date) params.append('start_date', filters.start_date);
            if (filters.end_date) params.append('end_date', filters.end_date);
            params.append('agg_type', filters.agg_type);

            const res = await api.get(`/public/closer-stats?${params.toString()}`);
            setStats(res.data);
        } catch (err) {
            console.error("Error fetching closer stats:", err);
        } finally {
            setLoading(false);
        }
    };

    // Componentes de UI
    const TabButton = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === id
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                : 'text-slate-500 hover:bg-slate-800'
                }`}
        >
            <Icon size={14} />
            {label}
        </button>
    );

    const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }) => (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 group-hover:opacity-30 transition-opacity ${colorClass.replace('text-', 'bg-')}`} />
            <div className="flex items-start justify-between relative z-10">
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
                    <h3 className="text-3xl font-black text-white italic tracking-tighter">{value}</h3>
                    {subtitle && <p className="text-[9px] text-slate-600 font-bold uppercase mt-1">{subtitle}</p>}
                </div>
                <div className={`p-3 rounded-2xl bg-slate-800 border border-slate-700/50 ${colorClass}`}>
                    <Icon size={18} />
                </div>
            </div>
        </div>
    );

    const ProgressRow = ({ label, percentage, colorClass, absolute, tooltip }) => (
        <div className="space-y-2 relative">
            <div className="flex justify-between items-end">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                    {tooltip && (
                        <div className="relative group/tooltip flex items-center">
                            <Info size={10} className="text-slate-500 cursor-help hover:text-white transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 border border-slate-700 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-[100] shadow-xl">
                                {tooltip}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                            </div>
                        </div>
                    )}
                    {absolute !== undefined && <span className="text-[10px] font-bold text-slate-600 ml-0.5">({absolute})</span>}
                </div>
                <span className={`text-xs font-black ${colorClass}`}>{percentage}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/30">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ${colorClass.replace('text-', 'bg-')}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>
        </div>
    );

    const fmt = (n) => {
        if (n === undefined || n === null) return 0;
        return typeof n === 'number' && !Number.isInteger(n) ? n.toFixed(1) : n;
    };

    const fmtCash = (n) => {
        if (!n) return '$0';
        return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    const funnelData = useMemo(() => {
        if (!stats) return [];
        return [
            { name: 'Slots', value: stats.general.slots, fill: '#8b5cf6' }, // violet
            { name: 'Agendas', value: stats.agendas.totals.scheduled, fill: '#10b981' }, // emerald
            { name: 'Asistencias', value: stats.agendas.totals.attended, fill: '#0ea5e9' }, // sky
            { name: 'Ofertas', value: stats.general.offers_made, fill: '#d946ef' }, // fuchsia
            { name: 'Ventas', value: stats.sales.totals.count, fill: '#f59e0b' } // amber
        ];
    }, [stats]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-violet-900/10 to-transparent pointer-events-none" />

            <div className="max-w-[98%] mx-auto z-10 relative space-y-8">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-slate-800/50">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <Layers className="text-violet-500" size={24} />
                            <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                                Closer <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-amber-500">Dashboard</span>
                            </h1>
                        </div>
                        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em]">NeurOPS Closer Performance Analytics</p>
                    </div>

                    {user.role === 'closer' && (
                        <button
                            onClick={() => navigate('/closer/report')}
                            className="flex items-center gap-2 bg-violet-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-violet-600/20 hover:bg-violet-700 transition-colors"
                        >
                            <PenTool size={16} />
                            Completar Reporte Diario
                        </button>
                    )}
                </div>

                {/* TABS */}
                <div className="flex flex-wrap items-center gap-4 bg-slate-900/40 p-2 rounded-[2rem] border border-slate-800 w-fit">
                    <TabButton id="general" label="Vista General" icon={BarChart3} />
                    <TabButton id="advanced" label="% Rendimiento" icon={Table} />
                    <TabButton id="history" label="Historial de Reportes" icon={List} />
                    <TabButton id="sales_log" label="Registro Ventas" icon={DollarSign} />
                    <TabButton id="agendas_log" label="Registro Agendas" icon={CalendarDays} />
                    <TabButton id="customers" label="Cartera Clientes" icon={Users} />
                </div>

                {/* FILTROS (Comunes para ambas vistas) */}
                <div className="flex flex-wrap items-center gap-6 bg-slate-900/80 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
                    <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Closer / Equipo</label>
                        <select
                            className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-violet-500 transition-all cursor-pointer min-w-[200px]"
                            value={filters.closer_id}
                            onChange={e => setFilters({ ...filters, closer_id: e.target.value })}
                        >
                            <option value="">Todo el Equipo ({filters.agg_type === 'sum' ? 'Suma' : 'Promedio'})</option>
                            {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Periodo</label>
                        <select
                            className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-violet-500 transition-all cursor-pointer min-w-[150px]"
                            value={filters.time_preset}
                            onChange={e => setFilters({ ...filters, time_preset: e.target.value })}
                        >
                            <option value="yesterday">Ayer</option>
                            <option value="last_days">Últimos X días</option>
                            <option value="all_time">Todo el tiempo</option>
                            <option value="custom">Personalizado</option>
                        </select>
                    </div>

                    {filters.time_preset === 'last_days' && (
                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Días</label>
                            <input
                                type="number"
                                className="w-16 bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-violet-500 transition-all font-black text-center"
                                value={filters.custom_days}
                                onChange={e => setFilters({ ...filters, custom_days: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                    )}

                    {filters.time_preset === 'custom' && (
                        <>
                            <div className="flex flex-col gap-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Desde</label>
                                <input
                                    type="date"
                                    className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-violet-500 transition-all font-black"
                                    value={filters.start_date}
                                    onChange={e => setFilters({ ...filters, start_date: e.target.value })}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Hasta</label>
                                <input
                                    type="date"
                                    className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-violet-500 transition-all font-black"
                                    value={filters.end_date}
                                    onChange={e => setFilters({ ...filters, end_date: e.target.value })}
                                />
                            </div>
                        </>
                    )}

                    <div className="flex flex-col gap-2 ml-auto">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 text-right">Agregación</label>
                        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                            <button
                                onClick={() => setFilters({ ...filters, agg_type: 'sum' })}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${filters.agg_type === 'sum' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Suma
                            </button>
                            <button
                                onClick={() => setFilters({ ...filters, agg_type: 'avg' })}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${filters.agg_type === 'avg' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Promedio
                            </button>
                        </div>
                    </div>
                </div>

                {/* CONTENIDO PRINCIPAL */}
                {loading && !stats ? (
                    <div className="flex flex-col items-center justify-center py-40 space-y-4">
                        <Loader2 className="animate-spin text-violet-500" size={48} />
                        <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Sincronizando datos...</p>
                    </div>
                ) : (
                    <>
                        {stats && activeTab === 'general' && (
                            <div className="space-y-10 animate-in fade-in duration-500">

                                {/* GRÁFICO DE EMBUDO REEMPLAZANDO TARJETAS GLOBALES */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">

                                    {/* COL 1: CANTIDADES */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 flex flex-col">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                                                <List size={20} />
                                            </div>
                                            <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Cantidades</h3>
                                        </div>

                                        <div className="space-y-3 flex-1">
                                            <div className="flex justify-between items-center p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                                                <span className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Slots</span>
                                                <span className="text-xl font-black text-white italic tabular-nums">{fmt(stats.general.slots)}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Agendas</span>
                                                <span className="text-xl font-black text-white italic tabular-nums">{fmt(stats.agendas.totals.scheduled)}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                                                <span className="text-[10px] font-black text-sky-500 uppercase tracking-widest">Asistencias</span>
                                                <span className="text-xl font-black text-white italic tabular-nums">{fmt(stats.agendas.totals.attended)}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                                                <span className="text-[10px] font-black text-fuchsia-500 uppercase tracking-widest">Ofertas</span>
                                                <span className="text-xl font-black text-white italic tabular-nums">{fmt(stats.general.offers_made)}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Ventas</span>
                                                <span className="text-xl font-black text-white italic tabular-nums">{fmt(stats.sales.totals.count)}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                                                <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Seg. Hot</span>
                                                <span className="text-xl font-black text-white italic tabular-nums">{fmt(stats.follow_ups?.hot_sent)}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-sky-500/5 rounded-2xl border border-sky-500/10">
                                                <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Seg. Cold</span>
                                                <span className="text-xl font-black text-white italic tabular-nums">{fmt(stats.follow_ups?.cold_sent)}</span>
                                            </div>
                                        </div>

                                        {/* TOTAL CASH EXTRA CARD */}
                                        <div className="pt-4 border-t border-slate-800 mt-auto">
                                            <div className="p-4 bg-emerald-600/10 rounded-2xl border border-emerald-600/20 flex flex-col items-center justify-center space-y-1 relative group/stat overflow-visible">
                                                <div className="flex items-center gap-1.5 relative group/tooltip">
                                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">Total Cash</p>
                                                    <Info size={10} className="text-emerald-500/50 cursor-help" />
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 border border-slate-700 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-[100] shadow-xl">
                                                        Ingreso total en efectivo generado por las ventas en el periodo, excluyendo saldos pendientes de planes de pago.
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                                    </div>
                                                </div>
                                                <p className="text-2xl font-black text-white italic">{fmtCash(stats.sales.totals.cash)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* COL 2: PORCENTAJES */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 flex flex-col">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                                                <TrendingUp size={20} />
                                            </div>
                                            <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Conversiones</h3>
                                        </div>

                                        <div className="space-y-4 flex-1 flex flex-col justify-center">
                                            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col justify-center space-y-2">
                                                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Agendamiento</p>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-slate-400">Slots → Agendas</span>
                                                    <span className="text-lg font-black text-white tabular-nums">
                                                        {stats.general.slots ? ((stats.agendas.totals.scheduled / stats.general.slots) * 100).toFixed(1) : 0}%
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col justify-center space-y-2">
                                                <p className="text-[9px] font-black text-sky-500 uppercase tracking-widest">Show Rate</p>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-slate-400">Agendas → Asistencias</span>
                                                    <span className="text-lg font-black text-white tabular-nums">
                                                        {stats.agendas.totals.scheduled ? ((stats.agendas.totals.attended / stats.agendas.totals.scheduled) * 100).toFixed(1) : 0}%
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col justify-center space-y-2">
                                                <p className="text-[9px] font-black text-fuchsia-500 uppercase tracking-widest">Pitch Rate</p>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-slate-400">Asistencias → Ofertas</span>
                                                    <span className="text-lg font-black text-white tabular-nums">
                                                        {stats.agendas.totals.attended ? ((stats.general.offers_made / stats.agendas.totals.attended) * 100).toFixed(1) : 0}%
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col justify-center space-y-2">
                                                <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Close Rate (Ofertas)</p>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-slate-400">Ofertas → Ventas</span>
                                                    <span className="text-lg font-black text-white tabular-nums">
                                                        {stats.general.offers_made ? ((stats.sales.totals.count / stats.general.offers_made) * 100).toFixed(1) : 0}%
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 flex flex-col justify-center space-y-2 relative group/stat overflow-visible">
                                                <div className="flex items-center gap-1.5 relative group/tooltip">
                                                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Global Win Rate</p>
                                                    <Info size={10} className="text-indigo-400/50 cursor-help" />
                                                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-800 border border-slate-700 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-[100] shadow-xl">
                                                        Tasa de cierre global (Ventas / Asistencias totales). Indica el porcentaje de personas con las que hablaste que terminaron comprando.
                                                        <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-800"></div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-indigo-300">Asistencias → Ventas</span>
                                                    <span className="text-lg font-black text-indigo-400 tabular-nums">
                                                        {stats.agendas.totals.attended ? ((stats.sales.totals.count / stats.agendas.totals.attended) * 100).toFixed(1) : 0}%
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 mt-1">
                                                <div className="p-3 bg-rose-500/5 rounded-2xl border border-rose-500/10 flex flex-col justify-center space-y-1">
                                                    <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest text-center">% Rpta Hot</p>
                                                    <p className="text-sm font-black text-white text-center">
                                                        {stats.follow_ups?.hot_sent ? ((stats.follow_ups.hot_replied / stats.follow_ups.hot_sent) * 100).toFixed(1) : 0}%
                                                    </p>
                                                </div>
                                                <div className="p-3 bg-sky-500/5 rounded-2xl border border-sky-500/10 flex flex-col justify-center space-y-1">
                                                    <p className="text-[8px] font-black text-sky-500 uppercase tracking-widest text-center">% Rpta Cold</p>
                                                    <p className="text-sm font-black text-white text-center">
                                                        {stats.follow_ups?.cold_sent ? ((stats.follow_ups.cold_replied / stats.follow_ups.cold_sent) * 100).toFixed(1) : 0}%
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* COL 3: EMBUDO */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col items-center">
                                        <div className="w-full flex items-center gap-3 mb-8">
                                            <div className="p-3 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-500">
                                                <TrendingUp size={20} />
                                            </div>
                                            <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Visualización</h3>
                                        </div>
                                        <div className="w-full h-[400px]">
                                            <FunnelChart data={funnelData} />
                                        </div>
                                    </div>
                                </div>
                                
                                {/* NUEVA SECCIÓN: LLAMADAS Y CONVERSIONES (Espejo del Reporte) */}
                                <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-500">
                                                <Target size={20} />
                                            </div>
                                            <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Llamadas y Conversiones</h3>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                            <StatCard 
                                                title="Asistencias" 
                                                value={fmt(stats.agendas.totals.attended)} 
                                                icon={CheckCircle} 
                                                colorClass="text-sky-500" 
                                            />
                                            <StatCard 
                                                title="Presentaciones" 
                                                value={fmt(stats.general.offers_made)} 
                                                icon={Layers} 
                                                colorClass="text-fuchsia-500" 
                                            />
                                            <StatCard 
                                                title="Decisores" 
                                                value={fmt(stats.general.decision_makers)} 
                                                icon={Users} 
                                                colorClass="text-indigo-500" 
                                            />
                                            <StatCard 
                                                title="Reagendados" 
                                                value={fmt(stats.general.rescheduled_calls)} 
                                                icon={RefreshCw} 
                                                colorClass="text-amber-500" 
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-800">
                                            <ProgressRow 
                                                label="Pitch Rate (Pres. / Asist.)" 
                                                percentage={stats.percentages.pitch_rate} 
                                                colorClass="text-fuchsia-500" 
                                                absolute={`${fmt(stats.general.offers_made)} / ${fmt(stats.agendas.totals.attended)}`} 
                                            />
                                            <ProgressRow 
                                                label="Decision Maker Rate" 
                                                percentage={stats.percentages.decision_maker_rate} 
                                                colorClass="text-indigo-500" 
                                                absolute={`${fmt(stats.general.decision_makers)} / ${fmt(stats.agendas.totals.attended)}`} 
                                            />
                                            <ProgressRow 
                                                label="Reschedule Rate" 
                                                percentage={stats.percentages.rescheduled_rate} 
                                                colorClass="text-amber-500" 
                                                absolute={`${fmt(stats.general.rescheduled_calls)} / ${fmt(stats.agendas.totals.attended)}`} 
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                                    {/* AGENDAS - Tabla de doble entrada */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                                                    <Phone size={20} />
                                                </div>
                                                <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Agenda Breakdown</h3>
                                            </div>
                                            <div className="text-[10px] font-black text-slate-500 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                                                {stats.metadata.days_analyzed} DÍAS
                                            </div>
                                        </div>

                                        {/* Tabla */}
                                        <div className="bg-slate-800/30 rounded-2xl overflow-hidden">
                                            {/* Header */}
                                            <div className="grid grid-cols-4 gap-0">
                                                <div className="p-3 bg-slate-700/50" />
                                                <div className="p-3 text-center bg-emerald-900/30">
                                                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">1ra</p>
                                                </div>
                                                <div className="p-3 text-center bg-sky-900/30">
                                                    <p className="text-[9px] font-black text-sky-400 uppercase tracking-wider">2da</p>
                                                </div>
                                                <div className="p-3 text-center bg-violet-900/30">
                                                    <p className="text-[9px] font-black text-violet-400 uppercase tracking-wider">Total</p>
                                                </div>
                                            </div>

                                            {/* Rows */}
                                            {[
                                                { label: 'Agendas', key: 'scheduled', icon: CalendarDays },
                                                { label: 'Asistencias', key: 'attended', icon: CheckCircle },
                                                { label: 'No Shows', key: 'no_show', icon: PhoneOff },
                                                { label: 'Reprog.', key: 'rescheduled', icon: RefreshCw },
                                                { label: 'Cancelac.', key: 'canceled', icon: XCircle },
                                            ].map((row, i) => (
                                                <div key={row.key} className={`grid grid-cols-4 gap-0 ${i % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                                                    <div className="p-3 flex items-center gap-2 border-r border-slate-700/30">
                                                        <row.icon size={12} className="text-slate-500" />
                                                        <p className="text-[10px] font-bold text-slate-300">{row.label}</p>
                                                    </div>
                                                    <div className="p-3 text-center border-r border-slate-700/30">
                                                        <p className="text-sm font-black text-emerald-400 tabular-nums">{fmt(stats.agendas.first_call[row.key])}</p>
                                                    </div>
                                                    <div className="p-3 text-center border-r border-slate-700/30">
                                                        <p className="text-sm font-black text-sky-400 tabular-nums">{fmt(stats.agendas.second_call[row.key])}</p>
                                                    </div>
                                                    <div className="p-3 text-center">
                                                        <p className="text-sm font-black text-white tabular-nums">{fmt(stats.agendas.totals[row.key])}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="space-y-4 pt-4 border-t border-slate-800">
                                            <ProgressRow label="Show Rate" percentage={stats.percentages.show_rate} colorClass="text-emerald-500" absolute={`${fmt(stats.agendas.totals.attended)} / ${fmt(stats.agendas.totals.scheduled)}`} tooltip="Porcentaje de asistencias (Total Asistencias / Total Agendados)." />
                                            <ProgressRow label="No Show Rate" percentage={stats.percentages.no_show_rate} colorClass="text-rose-500" absolute={fmt(stats.agendas.totals.no_show)} tooltip="Porcentaje de prospectos agendados que no se presentaron." />
                                            <ProgressRow label="Cancel Rate" percentage={stats.percentages.cancel_rate} colorClass="text-amber-500" absolute={fmt(stats.agendas.totals.canceled)} tooltip="Porcentaje de llamadas que fueron canceladas explícitamente." />
                                        </div>
                                    </div>

                                    {/* VENTAS */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                                                <DollarSign size={20} />
                                            </div>
                                            <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Ventas Breakdown</h3>
                                        </div>

                                        {/* Tabla de ventas */}
                                        <div className="bg-slate-800/30 rounded-2xl overflow-hidden">
                                            {/* Header */}
                                            <div className="grid grid-cols-5 gap-0">
                                                <div className="p-3 bg-slate-700/50" />
                                                <div className="p-3 text-center bg-amber-900/20">
                                                    <p className="text-[8px] font-black text-amber-400 uppercase tracking-wider">Cant.</p>
                                                </div>
                                                <div className="p-3 text-center bg-emerald-900/20">
                                                    <p className="text-[8px] font-black text-emerald-400 uppercase tracking-wider">Cash</p>
                                                </div>
                                                <div className="p-3 text-center bg-sky-900/20">
                                                    <p className="text-[8px] font-black text-sky-400 uppercase tracking-wider">En Llam.</p>
                                                </div>
                                                <div className="p-3 text-center bg-violet-900/20">
                                                    <p className="text-[8px] font-black text-violet-400 uppercase tracking-wider">Cash LL</p>
                                                </div>
                                            </div>

                                            {/* Rows */}
                                            {[
                                                { label: 'PIF', data: stats.sales.pif },
                                                { label: 'Split Pay', data: stats.sales.split },
                                                { label: 'Señas', data: stats.sales.deposit },
                                            ].map((row, i) => (
                                                <div key={row.label} className={`grid grid-cols-5 gap-0 ${i % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                                                    <div className="p-3 flex items-center border-r border-slate-700/30">
                                                        <p className="text-[10px] font-bold text-slate-300">{row.label}</p>
                                                    </div>
                                                    <div className="p-3 text-center border-r border-slate-700/30">
                                                        <p className="text-sm font-black text-amber-400 tabular-nums">{fmt(row.data.count)}</p>
                                                    </div>
                                                    <div className="p-3 text-center border-r border-slate-700/30">
                                                        <p className="text-sm font-black text-emerald-400 tabular-nums">{fmtCash(row.data.cash)}</p>
                                                    </div>
                                                    <div className="p-3 text-center border-r border-slate-700/30">
                                                        <p className="text-sm font-black text-sky-400 tabular-nums">{fmt(row.data.in_call_count)}</p>
                                                    </div>
                                                    <div className="p-3 text-center">
                                                        <p className="text-sm font-black text-violet-400 tabular-nums">{fmtCash(row.data.in_call_cash)}</p>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Totals */}
                                            <div className="grid grid-cols-5 gap-0 bg-slate-700/30 border-t border-slate-600/40">
                                                <div className="p-3 flex items-center border-r border-slate-600/30">
                                                    <p className="text-[10px] font-black text-white uppercase tracking-wider">Total</p>
                                                </div>
                                                <div className="p-3 text-center border-r border-slate-600/30">
                                                    <p className="text-sm font-black text-white tabular-nums">{fmt(stats.sales.totals.count)}</p>
                                                </div>
                                                <div className="p-3 text-center border-r border-slate-600/30">
                                                    <p className="text-sm font-black text-emerald-400 tabular-nums">{fmtCash(stats.sales.totals.cash)}</p>
                                                </div>
                                                <div className="p-3 text-center border-r border-slate-600/30">
                                                    <p className="text-sm font-black text-white tabular-nums">{fmt(stats.sales.totals.in_call_count)}</p>
                                                </div>
                                                <div className="p-3 text-center">
                                                    <p className="text-sm font-black text-violet-400 tabular-nums">{fmtCash(stats.sales.totals.in_call_cash)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Conversion Rates */}
                                        <div className="space-y-4 pt-4 border-t border-slate-800">
                                            <ProgressRow
                                                label="Close Rate (Ventas / Asistencias)"
                                                percentage={stats.percentages.close_rate}
                                                colorClass="text-amber-500"
                                                absolute={`${fmt(stats.sales.totals.count)} / ${fmt(stats.agendas.totals.attended)}`}
                                            />
                                            <ProgressRow
                                                label="Offer → Sale (Ventas / Ofertas)"
                                                percentage={stats.percentages.offer_to_sale}
                                                colorClass="text-fuchsia-500"
                                                absolute={`${fmt(stats.sales.totals.count)} / ${fmt(stats.general.offers_made)}`}
                                            />
                                        </div>

                                        {/* Cash Totals */}
                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                                            <div className="p-5 bg-emerald-600/10 rounded-2xl border border-emerald-600/20 text-center space-y-1">
                                                <p className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">Total Cash Collected</p>
                                                <p className="text-2xl font-black text-white italic">{fmtCash(stats.sales.totals.cash)}</p>
                                            </div>
                                            <div className="p-5 bg-violet-600/10 rounded-2xl border border-violet-600/20 text-center space-y-1">
                                                <p className="text-[8px] font-black text-violet-400 uppercase tracking-tighter">Cash En Llamada</p>
                                                <p className="text-2xl font-black text-white italic">{fmtCash(stats.sales.totals.in_call_cash)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* SEGUIMIENTOS */}
                                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 lg:col-span-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
                                            <RefreshCw size={20} />
                                        </div>
                                        <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Re-engagement Breakdown</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Hot Flow */}
                                        <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[50px] pointer-events-none" />
                                            <div className="flex items-center gap-2 mb-6 border-b border-slate-700/50 pb-4">
                                                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                                <h4 className="text-sm font-black text-rose-400 uppercase tracking-widest">Flujo Caliente</h4>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enviados</span>
                                                    <span className="text-lg font-black text-white tabular-nums">{fmt(stats.follow_ups?.hot_sent)}</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Respondidos</span>
                                                    <span className="text-lg font-black text-white tabular-nums">{fmt(stats.follow_ups?.hot_replied)}</span>
                                                </div>
                                                <ProgressRow
                                                    label="Response Rate (Hot)"
                                                    percentage={stats.follow_ups?.hot_sent ? ((stats.follow_ups.hot_replied / stats.follow_ups.hot_sent) * 100).toFixed(1) : 0}
                                                    colorClass="text-rose-500"
                                                    absolute={fmt(stats.follow_ups?.hot_replied)}
                                                    tooltip="Porcentaje de leads del flujo caliente que respondieron al mensaje."
                                                />
                                            </div>
                                        </div>

                                        {/* Cold Flow */}
                                        <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-[50px] pointer-events-none" />
                                            <div className="flex items-center gap-2 mb-6 border-b border-slate-700/50 pb-4">
                                                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                                                <h4 className="text-sm font-black text-sky-400 uppercase tracking-widest">Flujo Frío</h4>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enviados</span>
                                                    <span className="text-lg font-black text-white tabular-nums">{fmt(stats.follow_ups?.cold_sent)}</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Respondidos</span>
                                                    <span className="text-lg font-black text-white tabular-nums">{fmt(stats.follow_ups?.cold_replied)}</span>
                                                </div>
                                                <ProgressRow
                                                    label="Response Rate (Cold)"
                                                    percentage={stats.follow_ups?.cold_sent ? ((stats.follow_ups.cold_replied / stats.follow_ups.cold_sent) * 100).toFixed(1) : 0}
                                                    colorClass="text-sky-500"
                                                    absolute={fmt(stats.follow_ups?.cold_replied)}
                                                    tooltip="Porcentaje de leads del flujo frío que respondieron al mensaje."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                                        <div className="p-5 bg-blue-600/10 rounded-2xl border border-blue-600/20 text-center space-y-1">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Total Re-engagement Enviados</p>
                                            <p className="text-2xl font-black text-white italic">{fmt(stats.follow_ups?.sent)}</p>
                                        </div>
                                        <div className="p-5 bg-blue-600/10 rounded-2xl border border-blue-600/20 text-center space-y-1">
                                            <p className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">Total Re-engagement Respondidos</p>
                                            <p className="text-2xl font-black text-white italic">{fmt(stats.follow_ups?.replied)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ADVANCED TAB */}
                        {activeTab === 'advanced' && (
                            <div className="animate-in fade-in duration-500">
                                <CloserAdvancedStatsView stats={stats} loading={loading} />
                            </div>
                        )}

                        {/* TAB HISTORIAL DE REPORTES */}
                        {activeTab === 'history' && (
                            <div className="animate-in fade-in duration-500">
                                <CloserReportsTable closers={closers} />
                            </div>
                        )}

                        {/* TAB REGISTRO DE VENTAS */}
                        {activeTab === 'sales_log' && (
                            <div className="animate-in fade-in duration-500 bg-slate-900 border border-slate-800 rounded-[2.5rem] mt-8 overflow-hidden">
                                <PublicFinancialSalesPage />
                            </div>
                        )}

                        {/* TAB REGISTRO AGENDAS */}
                        {activeTab === 'agendas_log' && (
                            <div className="animate-in fade-in duration-500 bg-slate-900 border border-slate-800 rounded-[2.5rem] mt-8 overflow-hidden">
                                <FinancialAgendasPage />
                            </div>
                        )}

                        {/* TAB CARTERA CLIENTES */}
                        {activeTab === 'customers' && (
                            <div className="animate-in fade-in duration-500 bg-slate-950 rounded-[2.5rem] mt-8">
                                <CloserClientsPage />
                            </div>
                        )}

                        {!loading && !stats && activeTab !== 'history' && (
                            <div className="py-40 text-center text-slate-500 font-bold italic uppercase tracking-widest">Sin datos disponibles para este periodo</div>
                        )}
                    </>
                )}

                <div className="text-center pt-20 pb-10">
                    <p className="text-[9px] text-slate-600 font-black tracking-[0.4em] uppercase">NeurOPS Closer Intelligence Board • © 2026 • AI Powered Dashboard</p>
                </div>
            </div>
        </div >
    );
};

export default PublicCloserStatsPage;
