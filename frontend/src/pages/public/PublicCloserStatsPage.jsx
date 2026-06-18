import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import api from '../../services/api';
import {
    Loader2, BarChart3, DollarSign, CalendarDays, Layers, Users, List, PenTool
} from 'lucide-react';
import usePersistentFilters from '../../hooks/usePersistentFilters';
import CloserPerformanceTab from './CloserPerformanceTab';
import CloserReportsTable from './CloserReportsTable';
import PublicFinancialSalesPage from './PublicFinancialSalesPage';
import FinancialAgendasPage from '../admin/reports/FinancialAgendasPage';

const getFirstDayOfCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
};

const getTodayDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

const PublicCloserStatsPage = () => {
    const auth = useAuth();
    const user = auth?.user || { role: 'admin' };
    const navigate = useNavigate();
    const { filters: tabFilters, updateFilter: setTabFilters } = usePersistentFilters('closer_active_tab', {
        active: 'performance'
    });
    const activeTab = tabFilters.active;
    const setActiveTab = (val) => setTabFilters({ active: val });

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [closers, setClosers] = useState([]);

    const { filters, updateFilter: setFilters } = usePersistentFilters('filters_closer_stats', {
        closer_id: user.role === 'closer' && user.id ? user.id.toString() : '3',
        start_date: getFirstDayOfCurrentMonth(),
        end_date: getTodayDate(),
        agg_type: 'sum',
        compare: false
    });

    const applyDatePreset = (preset) => {
        const today = new Date();
        let start = '';
        let end = today.toISOString().split('T')[0];

        if (preset === 'today') {
            start = end;
        } else if (preset === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);
            start = yesterday.toISOString().split('T')[0];
            end = start;
        } else if (preset === 'this_month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        } else if (preset === 'last_month') {
            const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            start = firstOfLastMonth.toISOString().split('T')[0];
            end = lastOfLastMonth.toISOString().split('T')[0];
        } else if (preset === 'last_30_days') {
            const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            start = thirtyDaysAgo.toISOString().split('T')[0];
        }

        setFilters({ start_date: start, end_date: end });
    };

    const getActiveDatePreset = () => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        
        const lastMonthFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthLast = new Date(today.getFullYear(), today.getMonth(), 0);
        const lastMonthStartStr = lastMonthFirst.toISOString().split('T')[0];
        const lastMonthEndStr = lastMonthLast.toISOString().split('T')[0];
        
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        if (filters.start_date === todayStr && filters.end_date === todayStr) return 'today';
        if (filters.start_date === yesterdayStr && filters.end_date === yesterdayStr) return 'yesterday';
        if (filters.start_date === thisMonthStart && filters.end_date === todayStr) return 'this_month';
        if (filters.start_date === lastMonthStartStr && filters.end_date === lastMonthEndStr) return 'last_month';
        if (filters.start_date === thirtyDaysAgo && filters.end_date === todayStr) return 'last_30_days';
        return 'custom';
    };

    // Asegurar fechas válidas al inicio
    useEffect(() => {
        if (!filters.start_date || !filters.end_date) {
            setFilters({
                start_date: filters.start_date || getFirstDayOfCurrentMonth(),
                end_date: filters.end_date || getTodayDate()
            });
        }
    }, [filters.start_date, filters.end_date]);

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
        if (activeTab !== 'performance') {
            setLoading(false);
            return;
        }
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
            if (filters.compare) params.append('compare', 'true');

            const res = await api.get(`/public/closer-stats?${params.toString()}`);
            setStats(res.data);
        } catch (err) {
            console.error("Error fetching closer stats:", err);
        } finally {
            setLoading(false);
        }
    };

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
                    <TabButton id="performance" label="Rendimiento" icon={BarChart3} />
                    <TabButton id="history" label="Historial de Reportes" icon={List} />
                    <TabButton id="sales_log" label="Registro Ventas" icon={DollarSign} />
                    <TabButton id="agendas_log" label="Registro Agendas" icon={CalendarDays} />
                </div>

                {/* FILTROS (Comunes para vista rendimiento) */}
                {activeTab === 'performance' && (
                    <div className="flex flex-wrap items-center gap-6 bg-slate-900/80 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
                        {/* Closer Selector */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Closer / Equipo</label>
                            <select
                                className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-4 py-2 text-white outline-none focus:border-violet-500 transition-all cursor-pointer min-w-[200px]"
                                value={filters.closer_id}
                                onChange={e => setFilters({ closer_id: e.target.value })}
                            >
                                <option value="">Todo el Equipo</option>
                                {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        {/* Date Range Selector */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Rango de Fechas</label>
                            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-xs text-white">
                                <input
                                    type="date"
                                    value={filters.start_date}
                                    onChange={e => setFilters({ start_date: e.target.value })}
                                    className="bg-transparent border-none text-xs text-slate-200 focus:outline-none cursor-pointer w-28 text-center font-bold"
                                />
                                <span className="text-slate-500 text-xs">-</span>
                                <input
                                    type="date"
                                    value={filters.end_date}
                                    onChange={e => setFilters({ end_date: e.target.value })}
                                    className="bg-transparent border-none text-xs text-slate-200 focus:outline-none cursor-pointer w-28 text-center font-bold"
                                />
                            </div>
                        </div>

                        {/* Quick Preset Buttons */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Periodos Rápidos</label>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {[
                                    { id: 'today', label: 'Hoy' },
                                    { id: 'yesterday', label: 'Ayer' },
                                    { id: 'last_month', label: 'Mes anterior' },
                                    { id: 'this_month', label: 'Este mes' },
                                    { id: 'last_30_days', label: 'Últimos 30 días' }
                                ].map((preset) => {
                                    const isActive = getActiveDatePreset() === preset.id;
                                    return (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => applyDatePreset(preset.id)}
                                            className={`text-[9px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl border transition-all ${
                                                isActive
                                                    ? 'bg-violet-650/30 border-violet-500/50 text-violet-300 shadow-lg shadow-violet-600/10'
                                                    : 'bg-slate-850/40 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                                            }`}
                                        >
                                            {preset.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Switch de Comparación */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Comparación</label>
                            <div className="flex items-center gap-2.5 bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 min-h-[38px]">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Comparar</span>
                                <button
                                    onClick={() => setFilters({ compare: !filters.compare })}
                                    type="button"
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                                        filters.compare ? 'bg-violet-600 shadow-lg shadow-violet-600/20' : 'bg-slate-900 border border-slate-750'
                                    }`}
                                >
                                    <motion.span
                                        layout
                                        className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md"
                                        animate={{ x: filters.compare ? 16 : 2 }}
                                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                    />
                                </button>
                            </div>
                        </div>

                    </div>
                )}

                {/* CONTENIDO PRINCIPAL */}
                {loading && !stats ? (
                    <div className="flex flex-col items-center justify-center py-40 space-y-4">
                        <Loader2 className="animate-spin text-violet-500" size={48} />
                        <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Sincronizando datos...</p>
                    </div>
                ) : (
                    <>
                        {stats && activeTab === 'performance' && (
                            <CloserPerformanceTab 
                                stats={stats} 
                                loading={loading} 
                                compare={filters.compare} 
                                setActiveTab={setActiveTab}
                                setFilters={setFilters}
                            />
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
