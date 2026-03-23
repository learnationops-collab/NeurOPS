import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
    Loader2, BarChart3, Target, Layers, Phone, Activity,
    Table, Users
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

            const res = await api.get(`/triage/tracker/stats?${params.toString()}`);
            setStats(res.data);
        } catch (err) {
            console.error("Error fetching triage tracker stats:", err);
        } finally {
            setLoading(false);
        }
    };

    const safeCalc = (val, total) => (total > 0 ? ((val / total) * 100).toFixed(1) : "0.0");
    const fmt = n => (n || 0).toLocaleString();

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

    const TabButton = ({ id, label, icon: Icon }) => (
        <button onClick={() => setActiveTab(id)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-800'}`}>
            <Icon size={14} /> {label}
        </button>
    );

    const ProgressRow = ({ label, percentage, absolute, colorClass }) => (
        <div className="space-y-2">
            <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                    {absolute !== undefined && <span className="text-[10px] font-bold text-slate-600">({absolute})</span>}
                </div>
                <span className={`text-xs font-black ${colorClass}`}>{percentage}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/30">
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
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 relative overflow-hidden">
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

                {/* TABS */}
                <div className="flex flex-wrap items-center gap-4 bg-slate-900/40 p-2 rounded-[2rem] border border-slate-800 w-fit">
                    <TabButton id="general" label="Dashboard" icon={BarChart3} />
                    <TabButton id="tracker" label="Tracker History" icon={Table} />
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
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Pre Call / Starting Process */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 hover:shadow-indigo-500/10 transition-shadow">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                                                    <Phone size={20} />
                                                </div>
                                                <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Starting Process</h3>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Agendas</p>
                                                <p className="text-2xl font-black text-indigo-400 italic">{fmt(stAgendas)}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <ProgressRow label="Confirmando" percentage={safeCalc(stConfirmando, stAgendas)} absolute={fmt(stConfirmando)} colorClass="text-indigo-400" />
                                            <ProgressRow label="Reprogramando" percentage={safeCalc(stReprogramando, stAgendas)} absolute={fmt(stReprogramando)} colorClass="text-violet-400" />
                                            <ProgressRow label="Confirmadas" percentage={safeCalc(stConfirmadas, stAgendas)} absolute={fmt(stConfirmadas)} colorClass="text-emerald-500" />
                                            <ProgressRow label="Canceladas" percentage={safeCalc(stCanceladas, stAgendas)} absolute={fmt(stCanceladas)} colorClass="text-rose-500" />
                                        </div>
                                    </div>

                                    {/* All of Them */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 hover:shadow-pink-500/10 transition-shadow">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-500">
                                                    <Activity size={20} />
                                                </div>
                                                <h3 className="text-xl font-black text-white italic tracking-tight uppercase">All of Them</h3>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Agendas</p>
                                                <p className="text-2xl font-black text-pink-400 italic">{fmt(allAgendas)}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <ProgressRow label="Confirmando" percentage={safeCalc(allConfirmando, allAgendas)} absolute={fmt(allConfirmando)} colorClass="text-pink-400" />
                                            <ProgressRow label="Reprogramando" percentage={safeCalc(allReprogramando, allAgendas)} absolute={fmt(allReprogramando)} colorClass="text-fuchsia-400" />
                                            <ProgressRow label="Confirmadas" percentage={safeCalc(allConfirmadas, allAgendas)} absolute={fmt(allConfirmadas)} colorClass="text-emerald-500" />
                                            <ProgressRow label="Canceladas" percentage={safeCalc(allCanceladas, allAgendas)} absolute={fmt(allCanceladas)} colorClass="text-rose-500" />
                                        </div>
                                    </div>
                                </div>

                                {/* Follow Up Process & Post Confirmation */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    
                                    {/* Follow Up Process Funnel */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 hover:shadow-cyan-500/10 transition-shadow">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500">
                                                    <Users size={20} />
                                                </div>
                                                <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Follow Up Process</h3>
                                            </div>
                                            <div className="text-right bg-slate-800/50 p-2 rounded-xl border border-slate-700/50">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Prom. Mensajes</p>
                                                <p className="text-xl mt-1 font-black text-cyan-400 italic">{avgMessages} <span className="text-[10px] text-slate-500 not-italic">/ cto</span></p>
                                            </div>
                                        </div>
                                        
                                        {/* Pure Funnel Layout */}
                                        <div className="space-y-2 relative py-4 flex flex-col items-center">
                                            {/* Nivel 1 */}
                                            <div className="h-14 bg-slate-800/80 border border-cyan-500/40 rounded-t-2xl flex items-center justify-between px-6 relative overflow-hidden group w-full max-w-sm">
                                                <div className="absolute inset-y-0 left-0 bg-cyan-500/20 transition-all duration-1000" style={{width: `100%`}}></div>
                                                <span className="text-[11px] font-black uppercase tracking-widest text-cyan-400 relative z-10">Disponibles</span>
                                                <span className="text-xl font-black italic shadow-black/50 text-white relative z-10">{fmt(fuDisponibles)}</span>
                                            </div>
                                            {/* Nivel 2 */}
                                            <div className="h-14 bg-slate-800/80 border border-emerald-500/40 rounded-sm flex items-center justify-between px-6 relative overflow-hidden group w-[90%] max-w-[320px]">
                                                <div className="absolute inset-y-0 left-0 bg-emerald-500/20 transition-all duration-1000" style={{width: `${safeCalc(fuContactadas, fuDisponibles)}%`}}></div>
                                                <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 relative z-10">Contactadas</span>
                                                <span className="text-xl font-black italic shadow-black/50 text-white relative z-10">{fmt(fuContactadas)} <span className="text-[10px] font-bold text-emerald-500/70 not-italic ml-1 hidden sm:inline-block">({safeCalc(fuContactadas, fuDisponibles)}%)</span></span>
                                            </div>
                                            {/* Nivel 3 */}
                                            <div className="h-14 bg-slate-800/80 border border-rose-500/40 rounded-b-2xl flex items-center justify-between px-6 relative overflow-hidden group w-[80%] max-w-[280px]">
                                                <div className="absolute inset-y-0 left-0 bg-rose-500/20 transition-all duration-1000" style={{width: `${safeCalc(fuRespondidos, fuContactadas)}%`}}></div>
                                                <span className="text-[11px] font-black uppercase tracking-widest text-rose-400 relative z-10">Respuestas</span>
                                                <span className="text-xl font-black italic shadow-black/50 text-white relative z-10">{fmt(fuRespondidos)} <span className="text-[10px] font-bold text-rose-500/70 not-italic ml-1 hidden sm:inline-block">({safeCalc(fuRespondidos, fuContactadas)}%)</span></span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Post Confirmation Process */}
                                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6 flex flex-col hover:shadow-emerald-500/10 transition-shadow">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                                                    <Target size={20} />
                                                </div>
                                                <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Post Confirmation</h3>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6 flex-1 items-center">
                                            <div className="space-y-4">
                                                <div className="text-center text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-2 rounded-xl">HOY</div>
                                                <MetricCard title="Confirmadas" value={fmt(popConfirmadasHoy)} colorClass="text-emerald-400" />
                                                <MetricCard title="PPC Completo" value={fmt(popPpcHoy)} colorClass="text-teal-400" />
                                            </div>
                                            <div className="space-y-4">
                                                <div className="text-center text-xs font-black uppercase tracking-widest text-teal-400 bg-teal-500/10 border border-teal-500/20 py-2 rounded-xl">ALL</div>
                                                <MetricCard title="Confirmadas" value={fmt(popConfirmadasAll)} colorClass="text-emerald-400" />
                                                <MetricCard title="PPC Completo" value={fmt(popPpcAll)} colorClass="text-teal-400" />
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
