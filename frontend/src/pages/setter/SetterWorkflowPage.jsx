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
import SetterAgendasList from './components/SetterAgendasList';
import SetterBulkActionBar from './components/SetterBulkActionBar';
import SetterCualificacionList from './components/SetterCualificacionList';

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

    // Las agendas del setter (una sola lista: la atribución del anuncio se hace
    // en la misma fila, no en un panel aparte)
    const [agendasDelMazo, setAgendasDelMazo] = useState([]);
    const [loadingAgendas, setLoadingAgendas] = useState(false);
    const [selectedAdsMap, setSelectedAdsMap] = useState({});
    const [agendaIgMap, setAgendaIgMap] = useState({});
    const [assigningId, setAssigningId] = useState(null);
    const [guardandoIgId, setGuardandoIgId] = useState(null);

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

    const fetchAgendasDelMazo = async () => {
        setLoadingAgendas(true);
        try {
            let url = `/setter/deck/agendas?date_range=${dateRange}`;
            if (dateRange === 'custom' && customDate) {
                url += `&date=${customDate}`;
            }
            const res = await api.get(url);
            setAgendasDelMazo(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Error al cargar las agendas:", err);
            setAgendasDelMazo([]);
        } finally {
            setLoadingAgendas(false);
        }
    };

    // Corregir el Instagram del lead: es lo que vincula la agenda con ManyChat,
    // así que sin esto la atribución del anuncio no puede encontrar la conversación.
    const handleGuardarInstagram = async (agenda) => {
        const valor = (agendaIgMap[agenda.id] ?? agenda.instagram ?? '').trim();
        if (!valor) return;
        setGuardandoIgId(agenda.id);
        try {
            const res = await api.post(`/setter/deck/agendas/${agenda.id}/instagram`, { instagram: valor });
            toast.success(res.data.message);
            setAgendasDelMazo(prev => prev.map(a =>
                a.id === agenda.id ? { ...a, instagram: res.data.instagram } : a));
            setAgendaIgMap(prev => { const n = { ...prev }; delete n[agenda.id]; return n; });
        } catch (err) {
            console.error('Error al guardar el instagram:', err);
            toast.error(err.response?.data?.error || 'No se pudo guardar el Instagram');
        } finally {
            setGuardandoIgId(null);
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
            // La fila no se saca de la lista: ahora es la única, así que se
            // refresca para que muestre el anuncio ya atribuido.
            fetchAgendasDelMazo();
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
        fetchKeywords();
        if (activeStep === 'agendas') {
            fetchAgendasDelMazo();
        } else {
            fetchLeads();
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
            setAgendasDelMazo(prev => prev.map(a =>
                a.id === lead.id ? { ...a, unread_comment: false } : a));
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

                    {/* Paso Agendas: una sola lista, con la atribución del anuncio adentro */}
                    {activeStep === 'agendas' && (
                        <SetterAgendasList
                            agendas={agendasDelMazo}
                            cargando={loadingAgendas}
                            onRefrescar={fetchAgendasDelMazo}
                            onAbrirLead={abrirDetalleAgenda}
                            availableKeywords={availableKeywords}
                            agendaIgMap={agendaIgMap}
                            setAgendaIgMap={setAgendaIgMap}
                            selectedAdsMap={selectedAdsMap}
                            setSelectedAdsMap={setSelectedAdsMap}
                            onAsignarAnuncio={handleAssignAdToAgenda}
                            onGuardarInstagram={handleGuardarInstagram}
                            assigningId={assigningId}
                            guardandoIgId={guardandoIgId}
                        />
                    )}

                    {/* Cola de leads cualificados (paso 1) */}
                    {activeStep === 'cualificacion' && (
                        <SetterCualificacionList
                            loading={loading}
                            cualificacionTab={cualificacionTab}
                            setCualificacionTab={setCualificacionTab}
                            leadsPorProcesar={leadsPorProcesar}
                            leadsProcesados={leadsProcesados}
                            filteredLeads={filteredLeads}
                            selectedIds={selectedIds}
                            toggleSelectAll={toggleSelectAll}
                            toggleSelect={toggleSelect}
                            selectedLead={selectedLead}
                            processingId={processingId}
                            handleSelectLead={handleSelectLead}
                            handleQuickAction={handleQuickAction}
                            activeStep={activeStep}
                        />
                    )}
                </div>
            </div>

            {/* Modal del lead en el paso de agendas */}
            <AgendaManagerModal
                isOpen={agendaDetalle !== null}
                appointment={agendaDetalle}
                onClose={() => { setAgendaDetalle(null); setSelectedLead(null); }}
                onSuccess={() => { setAgendaDetalle(null); setSelectedLead(null); fetchAgendasDelMazo(); }}
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
