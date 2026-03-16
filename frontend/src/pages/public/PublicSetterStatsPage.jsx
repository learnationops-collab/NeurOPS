import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import {
    Loader2, TrendingUp, BarChart3, PieChart, Users,
    Target, MousePointer2, Link2, CalendarDays,
    Filter, Inbox, MessageSquare, RefreshCw, Layers,
    ChevronRight, ArrowRight, ArrowDownRight, ArrowUpRight,
    Copy, Calendar, Info, ArrowRightLeft, ListChecks, Table
} from 'lucide-react';
import FunnelChart from '../../components/charts/FunnelChart';
import EvolutionChart from '../../components/charts/EvolutionChart';
import SetterReportsTable from './SetterReportsTable';
import SetterComparisonView from './SetterComparisonView';

const PublicSetterStatsPage = () => {
    const [activeTab, setActiveTab] = useState('general'); // 'general', 'comparison', 'reports'
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [setters, setSetters] = useState([]);

    // Filters for General & Comparison
    const [filters, setFilters] = useState({
        setter_id: '',
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

    // Comparison States are now handled inside SetterComparisonView

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

    useEffect(() => {
        if (activeTab === 'general') fetchStats();
    }, [filters, activeTab]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.setter_id) params.append('setter_id', filters.setter_id);
            if (filters.start_date) params.append('start_date', filters.start_date);
            if (filters.end_date) params.append('end_date', filters.end_date);
            params.append('agg_type', filters.agg_type);

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

    const MetricSection = ({ title, icon: Icon, children, chartData, chartVariables, colorClass = "text-indigo-500" }) => (
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-8 shadow-2xl relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-64 h-64 blur-[120px] opacity-10 group-hover:opacity-20 transition-opacity bg-indigo-500`} />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/50 pb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl bg-slate-800 border border-slate-700/50 ${colorClass}`}>
                        <Icon size={20} />
                    </div>
                    <h3 className="text-xl font-black text-white italic tracking-tight uppercase">{title}</h3>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 relative z-10">
                <div className="space-y-6">
                    {children}
                </div>
                <div className="bg-slate-950/40 rounded-[2rem] p-8 border border-slate-800/50 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp size={14} className="text-slate-500" />
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Evolución Histórica</h4>
                    </div>
                    <EvolutionChart data={chartData} variables={chartVariables} />
                </div>
            </div>
        </div>
    );

    const StatCard = ({ title, value, percentage, icon: Icon, colorClass, subtitle }) => (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 group-hover:opacity-30 transition-opacity bg-indigo-500`} />
            <div className="flex items-start justify-between relative z-10">
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
                    <h3 className="text-3xl font-black text-white italic tracking-tighter">{value}</h3>
                    {percentage !== undefined && (
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${colorClass} bg-opacity-10 border border-indigo-500/30`}>
                                {percentage}%
                            </span>
                        </div>
                    )}
                    {subtitle && <p className="text-[9px] text-slate-600 font-bold uppercase mt-1">{subtitle}</p>}
                </div>
                <div className={`p-3 rounded-2xl bg-slate-800 border border-slate-700/50 ${colorClass}`}>
                    <Icon size={18} />
                </div>
            </div>
        </div>
    );

    const ProgressRow = ({ label, percentage, colorClass, absolute }) => (
        <div className="space-y-2">
            <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                    {absolute !== undefined && <span className="text-[10px] font-bold text-slate-600">({absolute})</span>}
                </div>
                <span className={`text-xs font-black ${colorClass}`}>{percentage}%</span>
            </div>
            <div className={`h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 shadow-inner p-0.5`}>
                <div
                    className={`h-full rounded-full transition-all duration-1000 ${colorClass.replace('text-', 'bg-')} shadow-[0_0_10px_rgba(99,102,241,0.3)]`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );

    const funnelData = useMemo(() => {
        if (!stats) return [];
        return [
            { name: 'Qualification', value: stats.totals.funnel_qualification, fill: '#6366f1' },
            { name: 'Pain', value: stats.totals.funnel_pain, fill: '#6366f1' },
            { name: 'Offer', value: stats.totals.funnel_offer, fill: '#6366f1' },
            { name: 'Link', value: stats.totals.funnel_link, fill: '#6366f1' },
            { name: 'Agenda', value: stats.totals.funnel_agenda, fill: '#6366f1' }
        ];
    }, [stats]);

    const timeSeriesData = useMemo(() => {
        if (!stats?.time_series) return [];
        return stats.time_series.map(day => ({
            ...day,
            op_res_rate: div(day.op_res, day.op_sub),
            fu_res_rate: div(day.fu_res, day.fu_sub),
            op_to_ag: div(day.fun_agenda, day.op_res),
            off_to_ag: div(day.fun_agenda, day.fun_offer),
            link_to_ag: div(day.fun_agenda, day.fun_link),
        }));
    }, [stats]);

    const SetterPerformanceTable = ({ data }) => (
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl mt-10">
            <div className="p-8 border-b border-slate-800 flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                    <Users size={20} />
                </div>
                <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Rendimiento por Setter</h3>
            </div>
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-800/50">
                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Setter</th>
                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Reportes Enviados</th>
                        <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">% Reportado</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-6 font-bold text-slate-300">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                    <span className="text-xs uppercase font-black tracking-wider">{row.setter_name}</span>
                                </div>
                            </td>
                            <td className="p-6 text-center font-black text-white text-lg italic tabular-nums">
                                {row.reports_count}
                            </td>
                            <td className="p-6 text-center">
                                <div className="flex flex-col items-center gap-2">
                                    <span className="font-black text-indigo-400 text-lg italic tabular-nums">{row.report_rate}%</span>
                                    <div className="w-32 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                                        <div 
                                            className="h-full bg-indigo-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.4)]" 
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
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />

            <div className="max-w-7xl mx-auto z-10 relative space-y-8">
                {/* TOP HEADER */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-slate-800/50">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <Layers className="text-indigo-500" size={24} />
                            <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                                Performance <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-fuchsia-500">Center</span>
                            </h1>
                        </div>
                        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em]">NeurOPS High Performance Analytics</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 bg-slate-900/40 p-2 rounded-[2rem] border border-slate-800">
                        <TabButton id="general" label="Vista General" icon={BarChart3} />
                        <TabButton id="comparison" label="Comparación" icon={ArrowRightLeft} />
                        <TabButton id="reports" label="Registros" icon={Table} />
                    </div>
                </div>

                {/* FILTERS BAR (Only for General) */}
                {activeTab === 'general' && (
                    <div className="flex flex-wrap items-center gap-6 bg-slate-900/80 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Setter / Equipo</label>
                            <select
                                className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 transition-all cursor-pointer min-w-[200px]"
                                value={filters.setter_id}
                                onChange={e => setFilters({ ...filters, setter_id: e.target.value })}
                            >
                                <option value="">Todo el Equipo ({filters.agg_type === 'sum' ? 'Suma' : 'Promedio'})</option>
                                {setters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Periodo</label>
                            <select
                                className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 transition-all cursor-pointer min-w-[150px]"
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

                        <div className="flex flex-col gap-2 ml-auto">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 text-right">Agregación</label>
                            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                                <button
                                    onClick={() => setFilters({ ...filters, agg_type: 'sum' })}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${filters.agg_type === 'sum' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Suma
                                </button>
                                <button
                                    onClick={() => setFilters({ ...filters, agg_type: 'avg' })}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${filters.agg_type === 'avg' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Promedio
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB: VISTA GENERAL --- */}
                {activeTab === 'general' && (
                    <div className="space-y-10 animate-in fade-in duration-500">
                        {loading && !stats ? (
                            <div className="flex flex-col items-center justify-center py-40 space-y-4">
                                <Loader2 className="animate-spin text-indigo-500" size={48} />
                                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Sincronizando datos...</p>
                            </div>
                        ) : stats ? (
                            <>
                                {/* GRID PRINCIPAL */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                                    <StatCard title="Entrantes" value={stats.totals.entrantes} icon={Inbox} colorClass="text-pink-500" />
                                    <StatCard title="Agendas" value={stats.totals.funnel_agenda} icon={CalendarDays} colorClass="text-indigo-500" />
                                    <StatCard title="Tasa Apertura" value={`${stats.percentages.rates.opening_rate}%`} icon={MousePointer2} colorClass="text-emerald-500" />
                                    <StatCard title="Op. Response" value={`${stats.percentages.rates.opening_response}%`} icon={MessageSquare} colorClass="text-fuchsia-500" />
                                    <StatCard title="FU Response" value={`${stats.percentages.rates.follow_up_response}%`} icon={RefreshCw} colorClass="text-rose-500" />
                                </div>

                                {/* SECCIONES DE MÉTRICAS */}
                                <div className="space-y-10">
                                    {/* SECCIÓN: EMBUDO DE VENTAS */}
                                    <MetricSection
                                        title="Evolución del Embudo"
                                        icon={TrendingUp}
                                    >
                                        <div className="space-y-6">
                                            <ProgressRow label="Clasificación → Dolor" percentage={stats.percentages.funnel_evolution.qual_to_pain} colorClass="text-indigo-500" absolute={stats.totals.funnel_pain} />
                                            <ProgressRow label="Dolor → Oferta" percentage={stats.percentages.funnel_evolution.pain_to_offer} colorClass="text-indigo-500" absolute={stats.totals.funnel_offer} />
                                            <ProgressRow label="Oferta → Link" percentage={stats.percentages.funnel_evolution.offer_to_link} colorClass="text-indigo-500" absolute={stats.totals.funnel_link} />
                                            <ProgressRow label="Link → Agenda" percentage={stats.percentages.funnel_evolution.link_to_agenda} colorClass="text-indigo-500" absolute={stats.totals.funnel_agenda} />
                                        </div>
                                    </MetricSection>

                                    {/* SECCIÓN: CONVERSIONES */}
                                    <MetricSection
                                        title="Conversiones a Agenda"
                                        icon={Target}
                                        colorClass="text-emerald-500"
                                        chartData={timeSeriesData}
                                        chartVariables={[
                                            { key: 'op_to_ag', label: 'Apertura → Agenda', color: '#10b981' },
                                            { key: 'off_to_ag', label: 'Oferta → Agenda', color: '#34d399' },
                                            { key: 'link_to_ag', label: 'Link → Agenda', color: '#6ee7b7' }
                                        ]}
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <StatCard title="Apertura → Agenda" value={`${stats.percentages.conversions_to_agenda.opening_to_agenda}%`} icon={MousePointer2} colorClass="text-emerald-500" />
                                            <StatCard title="Oferta → Agenda" value={`${stats.percentages.conversions_to_agenda.offer_to_agenda}%`} icon={Target} colorClass="text-emerald-500" />
                                            <StatCard title="Link → Agenda" value={`${stats.percentages.conversions_to_agenda.link_to_agenda}%`} icon={Link2} colorClass="text-emerald-500" />
                                        </div>
                                    </MetricSection>

                                    {/* SECCIÓN: APERTURA */}
                                    <MetricSection
                                        title="Apertura y Respuesta"
                                        icon={MousePointer2}
                                        colorClass="text-fuchsia-500"
                                        chartData={timeSeriesData}
                                        chartVariables={[
                                            { key: 'op_sub', label: 'Aperturas', color: '#d946ef' },
                                            { key: 'op_res', label: 'Respuestas', color: '#f0abfc' },
                                            { key: 'op_res_rate', label: '% Respuesta', color: '#fae8ff' }
                                        ]}
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800 space-y-2">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Aperturas Totales</p>
                                                <p className="text-3xl font-black text-white italic">{stats.totals.opening_submitted}</p>
                                                <p className="text-[9px] font-bold text-fuchsia-500 uppercase tracking-tighter">({stats.percentages.rates.opening_rate}% sobre entrantes)</p>
                                            </div>
                                            <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800 space-y-2">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Respuestas</p>
                                                <p className="text-3xl font-black text-white italic">{stats.totals.opening_responded}</p>
                                                <p className="text-[9px] font-bold text-fuchsia-400 uppercase tracking-tighter">({stats.percentages.rates.opening_response}% tasa de respuesta)</p>
                                            </div>
                                            <StatCard title="Tasa Respuesta" value={`${stats.percentages.rates.opening_response}%`} icon={MessageSquare} colorClass="text-fuchsia-500" />
                                        </div>
                                    </MetricSection>

                                    {/* SECCIÓN: SEGUIMIENTOS */}
                                    <MetricSection
                                        title="Seguimientos (Follow-up)"
                                        icon={RefreshCw}
                                        colorClass="text-rose-500"
                                        chartData={timeSeriesData}
                                        chartVariables={[
                                            { key: 'fu_sub', label: 'Enviados', color: '#f43f5e' },
                                            { key: 'fu_res', label: 'Respondidos', color: '#fb7185' },
                                            { key: 'fu_res_rate', label: '% Respuesta', color: '#fecdd3' }
                                        ]}
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800 space-y-2">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Enviados</p>
                                                <p className="text-3xl font-black text-white italic">{stats.totals.follow_up_submitted}</p>
                                            </div>
                                            <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800 space-y-2">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Respondidos</p>
                                                <p className="text-3xl font-black text-white italic">{stats.totals.follow_up_responded}</p>
                                            </div>
                                            <StatCard title="Tasa Respuesta" value={`${stats.percentages.rates.follow_up_response}%`} icon={RefreshCw} colorClass="text-rose-500" />
                                        </div>
                                    </MetricSection>

                                    {/* SECCIÓN: COMPOSICIÓN */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-8 shadow-2xl overflow-hidden relative group">
                                        <div className="absolute top-0 right-0 w-64 h-64 blur-[120px] opacity-10 bg-indigo-500" />
                                        <div className="flex items-center gap-3 relative z-10 border-b border-slate-800 pb-6">
                                            <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700/50 text-slate-400">
                                                <Inbox size={20} />
                                            </div>
                                            <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Composición de Base</h3>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 relative z-10">
                                            <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800 space-y-1">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">No Leads</p>
                                                <p className="text-2xl font-black text-white italic tabular-nums">{stats.totals.not_lead}</p>
                                            </div>
                                            <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800 space-y-1">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">In-abribles</p>
                                                <p className="text-2xl font-black text-white italic tabular-nums">{stats.totals.inabribles}</p>
                                            </div>
                                            <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800 space-y-1 border-l-indigo-500/50 bg-indigo-500/5">
                                                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Leads Reales</p>
                                                <p className="text-2xl font-black text-white italic tabular-nums">{stats.totals.leads}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* TABLA DE RENDIMIENTO POR SETTER (Solo en vista equipo) */}
                                {!filters.setter_id && stats.setters_breakdown && stats.setters_breakdown.length > 0 && (
                                    <SetterPerformanceTable data={stats.setters_breakdown} />
                                )}
                            </>
                        ) : (
                            <div className="py-40 text-center text-slate-500 font-bold italic uppercase tracking-widest">Sin datos disponibles para este periodo</div>
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
            </div>

            <div className="text-center pt-20 pb-10">
                <p className="text-[9px] text-slate-600 font-black tracking-[0.4em] uppercase">NeurOPS Strategic Intelligence Board • © 2026 • AI Powered Dashboard</p>
            </div>
        </div>
    );
};

export default PublicSetterStatsPage;
