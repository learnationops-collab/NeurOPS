import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    X,
    Search,
    Loader2,
    Calendar,
    User,
    CheckCircle2,
    AlertCircle,
    UserPlus,
    Clock,
    Instagram
} from 'lucide-react';
import Button from './ui/Button';

const AddAgendaModal = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [leads, setLeads] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState(null);
    const [isNewClient, setIsNewClient] = useState(false);

    const [formData, setFormData] = useState({
        lead_id: '',
        client_data: {
            name: '',
            email: '',
            phone: '',
            instagram: ''
        },
        start_date: new Date().toISOString().split('T')[0],
        start_time: '10:00',
        status: 'scheduled',
        type: 'Manual Closer',
        trigger_webhook: false
    });

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setError(null);
            setIsNewClient(false);
            setSearchTerm('');
            setFormData({
                lead_id: '',
                client_data: { name: '', email: '', phone: '', instagram: '' },
                start_date: new Date().toISOString().split('T')[0],
                start_time: '10:00',
                status: 'scheduled',
                type: 'Manual Closer'
            });
            fetchLeads(); // Pre-fetch some leads or rely on search
        }
    }, [isOpen]);

    const fetchLeads = async (search = '') => {
        setLoading(true);
        try {
            const res = await api.get('/closer/leads', { params: { search, page: 1 } });
            setLeads(res.data.leads || []);
        } catch (err) {
            console.error("Error searching leads", err);
            // Optionally handle error
        } finally {
            setLoading(false);
        }
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isOpen) fetchLeads(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, isOpen]);

    const handleLeadSelect = (lead) => {
        setFormData(prev => ({ ...prev, lead_id: lead.id }));
        setStep(2);
    };

    const handleCreateNewClient = () => {
        setIsNewClient(true);
        setFormData(prev => ({ ...prev, lead_id: '' }));
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        // Combine date and time to ISO
        const isoDateTime = new Date(`${formData.start_date}T${formData.start_time}`).toISOString();

        const payload = {
            start_time: isoDateTime,
            status: formData.status,
            type: formData.type,
            trigger_webhook: formData.trigger_webhook
        };

        if (isNewClient) {
            payload.client_data = formData.client_data;
        } else {
            payload.lead_id = formData.lead_id;
        }

        try {
            await api.post('/closer/appointments', payload);
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1000);
        } catch (err) {
            setError(err.response?.data?.error || "Error al crear la agenda.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-surface border border-base rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute right-8 top-8 text-muted hover:text-base transition-colors z-10 p-2 hover:bg-surface-hover rounded-full"
                >
                    <X size={24} />
                </button>

                {/* Progress Bar */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-base">
                    <div
                        className="h-full bg-primary transition-all duration-500 shadow-[0_0_15px_var(--color-primary)]"
                        style={{ width: `${(step / 2) * 100}%` }}
                    ></div>
                </div>

                <div className="p-12">
                    <header className="space-y-2 mb-8">
                        <div className="flex items-center gap-3">
                            <Calendar className="text-primary" size={24} />
                            <h2 className="text-3xl font-black text-base italic uppercase tracking-tighter">Nueva Agenda</h2>
                        </div>
                        <p className="text-muted font-bold uppercase text-[10px] tracking-widest">
                            {step === 1 ? 'Paso 1: Seleccionar Cliente' : 'Paso 2: Detalles de la Cita'}
                        </p>
                    </header>

                    {step === 1 ? (
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <User size={12} /> Buscar Cliente
                                </label>
                                <div className="relative group/search">
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within/search:text-primary transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-main border border-base rounded-2xl py-4 pl-14 pr-6 text-base text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                        autoFocus
                                    />
                                </div>
                                <div className="max-h-60 overflow-y-auto custom-scrollbar bg-main rounded-2xl border border-base divide-y divide-base mt-4">
                                    {loading ? (
                                        <div className="p-8 flex justify-center">
                                            <Loader2 className="animate-spin text-muted" />
                                        </div>
                                    ) : (
                                        <>
                                            {leads.map(l => (
                                                <button
                                                    key={l.id}
                                                    type="button"
                                                    onClick={() => handleLeadSelect(l)}
                                                    className="w-full p-4 flex items-center justify-between hover:bg-surface-hover transition-all text-left"
                                                >
                                                    <div>
                                                        <p className="text-sm font-bold text-base">{l.username}</p>
                                                        <p className="text-[10px] text-muted font-medium uppercase">{l.email}</p>
                                                    </div>
                                                    <CheckCircle2 size={16} className="text-muted group-hover:text-primary" />
                                                </button>
                                            ))}
                                            {leads.length === 0 && searchTerm && (
                                                <div className="p-4 text-center text-xs text-muted">
                                                    No se encontraron resultados para "{searchTerm}"
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={handleCreateNewClient}
                                className="w-full py-4 border border-dashed border-primary/30 text-primary font-bold rounded-2xl hover:bg-primary/5 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                            >
                                <UserPlus size={16} />
                                Crear Nuevo Cliente
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {isNewClient && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Nombre Completo</label>
                                        <input
                                            required
                                            className="w-full px-5 py-3 bg-main border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                            value={formData.client_data.name}
                                            onChange={e => setFormData({ ...formData, client_data: { ...formData.client_data, name: e.target.value } })}
                                            placeholder="Juan Perez"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Email</label>
                                        <input
                                            required
                                            type="email"
                                            className="w-full px-5 py-3 bg-main border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                            value={formData.client_data.email}
                                            onChange={e => setFormData({ ...formData, client_data: { ...formData.client_data, email: e.target.value } })}
                                            placeholder="juan@email.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Teléfono</label>
                                        <input
                                            required
                                            type="tel"
                                            className="w-full px-5 py-3 bg-main border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                            value={formData.client_data.phone}
                                            onChange={e => setFormData({ ...formData, client_data: { ...formData.client_data, phone: e.target.value } })}
                                            placeholder="+591..."
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-1.5"><Instagram size={12} /> Instagram (Requerido)</label>
                                        <input
                                            required
                                            className="w-full px-5 py-3 bg-main border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                            value={formData.client_data.instagram}
                                            onChange={e => setFormData({ ...formData, client_data: { ...formData.client_data, instagram: e.target.value } })}
                                            placeholder="@usuario"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Fecha</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full px-5 py-3 bg-main border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Hora</label>
                                    <input
                                        required
                                        type="time"
                                        className="w-full px-5 py-3 bg-main border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                        value={formData.start_time}
                                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Estado</label>
                                    <select
                                        className="w-full px-5 py-3 bg-main border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="scheduled">Programada</option>
                                        <option value="completed">Completada</option>
                                        <option value="no_show">No Show</option>
                                        <option value="canceled">Cancelada</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Tipo</label>
                                    <select
                                        className="w-full px-5 py-3 bg-main border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="Manual Closer">Manual Closer</option>
                                        <option value="Primera agenda">Primera agenda</option>
                                        <option value="Seguimiento">Seguimiento</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl">
                                <div className="space-y-1">
                                    <h4 className="text-xs font-black text-base uppercase tracking-wider flex items-center gap-2">
                                        <Clock size={14} className="text-primary" /> Automatización (Webhook)
                                    </h4>
                                    <p className="text-[10px] text-muted">Enviar datos a la integración "Agenda"</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.trigger_webhook}
                                        onChange={(e) => setFormData(prev => ({ ...prev, trigger_webhook: e.target.checked }))}
                                    />
                                    <div className="w-11 h-6 bg-main border-2 border-base peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-muted after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-checked:after:bg-white animate-in fade-in"></div>
                                </label>
                            </div>

                            {error && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400">
                                    <AlertCircle size={16} />
                                    <p className="text-xs font-bold">{error}</p>
                                </div>
                            )}

                            <div className="flex gap-4 pt-4">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setStep(1)}
                                    className="px-6"
                                >
                                    Atrás
                                </Button>
                                <Button
                                    type="submit"
                                    loading={submitting}
                                    variant="primary"
                                    className="flex-1"
                                    icon={CheckCircle2}
                                >
                                    Confirmar Agenda
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddAgendaModal;
