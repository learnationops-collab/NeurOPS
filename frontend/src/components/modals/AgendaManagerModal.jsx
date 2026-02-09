import { useState, useEffect } from 'react';
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
    Target
} from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';
import CommentsSection from '../CommentsSection';

const AgendaManagerModal = ({ isOpen, appointment, onClose, onSuccess }) => {
    const [status, setStatus] = useState('');
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [slots, setSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [showStatusOptions, setShowStatusOptions] = useState(false);

    const [selectedStage, setSelectedStage] = useState(appointment.last_stage || 'Nueva');

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

    const statuses = [
        { id: 'Terminada', label: 'Terminada', icon: CheckCircle2, color: 'text-emerald-500' },
        { id: 'No Show', label: 'No Show', icon: XCircle, color: 'text-rose-500' },
        { id: 'Cancelada', label: 'Cancelada', icon: XCircle, color: 'text-muted' },
        { id: 'Reprogramada', label: 'Reprogramada', icon: RefreshCw, color: 'text-primary' },
        { id: 'Primera Agenda', label: 'Protocolo Seg. Agenda', icon: CheckCircle2, color: 'text-success' },
    ];

    useEffect(() => {
        if (isOpen && (status === 'Reprogramada' || status === 'Primera Agenda')) {
            fetchSlots();
        }
    }, [isOpen, status]);

    const fetchSlots = async () => {
        setLoadingSlots(true);
        try {
            const res = await api.get('/closer/slots');
            setSlots(res.data);
        } catch (err) {
            console.error("Error fetching slots", err);
        } finally {
            setLoadingSlots(false);
        }
    };

    const handleProcess = async () => {
        if (!status) return;
        if ((status === 'Reprogramada' || status === 'Primera Agenda') && !rescheduleDate) {
            setError("Debes seleccionar una fecha para la nueva llamada");
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            await api.post(`/closer/appointments/${appointment.id}/process`, {
                status,
                reschedule_date: rescheduleDate,
                last_stage: selectedStage
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

    const showReschedule = status === 'Reprogramada' || status === 'Primera Agenda';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-surface border border-base rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                {/* Header */}
                <div className="p-8 border-b border-base flex justify-between items-center bg-surface/50 backdrop-blur-md sticky top-0 z-10">
                    <div>
                        <h2 className="text-2xl font-black text-base italic uppercase tracking-tighter">Gestionar Lead</h2>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">Status & Progression Protocol</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full text-muted hover:text-base transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                    {/* Lead Info */}
                    <div className="bg-main p-6 rounded-3xl border border-base flex justify-between items-center shadow-inner">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center font-black text-white shadow-lg shadow-primary/20">
                                {appointment.lead_name[0]}
                            </div>
                            <div>
                                <p className="text-base font-black tracking-tight">{appointment.lead_name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <Badge variant="neutral" className="bg-accent/10 text-accent text-[9px] font-black uppercase">{selectedStage}</Badge>
                                    <p className="text-[9px] text-muted font-bold uppercase">{appointment.type}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <a href={`https://wa.me/${appointment.phone}`} target="_blank" className="p-2.5 bg-success/10 text-success rounded-xl hover:bg-success hover:text-white transition-all shadow-sm">
                                <MessageSquare size={16} />
                            </a>
                        </div>
                    </div>

                    {/* Progress & Closure Actions */}
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Progreso de Etapa</label>
                            <button
                                onClick={handleAdvanceStage}
                                disabled={!nextStage}
                                className={`w-full group flex items-center justify-between p-5 rounded-2xl border transition-all ${nextStage ? 'bg-primary/5 border-primary/20 text-primary hover:bg-primary hover:text-white hover:border-primary shadow-sm hover:shadow-primary/20' : 'bg-main border-base opacity-40 grayscale cursor-not-allowed'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <TrendingUp size={18} />
                                    <div className="text-left">
                                        <p className="text-[10px] font-black uppercase tracking-widest">Avanzar nivel</p>
                                        <p className="text-[9px] font-bold opacity-60">Siguiente: {nextStage || 'Etapa final'}</p>
                                    </div>
                                </div>
                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Protocolo de Cierre</label>
                            <div className="relative">
                                <button
                                    onClick={() => setShowStatusOptions(!showStatusOptions)}
                                    className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all ${status ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'bg-main border-base text-muted hover:text-base hover:border-muted/30'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        {status ? (
                                            (() => {
                                                const s = statuses.find(x => x.id === status);
                                                return s ? <s.icon size={18} /> : <Target size={18} />;
                                            })()
                                        ) : <Target size={18} />}
                                        <span className="text-[11px] font-black uppercase tracking-widest">{status || 'Cerrar Agenda'}</span>
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
                                                    className="w-full flex items-center gap-4 p-4 hover:bg-surface-hover transition-all text-left"
                                                >
                                                    <div className={`p-2 rounded-lg bg-surface border border-base ${s.color}`}>
                                                        <s.icon size={14} />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-base">{s.label}</span>
                                                    {status === s.id && <Check size={14} className="ml-auto text-primary" />}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {/* Reschedule Section */}
                    {showReschedule && (
                        <div className="space-y-4 p-6 bg-primary/5 border border-primary/10 rounded-3xl animate-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-[10px] font-black text-primary uppercase tracking-widest">
                                    {status === 'Reprogramada' ? 'Seleccionar Reagenda' : 'Agendar Pre-call'}
                                </label>
                                <Calendar size={14} className="text-primary opacity-50" />
                            </div>
                            {loadingSlots ? (
                                <div className="py-8 flex flex-col items-center gap-4">
                                    <Loader2 className="animate-spin text-primary" size={20} />
                                    <p className="text-[9px] font-bold text-muted uppercase tracking-widest">Consultando GCal...</p>
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
                                                className={`p-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${isSelected ? 'bg-primary border-primary text-white shadow-md' : 'bg-main border-base text-muted hover:text-base hover:bg-surface-hover'}`}
                                            >
                                                {dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </button>
                                        );
                                    }) : (
                                        <div className="col-span-2 py-8 text-center bg-main/50 rounded-2xl">
                                            <p className="text-[9px] font-black text-rose-500/50 uppercase tracking-widest">Sin disponibilidad disponible</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Comments Section */}
                    {appointment.client_id && (
                        <div className="space-y-3 pb-4">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Observaciones del Cliente</label>
                            <div className="h-44 border border-base rounded-3xl overflow-hidden bg-main/30">
                                <CommentsSection clientId={appointment.client_id} />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-[10px] font-black uppercase tracking-widest text-center animate-shake">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="p-8 bg-surface/80 backdrop-blur-xl border-t border-base">
                    <Button
                        onClick={handleProcess}
                        loading={submitting}
                        disabled={!status || (showReschedule && !rescheduleDate)}
                        variant="primary"
                        className="w-full py-6 h-18 text-xs font-black tracking-widest shadow-2xl shadow-primary/30"
                        icon={Check}
                    >
                        Sincronizar y Protocolizar
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AgendaManagerModal;
