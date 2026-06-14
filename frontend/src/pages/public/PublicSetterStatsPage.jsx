import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import api from '../../services/api';
import {
    Loader2, TrendingUp, BarChart3, PieChart, Users,
    Target, MousePointer2, Link2, CalendarDays,
    Filter, Inbox, MessageSquare, RefreshCw, Layers,
    ChevronRight, ArrowRight, ArrowDownRight, ArrowUpRight,
    Copy, Calendar, Info, ArrowRightLeft, ListChecks, Table,
    Activity, Zap, BarChart, PenTool, HelpCircle, UserX
} from 'lucide-react';
import usePersistentFilters from '../../hooks/usePersistentFilters';
import FunnelChart from '../../components/charts/FunnelChart';
import EvolutionChart from '../../components/charts/EvolutionChart';
import SetterReportsTable from './SetterReportsTable';
import SetterComparisonView from './SetterComparisonView';
import ConversationalStatsTab from './ConversationalStatsTab';
import IncomingLeadsTab from './IncomingLeadsTab';
import LeadUnifiedKPI from '../../components/shared/LeadUnifiedKPI';
import ConfigurableStatCard from '../../components/shared/ConfigurableStatCard';
import StatTooltip from '../../components/shared/StatTooltip';

const PublicSetterStatsPage = () => {
    const auth = useAuth();
    const user = auth?.user || { role: 'admin' };
    const navigate = useNavigate();
    const { filters: tabFilters, updateFilter: setTabFilters } = usePersistentFilters('setter_active_tab', {
        active: 'general'
    });
    const activeTab = tabFilters.active;
    const setActiveTab = (val) => setTabFilters({ active: val });

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [setters, setSetters] = useState([]);

    // Filters for General & Comparison
    const { filters, updateFilter: setFilters } = usePersistentFilters('filters_setter_stats', {
        setter_id: user.role === 'setter' && user.id ? user.id.toString() : '',
        start_date: '',
        end_date: '',
        agg_type: 'sum',
        time_preset: 'last_days', // default to last X days
        custom_days: 7
    });


    // Helper to calculate dates based on preset
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
        } else if (filters.time_preset === 'last_7_days') {
            const d = new Date();
            d.setDate(now.getDate() - 7);
            start = d.toISOString().split('T')[0];
        } else if (filters.time_preset === 'last_30_days') {
            const d = new Date();
            d.setDate(now.getDate() - 30);
            start = d.toISOString().split('T')[0];
        } else if (filters.time_preset === 'this_month') {
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            start = `${y}-${m}-01`;
        } else if (filters.time_preset === 'last_month') {
            const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            
            const yL = firstOfLastMonth.getFullYear();
            const mL = String(firstOfLastMonth.getMonth() + 1).padStart(2, '0');
            start = `${yL}-${mL}-01`;
            
            const yE = lastOfLastMonth.getFullYear();
            const mE = String(lastOfLastMonth.getMonth() + 1).padStart(2, '0');
            const dE = String(lastOfLastMonth.getDate()).padStart(2, '0');
            end = `${yE}-${mE}-${dE}`;
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

    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const sRes = await api.get('/public/active-setters');
                setSetters(sRes.data);
            } catch (e) {
                console.error(e);
            }
        };
        fetchInitial();
    }, []);

    const [compare, setCompare] = useState(false);

    useEffect(() => {
        if (activeTab === 'general') fetchStats();
    }, [filters, activeTab, compare]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.setter_id) params.append('setter_id', filters.setter_id);
            if (filters.start_date) params.append('start_date', filters.start_date);
            if (filters.end_date) params.append('end_date', filters.end_date);
            params.append('agg_type', filters.agg_type);
            if (compare) params.append('compare', 'true');

            const res = await api.get(`/public/setter-stats?${params.toString()}`);
            setStats(res.data);
        } catch (err) {
            console.error("Error fetching stats:", err);
        } finally {
            setLoading(false);
        }
    };

    // UI Components
    const TabButton = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-500 hover:bg-slate-800'
                }`}
        >
            <Icon size={14} />
            {label}
        </button>
    );

    const div = (n, d) => (d > 0 ? Number(((n / d) * 100).toFixed(2)) : 0);

    const renderComparisonSubdata = (current, previous) => {
        if (!compare || !stats?.comparison) return null;
        const curVal = Number(current || 0);
        const prevVal = Number(previous || 0);

        if (prevVal === 0) {
            return (
                <div className="flex items-center gap-1.5 mt-1 text-xs font-black uppercase text-slate-500 justify-end">
                    <span>Ant: {prevVal}</span>
                    {curVal > 0 && <span className="text-emerald-400 font-bold">(+100%)</span>}
                </div>
            );
        }

        const diff = ((curVal - prevVal) / prevVal) * 100;
        const sign = diff > 0 ? '+' : '';
        const color = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-slate-500';

        return (
            <div className="flex items-center gap-1.5 mt-1 text-xs font-black uppercase text-slate-500 justify-end">
                <span>Ant: {prevVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                <span className={`${color} font-bold`}>({sign}{diff.toFixed(1)}%)</span>
            </div>
        );
    };

    const renderComparisonSubdataLeft = (current, previous) => {
        if (!compare || !stats?.comparison) return null;
        const curVal = Number(current || 0);
        const prevVal = Number(previous || 0);

        if (prevVal === 0) {
            return (
                <div className="flex items-center gap-1.5 mt-1 text-xs font-black uppercase text-slate-500">
                    <span>Ant: {prevVal}</span>
                    {curVal > 0 && <span className="text-emerald-400 font-bold">(+100%)</span>}
                </div>
            );
        }

        const diff = ((curVal - prevVal) / prevVal) * 100;
        const sign = diff > 0 ? '+' : '';
        const color = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-slate-500';

        return (
            <div className="flex items-center gap-1.5 mt-1 text-xs font-black uppercase text-slate-500">
                <span>Ant: {prevVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                <span className={`${color} font-bold`}>({sign}{diff.toFixed(1)}%)</span>
            </div>
        );
    };

    const MetricSection = ({ title, icon: Icon, children, colorClass = "text-indigo-600" }) => (
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-8 shadow-xl relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-64 h-64 blur-[120px] opacity-10 group-hover:opacity-20 transition-opacity bg-indigo-500`} />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl bg-slate-800 border border-slate-700/50 ${colorClass}`}>
                        <Icon size={20} />
                    </div>
                    <h3 className="text-xl font-black text-white italic tracking-tight uppercase">{title}</h3>
                </div>
            </div>

            <div className="relative z-10">
                {children}
            </div>
        </div>
    );

    const StatCard = ({ title, value, percentage, icon: Icon, colorClass, subtitle, trend = null, tooltipInfo }) => (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative group hover:shadow-indigo-500/5 transition-all">
            {/* Contenedor del brillo de fondo con overflow-hidden para no salirse de los bordes redondeados */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div className={`absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 group-hover:opacity-30 transition-opacity bg-indigo-500`} />
            </div>
            <div className="flex items-start justify-between relative z-10">
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
                        {tooltipInfo && (
                            <StatTooltip label={title} calculation={tooltipInfo}>
                                <HelpCircle size={12} className="text-slate-400 cursor-help hover:text-indigo-500 transition-colors" />
                            </StatTooltip>
                        )}
                    </div>
                    <h3 className="text-3xl font-black text-white italic tracking-tighter">{value}</h3>
                    {percentage !== undefined && (
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${colorClass} bg-opacity-10 border border-current/30`}>
                                {percentage}%
                            </span>
                        </div>
                    )}
                    {subtitle && <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">{subtitle}</p>}
                </div>
                <div className={`p-3 rounded-2xl bg-slate-800 border border-slate-700/50 ${colorClass}`}>
                    <Icon size={18} />
                </div>
            </div>
        </div>
    );

    const timeSeriesData = useMemo(() => {
        if (!stats?.time_series) return [];
        return stats.time_series.map(day => ({
            ...day,
            op_res_rate: div(day.op_res, day.op_sub),
            qual_fur_rate: div(day.fur_q, day.fu_q),
            op_to_ag: div(day.fun_agenda, day.op_res),
            off_to_ag: div(day.fun_agenda, day.fun_offer),
            link_to_ag: div(day.fun_agenda, day.fun_link),
        }));
    }, [stats]);

    const funnelData = useMemo(() => {
        if (!stats) return [];
        return [
            { name: 'Cualificación', value: stats.totals.funnel_qualification, fill: '#8b5cf6' }, // violet
            { name: 'Dolor', value: stats.totals.funnel_pain, fill: '#3b82f6' }, // indigo/blue
            { name: 'Oferta', value: stats.totals.funnel_offer, fill: '#d946ef' }, // fuchsia
            { name: 'Link', value: stats.totals.funnel_link, fill: '#6366f1' }, // sky (actually closer to indigo)
            { name: 'Agenda', value: stats.totals.funnel_agenda, fill: '#10b981' } // emerald
        ];
    }, [stats]);

    const FunnelSubContainer = ({ title, icon: Icon, children }) => (
        <div className="bg-slate-950/50 rounded-3xl p-6 border border-slate-800 flex flex-col gap-6">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                <Icon size={16} className="text-indigo-500" />
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</h4>
            </div>
            {children}
        </div>
    );

    const MiniRow = ({ label, value, subValue, colorClass, tooltipInfo }) => (
        <div className="flex justify-between items-center bg-slate-950/50 p-4 rounded-2xl border border-slate-800 shadow-sm overflow-visible">
            <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">{label}</span>
                    {tooltipInfo && (
                        <StatTooltip label={label} calculation={tooltipInfo}>
                            <HelpCircle size={10} className="text-slate-500 cursor-help hover:text-indigo-500 transition-colors" />
                        </StatTooltip>
                    )}
                </div>
                <span className={`text-xl font-black italic tracking-tighter ${colorClass}`}>{value}</span>
            </div>
            {subValue && (
                <div className="text-right">
                    <span className="text-xs font-black text-white bg-slate-800 px-2 py-1 rounded-lg">{subValue}</span>
                </div>
            )}
        </div>
    );

    const SetterPerformanceTable = ({ data }) => (
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-xl mt-10">
            <div className="p-8 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 shadow-sm">
                        <Users size={20} />
                    </div>
                    <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Rendimiento por Setter</h3>
                </div>
            </div>
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-950/50">
                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Setter</th>
                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Reportes</th>
                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">% Reportado</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-indigo-500/5 transition-colors">
                            <td className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm" />
                                    <span className="text-xs uppercase font-black tracking-wider text-slate-300">{row.setter_name}</span>
                                </div>
                            </td>
                            <td className="p-6 text-center font-black text-white text-lg italic tabular-nums">
                                <StatTooltip
                                    label="Días Reportados"
                                    value={row.reports_count}
                                    calculation="Cantidad de reportes diarios completados por el setter en el periodo seleccionado."
                                >
                                    {row.reports_count}
                                </StatTooltip>
                            </td>
                            <td className="p-6 text-center">
                                <div className="flex flex-col items-center gap-2">
                                    <span className="font-black text-indigo-400 text-lg italic tabular-nums">
                                        <StatTooltip
                                            label="Cumplimiento de Reportes"
                                            value={`${row.report_rate}%`}
                                            calculation="Porcentaje de días reportados del total de días posibles del periodo. Fórmula: (Días Reportados / Días del Periodo) * 100"
                                        >
                                            {row.report_rate}%
                                        </StatTooltip>
                                    </span>
                                    <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden p-0.5">
                                        <div 
                                            className="h-full bg-indigo-500 rounded-full transition-all duration-1000 shadow-sm" 
                                            style={{ width: `${row.report_rate}%` }}
                                        />
                                    </div>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 relative overflow-hidden">
            {/* Ambient Background elements */}
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />
            <div className="absolute bottom-[-100px] left-[-100px] w-96 h-96 bg-indigo-900/10 rounded-full blur-[100px] opacity-20 pointer-events-none" />

            <div className="max-w-[98%] mx-auto z-10 relative space-y-8">
                {/* TOP HEADER */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-slate-800/50">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
                                <Layers className="text-white" size={24} />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                                Performance <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-teal-400">Center</span>
                            </h1>
                        </div>
                        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] ml-1">NeurOPS High Performance Analytics</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {user.role === 'setter' && (
                            <button
                                onClick={() => navigate('/setter/report')}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-colors"
                            >
                                <PenTool size={16} />
                                Completar Reporte Diario
                            </button>
                        )}
                    </div>
                </div>

                {/* TABS */}
                <div className="flex flex-wrap items-center gap-4 bg-slate-900/40 p-2 rounded-[2rem] border border-slate-800 w-fit shadow-sm backdrop-blur-sm">
                    <TabButton id="general" label="Vista General" icon={BarChart3} />
                    {user.role !== 'setter' && (
                        <TabButton id="comparison" label="Comparación" icon={ArrowRightLeft} />
                    )}
                    <TabButton id="reports" label="Registros" icon={Table} />
                    <TabButton id="conv_stats" label="Rend. Conversacional" icon={MessageSquare} />
                    <TabButton id="incoming_leads" label="Leads Entrantes" icon={Users} />
                </div>

                {/* FILTERS BAR (Only for General) */}
                {activeTab === 'general' && (
                    <div className="flex flex-wrap items-center gap-6 bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl backdrop-blur-md">
                        {user.role !== 'setter' && (
                            <div className="flex flex-col gap-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Setter / Equipo</label>
                                <select
                                    className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 transition-all cursor-pointer min-w-[200px]"
                                    value={filters.setter_id}
                                    onChange={e => setFilters({ ...filters, setter_id: e.target.value })}
                                >
                                    <option value="">Todo el Equipo</option>
                                    {setters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Periodo</label>
                            <select
                                className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 transition-all cursor-pointer min-w-[150px]"
                                value={filters.time_preset}
                                onChange={e => setFilters({ ...filters, time_preset: e.target.value })}
                            >
                                <option value="yesterday">Ayer</option>
                                <option value="last_7_days">Últimos 7 días</option>
                                <option value="last_30_days">Últimos 30 días</option>
                                <option value="this_month">Este mes</option>
                                <option value="last_month">Mes anterior</option>
                                <option value="last_days">Últimos X días</option>
                                <option value="all_time">Todo el tiempo</option>
                                <option value="custom">Personalizado</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Accesos Rápidos</label>
                            <div className="flex flex-wrap gap-2 min-h-[38px] items-center">
                                {[
                                    { id: 'yesterday', label: 'Ayer' },
                                    { id: 'last_7_days', label: 'Últimos 7 días' },
                                    { id: 'last_30_days', label: 'Últimos 30 días' },
                                    { id: 'this_month', label: 'Este mes' },
                                    { id: 'last_month', label: 'Mes anterior' }
                                ].map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setFilters({ ...filters, time_preset: p.id })}
                                        className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                            filters.time_preset === p.id
                                                ? 'bg-indigo-650 text-white shadow-md shadow-indigo-650/30'
                                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750 border border-slate-750'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {filters.time_preset === 'last_days' && (
                            <div className="flex flex-col gap-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Días</label>
                                <input
                                    type="number"
                                    className="w-16 bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 transition-all font-black text-center"
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
                                        className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 transition-all font-black"
                                        value={filters.start_date}
                                        onChange={e => setFilters({ ...filters, start_date: e.target.value })}
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Hasta</label>
                                    <input
                                        type="date"
                                        className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 transition-all font-black"
                                        value={filters.end_date}
                                        onChange={e => setFilters({ ...filters, end_date: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        {/* Switch de Comparación */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Comparación</label>
                            <div className="flex items-center gap-2.5 bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 min-h-[38px]">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Comparar</span>
                                <button
                                    onClick={() => setCompare(!compare)}
                                    type="button"
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                                        compare ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-slate-900 border border-slate-750'
                                    }`}
                                >
                                    <motion.span
                                        layout
                                        className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md"
                                        animate={{ x: compare ? 16 : 2 }}
                                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB: VISTA GENERAL --- */}
                {activeTab === 'general' && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {loading && !stats ? (
                            <div className="flex flex-col items-center justify-center py-40 space-y-4">
                                <Loader2 className="animate-spin text-indigo-500" size={48} />
                                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Sincronizando datos...</p>
                            </div>
                        ) : stats ? (
                            <>
                                {/* GRID PRINCIPAL */}
                                <div className="space-y-6">
                                    <LeadUnifiedKPI stats={stats} />
                                    {/* 1. TOP ROW: 4 TARJETAS DE IMPACTO Y RENDIMIENTO OPERACIONAL DEL SETTER */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
                                        
                                        {/* TARJETA 1: AGENDAS TOTALES (Volumen Final) */}
                                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative group hover:shadow-indigo-500/5 transition-all">
                                            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                                                <div className="absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 group-hover:opacity-30 transition-opacity bg-emerald-500" />
                                            </div>
                                            <div className="flex items-start justify-between relative z-10">
                                                <div className="space-y-1 text-left">
                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Agendas Generadas</p>
                                                    <h3 className="text-4xl font-black text-white italic tracking-tighter">
                                                        <StatTooltip
                                                            label="Agendas Generadas"
                                                            value={stats.totals.funnel_agenda}
                                                            calculation="Total de citas agendadas por el setter en el periodo seleccionado."
                                                        >
                                                            {stats.totals.funnel_agenda}
                                                        </StatTooltip>
                                                    </h3>
                                                    <div className="flex items-center gap-1.5 mt-2">
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30">
                                                            <StatTooltip
                                                                label="Conversión de Agendas sobre Leads"
                                                                value={`${div(stats.totals.funnel_agenda, stats.totals.leads)}%`}
                                                                calculation="Porcentaje de leads cualificados que terminaron con una cita agendada. Fórmula: (Agendas / Leads Cualificados) * 100"
                                                            >
                                                                {div(stats.totals.funnel_agenda, stats.totals.leads)}% conv.
                                                            </StatTooltip>
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase">sobre leads reales</span>
                                                    </div>
                                                    {renderComparisonSubdataLeft(stats.totals.funnel_agenda, stats.comparison?.totals?.funnel_agenda)}
                                                </div>
                                                <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700/50 text-emerald-400 shrink-0">
                                                    <CalendarDays size={18} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* TARJETA 2: EFICACIA A CITA (Conversión de Cualificados) */}
                                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative group hover:shadow-indigo-500/5 transition-all">
                                            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                                                <div className="absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 group-hover:opacity-30 transition-opacity bg-violet-500" />
                                            </div>
                                            <div className="flex items-start justify-between relative z-10">
                                                <div className="space-y-1 text-left">
                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Eficacia a Cita</p>
                                                    <h3 className="text-4xl font-black text-white italic tracking-tighter">
                                                        <StatTooltip
                                                            label="Eficacia a Cita"
                                                            value={`${div(stats.totals.funnel_agenda, stats.totals.funnel_qualification)}%`}
                                                            calculation="Porcentaje de leads cualificados que resultaron en agendamiento. Fórmula: (Agendas / Leads Cualificados) * 100"
                                                        >
                                                            {div(stats.totals.funnel_agenda, stats.totals.funnel_qualification)}%
                                                        </StatTooltip>
                                                    </h3>
                                                    <div className="flex items-center gap-1.5 mt-2">
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-black text-violet-400 bg-violet-500/10 border border-violet-500/30">
                                                            <StatTooltip
                                                                label="Conversión Openings a Cita"
                                                                value={`${stats.percentages.conversions_to_agenda.opening_to_agenda}%`}
                                                                calculation="Porcentaje de conversaciones iniciadas (openings con respuesta) que terminaron en cita. Fórmula: (Agendas / Respondidos) * 100"
                                                            >
                                                                {stats.percentages.conversions_to_agenda.opening_to_agenda}%
                                                            </StatTooltip>
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase">de openings a cita</span>
                                                    </div>
                                                    {renderComparisonSubdataLeft(
                                                        div(stats.totals.funnel_agenda, stats.totals.funnel_qualification),
                                                        div(stats.comparison?.totals?.funnel_agenda, stats.comparison?.totals?.funnel_qualification)
                                                    )}
                                                </div>
                                                <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700/50 text-violet-400 shrink-0">
                                                    <Target size={18} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* TARJETA 3: TASA DE REACTIVACIÓN (Follow-Up Response) */}
                                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative group hover:shadow-indigo-500/5 transition-all">
                                            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                                                <div className="absolute top-0 right-0 w-24 h-24 blur-[65px] opacity-10 group-hover:opacity-30 transition-opacity bg-indigo-500" />
                                            </div>
                                            <div className="flex items-start justify-between relative z-10">
                                                <div className="space-y-1 text-left">
                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tasa Follow-Up</p>
                                                    <h3 className="text-4xl font-black text-white italic tracking-tighter">
                                                        <StatTooltip
                                                            label="Tasa Follow-Up"
                                                            value={`${stats.percentages.rates.total_fur}%`}
                                                            calculation="Porcentaje de efectividad general de los mensajes de seguimiento (follow-ups) que obtuvieron respuesta. Fórmula: (Respuestas Follow-Up / Seguimientos Enviados) * 100"
                                                        >
                                                            {stats.percentages.rates.total_fur}%
                                                        </StatTooltip>
                                                    </h3>
                                                    <div className="flex items-center gap-1.5 mt-2">
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/30">
                                                            <StatTooltip
                                                                label="Follow-Up Respondidos / Enviados"
                                                                value={`${stats.totals.total_fu_r} / ${stats.totals.total_fu_s}`}
                                                                calculation="Respuestas obtenidas sobre el total de mensajes de seguimiento enviados."
                                                            >
                                                                {stats.totals.total_fu_r} / {stats.totals.total_fu_s}
                                                            </StatTooltip>
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase">respondidos</span>
                                                    </div>
                                                    {renderComparisonSubdataLeft(
                                                        stats.percentages.rates.total_fur,
                                                        stats.comparison?.percentages?.rates?.total_fur
                                                    )}
                                                </div>
                                                <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700/50 text-indigo-400 shrink-0">
                                                    <RefreshCw size={18} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* TARJETA 4: CONVERSIÓN FINAL (Cita sobre Entrantes) */}
                                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative group hover:shadow-indigo-500/5 transition-all">
                                            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                                                <div className="absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 group-hover:opacity-30 transition-opacity bg-amber-500" />
                                            </div>
                                            <div className="flex items-start justify-between relative z-10">
                                                <div className="space-y-1 text-left">
                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Conversión Final</p>
                                                    <h3 className="text-4xl font-black text-white italic tracking-tighter">
                                                        <StatTooltip
                                                            label="Conversión Final"
                                                            value={`${div(stats.totals.funnel_agenda, stats.totals.entrantes)}%`}
                                                            calculation="Porcentaje de citas agendadas respecto al total de leads entrantes. Fórmula: (Agendas / Entrantes) * 100"
                                                        >
                                                            {div(stats.totals.funnel_agenda, stats.totals.entrantes)}%
                                                        </StatTooltip>
                                                    </h3>
                                                    <div className="flex items-center gap-1.5 mt-2">
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-black text-amber-400 bg-amber-500/10 border border-emerald-500/30">
                                                            <StatTooltip
                                                                label="Total Agendas"
                                                                value={stats.totals.funnel_agenda}
                                                                calculation="Cantidad total de citas agendadas por el setter."
                                                            >
                                                                Agendas: {stats.totals.funnel_agenda}
                                                            </StatTooltip>
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-black text-slate-400 bg-slate-500/10 border border-slate-500/30">
                                                            <StatTooltip
                                                                label="Total Entrantes"
                                                                value={stats.totals.entrantes}
                                                                calculation="Cantidad total de contactos iniciados/entrantes."
                                                            >
                                                                Inbox: {stats.totals.entrantes}
                                                            </StatTooltip>
                                                        </span>
                                                    </div>
                                                    {renderComparisonSubdataLeft(
                                                        div(stats.totals.funnel_agenda, stats.totals.entrantes),
                                                        div(stats.comparison?.totals?.funnel_agenda, stats.comparison?.totals?.entrantes)
                                                    )}
                                                </div>
                                                <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700/50 text-amber-400 shrink-0">
                                                    <Target size={18} />
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>

                                {/* SECCIÓN: ANÁLISIS PROFUNDO DEL EMBUDO Y PÉRDIDAS */}
                                <MetricSection title="Análisis del Embudo y Conversión" icon={TrendingUp}>
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                        
                                        {/* COLUMNA 1: TABLA DE PÉRDIDA DE PASOS DEL EMBUDO (Ancha) */}
                                        <div className="lg:col-span-5 bg-slate-950/50 rounded-3xl p-6 border border-slate-800 flex flex-col gap-6 text-left relative overflow-hidden">
                                            <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                                                <ListChecks size={16} className="text-indigo-400" />
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Matriz de Pérdida de Pasos</h4>
                                            </div>
                                            
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse text-xs">
                                                    <thead>
                                                        <tr className="border-b border-slate-800 text-slate-500 font-black uppercase text-[10px]">
                                                            <th className="pb-3 tracking-wider">Etapa del Embudo</th>
                                                            <th className="pb-3 text-center tracking-wider">Leads</th>
                                                            <th className="pb-3 text-center tracking-wider">Paso a Paso</th>
                                                            <th className="pb-3 text-right tracking-wider">% Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800/40">
                                                        {[
                                                            { label: '1. Entrantes (Inbox)', value: stats.totals.entrantes, conv: '-', pct: 100, color: 'bg-rose-500' },
                                                            { label: '2. Cualificados', value: stats.totals.funnel_qualification, conv: `${div(stats.totals.funnel_qualification, stats.totals.entrantes)}%`, pct: div(stats.totals.funnel_qualification, stats.totals.entrantes), color: 'bg-violet-500' },
                                                            { label: '3. Dolor Identificado', value: stats.totals.funnel_pain, conv: `${stats.percentages.funnel_evolution.qual_to_pain}%`, pct: div(stats.totals.funnel_pain, stats.totals.entrantes), color: 'bg-blue-500' },
                                                            { label: '4. Oferta Presentada', value: stats.totals.funnel_offer, conv: `${stats.percentages.funnel_evolution.pain_to_offer}%`, pct: div(stats.totals.funnel_offer, stats.totals.entrantes), color: 'bg-fuchsia-500' },
                                                            { label: '5. Link de Calendario', value: stats.totals.funnel_link, conv: `${stats.percentages.funnel_evolution.offer_to_link}%`, pct: div(stats.totals.funnel_link, stats.totals.entrantes), color: 'bg-indigo-500' },
                                                            { label: '6. Cita Agendada', value: stats.totals.funnel_agenda, conv: `${stats.percentages.funnel_evolution.link_to_agenda}%`, pct: div(stats.totals.funnel_agenda, stats.totals.entrantes), color: 'bg-emerald-500' },
                                                        ].map((row, idx) => {
                                                            const calculations = {
                                                                0: { v: "Total de leads ingresados en el periodo.", c: "Suma simple de leads entrantes.", p: "Porcentaje base de entrada (100%)." },
                                                                1: { v: "Leads calificados en la etapa inicial.", c: "(Cualificados / Entrantes) * 100", p: "Porcentaje de cualificación sobre el total de entrantes." },
                                                                2: { v: "Leads con dolor o necesidad identificada.", c: "(Dolor / Cualificados) * 100", p: "Porcentaje de dolor sobre el total de entrantes." },
                                                                3: { v: "Leads a los que se les presentó oferta comercial.", c: "(Ofertas / Dolor) * 105", p: "Porcentaje de ofertas sobre el total de entrantes." },
                                                                4: { v: "Leads que recibieron el link del calendario.", c: "(Links / Ofertas) * 100", p: "Porcentaje de links sobre el total de entrantes." },
                                                                5: { v: "Leads que agendaron cita final.", c: "(Agendas / Links) * 100", p: "Porcentaje de agendas sobre el total de entrantes." }
                                                            };
                                                            const calc = calculations[idx] || { v: "", c: "", p: "" };
                                                            return (
                                                                <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                                    <td className="py-3.5 font-bold text-slate-300 uppercase tracking-wider text-xs">{row.label}</td>
                                                                    <td className="py-3.5 text-center font-black text-white tabular-nums italic text-base">
                                                                        <StatTooltip
                                                                            label={row.label}
                                                                            value={row.value}
                                                                            calculation={calc.v}
                                                                        >
                                                                            {row.value}
                                                                        </StatTooltip>
                                                                    </td>
                                                                    <td className="py-3.5 text-center tabular-nums">
                                                                        <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 font-bold text-slate-400 text-xs">
                                                                            {row.conv === '-' ? '-' : (
                                                                                <StatTooltip
                                                                                    label={`Conversión Paso a Paso: ${row.label}`}
                                                                                    value={row.conv}
                                                                                    calculation={calc.c}
                                                                                >
                                                                                    {row.conv}
                                                                                </StatTooltip>
                                                                            )}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-3.5 text-right">
                                                                        <div className="flex flex-col items-end gap-1">
                                                                            <span className="font-black text-white italic text-xs">
                                                                                <StatTooltip
                                                                                    label={`Porcentaje Total: ${row.label}`}
                                                                                    value={`${row.pct}%`}
                                                                                    calculation={calc.p}
                                                                                >
                                                                                    {row.pct}%
                                                                                </StatTooltip>
                                                                            </span>
                                                                            <div className="w-20 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                                                                <div className={`h-full ${row.color} rounded-full`} style={{ width: `${row.pct}%` }} />
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* COLUMNA 2: MATRIZ DE TENACIDAD DE SEGUIMIENTO (Delgada) */}
                                        <div className="lg:col-span-4 bg-slate-950/50 rounded-3xl p-6 border border-slate-800 flex flex-col gap-6 text-left">
                                            <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                                                <RefreshCw size={16} className="text-indigo-400 animate-spin-slow" />
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Matriz de Tenacidad en Seguimiento</h4>
                                            </div>
                                            
                                            <div className="space-y-3.5">
                                                {[
                                                    { label: "Seguimiento en Cualificación (Qual FU)", s: stats.totals.qualification_fu, r: stats.totals.qualification_fur, rate: stats.percentages.rates.qualification_fur, color: 'text-violet-400' },
                                                    { label: "Seguimiento en Dolor (Pain FU)", s: stats.totals.pain_fu, r: stats.totals.pain_fur, rate: stats.percentages.rates.pain_fur, color: 'text-blue-400' },
                                                    { label: "Seguimiento en Oferta (Offer FU)", s: stats.totals.offer_fu, r: stats.totals.offer_fur, rate: stats.percentages.rates.offer_fur, color: 'text-fuchsia-400' },
                                                    { label: "Seguimiento en Link (Link FU)", s: stats.totals.link_fu, r: stats.totals.link_fur, rate: stats.percentages.rates.link_fur, color: 'text-indigo-400' },
                                                    { label: "Seguimiento post-Agenda (Agenda FU)", s: stats.totals.agenda_fu, r: stats.totals.agenda_fur, rate: stats.percentages.rates.agenda_fur, color: 'text-emerald-400' },
                                                ].map((fu, idx) => {
                                                    const semaphoricColor = fu.rate >= 40 
                                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                                        : fu.rate >= 15 
                                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20';

                                                    return (
                                                        <div key={idx} className="flex justify-between items-center bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 shadow-sm">
                                                            <div className="flex flex-col text-left space-y-1">
                                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{fu.label}</span>
                                                                <span className="text-[10px] font-black text-slate-300">
                                                                    Env: <span className="text-white tabular-nums">
                                                                        <StatTooltip
                                                                            label={`Enviados - ${fu.label}`}
                                                                            value={fu.s}
                                                                            calculation="Cantidad de mensajes de seguimiento enviados en esta etapa."
                                                                        >
                                                                            {fu.s}
                                                                        </StatTooltip>
                                                                    </span> • Resp: <span className="text-white tabular-nums">
                                                                        <StatTooltip
                                                                            label={`Respondidos - ${fu.label}`}
                                                                            value={fu.r}
                                                                            calculation="Cantidad de respuestas recibidas de los seguimientos de esta etapa."
                                                                        >
                                                                            {fu.r}
                                                                        </StatTooltip>
                                                                    </span>
                                                                </span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className={`px-2 py-1 rounded-xl text-[10px] font-black tabular-nums ${semaphoricColor}`}>
                                                                    <StatTooltip
                                                                        label={`Tasa Respuesta - ${fu.label}`}
                                                                        value={`${fu.rate}%`}
                                                                        calculation="Eficacia del seguimiento en esta etapa específica. Fórmula: (Respondidos / Enviados) * 100"
                                                                    >
                                                                        {fu.rate}%
                                                                    </StatTooltip>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* COLUMNA 3: VISUALIZACIÓN GRÁFICA DEL EMBUDO */}
                                        <div className="lg:col-span-3 bg-slate-950/50 rounded-3xl p-6 border border-slate-800 flex flex-col gap-6 text-left">
                                            <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                                                <PieChart size={16} className="text-indigo-400" />
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gráfico del Embudo</h4>
                                            </div>
                                            <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
                                                <FunnelChart data={funnelData} />
                                            </div>
                                        </div>

                                    </div>


                                    {/* SECCIÓN: HISTÓRICO DENTRO DE FUNNEL */}
                                    <div className="bg-slate-900 rounded-[2.5rem] p-8 mt-10 border border-slate-800 shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-64 h-64 blur-[120px] opacity-20 bg-indigo-500" />
                                        <div className="flex items-center gap-2 mb-8 relative z-10">
                                            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                                <TrendingUp size={16} />
                                            </div>
                                            <h4 className="text-[10px] font-black text-white uppercase tracking-widest italic">Evolución Histórica del Embudo</h4>
                                        </div>
                                        <div className="h-[300px] relative z-10 overflow-hidden rounded-2xl bg-slate-950/50 p-4 border border-slate-800/50">
                                            <EvolutionChart 
                                                data={timeSeriesData} 
                                                variables={[
                                                    { key: 'entrantes', label: 'Entrantes', color: '#f43f5e' },
                                                    { key: 'fun_agenda', label: 'Agendas', color: '#10b981' },
                                                    { key: 'op_sub', label: 'Cualificación', color: '#d946ef' }
                                                ]} 
                                            />
                                        </div>
                                    </div>
                                </MetricSection>

                                {/* TABLA DE RENDIMIENTO POR SETTER (Solo en vista equipo) */}
                                {!filters.setter_id && stats.setters_breakdown && stats.setters_breakdown.length > 0 && (
                                    <SetterPerformanceTable data={stats.setters_breakdown} />
                                )}
                            </>
                        ) : (
                            <div className="py-40 text-center text-slate-400 font-bold italic uppercase tracking-widest">Sin datos disponibles para este periodo</div>
                        )}
                    </div>
                )}

                {/* --- TAB: COMPARACIÓN --- */}
                {activeTab === 'comparison' && (
                    <SetterComparisonView setters={setters} />
                )}

                {/* --- TAB: REGISTROS (LOG) --- */}
                {activeTab === 'reports' && (
                    <SetterReportsTable setters={setters} />
                )}

                {/* --- TAB: REND. CONVERSACIONAL --- */}
                {activeTab === 'conv_stats' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <ConversationalStatsTab />
                    </div>
                )}

                {/* --- TAB: LEADS ENTRANTES --- */}
                {activeTab === 'incoming_leads' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <IncomingLeadsTab />
                    </div>
                )}
            </div>

            <div className="text-center pt-20 pb-10">
                <p className="text-[9px] text-slate-400 font-black tracking-[0.4em] uppercase">NeurOPS Strategic Intelligence Board • © 2026 • AI Powered Dashboard</p>
            </div>
        </div>
    );
};

export default PublicSetterStatsPage;
