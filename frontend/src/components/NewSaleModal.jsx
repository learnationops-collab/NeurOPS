import { useState, useEffect } from 'react';
import api from '../services/api';
import { X, Search, Loader2, CheckCircle2 } from 'lucide-react';

const NewSaleModal = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [leads, setLeads] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [methods, setMethods] = useState([]);
    const [closers, setClosers] = useState([]);

    const [formData, setFormData] = useState({
        lead_id: '',
        program_id: '',
        payment_type: 'full',
        amount: '',
        payment_method_id: '',
        closer_id: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
            setStep(1);
        }
    }, [isOpen]);

    const fetchInitialData = async () => {
        try {
            const [p, m, u] = await Promise.all([
                api.get('/admin/programs'),
                api.get('/admin/payment-methods'),
                api.get('/admin/users', { params: { role: 'closer' } })
            ]);
            setPrograms(p.data);
            setMethods(m.data);
            setClosers(u.data);
        } catch (err) { console.error(err); }
    };

    const handleSearchLeads = async (q) => {
        setSearchQuery(q);
        if (q.length < 2) return setLeads([]);
        try {
            const res = await api.get('/admin/leads/search', { params: { q } });
            setLeads(res.data);
        } catch (err) { console.error(err); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/admin/finance/sales', formData);
            setStep(3);
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);
        } catch (err) {
            alert(err.response?.data?.message || "Error al registrar venta");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                <button onClick={onClose} className="absolute right-6 top-6 text-slate-500 hover:text-white transition-colors">
                    <X size={24} />
                </button>

                <div className="p-10">
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-black text-white italic">Nueva Venta</h2>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Paso 1: Seleccionar Cliente</p>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-11 pr-4 py-4 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Buscar por usuario o email..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearchLeads(e.target.value)}
                                />
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                                {leads.map(l => (
                                    <button
                                        key={l.id}
                                        onClick={() => { setFormData({ ...formData, lead_id: l.id }); setStep(2); }}
                                        className="w-full p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-2xl flex items-center justify-between text-left transition-all"
                                    >
                                        <div>
                                            <p className="text-sm font-bold text-white">{l.username}</p>
                                            <p className="text-[10px] text-slate-500">{l.email}</p>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                            <CheckCircle2 size={16} />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-black text-white italic">Detalles del Cobro</h2>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Paso 2: Configuracion de Pago</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Programa</label>
                                    <select
                                        required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                                        value={formData.program_id}
                                        onChange={(e) => {
                                            const p = programs.find(x => x.id == e.target.value);
                                            setFormData({ ...formData, program_id: e.target.value, amount: p?.price || '' });
                                        }}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {programs.map(p => <option key={p.id} value={p.id}>{p.name} (${p.price})</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Tipo de Pago</label>
                                    <select
                                        required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                                        value={formData.payment_type}
                                        onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
                                    >
                                        <option value="full">Pago Completo</option>
                                        <option value="down_payment">Primer Pago</option>
                                        <option value="installment">Cuota</option>
                                        <option value="renewal">Renovacion</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Monto Cobrado ($)</label>
                                    <input
                                        type="number" step="0.01" required
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Metodo</label>
                                    <select
                                        required className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                                        value={formData.payment_method_id}
                                        onChange={(e) => setFormData({ ...formData, payment_method_id: e.target.value })}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Closer</label>
                                    <select
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none"
                                        value={formData.closer_id}
                                        onChange={(e) => setFormData({ ...formData, closer_id: e.target.value })}
                                    >
                                        <option value="">Sin Asignar / Admin</option>
                                        {closers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button type="button" onClick={() => setStep(1)} className="flex-1 py-4 bg-slate-800 text-slate-400 font-bold rounded-xl hover:text-white transition-all">Atras</button>
                                <button type="submit" disabled={loading} className="flex-2 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all shadow-lg flex items-center justify-center min-w-[200px]">
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Registrar Venta'}
                                </button>
                            </div>
                        </form>
                    )}

                    {step === 3 && (
                        <div className="py-20 text-center space-y-4 animate-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto ring-4 ring-emerald-500/10">
                                <CheckCircle2 size={40} />
                            </div>
                            <h2 className="text-3xl font-black text-white italic">¡Venta Exitosa!</h2>
                            <p className="text-slate-500 text-sm font-medium">Actualizando registros comerciales...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NewSaleModal;
