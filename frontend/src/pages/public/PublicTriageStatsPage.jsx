import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import {
    Loader2, BarChart3, Target, CalendarDays, Layers, TrendingUp, Users,
    CheckCircle, XCircle, PhoneOff, RefreshCw, Table, List
} from 'lucide-react';
import TriageReportsTable from './TriageReportsTable';

const PublicTriageStatsPage = () => {
    const [activeTab, setActiveTab] = useState('general'); // 'general', 'history'
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

    // Date calculation based on preset
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

    // Fetch stats
    useEffect(() => {
        if (activeTab === 'history') return;
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

            const res = await api.get(`/public/triage-stats?${params.toString()}`);
            setStats(res.data);
        } catch (err) {
            console.error("Error fetching triage stats:", err);
        } finally {
            setLoading(false);
        }
    };


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

    const ProgressRow = ({ label, percentage, colorClass, absolute }) => (
        <div className="space-y-2">
            <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                    {absolute !== undefined && <span className="text-[10px] font-bold text-slate-600">({absolute})</span>}
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

    const confirmRate = useMemo(() => {
        if (!stats) return 0;
        const n = stats.totals.agendas_nuevas;
        const c = stats.totals.agendas_confirmadas;
        return n > 0 ? ((c / n) * 100).toFixed(1) : 0;
    }, [stats]);

    const showRate = useMemo(() => {
        if (!stats) return 0;
        const c = stats.totals.agendas_confirmadas;
        const a = stats.totals.asistencias;
        return c > 0 ? ((a / c) * 100).toFixed(1) : 0;
    }, [stats]);

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
                                Triage <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">Board</span>
                            </h1>
                        </div>
                        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em]">NeurOPS Triage Performance Analytics</p>
                    </div>
                </div>

                {/* TABS */}
                <div className="flex flex-wrap items-center gap-4 bg-slate-900/40 p-2 rounded-[2rem] border border-slate-800 w-fit">
                    <TabButton id="general" label="Vista General" icon={BarChart3} />
                    <TabButton id="history" label="Historial" icon={List} />
                </div>

                {/* FILTROS */}
                <div className="flex flex-wrap items-center gap-6 bg-slate-900/80 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
                    <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Triage / Equipo</label>
                        <select
                            className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-indigo-500 transition-all cursor-pointer min-w-[200px]"
                            value={filters.triage_name}
                            onChange={e => setFilters({ ...filters, triage_name: e.target.value })}
                        >
                            <option value="">Todo el Equipo ({filters.agg_type === 'sum' ? 'Suma' : 'Promedio'})</option>
                            <option value="Kerwin">Kerwin</option>
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

                {/* CONTENIDO PRINCIPAL */}
                {loading && !stats ? (
                    <div className="flex flex-col items-center justify-center py-40 space-y-4">
                        <Loader2 className="animate-spin text-indigo-500" size={48} />
                        <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Sincronizando datos...</p>
                    </div>
                ) : (
                    <>
                        {stats && activeTab === 'general' && (
                            <div className="space-y-10 animate-in fade-in duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <StatCard title="Agendas Nuevas" value={fmt(stats.totals.agendas_nuevas)} icon={CalendarDays} colorClass="text-indigo-500" />
                                    <StatCard title="Agendas Confirmadas" value={fmt(stats.totals.agendas_confirmadas)} icon={CheckCircle} colorClass="text-emerald-500" />
                                    <StatCard title="Asistencias" value={fmt(stats.totals.asistencias)} icon={Users} colorClass="text-sky-500" />
                                    <StatCard title="No Shows" value={fmt(stats.totals.no_shows)} icon={PhoneOff} colorClass="text-rose-500" />
                                    <StatCard title="Cancelaciones" value={fmt(stats.totals.cancelaciones)} icon={XCircle} colorClass="text-amber-500" />
                                    <StatCard title="Reprogramandos" value={fmt(stats.totals.reprogramandos)} icon={RefreshCw} colorClass="text-violet-500" />
                                </div>

                                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500">
                                            <TrendingUp size={20} />
                                        </div>
                                        <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Conversiones de Triage</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                        <div className="space-y-6">
                                            <ProgressRow 
                                                label="Tasa de Confirmación" 
                                                percentage={confirmRate} 
                                                colorClass="text-indigo-500" 
                                                absolute={`${fmt(stats.totals.agendas_confirmadas)} / ${fmt(stats.totals.agendas_nuevas)}`} 
                                            />
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                                                Mide la efectividad del triage para validar y confirmar las agendas entrantes.
                                            </p>
                                        </div>
                                        <div className="space-y-6">
                                            <ProgressRow 
                                                label="Show Rate (General)" 
                                                percentage={showRate} 
                                                colorClass="text-emerald-500" 
                                                absolute={`${fmt(stats.totals.asistencias)} / ${fmt(stats.totals.agendas_confirmadas)}`} 
                                            />
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                                                Porcentaje de prospectos confirmados que efectivamente asisten a la llamada.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="animate-in fade-in duration-500">
                                <TriageReportsTable />

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
