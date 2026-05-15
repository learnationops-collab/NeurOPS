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
    Activity, Zap, BarChart, PenTool, HelpCircle, UserX
} from 'lucide-react';
import usePersistentFilters from '../../hooks/usePersistentFilters';
import FunnelChart from '../../components/charts/FunnelChart';
import EvolutionChart from '../../components/charts/EvolutionChart';
import SetterReportsTable from './SetterReportsTable';
import SetterComparisonView from './SetterComparisonView';
import ConversationalStatsTab from './ConversationalStatsTab';
import LeadUnifiedKPI from '../../components/shared/LeadUnifiedKPI';
import ConfigurableStatCard from '../../components/shared/ConfigurableStatCard';

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
                : 'text-slate-500 hover:bg-slate-800'
                }`}
        >
            <Icon size={14} />
            {label}
        </button>
    );

    const div = (n, d) => (d > 0 ? Number(((n / d) * 100).toFixed(2)) : 0);

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
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:shadow-indigo-500/5 transition-all overflow-visible">
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
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">{label}</span>
                    {tooltipInfo && (
                        <div className="relative group/tooltip inline-block">
                            <HelpCircle size={10} className="text-slate-500 cursor-help hover:text-indigo-500 transition-colors" />
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
                    <span className="text-[10px] font-black text-white bg-slate-800 px-2 py-1 rounded-lg">{subValue}</span>
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
                                {row.reports_count}
                            </td>
                            <td className="p-6 text-center">
                                <div className="flex flex-col items-center gap-2">
                                    <span className="font-black text-indigo-400 text-lg italic tabular-nums">{row.report_rate}%</span>
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
                                    <option value="">Todo el Equipo ({filters.agg_type === 'sum' ? 'Suma' : 'Promedio'})</option>
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
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${filters.agg_type === 'sum' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Suma
                                </button>
                                <button
                                    onClick={() => setFilters({ ...filters, agg_type: 'avg' })}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${filters.agg_type === 'avg' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
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
                                <div className="space-y-6">
                                    <LeadUnifiedKPI stats={stats} />
                                    
                                    {/* SECCIÓN 1: DESCUBRIMIENTO Y CALIDAD (FILA SUPERIOR - RESUMEN) */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4 px-2">
                                            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 shadow-inner">
                                                <Target size={18} />
                                            </div>
                                            <h2 className="text-xl font-bold text-white tracking-tight">Discovery & Lead Quality</h2>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <ConfigurableStatCard 
                                                id="qual_rate_base"
                                                variant="summary"
                                                accentColor="#8B5CF6"
                                                title="Leads Cualificados" 
                                                value={stats.totals.funnel_qualification} 
                                                percentage={div(stats.totals.funnel_qualification, stats.totals.entrantes)}
                                                subValue={`${div(stats.totals.funnel_qualification, stats.totals.entrantes)}% de entrantes`}
                                                icon={Target}
                                                tooltipInfo="Cantidad de leads que superaron el filtro inicial de cualificación."
                                            />
                                            <ConfigurableStatCard 
                                                id="pain_evolution"
                                                variant="summary"
                                                accentColor="#8B5CF6"
                                                title="Pasaron a Dolor" 
                                                value={stats.totals.funnel_pain} 
                                                percentage={div(stats.totals.funnel_pain, stats.totals.funnel_qualification)}
                                                subValue={`${div(stats.totals.funnel_pain, stats.totals.funnel_qualification)}% de cualificados`}
                                                icon={TrendingUp}
                                                tooltipInfo="Leads que avanzaron a la etapa donde se identifica el punto de dolor."
                                            />
                                            <ConfigurableStatCard 
                                                id="setter_opening_rate"
                                                variant="summary"
                                                accentColor="#8B5CF6"
                                                title="Tasa de Apertura" 
                                                value={stats.totals.opening_submitted} 
                                                percentage={div(stats.totals.opening_submitted, (stats.totals.entrantes - stats.totals.not_lead))}
                                                subValue={`${div(stats.totals.opening_submitted, (stats.totals.entrantes - stats.totals.not_lead))}% de leads reales`}
                                                icon={MousePointer2}
                                                tooltipInfo="Calcula cuántos leads contactó el setter del total de leads recibidos (excluyendo descartados automáticos por ManyChat). Fórmula: Aperturas / (Entrantes - No Leads)."
                                            />
                                        </div>
                                    </div>

                                    {/* SECCIÓN 2: ENGAGEMENT CONVERSACIONAL (FILA MEDIA - ANÁLISIS) */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4 px-2">
                                            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 shadow-inner">
                                                <MessageSquare size={18} />
                                            </div>
                                            <h2 className="text-xl font-bold text-white tracking-tight">Conversational Analysis</h2>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <ConfigurableStatCard 
                                                id="opening_resp_qual"
                                                variant="analysis"
                                                accentColor="#3B82F6"
                                                title="Resp. Opening (Qual)" 
                                                value={stats.percentages.rates.qualification_opening_rate}
                                                percentage={stats.percentages.rates.qualification_opening_rate}
                                                subValue={`${stats.totals.qualification_opening_responded} resp / ${stats.totals.qualification_opening_submitted} aperturas`}
                                                icon={MessageSquare}
                                                tooltipInfo="Tasa de respuesta a mensajes enviados en etapa de cualificación."
                                            />
                                            <ConfigurableStatCard 
                                                id="opening_resp_pain"
                                                variant="analysis"
                                                accentColor="#3B82F6"
                                                title="Resp. Opening (Dolor)" 
                                                value={stats.percentages.rates.pain_opening_rate}
                                                percentage={stats.percentages.rates.pain_opening_rate}
                                                subValue={`${stats.totals.pain_opening_responded} resp / ${stats.totals.pain_opening_submitted} aperturas`}
                                                icon={Zap}
                                                tooltipInfo="Tasa de respuesta a mensajes enviados en etapa de dolor."
                                            />
                                            <ConfigurableStatCard 
                                                id="opening_resp_total"
                                                variant="analysis"
                                                accentColor="#3B82F6"
                                                title="Resp. Opening (Total)" 
                                                value={stats.percentages.rates.opening_response}
                                                percentage={stats.percentages.rates.opening_response}
                                                subValue={`${stats.totals.opening_responded} resp / ${stats.totals.opening_submitted} totales`}
                                                icon={Layers}
                                                tooltipInfo="Rendimiento global de respuesta a todos los mensajes de apertura."
                                            />
                                        </div>
                                    </div>

                                    {/* SECCIÓN 3: RESULTADOS Y FOOTER (FILA INFERIOR) */}
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-4 px-2">
                                            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 shadow-inner">
                                                <CalendarDays size={18} />
                                            </div>
                                            <h2 className="text-xl font-bold text-white tracking-tight">Final Outcomes & Velocity</h2>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <ConfigurableStatCard 
                                                id="final_agendas"
                                                variant="summary"
                                                accentColor="#10B981"
                                                title="Agendas Generadas" 
                                                value={stats.totals.funnel_agenda} 
                                                percentage={div(stats.totals.funnel_agenda, stats.totals.entrantes)}
                                                subValue={`${div(stats.totals.funnel_agenda, stats.totals.entrantes)}% de conversión total`}
                                                icon={CalendarDays}
                                                tooltipInfo="Impacto final en el calendario de ventas."
                                            />
                                            <ConfigurableStatCard 
                                                id="total_fu_response"
                                                variant="summary"
                                                accentColor="#10B981"
                                                title="FU Response Rate" 
                                                value={stats.totals.total_fur}
                                                percentage={stats.percentages.rates.total_fur}
                                                subValue="Efectividad en seguimientos"
                                                icon={RefreshCw}
                                                tooltipInfo="Capacidad de recuperar leads mediante follow-ups."
                                            />
                                        </div>

                                        {/* FOOTER DE DATOS SECUNDARIOS */}
                                        <div className="pt-8 border-t border-slate-800/50">
                                            <div className="flex flex-wrap items-center justify-center gap-4">
                                                <ConfigurableStatCard variant="footer" icon={Inbox} title="Entrantes" value={stats.totals.entrantes} />
                                                <ConfigurableStatCard variant="footer" icon={UserX} title="No Leads" value={stats.totals.not_lead} />
                                                <ConfigurableStatCard variant="footer" icon={MessageSquare} title="Sin Rpta" value={stats.totals.no_response} />
                                            </div>
                                        </div>
                                    </div>
                                </div>



                                {/* SECCIÓN: INBOX COMPRENSIVO */}
                                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-8 shadow-xl relative overflow-hidden group">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 shadow-sm">
                                                <Activity size={20} />
                                            </div>
                                            <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Inbox Analysis</h3>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 relative z-10">
                                        <MiniRow label="Entrantes" value={stats.totals.entrantes} colorClass="text-white" tooltipInfo="Suma total de leads recibidos en el inbox." />
                                        <MiniRow label="No Leads" value={stats.totals.not_lead} subValue={`${stats.percentages.inbox.not_lead}%`} colorClass="text-rose-500" tooltipInfo="Leads descartados por no cumplir el perfil ideal." />
                                        <MiniRow label="In-abribles" value={stats.totals.inabribles} subValue={`${stats.percentages.inbox.inabribles}%`} colorClass="text-amber-500" tooltipInfo="Leads con los que no se pudo iniciar una conversación (mensajes restringidos, bloqueos, etc)." />
                                        <MiniRow label="Leads Reales" value={stats.totals.leads} subValue={`${stats.percentages.inbox.leads}%`} colorClass="text-indigo-400" tooltipInfo="Leads válidos para prospectar. Cálculo: (Cualificación - No Leads)." />
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
                                                <div className="group/f transition-all hover:translate-x-1">
                                                    <MiniRow label="Cualificación" value={stats.totals.funnel_qualification} colorClass="text-violet-500" tooltipInfo="Leads en etapa de Cualificación." />
                                                    <div className="h-1 w-full bg-violet-500/20 rounded-full mt-1 overflow-hidden">
                                                        <div className="h-full bg-violet-500" style={{ width: '100%' }} />
                                                    </div>
                                                </div>
                                                
                                                <div className="group/f transition-all hover:translate-x-1">
                                                    <MiniRow label="Dolor" value={stats.totals.funnel_pain} subValue={`${stats.percentages.funnel_evolution.qual_to_pain}%`} colorClass="text-blue-500" tooltipInfo="Leads avanzados a la etapa de Dolor. Cálculo: (Dolor / Leads Reales)." />
                                                    <div className="h-1 w-full bg-blue-500/20 rounded-full mt-1 overflow-hidden">
                                                        <div className="h-full bg-blue-500" style={{ width: `${stats.percentages.funnel_evolution.qual_to_pain}%` }} />
                                                    </div>
                                                </div>

                                                <div className="group/f transition-all hover:translate-x-1">
                                                    <MiniRow label="Oferta" value={stats.totals.funnel_offer} subValue={`${stats.percentages.funnel_evolution.pain_to_offer}%`} colorClass="text-fuchsia-500" tooltipInfo="Leads avanzados a la etapa de Oferta." />
                                                    <div className="h-1 w-full bg-fuchsia-500/20 rounded-full mt-1 overflow-hidden">
                                                        <div className="h-full bg-fuchsia-500" style={{ width: `${stats.percentages.funnel_evolution.pain_to_offer}%` }} />
                                                    </div>
                                                </div>

                                                <div className="group/f transition-all hover:translate-x-1">
                                                    <MiniRow label="Link" value={stats.totals.funnel_link} subValue={`${stats.percentages.funnel_evolution.offer_to_link}%`} colorClass="text-indigo-500" tooltipInfo="Leads avanzados a la etapa de Link enviado." />
                                                    <div className="h-1 w-full bg-indigo-500/20 rounded-full mt-1 overflow-hidden">
                                                        <div className="h-full bg-indigo-500" style={{ width: `${stats.percentages.funnel_evolution.offer_to_link}%` }} />
                                                    </div>
                                                </div>

                                                <div className="group/f transition-all hover:translate-x-1">
                                                    <MiniRow label="Agenda" value={stats.totals.funnel_agenda} subValue={`${stats.percentages.funnel_evolution.link_to_agenda}%`} colorClass="text-emerald-500" tooltipInfo="Leads avanzados a la etapa final de Agenda." />
                                                    <div className="h-1 w-full bg-emerald-500/20 rounded-full mt-1 overflow-hidden">
                                                        <div className="h-full bg-emerald-500" style={{ width: `${stats.percentages.funnel_evolution.link_to_agenda}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </FunnelSubContainer>

                                        {/* Container 2: Engagement & Openings */}
                                        <FunnelSubContainer title="Engagement & Discovery" icon={RefreshCw}>
                                            <div className="space-y-4">
                                                <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Tasa de Respuesta Openings</p>
                                                    <div className="flex justify-around items-end gap-2">
                                                        <div className="text-center">
                                                            <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Qual</p>
                                                            <p className="text-lg font-black text-fuchsia-500 italic">{stats.percentages.rates.qualification_opening_rate}%</p>
                                                        </div>
                                                        <div className="h-8 w-px bg-slate-800" />
                                                        <div className="text-center">
                                                            <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Pain</p>
                                                            <p className="text-lg font-black text-fuchsia-500 italic">{stats.percentages.rates.pain_opening_rate}%</p>
                                                        </div>
                                                        <div className="h-8 w-px bg-slate-800" />
                                                        <div className="text-center">
                                                            <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Total</p>
                                                            <p className="text-lg font-black text-fuchsia-400 italic">{stats.percentages.rates.opening_response}%</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2">Follow Ups (R/S)</p>
                                                    <MiniRow label="Qual FU" value={`${stats.totals.qualification_fur}/${stats.totals.qualification_fu}`} subValue={`${stats.percentages.rates.qualification_fur}%`} colorClass="text-rose-500" tooltipInfo="Seguimientos en Cualificación: Respondidos / Enviados." />
                                                    <MiniRow label="Pain FU" value={`${stats.totals.pain_fur}/${stats.totals.pain_fu}`} subValue={`${stats.percentages.rates.pain_fur}%`} colorClass="text-rose-500" tooltipInfo="Seguimientos en Dolor: Respondidos / Enviados." />
                                                    <MiniRow label="Offer FU" value={`${stats.totals.offer_fur}/${stats.totals.offer_fu}`} subValue={`${stats.percentages.rates.offer_fur}%`} colorClass="text-rose-500" tooltipInfo="Seguimientos en Oferta: Respondidos / Enviados." />
                                                    <MiniRow label="Link FU" value={`${stats.totals.link_fur}/${stats.totals.link_fu}`} subValue={`${stats.percentages.rates.link_fur}%`} colorClass="text-rose-500" tooltipInfo="Seguimientos en Link: Respondidos / Enviados." />
                                                    <MiniRow label="Agenda FU" value={`${stats.totals.agenda_fur}/${stats.totals.agenda_fu}`} subValue={`${stats.percentages.rates.agenda_fur}%`} colorClass="text-teal-600" tooltipInfo="Seguimientos post-Agenda: Respondidos / Enviados." />
                                                </div>
                                            </div>
                                        </FunnelSubContainer>

                                        {/* Container 3: Visualización (Chart) */}
                                        <FunnelSubContainer title="Visualización" icon={TrendingUp}>
                                            <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                                                <FunnelChart data={funnelData} />
                                            </div>
                                        </FunnelSubContainer>
                                    </div>

                                    {/* MINIMALIST EFFICACY SECTION */}
                                    <div className="mt-12 pt-10 border-t border-slate-800">
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
                                                    <div key={q.id} className="flex items-center justify-between px-6 py-4 bg-slate-950/50 rounded-2xl border border-slate-800 group hover:bg-slate-900 hover:shadow-sm transition-all duration-300">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 w-6 h-6 flex items-center justify-center rounded-lg">{q.label}</span>
                                                            <span className="text-sm font-black text-white italic">{Number(q.metrics?.pct || 0).toFixed(1)}%</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter block leading-none mb-1">Total Resp</span>
                                                            <span className="text-xs font-black text-slate-400 leading-none">{Number(q.metrics?.total || 0).toFixed(0)}</span>
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
            </div>

            <div className="text-center pt-20 pb-10">
                <p className="text-[9px] text-slate-400 font-black tracking-[0.4em] uppercase">NeurOPS Strategic Intelligence Board • © 2026 • AI Powered Dashboard</p>
            </div>
        </div>
    );
};

export default PublicSetterStatsPage;
