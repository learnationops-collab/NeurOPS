import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Loader2, Search, Calendar, Download, TrendingUp, Users, DollarSign,
    AlertCircle, RefreshCcw, Check, Sparkles, Filter, ChevronDown, X
} from 'lucide-react';
import usePersistentFilters from '../../hooks/usePersistentFilters';
import Card from '../../components/ui/Card';

const getFirstDayOfCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
};

const getTodayDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

const NewClientsTab = () => {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingStatus, setUpdatingStatus] = useState(null);

    const startDateRef = useRef(null);
    const endDateRef = useRef(null);

    // Filtros persistentes
    const { filters, updateFilter: setFilters } = usePersistentFilters('filters_new_clients_view', {
        startDate: getFirstDayOfCurrentMonth(),
        endDate: getTodayDate(),
        filterType: 'new', // 'new' o 'all'
        searchQuery: ''
    });

    const fetchClients = async () => {
        setLoading(true);
        try {
            const res = await api.get('/public/new-clients', {
                params: {
                    start_date: filters.startDate,
                    end_date: filters.endDate,
                    filter_type: filters.filterType,
                    search: filters.searchQuery
                }
            });
            setClients(res.data || []);
        } catch (e) {
            console.error("Error fetching clients:", e);
            toast.error("Error al cargar el listado de clientes.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, [filters.startDate, filters.endDate, filters.filterType, filters.searchQuery]);

    // Manejar cambio de follow up
    const handleFollowUpChange = async (client, newStatus) => {
        const clientKey = client.instagram || client.email || client.nombre;
        setUpdatingStatus(clientKey);
        try {
            await api.post('/public/clients/follow-up', {
                instagram: client.instagram,
                email: client.email,
                nombre_cliente: client.nombre,
                follow_up_status: newStatus
            });
            toast.success(`Estado de ${client.nombre} actualizado a: ${newStatus}`);
            // Actualizar localmente el estado
            setClients(prev => prev.map(c => {
                const cKey = c.instagram || c.email || c.nombre;
                if (cKey === clientKey) {
                    return { ...c, follow_up_status: newStatus };
                }
                return c;
            }));
        } catch (error) {
            console.error("Error updating follow-up status:", error);
            toast.error("No se pudo actualizar el estado.");
        } finally {
            setUpdatingStatus(null);
        }
    };

    // KPIs Calculados basados en la lista de clientes actual
    const kpis = useMemo(() => {
        const totalClients = clients.length;
        const totalPaid = clients.reduce((acc, curr) => acc + (curr.total_pagado || 0), 0);
        const totalDebt = clients.reduce((acc, curr) => acc + (curr.deuda || 0), 0);
        const successfulClients = clients.filter(c => c.follow_up_status === 'Exitoso').length;

        return {
            totalClients,
            totalPaid,
            totalDebt,
            successfulClients
        };
    }, [clients]);

    // Presets de fecha
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

        setFilters({ startDate: start, endDate: end });
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
        
        if (filters.startDate === todayStr && filters.endDate === todayStr) return 'today';
        if (filters.startDate === yesterdayStr && filters.endDate === yesterdayStr) return 'yesterday';
        if (filters.startDate === thisMonthStart && filters.endDate === todayStr) return 'this_month';
        if (filters.startDate === lastMonthStartStr && filters.endDate === lastMonthEndStr) return 'last_month';
        if (filters.startDate === thirtyDaysAgo && filters.endDate === todayStr) return 'last_30_days';
        return 'custom';
    };

    // Función para exportar a CSV
    const exportToCSV = () => {
        if (clients.length === 0) {
            toast.error("No hay registros para exportar");
            return;
        }

        const headers = [
            'Fecha', 'Nombre', 'Programa', 'Seña', 'Completo', 'Parcial',
            'Cuotas', 'Cantidad Cuotas', 'Renovación', 'Cantidad Renovaciones',
            'Upsells', 'Total Pagado', 'Total a Pagar', 'Deuda', 'Estado Seguimiento'
        ];

        const escapeCSVValue = (val) => {
            if (val === null || val === undefined) return '';
            let valStr = String(val).replace(/"/g, '""');
            if (valStr.includes(',') || valStr.includes('\n') || valStr.includes('\r') || valStr.includes('"')) {
                return `"${valStr}"`;
            }
            return valStr;
        };

        const rows = clients.map(c => [
            c.fecha,
            c.nombre,
            c.programa,
            c.pagos.sena || '',
            c.pagos.completo || '',
            c.pagos.parcial || '',
            c.pagos.cuotas || '',
            c.pagos.cuotas_cant || '',
            c.pagos.renovacion || '',
            c.pagos.renovacion_cant || '',
            c.pagos.upsells || '',
            c.total_pagado,
            c.total_a_pagar || '',
            c.deuda || '',
            c.follow_up_status
        ]);

        const csvContent = [
            headers.map(escapeCSVValue).join(','),
            ...rows.map(row => row.map(escapeCSVValue).join(','))
        ].join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fileName = filters.filterType === 'new' ? 'clientes_nuevos' : 'pagos_consolidados';
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileName}_${filters.startDate}_al_${filters.endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("CSV exportado exitosamente");
    };

    // Estilos de los estados de Follow Up
    const getFollowUpStyle = (status) => {
        switch (status) {
            case 'Exitoso':
                return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 focus:border-emerald-500/60';
            case 'Seguimiento':
                return 'bg-amber-500/10 border-amber-500/30 text-amber-400 focus:border-amber-500/60';
            case 'Fallido':
                return 'bg-rose-500/10 border-rose-500/30 text-rose-400 focus:border-rose-500/60';
            case 'Por contactar':
            default:
                return 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300';
        }
    };

    const formatCurrency = (val) => {
        if (!val || isNaN(val)) return '-';
        return `$${parseFloat(val).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    };

    const formatPaymentWithQty = (monto, cant) => {
        if (!monto || monto === 0) return '-';
        return (
            <div className="flex flex-col items-end justify-center font-bold">
                <span className="text-slate-100">{formatCurrency(monto)}</span>
                {cant > 0 && (
                    <span className="text-[9px] text-slate-500 font-semibold italic">({cant} {cant === 1 ? 'pago' : 'pagos'})</span>
                )}
            </div>
        );
    };

    return (
        <div className="w-full p-4 lg:p-8 space-y-6">
            
            {/* Cabecera y Herramientas */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="text-left">
                    <h1 className="text-2xl font-black text-white">Clientes Nuevos</h1>
                    <p className="text-sm text-slate-400">Análisis y seguimiento de clientes consolidados e historial de pagos.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                    <button
                        onClick={exportToCSV}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-teal-500/20"
                    >
                        <Download className="w-4 h-4" />
                        <span>Exportar CSV</span>
                    </button>
                    <button
                        onClick={fetchClients}
                        className="p-2.5 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-350 hover:text-white rounded-xl transition-all shadow-md"
                        title="Refrescar datos"
                    >
                        <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Panel de Filtros Reorganizado */}
            <Card variant="surface" className="p-6 rounded-[2rem] border-slate-800 bg-slate-900/20 backdrop-blur-md space-y-5 shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-2 text-violet-405">
                    <Filter size={16} className="text-violet-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-200">Filtros Inteligentes</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                    {/* Rango de Fechas */}
                    <div className="lg:col-span-4">
                        <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-850 hover:border-slate-700 px-3 py-2 rounded-xl transition-all focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500/30">
                            <Calendar 
                                className="w-3.5 h-3.5 text-slate-450 hover:text-white cursor-pointer shrink-0 transition-colors" 
                                onClick={() => {
                                    try {
                                        startDateRef.current?.showPicker();
                                    } catch (e) {
                                        startDateRef.current?.focus();
                                    }
                                }}
                            />
                            <input
                                ref={startDateRef}
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ startDate: e.target.value })}
                                className="bg-transparent border-none text-xs text-slate-200 focus:outline-none focus:ring-0 cursor-pointer w-full text-center p-0"
                            />
                            <span className="text-slate-600 text-xs shrink-0">-</span>
                            <input
                                ref={endDateRef}
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters({ endDate: e.target.value })}
                                className="bg-transparent border-none text-xs text-slate-200 focus:outline-none focus:ring-0 cursor-pointer w-full text-center p-0"
                            />
                        </div>
                    </div>

                    {/* Atajos de Fecha */}
                    <div className="flex flex-wrap items-center gap-1.5 lg:col-span-4 justify-start">
                        {[
                            { id: 'today', label: 'Hoy' },
                            { id: 'this_month', label: 'Este Mes' },
                            { id: 'last_month', label: 'Mes Anterior' }
                        ].map((preset) => {
                            const isActive = getActiveDatePreset() === preset.id;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => applyDatePreset(preset.id)}
                                    className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-all ${
                                        isActive
                                            ? 'bg-violet-500/15 border-violet-550/40 text-violet-300 shadow-sm shadow-violet-550/5'
                                            : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-350 hover:border-slate-800 hover:scale-[1.01]'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="w-full bg-gradient-to-r from-transparent via-slate-800/40 to-transparent h-px" />

                {/* Fila Secundaria: Selectores */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Clasificación */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">Clasificación</span>
                        <div className="relative">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                            <select
                                value={filters.filterType}
                                onChange={(e) => setFilters({ filterType: e.target.value })}
                                className="w-full bg-slate-950/80 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 text-xs text-slate-200 rounded-xl pl-8 pr-7 py-2 focus:outline-none focus:border-violet-500 cursor-pointer appearance-none transition-all focus:ring-1 focus:ring-violet-500/30 font-semibold"
                            >
                                <option value="new">Clientes Nuevos (Iniciaron)</option>
                                <option value="all">Todos los Pagos (Hicieron Pago)</option>
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-550 pointer-events-none" />
                        </div>
                    </div>

                    {/* Buscador */}
                    <div className="flex flex-col gap-1 md:col-span-3">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">Buscar Cliente</span>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre, instagram o email..."
                                value={filters.searchQuery}
                                onChange={e => setFilters({ searchQuery: e.target.value })}
                                className="w-full bg-slate-950/80 border border-slate-850 hover:border-slate-700 focus:border-violet-500 rounded-xl pl-8 pr-7 py-2 text-xs text-white focus:outline-none placeholder:text-slate-500 transition-all focus:ring-1 focus:ring-violet-500/30 font-semibold"
                            />
                        </div>
                    </div>
                </div>
            </Card>

            {/* Tarjetas KPI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Alumnos */}
                <Card variant="surface" className="p-6 rounded-[2rem] border-slate-800 flex items-center justify-between bg-slate-900/40 backdrop-blur-md">
                    <div className="space-y-1 text-left">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Alumnos Filtrados</p>
                        <p className="text-2xl font-black text-white tracking-tight">{kpis.totalClients}</p>
                    </div>
                    <div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl">
                        <Users size={18} />
                    </div>
                </Card>

                {/* Total Recaudado */}
                <Card variant="surface" className="p-6 rounded-[2rem] border-slate-800 flex items-center justify-between bg-slate-900/40 backdrop-blur-md">
                    <div className="space-y-1 text-left">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Recaudado Histórico</p>
                        <p className="text-2xl font-black text-emerald-400 tracking-tight">{formatCurrency(kpis.totalPaid)}</p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                        <DollarSign size={18} />
                    </div>
                </Card>

                {/* Deuda Consolidada */}
                <Card variant="surface" className="p-6 rounded-[2rem] border-slate-800 flex items-center justify-between bg-slate-900/40 backdrop-blur-md">
                    <div className="space-y-1 text-left">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Deuda Pendiente</p>
                        <p className="text-2xl font-black text-rose-400 tracking-tight">{formatCurrency(kpis.totalDebt)}</p>
                    </div>
                    <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
                        <AlertCircle size={18} />
                    </div>
                </Card>

                {/* Casos Exitosos */}
                <Card variant="surface" className="p-6 rounded-[2rem] border-slate-800 flex items-center justify-between bg-slate-900/40 backdrop-blur-md">
                    <div className="space-y-1 text-left">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Casos Exitosos</p>
                        <p className="text-2xl font-black text-sky-400 tracking-tight">
                            {kpis.successfulClients} <span className="text-xs text-slate-500 font-bold">({kpis.totalClients > 0 ? ((kpis.successfulClients / kpis.totalClients) * 100).toFixed(0) : 0}%)</span>
                        </p>
                    </div>
                    <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
                        <TrendingUp size={18} />
                    </div>
                </Card>
            </div>

            {/* Tabla de Resultados */}
            <div className="space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader2 className="animate-spin text-violet-500" size={36} />
                        <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Consolidando historial de clientes...</p>
                    </div>
                ) : clients.length === 0 ? (
                    <div className="py-24 text-center text-slate-500 text-xs font-bold uppercase tracking-wider italic border border-slate-850 rounded-2xl bg-slate-900/10">
                        No se encontraron clientes para el periodo y filtros indicados.
                    </div>
                ) : (
                    <div className="overflow-auto max-h-[650px] rounded-2xl border border-slate-800 bg-slate-900/10 custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[1200px]">
                            <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 bg-slate-900">
                                    <th className="p-4 font-semibold text-center w-28">Fecha Inicio</th>
                                    <th className="p-4 font-semibold">Cliente</th>
                                    <th className="p-4 font-semibold text-center">Programa</th>
                                    <th className="p-4 font-semibold text-right">Seña</th>
                                    <th className="p-4 font-semibold text-right">Completo</th>
                                    <th className="p-4 font-semibold text-right">Parcial</th>
                                    <th className="p-4 font-semibold text-right">Cuotas</th>
                                    <th className="p-4 font-semibold text-right">Renovación</th>
                                    <th className="p-4 font-semibold text-right">Upsells</th>
                                    <th className="p-4 font-semibold text-right">Total Pagado</th>
                                    <th className="p-4 font-semibold text-right">Total a Pagar</th>
                                    <th className="p-4 font-semibold text-right">Deuda</th>
                                    <th className="p-4 font-semibold text-center w-48">Follow Up</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs text-slate-300 divide-y divide-slate-800/50">
                                <AnimatePresence>
                                    {clients.map((c, idx) => {
                                        const cKey = c.instagram || c.email || c.nombre;
                                        return (
                                            <motion.tr
                                                key={cKey}
                                                initial={{ opacity: 0, y: 4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.2, delay: Math.min(idx * 0.015, 0.3) }}
                                                className="hover:bg-slate-800/30 transition-colors font-medium text-xs"
                                            >
                                                <td className="p-4 text-center font-mono text-slate-400">{c.fecha || 'Sin fecha'}</td>
                                                <td className="p-4">
                                                    <div className="flex flex-col text-left">
                                                        <span className="font-semibold text-white">{c.nombre}</span>
                                                        <div className="flex flex-wrap gap-2 mt-0.5">
                                                            {c.instagram && (
                                                                <a
                                                                    href={`https://instagram.com/${c.instagram.replace('@', '')}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[9px] text-violet-400 hover:text-violet-300 font-bold hover:underline"
                                                                >
                                                                    @{c.instagram.replace('@', '')}
                                                                </a>
                                                            )}
                                                            {c.email && (
                                                                <span className="text-[9px] text-slate-500 font-mono">
                                                                    {c.email}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="inline-flex items-center justify-center bg-slate-850 border border-slate-800 text-[10px] text-slate-300 font-black px-2.5 py-1 rounded-lg uppercase">
                                                        {c.programa || 'ND'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right text-slate-300 font-semibold">{formatCurrency(c.pagos.sena)}</td>
                                                <td className="p-4 text-right text-slate-300 font-semibold">{formatCurrency(c.pagos.completo)}</td>
                                                <td className="p-4 text-right text-slate-300 font-semibold">{formatCurrency(c.pagos.parcial)}</td>
                                                <td className="p-4 text-right text-slate-300">
                                                    {formatPaymentWithQty(c.pagos.cuotas, c.pagos.cuotas_cant)}
                                                </td>
                                                <td className="p-4 text-right text-slate-300">
                                                    {formatPaymentWithQty(c.pagos.renovacion, c.pagos.renovacion_cant)}
                                                </td>
                                                <td className="p-4 text-right text-slate-300 font-semibold">{formatCurrency(c.pagos.upsells)}</td>
                                                <td className="p-4 text-right font-black text-emerald-400">{formatCurrency(c.total_pagado)}</td>
                                                <td className="p-4 text-right text-slate-400 font-semibold">{formatCurrency(c.total_a_pagar)}</td>
                                                <td className="p-4 text-right font-black text-rose-400">{formatCurrency(c.deuda)}</td>
                                                <td className="p-4 text-center">
                                                    <div className="relative inline-flex items-center justify-center w-full">
                                                        {updatingStatus === cKey ? (
                                                            <Loader2 className="animate-spin text-violet-500" size={16} />
                                                        ) : (
                                                            <select
                                                                value={c.follow_up_status}
                                                                onChange={(e) => handleFollowUpChange(c, e.target.value)}
                                                                className={`w-full text-center text-[10px] font-black tracking-wider uppercase py-2 px-3 rounded-xl border outline-none cursor-pointer transition-all ${getFollowUpStyle(c.follow_up_status)}`}
                                                            >
                                                                <option value="Por contactar">Por contactar</option>
                                                                <option value="Seguimiento">Seguimiento</option>
                                                                <option value="Exitoso">Exitoso</option>
                                                                <option value="Fallido">Fallido</option>
                                                            </select>
                                                        )}
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </div>
    );
};

export default NewClientsTab;
