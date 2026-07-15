import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
    Users, Search, Check, X, ChevronRight, Loader2,
    Calendar, Phone, Mail, Instagram, ExternalLink, Clock,
    RefreshCw, CalendarDays, AlertCircle, MessageSquare
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import CommentsSection from '../../components/shared/CommentsSection';

const TriageWorkflowPage = () => {
    const { user } = useAuth();
    
    // Filtros y estados de agendas
    const [selectedDate, setSelectedDate] = useState(() => {
        const offset = new Date().getTimezoneOffset();
        const localDate = new Date(new Date().getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [agendas, setAgendas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [selectedLead, setSelectedLead] = useState(null);

    // Estados para reprogramación y notas
    const [rescheduleData, setRescheduleData] = useState({ apptId: null, date: '', status: '' });
    const [triageNote, setTriageNote] = useState('');
    const [meetDateInput, setMeetDateInput] = useState('');
    const [updatingDate, setUpdatingDate] = useState(false);

    // Sincronizar input de fecha cuando cambia el lead
    useEffect(() => {
        if (selectedLead) {
            setMeetDateInput(formatToDatetimeLocal(selectedLead.date || selectedLead.fecha_meet));
        } else {
            setMeetDateInput('');
        }
    }, [selectedLead]);

    const handleSaveMeetDate = async () => {
        if (!selectedLead || !meetDateInput) return;
        setUpdatingDate(true);
        try {
            const payload = {
                date: meetDateInput,
                fecha_meet: meetDateInput
            };
            if (user?.username) {
                payload.encargado_triage = user.username;
            }
            await api.put(`/public/financial-agendas/${selectedLead.id}`, payload);
            toast.success("Fecha del meet actualizada");
            
            // Guardar comentario en el chat del cliente notificando la nueva fecha
            if (selectedLead.client_id) {
                const commentText = `[Fecha de Meet Modificada] Cita reprogramada para el ${new Date(meetDateInput).toLocaleString('es-ES')}`;
                await saveTriageComment(selectedLead.client_id, commentText, 'Cambio Fecha');
            }

            fetchAgendas();
        } catch (err) {
            console.error("Error al actualizar fecha del meet:", err);
            toast.error("Error al actualizar la fecha del meet");
        } finally {
            setUpdatingDate(false);
        }
    };

    // Cargar agendas del día seleccionado
    const fetchAgendas = async () => {
        setLoading(true);
        try {
            const res = await api.get('/public/financial-agendas', {
                params: {
                    start_date: selectedDate,
                    date_filter_by: 'meet'
                }
            });
            // La API de financial-agendas devuelve o una lista directa o un objeto con "data"
            const dataList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setAgendas(dataList);

            // Sincronizar el lead seleccionado si cambió
            if (selectedLead) {
                const updated = dataList.find(a => a.id === selectedLead.id);
                if (updated) {
                    setSelectedLead(updated);
                } else {
                    setSelectedLead(null);
                }
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
    }, [selectedDate]);

    // Filtrar localmente por búsqueda
    const filteredAgendas = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return agendas;
        return agendas.filter(a => 
            (a.nombre && a.nombre.toLowerCase().includes(query)) ||
            (a.instagram && a.instagram.toLowerCase().includes(query)) ||
            (a.mail && a.mail.toLowerCase().includes(query)) ||
            (a.whatsapp && a.whatsapp.toLowerCase().includes(query))
        );
    }, [agendas, searchQuery]);

    // Dividir listas en por confirmar y procesadas
    const { agendasPorConfirmar, agendasProcesadas } = useMemo(() => {
        const porConfirmar = [];
        const procesadas = [];

        filteredAgendas.forEach(a => {
            const est = (a.estado || 'Pendiente').toLowerCase();
            if (est === 'pendiente' || est === 'contactado' || est === 'sin respuesta') {
                porConfirmar.push(a);
            } else {
                procesadas.push(a);
            }
        });

        return { agendasPorConfirmar: porConfirmar, agendasProcesadas: procesadas };
    }, [filteredAgendas]);

    // Guardar nota opcional en el chat del cliente
    const saveTriageComment = async (clientId, noteText, actionStatus) => {
        if (!clientId || !noteText.trim()) return;
        try {
            await api.post('/comments', {
                text: `[Confirmación Triage: ${actionStatus}] ${noteText.trim()}`,
                type: 'client',
                associated_id: clientId
            });
        } catch (err) {
            console.error("Error al registrar comentario de triaje:", err);
        }
    };

    // Procesar cambio de estado de triaje
    const handleUpdateStatus = async (agendaId, nextStatus) => {
        setProcessingId(agendaId);
        try {
            const payload = { estado: nextStatus };
            
            // Si el confirmer es el actual logueado, lo registramos como el encargado del triaje
            if (user?.username) {
                payload.encargado_triage = user.username;
            }

            await api.put(`/public/financial-agendas/${agendaId}`, payload);
            toast.success(`Cita marcada como ${nextStatus}`);

            // Si hay nota de triaje, guardarla en comentarios del cliente
            if (selectedLead?.client_id && triageNote.trim()) {
                await saveTriageComment(selectedLead.client_id, triageNote, nextStatus);
                setTriageNote('');
            }

            fetchAgendas();
        } catch (err) {
            console.error("Error al actualizar estado:", err);
            toast.error("Error al actualizar el estado");
        } finally {
            setProcessingId(null);
        }
    };

    // Confirmar Reagenda desde el modal
    const handleConfirmReschedule = async () => {
        const { apptId, date } = rescheduleData;
        if (!date) {
            toast.error("Selecciona una fecha y hora");
            return;
        }

        setProcessingId(apptId);
        try {
            const payload = {
                estado: 'Reagendada',
                date: date,
                reschedule_date: date,
                note: triageNote.trim() || 'Cita reagendada por el Call Confirmer (Triaje)'
            };

            if (user?.username) {
                payload.encargado_triage = user.username;
            }

            await api.put(`/public/financial-agendas/${apptId}`, payload);
            toast.success("Cita reagendada exitosamente");

            // Registrar nota en comentarios si existe
            if (selectedLead?.client_id) {
                const commentText = triageNote.trim() 
                    ? `[Cita Reagendada] ${triageNote.trim()} -> Nueva fecha: ${new Date(date).toLocaleString('es-ES')}`
                    : `Cita reagendada para el ${new Date(date).toLocaleString('es-ES')}`;
                await saveTriageComment(selectedLead.client_id, commentText, 'Reagendada');
                setTriageNote('');
            }

            setRescheduleData({ apptId: null, date: '', status: '' });
            fetchAgendas();
        } catch (err) {
            console.error("Error al reprogramar:", err);
            toast.error("Error al procesar la reagenda");
        } finally {
            setProcessingId(null);
        }
    };

    // Formatear hora de meet
    const formatMeetTime = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return dateStr;
        }
    };

    // Formatear fecha local para input datetime-local
    const formatToDatetimeLocal = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '';
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch {
            return '';
        }
    };

    // Renderizar una fila/tarjeta de agenda
    const renderLeadRow = (a) => {
        const isSelected = selectedLead?.id === a.id;
        
        return (
            <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => setSelectedLead(a)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer text-left flex flex-col gap-3 relative overflow-hidden group ${
                    isSelected 
                        ? 'bg-violet-650/10 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.1)]' 
                        : 'bg-black/20 border-slate-900/60 hover:bg-slate-900/50 hover:border-slate-800'
                }`}
            >
                <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <Clock size={10} />
                                {formatMeetTime(a.date || a.fecha_meet)}
                            </span>
                            <h4 className="text-sm font-black text-white leading-tight truncate">
                                {a.nombre || 'Sin Nombre'}
                            </h4>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="text-[8px] font-black uppercase text-slate-500 bg-slate-950 border border-slate-900 px-2 py-0.5 rounded-md">
                                Fuente: {a.lead || 'Sheets'}
                            </span>
                            {a.closer && (
                                <span className="text-[8px] font-black uppercase text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                                    Closer: {a.closer}
                                </span>
                            )}
                            {a.instagram && (
                                <span className="text-[10px] text-slate-500 flex items-center gap-0.5 font-mono">
                                    @{a.instagram.replace('@', '')}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Estado del Confirmer */}
                        <span className={`text-[9px] font-black px-2 py-1 rounded-xl uppercase tracking-wider ${
                            a.estado === 'Confirmado' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                            a.estado === 'Contactado' ? 'bg-indigo-500/10 text-indigo-450 border border-indigo-500/20' :
                            a.estado === 'Sin respuesta' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                            a.estado === 'Cancelada' ? 'bg-rose-500/10 text-rose-450 border border-rose-500/20' :
                            a.estado === 'Reagendada' ? 'bg-violet-500/10 text-violet-450 border border-violet-500/20' :
                            'bg-slate-500/10 text-slate-450 border border-slate-500/20'
                        }`}>
                            Conf: {a.estado || 'Pendiente'}
                        </span>
                        
                        {/* Estado del Closer */}
                        <span className={`text-[9px] font-black px-2 py-1 rounded-xl uppercase tracking-wider ${
                            a.closer_result === 'Show Up' || a.closer_result === 'Show up' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20' :
                            a.closer_result === 'No Show' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/20' :
                            'bg-slate-900/60 text-slate-500 border border-slate-800'
                        }`}>
                            Closer: {a.closer_result || 'Pendiente'}
                        </span>
                        
                        <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                    </div>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="min-h-screen bg-[#07080d] text-white p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/20 border border-slate-900 p-6 rounded-3xl backdrop-blur-sm">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                            <span className="w-3 h-3 bg-violet-500 rounded-full animate-pulse"></span>
                            Espacio de Confirmación (Triaje)
                        </h1>
                        <p className="text-xs text-slate-450 font-bold uppercase tracking-wider">
                            Gestión, confirmación y seguimiento de citas de venta
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none">
                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                            <input 
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full md:w-44 pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-900 rounded-2xl text-xs font-black uppercase text-slate-200 outline-none focus:border-violet-500/40 transition-colors cursor-pointer"
                            />
                        </div>

                        <button
                            onClick={fetchAgendas}
                            disabled={loading}
                            className="p-3 bg-slate-900 hover:bg-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-850 disabled:opacity-50"
                            title="Recargar agendas"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Buscador */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                    <input 
                        type="text"
                        placeholder="Buscar por Nombre, Instagram, Email o WhatsApp..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-950/60 border border-slate-900 rounded-2xl text-xs font-bold text-slate-200 outline-none focus:border-violet-500/30 transition-all placeholder-slate-600"
                    />
                </div>

                {/* Dashboard / Dos columnas de leads */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Leads por Confirmar */}
                    <div className="bg-slate-950/30 border border-slate-900/60 rounded-3xl p-5 space-y-4">
                        <h2 className="text-sm font-black text-amber-450 uppercase tracking-widest pl-1 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                            Citas por Confirmar ({agendasPorConfirmar.length})
                        </h2>
                        
                        {loading ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
                                <Loader2 className="animate-spin mb-2" size={24} />
                                <span className="text-xs uppercase font-black tracking-widest">Cargando citas...</span>
                            </div>
                        ) : agendasPorConfirmar.length === 0 ? (
                            <div className="py-20 text-center text-slate-600 text-xs italic bg-black/10 rounded-2xl border border-dashed border-slate-900/50">
                                No hay citas pendientes de confirmación para hoy
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                                <AnimatePresence initial={false}>
                                    {agendasPorConfirmar.map(a => renderLeadRow(a))}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>

                    {/* Leads Procesados */}
                    <div className="bg-slate-950/30 border border-slate-900/60 rounded-3xl p-5 space-y-4">
                        <h2 className="text-sm font-black text-emerald-450 uppercase tracking-widest pl-1 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            Confirmadas y Procesadas ({agendasProcesadas.length})
                        </h2>
                        
                        {loading ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
                                <Loader2 className="animate-spin mb-2" size={24} />
                                <span className="text-xs uppercase font-black tracking-widest">Cargando citas...</span>
                            </div>
                        ) : agendasProcesadas.length === 0 ? (
                            <div className="py-20 text-center text-slate-600 text-xs italic bg-black/10 rounded-2xl border border-dashed border-slate-900/50">
                                Aún no has confirmado ninguna cita hoy
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                                <AnimatePresence initial={false}>
                                    {agendasProcesadas.map(a => renderLeadRow(a))}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Modal de Detalle Custom de Doble Columna (Ancho 6xl) */}
            <AnimatePresence>
                {selectedLead && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden text-left relative flex flex-col max-h-[90vh] text-slate-100 animate-in zoom-in-95 duration-250"
                        >
                            {/* Cabecera */}
                            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                                        <AlertCircle size={20} className="text-violet-400" />
                                        {selectedLead.nombre || 'Sin Nombre'}
                                    </h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                        Ficha de Confirmación • ID Agenda: #{selectedLead.id}
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setSelectedLead(null); setTriageNote(''); setRescheduleData({ apptId: null, date: '', status: '' }); }}
                                    className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer border-none bg-transparent"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Grid principal */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 pr-2">
                                {/* Columna Izquierda: Info y Acciones */}
                                <div className="lg:col-span-7 space-y-6">
                                    {/* Bloque 1: Info Principal */}
                                    <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-4">
                                        <h4 className="text-[10px] font-black text-violet-400 uppercase tracking-wider border-b border-slate-900 pb-2">
                                            Detalles de Contacto
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-slate-500 uppercase font-black block">Instagram</span>
                                                {selectedLead.instagram ? (
                                                    <a
                                                        href={selectedLead.ig_chat_link || `https://instagram.com/${selectedLead.instagram.replace('@', '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-violet-400 hover:text-violet-300 font-black hover:underline inline-flex items-center gap-1.5"
                                                    >
                                                        <Instagram size={12} />
                                                        @{selectedLead.instagram.replace('@', '')}
                                                        <ExternalLink size={10} />
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400 font-bold">No asignado</span>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-slate-500 uppercase font-black block">WhatsApp / Teléfono</span>
                                                {selectedLead.whatsapp ? (
                                                    <a
                                                        href={`https://wa.me/${selectedLead.whatsapp.replace(/[^0-9]/g, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-emerald-400 hover:text-emerald-300 font-black hover:underline inline-flex items-center gap-1.5"
                                                    >
                                                        <Phone size={12} />
                                                        {selectedLead.whatsapp}
                                                        <ExternalLink size={10} />
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400 font-bold">N/A</span>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-slate-500 uppercase font-black block">Email</span>
                                                <span className="text-slate-350 font-bold">{selectedLead.mail || 'N/A'}</span>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-slate-500 uppercase font-black block">Zona Horaria / Ubicación</span>
                                                <span className="text-slate-350 font-bold">{selectedLead.zona_geografica || 'N/A'}</span>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-slate-500 uppercase font-black block">Setter Asignado</span>
                                                <span className="text-slate-200 font-black">{selectedLead.setter_name || 'Sin Setter'}</span>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-slate-500 uppercase font-black block">Closer Asignado</span>
                                                <span className="text-slate-200 font-black">{selectedLead.closer || 'Sin Closer'}</span>
                                            </div>
                                            <div className="space-y-1 sm:col-span-2 border-t border-slate-900/60 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div>
                                                    <span className="text-[9px] text-slate-500 uppercase font-black block">Fecha del Meet</span>
                                                    <span className="text-slate-200 font-bold">
                                                        {new Date(selectedLead.date || selectedLead.fecha_meet).toLocaleString('es-ES', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="datetime-local"
                                                        value={meetDateInput}
                                                        onChange={(e) => setMeetDateInput(e.target.value)}
                                                        className="bg-slate-950 border border-slate-850 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-violet-500/50"
                                                    />
                                                    <button
                                                        onClick={handleSaveMeetDate}
                                                        disabled={updatingDate || !meetDateInput}
                                                        className="h-8 px-3 bg-violet-600 hover:bg-violet-500 text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                                                    >
                                                        {updatingDate ? <Loader2 size={10} className="animate-spin" /> : 'Actualizar'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bloque 2: Notas del Setter */}
                                    {selectedLead.setter_notes && (
                                        <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-2">
                                            <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-wider">
                                                Notas de Cualificación (Setter)
                                            </h4>
                                            <p className="text-xs text-slate-300 italic leading-relaxed">
                                                "{selectedLead.setter_notes}"
                                            </p>
                                        </div>
                                    )}

                                    {/* Bloque 3: Respuestas del Formulario */}
                                    {selectedLead.survey_answers && selectedLead.survey_answers.length > 0 && (
                                        <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-3">
                                            <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-wider border-b border-slate-900 pb-2">
                                                Respuestas de la Encuesta
                                            </h4>
                                            <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                                {selectedLead.survey_answers.map((ans, index) => (
                                                    <div key={index} className="space-y-0.5 border-l-2 border-emerald-500/20 pl-3">
                                                        <p className="text-[9px] font-bold text-slate-500 leading-tight">{ans.question}</p>
                                                        <p className="text-xs font-black text-slate-200">{ans.answer || 'Sin respuesta'}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Bloque 4: Modificar Estado (Acciones de Triaje) */}
                                    <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                                            <h4 className="text-[10px] font-black text-violet-400 uppercase tracking-wider">
                                                Confirmación de Cita
                                            </h4>
                                            <span className="text-[10px] font-black uppercase bg-violet-650/20 text-violet-400 border border-violet-500/25 px-2.5 py-0.5 rounded-lg">
                                                Estado: {selectedLead.estado || 'Pendiente'}
                                            </span>
                                        </div>

                                        {/* Comentario / Observación de Triaje */}
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Observación / Nota interna de Triaje</label>
                                            <textarea
                                                rows="2"
                                                placeholder="Escribe un comentario que se enviará al chat de notas..."
                                                value={triageNote}
                                                onChange={(e) => setTriageNote(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/40 placeholder-slate-700 resize-none"
                                            />
                                        </div>

                                        {/* Botonera de acciones rápidas */}
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            <button
                                                onClick={() => handleUpdateStatus(selectedLead.id, 'Contactado')}
                                                disabled={processingId === selectedLead.id}
                                                className="h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                            >
                                                Contactado
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(selectedLead.id, 'Confirmado')}
                                                disabled={processingId === selectedLead.id}
                                                className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                            >
                                                Confirmar Cita
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(selectedLead.id, 'Sin respuesta')}
                                                disabled={processingId === selectedLead.id}
                                                className="h-10 px-4 bg-amber-600 hover:bg-amber-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                            >
                                                Sin Respuesta
                                            </button>
                                            <button
                                                onClick={() => setRescheduleData({ apptId: selectedLead.id, date: '', status: 'Reagendada' })}
                                                disabled={processingId === selectedLead.id}
                                                className="h-10 px-4 bg-violet-650/80 hover:bg-violet-550 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                            >
                                                Reagendar
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(selectedLead.id, 'Cancelada')}
                                                disabled={processingId === selectedLead.id}
                                                className="h-10 px-4 bg-rose-650/90 hover:bg-rose-550 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                            >
                                                Cancelar Cita
                                            </button>
                                        </div>

                                        {/* Selector de Reagenda inline */}
                                        {rescheduleData.apptId === selectedLead.id && (
                                            <div className="pt-4 border-t border-slate-900 flex flex-wrap items-center gap-3 animate-in slide-in-from-bottom-2 duration-200">
                                                <span className="text-[10px] font-black uppercase text-violet-400 tracking-wider flex items-center gap-1">
                                                    <CalendarDays size={14} className="text-violet-500" />
                                                    Nueva Fecha de Cita:
                                                </span>
                                                <input 
                                                    type="datetime-local" 
                                                    value={rescheduleData.date ? formatToDatetimeLocal(rescheduleData.date) : ''}
                                                    onChange={(e) => setRescheduleData(prev => ({ ...prev, date: e.target.value }))}
                                                    className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50"
                                                />
                                                <button
                                                    onClick={handleConfirmReschedule}
                                                    disabled={processingId === selectedLead.id || !rescheduleData.date}
                                                    className="h-9 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center cursor-pointer"
                                                >
                                                    {processingId === selectedLead.id ? <Loader2 size={12} className="animate-spin" /> : 'Confirmar Reagenda'}
                                                </button>
                                                <button 
                                                    onClick={() => setRescheduleData({ apptId: null, date: '', status: '' })}
                                                    className="h-9 px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Columna Derecha: Chat compartido */}
                                <div className="lg:col-span-5 h-[65vh]">
                                    {selectedLead.client_id ? (
                                        <CommentsSection clientId={selectedLead.client_id} />
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-950/20 border border-slate-900 rounded-3xl">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-600 mb-3">
                                                <MessageSquare size={20} />
                                            </div>
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Chat No Disponible</h4>
                                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wide mt-1.5 max-w-xs leading-relaxed">
                                                Este prospecto no tiene un cliente registrado en el CRM. Para chatear, debe tener una cuenta vinculada.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TriageWorkflowPage;
