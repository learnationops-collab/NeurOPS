import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Loader2, Check, Users, X } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import LeadRoadmapDetail from '../../components/leads/LeadRoadmapDetail';
import SetterCualificacionModal from '../../components/modals/SetterCualificacionModal';
import AgendaManagerModal from '../../components/modals/AgendaManagerModal';
import SetterHeader from './components/SetterHeader';
import SetterCualificacionFilters from './components/SetterCualificacionFilters';
import UnattributedAgendasSection from './components/UnattributedAgendasSection';
import SetterBulkActionBar from './components/SetterBulkActionBar';
import SetterLeadRow from './components/SetterLeadRow';

const SetterWorkflowPage = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    
    // Paso activo: 'cualificacion' | 'agendas'
    const activeStep = searchParams.get('step') || 'cualificacion';

    // Estado principal
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [submittingBulk, setSubmittingBulk] = useState(false);
    
    // Selección masiva y búsqueda local
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [availableKeywords, setAvailableKeywords] = useState([]);
    
    // Lead seleccionado para el visor de la derecha
    const [selectedLead, setSelectedLead] = useState(null);

    // Detalle de la agenda abierta en el paso "Agendas". El paso de cualificación
    // usa SetterCualificacionModal; el de agendas no tenía ninguno, así que al
    // hacer clic se marcaba el mensaje como leído y no se abría nada.
    const [agendaDetalle, setAgendaDetalle] = useState(null);

    // Filtros de fecha y descalificados para cualificacion
    const [dateRange, setDateRange] = useState('today');
    const localToday = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const [customDate, setCustomDate] = useState(localToday);
    const [showDisqualified, setShowDisqualified] = useState(false);
    const [stats, setStats] = useState({ qualified_today: 0, unassigned_today: 0, no_response_today: 0 });
    const [showCalendar, setShowCalendar] = useState(false);
    const [cualificacionTab, setCualificacionTab] = useState('pendientes'); // 'pendientes' | 'procesados'

    // Agendas desatribuidas (Fuente Elias)
    const [unattributedAgendas, setUnattributedAgendas] = useState([]);
    const [loadingUnattributed, setLoadingUnattributed] = useState(false);
    const [selectedAdsMap, setSelectedAdsMap] = useState({});
    const [agendaIgMap, setAgendaIgMap] = useState({});
    const [assigningId, setAssigningId] = useState(null);

    // Cambiar de pestaña
    const handleStepChange = (newStep) => {
        setSearchParams({ step: newStep });
        setSelectedLead(null);
        setSelectedIds(new Set());
    };

    // Cargar leads / agendas de la cola activa
    const fetchLeads = async () => {
        setLoading(true);
        try {
            let url = `/setter/deck?step=${activeStep}`;
            url += `&date_range=${dateRange}`;
            if (activeStep === 'cualificacion') {
                url += `&show_disqualified=${showDisqualified}`;
            }
            if (dateRange === 'custom' && customDate) {
                url += `&date=${customDate}`;
            }
            const res = await api.get(url);
            const data = Array.isArray(res.data) ? res.data : [];
            setLeads(data);
            setSelectedIds(new Set());
            if (selectedLead && !data.some(l => l && l.id === selectedLead.id)) {
                setSelectedLead(null);
            }
        } catch (err) {
            console.error("Error al cargar leads del paso:", err);
            toast.error("Error al cargar la cola de trabajo");
            setLeads([]);
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

    const fetchKeywords = async () => {
        try {
            const res = await api.get('/marketing/ads');
            const ads = Array.isArray(res.data) ? res.data : [];
            setAvailableKeywords(ads
                .filter(a => a && (a.keyword || a.name))
                .map(a => ({ id: a.id, name: a.name || 'Sin Nombre', slug: a.keyword || a.name }))
            );
        } catch (err) {
            console.error("Error al cargar anuncios:", err);
            setAvailableKeywords([]);
        }
    };

    const fetchUnattributedAgendas = async () => {
        setLoadingUnattributed(true);
        try {
            let url = `/setter/deck/unattributed-agendas?date_range=${dateRange}`;
            if (dateRange === 'custom' && customDate) {
                url += `&date=${customDate}`;
            }
            const res = await api.get(url);
            setUnattributedAgendas(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Error al cargar agendas desatribuidas:", err);
            setUnattributedAgendas([]);
        } finally {
            setLoadingUnattributed(false);
        }
    };

    const handleAssignAdToAgenda = async (agenda) => {
        const adId = selectedAdsMap[agenda.id];
        if (!adId) {
            toast.error("Por favor selecciona un anuncio para esta agenda.");
            return;
        }
        const igRaw = agendaIgMap[agenda.id] ?? agenda.instagram;
        const igInput = (igRaw && igRaw !== 'N/A') ? igRaw.trim() : '';
        if (!igInput) {
            toast.error("Por favor escribe el Instagram del Lead para conectar la agenda con ManyChat.");
            return;
        }

        setAssigningId(agenda.id);
        const toastId = toast.loading("Asignando anuncio y conectando agenda...");
        try {
            await api.post('/setter/deck/assign-unattributed-ad', {
                agenda_id: agenda.id,
                ad_id: parseInt(adId),
                instagram: igInput
            });
            toast.success(`Anuncio asignado a ${agenda.cliente} (@${igInput.replace('@', '')})`, { id: toastId });
            setUnattributedAgendas(prev => (Array.isArray(prev) ? prev : []).filter(item => item.id !== agenda.id));
            if (activeStep === 'cualificacion') {
                fetchCualificacionStats();
            }
        } catch (err) {
            console.error("Error al asignar anuncio a agenda:", err);
            toast.error(err.response?.data?.error || "Error al asignar el anuncio", { id: toastId });
        } finally {
            setAssigningId(null);
        }
    };

    useEffect(() => {
        fetchLeads();
        fetchKeywords();
        fetchUnattributedAgendas();
        if (activeStep === 'cualificacion') {
            fetchCualificacionStats();
        }
    }, [activeStep, dateRange, customDate, showDisqualified]);

    // Filtrar localmente por búsqueda
    const filteredLeads = useMemo(() => {
        if (!Array.isArray(leads)) return [];
        const query = searchQuery.toLowerCase().trim();
        if (!query) return leads;
        return leads.filter(l => 
            l && (
                (l.lead_name && l.lead_name.toLowerCase().includes(query)) ||
                (l.instagram && l.instagram.toLowerCase().includes(query)) ||
                (l.email && l.email.toLowerCase().includes(query))
            )
        );
    }, [leads, searchQuery]);

    // Subdividir leads de cualificación
    const { leadsPorProcesar, leadsProcesados } = useMemo(() => {
        if (!Array.isArray(filteredLeads)) return { leadsPorProcesar: [], leadsProcesados: [] };
        if (activeStep !== 'cualificacion') return { leadsPorProcesar: filteredLeads, leadsProcesados: [] };
        const porProc = [];
        const proc = [];
        filteredLeads.forEach(l => {
            if (!l) return;
            const resVal = String(l.result || '').toLowerCase();
            if (l.processed || resVal === 'yes_confirmed' || resVal === 'confirmed') {
                proc.push(l);
            } else if (resVal === 'yes' || resVal === 'true' || resVal === 'cualificado') {
                porProc.push(l);
            }
        });
        return { leadsPorProcesar: porProc, leadsProcesados: proc };
    }, [filteredLeads, activeStep]);

    const handleSelectLead = (lead) => {
        if (lead.client_id) {
            localStorage.setItem(`read_comments_${lead.client_id}`, lead.comments_count || 0);
        }
        setSelectedLead(lead);
        setLeads(prev => prev.map(item => item.id === lead.id ? { ...item, unread_comment: false } : item));
        if (activeStep === 'agendas') abrirDetalleAgenda(lead);
    };

    // El detalle se pide por la AGENDA (el permiso lo da la fuente), no por la
    // cita: así abre también cuando la cita quedó atribuida a otro o no existe.
    const abrirDetalleAgenda = async (lead) => {
        if (!lead.agenda_id) {
            toast.error('Esta cita no está vinculada a ninguna agenda tuya.');
            return;
        }
        try {
            const res = await api.get(`/setter/agendas/${lead.agenda_id}/detalle`);
            setAgendaDetalle(res.data);
        } catch (err) {
            console.error('Error al abrir el detalle de la agenda:', err);
            toast.error(err.response?.data?.error || 'No se pudo abrir el detalle de la agenda');
        }
    };

    // Procesar acción individual (Cualificar / Descualificar)
    const handleQuickAction = async (leadId, nextResult, e) => {
        if (e) e.stopPropagation();
        setProcessingId(leadId);
        try {
            if (activeStep === 'cualificacion') {
                if (nextResult === 'Cualificado') {
                    await api.post(`/setter/deck/confirm-qualified/${leadId}`);
                    toast.success("Lead confirmado (Movido a Procesados)");
                    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, result: 'yes_confirmed', processed: true } : l));
                } else if (nextResult === 'Descualificado') {
                    await api.post(`/setter/deck/disqualify/${leadId}`);
                    toast.success("Lead descualificado (Movido a Procesados)");
                    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, result: 'false', processed: true } : l));
                }
            } else {
                await api.post(`/setter/deck/${leadId}`, { result: nextResult });
                toast.success("Lead actualizado correctamente");
                setLeads(prev => prev.filter(l => l.id !== leadId));
            }
            
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

    const handleSaveAndNext = (currentLeadId) => {
        const currentIndex = filteredLeads.findIndex(l => l.id === currentLeadId);
        fetchLeads();
        fetchCualificacionStats();

        if (currentIndex !== -1 && currentIndex < filteredLeads.length - 1) {
            handleSelectLead(filteredLeads[currentIndex + 1]);
        } else if (filteredLeads.length > 1) {
            const remainingLeads = filteredLeads.filter(l => l.id !== currentLeadId);
            if (remainingLeads.length > 0) {
                handleSelectLead(remainingLeads[0]);
            } else {
                setSelectedLead(null);
            }
        } else {
            setSelectedLead(null);
        }
    };

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
            
            {/* Header del Espacio de Trabajo con Pestañas (Leads cualificados / Agendas) */}
            <SetterHeader
                activeStep={activeStep}
                onStepChange={handleStepChange}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
            />

            {/* Área de Trabajo Principal (Ancho completo) */}
            <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Lista de Leads / Agendas (Ancho completo 12 columnas) */}
                <div className="lg:col-span-12 space-y-4">
                    
                    {/* Acciones Masivas */}
                    <SetterBulkActionBar
                        selectedIds={selectedIds}
                        onClearSelection={() => setSelectedIds(new Set())}
                        activeStep={activeStep}
                        submittingBulk={submittingBulk}
                        onBulkUpdate={handleBulkUpdate}
                        availableKeywords={availableKeywords}
                    />

                    {/* Filtros de Fecha y Estadísticas */}
                    <SetterCualificacionFilters
                        dateRange={dateRange}
                        setDateRange={setDateRange}
                        customDate={customDate}
                        setCustomDate={setCustomDate}
                        showCalendar={showCalendar}
                        setShowCalendar={setShowCalendar}
                        stats={stats}
                        showDisqualified={showDisqualified}
                        setShowDisqualified={setShowDisqualified}
                        activeStep={activeStep}
                    />

                    {/* Sección Agendas Desatribuidas (Exclusiva de la pestaña Agendas) */}
                    {activeStep === 'agendas' && (
                        <UnattributedAgendasSection
                            unattributedAgendas={unattributedAgendas}
                            loadingUnattributed={loadingUnattributed}
                            fetchUnattributedAgendas={fetchUnattributedAgendas}
                            agendaIgMap={agendaIgMap}
                            setAgendaIgMap={setAgendaIgMap}
                            selectedAdsMap={selectedAdsMap}
                            setSelectedAdsMap={setSelectedAdsMap}
                            availableKeywords={availableKeywords}
                            handleAssignAdToAgenda={handleAssignAdToAgenda}
                            assigningId={assigningId}
                        />
                    )}

                    {/* Contenedor de la Lista / Agendas Atribuidas */}
                    <div className="bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 shadow-xl space-y-4">
                        
                        {/* Selector de Sub-Pestañas para Paso de Cualificación */}
                        {activeStep === 'cualificacion' ? (
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900 pb-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        onClick={() => setCualificacionTab('pendientes')}
                                        className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                            cualificacionTab === 'pendientes'
                                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-lg shadow-amber-500/10'
                                                : 'bg-slate-950 text-slate-400 border border-slate-900 hover:text-white hover:border-slate-800'
                                        }`}
                                    >
                                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                                        Leads Cualificados Pendientes
                                        <span className="ml-1 px-2 py-0.5 rounded-full text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                                            {leadsPorProcesar.length}
                                        </span>
                                    </button>

                                    <button
                                        onClick={() => setCualificacionTab('procesados')}
                                        className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                            cualificacionTab === 'procesados'
                                                ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30 shadow-lg shadow-violet-500/10'
                                                : 'bg-slate-950 text-slate-400 border border-slate-900 hover:text-white hover:border-slate-800'
                                        }`}
                                    >
                                        <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                                        Procesados
                                        <span className="ml-1 px-2 py-0.5 rounded-full text-[9px] bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold">
                                            {leadsProcesados.length}
                                        </span>
                                    </button>
                                </div>

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
                            </div>
                        ) : (
                            <div className="flex flex-wrap justify-between items-center border-b border-slate-900 pb-4 gap-2">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={filteredLeads.length > 0 && selectedIds.size === filteredLeads.length}
                                        onChange={toggleSelectAll}
                                        className="rounded bg-slate-950 border-slate-800 text-violet-500 focus:ring-0 cursor-pointer w-4 h-4"
                                    />
                                    <h3 className="text-xs font-black text-white italic uppercase tracking-wider">
                                        Agendas Atribuidas
                                    </h3>
                                </div>
                                <span className="text-[10px] font-black bg-slate-900 text-slate-350 border border-slate-800 px-3 py-1 rounded-xl">
                                    {filteredLeads.length} Agendas
                                </span>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="animate-spin text-violet-500" size={32} />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cargando cola de trabajo...</span>
                            </div>
                        ) : (
                            <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar">
                                {activeStep === 'cualificacion' ? (
                                    cualificacionTab === 'pendientes' ? (
                                        leadsPorProcesar.length === 0 ? (
                                            <div className="text-center py-16 space-y-3">
                                                <div className="text-emerald-400 text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2">
                                                    <Check size={18} />
                                                    <span>¡No tienes leads cualificados pendientes por evaluar!</span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                    Todos los leads cualificados de este periodo han sido procesados.
                                                </p>
                                                {leadsProcesados.length > 0 && (
                                                    <button
                                                        onClick={() => setCualificacionTab('procesados')}
                                                        className="mt-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-violet-500/30 text-violet-400 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                                                    >
                                                        Ver pestaña de procesados ({leadsProcesados.length})
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <AnimatePresence initial={false}>
                                                {leadsPorProcesar.map((l) => (
                                                    <SetterLeadRow
                                                        key={l.id}
                                                        lead={l}
                                                        activeStep={activeStep}
                                                        isSelected={selectedIds.has(l.id)}
                                                        isViewed={selectedLead?.id === l.id}
                                                        processingId={processingId}
                                                        onSelectLead={handleSelectLead}
                                                        onToggleSelect={toggleSelect}
                                                        onQuickAction={handleQuickAction}
                                                    />
                                                ))}
                                            </AnimatePresence>
                                        )
                                    ) : (
                                        leadsProcesados.length === 0 ? (
                                            <div className="text-center py-16 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                                Aún no has procesado ningún lead en este periodo.
                                            </div>
                                        ) : (
                                            <AnimatePresence initial={false}>
                                                {leadsProcesados.map((l) => (
                                                    <SetterLeadRow
                                                        key={l.id}
                                                        lead={l}
                                                        activeStep={activeStep}
                                                        isSelected={selectedIds.has(l.id)}
                                                        isViewed={selectedLead?.id === l.id}
                                                        processingId={processingId}
                                                        onSelectLead={handleSelectLead}
                                                        onToggleSelect={toggleSelect}
                                                        onQuickAction={handleQuickAction}
                                                    />
                                                ))}
                                            </AnimatePresence>
                                        )
                                    )
                                ) : filteredLeads.length === 0 ? (
                                    <div className="text-center py-16 text-slate-500 text-xs font-bold uppercase tracking-wide">
                                        👏 ¡No tienes agendas en este paso!
                                    </div>
                                ) : (
                                    <AnimatePresence initial={false}>
                                        {filteredLeads.map((l) => (
                                            <SetterLeadRow
                                                key={l.id}
                                                lead={l}
                                                activeStep={activeStep}
                                                isSelected={selectedIds.has(l.id)}
                                                isViewed={selectedLead?.id === l.id}
                                                processingId={processingId}
                                                onSelectLead={handleSelectLead}
                                                onToggleSelect={toggleSelect}
                                                onQuickAction={handleQuickAction}
                                            />
                                        ))}
                                    </AnimatePresence>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal del lead en el paso de agendas */}
            <AgendaManagerModal
                isOpen={agendaDetalle !== null}
                appointment={agendaDetalle}
                onClose={() => { setAgendaDetalle(null); setSelectedLead(null); }}
                onSuccess={() => { setAgendaDetalle(null); setSelectedLead(null); fetchLeads(); }}
                mode="setter"
            />

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
