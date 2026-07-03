import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Loader2, Search, Calendar, Download, TrendingUp, Users, DollarSign,
    AlertCircle, RefreshCcw, Check, Sparkles
} from 'lucide-react';
import usePersistentFilters from '../../hooks/usePersistentFilters';

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
    const [updatingStatus, setUpdatingStatus] = useState(null); // id del cliente que se está actualizando

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
                return 'bg-slate-800/80 border-slate-700 text-slate-300 focus:border-slate-500';
        }
    };

    const formatCurrency = (val) => {
        if (!val || isNaN(val)) return '-';
        return `$${parseFloat(val).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    };

    const formatPaymentWithQty = (monto, cant) => {
        if (!monto || monto === 0) return '-';
        return (
            <div className="flex flex-col items-center justify-center">
                <span className="font-bold text-slate-100">{formatCurrency(monto)}</span>
                {cant > 0 && (
                    <span className="text-[9px] text-slate-500 font-semibold italic">({cant} {cant === 1 ? 'pago' : 'pagos'})</span>
                )}
            </div>
        );
    };

    return (
        <div className="p-6 md:p-10 space-y-8 bg-slate-950/20 backdrop-blur-xl rounded-[2.5rem]">
            
            {/* Cabecera y Herramientas */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/60">
                <div className="space-y-1.5 text-left">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <Sparkles className="text-violet-500" size={20} />
                        Análisis de Clientes Consolidados
                    </h2>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                        Agrupación atómica por Union-Find sobre ventas e historial financiero.
                    </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-black text-[10px] tracking-widest uppercase px-5 py-3.5 rounded-xl shadow-lg shadow-teal-500/10 transition-all active:scale-[0.98]"
                    >
                        <Download size={14} />
                        Exportar CSV
                    </button>
                    <button
                        onClick={fetchClients}
                        className="p-3.5 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-all"
                        title="Refrescar datos"
                    >
                        <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Panel de Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-slate-900/60 p-6 rounded-2xl border border-slate-850 shadow-2xl">
                {/* Rango de Fechas */}
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Periodo Evaluado</label>
                    <div className="flex items-center gap-2 bg-slate-850 border border-slate-800 px-4 py-2.5 rounded-xl text-xs text-white">
                        <Calendar size={13} className="text-slate-500" />
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={e => setFilters({ startDate: e.target.value })}
                            className="bg-transparent border-none text-xs text-slate-200 focus:outline-none cursor-pointer w-full text-center font-bold"
                        />
                        <span className="text-slate-600 text-xs">al</span>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={e => setFilters({ endDate: e.target.value })}
                            className="bg-transparent border-none text-xs text-slate-200 focus:outline-none cursor-pointer w-full text-center font-bold"
                        />
                    </div>
                </div>

                {/* Tipo de Filtro / Filtro de Clientes */}
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Clasificación</label>
                    <div className="flex bg-slate-850 p-1 rounded-xl border border-slate-800">
                        <button
                            type="button"
                            onClick={() => setFilters({ filterType: 'new' })}
                            className={`flex-1 text-center py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                filters.filterType === 'new'
                                    ? 'bg-violet-650/40 border border-violet-500/20 text-violet-300 font-extrabold'
                                    : 'text-slate-500 hover:text-slate-350'
                            }`}
                        >
                            Clientes Nuevos
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilters({ filterType: 'all' })}
                            className={`flex-1 text-center py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                filters.filterType === 'all'
                                    ? 'bg-violet-650/40 border border-violet-500/20 text-violet-300 font-extrabold'
                                    : 'text-slate-500 hover:text-slate-350'
                            }`}
                        >
                            Todos los Pagos
                        </button>
                    </div>
                </div>

                {/* Buscador */}
                <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Buscar Cliente</label>
                    <div className="relative flex items-center">
                        <Search className="absolute left-4 text-slate-500 pointer-events-none" size={14} />
                        <input
                            type="text"
                            placeholder="Nombre, Instagram o Correo..."
                            value={filters.searchQuery}
                            onChange={e => setFilters({ searchQuery: e.target.value })}
                            className="w-full pl-11 pr-5 py-3 bg-slate-850 border border-slate-800 rounded-xl text-xs outline-none text-white focus:border-violet-500/50 font-semibold transition-all placeholder:text-slate-600"
                        />
                    </div>
                </div>
            </div>

            {/* Tarjetas KPI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Alumnos */}
                <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-850/60 hover:border-slate-800 transition-all flex items-center justify-between">
                    <div className="space-y-1 text-left">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Alumnos Filtrados</p>
                        <p className="text-2xl font-black text-white tracking-tight">{kpis.totalClients}</p>
                    </div>
                    <div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl">
                        <Users size={20} />
                    </div>
                </div>

                {/* Total Recaudado Historico */}
                <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-850/60 hover:border-slate-800 transition-all flex items-center justify-between">
                    <div className="space-y-1 text-left">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Recaudado Histórico</p>
                        <p className="text-2xl font-black text-emerald-400 tracking-tight">{formatCurrency(kpis.totalPaid)}</p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                        <DollarSign size={20} />
                    </div>
                </div>

                {/* Deuda Consolidada */}
                <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-850/60 hover:border-slate-800 transition-all flex items-center justify-between">
                    <div className="space-y-1 text-left">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Deuda Pendiente</p>
                        <p className="text-2xl font-black text-rose-400 tracking-tight">{formatCurrency(kpis.totalDebt)}</p>
                    </div>
                    <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
                        <AlertCircle size={20} />
                    </div>
                </div>

                {/* Ratio Exito */}
                <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-850/60 hover:border-slate-800 transition-all flex items-center justify-between">
                    <div className="space-y-1 text-left">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Casos Exitosos</p>
                        <p className="text-2xl font-black text-sky-400 tracking-tight">
                            {kpis.successfulClients} <span className="text-xs text-slate-500 font-bold">({kpis.totalClients > 0 ? ((kpis.successfulClients / kpis.totalClients) * 100).toFixed(0) : 0}%)</span>
                        </p>
                    </div>
                    <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
                        <TrendingUp size={20} />
                    </div>
                </div>
            </div>

            {/* Tabla de Resultados */}
            <div className="bg-slate-900/30 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader2 className="animate-spin text-violet-500" size={36} />
                        <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Consolidando historial de clientes...</p>
                    </div>
                ) : clients.length === 0 ? (
                    <div className="py-24 text-center text-slate-500 text-xs font-bold uppercase tracking-wider italic">
                        No se encontraron clientes para el periodo y filtros indicados.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1200px]">
                            <thead>
                                <tr className="border-b border-slate-850 bg-slate-900/70">
                                    <th className="py-4.5 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center w-28">Fecha Inicio</th>
                                    <th className="py-4.5 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre</th>
                                    <th className="py-4.5 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Programa</th>
                                    <th className="py-4.5 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Seña</th>
                                    <th className="py-4.5 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Completo</th>
                                    <th className="py-4.5 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Parcial</th>
                                    <th className="py-4.5 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Cuotas</th>
                                    <th className="py-4.5 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Renovación</th>
                                    <th className="py-4.5 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Upsells</th>
                                    <th className="py-4.5 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Total Pagado</th>
                                    <th className="py-4.5 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Total a Pagar</th>
                                    <th className="py-4.5 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Deuda</th>
                                    <th className="py-4.5 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center w-48">Follow Up</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence>
                                    {clients.map((c, idx) => {
                                        const cKey = c.instagram || c.email || c.nombre;
                                        return (
                                            <motion.tr
                                                key={cKey}
                                                initial={{ opacity: 0, y: 4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3) }}
                                                className="border-b border-slate-850/60 hover:bg-slate-900/30 transition-all font-semibold"
                                            >
                                                <td className="py-4.5 px-6 text-center text-xs font-mono text-slate-400">{c.fecha || 'Sin fecha'}</td>
                                                <td className="py-4.5 px-6">
                                                    <div className="flex flex-col text-left">
                                                        <span className="text-slate-100 text-xs font-black">{c.nombre}</span>
                                                        <div className="flex flex-wrap gap-2 mt-1">
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
                                                <td className="py-4.5 px-6 text-center">
                                                    <span className="inline-flex items-center justify-center bg-slate-850 border border-slate-800 text-[10px] text-slate-300 font-black px-2.5 py-1 rounded-lg uppercase">
                                                        {c.programa || 'ND'}
                                                    </span>
                                                </td>
                                                <td className="py-4.5 px-4 text-center text-xs text-slate-300">{formatCurrency(c.pagos.sena)}</td>
                                                <td className="py-4.5 px-4 text-center text-xs text-slate-300">{formatCurrency(c.pagos.completo)}</td>
                                                <td className="py-4.5 px-4 text-center text-xs text-slate-300">{formatCurrency(c.pagos.parcial)}</td>
                                                <td className="py-4.5 px-4 text-center text-xs text-slate-300">
                                                    {formatPaymentWithQty(c.pagos.cuotas, c.pagos.cuotas_cant)}
                                                </td>
                                                <td className="py-4.5 px-4 text-center text-xs text-slate-300">
                                                    {formatPaymentWithQty(c.pagos.renovacion, c.pagos.renovacion_cant)}
                                                </td>
                                                <td className="py-4.5 px-4 text-center text-xs text-slate-300">{formatCurrency(c.pagos.upsells)}</td>
                                                <td className="py-4.5 px-6 text-center text-xs font-black text-emerald-400">{formatCurrency(c.total_pagado)}</td>
                                                <td className="py-4.5 px-6 text-center text-xs text-slate-400">{formatCurrency(c.total_a_pagar)}</td>
                                                <td className="py-4.5 px-6 text-center text-xs font-black text-rose-400">{formatCurrency(c.deuda)}</td>
                                                <td className="py-4.5 px-6 text-center">
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
