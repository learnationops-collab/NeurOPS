
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { Calendar as CalendarIcon, User, Clock, Save, AlertCircle, Bookmark, Loader2, CheckCircle2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const CloserNewAppointmentPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [leads, setLeads] = useState([]);

    // Slots State
    const [slots, setSlots] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [availableDates, setAvailableDates] = useState([]);

    const [form, setForm] = useState({
        lead_id: '',
        start_time: '',
        type: 'Primera agenda'
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [metaRes, slotsRes] = await Promise.all([
                    api.get('/closer/sale-metadata'),
                    api.get('/closer/slots?days=4')
                ]);

                setLeads(metaRes.data.leads || []);

                const slotsData = slotsRes.data || [];
                setSlots(slotsData);
                const dates = [...new Set(slotsData.map(s => s.date))];
                setAvailableDates(dates);

            } catch (err) {
                console.error(err);
                setError("Error al cargar datos del formulario");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.lead_id) return setError("Selecciona un lead");
        if (!form.start_time) return setError("Selecciona un horario");

        setSubmitting(true);
        try {
            await api.post('/closer/appointments', form);
            toast.success("Agenda registrada con éxito 🚀");
            navigate('/closer/leads'); // Redirect to agendas db
        } catch (err) {
            setError(err.response?.data?.error || "Error al crear agenda");
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr + 'T12:00:00');
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
    };

    const timesForSelectedDate = slots.filter(s => s.date === selectedDate);

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-40 gap-4">
            <Loader2 className="animate-spin text-primary" size={32} />
            <p className="font-black text-[10px] text-muted tracking-widest">Preparando agenda...</p>
        </div>
    );

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            <header className="space-y-3 border-b border-base pb-8">
                <h1 className="text-5xl font-black text-base tracking-tighter leading-none">Nueva Agenda</h1>
                <p className="text-muted text-[10px] font-black tracking-[0.2em]">Restringido a los próximos 4 días disponibles</p>
            </header>

            {error && (
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-4 text-rose-500"
                >
                    <AlertCircle size={20} />
                    <p className="font-black text-[10px] tracking-widest leading-relaxed">{error}</p>
                </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-12 space-y-12">
                    {/* SECTION 1: LEAD SELECTION */}
                    <Card variant="surface" className="p-8 space-y-6">
                        <label className="text-[10px] font-black text-muted tracking-widest flex items-center gap-2">
                            <User size={14} className="text-primary" /> 1. Cliente o Lead
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select
                                className="w-full bg-main border-2 border-base rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all"
                                value={form.lead_id}
                                onChange={e => setForm({ ...form, lead_id: e.target.value })}
                                required
                            >
                                <option value="">Seleccionar del CRM...</option>
                                {leads.map(l => (
                                    <option key={l.id} value={l.id}>{l.username || l.email}</option>
                                ))}
                            </select>
                            <div className="flex items-center px-6 py-4 bg-primary/5 border-2 border-primary/20 rounded-2xl gap-3">
                                {form.lead_id ? (
                                    <>
                                        <CheckCircle2 className="text-emerald-500" size={18} />
                                        <span className="text-[10px] font-black text-primary tracking-widest">Lead seleccionado</span>
                                    </>
                                ) : (
                                    <span className="text-[10px] font-black text-muted tracking-widest">Esperando selección...</span>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* SECTION 2: DAY SELECTION */}
                    <Card variant="surface" className="p-8 space-y-6">
                        <label className="text-[10px] font-black text-muted tracking-widest flex items-center gap-2">
                            <CalendarIcon size={14} className="text-primary" /> 2. Selecciona el día
                        </label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {availableDates.map(date => (
                                <button
                                    key={date}
                                    type="button"
                                    onClick={() => {
                                        setSelectedDate(date);
                                        setForm(prev => ({ ...prev, start_time: '' }));
                                    }}
                                    className={`h-20 px-4 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${selectedDate === date
                                        ? 'bg-primary border-primary text-white shadow-xl shadow-primary/30'
                                        : 'bg-main border-base text-muted hover:border-primary/50'
                                        }`}
                                >
                                    <span className="text-[10px] font-black tracking-tighter opacity-80">{formatDate(date).split(' ')[0]}</span>
                                    <span className="text-lg font-black tabular-nums leading-none">{formatDate(date).split(' ')[1]}</span>
                                    <span className="text-[9px] font-bold uppercase">{formatDate(date).split(' ')[2]}</span>
                                </button>
                            ))}
                        </div>
                    </Card>

                    {/* SECTION 3: TIME SELECTION */}
                    <AnimatePresence>
                        {selectedDate && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                            >
                                <Card variant="surface" className="p-8 space-y-6">
                                    <label className="text-[10px] font-black text-muted tracking-widest flex items-center gap-2">
                                        <Clock size={14} className="text-primary" /> 3. Horarios disponibles ({formatDate(selectedDate)})
                                    </label>
                                    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                        {timesForSelectedDate.map(slot => (
                                            <button
                                                key={slot.utc_iso}
                                                type="button"
                                                onClick={() => setForm({ ...form, start_time: slot.utc_iso })}
                                                className={`h-12 rounded-xl border-2 transition-all font-black text-xs tabular-nums ${form.start_time === slot.utc_iso
                                                    ? 'bg-secondary border-secondary text-white shadow-lg shadow-secondary/20 scale-105'
                                                    : 'bg-main border-base text-muted hover:border-secondary/50'
                                                    }`}
                                            >
                                                {slot.start}
                                            </button>
                                        ))}
                                    </div>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* SECTION 4: FINAL CONFIG */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        <Card variant="surface" className="p-8 space-y-6">
                            <label className="text-[10px] font-black text-muted tracking-widest flex items-center gap-2">
                                <Bookmark size={14} className="text-primary" /> Tipo de Agenda
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {['Primera agenda', 'Segunda agenda', 'Pre-call', 'Cierre'].map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setForm({ ...form, type: t })}
                                        className={`h-12 rounded-2xl border-2 transition-all text-[10px] font-black tracking-widest uppercase ${form.type === t
                                            ? 'bg-surface border-primary text-primary shadow-lg shadow-primary/5'
                                            : 'bg-main border-base text-muted hover:border-base-hover'
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </Card>

                        <div className="flex flex-col justify-end gap-6">
                            <Button
                                onClick={handleSubmit}
                                loading={submitting}
                                variant="primary"
                                className="w-full h-24 text-sm font-black tracking-[0.2em] shadow-2xl shadow-primary/30 rounded-[2rem] hover:scale-[1.02] active:scale-[0.98] transition-all"
                                icon={Save}
                                disabled={!form.lead_id || !form.start_time}
                            >
                                Confirmar y Agendar
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CloserNewAppointmentPage;
