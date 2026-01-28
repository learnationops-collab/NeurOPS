import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    X,
    Search,
    Loader2,
    CheckCircle2,
    DollarSign,
    User,
    Briefcase,
    CreditCard,
    AlertCircle,
    TrendingUp,
    ShieldCheck,
    UserPlus,
    Calendar,
    Instagram,
    Webhook,
    Globe,
    FlaskConical
} from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';

const NewSaleModal = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [metadata, setMetadata] = useState({ programs: [], payment_methods: [], leads: [] });
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    const [formData, setFormData] = useState({
        lead_id: '',
        program_id: '',
        payment_amount: '',
        payment_method_id: '',
        payment_type: '',
        client_data: { name: '', email: '', phone: '', instagram: '' },
        appointment_date: new Date().toISOString(),
        trigger_webhook: true,
        webhook_mode: 'test'
    });
    const [isNewClient, setIsNewClient] = useState(false);
    const [allowedPaymentTypes, setAllowedPaymentTypes] = useState([]);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [hasActiveIntegration, setHasActiveIntegration] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchMetadata();
            setStep(1);
            setError(null);
            setAllowedPaymentTypes([]);
            setIsNewClient(false);
            setFormData(prev => ({
                ...prev,
                lead_id: '',
                program_id: '',
                payment_amount: '',
                payment_method_id: '',
                payment_type: '',
                client_data: { name: '', email: '', phone: '', instagram: '' },
                appointment_date: new Date().toISOString(),
                trigger_webhook: true,
                webhook_mode: 'test'
            }));
        }
    }, [isOpen]);

    const fetchMetadata = async () => {
        setLoading(true);
        try {
            const res = await api.get('/closer/sale-metadata');
            setMetadata(res.data);

            // Check integration from metadata
            if (res.data.integration && res.data.integration.configured) {
                setHasActiveIntegration(true);
                setFormData(prev => ({ ...prev, webhook_mode: res.data.integration.active_env }));
            } else {
                setHasActiveIntegration(false);
            }
        } catch (err) {
            console.error(err);
            setError("Error cargando datos del sistema.");
        } finally {
            setLoading(false);
        }
    };

    // Debounced Search Effect
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length >= 2) {
                try {
                    const res = await api.get(`/closer/leads/search?q=${searchTerm}`);
                    setSearchResults(res.data);
                } catch (error) {
                    console.error("Search error:", error);
                }
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const handleLeadSelect = async (lead) => {
        setFormData({ ...formData, lead_id: lead.id, payment_type: '' });
        setStep(2); // Move to step 2 immediately
        setLoadingStatus(true);
        try {
            const res = await api.get(`/closer/leads/${lead.id}/payment-status`);
            console.log("Payment status for lead:", lead.id, res.data);
            setAllowedPaymentTypes(res.data.allowed_types);

            const updates = { lead_id: lead.id, payment_type: '' }; // Start with lead_id and clear payment_type

            if (res.data.allowed_types.length > 0) {
                updates.payment_type = res.data.allowed_types[0];
            }

            if (res.data.program_id) {
                updates.program_id = res.data.program_id;
                updates.payment_amount = res.data.program_price || '';
            }

            setFormData(prev => ({ ...prev, ...updates }));

        } catch (err) {
            console.error("Error fetching payment status", err);
            // Fallback to basic options for new lead if API fails
            setAllowedPaymentTypes(['full', 'first_payment', 'down_payment']);
            // Also set lead_id and clear payment_type in case of error
            setFormData(prev => ({ ...prev, lead_id: lead.id, payment_type: '' }));
        } finally {
            setLoadingStatus(false);
        }
    };

    const handleProgramChange = (e) => {
        const pId = e.target.value;
        const program = metadata.programs.find(p => p.id === parseInt(pId));
        setFormData({
            ...formData,
            program_id: pId,
            payment_amount: program ? program.price : ''
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        // Prepare payload
        const payload = { ...formData };
        if (!isNewClient) {
            delete payload.client_data;
            delete payload.appointment_date;
        }

        try {
            await api.post('/closer/sales', payload);
            setStep(3);
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.error || "Error al registrar la venta.");
        } finally {
            setSubmitting(false);
        }
    };

    // Use searchResults instead of filtering locally
    const filteredLeads = searchTerm.length >= 2 ? searchResults : metadata.leads;

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
                        style={{ width: `${(step / 3) * 100}%` }}
                    ></div>
                </div>

                <div className="p-12">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center gap-6">
                            <Loader2 className="w-12 h-12 text-primary animate-spin" />
                            <p className="text-muted font-black uppercase tracking-[0.3em] text-[10px]">Cargando Sistema...</p>
                        </div>
                    ) : step === 3 ? (
                        <div className="py-12 flex flex-col items-center text-center space-y-6 animate-in zoom-in duration-500">
                            <div className="w-24 h-24 bg-success/10 rounded-[2rem] flex items-center justify-center border border-success/20 shadow-[0_0_50px_rgba(34,197,94,0.2)]">
                                <ShieldCheck className="w-12 h-12 text-success" />
                            </div>
                            <h2 className="text-4xl font-black text-base italic uppercase tracking-tighter">¡Venta Exitosa!</h2>
                            <p className="text-muted font-bold uppercase tracking-[0.2em] text-[10px]">Actualizando Dashboard...</p>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-500">
                            <header className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <TrendingUp className="text-primary" size={20} />
                                    <h2 className="text-3xl font-black text-base italic uppercase tracking-tighter">Declarar Venta</h2>
                                </div>
                                <p className="text-muted font-bold uppercase text-[10px] tracking-widest">
                                    {step === 1 ? 'Paso 1: Identificación del Lead' : 'Paso 2: Transacción & Producto'}
                                </p>
                            </header>

                            <form onSubmit={handleSubmit} className="space-y-8">
                                {step === 1 ? (
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                                                <User size={12} /> Seleccionar Lead o Crear Nuevo
                                            </label>

                                            {!isNewClient ? (
                                                <>
                                                    <div className="relative group/search">
                                                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within/search:text-primary transition-colors" />
                                                        <input
                                                            type="text"
                                                            placeholder="Buscar por nombre o email..."
                                                            value={searchTerm}
                                                            onChange={(e) => setSearchTerm(e.target.value)}
                                                            className="w-full bg-main border border-base rounded-2xl py-4 pl-14 pr-6 text-base text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                                        />
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => setIsNewClient(true)}
                                                        className="w-full py-4 border border-dashed border-primary/30 text-primary font-bold rounded-2xl hover:bg-primary/5 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                                                    >
                                                        <UserPlus size={16} />
                                                        Crear Nuevo Cliente
                                                    </button>

                                                    <div className="max-h-60 overflow-y-auto custom-scrollbar bg-main rounded-2xl border border-base divide-y divide-base mt-2">
                                                        {filteredLeads.map(l => (
                                                            <button
                                                                key={l.id}
                                                                type="button"
                                                                onClick={() => handleLeadSelect(l)}
                                                                className={`w-full p-4 flex items-center justify-between hover:bg-surface-hover transition-all text-left ${formData.lead_id === l.id ? 'bg-primary/10' : ''}`}
                                                            >
                                                                <div>
                                                                    <p className="text-sm font-bold text-base">{l.username}</p>
                                                                    <p className="text-[10px] text-muted font-medium uppercase">{l.email}</p>
                                                                </div>
                                                                <CheckCircle2 size={16} className={formData.lead_id === l.id ? 'text-primary' : 'text-muted'} />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                                    <div className="flex justify-between items-center">
                                                        <h4 className="text-xs font-black text-base uppercase tracking-widest">Nuevo Cliente</h4>
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsNewClient(false)}
                                                            className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wide"
                                                        >
                                                            Volver a buscar
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="col-span-2 space-y-2">
                                                            <input
                                                                required={isNewClient}
                                                                className="w-full px-5 py-3 bg-main border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                                                value={formData.client_data.name}
                                                                onChange={e => setFormData({ ...formData, client_data: { ...formData.client_data, name: e.target.value } })}
                                                                placeholder="Nombre Completo"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <input
                                                                required={isNewClient}
                                                                type="email"
                                                                className="w-full px-5 py-3 bg-main border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                                                value={formData.client_data.email}
                                                                onChange={e => setFormData({ ...formData, client_data: { ...formData.client_data, email: e.target.value } })}
                                                                placeholder="Email"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <input
                                                                required={isNewClient}
                                                                type="tel"
                                                                className="w-full px-5 py-3 bg-main border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                                                value={formData.client_data.phone}
                                                                onChange={e => setFormData({ ...formData, client_data: { ...formData.client_data, phone: e.target.value } })}
                                                                placeholder="Teléfono"
                                                            />
                                                        </div>
                                                        <div className="col-span-2 space-y-2">
                                                            <div className="relative">
                                                                <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                                                <input
                                                                    required={isNewClient}
                                                                    className="w-full pl-10 pr-5 py-3 bg-main border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                                                    value={formData.client_data.instagram}
                                                                    onChange={e => setFormData({ ...formData, client_data: { ...formData.client_data, instagram: e.target.value } })}
                                                                    placeholder="Instagram (Ej. @usuario)"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="col-span-2 space-y-2 pt-2 border-t border-base/50">
                                                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-1.5"><Calendar size={12} /> Fecha de la Reunión (Para Historial)</label>
                                                            <input
                                                                required={isNewClient}
                                                                type="datetime-local"
                                                                className="w-full px-5 py-3 bg-main border border-base rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                                                value={formData.appointment_date.slice(0, 16)}
                                                                onChange={e => setFormData({ ...formData, appointment_date: new Date(e.target.value).toISOString() })}
                                                            />
                                                        </div>
                                                    </div>

                                                    <Button
                                                        type="button"
                                                        onClick={() => {
                                                            setAllowedPaymentTypes(['full', 'first_payment', 'down_payment']); // Default for new clients
                                                            setStep(2);
                                                        }}
                                                        variant="primary"
                                                        className="w-full h-14"
                                                    >
                                                        Continuar
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Producto</label>
                                                <select
                                                    required
                                                    value={formData.program_id}
                                                    onChange={handleProgramChange}
                                                    className="w-full bg-main border border-base rounded-2xl py-4 px-6 text-base text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold appearance-none cursor-pointer"
                                                >
                                                    <option value="" className="bg-surface">Seleccionar...</option>
                                                    {metadata.programs.map(p => (
                                                        <option key={p.id} value={p.id} className="bg-surface">{p.name} (${p.price})</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Monto del Pago ($)</label>
                                                <input
                                                    required
                                                    type="number"
                                                    value={formData.payment_amount}
                                                    onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
                                                    className="w-full bg-main border border-base rounded-2xl py-4 px-6 text-base text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                                    placeholder="0.00"
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Método de Pago</label>
                                                <select
                                                    required
                                                    value={formData.payment_method_id}
                                                    onChange={(e) => setFormData({ ...formData, payment_method_id: e.target.value })}
                                                    className="w-full bg-main border border-base rounded-2xl py-4 px-6 text-base text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold appearance-none cursor-pointer"
                                                >
                                                    <option value="" className="bg-surface">Seleccionar...</option>
                                                    {metadata.payment_methods.map(m => (
                                                        <option key={m.id} value={m.id} className="bg-surface">{m.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Tipo de Pago</label>
                                            <div className="grid grid-cols-2 md:col-span-4 gap-4">
                                                {loadingStatus ? (
                                                    <div className="col-span-2 md:col-span-4 py-6 flex flex-col items-center justify-center gap-3 bg-main/50 rounded-2xl border border-base border-dashed">
                                                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                                        <span className="text-[9px] font-black uppercase text-muted tracking-[0.2em]">Analizando Historial...</span>
                                                    </div>
                                                ) : (
                                                    ['full', 'first_payment', 'down_payment', 'installment', 'renewal'].map(type => {
                                                        const isAllowed = allowedPaymentTypes.includes(type);
                                                        if (!isAllowed) return null;

                                                        const labels = {
                                                            full: 'Completo',
                                                            first_payment: 'Primer Pago',
                                                            down_payment: 'Seña',
                                                            installment: 'Cuota',
                                                            renewal: 'Renovación'
                                                        };

                                                        return (
                                                            <button
                                                                key={type}
                                                                type="button"
                                                                onClick={() => setFormData({ ...formData, payment_type: type })}
                                                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${formData.payment_type === type ? 'bg-primary border-primary text-white shadow-lg' : 'bg-main border-base text-muted hover:text-base'}`}
                                                            >
                                                                {labels[type]}
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-4 text-rose-400">
                                        <AlertCircle className="shrink-0" size={18} />
                                        <p className="text-[9px] font-black uppercase tracking-widest leading-relaxed">{error}</p>
                                    </div>
                                )}

                                <div className="flex gap-4 pt-4">
                                    {step === 2 && (
                                        <>
                                            <Button
                                                type="button"
                                                onClick={() => setStep(1)}
                                                variant="ghost"
                                                className="px-8 py-5 h-16"
                                            >
                                                Atrás
                                            </Button>

                                            <div className="flex-1 flex flex-col gap-4">
                                                <div className="pt-4 border-t border-base/50 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Webhook size={16} className={hasActiveIntegration ? 'text-primary' : 'text-muted'} />
                                                            <label className="text-[10px] font-black text-muted uppercase tracking-widest">Automatización (Webhook)</label>
                                                        </div>

                                                        {hasActiveIntegration ? (
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFormData(prev => ({ ...prev, trigger_webhook: !prev.trigger_webhook }))}
                                                                    className={`w-10 h-5 rounded-full transition-colors relative ${formData.trigger_webhook ? 'bg-primary' : 'bg-base'}`}
                                                                >
                                                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formData.trigger_webhook ? 'left-6' : 'left-1'}`} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[9px] uppercase font-bold text-muted bg-base px-2 py-1 rounded">No Configurado</span>
                                                        )}
                                                    </div>

                                                    {hasActiveIntegration && formData.trigger_webhook && (
                                                        <div className="bg-surface-hover p-3 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2">
                                                            <span className="text-[10px] font-bold text-muted uppercase">Modo de Envío</span>
                                                            <div className="flex bg-main rounded-lg p-0.5 border border-base">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFormData(prev => ({ ...prev, webhook_mode: 'test' }))}
                                                                    className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${formData.webhook_mode === 'test' ? 'bg-surface shadow text-primary' : 'text-muted hover:text-base'}`}
                                                                >
                                                                    <FlaskConical size={10} /> Test
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFormData(prev => ({ ...prev, webhook_mode: 'prod' }))}
                                                                    className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${formData.webhook_mode === 'prod' ? 'bg-surface shadow text-success' : 'text-muted hover:text-base'}`}
                                                                >
                                                                    <Globe size={10} /> Prod
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <Button
                                                    type="submit"
                                                    loading={submitting}
                                                    variant="primary"
                                                    className="h-14 w-full"
                                                    icon={CheckCircle2}
                                                >
                                                    Completar Registro
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                    {step === 1 && (
                                        <Button
                                            type="submit"
                                            loading={submitting}
                                            disabled={!formData.lead_id && !isNewClient}
                                            variant="primary"
                                            className="flex-1 py-5 h-16"
                                        >
                                            Siguiente Protocolo
                                        </Button>
                                    )}

                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div >

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes zoom-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .animate-in { animation: initial 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
                .fade-in { animation-name: fade-in; }
                .zoom-in { animation-name: zoom-in; }
            `}} />
        </div >
    );
};

export default NewSaleModal;
