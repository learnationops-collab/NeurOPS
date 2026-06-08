import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
    User, Mail, Phone, Instagram, DollarSign, Calendar, MessageSquare, 
    Activity, ChevronDown, ChevronUp, Edit, Link2, CheckCircle2, Clock, 
    Sparkles, Plus, Loader2, MessageCircle, AlertCircle, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

const LeadRoadmapDetail = ({ instagram, clientId, email, phone, onBack, onUpdate }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);
    
    // Formulario de edición
    const [editForm, setEditForm] = useState({
        full_name: '',
        email: '',
        phone: '',
        instagram: ''
    });

    // Formulario de vinculación
    const [linkForm, setLinkForm] = useState({
        event_type: 'sale',
        event_id: ''
    });

    // Formulario de comentarios
    const [newComment, setNewComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);

    useEffect(() => {
        fetchRoadmap();
    }, [instagram, clientId, email, phone]);

    const fetchRoadmap = async () => {
        setLoading(true);
        try {
            const params = {};
            if (clientId) params.client_id = clientId;
            if (instagram) params.instagram = instagram;
            if (email) params.email = email;
            if (phone) params.phone = phone;

            const res = await api.get('/public/lead-roadmap', { params });
            setData(res.data);
            
            // Inicializar formulario de edición
            if (res.data.lead) {
                setEditForm({
                    full_name: res.data.lead.full_name || '',
                    email: res.data.lead.email || '',
                    phone: res.data.lead.phone || '',
                    instagram: res.data.lead.instagram || ''
                });
            }
        } catch (err) {
            console.error("Error fetching lead roadmap", err);
            toast.error(err.response?.data?.error || "No se pudo cargar el Roadmap del Lead");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveClient = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...editForm,
                client_id: data?.lead?.id || null
            };
            const res = await api.post('/public/lead-roadmap/update-client', payload);
            toast.success(res.data.message || "Cliente guardado con éxito");
            setShowEditModal(false);
            fetchRoadmap();
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error("Error saving client", err);
            toast.error(err.response?.data?.error || "Error al guardar cliente");
        }
    };

    const handleLinkEvent = async (e) => {
        e.preventDefault();
        if (!linkForm.event_id) return;
        try {
            const payload = {
                event_type: linkForm.event_type,
                event_id: parseInt(linkForm.event_id),
                instagram: data?.lead?.instagram || instagram
            };
            const res = await api.post('/public/lead-roadmap/relate-event', payload);
            toast.success(res.data.message || "Evento relacionado correctamente");
            setShowLinkModal(false);
            setLinkForm({ ...linkForm, event_id: '' });
            fetchRoadmap();
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error("Error linking event", err);
            toast.error(err.response?.data?.error || "Error al relacionar evento");
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || !data?.lead?.id) return;
        setSubmittingComment(true);
        try {
            await api.post(`/closer/leads/${data.lead.id}/comments`, { text: newComment });
            toast.success("Comentario agregado");
            setNewComment('');
            fetchRoadmap();
        } catch (err) {
            console.error("Error adding comment", err);
            toast.error("Error al guardar comentario");
        } finally {
            setSubmittingComment(false);
        }
    };

    const formatTime = (isoString) => {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) + 
                   ' ' + date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return isoString;
        }
    };

    if (loading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-6 bg-slate-950 text-slate-200">
                <Loader2 className="w-12 h-12 text-violet-500 animate-spin" />
                <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">Cargando Roadmap del Lead...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="h-[50vh] flex flex-col items-center justify-center text-center space-y-6 bg-slate-950 text-slate-200 p-8 rounded-[2rem] border border-slate-800">
                <AlertCircle className="text-amber-500" size={48} />
                <h3 className="text-xl font-bold">No se pudieron recuperar los datos del lead</h3>
                <p className="text-slate-500 text-sm max-w-md">Verifica que el usuario de Instagram o identificador de cliente sea correcto e intenta relacionar sus eventos.</p>
                {onBack && (
                    <button onClick={onBack} className="px-6 py-3 bg-slate-900 border border-slate-800 rounded-xl font-bold hover:bg-slate-800 text-xs">
                        VOLVER ATRÁS
                    </button>
                )}
            </div>
        );
    }

    const { lead, stages, activity, sales_summary, dolores, comments: notesList } = data;

    // Colores semafóricos según estado
    const statusColors = {
        "Ganado": "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        "En proceso": "bg-violet-500/20 text-violet-400 border border-violet-500/30",
        "Entrante": "bg-blue-500/20 text-blue-400 border border-blue-500/30",
        "Perdido": "bg-rose-500/20 text-rose-400 border border-rose-500/30"
    };

    const stageIcons = [
        Sparkles,        // Llegó
        MessageCircle,   // Contactó
        User,            // Dolor
        Calendar,        // Agenda
        Phone,           // Llamada
        DollarSign       // Venta
    ];

    return (
        <div className="space-y-8 bg-slate-950 text-slate-200 p-6 rounded-[2rem] border border-slate-800 shadow-2xl relative">
            
            {/* BARRA DE NAVEGACIÓN SUPERIOR */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-800/50">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button 
                            onClick={onBack}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                            ← Volver
                        </button>
                    )}
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Leads / <span className="text-slate-350">Lead Roadmap</span>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowEditModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                    >
                        <Edit size={12} /> Editar Lead
                    </button>
                    <button 
                        onClick={() => setShowLinkModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-violet-900/40 hover:bg-violet-900/60 border border-violet-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider text-violet-300 transition-all"
                    >
                        <Link2 size={12} /> Vincular Cita/Venta
                    </button>
                </div>
            </div>

            {/* CABECERA PRINCIPAL DEL LEAD */}
            <div className="flex flex-col lg:flex-row justify-between gap-6 bg-slate-900/30 p-6 rounded-3xl border border-slate-800">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-600/30 to-amber-600/10 rounded-2xl flex items-center justify-center text-violet-400 font-black text-2xl border border-violet-500/20 shadow-xl">
                        {lead.full_name ? lead.full_name.substring(0, 2).toUpperCase() : 'LD'}
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-black text-white italic tracking-tighter leading-none">{lead.full_name}</h2>
                            <span className={`px-2.5 py-1 text-[9px] font-black rounded-full uppercase tracking-widest ${statusColors[lead.status] || 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                {lead.status}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold text-slate-400">
                            {lead.phone && (
                                <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                                    <Phone size={12} className="text-violet-500" /> {lead.phone}
                                </a>
                            )}
                            {lead.email && (
                                <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                                    <Mail size={12} className="text-violet-500" /> {lead.email}
                                </a>
                            )}
                            {lead.instagram && (
                                <a href={`https://instagram.com/${lead.instagram}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
                                    <Instagram size={12} className="text-violet-500" /> @{lead.instagram}
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* METADATOS DE ADQUISICIÓN */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 bg-slate-900/60 p-4 rounded-2xl border border-slate-850 self-center w-full lg:w-auto">
                    <div className="space-y-1">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Origen</div>
                        <div className="text-xs font-black text-violet-400 truncate max-w-[140px]">{stages[0]?.details?.campaña || 'Instagram / Directo'}</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Inversión</div>
                        <div className="text-xs font-black text-white">${sales_summary ? sales_summary.monto : '0.00'}</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Fecha Creación</div>
                        <div className="text-xs font-black text-white">
                            {lead.created_at && !isNaN(new Date(lead.created_at).getTime()) 
                                ? new Date(lead.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) 
                                : 'N/A'
                            }
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Responsable</div>
                        <div className="text-xs font-black text-amber-500">Unassigned</div>
                    </div>
                </div>
            </div>

            {/* SECCIÓN LEAD ROADMAP (EMBUDO HORIZONTAL) */}
            <div className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 space-y-6">
                <div className="space-y-1">
                    <h3 className="text-lg font-black text-white tracking-tight uppercase">Lead Roadmap</h3>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Paso a paso del recorrido del lead en el embudo</p>
                </div>

                <div className="relative pt-6 pb-2">
                    {/* Línea conectora de fondo */}
                    <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
                    
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-8 relative z-10">
                        {stages.map((stage, idx) => {
                            const IconComp = stageIcons[idx] || Sparkles;
                            const isCompleted = stage.completed;
                            
                            return (
                                <div key={stage.name} className="flex flex-col items-center text-center space-y-4 group">
                                    {/* Icono de Etapa */}
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                                        isCompleted 
                                            ? 'bg-violet-650 text-white shadow-lg shadow-violet-600/30 border-2 border-violet-500' 
                                            : 'bg-slate-900 text-slate-600 border border-slate-800'
                                    }`}>
                                        <IconComp size={22} className={isCompleted ? 'animate-pulse' : ''} />
                                    </div>

                                    {/* Información de la Etapa */}
                                    <div className="space-y-1">
                                        <div className="text-xs font-black text-white">{stage.name}</div>
                                        <span className={`inline-block px-2 py-0.5 text-[8px] font-black rounded-md uppercase tracking-widest ${
                                            isCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800/40 text-slate-550'
                                        }`}>
                                            {isCompleted ? 'Completado' : 'Pendiente'}
                                        </span>
                                        {isCompleted && stage.date && (
                                            <div className="text-[9px] font-medium text-slate-500">{formatTime(stage.date)}</div>
                                        )}
                                    </div>

                                    {/* Datos adicionales específicos abajo */}
                                    <div className="w-full bg-slate-950/45 p-3.5 rounded-xl border border-slate-900/60 text-left text-[10px] space-y-1 font-bold">
                                        {idx === 0 && (
                                            <>
                                                <div className="text-slate-550">Origen: <span className="text-slate-300">{stage.details?.origen || 'Instagram'}</span></div>
                                                <div className="text-slate-550">Canal: <span className="text-slate-300">{stage.details?.canal}</span></div>
                                                <div className="text-slate-550">Campaña: <span className="text-slate-300 truncate block max-w-[120px]">{stage.details?.campaña}</span></div>
                                            </>
                                        )}
                                        {idx === 1 && (
                                            <>
                                                <div className="text-slate-550">Acción: <span className="text-slate-300">{stage.details?.accion}</span></div>
                                                <div className="text-slate-550">Medio: <span className="text-slate-300">{stage.details?.medio}</span></div>
                                                <div className="text-slate-550 text-slate-300 italic truncate max-w-[120px]">{stage.details?.mensaje}</div>
                                            </>
                                        )}
                                        {idx === 2 && (
                                            <>
                                                <div className="text-slate-550">Dolores:</div>
                                                <ul className="list-disc pl-3 text-slate-300 space-y-0.5">
                                                    {(stage.details?.dolores || []).slice(0, 3).map((d, i) => (
                                                        <li key={i} className="truncate max-w-[110px]">{d}</li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                        {idx === 3 && (
                                            <>
                                                <div className="text-slate-550">Tipo: <span className="text-slate-300">{stage.details?.tipo || 'Reunión'}</span></div>
                                                <div className="text-slate-550">Fecha: <span className="text-slate-350">{stage.details?.fecha_agendada ? stage.details.fecha_agendada.split('T')[0] : 'N/A'}</span></div>
                                            </>
                                        )}
                                        {idx === 4 && (
                                            <>
                                                <div className="text-slate-550">Resultado: <span className="text-slate-300">{stage.details?.resultado || 'Pendiente'}</span></div>
                                                <div className="text-slate-550 text-slate-300 italic truncate max-w-[120px]">{stage.details?.notes}</div>
                                            </>
                                        )}
                                        {idx === 5 && (
                                            <>
                                                <div className="text-slate-550">Monto: <span className="text-emerald-400 font-bold">${stage.details?.monto || '0.00'}</span></div>
                                                <div className="text-slate-550">Método: <span className="text-slate-300">{stage.details?.metodo_pago}</span></div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* SECCIÓN INFERIOR: HISTORIAL, DETALLE DE VENTA, DOLORES Y COMENTARIOS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* DETALLE DE ACTIVIDAD (COLUMNA 1 y 2 - ANCHA) */}
                <div className="lg:col-span-2 bg-slate-900/30 p-6 rounded-3xl border border-slate-850 space-y-6 flex flex-col">
                    <div className="flex justify-between items-center">
                        <div className="space-y-0.5">
                            <h4 className="text-base font-black text-white uppercase tracking-tight">Detalle de Actividad</h4>
                            <p className="text-slate-500 text-[9px] uppercase font-bold tracking-wider">Historial completo del prospecto</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                            {activity.length} Eventos
                        </span>
                    </div>

                    <div className="overflow-x-auto flex-1 max-h-[400px] custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-3 px-2">Fecha</th>
                                    <th className="py-3 px-2">Evento</th>
                                    <th className="py-3 px-2">Detalle</th>
                                    <th className="py-3 px-2 text-right">Origen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850/50">
                                {activity.map((act, i) => (
                                    <tr key={i} className="hover:bg-slate-900/30 transition-all">
                                        <td className="py-3 px-2 text-slate-500 font-bold whitespace-nowrap">{formatTime(act.date)}</td>
                                        <td className="py-3 px-2 font-black text-white italic">{act.event}</td>
                                        <td className="py-3 px-2 text-slate-350">{act.detail}</td>
                                        <td className="py-3 px-2 text-right font-medium text-slate-400">{act.origin}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* DETALLE FINANCIERO Y NOTAS (COLUMNA 3) */}
                <div className="space-y-6">
                    
                    {/* RESUMEN DE LA VENTA */}
                    <div className="bg-slate-900/30 p-6 rounded-3xl border border-slate-850 space-y-4">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">Resumen de la Venta</h4>
                        {sales_summary ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-2xl font-black text-emerald-400">${sales_summary.monto} USD</span>
                                    <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">{sales_summary.estado}</span>
                                </div>
                                <div className="space-y-1.5 text-xs font-bold text-slate-300">
                                    <div className="flex justify-between"><span className="text-slate-500">Producto</span> <span>{sales_summary.producto}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Método de pago</span> <span>{sales_summary.metodo_pago}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Próximo pago</span> <span className="text-amber-500">{sales_summary.proximo_pago}</span></div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-slate-500 text-xs font-bold italic border border-dashed border-slate-800 rounded-2xl">
                                Sin registros de ventas asociadas
                            </div>
                        )}
                    </div>

                    {/* DOLORES DEL LEAD */}
                    <div className="bg-slate-900/30 p-6 rounded-3xl border border-slate-850 space-y-4">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">Dolores del Lead</h4>
                        <div className="flex flex-wrap gap-2">
                            {dolores.map((d, i) => (
                                <span key={i} className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-300 rounded-xl uppercase tracking-wider">
                                    • {d}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* NOTAS INTERNAS */}
                    <div className="bg-slate-900/30 p-6 rounded-3xl border border-slate-850 space-y-4 flex flex-col max-h-[350px]">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">Notas Internas</h4>
                        
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                            {notesList.map((n) => (
                                <div key={n.id} className="bg-slate-950/60 p-3 rounded-xl border border-slate-900 space-y-1">
                                    <div className="flex justify-between text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                                        <span>{n.author}</span>
                                        <span>{formatTime(n.created_at)}</span>
                                    </div>
                                    <p className="text-xs text-slate-300 font-medium">{n.text}</p>
                                </div>
                            ))}
                            {notesList.length === 0 && (
                                <div className="text-center py-6 text-slate-500 text-xs font-bold italic">
                                    Sin comentarios registrados
                                </div>
                            )}
                        </div>

                        {lead.id && (
                            <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t border-slate-800">
                                <input 
                                    type="text"
                                    placeholder="Añadir nota interna..."
                                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-550 focus:outline-none focus:border-violet-500 font-bold"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    disabled={submittingComment}
                                />
                                <button 
                                    type="submit"
                                    disabled={submittingComment || !newComment.trim()}
                                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl disabled:opacity-30 transition-colors"
                                >
                                    Enviar
                                </button>
                            </form>
                        )}
                    </div>

                </div>
            </div>

            {/* MODAL DE EDICIÓN DE DATOS DEL CLIENTE */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] max-w-md w-full p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="space-y-1 text-center">
                            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">Editar Ficha Lead</h3>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Actualizar datos de contacto y vinculación</p>
                        </div>

                        <form onSubmit={handleSaveClient} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                                <input 
                                    type="text"
                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-bold"
                                    value={editForm.full_name}
                                    onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
                                <input 
                                    type="email"
                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-bold"
                                    value={editForm.email}
                                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Teléfono</label>
                                <input 
                                    type="text"
                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-bold"
                                    value={editForm.phone}
                                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Instagram (@usuario)</label>
                                <input 
                                    type="text"
                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-bold"
                                    value={editForm.instagram}
                                    onChange={e => setEditForm({ ...editForm, instagram: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 py-3 bg-slate-950 border border-slate-850 rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-slate-900 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-colors shadow-lg shadow-violet-600/20"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DE VINCULACIÓN MANUAL DE EVENTOS */}
            {showLinkModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] max-w-md w-full p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="space-y-1 text-center">
                            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">Vincular Evento Manual</h3>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Relacionar eventos que no se conectaron automáticamente</p>
                        </div>

                        <form onSubmit={handleLinkEvent} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Evento</label>
                                <select 
                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500 font-bold"
                                    value={linkForm.event_type}
                                    onChange={e => setLinkForm({ ...linkForm, event_type: e.target.value })}
                                >
                                    <option value="sale">Venta Declarada (ID)</option>
                                    <option value="agenda">Agenda / Triage (ID)</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">ID del Evento</label>
                                <input 
                                    type="number"
                                    placeholder="Ej. 154"
                                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 font-bold"
                                    value={linkForm.event_id}
                                    onChange={e => setLinkForm({ ...linkForm, event_id: e.target.value })}
                                    required
                                />
                            </div>

                            <p className="text-[9px] text-slate-550 font-bold bg-slate-950/40 p-3 rounded-lg border border-slate-850">
                                ℹ️ Esto asociará el evento ID ingresado actualizando su Instagram al valor @{data?.lead?.instagram || instagram}. De esta forma se mostrará automáticamente en este Roadmap.
                            </p>

                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setShowLinkModal(false)}
                                    className="flex-1 py-3 bg-slate-950 border border-slate-850 rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-slate-900 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-colors shadow-lg shadow-violet-600/20"
                                >
                                    Vincular Evento
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default LeadRoadmapDetail;
