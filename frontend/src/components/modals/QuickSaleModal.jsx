
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { X, User, DollarSign, Wallet, CheckCircle2, Save, Loader2, AlertCircle, Box } from 'lucide-react';
import Button from '../ui/Button';
import { motion } from 'framer-motion';

const QuickSaleModal = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [metadata, setMetadata] = useState({ programs: [], payment_methods: [], leads: [] });

    const [form, setForm] = useState({
        lead_id: '',
        program_id: '',
        payment_method_id: '',
        payment_amount: '',
        payment_type: 'full',
        status: 'completed'
    });

    useEffect(() => {
        if (isOpen) {
            fetchMetadata();
        }
    }, [isOpen]);


    const fetchMetadata = async () => {
        setLoading(true);
        setError(null);
        try {
            // Use Closer API for metadata (programs, methods, leads)
            const res = await api.get('/closer/sale-metadata');

            setMetadata({
                programs: res.data.programs || [],
                payment_methods: res.data.payment_methods || [],
                leads: res.data.leads || []
            });
        } catch (err) {
            console.error(err);
            setError("Error al cargar datos");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/closer/sales', {
                ...form,
                trigger_webhook: true // Ensure webhook triggers for quick sales
            });

            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || "Error al registrar venta");
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
                className="w-full max-w-2xl bg-surface border border-base rounded-[2rem] shadow-2xl overflow-hidden"
            >
                <div className="p-6 border-b border-base flex justify-between items-center bg-surface/50">
                    <h2 className="text-xl font-black text-base italic uppercase tracking-tighter">Nueva Venta</h2>
                    <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-full text-muted hover:text-white transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="animate-spin text-primary" size={32} />
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
                                    {metadata.leads.map(l => (
                                        <option key={l.id} value={l.id}>{l.username || l.email}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                        <Box size={14} /> Programa
                                    </label>
                                    <select
                                        className="w-full bg-main border border-base rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                        value={form.program_id}
                                        onChange={e => {
                                            const prog = metadata.programs.find(p => p.id === parseInt(e.target.value));
                                            setForm({
                                                ...form,
                                                program_id: e.target.value,
                                                payment_amount: prog ? prog.price : ''
                                            });
                                        }}
                                        required
                                    >
                                        <option value="">Seleccionar...</option>
                                        {metadata.programs.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                        <DollarSign size={14} /> Monto Confimado
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-main border border-base rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                        placeholder="0.00"
                                        value={form.payment_amount}
                                        onChange={e => setForm({ ...form, payment_amount: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                        <Wallet size={14} /> Método de Pago
                                    </label>
                                    <select
                                        className="w-full bg-main border border-base rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                        value={form.payment_method_id}
                                        onChange={e => setForm({ ...form, payment_method_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Seleccionar...</option>
                                        {metadata.payment_methods.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                        <CheckCircle2 size={14} /> Estado
                                    </label>
                                    <div className="flex bg-main rounded-xl p-1 border border-base">
                                        {['completed', 'pending'].map(st => (
                                            <button
                                                key={st}
                                                type="button"
                                                onClick={() => setForm({ ...form, status: st })}
                                                className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${form.status === st ? (st === 'completed' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-amber-500 text-white shadow-lg') : 'text-muted hover:text-base'}`}
                                            >
                                                {st === 'completed' ? 'Pagado' : 'Pendiente'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button
                                    loading={submitting}
                                    variant="primary"
                                    className="w-full h-14 text-xs font-black tracking-widest shadow-xl shadow-primary/20"
                                    icon={Save}
                                >
                                    REGISTRAR VENTA
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default QuickSaleModal;
