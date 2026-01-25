import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { DollarSign, User, CreditCard, Box, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const CloserNewSalePage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [metadata, setMetadata] = useState({ programs: [], payment_methods: [], leads: [] });

    const [form, setForm] = useState({
        lead_id: '',
        program_id: '',
        payment_method_id: '',
        payment_amount: '',
        payment_type: 'full'
    });

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const res = await api.get('/closer/sale-metadata');
                setMetadata(res.data);
            } catch (err) {
                console.error(err);
                setError("Error al cargar datos necesarios");
            } finally {
                setLoading(false);
            }
        };
        fetchMetadata();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/closer/sales', form);
            navigate('/closer/leads'); // Redirect to sales db
        } catch (err) {
            setError(err.response?.data?.error || "Error al registrar venta");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-20 text-center uppercase font-black text-xs text-muted tracking-widest">Cargando formulario...</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="space-y-2">
                <h1 className="text-4xl font-black text-base italic tracking-tighter uppercase">Declarar Venta</h1>
                <p className="text-muted text-xs font-bold uppercase tracking-widest">Registra una nueva venta manual en el sistema</p>
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
                            {metadata.leads.map(l => (
                                <option key={l.id} value={l.id}>{l.username} ({l.email})</option>
                            ))}
                        </select>
                        <p className="text-[9px] text-muted font-medium italic">* Solo aparecen leads con los que has tenido agenda reciente</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Program */}
                        <div className="space-y-3">
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
                                <option value="">Seleccionar Programa...</option>
                                {metadata.programs.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} (${p.price})</option>
                                ))}
                            </select>
                        </div>

                        {/* Amount */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                <DollarSign size={14} /> Monto Pagado (USD)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full bg-main border border-base rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                placeholder="0.00"
                                value={form.payment_amount}
                                onChange={e => setForm({ ...form, payment_amount: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Payment Method */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                <CreditCard size={14} /> Método de Pago
                            </label>
                            <select
                                className="w-full bg-main border border-base rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                value={form.payment_method_id}
                                onChange={e => setForm({ ...form, payment_method_id: e.target.value })}
                                required
                            >
                                <option value="">Seleccionar Método...</option>
                                {metadata.payment_methods.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Payment Type */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                <CheckCircle2 size={14} /> Tipo de Pago
                            </label>
                            <select
                                className="w-full bg-main border border-base rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                value={form.payment_type}
                                onChange={e => setForm({ ...form, payment_type: e.target.value })}
                                required
                            >
                                <option value="full">Pago Completo</option>
                                <option value="installment">Cuota / Parcial</option>
                                <option value="deposit">Seña / Reserva</option>
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
                            Registrar Venta
                        </Button>
                    </div>

                </form>
            </Card>
        </div>
    );
};

export default CloserNewSalePage;
