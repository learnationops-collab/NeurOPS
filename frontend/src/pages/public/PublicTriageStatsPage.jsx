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
        <button 
            onClick={() => setActiveTab(id)} 
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all 
                ${activeTab === id 
                    ? 'bg-white text-indigo-600 shadow-md border border-slate-100 scale-105' 
                    : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}
        >
            <Icon size={14} /> {label}
        </button>
    );

    const ProgressRow = ({ label, absolute, percentage, colorClass }) => (
        <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-500">{label}</span>
                <span className={`font-bold ${colorClass}`}>{fmt(absolute)} ({percentage}%)</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 shadow-inner">
                <div 
                    className={`h-full transition-all duration-1000 ease-out rounded-full ${colorClass.replace('text-', 'bg-')}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>
        </div>
    );

    const ReportSectionHeader = ({ icon: Icon, title, colorClass }) => (
        <div className="flex items-center gap-4 mb-6">
            <div className={`p-3 bg-white shadow-sm border border-slate-100 rounded-2xl`}>
                <Icon className={colorClass} size={20} strokeWidth={2.5} />
            </div>
            <h2 className="text-xl font-black tracking-tight text-slate-800 uppercase italic leading-none">{title}</h2>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f0f4f8] text-slate-900 flex flex-col p-4 md:p-8 lg:p-12 relative overflow-hidden font-sans">
            {/* Ambient Background Elements */}
            <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-200/30 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-teal-100/40 blur-[100px] rounded-full" />

            <div className="w-full max-w-[98%] mx-auto z-10 space-y-10">
                {/* Dashboard Header */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <p className="text-cyan-600 font-black tracking-[0.2em] text-[10px] uppercase ml-1">NeurOPS Triage System</p>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            Triage Stats <span className="text-slate-300 font-light">/</span> <span className="text-indigo-600 italic">Dashboard</span>
                        </h1>
                        <p className="text-slate-500 font-medium text-sm">Performance Analysis Board 🚀</p>
                    </div>

                    <div className="flex bg-slate-200/50 p-1.5 rounded-[1.5rem] border border-slate-200/60 shadow-inner">
                        <TabButton id="general" label="Estadísticas" icon={BarChart3} />
                        <TabButton id="tracker" label="Reportes" icon={Table} />
                    </div>
                </header>

                {/* FILTROS INTEGRADOS */}
                <div className="bg-white/80 backdrop-blur-md border border-white p-6 md:p-8 rounded-[2.5rem] shadow-xl flex flex-wrap items-end gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Triage / Equipo</label>
                        <select 
                            className="bg-white border border-slate-200 text-sm font-bold rounded-[1.25rem] px-5 py-3.5 text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm min-w-[220px] appearance-none" 
                            value={filters.triage_name} 
                            onChange={e => setFilters({ ...filters, triage_name: e.target.value })}
                        >
                            <option value="">Todo el Equipo</option>
                            <option value="Kerwin">Kerwin</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Periodo</label>
                        <select 
                            className="bg-white border border-slate-200 text-sm font-bold rounded-[1.25rem] px-5 py-3.5 text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm min-w-[180px] appearance-none" 
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
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Días</label>
                            <input 
                                type="number" 
                                className="w-24 bg-white border border-slate-200 text-sm font-bold rounded-[1.25rem] px-5 py-3.5 text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-center shadow-sm" 
                                value={filters.custom_days} 
                                onChange={e => setFilters({ ...filters, custom_days: parseInt(e.target.value) || 0 })} 
                            />
                        </div>
                    )}

                    {filters.time_preset === 'custom' && (
                        <>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Desde</label>
                                <input type="date" className="bg-white border border-slate-200 text-sm font-bold rounded-[1.25rem] px-5 py-3.5 text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" value={filters.start_date} onChange={e => setFilters({ ...filters, start_date: e.target.value })} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hasta</label>
                                <input type="date" className="bg-white border border-slate-200 text-sm font-bold rounded-[1.25rem] px-5 py-3.5 text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" value={filters.end_date} onChange={e => setFilters({ ...filters, end_date: e.target.value })} />
                            </div>
                        </>
                    )}

                    <div className="flex bg-slate-100 p-1.5 rounded-[1.25rem] border border-slate-200 shadow-inner ml-auto">
                        <button
                            onClick={() => setFilters({ ...filters, agg_type: 'sum' })}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filters.agg_type === 'sum' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Sumatoria
                        </button>
                        <button
                            onClick={() => setFilters({ ...filters, agg_type: 'avg' })}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filters.agg_type === 'avg' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Promedio
                        </button>
                    </div>
                </div>

                {/* CONTENIDO PRINCIPAL */}
                {loading && !stats && activeTab === 'general' ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-4">
                        <Loader2 className="animate-spin text-indigo-500" size={48} />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Sincronizando Métricas...</p>
                    </div>
                ) : (
                    <>
                        {stats && activeTab === 'general' && (
                            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                
                                {/* ----------------- SECCIÓN DÍA DE HOY (2 COLUMNAS) ----------------- */}
                                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                                    
                                    {/* COLUMNA 1: TABLA PRINCIPAL (Dia de Hoy) */}
                                    <div className="xl:col-span-7 bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-slate-200/50 space-y-8">
                                        <ReportSectionHeader icon={Phone} title="DÍA DE HOY" colorClass="text-indigo-600" />
                                        
                                        <div className="overflow-x-auto w-full">
                                            <table className="w-full min-w-max text-left border-separate border-spacing-y-2">
                                                <thead>
                                                    <tr className="text-slate-400">
                                                        <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest">Variable</th>
                                                        <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-center text-indigo-600/80">Hoy</th>
                                                        <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-center text-pink-600/80">Restantes</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr className="bg-slate-50/50 rounded-2xl overflow-hidden shadow-sm group">
                                                        <td className="py-5 px-6 text-xs font-black uppercase tracking-widest text-slate-800 rounded-l-2xl border-y border-l border-slate-100">Agendas</td>
                                                        <td className="py-5 px-6 text-xl font-black italic text-center text-indigo-600 border-y border-slate-100">{fmt(stAgendas)}</td>
                                                        <td className="py-5 px-6 text-xl font-black italic text-center text-pink-600 rounded-r-2xl border-y border-r border-slate-100">{fmt(allAgendas)}</td>
                                                    </tr>
                                                    <tr className="hover:bg-slate-50/40 transition-colors">
                                                        <td className="py-4 px-6 text-[11px] font-bold uppercase tracking-widest text-slate-500">Confirmando</td>
                                                        <td className="py-4 px-6 text-base font-bold text-center text-slate-700">{fmt(stConfirmando)}</td>
                                                        <td className="py-4 px-6 text-base font-bold text-center text-slate-700">{fmt(allConfirmando)}</td>
                                                    </tr>
                                                    <tr className="hover:bg-slate-50/40 transition-colors">
                                                        <td className="py-4 px-6 text-[11px] font-bold uppercase tracking-widest text-slate-500">Reprogramando</td>
                                                        <td className="py-4 px-6 text-base font-bold text-center text-slate-700">{fmt(stReprogramando)}</td>
                                                        <td className="py-4 px-6 text-base font-bold text-center text-slate-700">{fmt(allReprogramando)}</td>
                                                    </tr>
                                                    <tr className="hover:bg-slate-50/40 transition-colors">
                                                        <td className="py-4 px-6 text-[11px] font-bold uppercase tracking-widest text-emerald-600">Confirmadas</td>
                                                        <td className="py-4 px-6 text-base font-bold text-center text-emerald-600">{fmt(stConfirmadas)}</td>
                                                        <td className="py-4 px-6 text-base font-bold text-center text-emerald-600">{fmt(allConfirmadas)}</td>
                                                    </tr>
                                                    <tr className="hover:bg-slate-50/40 transition-colors">
                                                        <td className="py-4 px-6 text-[11px] font-bold uppercase tracking-widest text-rose-600">Canceladas</td>
                                                        <td className="py-4 px-6 text-base font-bold text-center text-rose-600">{fmt(stCanceladas)}</td>
                                                        <td className="py-4 px-6 text-base font-bold text-center text-rose-600">{fmt(allCanceladas)}</td>
                                                    </tr>
                                                    <tr className="hover:bg-slate-50/40 transition-colors border-t border-slate-100">
                                                        <td className="py-4 px-6 text-[11px] font-bold uppercase tracking-widest text-amber-600">Inciertas</td>
                                                        <td className="py-4 px-6 text-base font-bold text-center text-amber-600">{fmt(stInciertas)}</td>
                                                        <td className="py-4 px-6 text-base font-bold text-center text-amber-600">{fmt(allInciertas)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* COLUMNA 2: COMPARATIVA DE PROCESOS (En proceso + Completos) */}
                                    <div className="xl:col-span-5 bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-slate-200/50 space-y-10 flex flex-col justify-between h-full">
                                        
                                        {/* Bloque: En proceso */}
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                                                <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
                                                    <Activity size={18} strokeWidth={3} />
                                                </div>
                                                <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 italic">En Proceso</h4>
                                            </div>

                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="space-y-5">
                                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-2">Hoy</p>
                                                    <ProgressRow label="Confirmando" absolute={stConfirmando} percentage={safeCalc(stConfirmando, stProcessTotal)} colorClass="text-indigo-600" />
                                                    <ProgressRow label="Reprog." absolute={stReprogramando} percentage={safeCalc(stReprogramando, stProcessTotal)} colorClass="text-fuchsia-600" />
                                                </div>
                                                <div className="space-y-5 border-l border-slate-50 pl-8">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Gen.</p>
                                                    <ProgressRow label="Confirmando" absolute={allConfirmando} percentage={safeCalc(allConfirmando, allProcessTotal)} colorClass="text-indigo-500" />
                                                    <ProgressRow label="Reprog." absolute={allReprogramando} percentage={safeCalc(allReprogramando, allProcessTotal)} colorClass="text-fuchsia-500" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bloque: Completos */}
                                        <div className="space-y-6 pt-4 border-t border-slate-50">
                                            <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                                                <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600">
                                                    <ListChecks size={18} strokeWidth={3} />
                                                </div>
                                                <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 italic">Completos</h4>
                                            </div>

                                            <div className="grid grid-cols-2 gap-8">
                                                <div className="space-y-5">
                                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-2">Hoy</p>
                                                    <ProgressRow label="Confirmadas" absolute={stConfirmadas} percentage={safeCalc(stConfirmadas, stCompletosTotal)} colorClass="text-emerald-600" />
                                                    <ProgressRow label="Canceladas" absolute={stCanceladas} percentage={safeCalc(stCanceladas, stCompletosTotal)} colorClass="text-rose-600" />
                                                    <ProgressRow label="Inciertas" absolute={stInciertas} percentage={safeCalc(stInciertas, stCompletosTotal)} colorClass="text-amber-600" />
                                                </div>
                                                <div className="space-y-5 border-l border-slate-50 pl-8">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Gen.</p>
                                                    <ProgressRow label="Confirmadas" absolute={allConfirmadas} percentage={safeCalc(allConfirmadas, allCompletosTotal)} colorClass="text-emerald-500" />
                                                    <ProgressRow label="Canceladas" absolute={allCanceladas} percentage={safeCalc(allCanceladas, allCompletosTotal)} colorClass="text-rose-500" />
                                                    <ProgressRow label="Inciertas" absolute={allInciertas} percentage={safeCalc(allInciertas, allCompletosTotal)} colorClass="text-amber-500" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>


                                {/* ----------------- RECORDATORIOS (Premium Card) ----------------- */}
                                <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-slate-200/50 space-y-8">
                                    <ReportSectionHeader icon={Target} title="RECORDATORIOS" colorClass="text-emerald-600" />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-5">
                                            <div className="text-center text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-100 py-3 rounded-2xl">HOY</div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="bg-slate-50 border border-slate-100 p-5 rounded-[1.5rem] text-center">
                                                    <div className="text-[9px] font-black uppercase text-slate-400 mb-2">Totales</div>
                                                    <div className="text-3xl font-black italic text-slate-800">{fmt(popConfirmadasHoy)}</div>
                                                </div>
                                                <div className="bg-slate-50 border border-slate-100 p-5 rounded-[1.5rem] text-center">
                                                    <div className="text-[9px] font-black uppercase text-slate-400 mb-2">PPC COMPL</div>
                                                    <div className="text-3xl font-black italic text-slate-800">{fmt(popPpcHoy)}</div>
                                                </div>
                                                <div className="bg-emerald-600 p-5 rounded-[1.5rem] text-center shadow-lg shadow-emerald-200">
                                                    <div className="text-[9px] font-black uppercase text-emerald-100 mb-2">% EFECT.</div>
                                                    <div className="text-2xl font-black italic text-white">{safeCalc(popPpcHoy, popConfirmadasHoy)}%</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            <div className="text-center text-[10px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 border border-teal-100 py-3 rounded-2xl">RESTANTES</div>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="bg-slate-50 border border-slate-100 p-5 rounded-[1.5rem] text-center">
                                                    <div className="text-[9px] font-black uppercase text-slate-400 mb-2">Totales</div>
                                                    <div className="text-3xl font-black italic text-slate-800">{fmt(popConfirmadasAll)}</div>
                                                </div>
                                                <div className="bg-slate-50 border border-slate-100 p-5 rounded-[1.5rem] text-center">
                                                    <div className="text-[9px] font-black uppercase text-slate-400 mb-2">PPC COMPL</div>
                                                    <div className="text-3xl font-black italic text-slate-800">{fmt(popPpcAll)}</div>
                                                </div>
                                                <div className="bg-teal-600 p-5 rounded-[1.5rem] text-center shadow-lg shadow-teal-200">
                                                    <div className="text-[9px] font-black uppercase text-teal-100 mb-2">% EFECT.</div>
                                                    <div className="text-2xl font-black italic text-white">{safeCalc(popPpcAll, popConfirmadasAll)}%</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* ----------------- FOLLOW UP PROCESS (Clean Grid) ----------------- */}
                                <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-slate-200/50 space-y-8">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-50 pb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-cyan-50 border border-cyan-100 rounded-2xl text-cyan-600">
                                                <Users size={20} strokeWidth={2.5} />
                                            </div>
                                            <h2 className="text-2xl font-black tracking-tight text-slate-800 uppercase italic">Follow Up Stats</h2>
                                        </div>
                                        <div className="bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200 pr-4">Global Message Avg</p>
                                            <p className="text-2xl font-black text-cyan-600 italic leading-none">{avgMessages} <span className="text-[10px] text-slate-400 not-italic uppercase">msg/cto</span></p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        {/* Funnel: Cold */}
                                        <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100 space-y-8">
                                            <div className="text-center">
                                                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-600">Cold Pipeline</h4>
                                                <p className="text-[9px] font-black uppercase text-slate-400 mt-2">Majes: {fmt(stats?.fu_cold_mjes_realizados)} • Cto: {fmt(stats?.fu_cold_personas_realizados)}</p>
                                            </div>
                                            <div className="space-y-3 px-4">
                                                <div className="bg-white border border-slate-100 p-4 rounded-xl flex justify-between items-center shadow-sm">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disponibles</span>
                                                    <span className="text-xl font-black text-slate-800 italic">{fmt(stats?.fu_cold_personas_disp_fu)}</span>
                                                </div>
                                                <div className="bg-white border border-emerald-100 p-4 rounded-xl flex justify-between items-center shadow-sm">
                                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Contactadas</span>
                                                    <span className="text-xl font-black text-slate-800 italic">{fmt(stats?.fu_cold_personas_realizados)}</span>
                                                </div>
                                                <div className="bg-emerald-600 p-4 rounded-xl flex justify-between items-center shadow-lg shadow-emerald-100">
                                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Respondidas</span>
                                                    <span className="text-xl font-black text-white italic">{fmt(stats?.fu_cold_personas_respondidos)} <span className="text-[10px] not-italic opacity-80">({safeCalc(stats?.fu_cold_personas_respondidos, stats?.fu_cold_personas_realizados)}%)</span></span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Funnel: Warm */}
                                        <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100 space-y-8">
                                            <div className="text-center">
                                                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Warm Pipeline</h4>
                                                <p className="text-[9px] font-black uppercase text-slate-400 mt-2">Majes: {fmt(stats?.fu_warm_mjes_realizados)} • Cto: {fmt(stats?.fu_warm_personas_realizados)}</p>
                                            </div>
                                            <div className="space-y-3 px-4">
                                                <div className="bg-white border border-slate-100 p-4 rounded-xl flex justify-between items-center shadow-sm">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disponibles</span>
                                                    <span className="text-xl font-black text-slate-800 italic">{fmt(stats?.fu_warm_personas_disp_fu)}</span>
                                                </div>
                                                <div className="bg-white border border-emerald-100 p-4 rounded-xl flex justify-between items-center shadow-sm">
                                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Contactadas</span>
                                                    <span className="text-xl font-black text-slate-800 italic">{fmt(stats?.fu_warm_personas_realizados)}</span>
                                                </div>
                                                <div className="bg-orange-600 p-4 rounded-xl flex justify-between items-center shadow-lg shadow-orange-100">
                                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Respondidas</span>
                                                    <span className="text-xl font-black text-white italic">{fmt(stats?.fu_warm_personas_respondidos)} <span className="text-[10px] not-italic opacity-80">({safeCalc(stats?.fu_warm_personas_respondidos, stats?.fu_warm_personas_realizados)}%)</span></span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Funnel: Hot */}
                                        <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100 space-y-8">
                                            <div className="text-center">
                                                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-rose-600">Hot Pipeline</h4>
                                                <p className="text-[9px] font-black uppercase text-slate-400 mt-2">Majes: {fmt(stats?.fu_hot_mjes_realizados)} • Cto: {fmt(stats?.fu_hot_personas_realizados)}</p>
                                            </div>
                                            <div className="space-y-3 px-4">
                                                <div className="bg-white border border-slate-100 p-4 rounded-xl flex justify-between items-center shadow-sm">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disponibles</span>
                                                    <span className="text-xl font-black text-slate-800 italic">{fmt(stats?.fu_hot_personas_disp_fu)}</span>
                                                </div>
                                                <div className="bg-white border border-emerald-100 p-4 rounded-xl flex justify-between items-center shadow-sm">
                                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Contactadas</span>
                                                    <span className="text-xl font-black text-slate-800 italic">{fmt(stats?.fu_hot_personas_realizados)}</span>
                                                </div>
                                                <div className="bg-rose-600 p-4 rounded-xl flex justify-between items-center shadow-lg shadow-rose-100">
                                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Respondidas</span>
                                                    <span className="text-xl font-black text-white italic">{fmt(stats?.fu_hot_personas_respondidos)} <span className="text-[10px] not-italic opacity-80">({safeCalc(stats?.fu_hot_personas_respondidos, stats?.fu_hot_personas_realizados)}%)</span></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'tracker' && (
                            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-xl animate-in fade-in duration-700 mt-8">
                                <TriageTrackerTable />
                            </div>
                        )}
                    </>
                )}

                <footer className="text-center pt-20 pb-10">
                    <p className="text-[10px] text-slate-400 font-black tracking-[0.4em] uppercase">NeurOPS Triage Intelligence • Executive Dashboard • © 2026</p>
                </footer>
            </div>
        </div>
    );
};

export default PublicTriageStatsPage;
