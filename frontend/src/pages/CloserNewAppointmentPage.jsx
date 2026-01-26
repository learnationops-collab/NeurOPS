import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Calendar, User, Clock, Save, AlertCircle, Bookmark } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const CloserNewAppointmentPage = () => {
    const navigate = useNavigate();
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
        const fetchLeads = async () => {
            try {
                // Reuse metadata endpoint or fetch leads specifically
                const res = await api.get('/closer/sale-metadata');
                setLeads(res.data.leads || []);
            } catch (err) {
                console.error(err);
                setError("Error al cargar lista de leads");
            } finally {
                setLoading(false);
            }
        };
        fetchLeads();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/closer/appointments', form);
            navigate('/closer/leads'); // Redirect to agendas db
        } catch (err) {
            setError(err.response?.data?.error || "Error al crear agenda");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-20 text-center uppercase font-black text-xs text-muted tracking-widest">Cargando formulario...</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="space-y-2">
                <h1 className="text-4xl font-black text-base italic tracking-tighter uppercase">Nueva Agenda Manual</h1>
                <p className="text-muted text-xs font-bold uppercase tracking-widest">Registra un evento en el calendario fuera del embudo automático</p>
            </header>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500">
                    <AlertCircle size={20} />
                    <p className="font-bold text-xs uppercase tracking-wide">{error}</p>
                </div>
            )}

            <Card variant="surface" className="p-8 border-primary/20">
                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* Lead Seletion */}
                    <div className="space-y-3">
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
                                <option key={l.id} value={l.id}>{l.username} ({l.email})</option>
                            ))}
                        </select>
                        <p className="text-[9px] text-muted font-medium italic">* Solo aparecen leads con actividad reciente</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Date Time */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                <Clock size={14} /> Fecha y Hora
                            </label>
                            <input
                                type="datetime-local"
                                className="w-full bg-main border border-base rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                value={form.start_time}
                                onChange={e => setForm({ ...form, start_time: e.target.value })}
                                required
                            />
                        </div>

                        {/* Type */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                <Bookmark size={14} /> Tipo de Evento
                            </label>
                            <select
                                className="w-full bg-main border border-base rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                value={form.type}
                                onChange={e => setForm({ ...form, type: e.target.value })}
                                required
                            >
                                <option value="Primera agenda">Primera Agenda</option>
                                <option value="Segunda agenda">Segunda Agenda</option>
                                <option value="Seguimiento">Seguimiento</option>
                                <option value="Cierre">Cierre</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-8 flex justify-end">
                        <Button
                            loading={submitting}
                            variant="primary"
                            size="lg"
                            className="w-full md:w-auto shadow-xl shadow-primary/20"
                            icon={Save}
                        >
                            Crear Agenda
                        </Button>
                    </div>

                </form>
            </Card>
        </div>
    );
};

export default CloserNewAppointmentPage;
