import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import { 
    DollarSign, User, CreditCard, Save, 
    AlertCircle, CheckCircle2, Mail, Phone, 
    Instagram, Users, PenTool, Calendar, MessageSquare,
    Search, Loader2, X
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

    // Estados para la búsqueda autocompletable interactiva por múltiples campos
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [linkedAppointment, setLinkedAppointment] = useState(null);

    const [form, setForm] = useState({
        lead_id: '',
        email_vendedor: user?.email || '',
        nombre_cliente: '',
        telefono: '',
        mail_cliente: '',
        programa: 'RR',
        tipo_pago_simple: 'completo',
        monto: '',
        segundo_pago: '',
        metodo_pago: 'Stripe',
        examen_lead: '',
        notas: '',
        estado: 'Completada',
        instagram: '',
        setter: '',
        documento_identidad: '',
        enviar_webhook: true
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // 1. Cargar leads agendados recientes
                const metaRes = await api.get('/closer/sale-metadata');
                setMetadata(metaRes.data || { leads: [] });
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

    // Debounce de búsqueda de leads en la API por instagram, nombre, email o teléfono
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.trim().length >= 2) {
                setSearching(true);
                try {
                    const res = await api.get(`/closer/leads/search?q=${searchTerm}`);
                    setSearchResults(res.data || []);
                } catch (err) {
                    console.error("Error al buscar leads:", err);
                } finally {
                    setSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const handleSelectLead = (lead) => {
        if (!lead) {
            setForm(prev => ({
                ...prev,
                lead_id: '',
                nombre_cliente: '',
                instagram: '',
                mail_cliente: '',
                telefono: '',
                setter: '',
                examen_lead: ''
            }));
            setLinkedAppointment(null);
            return;
        }

        const igUser = lead.instagram ? (lead.instagram.startsWith('@') ? lead.instagram : `@${lead.instagram}`) : '';

        setForm(prev => ({
            ...prev,
            lead_id: lead.id || '',
            nombre_cliente: lead.username || '',
            instagram: igUser,
            mail_cliente: lead.email || '',
            telefono: lead.phone || '',
            setter: lead.appointment?.setter_name || '',
            examen_lead: lead.appointment?.examen || ''
        }));
        
        if (lead.appointment) {
            setLinkedAppointment(lead.appointment);
            toast.success("Agenda vinculada y datos autocompletados correctamente");
        } else {
            setLinkedAppointment(null);
            toast.success("Lead vinculado (Sin agenda previa en el sistema)");
        }
        
        setSearchTerm('');
        setSearchResults([]);
    };

    const handleUnlink = () => {
        setForm(prev => ({
            ...prev,
            lead_id: '',
            nombre_cliente: '',
            instagram: '',
            mail_cliente: '',
            telefono: '',
            setter: '',
            examen_lead: ''
        }));
        setLinkedAppointment(null);
        setSearchTerm('');
        setSearchResults([]);
        toast.success("Agenda desvinculada");
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
            telefono: form.telefono ? form.telefono.replace(/\+/g, '').trim() : '',
            mail_cliente: form.mail_cliente,
            tipo_pago: `${form.programa} - ${form.tipo_pago_simple}`,
            monto: parseFloat(form.monto) || 0.0,
            segundo_pago: form.segundo_pago || '',
            metodo_pago: form.metodo_pago,
            examen: form.examen_lead + (form.notas ? ` | ${form.notas}` : ''),
            instagram: form.instagram ? form.instagram.replace(/@/g, '').trim() : '',
            estado: form.estado, // Columna L (Estado de la Venta)
            setter: form.setter || '', // Columna M (Setter que Prospectó)
            documento_identidad: form.documento_identidad || '',
            marca_temporal: new Date().toLocaleString("es-ES"), // Fecha/hora del registro
            enviar_webhook: form.enviar_webhook
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
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                            <div className="flex items-center gap-2">
                                <Users className="text-indigo-400" size={16} />
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Vincular Prospecto de Agenda</h3>
                            </div>
                            {(form.lead_id || linkedAppointment) && (
                                <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-black uppercase tracking-wider animate-pulse">
                                    Vinculado
                                </span>
                            )}
                        </div>
                        
                        {(form.lead_id || linkedAppointment) ? (
                            // Vista de Lead Vinculado
                            <div className="bg-slate-900/60 border border-indigo-500/30 rounded-2xl p-5 animate-in fade-in zoom-in duration-300 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                                            <Users size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-white">{form.nombre_cliente}</h4>
                                            <p className="text-[10px] text-pink-400 font-bold flex items-center gap-1 mt-0.5">
                                                <Instagram size={10} />
                                                {form.instagram || 'Sin Instagram'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleUnlink}
                                        className="p-2 bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/30 rounded-xl text-slate-400 hover:text-rose-400 transition-all duration-200"
                                        title="Desvincular lead"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800/80 text-[10px] uppercase font-black tracking-wider text-slate-500 text-left">
                                    <div>
                                        <span className="block text-[8px] text-slate-600">Setter Asignado</span>
                                        <span className="text-indigo-400 font-bold">{form.setter || 'Sin Asignar'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[8px] text-slate-600">Fecha de Agenda</span>
                                        <span className="text-slate-300">
                                            {linkedAppointment?.start_time ? new Date(linkedAppointment.start_time).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Sin agenda registrada'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Buscador Interactivo Autocompletable
                            <div className="space-y-2 relative">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 block text-left">Buscar Prospecto o Agenda</label>
                                <div className="relative group/search">
                                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${searching ? 'text-indigo-400 animate-pulse' : 'text-slate-500 group-focus-within/search:text-indigo-400'}`} />
                                    <input
                                        type="text"
                                        placeholder="Escribe el Instagram, nombre, correo o número de teléfono..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 pl-11 pr-10 text-sm font-bold text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
                                    />
                                    {searchTerm && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchTerm('');
                                                setSearchResults([]);
                                            }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white rounded-full hover:bg-slate-700 transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Dropdown Flotante Absoluto */}
                                {searchTerm.trim().length >= 2 && (
                                    <div className="absolute top-full left-0 right-0 z-[100] mt-2 max-h-60 overflow-y-auto custom-scrollbar bg-slate-900/95 border border-slate-700 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md divide-y divide-slate-800/80 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {searching ? (
                                            <div className="p-4 flex items-center justify-center gap-2 text-slate-500">
                                                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Buscando prospectos...</span>
                                            </div>
                                        ) : searchResults.length === 0 ? (
                                            <div className="p-4 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">
                                                No se encontraron coincidencias
                                            </div>
                                        ) : (
                                            searchResults.map(l => {
                                                const igDisplay = l.instagram ? (l.instagram.startsWith('@') ? l.instagram : `@${l.instagram}`) : '';
                                                return (
                                                    <button
                                                        key={l.id}
                                                        type="button"
                                                        onClick={() => handleSelectLead(l)}
                                                        className="w-full p-4 flex items-center justify-between hover:bg-indigo-500/10 transition-all text-left group/item"
                                                    >
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-xs font-black text-slate-200 group-hover/item:text-white transition-colors">{l.username || 'Sin Nombre'}</p>
                                                                {l.appointment && (
                                                                    <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-black uppercase">
                                                                        Con Agenda
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-500 font-bold uppercase">
                                                                {igDisplay && (
                                                                    <span className="text-pink-400/80 flex items-center gap-0.5">
                                                                        <Instagram size={9} />
                                                                        {igDisplay}
                                                                    </span>
                                                                )}
                                                                {l.email && <span>{l.email}</span>}
                                                                {l.phone && <span>{l.phone}</span>}
                                                            </div>
                                                        </div>
                                                        <div className="text-[8px] font-black uppercase tracking-wider text-slate-500 group-hover/item:text-indigo-400 border border-slate-700 group-hover/item:border-indigo-500/30 px-2 py-1.5 rounded-lg transition-all duration-200 bg-slate-800/40 shrink-0">
                                                            Seleccionar
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
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

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Documento de identidad</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><PenTool size={14} /></span>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                    placeholder="ej. DNI, NIE, Pasaporte"
                                    value={form.documento_identidad}
                                    onChange={e => setForm({ ...form, documento_identidad: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Examen del Lead (ej. USMLE Step 1, Step 2 CK)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><PenTool size={14} /></span>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                    placeholder="ej. USMLE Step 1"
                                    value={form.examen_lead}
                                    onChange={e => setForm({ ...form, examen_lead: e.target.value })}
                                />
                            </div>
                        </div>

                    </div>

                    {/* SECCIÓN 3: TRANSACCIÓN Y MÉTODO DE PAGO */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 bg-slate-950/20 p-6 rounded-3xl border border-slate-800/80">
                        
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Programa *</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                value={form.programa}
                                onChange={e => setForm({ ...form, programa: e.target.value })}
                                required
                            >
                                <option value="RR">Residency Roadmap (RR)</option>
                                <option value="AL">Ace Learner (AL)</option>
                                <option value="SI">Specialist Initiative (SI)</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Pago *</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                value={form.tipo_pago_simple}
                                onChange={e => setForm({ ...form, tipo_pago_simple: e.target.value })}
                                required
                            >
                                <option value="completo">Completo (PIF)</option>
                                <option value="parcial">Parcial (Primer Pago)</option>
                                <option value="Seña">Seña (Promesa de Venta)</option>
                                <option value="Cuota">Cuotas</option>
                                <option value="Renovacion">Renovación</option>
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

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Estado de la Venta *</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                value={form.estado}
                                onChange={e => setForm({ ...form, estado: e.target.value })}
                                required
                            >
                                <option value="Completada">Completada</option>
                                <option value="Pendiente">Pendiente</option>
                                <option value="Cancelada">Cancelada</option>
                            </select>
                        </div>

                    </div>

                    {/* SECCIÓN 4: ATRIBUCIÓN E INFORMACIÓN ADICIONAL */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        <div className="space-y-2 md:col-span-2">
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
                                    value={form.notas}
                                    onChange={e => setForm({ ...form, notas: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Switch de Automatización */}
                        <div className="space-y-2 md:col-span-2 flex items-center justify-between bg-slate-950/20 p-4 rounded-2xl border border-slate-800/80">
                            <div className="space-y-0.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Automatización (n8n)</label>
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Enviar datos de venta al webhook tras registrar</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, enviar_webhook: !form.enviar_webhook })}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    form.enviar_webhook ? 'bg-indigo-600' : 'bg-slate-700'
                                }`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        form.enviar_webhook ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                />
                            </button>
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
