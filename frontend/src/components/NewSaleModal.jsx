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
        payment_type: 'full'
    });

    useEffect(() => {
        if (isOpen) {
            fetchMetadata();
            setStep(1);
            setError(null);
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-[#0f172a] border border-white/5 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute right-8 top-8 text-slate-500 hover:text-white transition-colors z-10 p-2 hover:bg-white/5 rounded-full"
                >
                    <X size={24} />
                </button>

                {/* Progress Bar */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5">
                    <div
                        className="h-full bg-indigo-500 transition-all duration-500 shadow-[0_0_15px_rgba(79,70,229,0.5)]"
                        style={{ width: `${(step / 3) * 100}%` }}
                    ></div>
                </div>

                <div className="p-12">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center gap-6">
                            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                            <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">Cargando Sistema...</p>
                        </div>
                    ) : step === 3 ? (
                        <div className="py-12 flex flex-col items-center text-center space-y-6 animate-in zoom-in duration-500">
                            <div className="w-24 h-24 bg-green-500/10 rounded-[2rem] flex items-center justify-center border border-green-500/20 shadow-[0_0_50px_rgba(34,197,94,0.2)]">
                                <ShieldCheck className="w-12 h-12 text-green-500" />
                            </div>
                            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">¡Venta Exitosa!</h2>
                            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">Actualizando Dashboard...</p>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-500">
                            <header className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <TrendingUp className="text-indigo-500" size={20} />
                                    <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Declarar Venta</h2>
                                </div>
                                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                                    {step === 1 ? 'Paso 1: Identificación del Lead' : 'Paso 2: Transacción & Producto'}
                                </p>
                            </header>

                            <form onSubmit={handleSubmit} className="space-y-8">
                                {step === 1 ? (
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                                                <User size={12} /> Seleccionar Lead
                                            </label>
                                            <div className="relative group/search">
                                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within/search:text-indigo-500 transition-colors" />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar por nombre o email..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold"
                                                />
                                            </div>
                                            <div className="max-h-60 overflow-y-auto custom-scrollbar bg-black/20 rounded-2xl border border-white/5 divide-y divide-white/5 mt-4">
                                                {filteredLeads.map(l => (
                                                    <button
                                                        key={l.id}
                                                        type="button"
                                                        onClick={() => { setFormData({ ...formData, lead_id: l.id }); setStep(2); }}
                                                        className={`w-full p-4 flex items-center justify-between hover:bg-white/5 transition-all text-left ${formData.lead_id === l.id ? 'bg-indigo-500/10' : ''}`}
                                                    >
                                                        <div>
                                                            <p className="text-sm font-bold text-white">{l.username}</p>
                                                            <p className="text-[10px] text-slate-500 font-medium uppercase">{l.email}</p>
                                                        </div>
                                                        <CheckCircle2 size={16} className={formData.lead_id === l.id ? 'text-indigo-500' : 'text-slate-800'} />
                                                    </button>
                                                ))}
                                                {filteredLeads.length === 0 && (
                                                    <div className="p-8 text-center">
                                                        <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">No se encontraron leads</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Producto</label>
                                                <select
                                                    required
                                                    value={formData.program_id}
                                                    onChange={handleProgramChange}
                                                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold appearance-none cursor-pointer"
                                                >
                                                    <option value="" className="bg-slate-900">Seleccionar...</option>
                                                    {metadata.programs.map(p => (
                                                        <option key={p.id} value={p.id} className="bg-slate-900">{p.name} (${p.price})</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Monto del Pago ($)</label>
                                                <input
                                                    required
                                                    type="number"
                                                    value={formData.payment_amount}
                                                    onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
                                                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold"
                                                    placeholder="0.00"
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Método de Pago</label>
                                                <select
                                                    required
                                                    value={formData.payment_method_id}
                                                    onChange={(e) => setFormData({ ...formData, payment_method_id: e.target.value })}
                                                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold appearance-none cursor-pointer"
                                                >
                                                    <option value="" className="bg-slate-900">Seleccionar...</option>
                                                    {metadata.payment_methods.map(m => (
                                                        <option key={m.id} value={m.id} className="bg-slate-900">{m.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Pago</label>
                                            <div className="grid grid-cols-3 gap-4">
                                                {['full', 'down_payment', 'installment'].map(type => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, payment_type: type })}
                                                        className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${formData.payment_type === type ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-black/20 border-white/5 text-slate-500 hover:text-slate-300'}`}
                                                    >
                                                        {type === 'full' ? 'Completo' : type === 'down_payment' ? 'Seña' : 'Cuota'}
                                                    </button>
                                                ))}
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
                                        <button
                                            type="button"
                                            onClick={() => setStep(1)}
                                            className="px-8 py-5 bg-white/5 text-slate-400 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white/10 hover:text-white transition-all shadow-xl"
                                        >
                                            Atrás
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={submitting || (step === 1 && !formData.lead_id)}
                                        className={`flex-1 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-4 transition-all active:scale-95 shadow-xl ${submitting || (step === 1 && !formData.lead_id) ? 'bg-slate-800 text-slate-600 opacity-50' : 'bg-white text-black hover:bg-slate-200'}`}
                                    >
                                        {submitting ? <Loader2 className="animate-spin" size={20} /> : (
                                            <>
                                                {step === 1 ? 'Siguiente Protocolo' : 'Completar Registro'}
                                            </>
                                        )}
                                    </button>
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
