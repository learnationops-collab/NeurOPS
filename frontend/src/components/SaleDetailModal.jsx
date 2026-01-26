import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    X,
    User,
    CreditCard,
    Calendar,
    ClipboardCheck,
    Plus,
    Trash2,
    Loader2,
    DollarSign,
    Phone,
    Mail,
    Instagram,
    ChevronDown,
    AlertCircle,
    Check
} from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Card from './ui/Card';

const SaleDetailModal = ({ isOpen, enrollmentId, onClose, onSuccess }) => {
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [submittingPayment, setSubmittingPayment] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [metadata, setMetadata] = useState(null);

    // New Payment Form
    const [newPayment, setNewPayment] = useState({
        amount: '',
        payment_method_id: '',
        payment_type: 'installment'
    });

    useEffect(() => {
        if (isOpen && enrollmentId) {
            fetchDetails();
            fetchMetadata();
        }
    }, [isOpen, enrollmentId]);

    const fetchDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/closer/enrollments/${enrollmentId}`);
            setData(res.data);
        } catch (err) {
            setError("Error al cargar los detalles.");
        } finally {
            setLoading(false);
        }
    };

    const fetchMetadata = async () => {
        try {
            const res = await api.get('/closer/sale-metadata');
            setMetadata(res.data);
            if (res.data.payment_methods.length > 0) {
                setNewPayment(prev => ({ ...prev, payment_method_id: res.data.payment_methods[0].id }));
            }
        } catch (err) {
            console.error("Error fetching metadata", err);
        }
    };

    const handleAddPayment = async (e) => {
        e.preventDefault();
        setSubmittingPayment(true);
        try {
            await api.post(`/closer/enrollments/${enrollmentId}/payments`, newPayment);
            setNewPayment({ ...newPayment, amount: '' });
            fetchDetails();
            if (onSuccess) onSuccess();
        } catch (err) {
            alert("Error al añadir pago");
        } finally {
            setSubmittingPayment(false);
        }
    };

    const handleDeletePayment = async (paymentId) => {
        if (!confirm("¿Estás seguro de eliminar este pago?")) return;
        try {
            await api.delete(`/closer/payments/${paymentId}`);
            fetchDetails();
            if (onSuccess) onSuccess();
        } catch (err) {
            alert("Error al eliminar pago");
        }
    };

    const handleDeleteEnrollment = async () => {
        if (!confirm("¿ESTÁS TOTALMENTE SEGURO? Esta acción eliminará la venta y todos sus pagos asociados permanentemente.")) return;
        setDeleting(true);
        try {
            await api.delete(`/closer/enrollments/${enrollmentId}`);
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            alert("Error al eliminar la venta");
        } finally {
            setDeleting(false);
        }
    };

    if (!isOpen) return null;

    const tabs = [
        { id: 'profile', label: 'PERFIL', icon: User },
        { id: 'payments', label: 'PAGOS', icon: CreditCard },
        { id: 'history', label: 'HISTORIAL', icon: Calendar },
        { id: 'survey', label: 'CUALIFICACIÓN', icon: ClipboardCheck },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="w-full max-w-4xl h-[85vh] bg-surface border border-base rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col">

                {/* Header */}
                <header className="p-10 border-b border-base flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <Badge variant="primary">{data?.program?.name}</Badge>
                            <h2 className="text-3xl font-black text-base italic uppercase tracking-tighter">Detalles de Venta</h2>
                        </div>
                        <p className="text-muted font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                            ID de Inscripción: #{enrollmentId}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDeleteEnrollment}
                            disabled={deleting}
                            className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
                            title="Eliminar Venta"
                        >
                            {deleting ? <Loader2 size={24} className="animate-spin" /> : <Trash2 size={24} />}
                        </button>
                        <button onClick={onClose} className="p-3 bg-main border border-base rounded-2xl text-muted hover:text-base transition-all">
                            <X size={24} />
                        </button>
                    </div>
                </header>

                {/* Tabs Selector */}
                <div className="flex px-10 gap-8 border-b border-base bg-surface-hover/50">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-6 flex items-center gap-3 border-b-2 transition-all group ${activeTab === tab.id ? 'border-primary text-base' : 'border-transparent text-muted hover:text-base'}`}
                        >
                            <tab.icon size={16} className={activeTab === tab.id ? 'text-primary' : ''} />
                            <span className="text-[10px] font-black tracking-[0.2em]">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-6 py-20">
                            <Loader2 className="w-12 h-12 text-primary animate-spin" />
                            <p className="text-muted font-black uppercase tracking-[0.3em] text-[10px]">Consultando Base de Datos...</p>
                        </div>
                    ) : error ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                            <AlertCircle size={48} className="text-rose-500 opacity-20" />
                            <p className="text-rose-400 font-bold uppercase tracking-widest text-xs">{error}</p>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* PROFILE TAB */}
                            {activeTab === 'profile' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                                <User size={12} className="text-primary" /> Información de Contacto
                                            </h4>
                                            <div className="bg-main/50 p-8 rounded-[2rem] border border-base space-y-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-black text-xl">
                                                        {data.client.name[0]}
                                                    </div>
                                                    <div>
                                                        <p className="text-xl font-black text-base italic">{data.client.name}</p>
                                                        <p className="text-xs font-medium text-muted">{data.client.email}</p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 gap-4 pt-4 border-t border-base">
                                                    <div className="flex items-center gap-3 text-muted">
                                                        <Phone size={14} className="text-primary" />
                                                        <span className="text-sm font-bold">{data.client.phone || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-muted">
                                                        <Instagram size={14} className="text-primary" />
                                                        <span className="text-sm font-bold">@{data.client.instagram || 'No vinculado'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                                                <DollarSign size={12} className="text-secondary" /> Resumen de Producto
                                            </h4>
                                            <div className="bg-secondary/5 p-8 rounded-[2rem] border border-secondary/10 space-y-6">
                                                <div>
                                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Programa</p>
                                                    <p className="text-2xl font-black text-secondary italic">{data.program.name}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted uppercase tracking-widest">Valor Total</p>
                                                        <p className="text-xl font-black text-base">${data.program.price.toLocaleString()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted uppercase tracking-widest">Total Pagado</p>
                                                        <p className="text-xl font-black text-secondary">${data.total_paid.toLocaleString()}</p>
                                                    </div>
                                                </div>
                                                <div className="pt-4 border-t border-secondary/20">
                                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Deuda Pendiente</p>
                                                    <p className="text-3xl font-black text-rose-500 italic tracking-tighter">
                                                        ${(data.program.price - data.total_paid).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* PAYMENTS TAB */}
                            {activeTab === 'payments' && (
                                <div className="space-y-10">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        {/* New Payment Form */}
                                        <div className="md:col-span-1 border-r border-base pr-8 space-y-6">
                                            <h4 className="text-[10px] font-black text-base uppercase tracking-widest">Añadir Pago</h4>
                                            <form onSubmit={handleAddPayment} className="space-y-5">
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Monto ($)</label>
                                                    <input
                                                        type="number"
                                                        required
                                                        value={newPayment.amount}
                                                        onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                                                        className="w-full bg-main border border-base rounded-2xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/50"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Método</label>
                                                    <select
                                                        className="w-full bg-main border border-base rounded-2xl p-4 text-sm font-bold outline-none cursor-pointer"
                                                        value={newPayment.payment_method_id}
                                                        onChange={(e) => setNewPayment({ ...newPayment, payment_method_id: e.target.value })}
                                                    >
                                                        {metadata?.payment_methods.map(m => (
                                                            <option key={m.id} value={m.id}>{m.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Tipo</label>
                                                    <select
                                                        className="w-full bg-main border border-base rounded-2xl p-4 text-sm font-bold outline-none cursor-pointer"
                                                        value={newPayment.payment_type}
                                                        onChange={(e) => setNewPayment({ ...newPayment, payment_type: e.target.value })}
                                                    >
                                                        <option value="down_payment">Seña</option>
                                                        <option value="first_payment">Primer Pago</option>
                                                        <option value="installment">Cuota</option>
                                                        <option value="full">Pago Completo</option>
                                                        <option value="renewal">Renovación</option>
                                                    </select>
                                                </div>
                                                <Button
                                                    type="submit"
                                                    variant="primary"
                                                    className="w-full h-14"
                                                    loading={submittingPayment}
                                                    icon={Plus}
                                                >
                                                    REGISTRAR
                                                </Button>
                                            </form>
                                        </div>

                                        {/* History */}
                                        <div className="md:col-span-2 space-y-6">
                                            <h4 className="text-[10px] font-black text-base uppercase tracking-widest">Historial de Pagos</h4>
                                            <div className="bg-main/30 border border-base rounded-[2.5rem] overflow-hidden">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="bg-surface border-b border-base">
                                                                <th className="px-6 py-4 text-[9px] font-black text-muted uppercase tracking-[0.2em]">Fecha</th>
                                                                <th className="px-6 py-4 text-[9px] font-black text-muted uppercase tracking-[0.2em]">Tipo</th>
                                                                <th className="px-6 py-4 text-[9px] font-black text-muted uppercase tracking-[0.2em]">Método</th>
                                                                <th className="px-6 py-4 text-[9px] font-black text-muted uppercase tracking-[0.2em]">Monto</th>
                                                                <th className="px-6 py-4 text-[9px] font-black text-muted uppercase tracking-[0.2em]"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-base">
                                                            {data.payments.map(p => (
                                                                <tr key={p.id} className="hover:bg-surface-hover/50 transition-all group">
                                                                    <td className="px-6 py-5 text-xs font-bold">{new Date(p.date).toLocaleDateString()}</td>
                                                                    <td className="px-6 py-5 uppercase text-[9px] font-black">
                                                                        <Badge variant="neutral">{p.type}</Badge>
                                                                    </td>
                                                                    <td className="px-6 py-5 text-xs text-muted font-medium">{p.method}</td>
                                                                    <td className="px-6 py-5 text-sm font-black text-secondary">${p.amount.toLocaleString()}</td>
                                                                    <td className="px-6 py-5 text-right">
                                                                        <button
                                                                            onClick={() => handleDeletePayment(p.id)}
                                                                            className="p-2 text-muted hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* HISTORY TAB */}
                            {activeTab === 'history' && (
                                <div className="space-y-6">
                                    <h4 className="text-[10px] font-black text-base uppercase tracking-widest">Línea de Tiempo de Agendas</h4>
                                    <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-base before:to-transparent">
                                        {data.appointments.map((appt, idx) => (
                                            <div key={appt.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-base bg-main text-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                                    <Calendar size={14} />
                                                </div>
                                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-3xl bg-main/50 border border-base">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <time className="text-xs font-black text-base italic">{new Date(appt.start_time).toLocaleString()}</time>
                                                        <Badge variant={appt.status === 'completed' ? 'success' : appt.status === 'canceled' ? 'destructive' : 'primary'}>
                                                            {appt.status}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{appt.type}</p>
                                                    <p className="text-[9px] text-muted mt-2">Origen: {appt.origin}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* SURVEY TAB */}
                            {activeTab === 'survey' && (
                                <div className="space-y-8">
                                    <div className="flex justify-between items-end border-b border-base pb-6">
                                        <h4 className="text-[10px] font-black text-base uppercase tracking-widest">Respuestas de Calificación</h4>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Puntaje Total</p>
                                            <p className="text-4xl font-black text-primary italic tracking-tighter">
                                                {data.survey.reduce((acc, curr) => acc + curr.points, 0)} pts
                                            </p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-6">
                                        {data.survey.map((sa, idx) => (
                                            <div key={idx} className="bg-main/50 p-8 rounded-[2rem] border border-base flex justify-between items-start gap-10 group hover:border-primary/30 transition-all">
                                                <div className="space-y-3">
                                                    <p className="text-sm font-black text-base leading-tight italic">{sa.question}</p>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                        <p className="text-sm font-bold text-muted">{sa.answer}</p>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 flex flex-col items-center gap-1 group-hover:scale-110 transition-transform">
                                                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-black shadow-inner">
                                                        +{sa.points}
                                                    </div>
                                                    <span className="text-[8px] font-black text-muted uppercase tracking-widest">Puntos</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SaleDetailModal;
