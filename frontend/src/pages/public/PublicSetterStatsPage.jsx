import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import {
    Loader2, TrendingUp, BarChart3, PieChart, Users,
    Target, MousePointer2, Link2, CalendarDays,
    Filter, Inbox, MessageSquare, RefreshCw, Layers,
    ChevronRight, ArrowRight, ArrowDownRight, ArrowUpRight,
    Copy, Calendar, Info, ArrowRightLeft, ListChecks, Table,
    Activity, Zap, BarChart, PenTool, HelpCircle
} from 'lucide-react';
import FunnelChart from '../../components/charts/FunnelChart';
import EvolutionChart from '../../components/charts/EvolutionChart';
import SetterReportsTable from './SetterReportsTable';
import SetterComparisonView from './SetterComparisonView';

const PublicSetterStatsPage = () => {
    const auth = useAuth();
    const user = auth?.user || { role: 'admin' };
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('general'); // 'general', 'comparison', 'reports'
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [setters, setSetters] = useState([]);

    // Filters for General & Comparison
    const [filters, setFilters] = useState({
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
                : 'text-slate-500 hover:bg-white/50'
                }`}
        >
            <Icon size={14} />
            {label}
        </button>
    );

    const div = (n, d) => (d > 0 ? Number(((n / d) * 100).toFixed(2)) : 0);

    const MetricSection = ({ title, icon: Icon, children, colorClass = "text-indigo-600" }) => (
        <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-[2.5rem] p-8 space-y-8 shadow-xl relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-64 h-64 blur-[120px] opacity-10 group-hover:opacity-20 transition-opacity bg-indigo-500`} />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl bg-white border border-slate-100 shadow-sm ${colorClass}`}>
                        <Icon size={20} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 italic tracking-tight uppercase">{title}</h3>
                </div>
            </div>

            <div className="relative z-10">
                {children}
            </div>
        </div>
    );

    const StatCard = ({ title, value, percentage, icon: Icon, colorClass, subtitle, trend = null, tooltipInfo }) => (
        <div className="bg-white/90 border border-white rounded-3xl p-6 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow overflow-visible">
            <div className={`absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 group-hover:opacity-30 transition-opacity bg-indigo-500`} />
            <div className="flex items-start justify-between relative z-10 overflow-visible">
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
                        {tooltipInfo && (
                            <div className="relative group/tooltip inline-block">
                                <HelpCircle size={12} className="text-slate-400 cursor-help hover:text-indigo-500 transition-colors" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50 shadow-xl border border-slate-700/50">
                                    {tooltipInfo}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                </div>
                            </div>
                        )}
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 italic tracking-tighter">{value}</h3>
                    {percentage !== undefined && (
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${colorClass} bg-opacity-10 border border-current/30`}>
                                {percentage}%
                            </span>
                        </div>
                    )}
                    {subtitle && <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">{subtitle}</p>}
                </div>
                <div className={`p-3 rounded-2xl bg-slate-50 border border-slate-100 ${colorClass}`}>
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

    const FunnelSubContainer = ({ title, icon: Icon, children }) => (
        <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100 flex flex-col gap-6">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
                <Icon size={16} className="text-indigo-500" />
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</h4>
            </div>
            {children}
        </div>
    );

    const MiniRow = ({ label, value, subValue, colorClass, tooltipInfo }) => (
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm overflow-visible">
            <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">{label}</span>
                    {tooltipInfo && (
                        <div className="relative group/tooltip inline-block">
                            <HelpCircle size={10} className="text-slate-400 cursor-help hover:text-indigo-500 transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50 shadow-xl border border-slate-700/50">
                                {tooltipInfo}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                            </div>
                        </div>
                    )}
                </div>
                <span className={`text-lg font-black italic tracking-tighter ${colorClass}`}>{value}</span>
            </div>
            {subValue && (
                <div className="text-right">
                    <span className="text-[10px] font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-lg">{subValue}</span>
                </div>
            )}
        </div>
    );

    const SetterPerformanceTable = ({ data }) => (
        <div className="bg-white/80 border border-white rounded-[2.5rem] overflow-hidden shadow-xl mt-10 backdrop-blur-md">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
                        <Users size={20} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 italic tracking-tight uppercase">Rendimiento por Setter</h3>
                </div>
            </div>
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50/50">
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Setter</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Reportes</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">% Reportado</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm" />
                                    <span className="text-xs uppercase font-black tracking-wider text-slate-700">{row.setter_name}</span>
                                </div>
                            </td>
                            <td className="p-6 text-center font-black text-slate-900 text-lg italic tabular-nums">
                                {row.reports_count}
                            </td>
                            <td className="p-6 text-center">
                                <div className="flex flex-col items-center gap-2">
                                    <span className="font-black text-indigo-600 text-lg italic tabular-nums">{row.report_rate}%</span>
                                    <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden p-0.5">
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
        <div className="min-h-screen bg-[#f0f4f8] text-slate-900 p-4 md:p-8 relative overflow-hidden">
            {/* Ambient Background elements */}
            <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-indigo-100 rounded-full blur-[100px] opacity-50 pointer-events-none" />
            <div className="absolute bottom-[-100px] left-[-100px] w-96 h-96 bg-teal-50 rounded-full blur-[100px] opacity-50 pointer-events-none" />

            <div className="max-w-7xl mx-auto z-10 relative space-y-8">
                {/* TOP HEADER */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-slate-200">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
                                <Layers className="text-white" size={24} />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">
                                Performance <span className="text-indigo-600">Center</span>
                            </h1>
                        </div>
                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] ml-1">NeurOPS High Performance Analytics</p>
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
                        <div className="flex items-center gap-2 bg-white/60 p-2 rounded-[2rem] border border-white shadow-sm backdrop-blur-sm">
                            <TabButton id="general" label="Vista General" icon={BarChart3} />
                            {user.role !== 'setter' && (
                                <TabButton id="comparison" label="Comparación" icon={ArrowRightLeft} />
                            )}
                            <TabButton id="reports" label="Registros" icon={Table} />
                        </div>
                    </div>
                </div>

                {/* FILTERS BAR (Only for General) */}
                {activeTab === 'general' && (
                    <div className="flex flex-wrap items-center gap-6 bg-white/80 p-6 rounded-[2rem] border border-white shadow-xl backdrop-blur-md">
                        {user.role !== 'setter' && (
                            <div className="flex flex-col gap-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Setter / Equipo</label>
                                <select
                                    className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-4 py-2 text-slate-700 outline-none focus:border-indigo-500 transition-all cursor-pointer min-w-[200px]"
                                    value={filters.setter_id}
                                    onChange={e => setFilters({ ...filters, setter_id: e.target.value })}
                                >
                                    <option value="">Todo el Equipo ({filters.agg_type === 'sum' ? 'Suma' : 'Promedio'})</option>
                                    {setters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Periodo</label>
                            <select
                                className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-4 py-2 text-slate-700 outline-none focus:border-indigo-500 transition-all cursor-pointer min-w-[150px]"
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
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Días</label>
                                <input
                                    type="number"
                                    className="w-16 bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-4 py-2 text-slate-700 outline-none focus:border-indigo-500 transition-all font-black text-center"
                                    value={filters.custom_days}
                                    onChange={e => setFilters({ ...filters, custom_days: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                        )}

                        {filters.time_preset === 'custom' && (
                            <>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Desde</label>
                                    <input
                                        type="date"
                                        className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-4 py-2 text-slate-700 outline-none focus:border-indigo-500 transition-all font-black"
                                        value={filters.start_date}
                                        onChange={e => setFilters({ ...filters, start_date: e.target.value })}
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Hasta</label>
                                    <input
                                        type="date"
                                        className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-4 py-2 text-slate-700 outline-none focus:border-indigo-500 transition-all font-black"
                                        value={filters.end_date}
                                        onChange={e => setFilters({ ...filters, end_date: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        <div className="flex flex-col gap-2 ml-auto">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 text-right">Agregación</label>
                            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                                <button
                                    onClick={() => setFilters({ ...filters, agg_type: 'sum' })}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${filters.agg_type === 'sum' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Suma
                                </button>
                                <button
                                    onClick={() => setFilters({ ...filters, agg_type: 'avg' })}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${filters.agg_type === 'avg' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Promedio
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
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                                    <StatCard title="Entrantes" value={stats.totals.entrantes} icon={Inbox} colorClass="text-pink-500" tooltipInfo="Suma total de leads nuevos ingresados al CRM en el período seleccionado." />
                                    <StatCard title="Agendas" value={stats.totals.funnel_agenda} icon={CalendarDays} colorClass="text-indigo-500" tooltipInfo="Suma total de leads movidos a la etapa de Agenda." />
                                    <StatCard title="Tasa Apertura" value={`${stats.percentages.rates.opening_rate}%`} icon={MousePointer2} colorClass="text-emerald-500" tooltipInfo="Mide la calidad de los leads. Cálculo: (Entrantes - No Leads) / Entrantes." />
                                    <StatCard title="Op. Response" value={`${stats.percentages.rates.opening_response}%`} icon={MessageSquare} colorClass="text-fuchsia-500" tooltipInfo="Tasa de respuesta a los mensajes de apertura. Cálculo: (Openings Respondidos / Openings Enviados)." />
                                    <StatCard title="FU Response" value={`${stats.percentages.rates.link_fur}%`} icon={RefreshCw} colorClass="text-rose-500" subtitle="Tasa Link FU" tooltipInfo="Tasa de respuesta a los seguimientos (Follow Ups) en la etapa de Link. Cálculo: (Link FU Respondidos / Link FU Enviados)." />
                                </div>



                                {/* SECCIÓN: INBOX COMPRENSIVO */}
                                <div className="bg-white/80 border border-white rounded-[2.5rem] p-8 space-y-8 shadow-xl relative overflow-hidden group backdrop-blur-md">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-sm">
                                                <Activity size={20} />
                                            </div>
                                            <h3 className="text-xl font-black text-slate-900 italic tracking-tight uppercase">Inbox Analysis</h3>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 relative z-10">
                                        <MiniRow label="Entrantes" value={stats.totals.entrantes} colorClass="text-slate-900" tooltipInfo="Suma total de leads recibidos en el inbox." />
                                        <MiniRow label="No Leads" value={stats.totals.not_lead} subValue={`${stats.percentages.inbox.not_lead}%`} colorClass="text-rose-500" tooltipInfo="Leads descartados por no cumplir el perfil ideal." />
                                        <MiniRow label="In-abribles" value={stats.totals.inabribles} subValue={`${stats.percentages.inbox.inabribles}%`} colorClass="text-amber-500" tooltipInfo="Leads con los que no se pudo iniciar una conversación (mensajes restringidos, bloqueos, etc)." />
                                        <MiniRow label="Leads Reales" value={stats.totals.leads} subValue={`${stats.percentages.inbox.leads}%`} colorClass="text-indigo-600" tooltipInfo="Leads válidos para prospectar. Cálculo: (Entrantes - No Leads)." />
                                        <div className="bg-indigo-600 rounded-[2rem] p-6 text-white shadow-xl flex flex-col justify-center relative overflow-visible group/tooltip-conv">
                                            <div className="absolute top-4 right-4 group-hover/tooltip-conv:opacity-100 opacity-50 transition-opacity">
                                                <HelpCircle size={14} className="text-white/50 cursor-help" />
                                                <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip-conv:opacity-100 transition-all pointer-events-none z-50 shadow-xl border border-slate-700/50">
                                                    Porcentaje de leads reales que terminan en agenda. Cálculo: (Agendas / Leads Reales).
                                                    <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-800"></div>
                                                </div>
                                            </div>
                                            <p className="text-[8px] font-black opacity-60 uppercase tracking-widest mb-1">Conversion Total</p>
                                            <p className="text-3xl font-black italic tracking-tighter">{div(stats.totals.funnel_agenda, stats.totals.leads)}%</p>
                                        </div>
                                    </div>
                                </div>

                                {/* SECCIÓN: FUNNEL (REESTRUCTURADO) */}
                                <MetricSection title="Funnel" icon={TrendingUp}>
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        {/* Container 1: Leads by Stage */}
                                        <FunnelSubContainer title="Standings (Leads)" icon={BarChart}>
                                            <div className="space-y-4">
                                                <MiniRow label="Cualificación" value={stats.totals.funnel_qualification} colorClass="text-slate-900" tooltipInfo="Leads en etapa de Cualificación." />
                                                <MiniRow label="Dolor" value={stats.totals.funnel_pain} subValue={`${stats.percentages.funnel_evolution.qual_to_pain}%`} colorClass="text-indigo-600" tooltipInfo="Leads avanzados a la etapa de Dolor." />
                                                <MiniRow label="Oferta" value={stats.totals.funnel_offer} subValue={`${stats.percentages.funnel_evolution.pain_to_offer}%`} colorClass="text-indigo-600" tooltipInfo="Leads avanzados a la etapa de Oferta." />
                                                <MiniRow label="Link" value={stats.totals.funnel_link} subValue={`${stats.percentages.funnel_evolution.offer_to_link}%`} colorClass="text-indigo-600" tooltipInfo="Leads avanzados a la etapa de Link enviado." />
                                                <MiniRow label="Agenda" value={stats.totals.funnel_agenda} subValue={`${stats.percentages.funnel_evolution.link_to_agenda}%`} colorClass="text-teal-600" tooltipInfo="Leads avanzados a la etapa final de Agenda." />
                                            </div>
                                        </FunnelSubContainer>

                                        {/* Container 2: Engagement (Follow Ups) */}
                                        <FunnelSubContainer title="Engagement (Follow Ups)" icon={RefreshCw}>
                                            <div className="space-y-4">
                                                <MiniRow label="Qual FU" value={`${stats.totals.qualification_fur}/${stats.totals.qualification_fu}`} subValue={`${stats.percentages.rates.qualification_fur}%`} colorClass="text-rose-500" tooltipInfo="Seguimientos en Cualificación: Respondidos / Enviados." />
                                                <MiniRow label="Pain FU" value={`${stats.totals.pain_fur}/${stats.totals.pain_fu}`} subValue={`${stats.percentages.rates.pain_fur}%`} colorClass="text-rose-500" tooltipInfo="Seguimientos en Dolor: Respondidos / Enviados." />
                                                <MiniRow label="Offer FU" value={`${stats.totals.offer_fur}/${stats.totals.offer_fu}`} subValue={`${stats.percentages.rates.offer_fur}%`} colorClass="text-rose-500" tooltipInfo="Seguimientos en Oferta: Respondidos / Enviados." />
                                                <MiniRow label="Link FU" value={`${stats.totals.link_fur}/${stats.totals.link_fu}`} subValue={`${stats.percentages.rates.link_fur}%`} colorClass="text-rose-500" tooltipInfo="Seguimientos en Link: Respondidos / Enviados." />
                                                <MiniRow label="Agenda FU" value={`${stats.totals.agenda_fur}/${stats.totals.agenda_fu}`} subValue={`${stats.percentages.rates.agenda_fur}%`} colorClass="text-teal-600" tooltipInfo="Seguimientos post-Agenda: Respondidos / Enviados." />
                                            </div>
                                        </FunnelSubContainer>

                                        {/* Container 3: Discovery (Openings) */}
                                        <FunnelSubContainer title="Discovery (Openings)" icon={MousePointer2}>
                                            <div className="space-y-4">
                                                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Cualificación</p>
                                                    <p className="text-4xl font-black text-slate-900 italic tracking-tighter">{stats.totals.qualification_opening_responded} <span className="text-slate-300">/</span> {stats.totals.qualification_opening_submitted}</p>
                                                    <p className="text-lg font-black text-fuchsia-600 mt-2">{stats.percentages.rates.qualification_opening_rate}%</p>
                                                </div>
                                                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Dolor</p>
                                                    <p className="text-4xl font-black text-slate-900 italic tracking-tighter">{stats.totals.pain_opening_responded} <span className="text-slate-300">/</span> {stats.totals.pain_opening_submitted}</p>
                                                    <p className="text-lg font-black text-fuchsia-600 mt-2">{stats.percentages.rates.pain_opening_rate}%</p>
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="flex-1 bg-fuchsia-600 p-4 rounded-2xl text-white text-center">
                                                        <p className="text-[7px] font-black opacity-60 uppercase mb-1">Total Aperturas</p>
                                                        <p className="text-xl font-black italic">{stats.totals.opening_submitted}</p>
                                                    </div>
                                                    <div className="flex-1 bg-slate-900 p-4 rounded-2xl text-white text-center">
                                                        <p className="text-[7px] font-black opacity-60 uppercase mb-1">Respuesta Tot</p>
                                                        <p className="text-xl font-black italic">{stats.percentages.rates.opening_response}%</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </FunnelSubContainer>
                                    </div>

                                    {/* MINIMALIST EFFICACY SECTION */}
                                    <div className="mt-12 pt-10 border-t border-slate-100">
                                        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                                                    <Zap size={16} />
                                                </div>
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Calidad de Preguntas</h4>
                                            </div>
                                            
                                            <div className="flex-1 grid grid-cols-2 gap-4 w-full">
                                                {[
                                                    { id: 'q1', label: 'P1', metrics: stats?.percentages?.questions ? { total: stats.percentages.questions.q1_total, pct: stats.percentages.questions.q1_useful } : null },
                                                    { id: 'q2', label: 'P2', metrics: stats?.percentages?.questions ? { total: stats.percentages.questions.q2_total, pct: stats.percentages.questions.q2_useful } : null }
                                                ].map((q) => (
                                                    <div key={q.id} className="flex items-center justify-between px-6 py-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 group hover:bg-white hover:shadow-sm transition-all duration-300">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 w-6 h-6 flex items-center justify-center rounded-lg">{q.label}</span>
                                                            <span className="text-sm font-black text-slate-800 italic">{Number(q.metrics?.pct || 0).toFixed(1)}%</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter block leading-none mb-1">Total Resp</span>
                                                            <span className="text-xs font-black text-slate-500 leading-none">{Number(q.metrics?.total || 0).toFixed(0)}</span>
                                                        </div>
                                                    </div>
                                                ))}
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
                                                    { key: 'op_sub', label: 'Aperturas', color: '#d946ef' }
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
            </div>

            <div className="text-center pt-20 pb-10">
                <p className="text-[9px] text-slate-400 font-black tracking-[0.4em] uppercase">NeurOPS Strategic Intelligence Board • © 2026 • AI Powered Dashboard</p>
            </div>
        </div>
    );
};

export default PublicSetterStatsPage;
