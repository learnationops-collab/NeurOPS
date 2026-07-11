import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
    Users, Layers, Activity, ClipboardList, BarChart3,
    Search, Check, X, Link2, Copy, ChevronRight, Loader2,
    Instagram, ExternalLink, Tag, CalendarDays, MessageSquare, ChevronDown
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import LeadRoadmapDetail from '../../components/leads/LeadRoadmapDetail';
import SetterCualificacionModal from '../../components/modals/SetterCualificacionModal';

const SetterWorkflowPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    
    const activeStep = searchParams.get('step') || 'cualificacion';

    // Leads y carga
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [submittingBulk, setSubmittingBulk] = useState(false);
    
    // Selección masiva y filtros locales
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [availableKeywords, setAvailableKeywords] = useState([]);
    
    // Lead seleccionado para el visor de la derecha
    const [selectedLead, setSelectedLead] = useState(null);

    // Filtros de fecha y descalificados para paso cualificacion
    const [dateRange, setDateRange] = useState('today');
    const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
    const [showDisqualified, setShowDisqualified] = useState(false);
    const [stats, setStats] = useState({ qualified_today: 0, unassigned_today: 0, no_response_today: 0 });
    const [showCalendar, setShowCalendar] = useState(false);

    // Cargar leads de la cola activa
    const fetchLeads = async () => {
        setLoading(true);
        try {
            let url = `/setter/deck?step=${activeStep}`;
            if (activeStep === 'cualificacion') {
                url += `&date_range=${dateRange}&show_disqualified=${showDisqualified}`;
                if (dateRange === 'custom' && customDate) {
                    url += `&date=${customDate}`;
                }
            }
            const res = await api.get(url);
            setLeads(res.data || []);
            setSelectedIds(new Set());
            // Si el lead actualmente seleccionado ya no está en la cola, deseleccionarlo
            if (selectedLead && !res.data.some(l => l.id === selectedLead.id)) {
                setSelectedLead(null);
            }
        } catch (err) {
            console.error("Error al cargar leads del paso:", err);
            toast.error("Error al cargar la cola de trabajo");
        } finally {
            setLoading(false);
        }
    };

    const fetchCualificacionStats = async () => {
        try {
            const res = await api.get('/setter/deck/stats/cualificacion');
            setStats(res.data || { qualified_today: 0, unassigned_today: 0, no_response_today: 0 });
        } catch (err) {
            console.error("Error al cargar estadísticas de cualificación:", err);
        }
    };

    // Cargar anuncios (keywords) disponibles
    const fetchKeywords = async () => {
        try {
            const res = await api.get('/setter/links');
            setAvailableKeywords(res.data?.events || []);
        } catch (err) {
            console.error("Error al cargar anuncios:", err);
        }
    };

    useEffect(() => {
        fetchLeads();
        fetchKeywords();
        if (activeStep === 'cualificacion') {
            fetchCualificacionStats();
        }
    }, [activeStep, dateRange, customDate, showDisqualified]);

    // Filtrar localmente por búsqueda
    const filteredLeads = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return leads;
        return leads.filter(l => 
            (l.lead_name && l.lead_name.toLowerCase().includes(query)) ||
            (l.instagram && l.instagram.toLowerCase().includes(query)) ||
            (l.email && l.email.toLowerCase().includes(query))
        );
    }, [leads, searchQuery]);



    // Procesar acción individual (de un solo clic)
    const handleQuickAction = async (leadId, nextResult, e) => {
        if (e) e.stopPropagation();
        setProcessingId(leadId);
        try {
            if (activeStep === 'cualificacion') {
                if (nextResult === 'Cualificado') {
                    await api.post(`/setter/deck/confirm-qualified/${leadId}`);
                    toast.success("Lead confirmado y pasado a Link de Agenda");
                } else if (nextResult === 'Descualificado') {
                    await api.post(`/setter/deck/disqualify/${leadId}`);
                    toast.success("Lead descalificado correctamente");
                }
            } else {
                await api.post(`/setter/deck/${leadId}`, { result: nextResult });
                toast.success("Lead actualizado correctamente");
            }
            
            // Animación de salida optimizada
            setLeads(prev => prev.filter(l => l.id !== leadId));
            if (selectedLead?.id === leadId) {
                setSelectedLead(null);
            }
            if (activeStep === 'cualificacion') {
                fetchCualificacionStats();
            }
        } catch (err) {
            console.error("Error al procesar acción rápida:", err);
            toast.error("Error al actualizar estado del lead");
        } finally {
            setProcessingId(null);
        }
    };

    // Actualizar anuncio de forma individual
    const handleUpdateKeyword = async (leadId, newKeyword, e) => {
        if (e) e.stopPropagation();
        try {
            await api.post(`/setter/deck/${leadId}`, { keyword: newKeyword });
            toast.success("Anuncio asignado");
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, keyword: newKeyword } : l));
            if (selectedLead?.id === leadId) {
                setSelectedLead(prev => ({ ...prev, keyword: newKeyword }));
            }
        } catch (err) {
            console.error("Error al actualizar anuncio:", err);
            toast.error("Error al actualizar el anuncio");
        }
    };

    // Actualización masiva
    const handleBulkUpdate = async (bulkResult, bulkKeyword) => {
        if (selectedIds.size === 0) return;
        setSubmittingBulk(true);
        try {
            if (activeStep === 'cualificacion') {
                const action = bulkResult === 'Cualificado' ? 'confirm' : 'disqualify';
                await api.post(`/setter/deck/bulk-update-cualificacion`, {
                    answer_ids: Array.from(selectedIds),
                    action: action
                });
                toast.success("Leads actualizados masivamente");
                fetchLeads();
                fetchCualificacionStats();
            } else {
                const payload = {
                    appt_ids: Array.from(selectedIds),
                    result: bulkResult || undefined,
                    keyword: bulkKeyword || undefined
                };
                await api.post(`/setter/deck/bulk-update`, payload);
                toast.success("Leads actualizados masivamente");
                fetchLeads();
            }
        } catch (err) {
            console.error("Error en lote:", err);
            toast.error("Error al procesar en masa");
        } finally {
            setSubmittingBulk(false);
        }
    };

    // Copiar enlace de booking y marcar como enviado
    const handleCopyLink = (lead, e) => {
        if (e) e.stopPropagation();
        // Generar enlace o buscar el slug asignado
        const base = window.location.origin;
        const slug = lead.keyword || 'lead';
        const link = `${base}/book/${slug}`;
        
        navigator.clipboard.writeText(link).then(() => {
            toast.success("Enlace de booking copiado al portapapeles");
        }).catch(() => {
            toast.error("No se pudo copiar el enlace de forma automática");
        });
    };

    const handleSaveAndNext = (currentLeadId) => {
        // Buscar el índice del lead actual en la lista filtrada
        const currentIndex = filteredLeads.findIndex(l => l.id === currentLeadId);
        
        // Recargar los leads de fondo
        fetchLeads();
        fetchCualificacionStats();

        if (currentIndex !== -1 && currentIndex < filteredLeads.length - 1) {
            // Seleccionar el siguiente lead disponible
            setSelectedLead(filteredLeads[currentIndex + 1]);
        } else if (filteredLeads.length > 1) {
            // Si era el último pero quedan otros leads en la lista, seleccionar el primero disponible
            const remainingLeads = filteredLeads.filter(l => l.id !== currentLeadId);
            if (remainingLeads.length > 0) {
                setSelectedLead(remainingLeads[0]);
            } else {
                setSelectedLead(null);
            }
        } else {
            // Si no quedan leads, cerrar el modal
            setSelectedLead(null);
        }
    };

    // Selección de elementos
    const toggleSelect = (id, e) => {
        if (e) e.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredLeads.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredLeads.map(l => l.id)));
        }
    };



    return (
        <div className="h-screen overflow-y-auto bg-slate-950 text-slate-100 flex flex-col custom-scrollbar pb-32">
            
            {/* Header del Espacio de Trabajo */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-white italic uppercase tracking-tight flex items-center gap-2">
                            Setter Workspace
                        </h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            Flujo de Trabajo Operativo en Pasos
                        </p>
                    </div>

                    {/* Buscador */}
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar lead por nombre o IG..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all font-bold"
                        />
                    </div>
                </div>
            </div>

            {/* Barra de Pasos Superior (Wizard) */}


            {/* Área de Trabajo Principal (Grid 2 Columnas) */}
            <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Columna Izquierda: Cola de Leads y Herramientas (ancho completo en cualificacion) */}
                <div className={`${activeStep === 'cualificacion' ? 'lg:col-span-12' : 'lg:col-span-7'} space-y-4`}>
                    
                    {/* Barra de Acciones Masivas */}
                    {selectedIds.size > 0 && (
                        <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-left animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-400 px-3 py-1.5 rounded-xl border border-violet-500/20">
                                    {selectedIds.size} Leads Marcados
                                </span>
                                <button 
                                    onClick={() => setSelectedIds(new Set())}
                                    className="text-[9px] font-black uppercase text-slate-500 hover:text-white underline cursor-pointer"
                                >
                                    Limpiar
                                </button>
                            </div>

                            <div className="flex items-center gap-2.5 flex-wrap md:flex-nowrap">
                                {/* Acciones en Lote según el paso */}
                                {activeStep === 'cualificacion' && (
                                    <>
                                        <button
                                            onClick={() => handleBulkUpdate('Cualificado')}
                                            disabled={submittingBulk}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/20"
                                        >
                                            ✓ Cualificar
                                        </button>
                                        <button
                                            onClick={() => handleBulkUpdate('Descualificado')}
                                            disabled={submittingBulk}
                                            className="px-4 py-2 bg-rose-650 hover:bg-rose-550 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/20"
                                        >
                                            ✕ Descualificar
                                        </button>
                                    </>
                                )}

                                {/* Selector de anuncio en lote */}
                                {availableKeywords.length > 0 && (
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleBulkUpdate(null, e.target.value);
                                                e.target.value = '';
                                            }
                                        }}
                                        disabled={submittingBulk}
                                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-300 outline-none focus:border-violet-500/50 cursor-pointer"
                                    >
                                        <option value="">Asociar Anuncio...</option>
                                        {availableKeywords.map(k => (
                                            <option key={k.id} value={k.slug}>{k.name} ({k.slug})</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Filtros e Indicadores Superiores (para cualificación) */}
                    {activeStep === 'cualificacion' && (
                        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-4 flex flex-wrap items-center justify-between gap-4">
                            {/* Selector de fecha */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowCalendar(!showCalendar)}
                                    className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
                                >
                                    <CalendarDays size={14} className="text-violet-400" />
                                    <span>
                                        {dateRange === 'today' && 'Hoy'}
                                        {dateRange === 'tomorrow' && 'Mañana'}
                                        {dateRange === 'week' && 'Esta semana'}
                                        {dateRange === 'month' && 'Este mes'}
                                        {dateRange === 'custom' && `Personalizado: ${customDate}`}
                                    </span>
                                    <ChevronDown size={14} className="text-slate-500" />
                                </button>
                                
                                {showCalendar && (
                                    <div className="absolute top-12 left-0 bg-slate-950 border border-slate-850 p-3 rounded-2xl shadow-xl z-50 space-y-2 min-w-[200px] animate-in fade-in slide-in-from-top-1 duration-150">
                                        {[
                                            { value: 'today', label: 'Hoy' },
                                            { value: 'tomorrow', label: 'Mañana' },
                                            { value: 'week', label: 'Esta semana' },
                                            { value: 'month', label: 'Este mes' }
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => {
                                                    setDateRange(opt.value);
                                                    setShowCalendar(false);
                                                }}
                                                className={`w-full text-left px-3.5 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-between ${
                                                    dateRange === opt.value 
                                                        ? 'bg-violet-650/20 text-violet-400' 
                                                        : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                                                }`}
                                            >
                                                {opt.label}
                                                {dateRange === opt.value && <Check size={12} />}
                                            </button>
                                        ))}
                                        
                                        <div className="border-t border-slate-900 my-1 pt-2">
                                            <button
                                                onClick={() => {
                                                    setDateRange('custom');
                                                    setShowCalendar(false);
                                                }}
                                                className={`w-full text-left px-3.5 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-between ${
                                                    dateRange === 'custom' 
                                                        ? 'bg-violet-650/20 text-violet-400' 
                                                        : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                                                }`}
                                            >
                                                <span>Personalizado</span>
                                                <CalendarDays size={12} />
                                            </button>
                                            
                                            {dateRange === 'custom' && (
                                                <input
                                                    type="date"
                                                    value={customDate}
                                                    onChange={(e) => {
                                                        setCustomDate(e.target.value);
                                                    }}
                                                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 text-xs font-bold rounded-xl p-2 text-slate-200 outline-none focus:border-violet-500/50"
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Estadísticas */}
                            <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
                                <div className="flex items-center gap-2 bg-violet-500/5 border border-violet-500/10 px-3 py-1.5 rounded-2xl">
                                    <Users size={14} className="text-violet-400" />
                                    <span className="text-xs font-black text-white">{stats.qualified_today}</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cualificados hoy</span>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-950 border border-slate-900 px-3 py-1.5 rounded-2xl">
                                    <Users size={14} className="text-slate-500" />
                                    <span className="text-xs font-black text-white">{stats.unassigned_today}</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sin asignación</span>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-950 border border-slate-900 px-3 py-1.5 rounded-2xl">
                                    <MessageSquare size={14} className="text-slate-500" />
                                    <span className="text-xs font-black text-white">{stats.no_response_today}</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sin responder</span>
                                </div>
                            </div>

                            {/* Botón Ver Descalificados */}
                            <button
                                onClick={() => setShowDisqualified(!showDisqualified)}
                                className={`px-4 py-2 bg-slate-950 border border-slate-850 hover:border-slate-750 transition-all rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer ${
                                    showDisqualified ? 'text-rose-400 bg-rose-500/5 border-rose-500/10 hover:border-rose-500/20' : 'text-slate-400'
                                }`}
                            >
                                <X size={12} />
                                {showDisqualified ? 'Ocultar descalificados' : 'Ver descalificados'}
                            </button>
                        </div>
                    )}

                    {/* Contenedor de la Lista */}
                    <div className="bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 shadow-xl space-y-4">
                        
                        <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={filteredLeads.length > 0 && selectedIds.size === filteredLeads.length}
                                    onChange={toggleSelectAll}
                                    className="rounded bg-slate-950 border-slate-800 text-violet-500 focus:ring-0 cursor-pointer w-4 h-4"
                                />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Seleccionar Todos
                                </span>
                            </div>
                            <span className="text-[10px] font-black bg-slate-900 text-slate-350 border border-slate-800 px-3 py-1 rounded-xl">
                                {filteredLeads.length} Leads
                            </span>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="animate-spin text-violet-500" size={32} />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cargando leads de la cola...</span>
                            </div>
                        ) : filteredLeads.length === 0 ? (
                            <div className="text-center py-16 text-slate-500 text-xs font-bold uppercase tracking-wide">
                                👏 ¡No tienes leads pendientes en este paso!
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                                <AnimatePresence initial={false}>
                                    {filteredLeads.map((l) => {
                                        const isSelected = selectedIds.has(l.id);
                                        const isViewed = selectedLead?.id === l.id;
                                        return (
                                            <motion.div
                                                key={l.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                onClick={() => setSelectedLead(l)}
                                                className={`p-4 rounded-2xl border transition-all cursor-pointer text-left flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group ${
                                                    isViewed 
                                                        ? 'bg-violet-650/10 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.1)]' 
                                                        : 'bg-black/20 border-slate-900/60 hover:bg-slate-900/50 hover:border-slate-800'
                                                }`}
                                            >
                                                {/* Contenido principal (Avatar y texto) */}
                                                <div className="flex items-center gap-4 min-w-0 flex-1 w-full">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => toggleSelect(l.id, e)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="rounded bg-slate-950 border-slate-800 text-violet-500 focus:ring-0 cursor-pointer w-4 h-4 shrink-0"
                                                    />
                                                    
                                                    {/* Avatar de Canal */}
                                                    {activeStep === 'cualificacion' && (
                                                        <div className="w-12 h-12 bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                                                            <Instagram size={24} className="text-white" />
                                                        </div>
                                                    )}

                                                    <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 items-center">
                                                        {/* Nombre e IG */}
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="text-sm font-black text-white leading-tight truncate font-bold">
                                                                    {l.lead_name || 'Sin Nombre'}
                                                                </h4>
                                                                {l.instagram && (
                                                                    <span className="text-[10px] text-slate-500 font-bold">
                                                                        • @{l.instagram}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                                                <span>{activeStep === 'cualificacion' ? (l.edad_form || 'N/A') : (l.origin || 'Web')}</span>
                                                                <span>•</span>
                                                                <span>ManyChat / Instagram</span>
                                                            </div>
                                                        </div>

                                                        {/* Asignación */}
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Asignado a</div>
                                                            <div className="text-xs font-black text-amber-500">
                                                                {l.assigned_to || 'Sin asignar'}
                                                            </div>
                                                        </div>

                                                        {/* Tiempo transcurrido */}
                                                        {activeStep === 'cualificacion' && (
                                                            <div className="space-y-1 md:text-right">
                                                                <div className="text-xs font-black text-white">
                                                                    {l.start_time ? (() => {
                                                                        const date = new Date(l.start_time);
                                                                        const now = new Date();
                                                                        const diffMs = now - date;
                                                                        const diffMins = Math.floor(diffMs / 60000);
                                                                        const diffHours = Math.floor(diffMins / 60);
                                                                        const diffDays = Math.floor(diffHours / 24);
                                                                        if (diffMins < 1) return 'Hace instantes';
                                                                        if (diffMins < 60) return `Hace ${diffMins} min`;
                                                                        if (diffHours < 24) return `Hace ${diffHours} h`;
                                                                        return `Hace ${diffDays} días`;
                                                                    })() : 'N/A'}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                                    Cualificado
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Acciones directas a la derecha de la tarjeta */}
                                                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                                                    {/* Paso 2: Cualificar / Descualificar */}
                                                    {activeStep === 'cualificacion' && (
                                                        <div className="flex gap-2 w-full md:w-auto">
                                                            <button
                                                                 onClick={(e) => handleQuickAction(l.id, 'Cualificado', e)}
                                                                 disabled={processingId === l.id}
                                                                 className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/15 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 flex-1 md:flex-initial"
                                                                 title="Confirmar cualificado"
                                                             >
                                                                 {processingId === l.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                                                 Confirmar cualificado
                                                             </button>
                                                             <button
                                                                 onClick={(e) => handleQuickAction(l.id, 'Descualificado', e)}
                                                                 disabled={processingId === l.id}
                                                                 className="h-9 w-9 bg-slate-900 border border-slate-800 hover:bg-rose-550/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-500 font-black rounded-xl transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                                                                 title="Descualificar"
                                                             >
                                                                 {processingId === l.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                                                             </button>
                                                         </div>
                                                     )}

                                                     <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors hidden md:block" />
                                                 </div>
                                             </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>

                {/* Columna Derecha: Visor de Calificación y Perfil Detallado (cols 5) - Oculto en cualificacion */}
                {activeStep !== 'cualificacion' && (
                    <div className="lg:col-span-5 h-[76vh] overflow-y-auto custom-scrollbar sticky top-28 bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 shadow-xl">
                        {selectedLead ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                                    <h3 className="text-xs font-black text-violet-400 uppercase tracking-widest">
                                        Perfil & Calificación
                                    </h3>
                                    <button
                                        onClick={() => setSelectedLead(null)}
                                        className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-500 hover:text-white transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                
                                <LeadRoadmapDetail 
                                    instagram={selectedLead.instagram}
                                    email={selectedLead.email}
                                    phone={selectedLead.phone}
                                    availableKeywords={availableKeywords}
                                    userRole={user?.role}
                                    appointmentId={selectedLead.id}
                                    compact={true}
                                    onUpdate={() => {
                                        fetchLeads();
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center text-slate-500 mb-4 shadow-xl">
                                    <Users size={28} />
                                </div>
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                                    Ficha de Calificación
                                </h3>
                                <p className="text-[10px] text-slate-650 font-bold uppercase tracking-wider mt-1 max-w-xs">
                                    Selecciona un lead de la lista izquierda para editar sus dolores, objeciones y ver las respuestas del formulario.
                                </p>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Modal de Detalle de Lead (para cualificación) */}
            <SetterCualificacionModal 
                isOpen={activeStep === 'cualificacion' && selectedLead !== null}
                onClose={() => setSelectedLead(null)}
                lead={selectedLead}
                availableKeywords={availableKeywords}
                onUpdate={() => {
                    fetchLeads();
                    fetchCualificacionStats();
                }}
                onSaveAndNext={handleSaveAndNext}
            />
        </div>
    );
};

export default SetterWorkflowPage;
