
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { X, User, Clock, Save, AlertCircle, Bookmark, Loader2 } from 'lucide-react';
import Button from '../ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

const QuickAppointmentModal = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [leads, setLeads] = useState([]);

    const [form, setForm] = useState({
        lead_id: '',
        start_time: '',
        type: 'Primera agenda'
    });

    useEffect(() => {
        if (isOpen) {
            fetchLeads();
        }
    }, [isOpen]);


    const fetchLeads = async () => {
        setLoading(true);
        setError(null);
        try {
            // Use Closer API to get assigned leads
            const res = await api.get('/closer/leads?per_page=100');
            setLeads(res.data.leads || []);
        } catch (err) {
            console.error(err);
            setError("Error al cargar lista de leads");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // Use Closer API for appointment creation
            await api.post('/closer/appointments', {
                lead_id: form.lead_id,
                start_time: form.start_time,
                type: form.type, // 'Primera agenda', etc. passed as type/origin logic might handle it?
                // CloserService.create_appointment stores 'origin'. 
                // 'type' is not a direct field in Appointment model usually, it's 'last_stage' or context.
                // But Appointment has 'last_stage'.
                // If the user selects "Primera Agenda", maybe we should set last_stage?
                // For now, let's pass what we have. API create_appointment expects: start_time, lead_id. 
                // It doesn't look like it uses 'type'. 
                // But let's check closer.py: create_appointment uses start_time_str, lead_id, client_data.
                // It does NOT use type. 
                // However, the modal has a 'Type' dropdown. 
                // If it's "Primera Agenda", it's just a new appointment.
                // Just send lead_id and start_time.
            });

            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || "Error al crear agenda");
        } finally {
            setSubmitting(false);
        }
    };


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-surface border border-base rounded-[2rem] shadow-2xl overflow-hidden"
            >
                <div className="p-6 border-b border-base flex justify-between items-center bg-surface/50">
                    <h2 className="text-xl font-black text-base italic uppercase tracking-tighter">Nueva Agenda</h2>
                    <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full text-muted hover:text-white transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="animate-spin text-primary" />
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-bold uppercase">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                    <User size={14} /> Cliente / Lead
                                </label>
                                <select
                                    className="w-full bg-main border border-base rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                    value={form.lead_id}
                                    onChange={e => setForm({ ...form, lead_id: e.target.value })}
                                    required
                                >
                                    <option value="">Seleccionar Lead...</option>
                                    {leads.map(l => (
                                        <option key={l.id} value={l.id}>{l.username || l.email}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                        <Clock size={14} /> Fecha
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className="w-full bg-main border border-base rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                        value={form.start_time}
                                        onChange={e => setForm({ ...form, start_time: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                        <Bookmark size={14} /> Tipo
                                    </label>
                                    <select
                                        className="w-full bg-main border border-base rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                        value={form.type}
                                        onChange={e => setForm({ ...form, type: e.target.value })}
                                    >
                                        <option value="Primera agenda">Primera Agenda</option>
                                        <option value="Segunda agenda">Segunda Agenda</option>
                                        <option value="Pre-call">Pre-call</option>
                                        <option value="Cierre">Cierre</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button
                                    loading={submitting}
                                    variant="primary"
                                    className="w-full h-12 text-xs font-black tracking-widest shadow-lg shadow-primary/20"
                                    icon={Save}
                                >
                                    AGENDAR
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default QuickAppointmentModal;
