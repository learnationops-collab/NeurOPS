
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { X, User, Clock, Save, AlertCircle, Bookmark, Loader2, CheckCircle2, Calendar as CalendarIcon } from 'lucide-react';
import Button from '../ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const QuickAppointmentModal = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [leads, setLeads] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Slots State
    const [slots, setSlots] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null); // ISO Date string
    const [availableDates, setAvailableDates] = useState([]);

    const [form, setForm] = useState({
        lead_id: '',
        start_time: '',
        type: 'Primera agenda'
    });

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            Promise.all([fetchLeads(), fetchSlots()])
                .finally(() => setLoading(false));
            setSearchTerm('');
            setForm(prev => ({ ...prev, lead_id: '', start_time: '' }));
            setSelectedDate(null);
        }
    }, [isOpen]);


    const fetchLeads = async () => {
        try {
            const res = await api.get('/closer/leads?per_page=100');
            setLeads(res.data.leads || []);
        } catch (err) {
            console.error(err);
            setError("Error al cargar lista de leads");
        }
    };

    const fetchSlots = async () => {
        try {
            const res = await api.get('/closer/slots?days=4');
            const slotsData = res.data || [];
            setSlots(slotsData);

            // Extract unique dates
            const dates = [...new Set(slotsData.map(s => s.date))];
            setAvailableDates(dates);
        } catch (err) {
            console.error(err);
            setError("Error al cargar horarios disponibles");
        }
    };

    const handleLeadSelect = (lead) => {
        setForm({ ...form, lead_id: lead.id });
        setSearchTerm(lead.username || lead.email);
        setIsDropdownOpen(false);
    };

    const filteredLeads = leads.filter(lead =>
        (lead.username && lead.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.lead_id) {
            setError("Debes seleccionar un lead");
            return;
        }
        if (!form.start_time) {
            setError("Debes seleccionar un horario");
            return;
        }

        setSubmitting(true);
        try {
            await api.post('/closer/appointments', {
                lead_id: form.lead_id,
                start_time: form.start_time,
                type: form.type,
            });

            toast.success("¡Agenda creada con éxito! 🚀", {
                duration: 4000,
                position: 'top-center',
                style: {
                    background: '#10b981',
                    color: '#fff',
                    borderRadius: '1rem',
                    fontWeight: '900',
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }
            });

            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || "Error al crear agenda");
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr + 'T12:00:00'); // Use noon to avoid TZ shift
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
    };

    const timesForSelectedDate = slots.filter(s => s.date === selectedDate);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-surface border border-base rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
                <div className="p-6 md:p-8 border-b border-base flex justify-between items-center bg-surface/50 shrink-0">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-base italic tracking-tighter">Nueva agenda</h2>
                        <p className="text-[10px] font-bold text-muted tracking-widest uppercase">Próximos 4 días disponibles</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-surface-hover rounded-2xl text-muted hover:text-white transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 md:p-8 space-y-6 md:space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="animate-spin text-primary" size={32} />
                            <p className="text-[10px] font-black text-muted tracking-widest uppercase">Sincronizando horarios...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-8">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-[10px] font-black tracking-widest flex items-center gap-3 uppercase"
                                >
                                    <AlertCircle size={16} />
                                    {error}
                                </motion.div>
                            )}

                            {/* SELECT LEAD */}
                            <div className="space-y-3 relative">
                                <label className="text-[10px] font-black text-muted tracking-widest flex items-center gap-2 uppercase">
                                    <User size={14} className="text-primary" /> 1. Cliente / Lead
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="w-full h-14 bg-main border border-base rounded-2xl px-6 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all placeholder:text-muted/30"
                                        placeholder="Buscar por nombre o email..."
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setIsDropdownOpen(true);
                                            if (e.target.value === '') setForm(f => ({ ...f, lead_id: '' }));
                                        }}
                                        onFocus={() => setIsDropdownOpen(true)}
                                        onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                    />
                                    {form.lead_id && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                                            <CheckCircle2 size={20} />
                                        </div>
                                    )}
                                    <AnimatePresence>
                                        {isDropdownOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                className="absolute top-full left-0 w-full mt-4 bg-surface border border-base rounded-2xl shadow-2xl max-h-60 overflow-y-auto z-50 custom-scrollbar"
                                            >
                                                {filteredLeads.length > 0 ? filteredLeads.map(l => (
                                                    <button
                                                        key={l.id}
                                                        type="button"
                                                        onClick={() => handleLeadSelect(l)}
                                                        className="w-full text-left px-6 py-4 hover:bg-surface-hover transition-colors flex flex-col gap-0.5 border-b border-base last:border-0"
                                                    >
                                                        <span className="text-sm font-black text-base italic">{l.username || 'Sin nombre'}</span>
                                                        <span className="text-[10px] text-muted font-bold">{l.email}</span>
                                                    </button>
                                                )) : (
                                                    <div className="p-6 text-center text-muted text-[10px] font-black tracking-widest uppercase">No se encontraron leads</div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* SELECT DATE */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-muted tracking-widest flex items-center gap-2 uppercase">
                                    <CalendarIcon size={14} className="text-primary" /> 2. Selecciona el día
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {availableDates.length > 0 ? availableDates.map(date => (
                                        <button
                                            key={date}
                                            type="button"
                                            onClick={() => {
                                                setSelectedDate(date);
                                                setForm(prev => ({ ...prev, start_time: '' }));
                                            }}
                                            className={`h-14 px-4 rounded-2xl border-2 transition-all font-black text-[10px] tracking-widest uppercase flex flex-col items-center justify-center gap-1 ${selectedDate === date
                                                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                                                    : 'bg-main border-base text-muted hover:border-primary/50'
                                                }`}
                                        >
                                            {formatDate(date)}
                                        </button>
                                    )) : (
                                        <div className="col-span-2 py-4 text-center text-muted text-[10px] font-black italic">No hay días disponibles</div>
                                    )}
                                </div>
                            </div>

                            {/* SELECT TIME */}
                            <AnimatePresence>
                                {selectedDate && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="space-y-4 overflow-hidden"
                                    >
                                        <label className="text-[10px] font-black text-muted tracking-widest flex items-center gap-2 uppercase">
                                            <Clock size={14} className="text-primary" /> 3. Horarios para el {formatDate(selectedDate)}
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {timesForSelectedDate.length > 0 ? timesForSelectedDate.map(slot => (
                                                <button
                                                    key={slot.utc_iso}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, start_time: slot.utc_iso })}
                                                    className={`h-12 rounded-xl border-2 transition-all font-black text-[11px] italic leading-none ${form.start_time === slot.utc_iso
                                                            ? 'bg-secondary border-secondary text-white shadow-lg shadow-secondary/20'
                                                            : 'bg-main border-base text-muted hover:border-secondary/50'
                                                        }`}
                                                >
                                                    {slot.start}
                                                </button>
                                            )) : (
                                                <div className="col-span-3 py-4 text-center text-muted text-[10px] font-black italic">No hay horas disponibles</div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* SELECT TYPE & SUBMIT */}
                            <div className="pt-4 space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-muted tracking-widest flex items-center gap-2 uppercase">
                                        <Bookmark size={14} className="text-primary" /> Tipo de agenda
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {['Primera agenda', 'Segunda agenda', 'Pre-call', 'Cierre'].map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setForm({ ...form, type: t })}
                                                className={`h-12 rounded-xl border-2 transition-all text-[10px] font-black tracking-widest uppercase ${form.type === t
                                                        ? 'bg-surface border-primary text-primary'
                                                        : 'bg-main border-base text-muted hover:border-base-hover'
                                                    }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <Button
                                    loading={submitting}
                                    variant="primary"
                                    className="w-full h-16 text-xs font-black tracking-widest shadow-xl shadow-primary/20 rounded-2xl mt-4"
                                    icon={Save}
                                    disabled={!form.lead_id || !form.start_time}
                                >
                                    Confirmar Agenda
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
