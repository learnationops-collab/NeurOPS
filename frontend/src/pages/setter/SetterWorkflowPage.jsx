import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
    Users, Layers, Activity, ClipboardList, BarChart3,
    Search, Check, X, Link2, Copy, ChevronRight, Loader2,
    Instagram, ExternalLink, Tag
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import LeadRoadmapDetail from '../../components/leads/LeadRoadmapDetail';

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

    // Cargar leads de la cola activa
    const fetchLeads = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/setter/deck?step=${activeStep}`);
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
    }, [activeStep]);

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

    // Navegar entre pasos del Dock
    const handleStepChange = (stepKey) => {
        if (stepKey === 'reporte') {
            navigate('/setter/report');
        } else if (stepKey === 'dashboard') {
            navigate('/setter/statistics');
        } else {
            setSearchParams({ step: stepKey });
        }
    };

    // Procesar acción individual (de un solo clic)
    const handleQuickAction = async (leadId, nextResult, e) => {
        if (e) e.stopPropagation();
        setProcessingId(leadId);
        try {
            await api.post(`/setter/deck/${leadId}`, { result: nextResult });
            toast.success("Lead actualizado correctamente");
            
            // Animación de salida optimizada
            setLeads(prev => prev.filter(l => l.id !== leadId));
            if (selectedLead?.id === leadId) {
                setSelectedLead(null);
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
            const payload = {
                appt_ids: Array.from(selectedIds),
                result: bulkResult || undefined,
                keyword: bulkKeyword || undefined
            };
            await api.post(`/setter/deck/bulk-update`, payload);
            toast.success("Leads actualizados masivamente");
            fetchLeads();
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

    // Pasos del Asistente
    const stepsConfig = [
        { key: 'cualificacion', label: '1. Cualificación', icon: Layers, desc: 'Cualificar o descualificar' },
        { key: 'link-agenda', label: '2. Link de Agenda', icon: Activity, desc: 'Enviar enlace de agendamiento' },
        { key: 'reporte', label: '3. Reporte Diario', icon: ClipboardList, desc: 'Registrar datos diarios' }
    ];

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
            <div className="bg-slate-950/30 border-b border-slate-900/60 py-4 px-6">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3">
                    {stepsConfig.map((s, idx) => {
                        const isActive = activeStep === s.key;
                        const StepIcon = s.icon;
                        return (
                            <button
                                key={s.key}
                                onClick={() => handleStepChange(s.key)}
                                className={`p-3.5 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden flex flex-col justify-between group cursor-pointer ${
                                    isActive
                                        ? 'bg-gradient-to-br from-violet-650/20 to-blue-600/5 border-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                                        : 'bg-slate-900/40 border-slate-900 hover:border-slate-800 hover:bg-slate-900/80'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full mb-1">
                                    <div className={`p-2 rounded-xl shrink-0 ${
                                        isActive ? 'bg-violet-600 text-white' : 'bg-slate-950 text-slate-400 group-hover:text-white transition-colors'
                                    }`}>
                                        <StepIcon size={16} />
                                    </div>
                                    {isActive && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping absolute top-4 right-4" />
                                    )}
                                </div>
                                <div>
                                    <span className={`text-[11px] font-black uppercase tracking-wider block ${
                                        isActive ? 'text-violet-300' : 'text-slate-350'
                                    }`}>
                                        {s.label}
                                    </span>
                                    <span className="text-[9px] text-slate-500 block truncate font-medium">
                                        {s.desc}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Área de Trabajo Principal (Grid 2 Columnas) */}
            <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Columna Izquierda: Cola de Leads y Herramientas (cols 7) */}
                <div className="lg:col-span-7 space-y-4">
                    
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
                                {activeStep === 'link-agenda' && (
                                    <button
                                        onClick={() => handleBulkUpdate('Link Enviado')}
                                        disabled={submittingBulk}
                                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-violet-600/20"
                                    >
                                        ✓ Marcar Link Enviado
                                    </button>
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
                                                className={`p-4 rounded-2xl border transition-all cursor-pointer text-left flex items-center justify-between gap-4 relative overflow-hidden group ${
                                                    isViewed 
                                                        ? 'bg-violet-650/10 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.1)]' 
                                                        : 'bg-black/20 border-slate-900/60 hover:bg-slate-900/50 hover:border-slate-800'
                                                }`}
                                            >
                                                {/* Checkbox y Contenido principal */}
                                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => toggleSelect(l.id, e)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="rounded bg-slate-950 border-slate-800 text-violet-500 focus:ring-0 cursor-pointer w-4 h-4 shrink-0"
                                                    />
                                                    
                                                    <div className="min-w-0 space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-sm font-black text-white leading-tight truncate font-bold">
                                                                {l.lead_name || 'Sin Nombre'}
                                                            </h4>
                                                            {l.instagram && (
                                                                <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                                                                    • @{l.instagram}
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        {/* Origen y Anuncio */}
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-[8px] font-black uppercase text-slate-500 bg-slate-950 border border-slate-900 px-2 py-0.5 rounded-md">
                                                                {l.origin || 'Web'}
                                                            </span>
                                                            
                                                            {/* Dropdown rápido de anuncio */}
                                                            {availableKeywords.length > 0 ? (
                                                                <select
                                                                    value={l.keyword || ''}
                                                                    onChange={(e) => handleUpdateKeyword(l.id, e.target.value, e)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="bg-slate-950 border border-slate-900 text-slate-400 hover:text-white rounded-lg px-2 py-0.5 text-[9px] font-black cursor-pointer outline-none focus:border-violet-500/50 font-bold"
                                                                >
                                                                    <option value="">Asociar Anuncio...</option>
                                                                    {availableKeywords.map(k => (
                                                                        <option key={k.id} value={k.slug}>{k.name}</option>
                                                                    ))}
                                                                </select>
                                                            ) : (
                                                                l.keyword && (
                                                                    <span className="text-[9px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-lg border border-violet-500/20">
                                                                        {l.keyword}
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Acciones directas a la derecha de la tarjeta */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    

                                                    {/* Paso 2: Cualificar / Descualificar */}
                                                    {activeStep === 'cualificacion' && (
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={(e) => handleQuickAction(l.id, 'Cualificado', e)}
                                                                disabled={processingId === l.id}
                                                                className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/15 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                                                title="Cualificar"
                                                            >
                                                                {processingId === l.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                                                Cualificar
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleQuickAction(l.id, 'Descualificado', e)}
                                                                disabled={processingId === l.id}
                                                                className="h-8 w-8 bg-rose-650 hover:bg-rose-550 text-white font-black rounded-xl transition-all shadow-md shadow-rose-600/15 flex items-center justify-center cursor-pointer disabled:opacity-50"
                                                                title="Descualificar"
                                                            >
                                                                {processingId === l.id ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Paso 2: Link de Agenda */}
                                                    {activeStep === 'link-agenda' && (
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={(e) => handleQuickAction(l.id, 'Link Enviado', e)}
                                                                disabled={processingId === l.id}
                                                                className="h-8 px-3 bg-violet-600 hover:bg-violet-500 text-white font-black text-[9px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-violet-600/15 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                                            >
                                                                {processingId === l.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                                                Link Enviado
                                                            </button>
                                                        </div>
                                                    )}

                                                    <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>

                {/* Columna Derecha: Visor de Calificación y Perfil Detallado (cols 5) */}
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

            </div>
        </div>
    );
};

export default SetterWorkflowPage;
