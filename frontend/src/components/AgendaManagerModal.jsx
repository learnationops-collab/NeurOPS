import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    X,
    Calendar,
    MessageSquare,
    Instagram,
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    Loader2,
    Check
} from 'lucide-react';
import Button from './ui/Button';
import CommentsSection from './CommentsSection';

const AgendaManagerModal = ({ isOpen, appointment, onClose, onSuccess }) => {
    const [status, setStatus] = useState('');
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [slots, setSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const statuses = [
        { id: 'Completada', label: 'Completada', icon: CheckCircle2, color: 'text-success' },
        { id: 'Primera Agenda', label: 'Primera Agenda (OK)', icon: CheckCircle2, color: 'text-success' },
        { id: 'No Show', label: 'No Show', icon: XCircle, color: 'text-accent' },
        { id: 'Cancelada', label: 'Cancelada', icon: XCircle, color: 'text-muted' },
        { id: 'Reprogramada', label: 'Reprogramada', icon: RefreshCw, color: 'text-primary' }
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
                reschedule_date: rescheduleDate
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
                <div className="p-8 border-b border-base flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-base italic uppercase tracking-tighter">Gestionar Agenda</h2>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">Status Protocol v2.0</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full text-muted hover:text-base transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    {/* Lead Info */}
                    <div className="bg-main p-6 rounded-3xl border border-base flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center font-black text-white shadow-lg shadow-primary/20">
                                {appointment.lead_name[0]}
                            </div>
                            <div>
                                <p className="text-base font-black tracking-tight">{appointment.lead_name}</p>
                                <p className="text-[10px] text-muted font-bold uppercase">{appointment.type}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <a href={`https://wa.me/${appointment.phone}`} target="_blank" className="p-2.5 bg-success/10 text-success rounded-xl hover:bg-success hover:text-white transition-all">
                                <MessageSquare size={16} />
                            </a>
                        </div>
                    </div>

                    {/* Comments Section */}
                    {appointment.client_id && (
                        <div className="h-64">
                            <CommentsSection clientId={appointment.client_id} />
                        </div>
                    )}

                    {/* Status Selection */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Cambiar Estado</label>
                        <div className="grid grid-cols-2 gap-3">
                            {statuses.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => { setStatus(s.id); setRescheduleDate(''); }}
                                    className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${status === s.id ? 'bg-primary text-white border-primary shadow-lg' : 'bg-main border-base text-muted hover:text-base hover:border-muted/20'}`}
                                >
                                    <s.icon size={16} className={status === s.id ? 'text-white' : s.color} />
                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reschedule Section */}
                    {showReschedule && (
                        <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                                {status === 'Reprogramada' ? 'Nueva Fecha de Reagenda' : 'Fecha para Segunda Agenda'}
                            </label>
                            {loadingSlots ? (
                                <div className="p-8 bg-main rounded-2xl flex flex-col items-center gap-4">
                                    <Loader2 className="animate-spin text-primary" size={20} />
                                    <p className="text-[9px] font-bold text-muted uppercase tracking-widest">Calculando disponibilidad...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                                    {slots.length > 0 ? slots.map(slot => {
                                        const dt = new Date(slot.utc_iso);
                                        const isSelected = rescheduleDate === slot.utc_iso;
                                        return (
                                            <button
                                                key={slot.utc_iso}
                                                onClick={() => setRescheduleDate(slot.utc_iso)}
                                                className={`p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${isSelected ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-main border-base text-muted hover:text-base hover:bg-surface-hover'}`}
                                            >
                                                {dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </button>
                                        );
                                    }) : (
                                        <div className="col-span-2 p-8 text-center bg-main rounded-2xl">
                                            <p className="text-[9px] font-black text-accent/70 uppercase tracking-widest">Sin horarios disponibles</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-[10px] font-black uppercase tracking-widest text-center">
                            {error}
                        </div>
                    )}

                    {/* Action Button */}
                    <Button
                        onClick={handleProcess}
                        loading={submitting}
                        disabled={!status || (showReschedule && !rescheduleDate)}
                        variant="primary"
                        className="w-full py-5 h-16"
                        icon={Check}
                    >
                        Confirmar Protocolo
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AgendaManagerModal;
