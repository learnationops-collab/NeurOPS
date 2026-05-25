import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
    Instagram, 
    Link as LinkIcon, 
    Key, 
    MessageSquare, 
    Calendar, 
    User, 
    Phone, 
    Mail, 
    ArrowLeft, 
    ArrowRight,
    ExternalLink, 
    Layers, 
    Loader2, 
    Check, 
    X,
    Clock,
    Tag,
    Video,
    MessageCircle,
    MoreVertical,
    Activity,
    UserPlus,
    CheckCircle,
    AlertTriangle,
    TrendingUp,
    PhoneCall,
    Search,
    ChevronRight
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import MazoCartas from '../../components/deck/MazoCartas';
import BuscadorGlobalDeck from '../../components/deck/BuscadorGlobalDeck';
import Button from '../../components/ui/Button';

// Colores premium para gráfico circular
const COLORS = ['#1534ff', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

const LeadsManagementPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const apptIdParam = searchParams.get('appt_id');
    const rolePath = useMemo(() => user?.role === 'closer' ? 'closer' : 'setter', [user?.role]);

    // Cola del Mazo
    const [cards, setCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isSearchedCard, setIsSearchedCard] = useState(false);

    // Form states compartidos
    const [instagram, setInstagram] = useState('');
    const [igChatLink, setIgChatLink] = useState('');
    const [keyword, setKeyword] = useState('');
    const [setterNotes, setSetterNotes] = useState('');
    const [closerNotes, setCloserNotes] = useState('');
    const [linkedCall, setLinkedCall] = useState('');
    const [result, setResult] = useState('Pendiente');

    // Filtros
    const [filterOrigin, setFilterOrigin] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterDateRange, setFilterDateRange] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Datos Adicionales (KPIs, Sin asignar, Eventos, Gráfica)
    const [stats, setStats] = useState({ kpis_top: {}, kpis_bottom: {}, chart_data: [] });
    const [unassignedLeads, setUnassignedLeads] = useState([]);
    const [eventHistory, setEventHistory] = useState([]);
    const [showAllEventsModal, setShowAllEventsModal] = useState(false);
    const [allEvents, setAllEvents] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(false);

    // Cargar cola de cartas filtrada
    const fetchQueue = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/${rolePath}/deck?date_range=${filterDateRange}`);
            setCards(res.data || []);
            setCurrentIndex(0);
            setIsSearchedCard(false);
        } catch (err) {
            console.error("Error al cargar mazo:", err);
            toast.error("Error al cargar la cola de leads");
        } finally {
            setLoading(false);
        }
    };

    // Cargar KPIs y Gráfica
    const fetchStats = async () => {
        try {
            const res = await api.get(`/${rolePath}/deck/stats/kpis?date_range=${filterDateRange}`);
            setStats(res.data || { kpis_top: {}, kpis_bottom: {}, chart_data: [] });
        } catch (err) {
            console.error("Error al cargar estadísticas:", err);
        }
    };

    // Cargar leads sin asignar de hoy
    const fetchUnassignedToday = async () => {
        try {
            const res = await api.get(`/${rolePath}/deck/unassigned-today`);
            setUnassignedLeads(res.data || []);
        } catch (err) {
            console.error("Error al cargar leads sin asignar:", err);
        }
    };

    // Cargar historial de eventos para la carta activa
    const fetchEventLogs = async (apptId) => {
        try {
            const res = await api.get(`/${rolePath}/deck/events/${apptId}`);
            setEventHistory(res.data || []);
        } catch (err) {
            console.error("Error al cargar historial del lead:", err);
        }
    };

    // Cargar historial completo (Modal)
    const fetchAllEventLogs = async (apptId) => {
        setLoadingEvents(true);
        try {
            const res = await api.get(`/${rolePath}/deck/events/${apptId}?limit=50`);
            setAllEvents(res.data || []);
        } catch (err) {
            console.error("Error al cargar historial completo:", err);
        } finally {
            setLoadingEvents(false);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchUnassignedToday();
        if (apptIdParam) {
            handleSelectLead(apptIdParam);
        } else {
            fetchQueue();
        }
    }, [apptIdParam, filterDateRange]);

    const activeCard = cards[currentIndex];

    // Sincronizar form con la carta activa
    useEffect(() => {
        if (cards.length > 0 && currentIndex < cards.length) {
            const card = cards[currentIndex];
            setInstagram(card.instagram || '');
            setIgChatLink(card.ig_chat_link || '');
            setKeyword(card.keyword || '');
            setSetterNotes(card.setter_notes || '');
            setCloserNotes(card.closer_notes || '');
            setLinkedCall(card.linked_call || '');
            setResult(card.result || 'Pendiente');
            
            // Traer historial del lead activo
            fetchEventLogs(card.id);
        } else {
            setInstagram('');
            setIgChatLink('');
            setKeyword('');
            setSetterNotes('');
            setCloserNotes('');
            setLinkedCall('');
            setResult('Pendiente');
            setEventHistory([]);
        }
    }, [cards, currentIndex]);

    // Comentarios states
    const [comments, setComments] = useState([]);
    const [newCommentText, setNewCommentText] = useState('');
    const [replyToId, setReplyToId] = useState(null);
    const [replyToName, setReplyToName] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);

    // Cargar comentarios
    const fetchComments = async (apptId) => {
        setLoadingComments(true);
        try {
            const res = await api.get(`/${rolePath}/deck/comments/${apptId}`);
            setComments(res.data || []);
        } catch (err) {
            console.error("Error al cargar comentarios:", err);
        } finally {
            setLoadingComments(false);
        }
    };

    useEffect(() => {
        if (activeCard?.id) {
            fetchComments(activeCard.id);
        } else {
            setComments([]);
        }
    }, [activeCard?.id]);

    const handleSendComment = async (e) => {
        if (e) e.preventDefault();
        if (!newCommentText.trim() || !activeCard?.id) return;
        
        try {
            const payload = {
                text: newCommentText,
                parent_id: replyToId
            };
            await api.post(`/${rolePath}/deck/comments/${activeCard.id}`, payload);
            toast.success(replyToId ? "Respuesta enviada" : "Comentario enviado");
            setNewCommentText('');
            setReplyToId(null);
            setReplyToName('');
            fetchComments(activeCard.id);
            fetchEventLogs(activeCard.id); // Recargar timeline para ver el log de comentario
        } catch (err) {
            console.error("Error al enviar comentario:", err);
            toast.error("Error al enviar comentario");
        }
    };

    // Buscar lead específico
    const handleSelectLead = async (leadId) => {
        setLoading(true);
        try {
            const res = await api.get(`/${rolePath}/deck/card/${leadId}`);
            setCards([res.data]);
            setCurrentIndex(0);
            setIsSearchedCard(true);
            toast.success("Lead cargado en el mazo");
        } catch (err) {
            console.error("Error al buscar lead:", err);
            toast.error("No se pudo cargar la información de este lead");
        } finally {
            setLoading(false);
        }
    };

    // Guardar cambios en la carta (Setter o Closer)
    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!activeCard) return;

        setSubmitting(true);
        const payload = user?.role === 'closer' ? {
            keyword,
            linked_call: linkedCall,
            closer_notes: closerNotes,
            result
        } : {
            instagram,
            ig_chat_link: igChatLink,
            keyword,
            setter_notes: setterNotes,
            result
        };

        try {
            await api.post(`/${rolePath}/deck/${activeCard.id}`, payload);
            toast.success("Progreso y notas guardados correctamente");
            
            // Avanzar en la cola
            setCurrentIndex(prev => prev + 1);
            
            // Refrescar KPIs
            fetchStats();
            fetchUnassignedToday();
        } catch (err) {
            console.error("Error al guardar cambios de mazo:", err);
            toast.error("Error al procesar la carta");
        } finally {
            setSubmitting(false);
        }
    };

    // Formatear enlace de Instagram
    const handleInstagramChange = (val) => {
        setInstagram(val);
        if (val.trim() && !igChatLink) {
            const cleanUser = val.replace('@', '').trim();
            setIgChatLink(`https://instagram.com/${cleanUser}`);
        }
    };

    // Formatear fecha legible
    const formatTime = (isoStr) => {
        if (!isoStr) return '';
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('es-ES', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return '';
        }
    };

    // Formatear solo hora y minuto
    const formatTimeOnly = (isoStr) => {
        if (!isoStr) return '';
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    };

    // Filtrar localmente las cartas por filtros superiores (origen y estado)
    const filteredCards = useMemo(() => {
        return cards.filter(card => {
            if (filterOrigin !== 'all' && card.origin !== filterOrigin) return false;
            if (filterStatus !== 'all' && card.result !== filterStatus) return false;
            return true;
        });
    }, [cards, filterOrigin, filterStatus]);

    const activeFilteredCard = filteredCards[currentIndex] || activeCard;


    return (
        <div className="h-screen overflow-y-auto custom-scrollbar bg-main pb-32">
            <div className="flex flex-col items-center justify-start p-6 md:p-12">
                <div className="w-full max-w-7xl space-y-8 py-4">
                    
                    {/* Fila Superior: Título y Filtros */}
                    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-base pb-6 gap-6 text-left">
                        <div className="space-y-1">
                            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none flex items-center gap-3">
                                <Layers className="text-primary" size={32} />
                                Gestión de Leads
                            </h1>
                            <p className="text-muted font-medium uppercase text-[10px] tracking-[0.2em]">
                                Panel Operativo Secuencial de Setters & Closers
                            </p>
                        </div>

                        {/* Sistema de Filtros */}
                        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                            <select 
                                value={filterOrigin}
                                onChange={(e) => setFilterOrigin(e.target.value)}
                                className="bg-[#1a1c23]/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-300 outline-none focus:border-primary/50 transition-all cursor-pointer"
                            >
                                <option value="all">Todos los Orígenes</option>
                                <option value="ManyChat">ManyChat</option>
                                <option value="Manual">Manual</option>
                            </select>

                            <select 
                                value={filterDateRange}
                                onChange={(e) => setFilterDateRange(e.target.value)}
                                className="bg-[#1a1c23]/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-300 outline-none focus:border-primary/50 transition-all cursor-pointer"
                            >
                                <option value="all">Todas las Fechas</option>
                                <option value="today">Hoy</option>
                                <option value="week">Últimos 7 días</option>
                                <option value="month">Últimos 30 días</option>
                            </select>

                            <select 
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="bg-[#1a1c23]/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-300 outline-none focus:border-primary/50 transition-all cursor-pointer"
                            >
                                <option value="all">Todos los Estados</option>
                                <option value="Pendiente">Pendiente</option>
                                <option value="Agendado">Agendado</option>
                                <option value="Asistió">Asistió</option>
                                <option value="No Show">No Show</option>
                                <option value="Cancelada">Cancelada</option>
                            </select>

                            <BuscadorGlobalDeck onSelectLead={handleSelectLead} role={user?.role} />

                            {isSearchedCard && (
                                <Button
                                    onClick={fetchQueue}
                                    variant="outline"
                                    className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 shrink-0"
                                    icon={ArrowLeft}
                                >
                                    Volver
                                </Button>
                            )}
                        </div>
                    </header>

                    {/* KPIs Superiores (5 Tarjetas) */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {[
                            { label: "Agendas Totales", value: stats?.kpis_top?.total_agendas || 0, icon: Layers, color: "text-[#1534ff] bg-[#1534ff]/10" },
                            { label: "Mis Agendas", value: stats?.kpis_top?.mis_agendas || 0, icon: User, color: "text-violet-400 bg-violet-500/10" },
                            { label: "Sin Asignar (Huérfanos)", value: stats?.kpis_top?.sin_assignar || stats?.kpis_top?.sin_asignar || 0, icon: UserPlus, color: "text-rose-400 bg-rose-500/10" },
                            { label: "Realizadas", value: `${stats?.kpis_top?.realizadas || 0} (${stats?.kpis_top?.pct_realizadas || 0}%)`, icon: CheckCircle, color: "text-emerald-400 bg-emerald-500/10" },
                            { label: "Cancelaciones / No Show", value: `${stats?.kpis_top?.canceladas || 0} (${stats?.kpis_top?.pct_canceladas || 0}%)`, icon: AlertTriangle, color: "text-amber-400 bg-amber-500/10" }
                        ].map((kpi, idx) => (
                            <motion.div
                                key={idx}
                                whileHover={{ y: -3 }}
                                className="bg-[#1a1c23]/95 border border-slate-800/80 rounded-3xl p-5 flex items-center gap-4 text-left shadow-xl hover:border-slate-700/50 transition-all duration-300 relative overflow-hidden group"
                            >
                                <div className={`p-3 rounded-2xl ${kpi.color} shrink-0 group-hover:scale-105 transition-transform`}>
                                    <kpi.icon size={20} />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">{kpi.label}</span>
                                    <span className="text-xl font-black text-white italic leading-none block">{kpi.value}</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Contenido Principal (3 Columnas Grid) */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
                        
                        {/* Columna 1: Leads de hoy sin asignar (Delgada) */}
                        <div className="lg:col-span-1 space-y-4 text-left bg-[#1a1c23]/95 border border-slate-800/80 rounded-[2.5rem] p-6 shadow-2xl">
                            <div className="border-b border-slate-800 pb-3 mb-4 flex justify-between items-center">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <UserPlus className="text-rose-400" size={14} />
                                    Huérfanos de Hoy
                                </h3>
                                <span className="text-[9px] font-black uppercase bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-lg">
                                    {unassignedLeads.length} Activos
                                </span>
                            </div>
                            
                            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                                {unassignedLeads.length === 0 ? (
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider text-center py-8">
                                        Sin leads huérfanos hoy.
                                    </p>
                                ) : (
                                    unassignedLeads.map(l => (
                                        <div 
                                            key={l.id} 
                                            onClick={() => handleSelectLead(l.id)}
                                            className="bg-black/30 border border-slate-800/50 p-3 rounded-2xl hover:bg-[#1534ff]/5 hover:border-[#1534ff]/20 transition-all cursor-pointer space-y-1 group"
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <h4 className="text-[11px] font-black text-white group-hover:text-primary transition-colors leading-tight truncate">
                                                    {l.lead_name}
                                                </h4>
                                                <span className="text-[8px] font-bold text-slate-500">
                                                    {formatTimeOnly(l.created_at)}
                                                </span>
                                            </div>

                                            <span className="text-[8px] font-black uppercase text-slate-500 group-hover:text-primary tracking-widest block">
                                                {l.origin} • Clic para asignar
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>

                            <button
                                onClick={() => navigate('/unattributed-leads')}
                                className="w-full mt-4 bg-white/5 hover:bg-white/10 text-slate-300 font-black text-[9px] uppercase tracking-widest py-3.5 rounded-2xl transition-all border border-white/5 flex items-center justify-center gap-1.5"
                            >
                                Gestionar Sin Anuncio
                                <ChevronRight size={10} />
                            </button>
                        </div>

                        {/* Columna 2: Mazo de Leads (Central, Ancha) */}
                        <div className="lg:col-span-2 flex flex-col items-center w-full space-y-4">
                            {filteredCards.length > 0 && (
                                <div className="flex justify-between items-center bg-[#1a1c23]/90 border border-slate-800/80 px-6 py-3 rounded-2xl w-full max-w-xl mx-auto shadow-xl">
                                    <button
                                        type="button"
                                        disabled={currentIndex === 0}
                                        onClick={() => setCurrentIndex(prev => prev - 1)}
                                        className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors flex items-center gap-1.5"
                                    >
                                        <ArrowLeft size={14} />
                                        Anterior
                                    </button>
                                    
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        Ficha {Math.min(currentIndex + 1, filteredCards.length)} de {filteredCards.length}
                                    </span>
                                    
                                    <button
                                        type="button"
                                        disabled={currentIndex >= filteredCards.length - 1}
                                        onClick={() => setCurrentIndex(prev => prev + 1)}
                                        className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors flex items-center gap-1.5"
                                    >
                                        Siguiente
                                        <ArrowRight size={14} />
                                    </button>
                                </div>
                            )}

                            <MazoCartas cards={filteredCards} currentIndex={currentIndex}>
                                {activeFilteredCard && (
                                    <div className="flex flex-col justify-between h-full space-y-6">
                                        {/* Cabecera de la carta */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-start gap-4">
                                                <span className="text-[10px] font-black uppercase bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-xl tracking-widest flex items-center gap-1.5">
                                                    <Clock size={12} />
                                                    {formatTime(activeFilteredCard.start_time)}
                                                </span>
                                                <span className="text-[10px] font-black uppercase bg-white/5 border border-white/10 text-slate-400 px-3 py-1.5 rounded-xl tracking-widest flex items-center gap-1.5">
                                                    <Tag size={12} />
                                                    {activeFilteredCard.origin || 'Sin Origen'}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1 text-left">
                                                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                                                        {activeFilteredCard.lead_name}
                                                    </h2>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                        Lead ID: #{activeFilteredCard.id} • Estado: {activeFilteredCard.result || 'Pendiente'}
                                                    </p>
                                                </div>
                                                <button className="p-2 text-slate-500 hover:text-white transition-colors">
                                                    <MoreVertical size={18} />
                                                </button>
                                            </div>

                                            {/* Info de Asignación y Meet */}
                                            <div className="grid grid-cols-2 gap-4 bg-black/20 border border-slate-800/50 p-4 rounded-3xl text-left text-xs font-bold">
                                                <div className="space-y-1">
                                                    <span className="text-[9px] uppercase tracking-widest text-slate-500 block">Closer Asignado</span>
                                                    <span className="text-slate-300 flex items-center gap-1.5">
                                                        <User size={14} className="text-primary" />
                                                        {activeFilteredCard.closer_name || 'Sin Asignar'}
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[9px] uppercase tracking-widest text-slate-500 block">Fecha de Meet</span>
                                                    <span className="text-slate-300 flex items-center gap-1.5">
                                                        <Calendar size={14} className="text-primary" />
                                                        {formatTime(activeFilteredCard.start_time)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Campos del Formulario */}
                                        <form onSubmit={handleSubmit} className="space-y-5 flex-1 overflow-y-auto pr-1 py-1 custom-scrollbar text-left">
                                            
                                            {/* SECCIÓN SETTER DATA */}
                                            <div className="space-y-4 border-b border-slate-800 pb-5">
                                                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.25em] flex items-center gap-2">
                                                    <Instagram size={14} />
                                                    Información de Setting
                                                </h4>
                                                
                                                {/* Mostrar link chat e inputs dependiendo de rol o compartidos */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Instagram Usuario</label>
                                                        <input 
                                                            type="text"
                                                            placeholder="@instagram"
                                                            value={instagram}
                                                            onChange={(e) => handleInstagramChange(e.target.value)}
                                                            disabled={user?.role !== 'setter' && user?.role !== 'admin'}
                                                            className="w-full bg-black/40 border border-slate-800 rounded-2xl py-3 px-4 text-white text-xs font-bold outline-none focus:border-primary/50 transition-all disabled:opacity-50"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Palabra Clave</label>
                                                        <input 
                                                            type="text"
                                                            placeholder="Ej: EVENTO"
                                                            value={keyword}
                                                            onChange={(e) => setKeyword(e.target.value)}
                                                            disabled={user?.role !== 'setter' && user?.role !== 'admin'}
                                                            className="w-full bg-black/40 border border-slate-800 rounded-2xl py-3 px-4 text-white text-xs font-bold outline-none focus:border-primary/50 transition-all disabled:opacity-50"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block font-bold">Enlace a Conversación IG</label>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="url"
                                                            placeholder="https://instagram.com/..."
                                                            value={igChatLink}
                                                            onChange={(e) => setIgChatLink(e.target.value)}
                                                            disabled={user?.role !== 'setter' && user?.role !== 'admin'}
                                                            className="flex-1 bg-black/40 border border-slate-800 rounded-2xl py-3 px-4 text-white text-xs font-bold outline-none focus:border-primary/50 transition-all disabled:opacity-50"
                                                        />
                                                        {igChatLink && (
                                                            <a href={igChatLink} target="_blank" rel="noopener noreferrer" className="bg-[#1534ff]/10 hover:bg-[#1534ff]/20 text-[#1534ff] border border-[#1534ff]/20 px-4 rounded-2xl flex items-center justify-center transition-all">
                                                                <ExternalLink size={14} />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Instrucciones del Setter</label>
                                                    <textarea 
                                                        rows={2}
                                                        placeholder="Notas del setter..."
                                                        value={setterNotes}
                                                        onChange={(e) => setSetterNotes(e.target.value)}
                                                        disabled={user?.role !== 'setter' && user?.role !== 'admin'}
                                                        className="w-full bg-black/40 border border-slate-800 rounded-2xl py-3 px-4 text-white text-xs font-bold outline-none focus:border-primary/50 transition-all resize-none disabled:opacity-50"
                                                    />
                                                </div>
                                            </div>

                                            {/* SECCIÓN CLOSER DATA */}
                                            <div className="space-y-4 pt-1">
                                                <h4 className="text-[10px] font-black text-violet-400 uppercase tracking-[0.25em] flex items-center gap-2">
                                                    <Video size={14} />
                                                    Información de Closing
                                                </h4>

                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Enlace a Video / Google Meet</label>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="url"
                                                            placeholder="https://meet.google.com/..."
                                                            value={linkedCall}
                                                            onChange={(e) => setLinkedCall(e.target.value)}
                                                            disabled={user?.role !== 'closer' && user?.role !== 'admin'}
                                                            className="flex-1 bg-black/40 border border-slate-800 rounded-2xl py-3 px-4 text-white text-xs font-bold outline-none focus:border-primary/50 transition-all disabled:opacity-50"
                                                        />
                                                        {linkedCall && (
                                                            <a href={linkedCall} target="_blank" rel="noopener noreferrer" className="bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 px-4 rounded-2xl flex items-center justify-center transition-all">
                                                                <ExternalLink size={14} />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Notas del Closer (Seguimiento / Cierre)</label>
                                                    <textarea 
                                                        rows={2}
                                                        placeholder="Detalles sobre objeciones, monto cobrado, señas, etc..."
                                                        value={closerNotes}
                                                        onChange={(e) => setCloserNotes(e.target.value)}
                                                        disabled={user?.role !== 'closer' && user?.role !== 'admin'}
                                                        className="w-full bg-black/40 border border-slate-800 rounded-2xl py-3 px-4 text-white text-xs font-bold outline-none focus:border-primary/50 transition-all resize-none disabled:opacity-50"
                                                    />
                                                </div>

                                                {/* Estado / Resultado dependiente del rol */}
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Estado de Cierre / Agenda</label>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {(user?.role === 'closer' ? [
                                                            { key: 'Pendiente', color: 'amber' },
                                                            { key: 'Asistió', color: 'emerald' },
                                                            { key: 'No Show', color: 'rose' }
                                                        ] : [
                                                            { key: 'Entrante', color: 'slate' },
                                                            { key: 'Contactado', color: 'blue' },
                                                            { key: 'Agendado', color: 'emerald' }
                                                        ]).map(opt => {
                                                            const isActive = result === opt.key;
                                                            const colorMap = {
                                                                slate: isActive ? 'bg-slate-500/10 border-slate-500/50 text-slate-300' : 'hover:bg-slate-500/5 border-slate-800 text-slate-500',
                                                                blue: isActive ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'hover:bg-blue-500/5 border-slate-800 text-slate-500',
                                                                amber: isActive ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'hover:bg-amber-500/5 border-slate-800 text-slate-500',
                                                                emerald: isActive ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'hover:bg-emerald-500/5 border-slate-800 text-slate-500',
                                                                rose: isActive ? 'bg-rose-500/10 border-rose-500/50 text-rose-400' : 'hover:bg-rose-500/5 border-slate-800 text-slate-500'
                                                            };
                                                            return (
                                                                <button
                                                                    key={opt.key}
                                                                    type="button"
                                                                    onClick={() => setResult(opt.key)}
                                                                    className={`py-3 rounded-2xl border text-[9px] font-black uppercase tracking-wider transition-all ${colorMap[opt.color]}`}
                                                                >
                                                                    {opt.key}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </form>

                                        {/* Botón de envío */}
                                        <button
                                            type="button"
                                            onClick={handleSubmit}
                                            disabled={submitting}
                                            className="w-full bg-[#1534ff] hover:bg-[#1534ff]/90 text-white font-black text-[10px] uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 group disabled:opacity-50 shrink-0"
                                        >
                                            {submitting ? (
                                                <Loader2 className="animate-spin" size={14} />
                                            ) : (
                                                <>
                                                    Guardar y Confirmar Progreso
                                                    <Check size={14} className="group-hover:scale-110 transition-transform" />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </MazoCartas>
                        </div>

                        {/* Columna 3: Historial y Gráfica Circular (De la derecha) */}
                        <div className="lg:col-span-1 space-y-6 text-left">
                            
                            {/* Historial de Eventos (Timeline) */}
                            <div className="bg-[#1a1c23]/95 border border-slate-800/80 rounded-[2.5rem] p-6 shadow-2xl space-y-5">
                                <div className="border-b border-slate-800 pb-3 mb-2">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Activity className="text-violet-400" size={14} />
                                        Historial de Eventos
                                    </h3>
                                </div>

                                <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                                    {eventHistory.length === 0 ? (
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider text-center py-6">
                                            Sin acciones registradas.
                                        </p>
                                    ) : (
                                        eventHistory.map((log, idx) => (
                                            <div key={log.id || idx} className="flex gap-3 relative group">
                                                {idx < eventHistory.length - 1 && (
                                                    <div className="w-px bg-slate-800 absolute top-5 bottom-0 left-2.5 z-0" />
                                                )}
                                                <div className="w-5 h-5 rounded-full bg-slate-800/85 border border-slate-700/50 flex items-center justify-center text-[8px] font-black text-primary shrink-0 relative z-10 group-hover:bg-[#1534ff]/10 group-hover:border-[#1534ff]/25 transition-colors">
                                                    •
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] font-black text-slate-400 leading-tight">
                                                        {log.username} ({log.user_role})
                                                    </p>
                                                    <p className="text-[11px] text-slate-300 font-medium leading-normal">
                                                        {log.description}
                                                    </p>
                                                    <span className="text-[7.5px] font-bold text-slate-500 block">
                                                        {formatTime(log.created_at)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {activeCard && (
                                    <button
                                        onClick={() => {
                                            fetchAllEventLogs(activeCard.id);
                                            setShowAllEventsModal(true);
                                        }}
                                        className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-black text-[9px] uppercase tracking-widest py-3.5 rounded-2xl transition-all border border-white/5 flex items-center justify-center gap-1"
                                    >
                                        Ver Historial Completo
                                        <ChevronRight size={10} />
                                    </button>
                                )}
                            </div>

                            {/* Gráfica Circular de Estados */}
                            <div className="bg-[#1a1c23]/95 border border-slate-800/80 rounded-[2.5rem] p-6 shadow-2xl flex flex-col justify-start">
                                <div className="border-b border-slate-800 pb-3 mb-4">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <TrendingUp className="text-emerald-400" size={14} />
                                        Distribución de Estados
                                    </h3>
                                </div>

                                <div className="h-[220px] w-full flex items-center justify-center relative">
                                    {(stats?.chart_data || []).length === 0 ? (
                                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider text-center">Sin datos de gráfica</div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={stats?.chart_data || []}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={55}
                                                    outerRadius={75}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                >
                                                    {(stats?.chart_data || []).map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: '#101117', border: '1px solid #1e293b', borderRadius: '12px' }}
                                                    itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                                                    labelStyle={{ display: 'none' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>

                                {/* Leyenda Personalizada Compacta */}
                                <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-800">
                                    {(stats?.chart_data || []).map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-left">
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                            <div className="space-y-px truncate">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block truncate">{item.name}</span>
                                                <span className="text-xs font-black text-white leading-none block">{item.value} ({item.percentage}%)</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                            </div>
                        </div>

                    </div>

                    {/* Fila de KPIs Inferiores (Footer - 5 Tarjetas) */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 border-t border-slate-800 pt-8 text-left">
                        {[
                            { label: "Llamadas Realizadas Hoy", value: stats?.kpis_bottom?.llamadas_hoy || 0, icon: PhoneCall, color: "text-blue-400 bg-blue-500/10" },
                            { label: "Agendas Confirmadas Hoy", value: stats?.kpis_bottom?.confirmadas_hoy || 0, icon: Calendar, color: "text-emerald-400 bg-emerald-500/10" },
                            { label: "Cancelaciones de Hoy", value: stats?.kpis_bottom?.cancelaciones_hoy || 0, icon: AlertTriangle, color: "text-rose-400 bg-rose-500/10" },
                            { label: "Reprogramaciones de Hoy", value: stats?.kpis_bottom?.reprogramaciones_hoy || 0, icon: Clock, color: "text-amber-400 bg-amber-500/10" },
                            { label: "Leads Calificados Hoy", value: stats?.kpis_bottom?.calificados_hoy || 0, icon: CheckCircle, color: "text-violet-400 bg-violet-500/10" }
                        ].map((kpi, idx) => (
                            <motion.div
                                key={idx}
                                whileHover={{ y: 2 }}
                                className="bg-[#1a1c23]/80 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-lg relative overflow-hidden"
                            >
                                <div className={`p-2.5 rounded-xl ${kpi.color} shrink-0`}>
                                    <kpi.icon size={16} />
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">{kpi.label}</span>
                                    <span className="text-md font-black text-white italic leading-none block">{kpi.value}</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                </div>
            </div>

            {/* Modal de Historial Completo */}
            <AnimatePresence>
                {showAllEventsModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAllEventsModal(false)}
                            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 pointer-events-auto"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, x: '-50%', y: '-50%' }}
                            animate={{ scale: 1, opacity: 1, x: '-50%', y: '-50%' }}
                            exit={{ scale: 0.95, opacity: 0, x: '-50%', y: '-50%' }}
                            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-[#13141a]/95 backdrop-blur-xl border border-slate-800 rounded-[2rem] z-[60] p-6 shadow-2xl pointer-events-auto text-left"
                        >
                            <div className="flex justify-between items-center border-b border-slate-800 pb-3.5 mb-5">
                                <h3 className="text-md font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <Activity className="text-violet-400" size={16} />
                                    Bitácora de Eventos Completa
                                </h3>
                                <button
                                    onClick={() => setShowAllEventsModal(false)}
                                    className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                                {loadingEvents ? (
                                    <div className="flex justify-center items-center py-12">
                                        <Loader2 className="animate-spin text-primary" size={24} />
                                    </div>
                                ) : allEvents.length === 0 ? (
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center py-12">Sin acciones.</p>
                                ) : (
                                    allEvents.map((log, idx) => (
                                        <div key={log.id || idx} className="flex gap-4 relative">
                                            {idx < allEvents.length - 1 && (
                                                <div className="w-px bg-slate-800 absolute top-5 bottom-0 left-2.5 z-0" />
                                            )}
                                            <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[8px] font-black text-primary shrink-0 relative z-10">
                                                •
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-[10px] font-black text-slate-400 leading-tight">
                                                    {log.username} ({log.user_role})
                                                </p>
                                                <p className="text-[11px] text-slate-200 font-medium">
                                                    {log.description}
                                                </p>
                                                <span className="text-[8px] font-bold text-slate-500 block">
                                                    {formatTime(log.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LeadsManagementPage;
