import { useState, useEffect, useMemo } from 'react';
import ErrorBoundary from '../ErrorBoundary';
import api from '../../services/api';
import {
    X,
    Calendar,
    MessageSquare,
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    Loader2,
    Check,
    TrendingUp,
    ArrowRight,
    ChevronRight,
    Target,
    User,
    FileText,
    Mail,
    Phone,
    Instagram
} from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { motion, AnimatePresence } from 'framer-motion';
import CommentsSection from '../shared/CommentsSection';

const AgendaManagerModal = ({ isOpen, appointment, onClose, onSuccess, mode = 'closer' }) => {
    const [status, setStatus] = useState('');
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [slots, setSlots] = useState([]);
    const [withDecisionMaker, setWithDecisionMaker] = useState(null);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [showStatusOptions, setShowStatusOptions] = useState(false);
    const [note, setNote] = useState('');

    const [selectedStage, setSelectedStage] = useState(appointment?.last_stage || 'Nueva');

    // Tabs State
    const [activeTab, setActiveTab] = useState('gestion'); // 'gestion' | 'cliente'
    const [clientData, setClientData] = useState(null);
    const [loadingClient, setLoadingClient] = useState(false);

    const STAGE_ORDER = ["Nueva", "Respondido", "Confirmado", "Asistido", "Contexto", "Decisor", "Presentado"];

    const nextStage = useMemo(() => {
        const currentIndex = STAGE_ORDER.indexOf(selectedStage);
        if (currentIndex !== -1 && currentIndex < STAGE_ORDER.length - 1) {
            return STAGE_ORDER[currentIndex + 1];
        }
        return null;
    }, [selectedStage]);

    const handleAdvanceStage = () => {
        if (nextStage) {
            setSelectedStage(nextStage);
        }
    };

    const statuses = useMemo(() => {
        if (mode === 'setter') {
            const list = [
                { id: 'Pendiente', label: 'Pendiente', icon: Clock, color: 'text-amber-500' },
                { id: 'Contactado', label: 'Contactado', icon: MessageSquare, color: 'text-blue-500' },
                { id: 'Confirmado', label: 'Confirmado', icon: CheckCircle2, color: 'text-emerald-500' },
                { id: 'Sin respuesta', label: 'Sin respuesta', icon: XCircle, color: 'text-rose-500' },
                { id: 'Reagendado', label: 'Reagendado', icon: RefreshCw, color: 'text-primary' },
                { id: 'Cancelado', label: 'Cancelado', icon: XCircle, color: 'text-muted' },
            ];
            const currentRes = appointment?.result;
            if (currentRes && !list.some(x => x.id === currentRes)) {
                list.push({ id: currentRes, label: currentRes, icon: Target, color: 'text-slate-400' });
            }
            return list;
        } else {
            return [
                { id: 'Pendiente', label: 'Pendiente', icon: Clock, color: 'text-amber-500' },
                { id: 'Show up', label: 'Show up', icon: CheckCircle2, color: 'text-emerald-500' },
                { id: 'No Show', label: 'No Show', icon: XCircle, color: 'text-rose-500' },
                { id: '2da call', label: '2da call', icon: RefreshCw, color: 'text-blue-500' },
                { id: 'Reagendado', label: 'Reagendado', icon: RefreshCw, color: 'text-primary' },
                { id: 'Cancelado', label: 'Cancelado', icon: XCircle, color: 'text-muted' },
            ];
        }
    }, [mode, appointment?.result]);

    useEffect(() => {
        if (isOpen && appointment) {
            setStatus(mode === 'closer' ? (appointment.closer_result || '') : (appointment.result || ''));
            setWithDecisionMaker(appointment.with_decision_maker !== undefined ? appointment.with_decision_maker : null);
            setSelectedStage(appointment.last_stage || 'Nueva');
            setNote('');
            setRescheduleDate('');
        }
    }, [isOpen, appointment, mode]);

    useEffect(() => {
        if (isOpen && (status === 'Reprogramada' || status === 'Primera Agenda' || status === 'Reagendado' || status === '2da call')) {
            fetchSlots();
        }
    }, [isOpen, status]);

    useEffect(() => {
        if (isOpen && activeTab === 'cliente' && !clientData && appointment?.client_id) {
            fetchClientDetails();
        }
    }, [isOpen, activeTab, appointment]);

    const fetchSlots = async () => {
        setLoadingSlots(true);
        try {
            const res = await api.get('/closer/slots', { skipAuthError: true });
            if (Array.isArray(res.data)) {
                setSlots(res.data);
            } else {
                setSlots([]);
            }
        } catch (err) {
            console.error("Error fetching slots", err);
            setSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    };

    const fetchClientDetails = async () => {
        setLoadingClient(true);
        try {
            const res = await api.get(`/closer/clients/${appointment.client_id}`);
            setClientData(res.data);
        } catch (err) {
            console.error("Error fetching client details", err);
        } finally {
            setLoadingClient(false);
        }
    };

    const handleProcess = async () => {
        if (!status) return;
        
        // Validar reprogramación/segunda llamada
        const needsReschedule = status === 'Reprogramada' || status === 'Primera Agenda' || status === 'Reagendado' || status === '2da call';
        if (needsReschedule && !rescheduleDate) {
            setError("Debes seleccionar una fecha para la nueva llamada");
            return;
        }

        // Validar notas/razón para estados especiales
        const needsNote = status === 'Reagendado' || status === 'Cancelado' || status === '2da call';
        if (needsNote && !note.trim()) {
            setError("Debes escribir una razón para el cambio");
            return;
        }

        // Validar decisor
        const isShowUp = status === 'Terminada' || status === 'Primera Agenda' || status === 'Show up' || status === '2da call';
        if (mode === 'closer' && isShowUp && withDecisionMaker === null) {
            setError("Debes indicar si la llamada fue con o sin decisor");
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            await api.post(`/closer/appointments/${appointment.id}/process`, {
                status,
                reschedule_date: rescheduleDate,
                last_stage: selectedStage,
                with_decision_maker: withDecisionMaker,
                role: mode,
                note
            });
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || "Error al procesar la agenda");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !appointment) return null;

    // Una agenda puede no tener cita sincronizada todavía (llega del espacio del
    // setter, donde la lista son FinancialAgendas). El detalle se muestra igual y
    // el chat se ancla en el cliente; lo único que no se puede es protocolizar,
    // porque no hay cita que procesar.
    const sinCita = !appointment.id;

    // Hay dos hilos distintos: el de la CITA (notas de esa llamada, sin aviso a
    // nadie) y el del LEAD, anclado en el cliente, que es el compartido con
    // closer y triage y el único que notifica. El setter no toma notas de
    // llamada, así que para él siempre es el del lead: si no, escribía en un
    // hilo que nadie más ve. El closer conserva sus notas de sesión.
    const chatDelLead = mode === 'setter' || sinCita;
    const showReschedule = status === 'Reprogramada' || status === 'Primera Agenda' || status === 'Reagendado' || status === '2da call';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="w-full max-w-5xl bg-surface border border-base rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header & Tabs */}
                <div className="shrink-0 bg-surface/50 backdrop-blur-md border-b border-base sticky top-0 z-10">
                    <div className="p-8 flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-black text-base italic tracking-tighter">Gestionar lead</h2>
                            <p className="text-[10px] text-muted font-bold tracking-widest mt-1">
                                {appointment.lead_name}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full text-muted hover:text-base transition-all">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Tabs Navigation */}
                    <div className="px-8 flex items-center gap-8">
                        <button
                            onClick={() => setActiveTab('gestion')}
                            className={`pb-4 text-[10px] font-black tracking-widest transition-all relative ${activeTab === 'gestion' ? 'text-primary' : 'text-muted hover:text-base'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Target size={14} />
                                GESTIÓN
                            </div>
                            {activeTab === 'gestion' && (
                                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('cliente')}
                            className={`pb-4 text-[10px] font-black tracking-widest transition-all relative ${activeTab === 'cliente' ? 'text-primary' : 'text-muted hover:text-base'}`}
                        >
                            <div className="flex items-center gap-2">
                                <User size={14} />
                                CLIENTE
                            </div>
                            {activeTab === 'cliente' && (
                                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    <AnimatePresence mode="wait">
                        {activeTab === 'gestion' ? (
                            <motion.div
                                key="gestion"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="grid grid-cols-1 lg:grid-cols-2 gap-8"
                            >
                                <div className="space-y-6">
                                    {/* Lead Info Small Card */}
                                    <div className="bg-main p-6 rounded-3xl border border-base flex justify-between items-center shadow-inner">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center font-black text-white shadow-lg shadow-primary/20">
                                                {appointment.lead_name[0]}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-base font-black tracking-tight">{appointment.lead_name}</p>
                                                    <Badge variant="neutral" className="bg-accent/10 text-accent text-[8px] font-black">{selectedStage}</Badge>
                                                </div>
                                                <p className="text-[9px] text-muted font-bold mt-0.5">{appointment.type}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <a href={`https://wa.me/${appointment.phone}`} target="_blank" className="p-2.5 bg-success/10 text-success rounded-xl hover:bg-success hover:text-white transition-all shadow-sm">
                                                <MessageSquare size={16} />
                                            </a>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="space-y-4">
                                        {/* Stage Progress */}
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-muted tracking-widest ml-1">ETAPA ACTUAL</label>
                                            <button
                                                onClick={handleAdvanceStage}
                                                disabled={!nextStage}
                                                className={`w-full group flex items-center justify-between p-4 rounded-2xl border transition-all ${nextStage ? 'bg-primary/5 border-primary/20 text-primary hover:bg-primary hover:text-white hover:border-primary shadow-sm hover:shadow-primary/20' : 'bg-main border-base opacity-40 grayscale cursor-not-allowed'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <TrendingUp size={16} />
                                                    <div className="text-left">
                                                        <p className="text-[10px] font-black tracking-widest">Avanzar: {nextStage || 'Finalizado'}</p>
                                                    </div>
                                                </div>
                                                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        </div>

                                        {/* Closure Protocol */}
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-muted tracking-widest ml-1">RESULTADO DE LA LLAMADA</label>
                                            <div className="relative">
                                                <button
                                                    onClick={() => setShowStatusOptions(!showStatusOptions)}
                                                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${status ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-main border-base text-muted hover:text-base hover:border-muted/30'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {status ? (
                                                            (() => {
                                                                const s = statuses.find(x => x.id === status);
                                                                return s ? <s.icon size={16} /> : <Target size={16} />;
                                                            })()
                                                        ) : <Target size={16} />}
                                                        <span className="text-[10px] font-black tracking-widest">{status || 'Seleccionar resultado...'}</span>
                                                    </div>
                                                    <ChevronRight size={16} className={`transition-transform duration-300 ${showStatusOptions ? 'rotate-90' : ''}`} />
                                                </button>

                                                <AnimatePresence>
                                                    {showStatusOptions && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -10 }}
                                                            className="absolute top-full left-0 w-full mt-2 bg-main border border-base rounded-2xl shadow-2xl z-20 overflow-hidden divide-y divide-base"
                                                        >
                                                            {statuses.map(s => (
                                                                <button
                                                                    key={s.id}
                                                                    onClick={() => { setStatus(s.id); setRescheduleDate(''); setShowStatusOptions(false); }}
                                                                    className="w-full flex items-center gap-4 p-3 hover:bg-surface-hover transition-all text-left"
                                                                >
                                                                    <div className={`p-1.5 rounded-lg bg-surface border border-base ${s.color}`}>
                                                                        <s.icon size={12} />
                                                                    </div>
                                                                    <span className="text-[9px] font-black tracking-widest text-base">{s.label}</span>
                                                                    {status === s.id && <Check size={12} className="ml-auto text-primary" />}
                                                                </button>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>

                                        {/* Selector de Decisor */}
                                        {(status === 'Terminada' || status === 'Primera Agenda') && (
                                            <div className="space-y-2 p-4 bg-[#181922] border border-slate-800 rounded-3xl animate-in slide-in-from-top-4 duration-300 text-left">
                                                <label className="text-[9px] font-black text-slate-400 tracking-widest block uppercase">¿Asistió con Decisor? *</label>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setWithDecisionMaker(true)}
                                                        className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl border transition-all cursor-pointer ${
                                                            withDecisionMaker === true 
                                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                                                                : 'bg-main border-base text-muted hover:text-base hover:bg-surface-hover'
                                                        }`}
                                                    >
                                                        Con Decisor
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setWithDecisionMaker(false)}
                                                        className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl border transition-all cursor-pointer ${
                                                            withDecisionMaker === false 
                                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                                                                : 'bg-main border-base text-muted hover:text-base hover:bg-surface-hover'
                                                        }`}
                                                    >
                                                        Sin Decisor
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                         {/* Razón del Cambio (Nota) */}
                                         {(status === 'Reagendado' || status === 'Cancelado' || status === '2da call') && (
                                             <div className="space-y-2 p-4 bg-[#181922] border border-slate-800 rounded-3xl animate-in slide-in-from-top-4 duration-300 text-left">
                                                 <label className="text-[9px] font-black text-slate-400 tracking-widest block uppercase">¿Razón del cambio? *</label>
                                                 <textarea
                                                     rows={3}
                                                     value={note}
                                                     onChange={(e) => setNote(e.target.value)}
                                                     placeholder="Escribe la razón para el Lead Roadmap..."
                                                     className="w-full bg-main border border-base rounded-2xl py-3 px-4 text-white text-xs font-bold outline-none focus:border-primary/50 transition-all resize-none"
                                                 />
                                             </div>
                                         )}

                                        {/* Reschedule Calendar */}
                                        {showReschedule && (
                                            <div className="space-y-3 p-4 bg-primary/5 border border-primary/10 rounded-3xl animate-in slide-in-from-top-4 duration-300">
                                                <div className="flex items-center justify-between px-1">
                                                    <label className="text-[9px] font-black text-primary tracking-widest">
                                                        {status === 'Reprogramada' ? 'REAGENDAR' : 'AGENDAR PRE-CALL'}
                                                    </label>
                                                    <Calendar size={12} className="text-primary opacity-50" />
                                                </div>
                                                {loadingSlots ? (
                                                    <div className="py-8 flex flex-col items-center gap-4">
                                                        <Loader2 className="animate-spin text-primary" size={20} />
                                                        <p className="text-[9px] font-bold text-muted tracking-widest">Buscando espacios...</p>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                                        {slots.length > 0 ? slots.map(slot => {
                                                            const dt = new Date(slot.utc_iso);
                                                            const isSelected = rescheduleDate === slot.utc_iso;
                                                            return (
                                                                <button
                                                                    key={slot.utc_iso}
                                                                    onClick={() => setRescheduleDate(slot.utc_iso)}
                                                                    className={`p-2 rounded-xl border text-[8px] font-black tracking-widest transition-all ${isSelected ? 'bg-primary border-primary text-white shadow-md' : 'bg-main border-base text-muted hover:text-base hover:bg-surface-hover'}`}
                                                                >
                                                                    {dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </button>
                                                            );
                                                        }) : (
                                                            <div className="col-span-2 py-6 text-center bg-main/50 rounded-2xl">
                                                                <p className="text-[8px] font-black text-rose-500/50 tracking-widest">Sin cupos disponibles</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {error && (
                                            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-[9px] font-black tracking-widest text-center animate-shake">
                                                {error}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4 h-full flex flex-col">
                                    <label className="text-[9px] font-black text-muted tracking-widest ml-1">
                                        {chatDelLead ? 'CHAT DEL LEAD' : 'NOTAS DE LA SESIÓN'}
                                    </label>
                                    <div className="flex-1 min-h-[200px] border border-base rounded-3xl overflow-hidden bg-main/30">
                                        <ErrorBoundary>
                                            {chatDelLead
                                                ? <CommentsSection clientId={appointment.client_id} />
                                                : <CommentsSection type="appointment" associatedId={appointment.id} />}
                                        </ErrorBoundary>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="cliente"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full"
                            >
                                <div className="space-y-6">
                                    {loadingClient ? (
                                        <div className="flex justify-center py-12">
                                            <Loader2 className="animate-spin text-primary" />
                                        </div>
                                    ) : clientData ? (
                                        <>
                                            <div className="bg-main border border-base rounded-3xl p-6 space-y-6">
                                                <div className="flex flex-col items-center text-center space-y-2">
                                                    <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center font-black text-3xl text-white shadow-xl shadow-primary/20 mb-2">
                                                        {clientData.full_name?.[0]}
                                                    </div>
                                                    <h3 className="text-lg font-black italic tracking-tighter">{clientData.full_name}</h3>
                                                    <Badge variant="neutral" className="bg-surface text-[9px] font-black tracking-widest">
                                                        ID: {clientData.id}
                                                    </Badge>
                                                </div>

                                                <div className="space-y-3 pt-4 border-t border-base">
                                                    <div className="flex items-center gap-3 text-[10px] text-muted font-bold">
                                                        <Mail size={14} className="text-primary" />
                                                        <span className="truncate">{clientData.email}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[10px] text-muted font-bold">
                                                        <Phone size={14} className="text-primary" />
                                                        <span>{clientData.phone || 'Sin télefono'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[10px] text-muted font-bold">
                                                        <Instagram size={14} className="text-primary" />
                                                        <span>{clientData.instagram || 'Sin instagram'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black text-muted tracking-widest ml-1">CHAT DEL LEAD</label>
                                                {/* Alto suficiente para leer el hilo: con h-60 los destinatarios y el
                                                    campo de texto no dejaban ver ningun mensaje. */}
                                                <div className="h-[420px] border border-base rounded-3xl overflow-hidden bg-main/30">
                                                    <ErrorBoundary>
                                                        <CommentsSection clientId={clientData.id} />
                                                    </ErrorBoundary>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center py-12 text-muted text-[10px] font-black tracking-widest">
                                            No se pudo cargar la información del cliente.
                                        </div>
                                    )}
                                </div>

                                <div className="lg:col-span-2 space-y-4">
                                    <label className="text-[9px] font-black text-muted tracking-widest ml-1">RESPUESTAS DEL FORMULARIO</label>
                                    <div className="bg-main border border-base rounded-3xl p-6 h-full max-h-[500px] overflow-y-auto custom-scrollbar space-y-6">
                                        {clientData?.survey_answers?.length > 0 ? (
                                            clientData.survey_answers.map((ans, idx) => (
                                                <div key={idx} className="space-y-2">
                                                    <p className="text-[10px] font-black text-primary tracking-widest uppercase">{ans.question}</p>
                                                    <p className="text-xs font-medium text-base leading-relaxed bg-surface p-4 rounded-xl border border-base">
                                                        {ans.answer || "Sin respuesta"}
                                                    </p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full opacity-30 gap-4">
                                                <FileText size={48} className="text-muted" />
                                                <p className="text-[10px] font-black tracking-widest">Sin formulario completado</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer (Only for Gestión) */}
                {activeTab === 'gestion' && (
                    <div className="shrink-0 p-8 bg-surface/80 backdrop-blur-xl border-t border-base space-y-3">
                        {sinCita && (
                            <p className="text-[9px] font-black text-amber-500 tracking-widest text-center">
                                Esta agenda todavía no tiene una llamada sincronizada: podés leer el lead y escribir en el chat, pero no protocolizar.
                            </p>
                        )}
                        <Button
                            onClick={handleProcess}
                            loading={submitting}
                            disabled={sinCita || !status || (showReschedule && !rescheduleDate)}
                            variant="primary"
                            className="w-full py-6 h-18 text-xs font-black tracking-widest shadow-2xl shadow-primary/30"
                            icon={Check}
                        >
                            Sincronizar y protocolizar
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgendaManagerModal;
