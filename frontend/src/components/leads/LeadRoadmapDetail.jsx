import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
    User, Mail, Phone, Instagram, DollarSign, Calendar, 
    ChevronDown, ChevronUp, Edit, Link2, Clock, 
    Sparkles, Loader2, MessageCircle, AlertCircle, Trash2, Save, Award
} from 'lucide-react';
import toast from 'react-hot-toast';
import { EditLeadModal, LinkEventModal } from './LeadRoadmapModals';

const LeadRoadmapDetail = ({ instagram, clientId, email, phone, onBack, onUpdate }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);
    
    // Calificación en caliente
    const [objeciones, setObjeciones] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [savingCalificacion, setSavingCalificacion] = useState(false);

    // Formulario de edición y vinculación
    const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', instagram: '' });
    const [linkForm, setLinkForm] = useState({ event_type: 'sale', event_id: '' });

    // Comentarios
    const [newComment, setNewComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);

    const commonObjections = [
        "Precio / Presupuesto",
        "Tiempo / Horario",
        "Debe consultar con socio",
        "No es prioridad ahora",
        "Desconfianza / Garantía"
    ];

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
            
            if (res.data.lead) {
                setEditForm({
                    full_name: res.data.lead.full_name || '',
                    email: res.data.lead.email || '',
                    phone: res.data.lead.phone || '',
                    instagram: res.data.lead.instagram || ''
                });
                setObjeciones(res.data.lead.objeciones || '');
                setObservaciones(res.data.lead.observaciones || '');
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
            const payload = { ...editForm, client_id: data?.lead?.id || null };
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

    const handleDeleteActivity = async (eventType, id) => {
        const typeText = eventType === 'agenda' ? 'registro de agenda' : 'registro de venta';
        if (!window.confirm(`¿Seguro que quieres eliminar este ${typeText} permanentemente?`)) return;
        
        try {
            const endpoint = eventType === 'agenda' ? `/public/financial-agendas/${id}` : `/public/financial-sales/${id}`;
            await api.delete(endpoint);
            toast.success("Registro eliminado correctamente");
            fetchRoadmap();
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error("Error al eliminar registro:", err);
            toast.error(err.response?.data?.error || "Error al eliminar el registro");
        }
    };

    const handleSaveCalificacion = async () => {
        setSavingCalificacion(true);
        try {
            const payload = {
                client_id: data?.lead?.id || null,
                instagram: data?.lead?.instagram || instagram,
                email: data?.lead?.email || email,
                phone: data?.lead?.phone || phone,
                objeciones,
                observaciones
            };
            await api.post('/public/lead-roadmap/update-client', payload);
            toast.success("Calificación guardada");
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error("Error saving calificacion", err);
            toast.error("Error al guardar calificación");
        } finally {
            setSavingCalificacion(false);
        }
    };

    const toggleObjectionTag = (tag) => {
        let current = objeciones.trim();
        if (current.includes(tag)) {
            const regex = new RegExp(`(^|\\n|\\s*,\\s*)${tag}(\\s*,?\\s*|$)`, 'i');
            current = current.replace(regex, '$1').replace(/,\s*,/, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
        } else {
            current = current ? `${current}, ${tag}` : tag;
        }
        setObjeciones(current);
    };

    const getDaysSinceCreated = (createdIso) => {
        if (!createdIso) return '0 días';
        const createdDate = new Date(createdIso);
        const today = new Date();
        const diffTime = today - createdDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return 'Hoy';
        if (diffDays === 1) return '1 día';
        return `${diffDays} días`;
    };

    const detectAdquisitionDetails = () => {
        let channel = "Desconocido";
        let setter = "No asignado";
        let closer = "Sin asignar";

        const agendaActivity = data?.activity?.find(act => act.event_type === 'agenda');
        let source = "";
        
        if (agendaActivity && agendaActivity.detail) {
            const matchFuente = agendaActivity.detail.match(/\(Fuente:\s*([^)]+)\)/i);
            if (matchFuente) {
                source = matchFuente[1].toLowerCase().trim();
            }
            const matchCloser = agendaActivity.detail.match(/closer:\s*([^\s(]+)/i);
            if (matchCloser) {
                closer = matchCloser[1];
            }
        }

        if (closer === "Sin asignar" && data?.sales_summary && data?.sales_summary.vendedor) {
            closer = data.sales_summary.vendedor;
        }

        if (source.includes("elias")) {
            channel = "ManyChat / Instagram";
            setter = "Elias";
        } else if (source.includes("workshop")) {
            channel = "Workshop / WhatsApp";
            setter = "Automático (Workshop)";
        } else if (source.includes("vsl")) {
            channel = "VSL / Bio Instagram";
            setter = "Automático (VSL)";
        } else {
            const mcDetail = data?.stages?.[0]?.details?.origen || "";
            const mcCamp = data?.stages?.[0]?.details?.campaña || "";
            if (mcDetail.toLowerCase().includes("manychat") || mcCamp.toLowerCase() !== "n/a") {
                channel = "ManyChat / Instagram";
                setter = "Elias";
            }
        }

        return { channel, setter, closer };
    };

    const formatTime = (isoString, eventType) => {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            if (eventType === 'agenda') {
                return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
            }
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) + 
                   ' ' + date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        } catch { return isoString; }
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
                <p className="text-slate-500 text-sm max-w-md">Verifica los datos e intenta de nuevo.</p>
                {onBack && (
                    <button onClick={onBack} className="px-6 py-3 bg-slate-900 border border-slate-880 rounded-xl font-bold hover:bg-slate-800 text-xs">
                        VOLVER ATRÁS
                    </button>
                )}
            </div>
        );
    }

    const { lead, stages, activity, sales_summary, dolores, comments: notesList, programs } = data;
    const { channel, setter, closer } = detectAdquisitionDetails();

    const statusColors = {
        "Ganado": "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        "En proceso": "bg-violet-500/20 text-violet-400 border border-violet-500/30",
        "Entrante": "bg-blue-500/20 text-blue-400 border border-blue-500/30",
        "Perdido": "bg-rose-500/20 text-rose-400 border border-rose-500/30"
    };

    const stageIcons = [Sparkles, MessageCircle, User, Calendar, Phone, DollarSign];

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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 bg-slate-900/60 p-5 rounded-2xl border border-slate-850 self-center w-full lg:w-auto">
                    <div className="space-y-1">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Canal de Adquisición</div>
                        <div className="text-xs font-black text-violet-400 flex items-center gap-1.5">
                            {channel}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Setter / Closer</div>
                        <div className="text-xs font-black text-white">
                            <span className="text-amber-500">{setter}</span>
                            <span className="mx-1 text-slate-600">/</span>
                            <span className="text-emerald-450">{closer}</span>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Retención en Ecosistema</div>
                        <div className="text-xs font-black text-white flex items-center gap-1">
                            <Clock size={12} className="text-slate-550" />
                            {lead.created_at ? getDaysSinceCreated(lead.created_at) : 'N/A'}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-[9px] font-bold text-slate-550 uppercase tracking-wider">Total Facturado</div>
                        <div className="text-xs font-black text-emerald-400">
                            ${sales_summary ? sales_summary.monto : '0.00'}
                        </div>
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
                    <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
                    
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-8 relative z-10">
                        {stages.map((stage, idx) => {
                            const IconComp = stageIcons[idx] || Sparkles;
                            const isCompleted = stage.completed;
                            
                            return (
                                <div key={stage.name} className="flex flex-col items-center text-center space-y-4 group">
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                                        isCompleted 
                                            ? 'bg-violet-650 text-white shadow-lg shadow-violet-600/30 border-2 border-violet-500' 
                                            : 'bg-slate-900 text-slate-600 border border-slate-800'
                                    }`}>
                                        <IconComp size={22} className={isCompleted ? 'animate-pulse' : ''} />
                                    </div>

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

                                    <div className="w-full bg-slate-950/45 p-3.5 rounded-xl border border-slate-900/60 text-left text-[10px] space-y-1 font-bold">
                                        {idx === 0 && (
                                            <>
                                                <div className="text-slate-550">Origen: <span className="text-slate-350">{stage.details?.origen || 'Instagram'}</span></div>
                                                <div className="text-slate-550">Canal: <span className="text-slate-350">{stage.details?.canal}</span></div>
                                                <div className="text-slate-550">Campaña: <span className="text-slate-350 truncate block max-w-[120px]">{stage.details?.campaña}</span></div>
                                            </>
                                        )}
                                        {idx === 1 && (
                                            <>
                                                <div className="text-slate-550">Acción: <span className="text-slate-350">{stage.details?.accion}</span></div>
                                                <div className="text-slate-550">Medio: <span className="text-slate-350">{stage.details?.medio}</span></div>
                                                <div className="text-slate-550 text-slate-350 italic truncate max-w-[120px]">{stage.details?.mensaje}</div>
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
                                                <div className="text-slate-550">Tipo: <span className="text-slate-350">{stage.details?.tipo || 'Reunión'}</span></div>
                                                <div className="text-slate-550">Fecha: <span className="text-slate-350">{stage.details?.fecha_agendada ? stage.details.fecha_agendada.split('T')[0] : 'N/A'}</span></div>
                                            </>
                                        )}
                                        {idx === 4 && (
                                            <>
                                                <div className="text-slate-550">Resultado: <span className="text-slate-300">{stage.details?.resultado || 'Pendiente'}</span></div>
                                                <div className="text-slate-550 text-slate-350 italic truncate max-w-[120px]">{stage.details?.notes}</div>
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

                    <div className="overflow-x-auto flex-1 max-h-[500px] custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-3 px-2">Fecha</th>
                                    <th className="py-3 px-2">Evento</th>
                                    <th className="py-3 px-2">Detalle</th>
                                    <th className="py-3 px-2 text-right">Origen</th>
                                    <th className="py-3 px-2 text-center w-12">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850/50">
                                {activity.map((act, i) => (
                                    <tr key={i} className="hover:bg-slate-900/30 transition-all">
                                        <td className="py-3 px-2 text-slate-500 font-bold whitespace-nowrap">{formatTime(act.date, act.event_type)}</td>
                                        <td className="py-3 px-2 font-black text-white italic">{act.event}</td>
                                        <td className="py-3 px-2 text-slate-350">{act.detail}</td>
                                        <td className="py-3 px-2 text-right font-medium text-slate-400">{act.origin}</td>
                                        <td className="py-3 px-2 text-center">
                                            {act.event_type && act.id && (
                                                <button
                                                    onClick={() => handleDeleteActivity(act.event_type, act.id)}
                                                    className="p-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                                                    title={`Eliminar ${act.event_type === 'agenda' ? 'agenda' : 'venta'}`}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* COLUMNA LATERAL (CALIFICACIÓN Y MEMBRESÍAS) */}
                <div className="space-y-6">
                    {/* CALIFICACIÓN EN CALIENTE */}
                    <div className="bg-slate-900/40 p-6 rounded-3xl border border-violet-950/40 space-y-4 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-violet-500 to-amber-500" />
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles size={14} className="text-violet-400" />
                                Calificación en Caliente
                            </h4>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-950 border border-slate-850 px-2 py-0.5 rounded-md">
                                Quick Save
                            </span>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Objeciones</label>
                            <div className="flex flex-wrap gap-1 mb-1">
                                {commonObjections.map((tag) => {
                                    const isSelected = objeciones.toLowerCase().includes(tag.toLowerCase().split(' ')[0]);
                                    return (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => toggleObjectionTag(tag)}
                                            className={`text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-md border transition-all ${
                                                isSelected
                                                    ? 'bg-violet-600/20 text-violet-400 border-violet-500/40'
                                                    : 'bg-slate-950 hover:bg-slate-900 text-slate-400 border-slate-850'
                                            }`}
                                        >
                                            {tag}
                                        </button>
                                    );
                                })}
                            </div>
                            <textarea
                                className="w-full h-16 px-3.5 py-2.5 bg-slate-950 border border-slate-855 rounded-xl text-xs text-white placeholder-slate-650 focus:outline-none focus:border-violet-500 font-bold resize-none custom-scrollbar"
                                placeholder="Notas de objeción..."
                                value={objeciones}
                                onChange={(e) => setObjeciones(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Observaciones de Triage</label>
                            <textarea
                                className="w-full h-20 px-3.5 py-2.5 bg-slate-950 border border-slate-855 rounded-xl text-xs text-white placeholder-slate-650 focus:outline-none focus:border-violet-500 font-bold resize-none custom-scrollbar"
                                placeholder="Notas de triage, facturación, socio, etc..."
                                value={observaciones}
                                onChange={(e) => setObservaciones(e.target.value)}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleSaveCalificacion}
                            disabled={savingCalificacion}
                            className="w-full py-3 bg-violet-600 hover:bg-violet-750 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {savingCalificacion ? (
                                <Loader2 size={12} className="animate-spin" />
                            ) : (
                                <Save size={12} />
                            )}
                            Guardar Calificación
                        </button>
                    </div>

                    {/* PERMANENCIA EN PROGRAMAS */}
                    <div className="bg-slate-900/30 p-6 rounded-3xl border border-slate-850 space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-black text-white uppercase tracking-wider">Membresías y Programas</h4>
                            <span className="text-[9px] font-black uppercase bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full">
                                Retención
                            </span>
                        </div>
                        {programs && programs.length > 0 ? (
                            <div className="space-y-3">
                                {programs.map((prog, i) => (
                                    <div key={i} className="bg-slate-950/60 p-4 rounded-2xl border border-slate-900 space-y-2 relative overflow-hidden group hover:border-slate-800 transition-colors">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/5 blur-2xl rounded-full" />
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-0.5">
                                                <span className="text-xs font-black text-white italic uppercase tracking-wide flex items-center gap-1.5">
                                                    <Award size={14} className="text-amber-500" />
                                                    {prog.program_name}
                                                </span>
                                                <span className="text-[9px] text-slate-500 block font-bold">
                                                    Inscrito: {prog.enrollment_date ? new Date(prog.enrollment_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'} {prog.source && <span className="text-[8px] text-slate-600 ml-1">({prog.source})</span>}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                                ${prog.total_paid || '0.00'} USD
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 pt-1 border-t border-slate-900/50">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Permanencia:</span>
                                            <span className="text-[10px] font-black text-violet-400 bg-violet-500/10 px-2.5 py-1 rounded-full border border-violet-500/20">
                                                {prog.permanence || '0 días'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 px-4 text-slate-550 text-xs font-bold italic border border-dashed border-slate-850 rounded-2xl bg-slate-950/20">
                                Sin programas activos (Fase de Prospección)
                            </div>
                        )}
                    </div>

                    {/* RESUMEN DE LA VENTA */}
                    <div className="bg-slate-900/30 p-6 rounded-3xl border border-slate-850 space-y-4">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">Resumen de Venta Global</h4>
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
                            <div className="text-center py-6 text-slate-550 text-xs font-bold italic border border-dashed border-slate-850 rounded-2xl">
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

                    {/* NOTAS INTERNAS / CHAT COMENTARIOS */}
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
                                <div className="text-center py-6 text-slate-550 text-xs font-bold italic">
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
            <EditLeadModal 
                show={showEditModal} 
                onClose={() => setShowEditModal(false)} 
                editForm={editForm} 
                setEditForm={setEditForm} 
                onSubmit={handleSaveClient} 
            />

            {/* MODAL DE VINCULACIÓN MANUAL DE EVENTOS */}
            <LinkEventModal 
                show={showLinkModal} 
                onClose={() => setShowLinkModal(false)} 
                linkForm={linkForm} 
                setLinkForm={setLinkForm} 
                onSubmit={handleLinkEvent} 
                currentInstagram={data?.lead?.instagram || instagram} 
            />
        </div>
    );
};

export default LeadRoadmapDetail;
