import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
    Loader2, BarChart3, Target, Layers, Phone, Activity,
    Table, Users, ListChecks
} from 'lucide-react';
import TriageTrackerTable from '../admin/reports/TriageTrackerTable';

const PublicTriageStatsPage = () => {
    const [activeTab, setActiveTab] = useState('general'); // 'general', 'tracker'
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const [filters, setFilters] = useState({
        triage_name: '',
        start_date: '',
        end_date: '',
        agg_type: 'sum',
        time_preset: 'last_days',
        custom_days: 7
    });

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
        if (activeTab === 'tracker') return;
        fetchStats();
    }, [filters, activeTab]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.triage_name) params.append('triage_name', filters.triage_name);
            if (filters.start_date) params.append('start_date', filters.start_date);
            if (filters.end_date) params.append('end_date', filters.end_date);
            params.append('agg_type', filters.agg_type);

            const res = await api.get(`/triage/tracker/stats?${params.toString()}`);
            setStats(res.data);
        } catch (err) {
            console.error("Error fetching triage tracker stats:", err);
        } finally {
            setLoading(false);
        }
    };

    const safeCalc = (val, total) => (total > 0 ? ((val / total) * 100).toFixed(1) : "0.0");
    const fmt = n => {
        if (n === null || n === undefined) return "0";
        if (filters.agg_type === 'avg') return Number(n).toFixed(1);
        return Math.round(n).toLocaleString();
    };

    // Aggregations
    const s1Agendas = stats?.starting_1st_call_agendas || 0;
    const s2Agendas = stats?.starting_2nd_call_agendas || 0;
    const stAgendas = s1Agendas + s2Agendas;
    const stConfirmando = (stats?.starting_1st_call_confirmando || 0) + (stats?.starting_2nd_call_confirmando || 0);
    const stReprogramando = (stats?.starting_1st_call_reprogramando || 0) + (stats?.starting_2nd_call_reprogramando || 0);
    const stConfirmadas = (stats?.starting_1st_call_confirmadas || 0) + (stats?.starting_2nd_call_confirmadas || 0);
    const stCanceladas = (stats?.starting_1st_call_canceladas || 0) + (stats?.starting_2nd_call_canceladas || 0);

    const a1Agendas = stats?.all_1st_call_agendas || 0;
    const a2Agendas = stats?.all_2nd_call_agendas || 0;
    const allAgendas = a1Agendas + a2Agendas;
    const allConfirmando = (stats?.all_1st_call_confirmando || 0) + (stats?.all_2nd_call_confirmando || 0);
    const allReprogramando = (stats?.all_1st_call_reprogramando || 0) + (stats?.all_2nd_call_reprogramando || 0);
    const allConfirmadas = (stats?.all_1st_call_confirmadas || 0) + (stats?.all_2nd_call_confirmadas || 0);
    const allCanceladas = (stats?.all_1st_call_canceladas || 0) + (stats?.all_2nd_call_canceladas || 0);

    const fuDisponibles = (stats?.fu_cold_personas_disp_fu || 0) + (stats?.fu_warm_personas_disp_fu || 0) + (stats?.fu_hot_personas_disp_fu || 0);
    const fuMjes = (stats?.fu_cold_mjes_realizados || 0) + (stats?.fu_warm_mjes_realizados || 0) + (stats?.fu_hot_mjes_realizados || 0);
    const fuContactadas = (stats?.fu_cold_personas_realizados || 0) + (stats?.fu_warm_personas_realizados || 0) + (stats?.fu_hot_personas_realizados || 0);
    const fuRespondidos = (stats?.fu_cold_personas_respondidos || 0) + (stats?.fu_warm_personas_respondidos || 0) + (stats?.fu_hot_personas_respondidos || 0);
    const avgMessages = fuContactadas > 0 ? (fuMjes / fuContactadas).toFixed(1) : "0.0";

    const popConfirmadasHoy = stats?.post_hoy_confirmadas || 0;
    const popPpcHoy = stats?.post_hoy_ppc_completo || 0;
    const popConfirmadasAll = stats?.post_all_confirmadas || 0;
    const popPpcAll = stats?.post_all_ppc_completo || 0;

    // Independent bases for percentages
    const stProcessTotal = stConfirmando + stReprogramando;
    const allProcessTotal = allConfirmando + allReprogramando;
    
    const stInciertas = stAgendas - (stConfirmando + stReprogramando + stConfirmadas + stCanceladas);
    const allInciertas = allAgendas - (allConfirmando + allReprogramando + allConfirmadas + allCanceladas);
    
    const stCompletosTotal = stConfirmadas + stCanceladas + stInciertas;
    const allCompletosTotal = allConfirmadas + allCanceladas + allInciertas;

    const TabButton = ({ id, label, icon: Icon }) => (
        <button onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-800'}`}>
            <Icon size={14} /> {label}
        </button>
    );

    const ProgressRow = ({ label, percentage, absolute, colorClass }) => (
        <div className="space-y-1.5">
            <div className="flex justify-between items-end">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{label}</span>
                    {absolute !== undefined && <span className="text-[12px] font-black text-white italic">{fmt(absolute)}</span>}
                </div>
                <span className={`text-[10px] font-black ${colorClass}`}>{percentage}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/30">
                <div className={`h-full rounded-full transition-all duration-1000 ${colorClass.replace('text-', 'bg-')}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
            </div>
        </div>
    );

    const MetricCard = ({ title, value, colorClass }) => (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 text-center">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{title}</h4>
            <div className={`text-2xl font-black italic tracking-tighter ${colorClass}`}>{value}</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 relative overflow-hidden font-inter">
            <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />

            <div className="max-w-7xl mx-auto z-10 relative space-y-8">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-slate-800/50">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <Layers className="text-indigo-500" size={24} />
                            <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                                Tracker <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">Board</span>
                            </h1>
                        </div>
                        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em]">NeurOPS Triage Performance Analytics</p>
                    </div>
                </div>

                {/* TABS & AGGREGATION */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex flex-wrap items-center gap-4 bg-slate-900/40 p-2 rounded-[2rem] border border-slate-800 w-fit">
                        <TabButton id="general" label="Dashboard" icon={BarChart3} />
                        <TabButton id="tracker" label="Tracker History" icon={Table} />
                    </div>

                    {activeTab === 'general' && (
                        <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-2xl border border-slate-800 self-end md:self-auto">
                            <button
                                onClick={() => setFilters({ ...filters, agg_type: 'sum' })}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filters.agg_type === 'sum' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Sumatoria
                            </button>
                            <button
                                onClick={() => setFilters({ ...filters, agg_type: 'avg' })}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filters.agg_type === 'avg' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Promedio
                            </button>
                        </div>
                    )}
                </div>

                {/* FILTROS */}
                <div className="flex flex-wrap items-center gap-6 bg-slate-900/80 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
                    <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Triage / Equipo</label>
                        <select className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 min-w-[200px]" value={filters.triage_name} onChange={e => setFilters({ ...filters, triage_name: e.target.value })}>
                            <option value="">Todo el Equipo</option>
                            <option value="Kerwin">Kerwin</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Periodo</label>
                        <select className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 min-w-[150px]" value={filters.time_preset} onChange={e => setFilters({ ...filters, time_preset: e.target.value })}>
                            <option value="yesterday">Ayer</option>
                            <option value="last_days">Últimos X días</option>
                            <option value="all_time">Todo el tiempo</option>
                            <option value="custom">Personalizado</option>
                        </select>
                    </div>

                    {filters.time_preset === 'last_days' && (
                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Días</label>
                            <input type="number" className="w-16 bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 text-center" value={filters.custom_days} onChange={e => setFilters({ ...filters, custom_days: parseInt(e.target.value) || 0 })} />
                        </div>
                    )}

                    {filters.time_preset === 'custom' && (
                        <>
                            <div className="flex flex-col gap-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Desde</label>
                                <input type="date" className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500" value={filters.start_date} onChange={e => setFilters({ ...filters, start_date: e.target.value })} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Hasta</label>
                                <input type="date" className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500" value={filters.end_date} onChange={e => setFilters({ ...filters, end_date: e.target.value })} />
                            </div>
                        </>
                    )}
                </div>

                {/* CONTENIDO PRINCIPAL */}
                {loading && !stats && activeTab === 'general' ? (
                    <div className="flex flex-col items-center justify-center py-40 space-y-4">
                        <Loader2 className="animate-spin text-indigo-500" size={48} />
                        <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Calculando Dashboard...</p>
                    </div>
                ) : (
                    <>
                        {stats && activeTab === 'general' && (
                            <div className="space-y-8 animate-in fade-in duration-500 mt-8">
                                
                                {/* ----------------- PRE CONFIRMACIÓN ----------------- */}
                                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col xl:flex-row gap-8 hover:shadow-indigo-500/10 transition-shadow">
                                    {/* Left: Table */}
                                    <div className="flex-1 space-y-6 overflow-hidden">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                                                <Phone size={20} />
                                            </div>
                                            <h3 className="text-xl font-black text-white italic tracking-tight uppercase">DÍA DE HOY</h3>
                                        </div>

                                        <div className="overflow-x-auto w-full">
                                            <table className="w-full min-w-max text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-slate-800">
                                                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Variable</th>
                                                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-indigo-400 text-center bg-indigo-500/10 rounded-t-xl mx-1">Hoy</th>
                                                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-pink-400 text-center bg-pink-500/10 rounded-t-xl mx-1">Restantes</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800/50">
                                                    <tr className="hover:bg-slate-800/20 transition-colors">
                                                        <td className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-300">Agendas</td>
                                                        <td className="py-4 px-4 text-lg font-black italic text-center text-indigo-400 bg-indigo-500/5">{fmt(stAgendas)}</td>
                                                        <td className="py-4 px-4 text-lg font-black italic text-center text-pink-400 bg-pink-500/5">{fmt(allAgendas)}</td>
                                                    </tr>
                                                    <tr className="hover:bg-slate-800/20 transition-colors">
                                                        <td className="py-3 px-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Confirmando</td>
                                                        <td className="py-3 px-4 text-base font-bold text-center text-slate-200">{fmt(stConfirmando)}</td>
                                                        <td className="py-3 px-4 text-base font-bold text-center text-slate-200">{fmt(allConfirmando)}</td>
                                                    </tr>
                                                    <tr className="hover:bg-slate-800/20 transition-colors">
                                                        <td className="py-3 px-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">Reprogramando</td>
                                                        <td className="py-3 px-4 text-base font-bold text-center text-slate-200">{fmt(stReprogramando)}</td>
                                                        <td className="py-3 px-4 text-base font-bold text-center text-slate-200">{fmt(allReprogramando)}</td>
                                                    </tr>
                                                    <tr className="hover:bg-slate-800/20 transition-colors">
                                                        <td className="py-3 px-4 text-[11px] font-bold uppercase tracking-widest text-emerald-400">Confirmadas</td>
                                                        <td className="py-3 px-4 text-base font-bold text-center text-emerald-400">{fmt(stConfirmadas)}</td>
                                                        <td className="py-3 px-4 text-base font-bold text-center text-emerald-400">{fmt(allConfirmadas)}</td>
                                                    </tr>
                                                    <tr className="hover:bg-slate-800/20 transition-colors">
                                                        <td className="py-3 px-4 text-[11px] font-bold uppercase tracking-widest text-rose-400">Canceladas</td>
                                                        <td className="py-3 px-4 text-base font-bold text-center text-rose-400">{fmt(stCanceladas)}</td>
                                                        <td className="py-3 px-4 text-base font-bold text-center text-rose-400">{fmt(allCanceladas)}</td>
                                                    </tr>
                                                    <tr className="hover:bg-slate-800/20 transition-colors">
                                                        <td className="py-3 px-4 text-[11px] font-bold uppercase tracking-widest text-amber-400">Inciertas</td>
                                                        <td className="py-3 px-4 text-base font-bold text-center text-amber-400">{fmt(stInciertas)}</td>
                                                        <td className="py-3 px-4 text-base font-bold text-center text-amber-400">{fmt(allInciertas)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    {/* Right: Grouped Containers */}
                                    <div className="w-full xl:w-[480px] flex flex-col gap-6 pt-6 xl:pt-0 xl:pl-6 border-t xl:border-t-0 xl:border-l border-slate-800/50">
                                        
                                        {/* Container: En proceso */}
                                        <div className="bg-slate-800/30 rounded-[2rem] p-6 border border-slate-800/50 space-y-6">
                                            <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4">
                                                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                                                    <Activity size={16} strokeWidth={3} />
                                                </div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-white italic">En proceso</h4>
                                            </div>

                                            <div className="grid grid-cols-2 gap-8 relative">
                                                <div className="absolute inset-y-0 left-1/2 w-px bg-slate-800" />
                                                
                                                <div className="space-y-6">
                                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest text-center">Hoy</p>
                                                    <div className="space-y-4">
                                                        <ProgressRow label="Confirmando" absolute={stConfirmando} percentage={safeCalc(stConfirmando, stProcessTotal)} colorClass="text-indigo-400" />
                                                        <ProgressRow label="Reprogramando" absolute={stReprogramando} percentage={safeCalc(stReprogramando, stProcessTotal)} colorClass="text-fuchsia-400" />
                                                    </div>
                                                </div>

                                                <div className="space-y-6">
                                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest text-center">Generales</p>
                                                    <div className="space-y-4">
                                                        <ProgressRow label="Confirmando" absolute={allConfirmando} percentage={safeCalc(allConfirmando, allProcessTotal)} colorClass="text-indigo-500" />
                                                        <ProgressRow label="Reprogramando" absolute={allReprogramando} percentage={safeCalc(allReprogramando, allProcessTotal)} colorClass="text-fuchsia-500" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Container: Completos */}
                                        <div className="bg-slate-800/30 rounded-[2rem] p-6 border border-slate-800/50 space-y-6 border-t-4 border-t-emerald-500/30">
                                            <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4">
                                                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                                                    <ListChecks size={16} strokeWidth={3} />
                                                </div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-white italic">Completos</h4>
                                            </div>

                                            <div className="grid grid-cols-2 gap-8 relative">
                                                <div className="absolute inset-y-0 left-1/2 w-px bg-slate-800" />

                                                <div className="space-y-6">
                                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest text-center">Hoy</p>
                                                    <div className="space-y-4">
                                                        <ProgressRow label="Confirmadas" absolute={stConfirmadas} percentage={safeCalc(stConfirmadas, stCompletosTotal)} colorClass="text-emerald-400" />
                                                        <ProgressRow label="Canceladas" absolute={stCanceladas} percentage={safeCalc(stCanceladas, stCompletosTotal)} colorClass="text-rose-400" />
                                                        <ProgressRow label="Inciertas" absolute={stInciertas} percentage={safeCalc(stInciertas, stCompletosTotal)} colorClass="text-amber-400" />
                                                    </div>
                                                </div>

                                                <div className="space-y-6">
                                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest text-center">Generales</p>
                                                    <div className="space-y-4">
                                                        <ProgressRow label="Confirmadas" absolute={allConfirmadas} percentage={safeCalc(allConfirmadas, allCompletosTotal)} colorClass="text-emerald-500" />
                                                        <ProgressRow label="Canceladas" absolute={allCanceladas} percentage={safeCalc(allCanceladas, allCompletosTotal)} colorClass="text-rose-500" />
                                                        <ProgressRow label="Inciertas" absolute={allInciertas} percentage={safeCalc(allInciertas, allCompletosTotal)} colorClass="text-amber-500" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>


                                {/* ----------------- POST CONFIRMACIÓN ----------------- */}
                                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 hover:shadow-emerald-500/10 transition-shadow">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                                            <Target size={20} />
                                        </div>
                                        <h3 className="text-xl font-black text-white italic tracking-tight uppercase">RECORDATORIOS</h3>
                                    </div>

                                    <div className="bg-slate-800/20 rounded-2xl border border-slate-800 p-4 overflow-x-auto">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 min-w-[600px] md:min-w-0">
                                            <div className="space-y-4">
                                                <div className="text-center text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-2 rounded-xl">HOY</div>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-center flex flex-col justify-center">
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Totales</div>
                                                        <div className="text-2xl font-black italic text-emerald-400 mt-2">{fmt(popConfirmadasHoy)}</div>
                                                    </div>
                                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-center flex flex-col justify-center">
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Completados</div>
                                                        <div className="text-2xl font-black italic text-teal-400 mt-2">{fmt(popPpcHoy)}</div>
                                                    </div>
                                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-emerald-500/30 text-center flex flex-col justify-center shadow-lg shadow-emerald-500/10">
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500">% Efectividad</div>
                                                        <div className="text-xl font-black italic text-emerald-400 mt-2">{safeCalc(popPpcHoy, popConfirmadasHoy)}%</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="text-center text-[10px] font-black uppercase tracking-widest text-teal-400 bg-teal-500/10 border border-teal-500/20 py-2 rounded-xl">RESTANTES</div>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-center flex flex-col justify-center">
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Totales</div>
                                                        <div className="text-2xl font-black italic text-emerald-400 mt-2">{fmt(popConfirmadasAll)}</div>
                                                    </div>
                                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-center flex flex-col justify-center">
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Completados</div>
                                                        <div className="text-2xl font-black italic text-teal-400 mt-2">{fmt(popPpcAll)}</div>
                                                    </div>
                                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-teal-500/30 text-center flex flex-col justify-center shadow-lg shadow-teal-500/10">
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-teal-500">% Efectividad</div>
                                                        <div className="text-xl font-black italic text-teal-400 mt-2">{safeCalc(popPpcAll, popConfirmadasAll)}%</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ----------------- FOLLOW UP PROCESS ----------------- */}
                                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 hover:shadow-cyan-500/10 transition-shadow">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500">
                                                <Users size={20} />
                                            </div>
                                            <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Follow Up Process</h3>
                                        </div>
                                        <div className="text-right bg-slate-800/50 p-2 rounded-xl border border-slate-700/50">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Promedio Global Mensajes</p>
                                            <p className="text-xl mt-1 font-black text-cyan-400 italic">{avgMessages} <span className="text-[10px] text-slate-500 not-italic uppercase">/ cto</span></p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                                        
                                        {/* COLD FUNNEL */}
                                        <div className="bg-slate-800/20 border border-slate-800 rounded-2xl p-4 md:p-6 flex flex-col hover:border-cyan-500/30 transition-colors shadow-lg shadow-black/20">
                                            <div className="text-center mb-6">
                                                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-400">Cold Leads</h4>
                                                <p className="text-[9px] font-black uppercase text-slate-500 mt-1.5">Mjes: {fmt(stats?.fu_cold_mjes_realizados)} / Cto: {fmt(stats?.fu_cold_personas_realizados)}</p>
                                            </div>
                                            <div className="space-y-2 relative py-2 flex flex-col items-center flex-1">
                                                <div className="h-14 bg-slate-800 border border-cyan-500/30 rounded-t-xl flex items-center justify-between px-3 md:px-5 relative overflow-hidden group w-full">
                                                    <div className="absolute inset-y-0 left-0 bg-cyan-500/10" style={{width: `100%`}}></div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-500/70 relative z-10 w-auto">Disp.</span>
                                                    <span className="text-lg md:text-xl font-black italic text-white relative z-10">{fmt(stats?.fu_cold_personas_disp_fu)}</span>
                                                </div>
                                                <div className="h-14 bg-slate-800 border border-emerald-500/30 rounded-sm flex items-center justify-between px-3 md:px-5 relative overflow-hidden group w-[90%]">
                                                    <div className="absolute inset-y-0 left-0 bg-emerald-500/10" style={{width: `${safeCalc(stats?.fu_cold_personas_realizados, stats?.fu_cold_personas_disp_fu)}%`}}></div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500/70 relative z-10 w-auto">Conctadas</span>
                                                    <span className="text-lg md:text-xl font-black italic text-white relative z-10">{fmt(stats?.fu_cold_personas_realizados)}</span>
                                                </div>
                                                <div className="h-14 bg-slate-800 border border-rose-500/30 rounded-b-xl flex items-center justify-between px-3 md:px-5 relative overflow-hidden group w-[80%]">
                                                    <div className="absolute inset-y-0 left-0 bg-rose-500/10" style={{width: `${safeCalc(stats?.fu_cold_personas_respondidos, stats?.fu_cold_personas_realizados)}%`}}></div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-500/70 relative z-10 w-auto">Respuestas</span>
                                                    <span className="text-lg md:text-xl font-black italic text-white relative z-10">{fmt(stats?.fu_cold_personas_respondidos)} <span className="text-[9px] text-rose-400/80 not-italic ml-1 hidden lg:inline-block">({safeCalc(stats?.fu_cold_personas_respondidos, stats?.fu_cold_personas_realizados)}%)</span></span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* WARM FUNNEL */}
                                        <div className="bg-slate-800/20 border border-slate-800 rounded-2xl p-4 md:p-6 flex flex-col hover:border-orange-500/30 transition-colors shadow-lg shadow-black/20">
                                            <div className="text-center mb-6">
                                                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-orange-400">Warm Leads</h4>
                                                <p className="text-[9px] font-black uppercase text-slate-500 mt-1.5">Mjes: {fmt(stats?.fu_warm_mjes_realizados)} / Cto: {fmt(stats?.fu_warm_personas_realizados)}</p>
                                            </div>
                                            <div className="space-y-2 relative py-2 flex flex-col items-center flex-1">
                                                <div className="h-14 bg-slate-800 border border-orange-500/30 rounded-t-xl flex items-center justify-between px-3 md:px-5 relative overflow-hidden group w-full">
                                                    <div className="absolute inset-y-0 left-0 bg-orange-500/10" style={{width: `100%`}}></div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-orange-500/70 relative z-10 w-auto">Disp.</span>
                                                    <span className="text-lg md:text-xl font-black italic text-white relative z-10">{fmt(stats?.fu_warm_personas_disp_fu)}</span>
                                                </div>
                                                <div className="h-14 bg-slate-800 border border-emerald-500/30 rounded-sm flex items-center justify-between px-3 md:px-5 relative overflow-hidden group w-[90%]">
                                                    <div className="absolute inset-y-0 left-0 bg-emerald-500/10" style={{width: `${safeCalc(stats?.fu_warm_personas_realizados, stats?.fu_warm_personas_disp_fu)}%`}}></div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500/70 relative z-10 w-auto">Conctadas</span>
                                                    <span className="text-lg md:text-xl font-black italic text-white relative z-10">{fmt(stats?.fu_warm_personas_realizados)}</span>
                                                </div>
                                                <div className="h-14 bg-slate-800 border border-rose-500/30 rounded-b-xl flex items-center justify-between px-3 md:px-5 relative overflow-hidden group w-[80%]">
                                                    <div className="absolute inset-y-0 left-0 bg-rose-500/10" style={{width: `${safeCalc(stats?.fu_warm_personas_respondidos, stats?.fu_warm_personas_realizados)}%`}}></div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-500/70 relative z-10 w-auto">Respuestas</span>
                                                    <span className="text-lg md:text-xl font-black italic text-white relative z-10">{fmt(stats?.fu_warm_personas_respondidos)} <span className="text-[9px] text-rose-400/80 not-italic ml-1 hidden lg:inline-block">({safeCalc(stats?.fu_warm_personas_respondidos, stats?.fu_warm_personas_realizados)}%)</span></span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* HOT FUNNEL */}
                                        <div className="bg-slate-800/20 border border-slate-800 rounded-2xl p-4 md:p-6 flex flex-col hover:border-red-500/30 transition-colors shadow-lg shadow-black/20">
                                            <div className="text-center mb-6">
                                                <h4 className="text-sm font-black uppercase tracking-[0.2em] text-red-500">Hot Leads</h4>
                                                <p className="text-[9px] font-black uppercase text-slate-500 mt-1.5">Mjes: {fmt(stats?.fu_hot_mjes_realizados)} / Cto: {fmt(stats?.fu_hot_personas_realizados)}</p>
                                            </div>
                                            <div className="space-y-2 relative py-2 flex flex-col items-center flex-1">
                                                <div className="h-14 bg-slate-800 border border-red-500/30 rounded-t-xl flex items-center justify-between px-3 md:px-5 relative overflow-hidden group w-full">
                                                    <div className="absolute inset-y-0 left-0 bg-red-500/10" style={{width: `100%`}}></div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-red-500/70 relative z-10 w-auto">Disp.</span>
                                                    <span className="text-lg md:text-xl font-black italic text-white relative z-10">{fmt(stats?.fu_hot_personas_disp_fu)}</span>
                                                </div>
                                                <div className="h-14 bg-slate-800 border border-emerald-500/30 rounded-sm flex items-center justify-between px-3 md:px-5 relative overflow-hidden group w-[90%]">
                                                    <div className="absolute inset-y-0 left-0 bg-emerald-500/10" style={{width: `${safeCalc(stats?.fu_hot_personas_realizados, stats?.fu_hot_personas_disp_fu)}%`}}></div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500/70 relative z-10 w-auto">Conctadas</span>
                                                    <span className="text-lg md:text-xl font-black italic text-white relative z-10">{fmt(stats?.fu_hot_personas_realizados)}</span>
                                                </div>
                                                <div className="h-14 bg-slate-800 border border-rose-500/30 rounded-b-xl flex items-center justify-between px-3 md:px-5 relative overflow-hidden group w-[80%]">
                                                    <div className="absolute inset-y-0 left-0 bg-rose-500/10" style={{width: `${safeCalc(stats?.fu_hot_personas_respondidos, stats?.fu_hot_personas_realizados)}%`}}></div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-500/70 relative z-10 w-auto">Respuestas</span>
                                                    <span className="text-lg md:text-xl font-black italic text-white relative z-10">{fmt(stats?.fu_hot_personas_respondidos)} <span className="text-[9px] text-rose-400/80 not-italic ml-1 hidden lg:inline-block">({safeCalc(stats?.fu_hot_personas_respondidos, stats?.fu_hot_personas_realizados)}%)</span></span>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'tracker' && (
                            <div className="animate-in fade-in duration-500 mt-8">
                                <TriageTrackerTable />
                            </div>
                        )}
                    </>
                )}

                <div className="text-center pt-20 pb-10">
                    <p className="text-[9px] text-slate-600 font-black tracking-[0.4em] uppercase">NeurOPS Triage Intelligence Board • © 2026 • AI Powered Dashboard</p>
                </div>
            </div>
        </div>
    );
};

export default PublicTriageStatsPage;
