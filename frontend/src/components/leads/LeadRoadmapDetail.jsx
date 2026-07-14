import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
    User, Mail, Phone, Instagram, DollarSign, Calendar, 
    ChevronDown, ChevronUp, Edit, Clock, 
    Sparkles, Loader2, MessageCircle, AlertCircle, Trash2, Save, Award, ClipboardList, Bot, MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import { EditLeadModal } from './LeadRoadmapModals';
import { useAuth } from '../../contexts/AuthContext';

const LeadRoadmapDetail = ({ instagram, clientId, email, phone, onBack, onUpdate, availableKeywords = [], userRole, appointmentId, compact = false }) => {
    const { user } = useAuth();
    const isConfirmer = user?.role === 'triage';
    const isSetter = user?.role === 'setter';
    const isCloser = user?.role === 'closer';
    const isAdmin = user?.role === 'admin';
    
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [activeTab, setActiveTab] = useState('formulario'); // 'formulario' o 'calificacion'
    
    // Calificación en caliente
    const [objeciones, setObjeciones] = useState('');
    const [dolores, setDolores] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [savingCalificacion, setSavingCalificacion] = useState(false);

    // Formulario de edición
    const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', instagram: '' });

    // Comentarios
    const [newComment, setNewComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);

    const [frequentObjections, setFrequentObjections] = useState([]);
    const [frequentDolores, setFrequentDolores] = useState([]);
    const [newDolorInput, setNewDolorInput] = useState('');
    const [newObjectionInput, setNewObjectionInput] = useState('');

    const toggleDolorTag = (tag) => {
        // Alterna la selección de un dolor
        const list = dolores.split(',').map(d => d.trim()).filter(Boolean);
        const index = list.indexOf(tag);
        if (index > -1) {
            list.splice(index, 1);
        } else {
            list.push(tag);
        }
        setDolores(list.join(', '));
    };

    const toggleObjectionTag = (tag) => {
        // Alterna la selección de una objeción
        const list = objeciones.split(',').map(o => o.trim()).filter(Boolean);
        const index = list.indexOf(tag);
        if (index > -1) {
            list.splice(index, 1);
        } else {
            list.push(tag);
        }
        setObjeciones(list.join(', '));
    };

    const addManualDolor = () => {
        // Agrega un dolor de forma manual
        const val = newDolorInput.trim();
        if (!val) return;
        const list = dolores.split(',').map(d => d.trim()).filter(Boolean);
        if (!list.some(d => d.toLowerCase() === val.toLowerCase())) {
            list.push(val);
            setDolores(list.join(', '));
        }
        setNewDolorInput('');
    };

    const addManualObjection = () => {
        // Agrega una objeción de forma manual
        const val = newObjectionInput.trim();
        if (!val) return;
        const list = objeciones.split(',').map(o => o.trim()).filter(Boolean);
        if (!list.some(o => o.toLowerCase() === val.toLowerCase())) {
            list.push(val);
            setObjeciones(list.join(', '));
        }
        setNewObjectionInput('');
    };

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
            
            setFrequentObjections(res.data.frequent_objections || []);
            setFrequentDolores(res.data.frequent_dolores || []);
            
            if (res.data.lead) {
                setEditForm({
                    full_name: res.data.lead.full_name || '',
                    email: res.data.lead.email || '',
                    phone: res.data.lead.phone || '',
                    instagram: res.data.lead.instagram || ''
                });
                setObjeciones(res.data.lead.objeciones || '');
                setDolores(res.data.lead.dolores || '');
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
                observaciones,
                dolores
            };
            await api.post('/public/lead-roadmap/update-client', payload);
            toast.success("Calificación guardada");
            fetchRoadmap();
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error("Error saving calificacion", err);
            toast.error("Error al guardar calificación");
        } finally {
            setSavingCalificacion(false);
        }
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

    const { lead, stages, activity, sales_summary, dolores: doloresConsolidados, comments: notesList, programs } = data;
    const { channel, setter, closer } = detectAdquisitionDetails();

    const renderLeadTimeline = () => {
        return (
            <div className="space-y-6 flex flex-col h-full min-h-[350px]">
                <div className="flex justify-between items-center px-1">
                    <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <MessageSquare size={16} className="text-violet-400 animate-pulse" />
                        Feed de Actividad e Interacciones del Lead
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
                        {activity ? activity.length : 0} Eventos
                    </span>
                </div>

                {/* Formulario de Notas Integrado */}
                {lead && lead.id && (
                    <form onSubmit={handleAddComment} className="flex gap-3 bg-[#0d0e14]/60 p-4 rounded-2xl border border-slate-850 shadow-inner text-left">
                        <div className="w-8 h-8 rounded-full bg-violet-650/20 text-violet-400 flex items-center justify-center border border-violet-500/20 shrink-0 font-black text-xs">
                            {user?.username ? user.username[0].toUpperCase() : 'U'}
                        </div>
                        <div className="flex-1 flex gap-2">
                            <input 
                                type="text"
                                placeholder="Deja una nota interna para el equipo sobre este Lead..."
                                className="flex-1 px-4 py-2 bg-[#050609] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-650 focus:outline-none focus:border-violet-500 font-bold transition-all"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                disabled={submittingComment}
                            />
                            <button 
                                type="submit"
                                disabled={submittingComment || !newComment.trim()}
                                className="px-4 py-2 bg-violet-600 hover:bg-violet-750 text-white font-black uppercase text-[10px] tracking-wider rounded-xl disabled:opacity-30 transition-all flex items-center gap-1.5 shrink-0 border-none cursor-pointer"
                            >
                                {submittingComment ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
                                Enviar Nota
                            </button>
                        </div>
                    </form>
                )}

                {/* Línea de tiempo cronológica */}
                <div className="relative border-l-2 border-slate-800/80 ml-4 pl-6 space-y-6 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar">
                    {(activity || []).map((act, i) => {
                        let cardBg = "bg-slate-900/30 border-slate-850 hover:border-slate-800";
                        let iconColor = "text-slate-500";
                        let iconBg = "bg-slate-950 border-slate-800";
                        let IconComponent = Sparkles;
                        let isNote = act.origin === "Notas Internas";

                        if (isNote) {
                            cardBg = "bg-violet-950/15 border-violet-500/20 shadow-md shadow-violet-950/5 hover:border-violet-500/40";
                            iconColor = "text-violet-400";
                            iconBg = "bg-violet-950/30 border-violet-500/30";
                            IconComponent = MessageCircle;
                        } else if (act.event.includes("Agenda")) {
                            cardBg = "bg-slate-900/40 border-blue-900/30 hover:border-blue-500/20";
                            iconColor = "text-blue-400";
                            iconBg = "bg-blue-950/30 border-blue-900/50";
                            IconComponent = Calendar;
                        } else if (act.event.includes("Llamada") || act.event.includes("Contacto")) {
                            cardBg = "bg-slate-900/40 border-emerald-900/30 hover:border-emerald-500/20";
                            iconColor = "text-emerald-450";
                            iconBg = "bg-emerald-950/30 border-emerald-900/50";
                            IconComponent = Phone;
                        } else if (act.event.includes("Venta")) {
                            cardBg = "bg-gradient-to-r from-emerald-950/10 to-slate-900/40 border-emerald-500/20 hover:border-emerald-500/45 shadow-lg shadow-emerald-950/5";
                            iconColor = "text-emerald-400";
                            iconBg = "bg-emerald-950/40 border-emerald-500/30";
                            IconComponent = Award;
                        } else if (act.origin === "ManyChat") {
                            cardBg = "bg-slate-900/10 border-slate-900/50 hover:border-slate-800";
                            iconColor = "text-violet-400";
                            iconBg = "bg-slate-950 border-slate-900";
                            IconComponent = Bot;
                        }

                        return (
                            <div key={i} className="relative group transition-all text-left">
                                {/* Icono de Hito */}
                                <span className={`absolute -left-[35px] top-1.5 w-7 h-7 rounded-full flex items-center justify-center border transition-all ${iconBg} ${iconColor} group-hover:scale-110 z-10`}>
                                    <IconComponent size={12} />
                                </span>
                                
                                {/* Tarjeta de Evento */}
                                <div className={`p-4 rounded-2xl border transition-all ${cardBg}`}>
                                    <div className="flex justify-between items-start gap-4 mb-1.5">
                                        <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                                            {act.event}
                                            {isNote && (
                                                <span className="px-2 py-0.5 text-[8px] bg-violet-500/10 text-violet-400 rounded-md font-bold uppercase border border-violet-500/20">Nota</span>
                                            )}
                                        </span>
                                        <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap">{formatTime(act.date, act.event_type)}</span>
                                    </div>
                                    <p className="text-xs text-slate-305 font-bold whitespace-pre-wrap leading-relaxed">{act.detail}</p>
                                    {act.origin && !isNote && (
                                        <div className="text-[9px] text-slate-550 font-bold uppercase tracking-wider mt-2.5 flex items-center gap-1">
                                            Origen: <span className="text-slate-400">{act.origin}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {(!activity || activity.length === 0) && (
                        <div className="text-center py-12 text-slate-650 text-xs italic font-bold">
                            Sin historial de actividad aún.
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const statusColors = {
        "Ganado": "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        "En proceso": "bg-violet-500/20 text-violet-400 border border-violet-500/30",
        "Entrante": "bg-blue-500/20 text-blue-400 border border-blue-500/30",
        "Perdido": "bg-rose-500/20 text-rose-400 border border-rose-500/30"
    };

    const stageIcons = [Sparkles, MessageCircle, User, Calendar, Phone, DollarSign];

    return (
        <div className={compact ? "space-y-4 text-slate-200 text-left" : "space-y-8 bg-slate-950 text-slate-200 p-6 rounded-[2rem] border border-slate-800 shadow-2xl relative"}>
            {/* BARRA DE NAVEGACIÓN SUPERIOR */}
            {!compact && (
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
                    </div>
                </div>
            )}

            {/* CABECERA PRINCIPAL DEL LEAD */}
            {compact ? (
                <div className="space-y-3 pb-3 border-b border-slate-900">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <h2 className="text-xl font-black text-white italic tracking-tight">{lead.full_name}</h2>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-slate-400">
                                {lead.phone && (
                                    <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-white transition-colors">
                                        <Phone size={10} className="text-violet-500" /> {lead.phone}
                                    </a>
                                )}
                                {lead.email && (
                                    <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-white transition-colors">
                                        <Mail size={10} className="text-violet-500" /> {lead.email}
                                    </a>
                                )}
                                {lead.instagram && (
                                    <a href={`https://instagram.com/${lead.instagram}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-white transition-colors">
                                        <Instagram size={10} className="text-violet-500" /> @{lead.instagram}
                                    </a>
                                )}
                            </div>
                        </div>
                        <span className={`px-2 py-0.5 text-[8px] font-black rounded-full uppercase tracking-wider ${statusColors[lead.status] || 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                            {lead.status}
                        </span>
                    </div>

                    {/* METADATOS COMPACTOS */}
                    <div className="grid grid-cols-2 gap-3 text-[10px] bg-slate-900/30 p-3 rounded-xl border border-slate-850">
                        <div>
                            <span className="text-slate-550 block font-bold uppercase tracking-wider text-[8px]">Origen</span>
                            <span className="font-black text-violet-400">{channel}</span>
                        </div>
                        <div>
                            <span className="text-slate-550 block font-bold uppercase tracking-wider text-[8px]">Edad</span>
                            <span className="font-black text-white">{lead.created_at ? getDaysSinceCreated(lead.created_at) : 'N/A'}</span>
                        </div>
                        <div>
                            <span className="text-slate-550 block font-bold uppercase tracking-wider text-[8px]">Asignación</span>
                            <span className="font-black text-slate-300">
                                <span className="text-amber-500">{setter}</span> / <span className="text-emerald-450">{closer}</span>
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-550 block font-bold uppercase tracking-wider text-[8px] mb-0.5">Anuncio (Keyword)</span>
                            {userRole === 'setter' && appointmentId ? (
                                <select
                                    value={data?.appointment_keyword || lead.keyword || ''}
                                    onChange={async (e) => {
                                        const newKeyword = e.target.value;
                                        try {
                                            await api.post(`/setter/deck/${appointmentId}`, { keyword: newKeyword });
                                            toast.success("Anuncio actualizado");
                                            fetchRoadmap();
                                            if (onUpdate) onUpdate();
                                        } catch (err) {
                                            console.error("Error al actualizar anuncio:", err);
                                            toast.error("Error al actualizar anuncio");
                                        }
                                    }}
                                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2 py-0.5 text-[9px] font-bold text-slate-200 cursor-pointer outline-none"
                                >
                                    <option value="">Sin anuncio</option>
                                    {availableKeywords.map(k => (
                                        <option key={k.id} value={k.slug}>{k.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <span className="font-black text-white">{lead.keyword || data?.appointment_keyword || 'Sin anuncio'}</span>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row justify-between gap-6 p-2 mb-4">
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
                    <div className="flex flex-wrap gap-8 items-center self-center w-full lg:w-auto mt-4 lg:mt-0">
                        <div className="space-y-1" title="Canal de Adquisición">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Origen</div>
                            <div className="text-xs font-black text-violet-400 flex items-center gap-1.5">
                                {channel}
                            </div>
                        </div>
                        <div className="space-y-1" title="Anuncio / Keyword asociada al Lead">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Anuncio (Keyword)</div>
                            {userRole === 'setter' && appointmentId ? (
                                <select
                                    value={data?.appointment_keyword || lead.keyword || ''}
                                    onChange={async (e) => {
                                        const newKeyword = e.target.value;
                                        try {
                                            await api.post(`/setter/deck/${appointmentId}`, { keyword: newKeyword });
                                            toast.success("Anuncio actualizado");
                                            fetchRoadmap();
                                            if (onUpdate) onUpdate();
                                        } catch (err) {
                                            console.error("Error al actualizar anuncio:", err);
                                            toast.error("Error al actualizar anuncio");
                                        }
                                    }}
                                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-black text-slate-200 cursor-pointer outline-none focus:ring-1 focus:ring-violet-500/50"
                                >
                                    <option value="">Sin anuncio</option>
                                    {availableKeywords.map(k => (
                                        <option key={k.id} value={k.slug}>{k.name} ({k.slug})</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="text-xs font-black text-white">
                                    {lead.keyword || data?.appointment_keyword || 'Sin anuncio'}
                                </div>
                            )}
                        </div>
                        <div className="space-y-1" title="Setter asignado y Closer responsable">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Asignación</div>
                            <div className="text-xs font-black text-white">
                                <span className="text-amber-500">{setter}</span>
                                <span className="mx-1 text-slate-600">/</span>
                                <span className="text-emerald-450">{closer}</span>
                            </div>
                        </div>
                        <div className="space-y-1" title="Tiempo de retención desde la creación del lead">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Edad</div>
                            <div className="text-xs font-black text-white flex items-center gap-1">
                                <Clock size={12} className="text-slate-550" />
                                {lead.created_at ? getDaysSinceCreated(lead.created_at) : 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SECCIÓN LEAD ROADMAP (EMBUDO HORIZONTAL) */}
            {!compact && (
                <div className="space-y-6 mb-8">
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
                                    <div key={stage.name} className="relative flex flex-col items-center text-center space-y-4 group">
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

                                        {/* Tooltip con información detallada, visible al hacer hover */}
                                        <div className="absolute top-[85%] left-1/2 -translate-x-1/2 mt-4 w-48 bg-slate-950/95 border border-slate-800 p-3.5 rounded-2xl shadow-2xl shadow-black/50 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-300 z-50 text-left text-[10px] space-y-1.5 font-bold scale-95 group-hover:scale-100 origin-top">
                                            {idx === 0 && (
                                                <>
                                                    <div className="text-slate-550">Origen: <span className="text-slate-350">{stage.details?.origen || 'Instagram'}</span></div>
                                                    <div className="text-slate-550">Canal: <span className="text-slate-350">{stage.details?.canal}</span></div>
                                                    <div className="text-slate-550 flex flex-col">Campaña: <span className="text-slate-350 truncate">{stage.details?.campaña}</span></div>
                                                </>
                                            )}
                                            {idx === 1 && (
                                                <>
                                                    <div className="text-slate-550">Acción: <span className="text-slate-350">{stage.details?.accion}</span></div>
                                                    <div className="text-slate-550">Medio: <span className="text-slate-350">{stage.details?.medio}</span></div>
                                                    <div className="text-slate-550 text-slate-350 italic break-words">{stage.details?.mensaje}</div>
                                                </>
                                            )}
                                            {idx === 2 && (
                                                <>
                                                    <div className="text-slate-550">Dolores:</div>
                                                    <ul className="list-disc pl-3 text-slate-300 space-y-0.5 max-h-24 overflow-y-auto custom-scrollbar">
                                                        {(stage.details?.dolores || []).map((d, i) => (
                                                            <li key={i} className="break-words">{d}</li>
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
                                                    <div className="text-slate-550 text-slate-350 italic break-words">{stage.details?.notes}</div>
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
            )}

            {/* PESTAÑAS PARA INTERFAZ COMPACTA */}
            {compact && (
                <div className="flex border-b border-slate-800/80 mb-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('formulario')}
                        className={`flex-1 pb-2 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                            activeTab === 'formulario'
                                ? 'border-violet-500 text-white'
                                : 'border-transparent text-slate-500 hover:text-slate-355'
                        }`}
                    >
                        Respuestas Bot
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('calificacion')}
                        className={`flex-1 pb-2 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                            activeTab === 'calificacion'
                                ? 'border-violet-500 text-white'
                                : 'border-transparent text-slate-500 hover:text-slate-355'
                        }`}
                    >
                        Calificar Lead
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('notas')}
                        className={`flex-1 pb-2 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                            activeTab === 'notas'
                                ? 'border-violet-500 text-white'
                                : 'border-transparent text-slate-500 hover:text-slate-355'
                        }`}
                    >
                        Notas Internas
                    </button>
                </div>
            )}

            {/* SECCIÓN INFERIOR: CALIFICACIÓN Y FORMULARIO */}
            <div className={compact ? "space-y-4 mb-4" : "grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8"}>
                
                {/* COLUMNA 1: CALIFICACIÓN FORMULARIO (n8n) */}
                {(!compact || activeTab === 'formulario') && (
                    <div className="bg-slate-900/30 p-6 rounded-3xl border border-slate-850 space-y-4 flex flex-col shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-violet-500" />
                    <div className="flex justify-between items-center">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                            <ClipboardList size={14} className="text-blue-400" />
                            Calificación Formulario (n8n)
                        </h4>
                        {lead.form_data?.fuente_form && (
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-950 border border-slate-850 px-2 py-0.5 rounded-md">
                                {lead.form_data.fuente_form}
                            </span>
                        )}
                    </div>

                    {lead.form_data ? (
                        <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar text-xs">
                            {lead.form_data.examen && (
                                <div className="space-y-0.5">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Examen objetivo</span>
                                    <span className="font-black text-white italic">{lead.form_data.examen}</span>
                                </div>
                            )}
                            {lead.form_data.profesion && (
                                <div className="space-y-0.5">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Profesión</span>
                                    <span className="font-bold text-slate-200">{lead.form_data.profesion}</span>
                                </div>
                            )}
                            {lead.form_data.formacion && (
                                <div className="space-y-0.5">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Formación / Estado</span>
                                    <span className="text-slate-350 font-medium">{lead.form_data.formacion}</span>
                                </div>
                            )}
                            {lead.form_data.empleo && (
                                <div className="space-y-0.5">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Situación Laboral</span>
                                    <span className="text-slate-350">{lead.form_data.empleo}</span>
                                </div>
                            )}
                            {lead.form_data.puntaje && (
                                <div className="space-y-0.5">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Puntaje a subir</span>
                                    <span className="text-amber-400 font-black">{lead.form_data.puntaje}</span>
                                </div>
                            )}
                            {lead.form_data.inversion && (
                                <div className="space-y-0.5">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Capacidad de Inversión</span>
                                    <span className="text-rose-400 font-bold">{lead.form_data.inversion}</span>
                                </div>
                            )}
                            {lead.form_data.interes && (
                                <div className="space-y-0.5">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Interés Principal</span>
                                    <p className="text-slate-300 font-medium italic">"{lead.form_data.interes}"</p>
                                </div>
                            )}
                            {lead.form_data.apoyo && (
                                <div className="space-y-0.5">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Apoyo adicional</span>
                                    <p className="text-slate-300 font-medium">"{lead.form_data.apoyo}"</p>
                                </div>
                            )}
                            {lead.form_data.submitted_at && (
                                <div className="text-[9px] text-slate-600 text-right font-bold uppercase mt-2">
                                    Recibido: {new Date(lead.form_data.submitted_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 px-4 text-slate-550 text-xs font-bold italic border border-dashed border-slate-850 rounded-2xl bg-slate-950/20 my-auto">
                            Sin respuestas de formulario n8n (Lead no completó el formulario)
                        </div>
                    )}
                </div>
                )}

                {/* COLUMNA 2: CALIFICACIÓN EN CALIENTE (MANUAL) */}
                {(!compact || activeTab === 'calificacion') && (
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
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Dolores del Prospecto</label>
                        {isConfirmer || isCloser ? (
                            <div className="px-3.5 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-slate-405 font-bold whitespace-pre-wrap min-h-[3.5rem] text-left">
                                {dolores || "Sin dolores registrados por el setter"}
                            </div>
                        ) : (
                            <textarea
                                className="w-full h-20 px-3.5 py-2.5 bg-slate-950/50 border border-transparent rounded-xl text-xs text-white placeholder-slate-605 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:bg-slate-900 transition-all font-bold resize-none custom-scrollbar"
                                placeholder="Ingresa los dolores del prospecto..."
                                value={dolores}
                                onChange={(e) => setDolores(e.target.value)}
                            />
                        )}
                    </div>

                    {/* OBJECIONES */}
                    {!isConfirmer && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Objeciones</label>
                            {isSetter ? (
                                <div className="px-3.5 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-slate-405 font-bold whitespace-pre-wrap min-h-[3.5rem] text-left">
                                    {objeciones || "Sin objeciones registradas por el closer"}
                                </div>
                            ) : (
                                <textarea
                                    className="w-full h-20 px-3.5 py-2.5 bg-slate-950/50 border border-transparent rounded-xl text-xs text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:bg-slate-900 transition-all font-bold resize-none custom-scrollbar"
                                    placeholder="Ingresa las objeciones del prospecto..."
                                    value={objeciones}
                                    onChange={(e) => setObjeciones(e.target.value)}
                                />
                            )}
                        </div>
                    )}

                    {/* OBSERVACIONES */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Observaciones de Call Confirmer</label>
                        {isConfirmer || isAdmin ? (
                            <textarea
                                className="w-full h-24 px-3.5 py-2.5 bg-slate-950/50 border border-transparent rounded-xl text-xs text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:bg-slate-900 transition-all font-bold resize-none custom-scrollbar"
                                placeholder="Notas de call confirmer, facturación, socio, etc..."
                                value={observaciones}
                                onChange={(e) => setObservaciones(e.target.value)}
                            />
                        ) : (
                            <div className="px-3.5 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-slate-405 font-bold whitespace-pre-wrap min-h-[3.5rem] text-left">
                                {observaciones || "Sin observaciones del call confirmer"}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleSaveCalificacion}
                        disabled={savingCalificacion}
                        className="w-full py-3 bg-violet-600 hover:bg-violet-755 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {savingCalificacion ? (
                            <Loader2 size={12} className="animate-spin" />
                        ) : (
                            <Save size={12} />
                        )}
                    </button>
                </div>
                )}
            </div>

            {/* Pestaña de Notas en modo compacto */}
            {compact && activeTab === 'notas' && (
                <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-850 shadow-xl mb-4">
                    {renderLeadTimeline()}
                </div>
            )}

            {/* SECCIÓN INFERIOR: MEMBRESÍAS Y VENTAS (Grid de 2 columnas) */}
            {!compact && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        
                        {/* COLUMNA 1: PROGRAMAS */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <h4 className="text-sm font-black text-white uppercase tracking-wider">Membresías</h4>
                            </div>
                            {programs && programs.length > 0 ? (
                                <div className="space-y-3">
                                    {programs.map((prog, i) => (
                                        <div key={i} className="bg-slate-900/30 px-4 py-3 rounded-2xl space-y-2 relative overflow-hidden group">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-0.5">
                                                    <span className="text-xs font-black text-white italic uppercase tracking-wide flex items-center gap-1.5">
                                                        <Award size={14} className="text-amber-500" />
                                                        {prog.program_name}
                                                    </span>
                                                    <span className="text-[9px] text-slate-500 block font-bold" title={prog.source ? `Fuente: ${prog.source}` : ''}>
                                                        Inscrito: {prog.enrollment_date ? new Date(prog.enrollment_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                                    ${prog.total_paid || '0.00'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 px-4 text-slate-550 text-xs font-bold italic border border-dashed border-slate-850 rounded-2xl bg-slate-950/20">
                                    Sin programas
                                </div>
                            )}
                        </div>
 
                        {/* COLUMNA 2: RESUMEN DE VENTAS */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-white uppercase tracking-wider px-1">Ventas Totales</h4>
                            {sales_summary ? (
                                <div className="bg-slate-900/30 p-5 rounded-2xl space-y-4">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-2xl font-black text-emerald-400">${sales_summary.monto}</span>
                                        <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">{sales_summary.estado}</span>
                                    </div>
                                    <div className="space-y-1.5 text-xs font-bold text-slate-300">
                                        <div className="flex justify-between"><span className="text-slate-500">Producto</span> <span>{sales_summary.producto}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-500">Método</span> <span>{sales_summary.metodo_pago}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-550">Próximo</span> <span className="text-amber-500">{sales_summary.proximo_pago}</span></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-6 text-slate-550 text-xs font-bold italic border border-dashed border-slate-850 rounded-2xl">
                                    Sin ventas
                                </div>
                            )}
                        </div>
                    </div>
 
                    {/* FILA INFERIOR: FEED DE ACTIVIDAD Y COMUNICACIÓN UNIFICADA (ANCHO COMPLETO) */}
                    <div className="bg-slate-900/30 p-6 rounded-3xl border border-slate-850 shadow-xl">
                        {renderLeadTimeline()}
                    </div>
                </>
            )}

            {/* MODAL DE EDICIÓN DE DATOS DEL CLIENTE */}
            <EditLeadModal 
                show={showEditModal} 
                onClose={() => setShowEditModal(false)} 
                editForm={editForm} 
                setEditForm={setEditForm} 
                onSubmit={handleSaveClient} 
            />
        </div>
    );
};

export default LeadRoadmapDetail;
