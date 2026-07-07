import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
    Users, Layers, Search, Check, X, ChevronRight, Loader2,
    Calendar, Phone, Mail, Instagram, ExternalLink, Clock,
    RefreshCw, CalendarDays, AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import LeadRoadmapDetail from '../../components/leads/LeadRoadmapDetail';

const CloserWorkflowPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    
    const activeStep = searchParams.get('step') || 'agendas';

    // Agendas y carga
    const [agendas, setAgendas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [submittingBulk, setSubmittingBulk] = useState(false);
    
    // Selección masiva y búsqueda local
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [decisionMakerPrompt, setDecisionMakerPrompt] = useState({ apptId: null });
    const [selectedDate, setSelectedDate] = useState(() => {
        const offset = new Date().getTimezoneOffset();
        const localDate = new Date(new Date().getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    });
    
    // Cita seleccionada para el visor de la derecha
    const [selectedLead, setSelectedLead] = useState(null);

    // Estado para reprogramación individual
    const [rescheduleData, setRescheduleData] = useState({ apptId: null, date: '', status: '' });

    // Cargar agendas del día del closer
    const fetchAgendas = async () => {
        setLoading(true);
        try {
            const url = activeStep === 'agendas'
                ? `/closer/deck?step=${activeStep}&selected_date=${selectedDate}`
                : `/closer/deck?step=${activeStep}`;
            const res = await api.get(url);
            setAgendas(res.data || []);
            setSelectedIds(new Set());
            // Si el lead actualmente seleccionado ya no está en la cola, deseleccionarlo
            if (selectedLead && !res.data.some(l => l.id === selectedLead.id)) {
                setSelectedLead(null);
            }
        } catch (err) {
            console.error("Error al cargar agendas:", err);
            toast.error("Error al cargar las agendas");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgendas();
    }, [activeStep, selectedDate]);

    // Filtrar localmente por búsqueda
    const filteredAgendas = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return agendas;
        return agendas.filter(a => 
            (a.lead_name && a.lead_name.toLowerCase().includes(query)) ||
            (a.instagram && a.instagram.toLowerCase().includes(query)) ||
            (a.email && a.email.toLowerCase().includes(query))
        );
    }, [agendas, searchQuery]);

    // Procesar acción rápida (Asistió, No Show, Canceló)
    const handleQuickAction = async (leadId, nextStatus, e) => {
        if (e) e.stopPropagation();
        
        if (nextStatus === 'Completada') {
            setDecisionMakerPrompt({ apptId: leadId });
            return;
        }
        
        let note = null;
        if (nextStatus === 'Cancelada') {
            note = window.prompt("Escribe la razón de la cancelación para el Lead Roadmap:");
            if (note === null) return;
            if (!note.trim()) {
                toast.error("La razón de la cancelación es requerida");
                return;
            }
        }
        
        await executeQuickAction(leadId, nextStatus === 'Cancelada' ? 'Cancelado' : nextStatus, null, note);
    };

    const executeQuickAction = async (leadId, nextStatus, withDecisionMaker, note = null) => {
        setProcessingId(leadId);
        try {
            const payload = { status: nextStatus === 'Completada' ? 'Show up' : nextStatus, role: 'closer' };
            if (withDecisionMaker !== null && withDecisionMaker !== undefined) {
                payload.with_decision_maker = withDecisionMaker;
            }
            if (note) {
                payload.note = note;
            }
            await api.post(`/closer/appointments/${leadId}/process`, payload);
            toast.success("Agenda actualizada correctamente");
            
            // Actualizar lista local
            setAgendas(prev => prev.map(a => a.id === leadId ? { 
                ...a, 
                closer_result: nextStatus === 'Completada' ? 'Show up' : nextStatus,
                with_decision_maker: withDecisionMaker
            } : a));
            if (selectedLead?.id === leadId) {
                setSelectedLead(prev => ({ 
                    ...prev, 
                    closer_result: nextStatus === 'Completada' ? 'Show up' : nextStatus,
                    with_decision_maker: withDecisionMaker
                }));
            }
        } catch (err) {
            console.error("Error al procesar acción rápida:", err);
            toast.error("Error al actualizar el estado");
        } finally {
            setProcessingId(null);
            setDecisionMakerPrompt({ apptId: null });
        }
    };

    // Confirmar reprogramación o segunda agenda
    const handleConfirmReschedule = async (e) => {
        if (e) e.stopPropagation();
        const { apptId, date, status } = rescheduleData;
        if (!date) {
            toast.error("Selecciona una fecha y hora");
            return;
        }

        setProcessingId(apptId);
        try {
            await api.post(`/closer/appointments/${apptId}/process`, {
                status: status,
                reschedule_date: date
            });
            toast.success(status === 'Reprogramada' ? "Cita reprogramada" : "Segunda llamada agendada");
            
            // Cerrar panel de reprogramación y recargar datos
            setRescheduleData({ apptId: null, date: '', status: '' });
            fetchAgendas();
        } catch (err) {
            console.error("Error al reprogramar:", err);
            toast.error("Error al procesar el cambio de fecha");
        } finally {
            setProcessingId(null);
        }
    };

    // Actualización masiva (Asistió, No Show, Canceló)
    const handleBulkUpdate = async (bulkResult) => {
        if (selectedIds.size === 0) return;
        setSubmittingBulk(true);
        try {
            const payload = {
                appt_ids: Array.from(selectedIds),
                result: bulkResult
            };
            await api.post(`/closer/deck/bulk-update`, payload);
            toast.success("Agendas actualizadas masivamente");
            fetchAgendas();
        } catch (err) {
            console.error("Error en lote:", err);
            toast.error("Error al procesar en lote");
        } finally {
            setSubmittingBulk(false);
        }
    };

    // Selección de elementos
    const toggleSelect = (id, e) => {
        if (e) e.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredAgendas.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredAgendas.map(a => a.id)));
        }
    };

    // Formatear fecha para input datetime-local
    const formatToDatetimeLocal = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '';
            const offset = d.getTimezoneOffset();
            const localDate = new Date(d.getTime() - (offset * 60 * 1000));
            return localDate.toISOString().slice(0, 16);
        } catch (e) {
            return '';
        }
    };

    // Formatear hora de inicio
    const formatTimeOnly = (isoStr) => {
        if (!isoStr) return '';
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    };

    return (
        <div className="h-screen overflow-y-auto bg-slate-950 text-slate-100 flex flex-col custom-scrollbar pb-32">
            
            {/* Header del Espacio de Trabajo */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-white italic uppercase tracking-tight flex items-center gap-2">
                            Closer Workspace
                        </h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            Flujo de Trabajo Operativo • 1. Agendas del Día
                        </p>
                    </div>

                    {/* Controles de Búsqueda y Filtro de Fecha */}
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        {activeStep === 'agendas' && (
                            <div className="relative">
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-slate-900 border border-slate-800/80 rounded-xl px-4 py-2 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all cursor-pointer font-bold"
                                />
                            </div>
                        )}
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                            <input
                                type="text"
                                placeholder="Buscar lead por nombre o IG..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all font-bold"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Área de Trabajo Principal */}
            <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Columna Izquierda: Cola de Citas del Día */}
                <div className="lg:col-span-7 space-y-4">
                    
                    {/* Barra de Acciones Masivas */}
                    {selectedIds.size > 0 && (
                        <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-left animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-400 px-3 py-1.5 rounded-xl border border-violet-500/20">
                                    {selectedIds.size} Agendas Marcadas
                                </span>
                                <button 
                                    onClick={() => setSelectedIds(new Set())}
                                    className="text-[9px] font-black uppercase text-slate-500 hover:text-white underline cursor-pointer"
                                >
                                    Limpiar
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleBulkUpdate('Completada')}
                                    disabled={submittingBulk}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-650/20"
                                >
                                    ✓ Asistió
                                </button>
                                <button
                                    onClick={() => handleBulkUpdate('No Show')}
                                    disabled={submittingBulk}
                                    className="px-4 py-2 bg-rose-650 hover:bg-rose-555 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-650/20"
                                >
                                    ✕ No Show
                                </button>
                                <button
                                    onClick={() => handleBulkUpdate('Cancelada')}
                                    disabled={submittingBulk}
                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-650/20"
                                >
                                    ✕ Canceló
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Contenedor de la Lista */}
                    <div className="bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 shadow-xl space-y-4">
                        
                        <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={filteredAgendas.length > 0 && selectedIds.size === filteredAgendas.length}
                                    onChange={toggleSelectAll}
                                    className="rounded bg-slate-950 border-slate-800 text-violet-500 focus:ring-0 cursor-pointer w-4 h-4"
                                />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Seleccionar Todos
                                </span>
                            </div>
                            <span className="text-[10px] font-black bg-slate-900 text-slate-350 border border-slate-800 px-3 py-1 rounded-xl">
                                {filteredAgendas.length} Confirmadas Hoy
                            </span>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="animate-spin text-violet-500" size={32} />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cargando agendas...</span>
                            </div>
                        ) : filteredAgendas.length === 0 ? (
                            <div className="text-center py-16 text-slate-500 text-xs font-bold uppercase tracking-wide">
                                👏 No tienes agendas programadas para el día de hoy.
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                                <AnimatePresence initial={false}>
                                    {filteredAgendas.map((a) => {
                                        const isSelected = selectedIds.has(a.id);
                                        const isViewed = selectedLead?.id === a.id;
                                        const isRescheduling = rescheduleData.apptId === a.id;
                                        
                                        return (
                                            <motion.div
                                                key={a.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                onClick={() => setSelectedLead(a)}
                                                className={`p-4 rounded-2xl border transition-all cursor-pointer text-left flex flex-col gap-3 relative overflow-hidden group ${
                                                    isViewed 
                                                        ? 'bg-violet-650/10 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.1)]' 
                                                        : 'bg-black/20 border-slate-900/60 hover:bg-slate-900/50 hover:border-slate-800'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    {/* Checkbox y Nombre */}
                                                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => toggleSelect(a.id, e)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="rounded bg-slate-950 border-slate-800 text-violet-500 focus:ring-0 cursor-pointer w-4 h-4 shrink-0"
                                                        />
                                                        
                                                        <div className="min-w-0 space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                                    <Clock size={10} />
                                                                    {formatTimeOnly(a.start_time)}
                                                                </span>
                                                                <h4 className="text-sm font-black text-white leading-tight truncate">
                                                                    {a.lead_name || 'Sin Nombre'}
                                                                </h4>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-2 flex-wrap mt-1">
                                                                <span className="text-[8px] font-black uppercase text-slate-500 bg-slate-950 border border-slate-900 px-2 py-0.5 rounded-md">
                                                                    {a.origin || 'Sheets'}
                                                                </span>
                                                                <span className="text-[8px] font-black uppercase text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md">
                                                                    Confirmer: {a.result || 'Pendiente'}
                                                                </span>
                                                                {a.is_rescheduled && (
                                                                    <span className="text-[8px] font-black uppercase text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-md">
                                                                        Reagenda
                                                                    </span>
                                                                )}
                                                                {a.instagram && (
                                                                    <span className="text-[10px] text-slate-500 flex items-center gap-0.5 font-mono">
                                                                        @{a.instagram}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Estado actual e indicador */}
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className={`text-[9px] font-black px-2 py-1 rounded-xl uppercase tracking-wider ${
                                                            a.closer_result === 'Show up' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                                                            a.closer_result === 'No Show' ? 'bg-rose-500/10 text-rose-450 border border-rose-500/20' :
                                                            a.closer_result === 'Cancelado' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                                                            a.closer_result === 'Reagendado' ? 'bg-violet-500/10 text-violet-450 border border-violet-500/20' :
                                                            a.closer_result === '2da call' ? 'bg-blue-500/10 text-blue-450 border border-blue-500/20' :
                                                            'bg-slate-500/10 text-slate-450 border border-slate-500/20'
                                                        }`}>
                                                            {a.closer_result || 'Pendiente'}
                                                        </span>
                                                        <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                                                    </div>
                                                 </div>
                                                    {/* Acciones Rápidas */}
                                                {!isRescheduling && (
                                                    <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-900/60" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={(e) => handleQuickAction(a.id, 'Completada', e)}
                                                            disabled={processingId === a.id}
                                                            className="h-7 px-2.5 bg-emerald-600/90 hover:bg-emerald-500 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                        >
                                                            Asistió
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleQuickAction(a.id, 'No Show', e)}
                                                            disabled={processingId === a.id}
                                                            className="h-7 px-2.5 bg-rose-650/90 hover:bg-rose-550 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                        >
                                                            No Show
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleQuickAction(a.id, 'Cancelada', e)}
                                                            disabled={processingId === a.id}
                                                            className="h-7 px-2.5 bg-amber-600/90 hover:bg-amber-505 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                        >
                                                            Canceló
                                                        </button>
                                                        <button
                                                            onClick={() => setRescheduleData({ apptId: a.id, date: '', status: 'Reprogramada' })}
                                                            disabled={processingId === a.id}
                                                            className="h-7 px-2.5 bg-violet-650/80 hover:bg-violet-550 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                        >
                                                            Reagendar
                                                        </button>
                                                        <button
                                                            onClick={() => setRescheduleData({ apptId: a.id, date: '', status: 'Primera Agenda' })}
                                                            disabled={processingId === a.id}
                                                            className="h-7 px-2.5 bg-blue-650/80 hover:bg-blue-550 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                        >
                                                            2ª Llamada
                                                        </button>
                                                        <button
                                                            onClick={async (e) => {
                                                                if (e) e.stopPropagation();
                                                                if (!window.confirm("¿Seguro que deseas marcar este prospecto como No Lead?")) return;
                                                                setProcessingId(a.id);
                                                                try {
                                                                    await api.post(`/closer/appointments/${a.id}/process`, {
                                                                        status: 'No Lead'
                                                                    });
                                                                    toast.success("Prospecto marcado como No Lead");
                                                                    fetchAgendas();
                                                                } catch (err) {
                                                                    console.error("Error al calificar como No Lead:", err);
                                                                    toast.error("Error al calificar");
                                                                } finally {
                                                                    setProcessingId(null);
                                                                }
                                                            }}
                                                            disabled={processingId === a.id}
                                                            className="h-7 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-350 font-black text-[9px] uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 border border-slate-750"
                                                        >
                                                            No Lead
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Panel de Reprogramación Inline */}
                                                {isRescheduling && (
                                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-900/60" onClick={(e) => e.stopPropagation()}>
                                                        <span className="text-[10px] font-black uppercase text-violet-400 tracking-wider flex items-center gap-1">
                                                            <CalendarDays size={12} className="text-violet-500" />
                                                            {rescheduleData.status === 'Reprogramada' ? 'Reagendar:' : '2ª Llamada:'}
                                                        </span>
                                                        <input 
                                                            type="datetime-local" 
                                                            value={rescheduleData.date ? formatToDatetimeLocal(rescheduleData.date) : ''}
                                                            onChange={(e) => setRescheduleData(prev => ({ ...prev, date: e.target.value }))}
                                                            className="bg-transparent border-none text-xs font-bold text-slate-200 focus:outline-none focus:ring-0 cursor-pointer p-0 w-36 hover:text-primary transition-colors"
                                                        />
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (!rescheduleData.date) {
                                                                    toast.error("Selecciona una fecha y hora");
                                                                    return;
                                                                }
                                                                const note = window.prompt("Escribe la razón del cambio para el Lead Roadmap:");
                                                                if (note === null) return;
                                                                if (!note.trim()) {
                                                                    toast.error("La razón del cambio es requerida");
                                                                    return;
                                                                }
                                                                setProcessingId(a.id);
                                                                try {
                                                                    await api.post(`/closer/appointments/${a.id}/process`, {
                                                                        status: rescheduleData.status === 'Reprogramada' ? 'Reagendado' : '2da call',
                                                                        reschedule_date: rescheduleData.date,
                                                                        role: 'closer',
                                                                        note: note
                                                                    });
                                                                    toast.success(rescheduleData.status === 'Reprogramada' ? "Cita reprogramada" : "Segunda llamada agendada");
                                                                    setRescheduleData({ apptId: null, date: '', status: '' });
                                                                    fetchAgendas();
                                                                } catch (err) {
                                                                    console.error("Error al procesar el cambio de fecha:", err);
                                                                    toast.error("Error al procesar el cambio de fecha");
                                                                } finally {
                                                                    setProcessingId(null);
                                                                }
                                                            }}
                                                            disabled={processingId === a.id || !rescheduleData.date}
                                                            className="h-6 px-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                                        >
                                                            {processingId === a.id ? <Loader2 size={10} className="animate-spin" /> : 'Confirmar'}
                                                        </button>
                                                        <button 
                                                            onClick={() => setRescheduleData({ apptId: null, date: '', status: '' })}
                                                            className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors ml-auto"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>

                {/* Columna Derecha: Visor Detallado */}
                <div className="lg:col-span-5 h-[76vh] overflow-y-auto custom-scrollbar sticky top-28 bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 shadow-xl">
                    {selectedLead ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                                <h3 className="text-xs font-black text-violet-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <AlertCircle size={13} />
                                    Ficha de Seguimiento
                                </h3>
                                <button
                                    onClick={() => setSelectedLead(null)}
                                    className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-500 hover:text-white transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            
                            <LeadRoadmapDetail 
                                instagram={selectedLead.instagram}
                                email={selectedLead.email}
                                phone={selectedLead.phone}
                                availableKeywords={[]}
                                userRole={user?.role}
                                appointmentId={selectedLead.id}
                                compact={true}
                                onUpdate={() => {
                                    fetchAgendas();
                                }}
                            />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                            <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center text-slate-500 mb-4 shadow-xl">
                                <Users size={28} />
                            </div>
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                                Perfil del Prospecto
                            </h3>
                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mt-1.5 max-w-xs leading-relaxed">
                                Selecciona una cita de la agenda de hoy para calificar objeciones, guardar notas e investigar respuestas del prospecto.
                            </p>
                        </div>
                    )}
                </div>

            </div>

            {/* Modal de decisión: Con / Sin Decisor */}
            <AnimatePresence>
                {decisionMakerPrompt.apptId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2rem] p-6 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-200"
                        >
                            <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                                <Users size={22} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-black text-white uppercase italic tracking-tight">¿Asistió con Decisor?</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase">Indica si el tomador de decisiones estuvo presente en la llamada.</p>
                            </div>
                            <div className="flex flex-col gap-2.5 pt-2">
                                <button
                                    onClick={() => executeQuickAction(decisionMakerPrompt.apptId, 'Completada', true)}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                                >
                                    Sí, con Decisor
                                </button>
                                <button
                                    onClick={() => executeQuickAction(decisionMakerPrompt.apptId, 'Completada', false)}
                                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs uppercase tracking-widest rounded-xl border border-slate-700 transition-all cursor-pointer"
                                >
                                    No, sin Decisor
                                </button>
                                <button
                                    onClick={() => setDecisionMakerPrompt({ apptId: null })}
                                    className="w-full py-2.5 text-slate-500 hover:text-slate-400 font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CloserWorkflowPage;
