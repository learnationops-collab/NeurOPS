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
    ShieldCheck
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

    const [formData, setFormData] = useState({
        lead_id: '',
        program_id: '',
        payment_amount: '',
        payment_method_id: '',
        payment_type: ''
    });
    const [allowedPaymentTypes, setAllowedPaymentTypes] = useState([]);
    const [loadingStatus, setLoadingStatus] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchMetadata();
            setStep(1);
            setError(null);
            setAllowedPaymentTypes([]);
        }
    }, [isOpen]);

    const fetchMetadata = async () => {
        setLoading(true);
        try {
            const res = await api.get('/closer/sale-metadata');
            setMetadata(res.data);
        } catch (err) {
            setError("Error al cargar datos necesarios.");
        } finally {
            setLoading(false);
        }
    };

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
        try {
            await api.post('/closer/sales', formData);
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

    const filteredLeads = metadata.leads.filter(l =>
        l.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                                                <User size={12} /> Seleccionar Lead
                                            </label>
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
                                            <div className="max-h-60 overflow-y-auto custom-scrollbar bg-main rounded-2xl border border-base divide-y divide-base mt-4">
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
                                                {filteredLeads.length === 0 && (
                                                    <div className="p-8 text-center">
                                                        <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-20">No se encontraron leads</p>
                                                    </div>
                                                )}
                                            </div>
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
                                        <Button
                                            type="button"
                                            onClick={() => setStep(1)}
                                            variant="ghost"
                                            className="px-8 py-5 h-16"
                                        >
                                            Atrás
                                        </Button>
                                    )}
                                    <Button
                                        type="submit"
                                        loading={submitting}
                                        disabled={step === 1 && !formData.lead_id}
                                        variant="primary"
                                        className="flex-1 py-5 h-16"
                                    >
                                        {step === 1 ? 'Siguiente Protocolo' : 'Completar Registro'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes zoom-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .animate-in { animation: initial 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
                .fade-in { animation-name: fade-in; }
                .zoom-in { animation-name: zoom-in; }
            `}} />
        </div>
    );
};

export default NewSaleModal;
