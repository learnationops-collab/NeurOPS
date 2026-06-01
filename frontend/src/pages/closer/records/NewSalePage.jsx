import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { 
    DollarSign, User, CreditCard, Save, 
    AlertCircle, CheckCircle2, Mail, Phone, 
    Instagram, Users, PenTool, Calendar, MessageSquare
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import toast from 'react-hot-toast';

const CloserNewSalePage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    
    // Metadatos locales de la base de datos
    const [metadata, setMetadata] = useState({ leads: [] });
    // Lista de Setters del equipo
    const [setters, setSetters] = useState([]);

    const [form, setForm] = useState({
        lead_id: '',
        email_vendedor: user?.email || '',
        nombre_cliente: '',
        telefono: '',
        mail_cliente: '',
        tipo_pago: 'PIF',
        monto: '',
        segundo_pago: '',
        metodo_pago: 'Stripe',
        examen: '',
        instagram: '',
        setter: ''
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // 1. Cargar leads agendados recientes
                const metaRes = await api.get('/closer/sale-metadata');
                setMetadata(metaRes.data || { leads: [] });
                
                // 2. Cargar setters del equipo
                const setterRes = await api.get('/public/active-setters');
                setSetters(setterRes.data || []);
            } catch (err) {
                console.error("Error al cargar inicialización del formulario:", err);
                setError("Error al cargar los metadatos de configuración.");
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    // Sincronizar email del closer en cuanto esté cargado en la sesión
    useEffect(() => {
        if (user?.email) {
            setForm(prev => ({ ...prev, email_vendedor: user.email }));
        }
    }, [user]);

    const handleSelectLead = (leadId) => {
        if (!leadId) {
            setForm(prev => ({
                ...prev,
                lead_id: '',
                nombre_cliente: '',
                instagram: '',
                mail_cliente: '',
                telefono: ''
            }));
            return;
        }

        const selectedLead = metadata.leads.find(l => l.id === parseInt(leadId));
        if (selectedLead) {
            setForm(prev => ({
                ...prev,
                lead_id: leadId,
                nombre_cliente: selectedLead.username || '',
                instagram: selectedLead.instagram || '',
                mail_cliente: selectedLead.email || '',
                telefono: selectedLead.phone || ''
            }));
            toast.success(`Datos cargados de: ${selectedLead.username || 'Lead'}`);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!form.nombre_cliente || !form.mail_cliente || !form.monto) {
            setError("Los campos Nombre, Email de Cliente y Monto son obligatorios.");
            return;
        }

        setSubmitting(true);
        setError(null);

        // Formatear payload exactamente para Google Sheets (Ventas_DB)
        const payload = {
            email_vendedor: form.email_vendedor,
            nombre_cliente: form.nombre_cliente,
            telefono: form.telefono,
            mail_cliente: form.mail_cliente,
            tipo_pago: form.tipo_pago,
            monto: parseFloat(form.monto) || 0.0,
            segundo_pago: form.segundo_pago || '',
            metodo_pago: form.metodo_pago,
            examen: form.examen || '',
            instagram: form.instagram || '',
            setter: form.setter || '',
            marca_temporal: new Date().toLocaleString("es-ES") // Fecha/hora del registro
        };

        try {
            // Enviar directamente a Google Sheets y sincronizar localmente a través de la API
            const res = await api.post('/sheets/push?tabla=Ventas_DB', payload);
            
            if (res.data.status === 'success') {
                toast.success("Venta declarada y sincronizada con éxito en Google Sheets");
                navigate('/closer/stats'); // Redirigir a estadísticas de closers
            } else {
                setError(res.data.message || "Error al sincronizar con Google Sheets.");
            }
        } catch (err) {
            console.error("Error al registrar venta:", err);
            setError(err.response?.data?.message || err.response?.data?.error || "Error de comunicación con el servidor al registrar venta");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-40 space-y-4">
                <span className="animate-spin text-primary shrink-0">
                    <DollarSign size={40} className="text-indigo-500 animate-pulse" />
                </span>
                <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Cargando configuración de venta...</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 text-left">
            <header className="space-y-2 border-b border-slate-800 pb-6">
                <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                    Declarar <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-emerald-400">Venta Manual</span>
                </h1>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Registra ventas oficiales sincronizadas directo a Google Sheets</p>
            </header>

            {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 animate-in shake duration-300">
                    <AlertCircle size={18} className="shrink-0" />
                    <p className="font-bold text-xs tracking-wide uppercase leading-none">{error}</p>
                </div>
            )}

            <Card className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                {/* Ambient Brillo */}
                <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 blur-[120px] opacity-10 bg-indigo-500 group-hover:opacity-20 transition-all duration-700" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                    
                    {/* SECCIÓN 1: ASIGNACIÓN DE LEAD EN PANTALLA */}
                    <div className="bg-slate-950/40 p-6 rounded-3xl border border-slate-800 space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
                            <Users className="text-indigo-400" size={16} />
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Vincular Prospecto de Agenda</h3>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Seleccionar Lead Reciente</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                value={form.lead_id}
                                onChange={e => handleSelectLead(e.target.value)}
                            >
                                <option value="">Ingreso manual (Sin Lead de Agenda)...</option>
                                {metadata.leads.map(l => (
                                    <option key={l.id} value={l.id}>
                                        {l.username || 'Sin Nombre'} ({l.email || 'Sin Email'})
                                    </option>
                                ))}
                            </select>
                            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wide ml-1">* Autocompleta automáticamente los datos del contacto</p>
                        </div>
                    </div>

                    {/* SECCIÓN 2: DATOS DEL CLIENTE Y REGISTRO */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo del Cliente *</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><User size={14} /></span>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                    placeholder="ej. Juan Pérez"
                                    value={form.nombre_cliente}
                                    onChange={e => setForm({ ...form, nombre_cliente: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Instagram (@ Usuario) *</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Instagram size={14} /></span>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                    placeholder="ej. juanperez_marketing"
                                    value={form.instagram}
                                    onChange={e => setForm({ ...form, instagram: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Email del Cliente *</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Mail size={14} /></span>
                                <input
                                    type="email"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                    placeholder="ej. juan@gmail.com"
                                    value={form.mail_cliente}
                                    onChange={e => setForm({ ...form, mail_cliente: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Teléfono de Contacto</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Phone size={14} /></span>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                    placeholder="ej. +34 600 000 000"
                                    value={form.telefono}
                                    onChange={e => setForm({ ...form, telefono: e.target.value })}
                                />
                            </div>
                        </div>

                    </div>

                    {/* SECCIÓN 3: TRANSACCIÓN Y MÉTODO DE PAGO */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/20 p-6 rounded-3xl border border-slate-800/80">
                        
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Pago *</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                value={form.tipo_pago}
                                onChange={e => setForm({ ...form, tipo_pago: e.target.value })}
                                required
                            >
                                <option value="PIF">Pago Completo (PIF)</option>
                                <option value="Split Pay">Pago Fraccionado (Split Pay)</option>
                                <option value="Seña / Depósito">Seña / Depósito</option>
                                <option value="Cuota">Cuota de Seguimiento</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Monto Cobrado (USD) *</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><DollarSign size={14} /></span>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                    placeholder="0.00"
                                    value={form.monto}
                                    onChange={e => setForm({ ...form, monto: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Método de Pago *</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                value={form.metodo_pago}
                                onChange={e => setForm({ ...form, metodo_pago: e.target.value })}
                                required
                            >
                                <option value="Stripe">Stripe</option>
                                <option value="PayPal">PayPal</option>
                                <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                                <option value="Binance / USDT">Binance / USDT</option>
                                <option value="Hotmart">Hotmart</option>
                                <option value="Otro">Otro Método</option>
                            </select>
                        </div>

                    </div>

                    {/* SECCIÓN 4: ATRIBUCIÓN E INFORMACIÓN ADICIONAL */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Email del Vendedor (Closer) *</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Mail size={14} /></span>
                                <input
                                    type="email"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-all"
                                    value={form.email_vendedor}
                                    onChange={e => setForm({ ...form, email_vendedor: e.target.value })}
                                    placeholder="ej. closer@neurops.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Setter que Prospectó (Atribución)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Users size={14} /></span>
                                <select
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                    value={form.setter}
                                    onChange={e => setForm({ ...form, setter: e.target.value })}
                                >
                                    <option value="">Sin Setter / Orgánico (ManyChat)...</option>
                                    {setters.map(s => (
                                        <option key={s.id} value={s.name}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha o Comentarios de Siguientes Pagos (segundo_pago)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Calendar size={14} /></span>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                    placeholder="ej. Cobro de $500 programado para el 15/06"
                                    value={form.segundo_pago}
                                    onChange={e => setForm({ ...form, segundo_pago: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Notas / Examen / Observaciones</label>
                            <div className="relative">
                                <span className="absolute left-4 top-3 text-slate-500"><PenTool size={14} /></span>
                                <textarea
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all min-h-[100px] resize-none"
                                    placeholder="Detalles sobre el cliente, objeciones rebasadas o notas de la venta..."
                                    value={form.examen}
                                    onChange={e => setForm({ ...form, examen: e.target.value })}
                                />
                            </div>
                        </div>

                    </div>

                    <div className="pt-6 flex justify-end">
                        <Button
                            loading={submitting}
                            variant="primary"
                            size="lg"
                            className="w-full md:w-auto shadow-xl shadow-primary/20 bg-indigo-600 hover:bg-indigo-700 text-white"
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
