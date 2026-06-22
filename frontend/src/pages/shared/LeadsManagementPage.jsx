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
    ChevronRight,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    PhoneCall
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import BuscadorGlobalDeck from '../../components/deck/BuscadorGlobalDeck';
import Button from '../../components/ui/Button';
import LeadRoadmapDetail from '../../components/leads/LeadRoadmapDetail';

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

    // Estados para collapsibles
    const [isQueueOpen, setIsQueueOpen] = useState(true);
    const [isUnassignedOpen, setIsUnassignedOpen] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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

    // Selección masiva y keywords de anuncios disponibles
    const [selectedApptIds, setSelectedApptIds] = useState(new Set());
    const [availableKeywords, setAvailableKeywords] = useState([]);

    // Datos Adicionales (KPIs, Sin asignar, Eventos, Gráfica)
    const [stats, setStats] = useState({ kpis_top: {}, kpis_bottom: {}, chart_data: [] });
    const [unassignedLeads, setUnassignedLeads] = useState([]);
    const [eventHistory, setEventHistory] = useState([]);
    const [showAllEventsModal, setShowAllEventsModal] = useState(false);
    const [allEvents, setAllEvents] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(false);

    // Cliente seleccionado directamente (sin agenda, solo form_data)
    const [selectedClientRoadmap, setSelectedClientRoadmap] = useState(null);

    const step = searchParams.get('step') || (user?.role === 'setter' ? 'entrantes' : '');

    // Cargar cola de cartas filtrada
    const fetchQueue = async () => {
        setLoading(true);
        try {
            const currentStep = searchParams.get('step') || (user?.role === 'setter' ? 'entrantes' : '');
            const res = await api.get(`/${rolePath}/deck?date_range=${filterDateRange}&step=${currentStep}`);
            setCards(res.data || []);
            setCurrentIndex(0);
            setIsSearchedCard(false);
            setSelectedApptIds(new Set()); // Limpiar selección al cambiar de cola
        } catch (err) {
            console.error("Error al cargar mazo:", err);
            toast.error("Error al cargar la cola de leads");
        } finally {
            setLoading(false);
        }
    };

    // Cargar anuncios disponibles
    const fetchAvailableKeywords = async () => {
        try {
            const res = await api.get('/setter/links');
            const events = res.data?.events || [];
            setAvailableKeywords(events);
        } catch (err) {
            console.error("Error al cargar anuncios disponibles:", err);
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

    // Cargar leads sin asignar
    const fetchUnassignedToday = async () => {
        try {
            const res = await api.get(`/${rolePath}/deck/unassigned-today?date_range=${filterDateRange}`);
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

    // Redirección por defecto si falta step para el setter
    useEffect(() => {
        if (user?.role === 'setter' && !searchParams.get('step')) {
            setSearchParams({ step: 'entrantes' });
        }
    }, [searchParams, user, setSearchParams]);

    useEffect(() => {
        fetchStats();
        fetchUnassignedToday();
        if (user?.role === 'setter') {
            fetchAvailableKeywords();
        }
        if (apptIdParam) {
            handleSelectLead(apptIdParam);
        } else {
            fetchQueue();
        }
    }, [apptIdParam, filterDateRange, step, user?.role]);

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

    // Seleccionar lead de la cola filtrada
    const handleSelectFilteredCard = (card) => {
        const idx = cards.findIndex(c => c.id === card.id);
        if (idx !== -1) {
            setCurrentIndex(idx);
        }
    };

    // Seleccionar cliente directo desde búsqueda (formulario n8n)
    const handleSelectClient = (client) => {
        setSelectedClientRoadmap(client);
        setIsSearchedCard(true);
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

    const toggleSelectLead = (apptId, e) => {
        e.stopPropagation();
        setSelectedApptIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(apptId)) {
                newSet.delete(apptId);
            } else {
                newSet.add(apptId);
            }
            return newSet;
        });
    };

    const toggleSelectAllLeads = () => {
        setSelectedApptIds(prev => {
            if (prev.size === filteredCards.length) {
                return new Set();
            } else {
                return new Set(filteredCards.map(c => c.id));
            }
        });
    };

    const handleBulkUpdate = async (newResult, newKeyword) => {
        if (selectedApptIds.size === 0) return;
        setSubmitting(true);
        try {
            const payload = {
                appt_ids: Array.from(selectedApptIds),
                result: newResult || undefined,
                keyword: newKeyword || undefined
            };
            await api.post(`/setter/deck/bulk-update`, payload);
            toast.success("Leads actualizados correctamente");
            setSelectedApptIds(new Set());
            fetchQueue();
            fetchStats();
        } catch (err) {
            console.error("Error al actualizar en lote:", err);
            toast.error("Error al procesar la actualización en masa");
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
                                <option value="Cerrada">Cerrada</option>
                            </select>

                            <BuscadorGlobalDeck
                                onSelectLead={handleSelectLead}
                                onSelectClient={handleSelectClient}
                                role={user?.role}
                            />

                            {(isSearchedCard) && (
                                <Button
                                    onClick={() => { fetchQueue(); setSelectedClientRoadmap(null); }}
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
                            { label: "Sin asignar", value: stats?.kpis_top?.sin_assignar || stats?.kpis_top?.sin_asignar || 0, icon: UserPlus, color: "text-rose-400 bg-rose-500/10" },
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
                        
                        {/* Columna 1: Panel de Control de Leads (Cola y Sin Asignar) */}
                        <div className={`lg:col-span-1 space-y-6 transition-all duration-300 ${isSidebarOpen ? 'block' : 'hidden'}`}>
                                     {/* Bloque 1: Mi Cola de Leads */}
                            <div className="space-y-4 text-left bg-[#1a1c23]/95 border border-slate-800/80 rounded-[2.5rem] p-6 shadow-2xl">
                                <div 
                                    className={`border-b border-slate-800 pb-3 flex justify-between items-center cursor-pointer group select-none transition-colors ${isQueueOpen ? 'mb-4' : ''}`}
                                    onClick={() => setIsQueueOpen(!isQueueOpen)}
                                >
                                    <h3 className="text-xs font-black text-slate-400 group-hover:text-primary uppercase tracking-widest flex items-center gap-2 transition-colors">
                                        <Layers className="text-primary" size={14} />
                                        Mi Cola
                                        {isQueueOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                                    </h3>
                                    <span className="text-[9px] font-black uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-lg">
                                        {filteredCards.length} Leads
                                    </span>
                                </div>
                                
                                {isQueueOpen && selectedApptIds.size > 0 && (
                                    <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl mb-3 space-y-2 text-left animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-black uppercase text-slate-400">
                                                {selectedApptIds.size} seleccionados
                                            </span>
                                            <button 
                                                type="button" 
                                                onClick={() => setSelectedApptIds(new Set())}
                                                className="text-[9px] font-black text-rose-400 hover:underline uppercase cursor-pointer"
                                            >
                                                Desmarcar todos
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {step === 'entrantes' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleBulkUpdate('Contactado')}
                                                    className="flex-1 py-1.5 bg-[#1534ff] hover:bg-blue-600 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer text-center font-bold"
                                                >
                                                    ✓ Contactado
                                                </button>
                                            )}
                                            {step === 'cualificacion' && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleBulkUpdate('Cualificado')}
                                                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer text-center font-bold"
                                                    >
                                                        ✓ Cualificar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleBulkUpdate('Descualificado')}
                                                        className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer text-center font-bold"
                                                    >
                                                        ✕ Descualificar
                                                    </button>
                                                </>
                                            )}
                                            {step === 'link-agenda' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleBulkUpdate('Agendado')}
                                                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer text-center font-bold"
                                                >
                                                    Link Enviado
                                                </button>
                                            )}
                                        </div>
                                        {/* Selector de Anuncio Masivo */}
                                        {availableKeywords.length > 0 && (
                                            <div className="space-y-1 pt-1.5 border-t border-slate-800/60">
                                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Asociar Anuncio en Lote</label>
                                                <select
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            handleBulkUpdate(null, e.target.value);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[9px] font-black text-slate-350 cursor-pointer outline-none focus:ring-1 focus:ring-primary/50 font-bold"
                                                >
                                                    <option value="">Seleccionar anuncio...</option>
                                                    {availableKeywords.map(k => (
                                                        <option key={k.id} value={k.slug}>{k.name} ({k.slug})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <AnimatePresence initial={false}>
                                    {isQueueOpen && (
                                        <motion.div
                                            key="queue-content"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                                                {filteredCards.length === 0 ? (
                                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider text-center py-8">
                                                        Tu cola está vacía
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {user?.role === 'setter' && filteredCards.length > 1 && (
                                                            <div className="flex items-center gap-2 px-1 py-1 border-b border-slate-800/40 select-none">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedApptIds.size === filteredCards.length}
                                                                    onChange={toggleSelectAllLeads}
                                                                    className="rounded bg-slate-950 border-slate-800 text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer h-3.5 w-3.5"
                                                                />
                                                                <span 
                                                                    className="text-[9px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white transition-colors font-bold" 
                                                                    onClick={toggleSelectAllLeads}
                                                                >
                                                                    Seleccionar Todos
                                                                </span>
                                                            </div>
                                                        )}
                                                        {filteredCards.map((l) => {
                                                            const isActive = activeFilteredCard?.id === l.id;
                                                            const isSelected = selectedApptIds.has(l.id);
                                                            return (
                                                                <div 
                                                                    key={l.id} 
                                                                    onClick={() => handleSelectFilteredCard(l)}
                                                                    className={`p-3 rounded-2xl border transition-all cursor-pointer text-left flex items-start gap-2.5 ${
                                                                        isActive 
                                                                            ? 'bg-[#1534ff]/10 border-[#1534ff]/40 shadow-[0_0_15px_rgba(21,52,255,0.15)]' 
                                                                            : 'bg-black/30 border-slate-800/50 hover:bg-white/5 hover:border-slate-700/50'
                                                                    }`}
                                                                >
                                                                    {user?.role === 'setter' && (
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isSelected}
                                                                            onChange={(e) => toggleSelectLead(l.id, e)}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="rounded bg-slate-950 border-slate-800 text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer mt-0.5 h-3.5 w-3.5"
                                                                        />
                                                                    )}
                                                                    <div className="flex-1 min-w-0 space-y-1">
                                                                        <div className="flex justify-between items-start gap-2">
                                                                            <h4 className={`text-[11px] font-black leading-tight truncate ${isActive ? 'text-primary' : 'text-white group-hover:text-primary transition-colors font-bold'}`}>
                                                                                {l.lead_name || l.instagram || 'Sin Nombre'}
                                                                            </h4>
                                                                            <span className="text-[8px] font-bold text-slate-500 shrink-0">
                                                                                {formatTimeOnly(l.created_at)}
                                                                            </span>
                                                                        </div>
    
                                                                        <div className="flex justify-between items-center gap-2">
                                                                            <span className="text-[8px] font-black uppercase text-slate-500 group-hover:text-slate-400 tracking-widest truncate">
                                                                                {l.origin} {l.keyword ? `• ${l.keyword}` : ''}
                                                                            </span>
                                                                            
                                                                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${
                                                                                l.result === 'Agendado' ? 'bg-emerald-500/10 text-emerald-400' :
                                                                                l.result === 'Asistió' ? 'bg-violet-500/10 text-violet-400' :
                                                                                l.result === 'No Show' ? 'bg-rose-500/10 text-rose-400' :
                                                                                l.result === 'Cancelada' ? 'bg-amber-500/10 text-amber-400' :
                                                                                l.result === 'Cerrada' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                                                                'bg-slate-500/10 text-slate-400'
                                                                            }`}>
                                                                                {l.result || 'Pendiente'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Bloque 2: Leads Sin Asignar */}
                            <div className="space-y-4 text-left bg-[#1a1c23]/95 border border-slate-800/80 rounded-[2.5rem] p-6 shadow-2xl">
                                <div 
                                    className={`border-b border-slate-800 pb-3 flex justify-between items-center cursor-pointer group select-none transition-colors ${isUnassignedOpen ? 'mb-4' : ''}`}
                                    onClick={() => setIsUnassignedOpen(!isUnassignedOpen)}
                                >
                                    <h3 className="text-xs font-black text-slate-400 group-hover:text-rose-400 uppercase tracking-widest flex items-center gap-2 transition-colors">
                                        <UserPlus className="text-rose-400" size={14} />
                                        Sin asignar
                                        {isUnassignedOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                                    </h3>
                                    <span className="text-[9px] font-black uppercase bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-lg">
                                        {unassignedLeads.length} Activos
                                    </span>
                                </div>
                                
                                <AnimatePresence initial={false}>
                                    {isUnassignedOpen && (
                                        <motion.div
                                            key="unassigned-content"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                                                {unassignedLeads.length === 0 ? (
                                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider text-center py-8">
                                                        Sin leads sin asignar
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
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <button
                                    onClick={() => navigate('/unattributed-leads')}
                                    className="w-full mt-4 bg-white/5 hover:bg-white/10 text-slate-300 font-black text-[9px] uppercase tracking-widest py-3.5 rounded-2xl transition-all border border-white/5 flex items-center justify-center gap-1.5"
                                >
                                    Gestionar Sin Anuncio
                                    <ChevronRight size={10} />
                                </button>
                            </div>

                        </div>

                        {/* Columna 2: Ficha del Lead (Lead Roadmap Detalle) */}
                        <div className={`${isSidebarOpen ? 'lg:col-span-3' : 'lg:col-span-4'} space-y-6 transition-all duration-300 relative`}>
                            
                            {/* Botón Flotante para Colapsar/Expandir Menú */}
                            <button
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="absolute -top-12 -left-2 p-2 bg-[#1a1c23]/80 hover:bg-white/10 backdrop-blur-md border border-slate-800 rounded-xl text-slate-400 hover:text-white shadow-xl transition-all z-10 hidden lg:flex items-center gap-2 group"
                                title={isSidebarOpen ? "Ocultar panel izquierdo" : "Mostrar panel izquierdo"}
                            >
                                {isSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                                {!isSidebarOpen && <span className="text-[10px] font-black uppercase tracking-widest px-1">Mostrar Cola</span>}
                            </button>

                            {selectedClientRoadmap ? (
                                <LeadRoadmapDetail
                                    clientId={selectedClientRoadmap.client_id}
                                    availableKeywords={availableKeywords}
                                    userRole={user?.role}
                                    appointmentId={activeFilteredCard?.id}
                                    onUpdate={() => {}}
                                />
                            ) : activeFilteredCard ? (
                                <LeadRoadmapDetail 
                                    instagram={instagram || activeFilteredCard.instagram}
                                    email={activeFilteredCard.email}
                                    phone={activeFilteredCard.phone}
                                    availableKeywords={availableKeywords}
                                    userRole={user?.role}
                                    appointmentId={activeFilteredCard.id}
                                    onUpdate={() => {
                                        fetchQueue();
                                        if (activeFilteredCard.id) {
                                            fetchEventLogs(activeFilteredCard.id);
                                        }
                                    }}
                                />
                            ) : (
                                <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-[#1a1c23]/95 border border-slate-800/80 rounded-[2.5rem] shadow-2xl">
                                    <Layers className="text-slate-655 mb-4 animate-pulse" size={48} />
                                    <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">Selecciona un Lead</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Usa la sección de sin asignar o el buscador superior para iniciar</p>
                                </div>
                            )}
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
