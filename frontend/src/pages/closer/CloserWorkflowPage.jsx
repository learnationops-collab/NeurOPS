import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
    Users, Layers, Search, Check, X, ChevronRight, Loader2,
    Calendar, Phone, Mail, Instagram, ExternalLink, Clock,
    RefreshCw, CalendarDays, AlertCircle, DollarSign, CreditCard,
    Save, ArrowLeft, ArrowRight, CheckCircle2, User, PenTool
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import LeadRoadmapDetail from '../../components/leads/LeadRoadmapDetail';
import CommentsSection from '../../components/shared/CommentsSection';
import TriageFollowUpModal from '../triage/components/TriageFollowUpModal';

const CloserWorkflowPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    
    const activeStep = searchParams.get('step') || 'confirmations';

    // Vista activa v6: 'inbox' (bandeja) o 'report' (reporte del día)
    const [activeView, setActiveView] = useState('inbox');
    const [reportSent, setReportSent] = useState(false);
    
    // Estado del reporte v6
    const [referrals, setReferrals] = useState({ rf1: 0, rf2: 0, rf3: 0, rf4: 0, rf5: 0 });
    const [reflection, setReflection] = useState({ win: '', fix: '' });
    const [offDaysMode, setOffDaysMode] = useState(null); // 0 = no, 1 = si
    const [selectedOffDays, setSelectedOffDays] = useState(new Set());
    const [submittingReport, setSubmittingReport] = useState(false);

    // Agendas y carga
    const [agendas, setAgendas] = useState([]);
    const [unreadNoAgenda, setUnreadNoAgenda] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [submittingBulk, setSubmittingBulk] = useState(false);
    
    // Contadores de pestañas (v6)
    const [counts, setCounts] = useState({ confirmations: 0, calls: 0, seguimientos: 0 });

    // Búsqueda global (v6)
    const [searchScope, setSearchScope] = useState('all');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [searching, setSearching] = useState(false);

    // Modal de Seguimiento tras cambio de estado / venta
    const [followUpModal, setFollowUpModal] = useState({
        show: false,
        agendaId: null,
        leadName: '',
        newStatus: '',
        isSaleFollowUp: false
    });
    const [savingFollowUp, setSavingFollowUp] = useState(false);
    
    // Selección masiva y búsqueda local
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [decisionMakerPrompt, setDecisionMakerPrompt] = useState({ apptId: null });
    const [selectedDate, setSelectedDate] = useState(() => {
        const offset = new Date().getTimezoneOffset();
        const localDate = new Date(new Date().getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    });
    
    // Cita seleccionada para el visor de la derecha (modal overlay v7)
    const [selectedLead, setSelectedLead] = useState(null);

    // Estado del árbol de decisiones del modal de lead v7 (pestaña, paso actual, camino recorrido y formulario de sesión)
    const [modalTab, setModalTab] = useState('act');
    const [modalStep, setModalStep] = useState('root');
    const [decisionPath, setDecisionPath] = useState([]);
    const [sessionForm, setSessionForm] = useState({});

    // Modales secundarios v7: Nueva Agenda y Referido Manual
    const [newAgendaModalOpen, setNewAgendaModalOpen] = useState(false);
    const [newAgendaForm, setNewAgendaForm] = useState({
        lead_name: '',
        instagram: '',
        date: new Date().toISOString().split('T')[0],
        time: '18:00',
        origin: 'Setter',
        examen: ''
    });

    const [manualRefModalOpen, setManualRefModalOpen] = useState(false);
    const [manualRefForm, setManualRefForm] = useState({
        from_lead_id: null,
        from_lead_name: '',
        lead_name: '',
        contact: '',
        notes: ''
    });
    const [refSearchQuery, setRefSearchQuery] = useState('');
    const [refSearchResults, setRefSearchResults] = useState([]);

    // Modal de motivo/razón de cambio (Reemplazo de window.prompt)
    const [reasonModal, setReasonModal] = useState({
        show: false,
        title: '',
        description: '',
        placeholder: '',
        confirmText: 'Guardar',
        requireText: true,
        actionType: null,
        apptId: null,
        nextStatus: null,
        rescheduleDate: null
    });
    const [reasonInput, setReasonInput] = useState('');

    // Estado para reprogramación individual
    const [rescheduleData, setRescheduleData] = useState({ apptId: null, date: '', status: '' });

    // Flujo de registro de venta directo post-Show Up
    const [salePrompt, setSalePrompt] = useState({ apptId: null });
    const [saleModalOpen, setSaleModalOpen] = useState(false);
    const [saleStep, setSaleStep] = useState(1);
    const [submittingSale, setSubmittingSale] = useState(false);
    const [saleForm, setSaleForm] = useState({
        lead_id: '',
        email_vendedor: user?.email || '',
        nombre_cliente: '',
        telefono: '',
        mail_cliente: '',
        programa: 'RR',
        tipo_pago_simple: 'completo',
        monto: '',
        segundo_pago: '',
        fecha_cobro: '',
        metodo_pago: 'Stripe',
        examen_lead: '',
        notes: '',
        estado: 'Completada',
        instagram: '',
        setter: '',
        documento_identidad: '',
        enviar_mensaje: true,
        sold_in_call: true,
        date: new Date().toISOString().split('T')[0]
    });

    // Sincronizar email del closer en cuanto esté cargado en la sesión
    useEffect(() => {
        if (user?.email) {
            setSaleForm(prev => ({ ...prev, email_vendedor: user.email }));
        }
    }, [user]);

    // Búsqueda global con debounce
    useEffect(() => {
        if (searchQuery.trim().length < 2) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await api.get(`/closer/leads/search?q=${encodeURIComponent(searchQuery)}`);
                let data = res.data || [];
                
                // Filtrar según el ámbito (searchScope)
                if (searchScope !== 'all') {
                    data = data.filter(l => {
                        const appt = l.appointment;
                        const result = appt ? appt.result || "" : "";
                        const closerResult = appt ? appt.closer_result || "" : "";
                        
                        let fase = 'confirm'; // Por defecto
                        if (appt) {
                            const resClean = result.toLowerCase();
                            const closerResClean = closerResult.toLowerCase();
                            
                            if (closerResClean === 'show up' || closerResClean === 'cerrada' || closerResClean === 'cerrado') {
                                fase = 'done';
                            } else if (appt.fecha_seguimiento || closerResClean === 'no show' || closerResClean === 'cancelado' || closerResClean === 'reagendado') {
                                fase = 'seg';
                            } else if (resClean === 'confirmado') {
                                fase = 'call';
                            } else {
                                fase = 'confirm';
                            }
                        }
                        return fase === searchScope;
                    });
                }
                setSearchResults(data);
                setShowSearchResults(true);
            } catch (err) {
                console.error("Error al buscar leads:", err);
            } finally {
                setSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, searchScope]);

    // Cerrar buscador global al hacer clic fuera
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (!e.target.closest('.search-v6')) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, []);

    // Seleccionar lead desde resultados de búsqueda global
    const handleSelectSearchResult = async (lead) => {
        setShowSearchResults(false);
        setSearchQuery('');
        
        if (lead.appointment && lead.appointment.id) {
            // Si tiene cita en la base de datos local, la cargamos completa
            setLoading(true);
            try {
                const res = await api.get(`/closer/deck/card/${lead.appointment.id}`);
                if (res.data) {
                    setSelectedLead(res.data);
                }
            } catch (err) {
                console.error("Error al cargar card de cita:", err);
                toast.error("Error al cargar la ficha de la cita");
            } finally {
                setLoading(false);
            }
        } else {
            // Cita simulada o datos de lead básicos
            setSelectedLead({
                id: lead.id ? -lead.id : -Math.floor(Math.random() * 100000), // id negativo para sintéticos
                lead_name: lead.username || "Sin Nombre",
                email: lead.email || "",
                phone: lead.phone || "",
                instagram: lead.instagram || "",
                origin: lead.appointment?.setter_name ? "Setter" : "Desconocido",
                setter_name: lead.appointment?.setter_name || "Sin Asignar",
                closer_result: "Pendiente"
            });
        }
    };

    // Crear Nueva Agenda (Modal v7)
    const handleCreateAgenda = async () => {
        if (!newAgendaForm.lead_name.trim()) {
            toast.error("El nombre del prospecto es obligatorio");
            return;
        }
        if (!newAgendaForm.date || !newAgendaForm.time) {
            toast.error("La fecha y hora son obligatorias");
            return;
        }
        setProcessingId('new_agenda');
        try {
            const payload = {
                lead_name: newAgendaForm.lead_name,
                instagram: newAgendaForm.instagram ? newAgendaForm.instagram.replace('@', '').trim() : '',
                start_time: `${newAgendaForm.date}T${newAgendaForm.time}:00`,
                origin: newAgendaForm.origin,
                examen: newAgendaForm.examen
            };
            await api.post('/closer/deck/new', payload);
            toast.success("Agenda creada correctamente");
            setNewAgendaModalOpen(false);
            setNewAgendaForm({
                lead_name: '',
                instagram: '',
                date: new Date().toISOString().split('T')[0],
                time: '18:00',
                origin: 'Setter',
                examen: ''
            });
            fetchAgendas();
        } catch (err) {
            console.error("Error al crear agenda:", err);
            toast.error("Error al crear la agenda");
        } finally {
            setProcessingId(null);
        }
    };

    // Guardar Referido Manual (Modal v7)
    const handleSaveManualRef = async () => {
        if (!manualRefForm.from_lead_id) {
            toast.error("Selecciona el lead origen del referido");
            return;
        }
        if (!manualRefForm.lead_name.trim()) {
            toast.error("El nombre del referido es obligatorio");
            return;
        }
        setProcessingId('manual_ref');
        try {
            const payload = {
                from_lead_id: manualRefForm.from_lead_id,
                lead_name: manualRefForm.lead_name,
                contact: manualRefForm.contact,
                notes: manualRefForm.notes
            };
            await api.post('/closer/deck/referrals/manual', payload);
            toast.success("Referido guardado correctamente");
            setManualRefModalOpen(false);
            setManualRefForm({
                from_lead_id: null,
                from_lead_name: '',
                lead_name: '',
                contact: '',
                notes: ''
            });
            fetchAgendas();
        } catch (err) {
            console.error("Error al guardar referido manual:", err);
            toast.error("Error al registrar referido");
        } finally {
            setProcessingId(null);
        }
    };

    // Eliminar Lead (Modal v7)
    const handleDeleteLead = async (leadId, leadName) => {
        if (!window.confirm(`¿Eliminar definitivamente a ${leadName || 'este prospecto'}?`)) return;
        setProcessingId(leadId);
        try {
            await api.delete(`/closer/deck/${leadId}`);
            toast.success("Prospecto eliminado correctamente");
            if (selectedLead?.id === leadId) setSelectedLead(null);
            fetchAgendas();
        } catch (err) {
            console.error("Error al eliminar lead:", err);
            toast.error("Error al eliminar el prospecto");
        } finally {
            setProcessingId(null);
        }
    };

    // Obtener contadores de las pestañas
    const fetchCounts = async () => {
        try {
            const countsRes = await api.get(`/closer/deck/counts?selected_date=${selectedDate}`);
            setCounts(countsRes.data || { confirmations: 0, calls: 0, seguimientos: 0 });
        } catch (err) {
            console.error("Error al obtener conteos de deck:", err);
        }
    };

    // Cargar agendas del día del closer
    const fetchAgendas = async () => {
        setLoading(true);
        try {
            const url = `/closer/deck?step=${activeStep}&selected_date=${selectedDate}`;
            const res = await api.get(url);
            const dataList = res.data || [];
            setAgendas(dataList);
            setSelectedIds(new Set());

            // Cargar leads sin agenda con comentarios pendientes
            try {
                const unreadRes = await api.get('/closer/unread-no-agenda');
                setUnreadNoAgenda(unreadRes.data || []);
            } catch (err) {
                console.error("Error al cargar leads sin agenda para closer:", err);
            }

            // Si el lead actualmente seleccionado ya no está en la cola ni en unreadNoAgenda, deseleccionarlo
            if (selectedLead && !dataList.some(l => l.id === selectedLead.id) && !unreadNoAgenda.some(l => l.id === selectedLead.id)) {
                setSelectedLead(null);
            }

            // Actualizar contadores
            await fetchCounts();
        } catch (err) {
            console.error("Error al cargar agendas:", err);
            toast.error("Error al cargar las agendas");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgendas();
    }, [activeStep, selectedDate]);

    // Guardar la fecha de seguimiento del modal (soporta string o objeto con cobro + normal)
    const handleConfirmFollowUp = async (followUpData) => {
        if (!followUpModal.agendaId) return;
        setSavingFollowUp(true);
        try {
            const payload = {};
            if (typeof followUpData === 'object' && followUpData !== null) {
                if (followUpData.normal) payload.fecha_seguimiento = followUpData.normal;
                if (followUpData.cobro) payload.fecha_seguimiento_cobro = followUpData.cobro;
                payload.seguimiento_realizado = false;
            } else {
                payload.fecha_seguimiento = followUpData;
                payload.seguimiento_realizado = false;
            }

            await api.post(`/closer/deck/${followUpModal.agendaId}`, payload);
            toast.success("Seguimiento(s) programado(s) correctamente");
            setFollowUpModal({ show: false, agendaId: null, leadName: '', newStatus: '', isSaleFollowUp: false });
            fetchAgendas();
        } catch (err) {
            console.error("Error al guardar fecha de seguimiento:", err);
            toast.error("Error al guardar la fecha de seguimiento");
        } finally {
            setSavingFollowUp(false);
        }
    };

    // Marcar Lead como Perdido / Descartado (Etapa de Recuperación)
    const handleMarkLeadLost = async () => {
        if (!followUpModal.agendaId) return;
        setSavingFollowUp(true);
        try {
            await api.post(`/closer/appointments/${followUpModal.agendaId}/process`, {
                status: 'Lead Perdido',
                role: 'closer',
                seguimiento_realizado: true
            });
            toast.success("Lead marcado como Perdido (almacenado para etapa de recuperación)");
            setFollowUpModal({ show: false, agendaId: null, leadName: '', newStatus: '', isSaleFollowUp: false });
            fetchAgendas();
        } catch (err) {
            console.error("Error al marcar lead como perdido:", err);
            toast.error("Error al actualizar el estado del lead");
        } finally {
            setSavingFollowUp(false);
        }
    };

    // Confirmar modal de motivo (Cancelación, Reagenda, No Lead)
    const handleConfirmReason = async (note) => {
        const { actionType, apptId, nextStatus, rescheduleDate } = reasonModal;
        setReasonModal(prev => ({ ...prev, show: false }));

        if (actionType === 'cancel') {
            await executeQuickAction(apptId, 'Cancelado', null, note);
        } else if (actionType === 'reschedule') {
            setProcessingId(apptId);
            try {
                await api.post(`/closer/appointments/${apptId}/process`, {
                    status: nextStatus === 'Reprogramada' ? 'Reagendado' : '2da call',
                    reschedule_date: rescheduleDate,
                    role: 'closer',
                    note: note
                });
                toast.success(nextStatus === 'Reprogramada' ? "Cita reprogramada" : "Segunda llamada agendada");
                setRescheduleData({ apptId: null, date: '', status: '' });
                if (selectedLead?.id === apptId) setSelectedLead(null);
                fetchAgendas();
            } catch (err) {
                console.error("Error al reprogramar:", err);
                toast.error("Error al procesar el cambio");
            } finally {
                setProcessingId(null);
            }
        } else if (actionType === 'no_lead') {
            setProcessingId(apptId);
            try {
                await api.post(`/closer/appointments/${apptId}/process`, { status: 'No Lead', role: 'closer', note: note });
                toast.success("Prospecto marcado como No Lead");
                if (selectedLead?.id === apptId) setSelectedLead(null);
                fetchAgendas();
            } catch (err) {
                console.error(err);
                toast.error("Error al calificar como No Lead");
            } finally {
                setProcessingId(null);
            }
        }
    };

    // Marcar seguimiento como realizado
    const handleMarkFollowUpDone = async (agenda, e) => {
        if (e) e.stopPropagation();
        setProcessingId(agenda.id);
        try {
            await api.post(`/closer/deck/${agenda.id}`, {
                seguimiento_realizado: true
            });
            toast.success("Seguimiento marcado como realizado");
            // Mostrar modal para consultar si desea programar un nuevo seguimiento futuro
            setFollowUpModal({
                show: true,
                agendaId: agenda.id,
                leadName: agenda.lead_name || 'Prospecto',
                newStatus: 'Seguimiento Realizado'
            });
            fetchAgendas();
        } catch (err) {
            console.error("Error al marcar seguimiento como realizado:", err);
            toast.error("Error al actualizar el seguimiento");
        } finally {
            setProcessingId(null);
        }
    };

    const handleSelectLead = async (lead) => {
        if (!lead) return;

        // 1. Establecer selección inicial de forma síncrona
        setSelectedLead(lead);
        setModalTab('act');
        setDecisionPath([]);
        setReasonInput('');
        setSessionForm({
            confirm_status: lead.result || lead.closer_result || 'por_confirmar',
            notes: lead.closer_notes || lead.notes || '',
            result: lead.closer_result || lead.result || 'Pendiente'
        });

        // 2. Determinar paso inicial del árbol por contexto
        if (activeStep === 'confirmations' || lead.fase === 'confirm') {
            setModalStep('confirm');
        } else if (activeStep === 'seguimientos' || lead.fase === 'seg') {
            setModalStep(lead.tipo === 'cerrada' ? 'segventa' : 'seg');
        } else {
            setModalStep('root');
        }

        setAgendas(prev => prev.map(item => item.id === lead.id ? { ...item, unread_comment: false } : item));
        setUnreadNoAgenda(prev => prev.map(item => item.id === lead.id ? { ...item, unread_comment: false } : item));

        // 3. Enriquecer datos completos si la cita tiene ID real de BD
        if (lead.id && lead.id > 0) {
            try {
                const res = await api.get(`/closer/deck/card/${lead.id}`, { skipAuthError: true });
                if (res.data) {
                    setSelectedLead(prev => ({ ...prev, ...res.data }));
                }
            } catch (err) {
                console.warn("No se pudieron cargar detalles completos del lead:", err);
            }
        }
    };

    // Filtrar localmente por búsqueda
    const filteredAgendas = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return agendas;
        return agendas.filter(a => 
            (a.lead_name && a.lead_name.toLowerCase().includes(query)) ||
            (a.instagram && a.instagram.toLowerCase().includes(query)) ||
            (a.email && a.email.toLowerCase().includes(query))
        );
    }, [agendas, searchQuery]);

    // Pipeline Kanban agrupado para confirmaciones (v6)
    const confirmationsPipeline = useMemo(() => {
        const list = filteredAgendas || [];
        const porConfirmar = [];
        const conversando = [];
        const confirmado = [];

        list.forEach(a => {
            const result = a.result ? a.result.toLowerCase() : "";
            if (result === 'confirmado') {
                confirmado.push(a);
            } else if (result === 'conversando' || result === 'contactado') {
                conversando.push(a);
            } else {
                porConfirmar.push(a);
            }
        });

        return { porConfirmar, conversando, confirmado };
    }, [filteredAgendas]);

    // Actualización rápida del estado de confirmación desde el Kanban (v6)
    const handleQuickConfirmStatus = async (apptId, status, e) => {
        if (e) e.stopPropagation();
        setProcessingId(apptId);
        try {
            await api.post(`/closer/deck/${apptId}`, { confirm_status: status });
            toast.success(`Confirmación actualizada a: ${status}`);
            
            // Actualizar localmente en memoria para respuesta visual inmediata
            setAgendas(prev => prev.map(a => a.id === apptId ? { ...a, result: status } : a));
            
            // Consultar contadores actualizados
            fetchCounts();
        } catch (err) {
            console.error("Error al actualizar estado de confirmación:", err);
            toast.error("Error al actualizar la confirmación");
        } finally {
            setProcessingId(null);
        }
    };

    // Renderizar una tarjeta individual del Kanban de confirmación (v6)
    const renderKanbanCard = (a, phase) => {
        const isViewed = selectedLead?.id === a.id;
        
        // Formatear fecha y hora legible
        const apptDate = a.start_time ? a.start_time.split('T')[0] : '';
        const apptTime = a.start_time ? a.start_time.split('T')[1]?.substring(0, 5) : '';
        
        // Calcular etiqueta "Hoy", "Mañana", etc.
        let dateLabel = apptDate;
        const todayStr = new Date().toISOString().split('T')[0];
        if (apptDate === todayStr) {
            dateLabel = 'Hoy';
        } else {
            try {
                const parts = apptDate.split('-');
                if (parts.length === 3) dateLabel = `${parts[2]}/${parts[1]}`;
            } catch (e) {}
        }
        
        return (
            <div 
                key={a.id} 
                className={`kcard-v6 ${isViewed ? 'border-pink-500/50 bg-pink-500/5 shadow-[0_0_15px_rgba(255,63,164,0.1)]' : ''}`}
                onClick={() => handleSelectLead(a)}
            >
                <div className="when-v6 soon-v6">
                    <span className="wd-v6"></span>
                    {dateLabel} · {apptTime}
                </div>
                <b>{a.lead_name || 'Sin Nombre'}</b>
                <div className="m-v6">@{a.instagram ? a.instagram.replace('@', '') : 'usuario'}</div>
                
                <div className="flex gap-1.5 flex-wrap mt-2">
                    <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-900 border border-slate-850 text-slate-400">
                        {a.origin || 'Meta Ads'}
                    </span>
                    {a.examen && (
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-900 border border-slate-850 text-slate-400">
                            {a.examen}
                        </span>
                    )}
                </div>
                
                {a.setter_notes && (
                    <div className="nt-v6 text-[10px] text-slate-350">
                        {a.setter_notes}
                    </div>
                )}
                
                {phase === 'por_confirmar' && (
                    <button 
                        className="kadv-v6" 
                        onClick={(e) => handleQuickConfirmStatus(a.id, 'Conversando', e)}
                        disabled={processingId === a.id}
                    >
                        {processingId === a.id ? '...' : 'Registrar contacto'}
                    </button>
                )}
                {phase === 'conversando' && (
                    <button 
                        className="kadv-v6" 
                        onClick={(e) => handleQuickConfirmStatus(a.id, 'Confirmado', e)}
                        disabled={processingId === a.id}
                    >
                        {processingId === a.id ? '...' : 'Confirmar asistencia'}
                    </button>
                )}
                {phase === 'confirmado' && (
                    <div className="flex gap-1 mt-2.5">
                        <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-full text-center">
                            ✓ Listo · espera su fecha
                        </span>
                    </div>
                )}
            </div>
        );
    };

    // Procesar acción rápida (Asistió, No Show, Canceló)
    const handleQuickAction = async (leadId, nextStatus, e) => {
        if (e) e.stopPropagation();
        
        if (nextStatus === 'Completada') {
            setDecisionMakerPrompt({ apptId: leadId });
            return;
        }
        
        if (nextStatus === 'Cancelada' || nextStatus === 'Cancelado') {
            const appt = agendas.find(a => a.id === leadId);
            setReasonInput('');
            setReasonModal({
                show: true,
                title: "Motivo de Cancelación",
                description: `Por favor ingresa la razón de la cancelación para el Lead Roadmap de ${appt?.lead_name || 'este prospecto'}:`,
                placeholder: "Motivo de la cancelación...",
                confirmText: "Guardar y Cancelar Cita",
                requireText: true,
                actionType: 'cancel',
                apptId: leadId,
                nextStatus: 'Cancelado'
            });
            return;
        }
        
        await executeQuickAction(leadId, nextStatus, null, null);
    };

    const executeQuickAction = async (leadId, nextStatus, withDecisionMaker, note = null) => {
        setProcessingId(leadId);
        try {
            const payload = { status: nextStatus === 'Completada' ? 'Show up' : nextStatus, role: 'closer' };
            if (withDecisionMaker !== null && withDecisionMaker !== undefined) {
                payload.with_decision_maker = withDecisionMaker;
            }
            if (note) {
                payload.note = note;
            }
            await api.post(`/closer/appointments/${leadId}/process`, payload);
            toast.success("Agenda actualizada correctamente");
            
            // Actualizar lista local
            setAgendas(prev => prev.map(a => a.id === leadId ? { 
                ...a, 
                closer_result: nextStatus === 'Completada' ? 'Show up' : nextStatus,
                with_decision_maker: withDecisionMaker
            } : a));
            if (selectedLead?.id === leadId) {
                setSelectedLead(prev => ({ 
                    ...prev, 
                    closer_result: nextStatus === 'Completada' ? 'Show up' : nextStatus,
                    with_decision_maker: withDecisionMaker
                }));
            }

            // Si es asistencia (Show up), gatillar el prompt para registrar venta
            if (nextStatus === 'Completada') {
                const appt = agendas.find(a => a.id === leadId);
                if (appt) {
                    const igUser = appt.instagram ? (appt.instagram.startsWith('@') ? appt.instagram : `@${appt.instagram}`) : '';
                    setSaleForm({
                        lead_id: appt.client_id || '',
                        email_vendedor: user?.email || '',
                        nombre_cliente: appt.lead_name || '',
                        telefono: appt.phone || '',
                        mail_cliente: appt.email || '',
                        programa: 'RR',
                        tipo_pago_simple: 'completo',
                        monto: '',
                        segundo_pago: '',
                        fecha_cobro: '',
                        metodo_pago: 'Stripe',
                        examen_lead: appt.keyword || '',
                        notas: '',
                        estado: 'Completada',
                        instagram: igUser,
                        setter: appt.setter_name || '',
                        documento_identidad: '',
                        enviar_mensaje: true,
                        sold_in_call: true,
                        date: new Date().toISOString().split('T')[0]
                    });
                    setSalePrompt({ apptId: leadId });
                }
            } else {
                // Para estados distintos de Completada, preguntar por seguimiento
                const appt = agendas.find(a => a.id === leadId);
                setFollowUpModal({
                    show: true,
                    agendaId: leadId,
                    leadName: appt?.lead_name || selectedLead?.lead_name || 'Prospecto',
                    newStatus: nextStatus,
                    isSaleFollowUp: false
                });
            }
        } catch (err) {
            console.error("Error al procesar acción rápida:", err);
            toast.error("Error al actualizar el estado");
        } finally {
            setProcessingId(null);
            setDecisionMakerPrompt({ apptId: null });
        }
    };

    // Confirmar reprogramación o segunda agenda
    const handleConfirmReschedule = async (e) => {
        if (e) e.stopPropagation();
        const { apptId, date, status } = rescheduleData;
        if (!date) {
            toast.error("Selecciona una fecha y hora");
            return;
        }

        const appt = agendas.find(a => a.id === apptId);
        setReasonInput('');
        setReasonModal({
            show: true,
            title: status === 'Reprogramada' ? "Motivo de Reagendamiento" : "Motivo de 2ª Llamada",
            description: `Escribe la razón del cambio para el Lead Roadmap de ${appt?.lead_name || 'este prospecto'}:`,
            placeholder: "Razón del cambio...",
            confirmText: "Confirmar Fecha",
            requireText: true,
            actionType: 'reschedule',
            apptId: apptId,
            nextStatus: status,
            rescheduleDate: date
        });
    };

    // Actualización masiva (Asistió, No Show, Canceló)
    const handleBulkUpdate = async (bulkResult) => {
        if (selectedIds.size === 0) return;
        setSubmittingBulk(true);
        try {
            const payload = {
                appt_ids: Array.from(selectedIds),
                result: bulkResult
            };
            await api.post(`/closer/deck/bulk-update`, payload);
            toast.success("Agendas actualizadas masivamente");
            fetchAgendas();
        } catch (err) {
            console.error("Error en lote:", err);
            toast.error("Error al procesar en lote");
        } finally {
            setSubmittingBulk(false);
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
        if (selectedIds.size === filteredAgendas.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredAgendas.map(a => a.id)));
        }
    };

    // Formatear fecha para input datetime-local
    const formatToDatetimeLocal = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '';
            const offset = d.getTimezoneOffset();
            const localDate = new Date(d.getTime() - (offset * 60 * 1000));
            return localDate.toISOString().slice(0, 16);
        } catch (e) {
            return '';
        }
    };

    // Formatear hora de inicio
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

    // Navegación de pasos del modal de venta
    const handleNextStep = () => {
        if (saleStep === 1) {
            if (!saleForm.nombre_cliente.trim()) {
                toast.error("El nombre del cliente es obligatorio");
                return;
            }
            if (!saleForm.instagram.trim()) {
                toast.error("El Instagram del cliente es obligatorio");
                return;
            }
            if (!saleForm.mail_cliente.trim()) {
                toast.error("El correo del cliente es obligatorio");
                return;
            }
        } else if (saleStep === 2) {
            if (!saleForm.monto) {
                toast.error("El monto de la venta es obligatorio");
                return;
            }
            if (parseFloat(saleForm.monto) <= 0) {
                toast.error("El monto debe ser mayor que 0");
                return;
            }
        }
        setSaleStep(prev => prev + 1);
    };

    const handlePrevStep = () => {
        setSaleStep(prev => prev - 1);
    };

    const handleRegisterSale = async () => {
        if (!saleForm.date) {
            toast.error("La fecha de la venta es obligatoria");
            return;
        }
        setSubmittingSale(true);
        try {
            // Formatear payload exactamente para Google Sheets (Ventas_DB)
            const payload = {
                email_vendedor: saleForm.email_vendedor,
                nombre_cliente: saleForm.nombre_cliente,
                telefono: saleForm.telefono ? saleForm.telefono.replace(/\+/g, '').trim() : '',
                mail_cliente: saleForm.mail_cliente,
                tipo_pago: `${saleForm.programa} - ${saleForm.tipo_pago_simple}`,
                monto: parseFloat(saleForm.monto) || 0.0,
                segundo_pago: saleForm.segundo_pago || '',
                metodo_pago: saleForm.metodo_pago,
                examen: saleForm.examen_lead + (saleForm.notas ? ` | ${saleForm.notes}` : ''),
                instagram: saleForm.instagram ? saleForm.instagram.replace(/@/g, '').trim() : '',
                estado: saleForm.estado,
                setter: saleForm.setter || '',
                documento_identidad: saleForm.documento_identidad || '',
                marca_temporal: (() => {
                    const selectedDate = new Date(saleForm.date);
                    const now = new Date();
                    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
                    return selectedDate.toLocaleString("es-ES");
                })(),
                enviar_webhook: true,
                enviar_mensaje: saleForm.enviar_mensaje,
                sold_in_call: saleForm.sold_in_call
            };

            const res = await api.post('/sheets/push?tabla=Ventas_DB', payload);
            
            if (res.data.status === 'success') {
                toast.success("Venta declarada y sincronizada correctamente");
                const savedApptId = salePrompt.apptId;

                // Si se definió una fecha de cobro en la venta, auto-guardarla para la agenda
                if (savedApptId && saleForm.fecha_cobro) {
                    try {
                        await api.post(`/closer/deck/${savedApptId}`, {
                            fecha_seguimiento_cobro: saleForm.fecha_cobro,
                            seguimiento_realizado: false
                        });
                    } catch (e) {
                        console.error("Error al auto-guardar fecha_seguimiento_cobro:", e);
                    }
                }

                setSaleModalOpen(false);
                setSalePrompt({ apptId: null });
                fetchAgendas();

                // Ofrecer seguimiento de cobro post-venta
                if (savedApptId) {
                    setFollowUpModal({
                        show: true,
                        agendaId: savedApptId,
                        leadName: saleForm.nombre_cliente || 'Cliente',
                        newStatus: 'Seguimiento de Cobro',
                        isSaleFollowUp: true
                    });
                }
            } else {
                toast.error(res.data.message || "Error al sincronizar con Google Sheets");
            }
        } catch (err) {
            console.error("Error al registrar venta desde deck:", err);
            toast.error(err.response?.data?.message || err.response?.data?.error || "Error al comunicar con el servidor");
        } finally {
            setSubmittingSale(false);
        }
    };

    // Funciones operativas de la Ficha Interactiva v6
    const addDecisionPath = (label, nextStep) => {
        setDecisionPath(prev => [...prev, label]);
        setModalStep(nextStep);
    };

    const saveConfirmReport = async () => {
        if (!sessionForm.notes.trim()) {
            toast.error("Por favor, ingresa una nota explicativa");
            return;
        }
        setProcessingId(selectedLead.id);
        try {
            await api.post(`/closer/deck/${selectedLead.id}`, {
                confirm_status: sessionForm.confirm_status || 'por_confirmar',
                closer_notes: sessionForm.notes
            });
            toast.success("Confirmación registrada correctamente");
            setSelectedLead(null);
            fetchAgendas();
        } catch (err) {
            console.error("Error en saveConfirmReport:", err);
            toast.error("Error al guardar confirmación");
        } finally {
            setProcessingId(null);
        }
    };

    const saveLlamadaReport = async (finalResult, extraData = {}) => {
        setProcessingId(selectedLead.id);
        try {
            const payload = {
                result: finalResult,
                closer_notes: sessionForm.notes,
                ...extraData
            };
            await api.post(`/closer/deck/${selectedLead.id}`, payload);
            toast.success("Reporte de llamada guardado con éxito");
            setSelectedLead(null);
            fetchAgendas();
        } catch (err) {
            console.error("Error en saveLlamadaReport:", err);
            toast.error("Error al reportar llamada");
        } finally {
            setProcessingId(null);
        }
    };

    const saveSeguimientoReport = async () => {
        setProcessingId(selectedLead.id);
        try {
            if (sessionForm.result === 'agendo' && sessionForm.nueva_fecha_agenda) {
                await api.patch(`/closer/appointments/${selectedLead.id}`, {
                    start_time: `${sessionForm.nueva_fecha_agenda}T${sessionForm.nueva_hora_agenda || '12:00'}:00`
                });
                await api.post(`/closer/deck/${selectedLead.id}`, {
                    confirm_status: 'por_confirmar',
                    result: 'Pendiente',
                    closer_notes: sessionForm.notes
                });
                toast.success("Lead reagendado y enviado a confirmación");
            } else {
                const payload = {
                    closer_notes: sessionForm.notes,
                    seguimiento_realizado: true,
                    fecha_seguimiento: sessionForm.fecha_seguimiento || null
                };
                await api.post(`/closer/deck/${selectedLead.id}`, payload);
                toast.success("Seguimiento guardado correctamente");
            }
            setSelectedLead(null);
            fetchAgendas();
        } catch (err) {
            console.error("Error en saveSeguimientoReport:", err);
            toast.error("Error al guardar el seguimiento");
        } finally {
            setProcessingId(null);
        }
    };

    const addLeadNote = async () => {
        if (reasonInput.trim().length < 5) return;
        setProcessingId(selectedLead.id);
        try {
            await api.post(`/closer/deck/comments/${selectedLead.id}`, {
                text: reasonInput.trim()
            });
            toast.success("Nota añadida al hilo");
            setReasonInput('');
        } catch (err) {
            console.error("Error en addLeadNote:", err);
            toast.error("Error al registrar nota");
        } finally {
            setProcessingId(null);
        }
    };

    const renderFormQuestion = (q, a, c = 'info') => {
        const borderCls = 
            c === 'good' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' :
            c === 'bad' ? 'border-rose-500/20 bg-rose-500/5 text-rose-400' :
            c === 'warn' ? 'border-amber-500/20 bg-amber-500/5 text-amber-400' :
            'border-slate-850 bg-slate-950/30 text-slate-300';

        return (
            <div className={`p-4 rounded-2xl border text-left flex flex-col gap-1 ${borderCls}`}>
                <div className="text-[10px] text-slate-500 font-bold uppercase leading-none">{q}</div>
                <div className="text-xs font-black leading-normal mt-1">{a || 'Sin respuesta'}</div>
            </div>
        );
    };

    const getCalificacionColor = (text) => {
        if (!text) return 'info';
        const str = String(text).toLowerCase();
        if (/no te podemos ayudar|desempleado|primero/.test(str)) return 'bad';
        if (/dispuesto|comprometo|no, no necesito|más de/.test(str)) return 'good';
        if (/pareja|lo hablo/.test(str)) return 'warn';
        return 'info';
    };

    const renderActionStepContent = () => {
        const option = (fn, type, label, sub) => (
            <button
                onClick={fn}
                className={`opt h-auto p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 relative overflow-hidden group ${
                    type === 'ok' ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/40 text-emerald-400' :
                    type === 'no' ? 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10 hover:border-rose-500/40 text-rose-450' :
                    type === 'bad' ? 'bg-rose-600/10 border-rose-600/20 hover:bg-rose-600/15 hover:border-rose-600/45 text-rose-400' :
                    type === 'pink' ? 'bg-pink-500/5 border-pink-500/20 hover:bg-pink-500/10 hover:border-pink-500/40 text-pink-400' :
                    'bg-slate-900 border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-350'
                }`}
            >
                <span className="text-xs font-black uppercase tracking-wider leading-none">{label}</span>
                {sub && <span className="text-[10px] text-slate-500 font-bold uppercase leading-tight mt-0.5">{sub}</span>}
            </button>
        );

        if (modalStep === 'confirm') {
            const steps = [
                { k: 'por_confirmar', label: 'Por confirmar', desc: 'Sin contacto' },
                { k: 'conversando', label: 'Conversando', desc: 'Respondió' },
                { k: 'confirmado', label: 'Confirmado', desc: 'Asiste seguro' }
            ];
            const currentIdx = steps.findIndex(x => x.k === selectedLead.result);

            return (
                <div className="space-y-6">
                    {/* Pipeline visual */}
                    <div className="flex items-center gap-3 bg-slate-950/20 border border-slate-850 p-4 rounded-2xl overflow-x-auto justify-center font-bold">
                        {steps.map((st, i) => (
                            <React.Fragment key={st.k}>
                                <div className={`text-center space-y-0.5 ${i <= currentIdx ? 'text-violet-400' : 'text-slate-500'}`}>
                                    <div className="text-[10px] font-black uppercase tracking-widest">{st.label}</div>
                                    <div className="text-[8px] font-bold uppercase tracking-wider text-slate-550">{st.desc}</div>
                                </div>
                                {i < 2 && <span className="text-slate-700 text-xs">›</span>}
                            </React.Fragment>
                        ))}
                    </div>

                    {sessionForm.confirm_status === 'Confirmado' || selectedLead.result === 'Confirmado' ? (
                        <div className="space-y-4">
                            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-xs text-emerald-450 font-bold uppercase tracking-wide text-center">
                                ✓ Este lead ya asiste seguro a la llamada.
                            </div>
                            <div className="q space-y-3">
                                <h4 className="text-[10px] font-black uppercase text-slate-400">Otras acciones de confirmación</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {option(() => setModalStep('reagQ'), 'info', 'Reagendar', 'Cambiar fecha')}
                                    {option(() => {
                                        setReasonInput('');
                                        setReasonModal({
                                            show: true,
                                            title: "Descartar lead",
                                            description: `¿Seguro que deseas descartar a ${selectedLead.lead_name}? Ingresa un motivo:`,
                                            placeholder: "Motivo...",
                                            confirmText: "Confirmar descarte",
                                            requireText: true,
                                            actionType: 'confirm_discard',
                                            apptId: selectedLead.id
                                        });
                                    }, 'bad', 'Descartar lead', 'Lead frío o no responde')}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="q req space-y-2">
                                <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                                    <span className="w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center text-[9px]">1</span>
                                    ¿En qué va el proceso? (Requerido)
                                </h4>
                                <textarea
                                    rows={3}
                                    value={sessionForm.notes}
                                    onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Le escribí por WhatsApp e Instagram. Me contestó que está de turno, le hablo por la tarde."
                                    className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium custom-scrollbar"
                                />
                            </div>

                            <div className="q req space-y-2">
                                <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                                    <span className="w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center text-[9px]">2</span>
                                    ¿Ya hubo contacto con el prospecto?
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {selectedLead.result === 'por_confirmar' || !selectedLead.result ? (
                                        <>
                                            {option(() => setSessionForm(prev => ({ ...prev, confirm_status: 'conversando' })), 'info', 'Sí, conversando', 'Respondió mensaje')}
                                            {option(() => setSessionForm(prev => ({ ...prev, confirm_status: 'por_confirmar' })), 'no', 'No responde aún', 'Registrar intento')}
                                        </>
                                    ) : (
                                        <>
                                            {option(() => setSessionForm(prev => ({ ...prev, confirm_status: 'Confirmado' })), 'ok', 'Sí, confirmó', 'Asiste seguro')}
                                            {option(() => setSessionForm(prev => ({ ...prev, confirm_status: 'conversando' })), 'no', 'Sigue conversando', 'Aún no confirma')}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                                <button
                                    onClick={() => setModalStep('reagQ')}
                                    className="h-9 px-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all"
                                >
                                    Reagendar
                                </button>
                                <button
                                    onClick={saveConfirmReport}
                                    disabled={!sessionForm.notes.trim() || processingId === selectedLead.id}
                                    className="h-9 px-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center"
                                >
                                    {processingId === selectedLead.id ? <Loader2 size={12} className="animate-spin" /> : 'Guardar Reporte'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (modalStep === 'root') {
            return (
                <div className="q space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                        <span className="w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center text-[9px]">1</span>
                        ¿Qué pasó con esta llamada de hoy?
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        {option(() => addDecisionPath("Asistió", "decisor"), 'ok', 'Asistió', 'Se conectó a la llamada')}
                        {option(() => addDecisionPath("No show", "noshow"), 'no', 'No show', 'No se presentó')}
                        {option(() => addDecisionPath("Canceló", "cancel"), 'bad', 'Canceló', 'Avisó que no venía')}
                        {option(() => addDecisionPath("Reagendó", "reagQ"), 'info', 'Reagendar', 'Pidió nueva fecha')}
                    </div>
                </div>
            );
        }

        if (modalStep === 'decisor') {
            return (
                <div className="q space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                        <span className="w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center text-[9px]">2</span>
                        ¿Estuvo presente el tomador de decisiones?
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        {option(() => {
                            setSessionForm(prev => ({ ...prev, with_decision_maker: true }));
                            addDecisionPath("Con decisor", "pres");
                        }, 'ok', 'Sí, con decisor')}
                        {option(() => {
                            setSessionForm(prev => ({ ...prev, with_decision_maker: false }));
                            addDecisionPath("Sin decisor", "pres");
                        }, 'no', 'No, sin decisor')}
                    </div>
                </div>
            );
        }

        if (modalStep === 'pres') {
            return (
                <div className="q space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                        <span className="w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center text-[9px]">3</span>
                        ¿Se hizo la presentación de la oferta?
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        {option(() => addDecisionPath("Con presentation", "venta"), 'ok', 'Sí, se presentó')}
                        {option(() => addDecisionPath("Sin presentación", "nopres"), 'no', 'No se presentó')}
                    </div>
                </div>
            );
        }

        if (modalStep === 'venta') {
            return (
                <div className="q space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                        <span className="w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center text-[9px]">4</span>
                        ¿Se cerró la venta?
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        {option(() => {
                            setSalePrompt({ apptId: selectedLead.id });
                            setSaleForm({
                                lead_id: selectedLead.id,
                                email_vendedor: user?.email || '',
                                nombre_cliente: selectedLead.lead_name || '',
                                telefono: selectedLead.phone || '',
                                mail_cliente: selectedLead.email || '',
                                programa: 'RR',
                                tipo_pago_simple: 'completo',
                                monto: '',
                                segundo_pago: '',
                                fecha_cobro: '',
                                metodo_pago: 'Stripe',
                                examen_lead: selectedLead.examen || '',
                                notes: '',
                                estado: 'Completada',
                                instagram: selectedLead.instagram || '',
                                setter: selectedLead.setter_name || '',
                                documento_identidad: '',
                                enviar_mensaje: true,
                                sold_in_call: true,
                                date: new Date().toISOString().split('T')[0]
                            });
                            setSaleStep(1);
                            setSaleModalOpen(true);
                        }, 'ok', 'Sí, hubo venta', 'Registrar pago')}
                        {option(() => addDecisionPath("Sin venta", "nocierre"), 'no', 'No hubo venta')}
                    </div>
                </div>
            );
        }

        if (modalStep === 'nocierre') {
            const sub = sessionForm.with_decision_maker ? 'Decisión pendiente · con decisor' : 'Sin decisor · oferta presentada';
            return (
                <div className="q space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                        <span className="w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center text-[9px]">5</span>
                        Se presentó la oferta pero no se cerró. ¿Siguiente acción?
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        {option(() => {
                            setSessionForm(prev => ({ ...prev, result: 'tomada', rmot: sub }));
                            setModalStep('follow');
                        }, 'ok', 'Programar seguimiento')}
                        {option(() => {
                            setReasonInput('');
                            setReasonModal({
                                show: true,
                                title: "Calificar como Perdido",
                                description: `¿Seguro que deseas calificar a ${selectedLead.lead_name} como perdido tras la presentación? Motivo:`,
                                placeholder: "Objeción final o motivo de pérdida...",
                                confirmText: "Confirmar Perdido",
                                requireText: true,
                                actionType: 'lost_after_pres',
                                apptId: selectedLead.id
                            });
                        }, 'bad', 'Lead perdido / descartado', 'Descartar prospecto')}
                    </div>
                </div>
            );
        }

        if (modalStep === 'nopres') {
            return (
                <div className="q space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                        <span className="w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center text-[9px]">4</span>
                        No se le presentó la oferta. ¿Siguiente paso?
                    </h4>
                    <div className="grid grid-cols-3 gap-2.5">
                        {option(() => setModalStep('second'), 'info', 'Agendar 2ª llamada', 'Enviar a confirmación')}
                        {option(() => {
                            setSessionForm(prev => ({ ...prev, result: 'tomada', rmot: 'Falta agendar 2ª llamada' }));
                            setModalStep('follow');
                        }, 'ok', 'Seguimiento', 'Agendar más tarde')}
                        {option(() => {
                            setReasonInput('');
                            setReasonModal({
                                show: true,
                                title: "Descartar sin presentación",
                                description: `¿Seguro que deseas descartar a ${selectedLead.lead_name} sin haberle presentado oferta? Motivo:`,
                                placeholder: "Escribe el motivo...",
                                confirmText: "Descartar",
                                requireText: true,
                                actionType: 'lost_no_pres',
                                apptId: selectedLead.id
                            });
                        }, 'bad', 'Descartar lead', 'No califica')}
                    </div>
                </div>
            );
        }

        if (modalStep === 'second') {
            return (
                <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400">Agendar 2ª Llamada Operativa</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 text-left">
                            <label className="text-[10px] text-slate-555 font-bold uppercase block">Nueva Fecha</label>
                            <input 
                                type="date"
                                value={sessionForm.nueva_fecha_agenda}
                                onChange={(e) => setSessionForm(prev => ({ ...prev, nueva_fecha_agenda: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-slate-200"
                            />
                        </div>
                        <div className="space-y-1.5 text-left">
                            <label className="text-[10px] text-slate-555 font-bold uppercase block">Nueva Hora</label>
                            <input 
                                type="time"
                                value={sessionForm.nueva_hora_agenda}
                                onChange={(e) => setSessionForm(prev => ({ ...prev, nueva_hora_agenda: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-slate-200"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5 text-left">
                        <label className="text-[10px] text-slate-555 font-bold uppercase block">Qué falta cubrir / Notas</label>
                        <textarea
                            rows={3}
                            value={sessionForm.notes}
                            onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Faltó el decisor / no dio tiempo al pitch..."
                            className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium custom-scrollbar"
                        />
                    </div>
                    <div className="flex justify-between items-center pt-2">
                        <button onClick={() => setModalStep('nopres')} className="h-9 px-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-[10px] font-black uppercase transition-all">Volver</button>
                        <button
                            onClick={async () => {
                                if (!sessionForm.nueva_fecha_agenda) {
                                    toast.error("La fecha es obligatoria");
                                    return;
                                }
                                setProcessingId(selectedLead.id);
                                try {
                                    await api.patch(`/closer/appointments/${selectedLead.id}`, {
                                        start_time: `${sessionForm.nueva_fecha_agenda}T${sessionForm.nueva_hora_agenda || '12:00'}:00`
                                    });
                                    await api.post(`/closer/deck/${selectedLead.id}`, {
                                        confirm_status: 'por_confirmar',
                                        result: 'Pendiente',
                                        closer_notes: sessionForm.notes || 'Agendó 2ª llamada'
                                    });
                                    toast.success("2ª llamada agendada y enviada a confirmaciones");
                                    setSelectedLead(null);
                                    fetchAgendas();
                                } catch (e) {
                                    console.error(e);
                                    toast.error("Error al agendar 2ª llamada");
                                } finally {
                                    setProcessingId(null);
                                }
                            }}
                            disabled={processingId === selectedLead.id}
                            className="h-9 px-5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
                        >
                            Enviar a Confirmaciones
                        </button>
                    </div>
                </div>
            );
        }

        if (modalStep === 'noshow') {
            const motivos = ['No contestó el mensaje', 'Bloqueó / desapareció', 'Se arrepintió', 'Problema técnico / horario', 'Confundió la fecha', 'Otro motivo'];
            return (
                <div className="space-y-4">
                    <div className="q req space-y-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-400">¿Por qué no se presentó?</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {motivos.map(m => (
                                <button
                                    key={m}
                                    onClick={() => setSessionForm(prev => ({ ...prev, motivo: m }))}
                                    className={`py-2 px-3 border rounded-xl text-left transition-all cursor-pointer font-bold text-[10px] uppercase ${
                                        sessionForm.motivo === m
                                            ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1.5 text-left">
                        <label className="text-[10px] text-slate-500 font-bold uppercase block">Qué pasó exactamente</label>
                        <textarea
                            rows={3}
                            value={sessionForm.notes}
                            onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Le escribí 3 veces, visto sin respuesta..."
                            className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium custom-scrollbar"
                        />
                    </div>
                    <div className="q space-y-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-400">Siguiente paso operativo</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {option(() => {
                                setSessionForm(prev => ({ ...prev, result: 'no_tomada', rmot: `No show: ${sessionForm.motivo || 'Sin especificar'}` }));
                                setModalStep('follow');
                            }, 'ok', 'Programar seguimiento', 'Continuar contacto')}
                            {option(() => {
                                setReasonInput('');
                                setReasonModal({
                                    show: true,
                                    title: "Descartar por No Show",
                                    description: `¿Seguro que deseas descartar a ${selectedLead.lead_name} por no show reiterado? Comentario:`,
                                    placeholder: "Motivo del descarte...",
                                    confirmText: "Confirmar Descarte",
                                    requireText: true,
                                    actionType: 'lost_no_show',
                                    apptId: selectedLead.id
                                });
                            }, 'bad', 'Descartar lead', 'Dar por perdido')}
                        </div>
                    </div>
                </div>
            );
        }

        if (modalStep === 'cancel') {
            const motivos = ['Sin tiempo / imprevisto', 'Ya no le interesa', 'Problema económico', 'No dio motivo'];
            return (
                <div className="space-y-4">
                    <div className="q req space-y-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-400">Motivo de la cancelación</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {motivos.map(m => (
                                <button
                                    key={m}
                                    onClick={() => setSessionForm(prev => ({ ...prev, motivo: m }))}
                                    className={`py-2 px-3 border rounded-xl text-left transition-all cursor-pointer font-bold text-[10px] uppercase ${
                                        sessionForm.motivo === m
                                            ? 'bg-rose-500/10 border-rose-500 text-rose-455'
                                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1.5 text-left">
                        <label className="text-[10px] text-slate-500 font-bold uppercase block">Comentario del closer</label>
                        <textarea
                            rows={3}
                            value={sessionForm.notes}
                            onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Detalle de lo que dijo..."
                            className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium custom-scrollbar"
                        />
                    </div>
                    <div className="q space-y-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-400">Siguiente paso operativo</h4>
                        <div className="grid grid-cols-3 gap-2">
                            {option(() => setModalStep('reagQ'), 'info', 'Reagendar ahora', 'Cambiar cita')}
                            {option(() => {
                                setSessionForm(prev => ({ ...prev, result: 'no_tomada', rmot: `Cancelación: ${sessionForm.motivo || 'Sin especificar'}` }));
                                setModalStep('follow');
                            }, 'ok', 'Seguimiento', 'Programar contacto')}
                            {option(() => {
                                setReasonInput('');
                                setReasonModal({
                                    show: true,
                                    title: "Calificar como No Lead",
                                    description: `¿Seguro que deseas marcar a ${selectedLead.lead_name} como No Lead? Detalle:`,
                                    placeholder: "Escribe por qué no es lead calificado...",
                                    confirmText: "Confirmar No Lead",
                                    requireText: true,
                                    actionType: 'no_lead',
                                    apptId: selectedLead.id
                                });
                            }, 'bad', 'Marcar No Lead', 'No califica')}
                        </div>
                    </div>
                </div>
            );
        }

        if (modalStep === 'reagQ') {
            const motivos = ['Imprevisto del lead', 'Sin tiempo suficiente', 'Pidió otro horario', 'No dio motivo'];
            return (
                <div className="space-y-4">
                    <div className="q req space-y-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-400">¿Por qué se reagenda?</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {motivos.map(m => (
                                <button
                                    key={m}
                                    onClick={() => setSessionForm(prev => ({ ...prev, motivo: m }))}
                                    className={`py-2 px-3 border rounded-xl text-left transition-all cursor-pointer font-bold text-[10px] uppercase ${
                                        sessionForm.motivo === m
                                            ? 'bg-violet-500/10 border-violet-500 text-violet-400'
                                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="q space-y-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-400">¿Dejó una fecha nueva?</h4>
                        <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Si no dio fecha, no es reagenda: se programa un seguimiento.</p>
                        <div className="grid grid-cols-2 gap-3">
                            {option(() => setModalStep('reagSi'), 'ok', 'Sí, dejó fecha', 'Vuelve a confirmaciones')}
                            {option(() => {
                                setSessionForm(prev => ({ ...prev, result: 'no_tomada', rmot: 'Reprogramó sin fecha' }));
                                setModalStep('follow');
                            }, 'no', 'No dejó fecha', 'Mandar a seguimiento')}
                        </div>
                    </div>
                </div>
            );
        }

        if (modalStep === 'reagSi') {
            return (
                <div className="space-y-4">
                    <div className="p-3 bg-violet-650/10 border border-violet-500/20 rounded-2xl text-[10px] font-black uppercase tracking-wider text-violet-400">
                        ▸ Al confirmar, el prospecto volverá a la columna «Por confirmar» del Kanban.
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 text-left">
                            <label className="text-[10px] text-slate-500 font-bold uppercase block">Nueva Fecha <span className="rq text-pink-500">*</span></label>
                            <input 
                                type="date"
                                value={sessionForm.nueva_fecha_agenda}
                                onChange={(e) => setSessionForm(prev => ({ ...prev, nueva_fecha_agenda: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-slate-200"
                            />
                        </div>
                        <div className="space-y-1.5 text-left">
                            <label className="text-[10px] text-slate-500 font-bold uppercase block">Nueva Hora <span className="rq text-pink-500">*</span></label>
                            <input 
                                type="time"
                                value={sessionForm.nueva_hora_agenda}
                                onChange={(e) => setSessionForm(prev => ({ ...prev, nueva_hora_agenda: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-slate-200"
                            />
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-850">
                        <button onClick={() => setModalStep('reagQ')} className="h-9 px-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-[10px] font-black uppercase transition-all">Volver</button>
                        <button
                            onClick={async () => {
                                if (!sessionForm.nueva_fecha_agenda) {
                                    toast.error("La fecha es obligatoria");
                                    return;
                                }
                                setProcessingId(selectedLead.id);
                                try {
                                    await api.patch(`/closer/appointments/${selectedLead.id}`, {
                                        start_time: `${sessionForm.nueva_fecha_agenda}T${sessionForm.nueva_hora_agenda || '12:00'}:00`
                                    });
                                    await api.post(`/closer/deck/${selectedLead.id}`, {
                                        confirm_status: 'por_confirmar',
                                        result: 'Pendiente',
                                        closer_notes: sessionForm.notes || `Reagendado por: ${sessionForm.motivo || 'Sin especificar'}`
                                    });
                                    toast.success("Cita reagendada con éxito");
                                    setSelectedLead(null);
                                    fetchAgendas();
                                } catch (e) {
                                    console.error(e);
                                    toast.error("Error al reagendar");
                                } finally {
                                    setProcessingId(null);
                                }
                            }}
                            disabled={processingId === selectedLead.id}
                            className="h-9 px-5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
                        >
                            Confirmar Reagenda
                        </button>
                    </div>
                </div>
            );
        }

        if (modalStep === 'follow') {
            const cadencias = [
                { k: 'hoy', d: 0, label: 'Hoy', desc: new Date().toLocaleDateString() },
                { k: 'mañana', d: 1, label: 'Mañana', desc: new Date(Date.now() + 86400000).toLocaleDateString() },
                { k: 'sin_fecha', d: null, label: 'Sin fecha', desc: 'Va al pool' }
            ];

            return (
                <div className="space-y-4 text-left">
                    <div className="p-4 bg-slate-950/20 border border-slate-850 rounded-2xl flex justify-between gap-4 text-xs font-bold uppercase">
                        <div><span className="text-slate-500 text-[9px] block">Tipo de seguimiento</span><b>{sessionForm.result === 'tomada' ? 'Operativo (Showup)' : 'Recuperación (No show/Canceló)'}</b></div>
                        <div><span className="text-slate-500 text-[9px] block">Subestado</span><b>{sessionForm.rmot || 'Seguimiento programado'}</b></div>
                        <div><span className="text-slate-500 text-[9px] block">Intentos</span><b>4 intentos · cadencia automática</b></div>
                    </div>

                    <div className="q space-y-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-400">¿Cuándo lo vas a seguir?</h4>
                        <div className="grid grid-cols-3 gap-2">
                            {cadencias.map(cd => (
                                <button
                                    key={cd.k}
                                    onClick={() => {
                                        const dt = cd.d === null ? '' : new Date(Date.now() + cd.d * 86400000).toISOString().split('T')[0];
                                        setSessionForm(prev => ({ ...prev, fecha_seguimiento: dt }));
                                    }}
                                    className={`py-2 px-3 border rounded-xl text-left transition-all cursor-pointer font-bold text-[10px] uppercase flex flex-col gap-0.5 ${
                                        (cd.d === null && !sessionForm.fecha_seguimiento) || (cd.d !== null && sessionForm.fecha_seguimiento === new Date(Date.now() + cd.d * 86400000).toISOString().split('T')[0])
                                            ? 'bg-violet-650/10 border-violet-500/50 text-violet-400'
                                            : 'bg-slate-900 border-slate-800 text-slate-450 hover:border-slate-700'
                                    }`}
                                >
                                    <span>{cd.label}</span>
                                    <span className="text-[8px] text-slate-500 font-medium normal-case">{cd.desc}</span>
                                </button>
                            ))}
                        </div>
                        <input
                            type="date"
                            value={sessionForm.fecha_seguimiento}
                            onChange={(e) => setSessionForm(prev => ({ ...prev, fecha_seguimiento: e.target.value }))}
                            className="w-full max-w-[200px] mt-2 bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-500 font-bold uppercase block">Ángulo del seguimiento / Notas</label>
                        <p className="text-[8px] text-slate-550 uppercase font-bold mt-0.5">Qué le vas a decir y por qué canal. Lo leerá el equipo si no estás.</p>
                        <textarea
                            rows={3}
                            value={sessionForm.notes}
                            onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Quedó en hablarlo con su pareja. Regreso con el caso de Ana, mismo examen y misma objeción de precio..."
                            className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium custom-scrollbar"
                        />
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-850">
                        <button onClick={() => setModalStep('root')} className="h-9 px-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-[10px] font-black uppercase transition-all">Volver</button>
                        <button
                            onClick={async () => {
                                setProcessingId(selectedLead.id);
                                try {
                                    await api.post(`/closer/deck/${selectedLead.id}`, {
                                        result: sessionForm.result === 'tomada' ? 'Show up' : 'No Show',
                                        closer_notes: sessionForm.notes || 'Programó seguimiento',
                                        fecha_seguimiento: sessionForm.fecha_seguimiento || null
                                    });
                                    toast.success("Seguimiento programado con éxito");
                                    setSelectedLead(null);
                                    fetchAgendas();
                                } catch (e) {
                                    console.error(e);
                                    toast.error("Error al programar seguimiento");
                                } finally {
                                    setProcessingId(null);
                                }
                            }}
                            disabled={processingId === selectedLead.id}
                            className="h-9 px-5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
                        >
                            Guardar Seguimiento
                        </button>
                    </div>
                </div>
            );
        }

        if (modalStep === 'seg') {
            const seq = selectedLead.seguimiento_intento || 1;
            return (
                <div className="space-y-4">
                    <div className="p-3 bg-[#111219]/90 border border-slate-900 rounded-2xl text-xs font-bold text-slate-350 flex justify-between">
                        <span><b>Seguimiento {seq} de 4</b></span>
                        <span>Cadencia automática</span>
                    </div>

                    <div className="q req space-y-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-400">¿Qué pasó con este contacto?</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {option(() => setSessionForm(prev => ({ ...prev, result: 'no_resp' })), 'no', 'No respondió', 'Lo hice, no contestó')}
                            {option(() => setSessionForm(prev => ({ ...prev, result: 'contesto' })), 'info', 'Contestó', 'Estamos conversando')}
                            {option(() => setSessionForm(prev => ({ ...prev, result: 'agendo' })), 'ok', 'Contestó y agendó', 'Vuelve al meet')}
                            {option(() => {
                                setSalePrompt({ apptId: selectedLead.id });
                                setSaleForm({
                                    lead_id: selectedLead.id,
                                    email_vendedor: user?.email || '',
                                    nombre_cliente: selectedLead.lead_name || '',
                                    telefono: selectedLead.phone || '',
                                    mail_cliente: selectedLead.email || '',
                                    programa: 'RR',
                                    tipo_pago_simple: 'completo',
                                    monto: '',
                                    segundo_pago: '',
                                    fecha_cobro: '',
                                    metodo_pago: 'Stripe',
                                    examen_lead: selectedLead.examen || '',
                                    notes: '',
                                    estado: 'Completada',
                                    instagram: selectedLead.instagram || '',
                                    setter: selectedLead.setter_name || '',
                                    documento_identidad: '',
                                    enviar_mensaje: true,
                                    sold_in_call: true,
                                    date: new Date().toISOString().split('T')[0]
                                });
                                setSaleStep(1);
                                setSaleModalOpen(true);
                            }, 'ok', 'Cerró la venta', 'Registrar pago')}
                        </div>
                    </div>

                    {sessionForm.result === 'agendo' && (
                        <div className="grid grid-cols-2 gap-3 p-4 bg-slate-950/20 border border-slate-850 rounded-2xl">
                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] text-slate-500 font-bold uppercase block">Nueva Fecha <span className="rq text-pink-500">*</span></label>
                                <input 
                                    type="date"
                                    value={sessionForm.nueva_fecha_agenda}
                                    onChange={(e) => setSessionForm(prev => ({ ...prev, nueva_fecha_agenda: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-slate-200"
                                />
                            </div>
                            <div className="space-y-1.5 text-left">
                                <label className="text-[10px] text-slate-500 font-bold uppercase block">Nueva Hora <span className="rq text-pink-500">*</span></label>
                                <input 
                                    type="time"
                                    value={sessionForm.nueva_hora_agenda}
                                    onChange={(e) => setSessionForm(prev => ({ ...prev, nueva_hora_agenda: e.target.value }))}
                                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-slate-200"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1.5 text-left">
                        <label className="text-[10px] text-slate-500 font-bold uppercase block">Qué le dijiste y qué respondió (Requerido)</label>
                        <textarea
                            rows={3}
                            value={sessionForm.notes}
                            onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Le mandé el caso de Ana, mismo examen y mismo miedo de no pasar. Vio el mensaje pero no contestó..."
                            className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium custom-scrollbar"
                        />
                    </div>

                    {sessionForm.result && sessionForm.result !== 'agendo' && (
                        <div className="q space-y-2">
                            <h4 className="text-[10px] font-black uppercase text-slate-400">¿Y ahora qué hacemos?</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {option(() => {
                                    const delayDays = [0, 3, 7, 14][Math.min(3, seq)];
                                    const nextDate = new Date(Date.now() + delayDays * 86400000).toISOString().split('T')[0];
                                    setSessionForm(prev => ({ ...prev, fecha_seguimiento: nextDate, sig_action: 'next' }));
                                }, 'ok', `Programar Seguimiento ${Math.min(4, seq + 1)}`, `Sugerido para +${[0, 3, 7, 14][Math.min(3, seq)]} días`)}
                                {option(() => {
                                    setReasonInput('');
                                    setReasonModal({
                                        show: true,
                                        title: "Cerrar Seguimiento",
                                        description: `¿Seguro que deseas dar por cerrado el seguimiento de ${selectedLead.lead_name}? Ingresa motivo:`,
                                        placeholder: "No califica, compró en otro lado, pidió no ser contactado...",
                                        confirmText: "Cerrar Seguimiento",
                                        requireText: true,
                                        actionType: 'close_follow_up',
                                        apptId: selectedLead.id
                                    });
                                }, 'bad', 'Cerrar Seguimiento', 'Lead frío o agotado')}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-slate-850">
                        <div />
                        <button
                            onClick={saveSeguimientoReport}
                            disabled={!sessionForm.notes.trim() || !sessionForm.result || processingId === selectedLead.id}
                            className="h-9 px-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
                        >
                            {processingId === selectedLead.id ? <Loader2 size={12} className="animate-spin" /> : 'Completar Seguimiento'}
                        </button>
                    </div>
                </div>
            );
        }

        if (modalStep === 'segventa') {
            return (
                <div className="space-y-4">
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-[10px] font-black uppercase tracking-wider text-emerald-450 text-center">
                        ▸ Seguimiento de Cliente. Ya cerró la venta: el foco es cobrar la deuda.
                    </div>
                    <div className="grid grid-cols-4 gap-2 bg-slate-950/20 border border-slate-850 p-4 rounded-2xl text-xs font-bold text-slate-350">
                        <div><span className="text-slate-500 text-[8px] block">Programa</span><b>{selectedLead.programa || 'Ace Learner (AL)'}</b></div>
                        <div><span className="text-slate-500 text-[8px] block">Ya pagó</span><b className="text-emerald-400">$1,850 USD</b></div>
                        <div><span className="text-slate-500 text-[8px] block">Debe</span><b className="text-rose-450">$0 USD</b></div>
                        <div><span className="text-slate-550 text-[8px] block">Cliente desde</span><b>31/07/2026</b></div>
                    </div>

                    <div className="q req space-y-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-400">¿Qué pasó con el cobro?</h4>
                        <div className="grid grid-cols-3 gap-2">
                            {option(() => setSessionForm(prev => ({ ...prev, result: 'no_resp' })), 'no', 'No respondió')}
                            {option(() => setSessionForm(prev => ({ ...prev, result: 'contesto' })), 'info', 'Estamos conversando')}
                            {option(() => {
                                setSalePrompt({ apptId: selectedLead.id });
                                setSaleForm({
                                    lead_id: selectedLead.id,
                                    email_vendedor: user?.email || '',
                                    nombre_cliente: selectedLead.lead_name || '',
                                    telefono: selectedLead.phone || '',
                                    mail_cliente: selectedLead.email || '',
                                    programa: selectedLead.programa || 'RR',
                                    tipo_pago_simple: 'parcial',
                                    monto: '',
                                    segundo_pago: '',
                                    fecha_cobro: '',
                                    metodo_pago: 'Stripe',
                                    examen_lead: selectedLead.examen || '',
                                    notes: '',
                                    estado: 'Completada',
                                    instagram: selectedLead.instagram || '',
                                    setter: selectedLead.setter_name || '',
                                    documento_identidad: '',
                                    enviar_mensaje: true,
                                    sold_in_call: false,
                                    date: new Date().toISOString().split('T')[0]
                                });
                                setSaleStep(2);
                                setSaleModalOpen(true);
                            }, 'ok', 'Registrar Cobro')}
                        </div>
                    </div>

                    <div className="space-y-1.5 text-left">
                        <label className="text-[10px] text-slate-500 font-bold uppercase block">Qué sucedió exactamente (Requerido)</label>
                        <textarea
                            rows={3}
                            value={sessionForm.notes}
                            onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Le recordé la cuota de este mes. Dijo que cobra el viernes y transfiere a primera hora del lunes..."
                            className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium custom-scrollbar"
                        />
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-850">
                        <div />
                        <button
                            onClick={saveSeguimientoReport}
                            disabled={!sessionForm.notes.trim() || !sessionForm.result || processingId === selectedLead.id}
                            className="h-9 px-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
                        >
                            {processingId === selectedLead.id ? <Loader2 size={12} className="animate-spin" /> : 'Completar Cobro'}
                        </button>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="h-screen overflow-y-auto bg-slate-950 text-slate-100 flex flex-col custom-scrollbar pb-32">
            
            {/* Header del Espacio de Trabajo Premium v6 */}
            <header className="top-v6 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
                <div className="topin">
                    <div className="brand-v6">
                        <div className="logo-v6">L</div>
                        <div>
                            <h1>Closer Workspace</h1>
                            <small>Learnation</small>
                        </div>
                    </div>
                    
                    <div className="search-v6">
                        <div className="sinner-v6">
                            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
                            <input 
                                id="q" 
                                placeholder="Buscar lead por nombre, @IG o examen…" 
                                autoComplete="off"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => { if (searchResults.length > 0) setShowSearchResults(true); }}
                            />
                            <select 
                                id="qscope"
                                value={searchScope}
                                onChange={(e) => setSearchScope(e.target.value)}
                            >
                                <option value="all">Todo</option>
                                <option value="confirm">Confirmaciones</option>
                                <option value="call">Llamadas</option>
                                <option value="seg">Seguimientos</option>
                                <option value="done">Resueltos</option>
                            </select>
                        </div>
                        {showSearchResults && (
                            <div id="qres" className="sresults-v6">
                                {searching ? (
                                    <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                        <Loader2 className="animate-spin text-pink-500" size={14} />
                                        <span>Buscando...</span>
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    searchResults.map((l) => {
                                        const appt = l.appointment;
                                        const result = appt ? appt.result || "" : "";
                                        const closerResult = appt ? appt.closer_result || "" : "";
                                        
                                        let label = 'Confirmación';
                                        let colorClass = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
                                        
                                        if (appt) {
                                            const resClean = result.toLowerCase();
                                            const closerResClean = closerResult.toLowerCase();
                                            
                                            if (closerResClean === 'show up' || closerResClean === 'cerrada' || closerResClean === 'cerrado') {
                                                label = 'Resuelto';
                                                colorClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                                            } else if (appt.fecha_seguimiento || closerResClean === 'no show' || closerResClean === 'cancelado' || closerResClean === 'reagendado') {
                                                label = 'Seguimiento';
                                                colorClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                                            } else if (resClean === 'confirmado') {
                                                label = 'Llamada';
                                                colorClass = 'bg-pink-500/10 text-pink-400 border border-pink-500/20';
                                            }
                                        }
                                        
                                        return (
                                            <div 
                                                key={l.id || Math.random()} 
                                                className="sres-v6" 
                                                onClick={() => handleSelectSearchResult(l)}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <b>{l.username || 'Sin Nombre'}</b>
                                                    <div className="text-xs text-slate-400 truncate">
                                                        {l.instagram ? `@${l.instagram.replace('@', '')}` : 'Sin Instagram'} • {l.phone || 'Sin Teléfono'} • {appt?.examen || 'Sin Examen'}
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${colorClass}`}>
                                                    {label}
                                                </span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-4 text-center text-xs text-slate-400">
                                        Sin resultados.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="who-v6">
                        <span className="lbl-v6">{user?.name || user?.username || 'Closer'}</span>
                        <div className="av-v6">
                            {(user?.name || user?.username || 'CL').substring(0, 2).toUpperCase()}
                        </div>
                    </div>
                </div>
            </header>

            {/* Área de Trabajo Principal */}
            <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 flex flex-col gap-6">
                
                {/* HERO SECTION v6 */}
                <div className="hero-v6">
                    <div className="hcard-v6">
                        <h2>Buen día, <em>{user?.name?.split(' ')[0] || user?.username || 'Closer'}</em> 👋</h2>
                        <p>Cada lead que resolvés es un dato que ya no tenés que inventar a las 11 de la noche.</p>
                        <div className="prog-v6">
                            <div className="pbarw-v6">
                                <i style={{ width: `${Math.min(100, Math.max(0, agendas.length ? Math.round((agendas.filter(a => a.closer_result && a.closer_result !== 'Pendiente').length / agendas.length) * 100) : 0))}%` }}></i>
                            </div>
                            <div className="pmeta-v6">
                                <span>{agendas.filter(a => a.closer_result && a.closer_result !== 'Pendiente').length} de {agendas.length} resueltos</span>
                                <span>{agendas.length ? Math.round((agendas.filter(a => a.closer_result && a.closer_result !== 'Pendiente').length / agendas.length) * 100) : 0}% completado</span>
                            </div>
                        </div>
                    </div>
                    <div className="stats-v6">
                        <div className="sbox-v6 a">
                            <div className="ic-v6">📅</div>
                            <div className="tt-v6">
                                <div className="n-v6">{counts.confirmations}<s>/{agendas.length}</s></div>
                                <div className="k-v6">Confirmaciones</div>
                                <div className="mb-v6"><i style={{ width: `${agendas.length ? Math.min(100, (counts.confirmations / agendas.length) * 100) : 0}%` }}></i></div>
                            </div>
                        </div>
                        <div className="sbox-v6 c">
                            <div className="ic-v6">📞</div>
                            <div className="tt-v6">
                                <div className="n-v6">{counts.calls}<s>/{agendas.length}</s></div>
                                <div className="k-v6">Llamadas reportadas</div>
                                <div className="mb-v6"><i style={{ width: `${agendas.length ? Math.min(100, (counts.calls / agendas.length) * 100) : 0}%` }}></i></div>
                            </div>
                        </div>
                        <div className="sbox-v6 b">
                            <div className="ic-v6">💬</div>
                            <div className="tt-v6">
                                <div className="n-v6">{counts.seguimientos}<s>/50</s></div>
                                <div className="k-v6">Seguimientos</div>
                                <div className="mb-v6"><i style={{ width: `${Math.min(100, (counts.seguimientos / 50) * 100)}%` }}></i></div>
                            </div>
                        </div>
                        <div className="sbox-v6 d">
                            <div className="ic-v6">🔥</div>
                            <div className="tt-v6">
                                <div className="n-v6">12<s> días</s></div>
                                <div className="k-v6">Racha sin fallar</div>
                                <div className="mb-v6"><i style={{ width: '86%' }}></i></div>
                            </div>
                        </div>
                    </div>
                </div>

                {activeView === 'inbox' ? (
                <div className="space-y-6">
                {/* Selector de Pestañas v6 */}
                <div className="tabs-v6">
                    <button 
                        className={`tab-v6 ${activeStep === 'confirmations' ? 'on' : ''}`}
                        data-b="true"
                        onClick={() => setSearchParams({ step: 'confirmations', selected_date: selectedDate })}
                    >
                        ① Confirmaciones 
                        <span className={`n-v6 ml-1.5 ${counts.confirmations > 0 ? 'bg-rose-500 text-white font-bold' : ''}`}>
                            {counts.confirmations}
                        </span>
                    </button>
                    <button 
                        className={`tab-v6 ${activeStep === 'calls' ? 'on' : ''}`}
                        onClick={() => setSearchParams({ step: 'calls', selected_date: selectedDate })}
                    >
                        ② Llamadas 
                        <span className={`n-v6 ml-1.5 ${counts.calls > 0 ? 'bg-amber-500 text-white font-bold' : ''}`}>
                            {counts.calls}
                        </span>
                    </button>
                    <button 
                        className={`tab-v6 ${activeStep === 'seguimientos' ? 'on' : ''}`}
                        onClick={() => setSearchParams({ step: 'seguimientos', selected_date: selectedDate })}
                    >
                        ③ Seguimientos 
                        <span className="n-v6 ml-1.5">{counts.seguimientos}</span>
                    </button>
                    <div className="flex-1"></div>
                    
                    {/* Filtro de fecha para llamadas y seguimientos */}
                    {(activeStep === 'calls' || activeStep === 'seguimientos') && (
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-1.5 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all cursor-pointer w-auto mr-3 text-center"
                        />
                    )}
                    <button 
                        className="tab-v6" 
                        onClick={() => setManualRefModalOpen(true)}
                        style={{ color: '#60A5FA' }}
                    >
                        🎁 Referido manual
                    </button>
                    <button 
                        className="tab-v6" 
                        onClick={() => setNewAgendaModalOpen(true)}
                        style={{ color: '#FFB3DE' }}
                    >
                        ＋ Nueva agenda
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Columna Única de Ancho Completo v7 */}
                <div className="lg:col-span-12 space-y-4">
                    
                    {activeStep === 'confirmations' ? (
                        /* Renderizado del Kanban de Confirmaciones */
                        loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="animate-spin text-pink-500" size={32} />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cargando confirmaciones...</span>
                            </div>
                        ) : filteredAgendas.length === 0 ? (
                            <div className="text-center py-16 text-slate-500 text-xs font-bold uppercase tracking-wide bg-[#111219]/95 border border-slate-900 rounded-[2rem]">
                                👏 No hay citas pendientes de confirmación.
                            </div>
                        ) : (
                            <div className="kb-v6">
                                {/* Columna Por confirmar */}
                                <div className="kcol-v6 k1-v6">
                                    <div className="kch-v6">
                                        <span className="dt-v6"></span>
                                        <b>Por confirmar</b>
                                        <span className="n-v6">{confirmationsPipeline.porConfirmar.length}</span>
                                    </div>
                                    <div className="kbody-v6">
                                        {confirmationsPipeline.porConfirmar.length > 0 ? (
                                            confirmationsPipeline.porConfirmar.map(a => renderKanbanCard(a, 'por_confirmar'))
                                        ) : (
                                            <div className="kempty-v6 done-v6">✓ Ninguno sin tocar</div>
                                        )}
                                    </div>
                                </div>

                                {/* Columna Conversando */}
                                <div className="kcol-v6 k2-v6">
                                    <div className="kch-v6">
                                        <span className="dt-v6"></span>
                                        <b>Conversando</b>
                                        <span className="n-v6">{confirmationsPipeline.conversando.length}</span>
                                    </div>
                                    <div className="kbody-v6">
                                        {confirmationsPipeline.conversando.length > 0 ? (
                                            confirmationsPipeline.conversando.map(a => renderKanbanCard(a, 'conversando'))
                                        ) : (
                                            <div className="kempty-v6">Sin leads conversando.</div>
                                        )}
                                    </div>
                                </div>

                                {/* Columna Confirmado */}
                                <div className="kcol-v6 k3-v6">
                                    <div className="kch-v6">
                                        <span className="dt-v6"></span>
                                        <b>Confirmado</b>
                                        <span className="n-v6">{confirmationsPipeline.confirmado.length}</span>
                                    </div>
                                    <div className="kbody-v6">
                                        {confirmationsPipeline.confirmado.length > 0 ? (
                                            confirmationsPipeline.confirmado.map(a => renderKanbanCard(a, 'confirmado'))
                                        ) : (
                                            <div className="kempty-v6">Sin leads confirmados.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    ) : (
                        /* Renderizado clásico de Lista para Llamadas y Seguimientos */
                        <>
                            {/* Sección Especial: Mensajes de Leads sin Agenda */}
                            {unreadNoAgenda.length > 0 && (
                                <div className="bg-rose-500/5 border border-rose-500/10 rounded-[2rem] p-6 space-y-4 shadow-xl shadow-rose-950/5">
                                    <h2 className="text-sm font-black text-rose-450 uppercase tracking-widest pl-1 flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                                        Mensajes pendientes de Leads sin Agenda ({unreadNoAgenda.length})
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {unreadNoAgenda.map((a) => {
                                            const isViewed = selectedLead?.id === a.id;
                                            
                                            return (
                                                <motion.div
                                                    key={a.id}
                                                    layout
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    onClick={() => handleSelectLead(a)}
                                                    className={`p-4 rounded-2xl border transition-all cursor-pointer text-left flex flex-col gap-3 relative overflow-hidden group ${
                                                        isViewed 
                                                            ? 'bg-violet-650/10 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.1)]' 
                                                            : 'bg-black/20 border-slate-900/60 hover:bg-slate-900/50 hover:border-slate-800'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                            <div className="min-w-0 space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-450 border border-rose-500/20 rounded-md animate-pulse">
                                                                        Mensaje nuevo
                                                                    </span>
                                                                    <h4 className="text-sm font-black text-white leading-tight truncate">
                                                                        {a.lead_name || 'Sin Nombre'}
                                                                    </h4>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-[10px] text-slate-500">
                                                                    {a.instagram && <span>@{a.instagram.replace('@', '')}</span>}
                                                                    {a.email && <span>• {a.email}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Barra de Acciones Masivas */}
                            {selectedIds.size > 0 && (
                                <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-left animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-400 px-3 py-1.5 rounded-xl border border-violet-500/20">
                                            {selectedIds.size} Agendas Marcadas
                                        </span>
                                        <button 
                                            onClick={() => setSelectedIds(new Set())}
                                            className="text-[9px] font-black uppercase text-slate-500 hover:text-white underline cursor-pointer"
                                        >
                                            Limpiar
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleBulkUpdate('Completada')}
                                            disabled={submittingBulk}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-650/20"
                                        >
                                            ✓ Asistió
                                        </button>
                                        <button
                                            onClick={() => handleBulkUpdate('No Show')}
                                            disabled={submittingBulk}
                                            className="px-4 py-2 bg-rose-650 hover:bg-rose-555 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-650/20"
                                        >
                                            ✕ No Show
                                        </button>
                                        <button
                                            onClick={() => handleBulkUpdate('Cancelada')}
                                            disabled={submittingBulk}
                                            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-650/20"
                                        >
                                            ✕ Canceló
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Contenedor de la Lista */}
                            <div className="bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 shadow-xl space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={filteredAgendas.length > 0 && selectedIds.size === filteredAgendas.length}
                                            onChange={toggleSelectAll}
                                            className="rounded bg-slate-950 border-slate-800 text-violet-500 focus:ring-0 cursor-pointer w-4 h-4"
                                        />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Seleccionar Todos
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-black bg-slate-900 text-slate-350 border border-slate-800 px-3 py-1 rounded-xl">
                                        {filteredAgendas.length} Citas en Lista
                                    </span>
                                </div>

                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <Loader2 className="animate-spin text-violet-500" size={32} />
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cargando agendas...</span>
                                    </div>
                                ) : filteredAgendas.length === 0 ? (
                                    <div className="text-center py-16 text-slate-500 text-xs font-bold uppercase tracking-wide">
                                        👏 No tienes agendas programadas.
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                                        <AnimatePresence initial={false}>
                                            {filteredAgendas.map((a) => {
                                                const isSelected = selectedIds.has(a.id);
                                                const isViewed = selectedLead?.id === a.id;
                                                
                                                return (
                                                    <motion.div
                                                        key={a.id}
                                                        layout
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95 }}
                                                        onClick={() => handleSelectLead(a)}
                                                        className={`p-4 rounded-2xl border transition-all cursor-pointer text-left flex flex-col gap-3 relative overflow-hidden group ${
                                                            isViewed 
                                                                ? 'bg-violet-650/10 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.1)]' 
                                                                : 'bg-black/20 border-slate-900/60 hover:bg-slate-900/50 hover:border-slate-800'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-4">
                                                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={(e) => toggleSelect(a.id, e)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="rounded bg-slate-950 border-slate-800 text-violet-500 focus:ring-0 cursor-pointer w-4 h-4 shrink-0"
                                                                />
                                                                
                                                                <div className="min-w-0 space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-black text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                                            <Clock size={10} />
                                                                            {formatTimeOnly(a.start_time)}
                                                                        </span>
                                                                        <h4 className="text-sm font-black text-white leading-tight truncate flex items-center gap-2">
                                                                            {a.lead_name || 'Sin Nombre'}
                                                                            {a.unread_comment && (
                                                                                <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-450 border border-rose-500/20 rounded-md animate-pulse">
                                                                                    Mensaje nuevo
                                                                                </span>
                                                                            )}
                                                                        </h4>
                                                                    </div>
                                                                    
                                                                    <div className="flex items-center gap-2 flex-wrap mt-1">
                                                                        <span className="text-[8px] font-black uppercase text-slate-500 bg-slate-950 border border-slate-900 px-2 py-0.5 rounded-md">
                                                                            {a.origin || 'Sheets'}
                                                                        </span>
                                                                        <span className="text-[8px] font-black uppercase text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md">
                                                                            Confirmer: {a.result || 'Pendiente'}
                                                                        </span>
                                                                        {a.fecha_seguimiento && (
                                                                            <span className="text-[8px] font-black uppercase text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                                <Calendar size={10} />
                                                                                Seguimiento: {a.fecha_seguimiento}
                                                                            </span>
                                                                        )}
                                                                        {a.instagram && (
                                                                            <span className="text-[10px] text-slate-500 flex items-center gap-0.5 font-mono">
                                                                                @{a.instagram}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-3 shrink-0">
                                                                {activeStep === 'seguimientos' && !a.seguimiento_realizado && (
                                                                    <button
                                                                        onClick={(e) => handleMarkFollowUpDone(a, e)}
                                                                        disabled={processingId === a.id}
                                                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
                                                                    >
                                                                        {processingId === a.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                                                        Marcar Realizado
                                                                    </button>
                                                                )}
                                                                <span className={`text-[9px] font-black px-2 py-1 rounded-xl uppercase tracking-wider ${
                                                                    a.closer_result === 'Show up' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                                                                    a.closer_result === 'No Show' ? 'bg-rose-500/10 text-rose-450 border border-rose-500/20' :
                                                                    a.closer_result === 'Cancelado' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                                                                    a.closer_result === 'Reagendado' ? 'bg-violet-500/10 text-violet-450 border border-violet-500/20' :
                                                                    a.closer_result === '2da call' ? 'bg-blue-500/10 text-blue-450 border border-blue-500/20' :
                                                                    'bg-slate-500/10 text-slate-450 border border-slate-500/20'
                                                                }`}>
                                                                    {a.closer_result || 'Pendiente'}
                                                                </span>
                                                                <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
                </div>
                </div>
                ) : (
                <div className="space-y-6 text-left">
                    {/* REPORTE DEL DÍA v6 (v-report) */}
                    {reportSent ? (
                        <div className="bg-gradient-to-r from-emerald-500/20 to-blue-600/20 border border-emerald-500/50 rounded-3xl p-6 flex items-center gap-5">
                            <div className="text-4xl">✅</div>
                            <div className="flex-1">
                                <h4 className="text-xl font-black text-white">Reporte del día enviado</h4>
                                <p className="text-xs text-slate-300 mt-1">
                                    {counts.confirmations} confirmados · {counts.calls} llamadas · {counts.seguimientos} seguimientos. Deuda de burpees: <b>{Math.max(0, 50 - counts.seguimientos)}</b>. Ya no te queda nada por completar hoy.
                                </p>
                            </div>
                            <div className="text-right">
                                <b className="text-xs font-black uppercase text-emerald-400 block">Enviado</b>
                                <small className="text-xs text-slate-400">{new Date().toLocaleDateString('es-ES')} · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                            </div>
                        </div>
                    ) : (
                        <div className={`p-5 rounded-2xl border flex items-center justify-between gap-4 ${
                            (counts.confirmations + counts.calls) > 0 
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' 
                                : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                        }`}>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{(counts.confirmations + counts.calls) > 0 ? '🏆' : '🔒'}</span>
                                <div>
                                    <h4 className="font-bold text-sm">
                                        {(counts.confirmations + counts.calls) > 0 ? 'Bandeja al día' : 'Bandeja con pendientes'}
                                    </h4>
                                    <p className="text-xs text-slate-400">
                                        {(counts.confirmations + counts.calls) > 0 
                                            ? 'Nadie sin tocar y llamadas reportadas.' 
                                            : `Quedan agendas por tocar o llamadas por reportar.`}
                                    </p>
                                </div>
                            </div>
                            <button className="px-4 py-2 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded-xl text-xs font-bold text-white transition-all cursor-pointer" onClick={() => setActiveView('inbox')}>
                                Ir a la bandeja
                            </button>
                        </div>
                    )}

                    {/* Referidos */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Referidos del día
                        </h3>
                        <p className="text-xs text-slate-400">El único embudo que el sistema no puede ver solo.</p>
                        
                        <div className="grid grid-cols-1 gap-3">
                            <div className="flex items-center gap-4 bg-slate-950/40 border border-slate-850 rounded-2xl p-3.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-black text-white">0</div>
                                <div className="flex-1 min-w-0">
                                    <b className="text-xs font-bold block text-white">Llamadas tomadas hoy</b>
                                    <small className="text-[10px] text-slate-500">Automático</small>
                                </div>
                                <div className="text-lg font-black text-pink-400">{counts.calls}</div>
                            </div>

                            <div className="flex items-center gap-4 bg-slate-950/40 border border-slate-850 rounded-2xl p-3.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-black text-white">1</div>
                                <div className="flex-1 min-w-0">
                                    <b className="text-xs font-bold block text-white">¿A cuántas les pediste referido?</b>
                                </div>
                                <input 
                                    type="number" 
                                    min="0"
                                    value={referrals.rf1}
                                    onChange={(e) => setReferrals(prev => ({ ...prev, rf1: parseInt(e.target.value) || 0 }))}
                                    className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-center font-bold text-sm text-white"
                                />
                            </div>

                            <div className="flex items-center gap-4 bg-slate-950/40 border border-slate-850 rounded-2xl p-3.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-black text-white">2</div>
                                <div className="flex-1 min-w-0">
                                    <b className="text-xs font-bold block text-white">¿Cuántas te dieron referido?</b>
                                </div>
                                <input 
                                    type="number" 
                                    min="0"
                                    value={referrals.rf2}
                                    onChange={(e) => setReferrals(prev => ({ ...prev, rf2: parseInt(e.target.value) || 0 }))}
                                    className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-center font-bold text-sm text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Reflexión Diaria */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span> Reflexión diaria
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-300 block">🏆 Victorias del día</label>
                                <textarea
                                    rows={3}
                                    value={reflection.win}
                                    onChange={(e) => setReflection(prev => ({ ...prev, win: e.target.value }))}
                                    placeholder="Qué te salió bien y por qué..."
                                    className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white custom-scrollbar focus:ring-1 focus:ring-pink-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-300 block">🔧 A mejorar mañana</label>
                                <textarea
                                    rows={3}
                                    value={reflection.fix}
                                    onChange={(e) => setReflection(prev => ({ ...prev, fix: e.target.value }))}
                                    placeholder="Una cosa concreta, no una lista..."
                                    className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white custom-scrollbar focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Enviar reporte */}
                    {!reportSent && (
                        <div className="flex items-center gap-4 pt-2">
                            <button
                                onClick={() => {
                                    setReportSent(true);
                                    toast.success("Reporte del día enviado con éxito");
                                }}
                                className="px-6 py-3.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black uppercase text-xs rounded-2xl shadow-lg shadow-pink-500/20 transition-all cursor-pointer"
                            >
                                Enviar reporte al sistema
                            </button>
                        </div>
                    )}
                </div>
                )}

            {/* Modal de Detalle de Lead v7 (ovLead) */}
            <AnimatePresence>
                {selectedLead && (
                    <div className="ov on" id="ovLead">
                        <motion.div
                            initial={{ opacity: 0, y: 18, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 18, scale: 0.97 }}
                            transition={{ duration: 0.2 }}
                            className="md"
                        >
                            {/* Cabecera mdh v7 */}
                            <div className="mdh">
                                <div style={{ flex: 1 }}>
                                    <h3>{(selectedLead.lead_name || 'Sin Nombre').toUpperCase()}</h3>
                                    <p>
                                        {activeStep === 'confirmations' ? 'Proceso de confirmación' : activeStep === 'calls' ? 'Reporte de llamada' : 'Seguimiento'}
                                        {selectedLead.date ? ` · ${selectedLead.date} ${selectedLead.time || ''}` : ''}
                                    </p>
                                </div>
                                <button
                                    className="p-2 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all cursor-pointer border border-rose-500/30 mr-2"
                                    title="Eliminar lead"
                                    onClick={() => handleDeleteLead(selectedLead.id, selectedLead.lead_name)}
                                >
                                    <X size={16} className="rotate-45" />
                                </button>
                                <button className="x" onClick={() => setSelectedLead(null)}>
                                    ×
                                </button>
                            </div>

                            {/* Pestañas ltabs v7 */}
                            <div className="ltabs">
                                <button
                                    className={`ltab ${modalTab === 'act' ? 'on' : ''}`}
                                    onClick={() => setModalTab('act')}
                                >
                                    ⚡ Acción
                                </button>
                                <button
                                    className={`ltab ${modalTab === 'form' ? 'on' : ''}`}
                                    onClick={() => setModalTab('form')}
                                >
                                    📋 Formulario
                                </button>
                                <button
                                    className={`ltab ${modalTab === 'set' ? 'on' : ''}`}
                                    onClick={() => setModalTab('set')}
                                >
                                    💬 Setter <span className="b">{selectedLead.setter_notes ? 1 : 0}</span>
                                </button>
                            </div>

                            {/* Cuerpo mdb v7 */}
                            <div className="mdb">
                                {/* Ficha idcard v7 */}
                                <div className="idcard">
                                    <div className="idc">
                                        <span>◎ Instagram</span>
                                        <b>@{String(selectedLead.instagram || 'no_ig').replace('@', '')}</b>
                                    </div>
                                    <div className="idc">
                                        <span>⤴ Fuente</span>
                                        <b>{selectedLead.origin || 'Sheets'}</b>
                                    </div>
                                    <div className="idc">
                                        <span>◈ Examen</span>
                                        <b>{selectedLead.examen || 'MIR / ENARM'}</b>
                                    </div>
                                    <div className="idc hl">
                                        <span>● Estado</span>
                                        <b>{selectedLead.closer_result || selectedLead.result || 'Sin reportar'}</b>
                                    </div>
                                </div>

                                {/* Contenido por pestaña */}
                                {modalTab === 'act' && (
                                    <div id="paneAct">
                                        <div className="trail">
                                            <span style={{ fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', color: '#8C99E0' }}>Camino:</span>
                                            {decisionPath.length === 0 ? (
                                                <span className="crumb" style={{ background: 'rgba(255,255,255,.06)', color: '#D1D8FF', borderColor: 'rgba(255,255,255,.12)' }}>
                                                    Raíz
                                                </span>
                                            ) : (
                                                decisionPath.map((crumb, idx) => (
                                                    <span key={idx} className="crumb">
                                                        {crumb}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                        <div id="ldBody">
                                            {renderActionStepContent()}
                                        </div>
                                    </div>
                                )}

                                {modalTab === 'form' && (
                                    <div id="paneForm">
                                        <div className="fsec">
                                            <div className="fh">
                                                <b>Calificación externa</b>
                                                <span className="tagx" style={{ background: 'rgba(99,102,241,.2)', color: '#A5B4FC' }}>n8n</span>
                                                <hr />
                                            </div>
                                            {renderFormQuestion("Instagram", `@${selectedLead.instagram || 'N/A'}`)}
                                            {renderFormQuestion("Fuente del Lead", selectedLead.origin || 'Meta Ads')}
                                            {renderFormQuestion("Setter", selectedLead.setter_name || 'Sin Asignar')}
                                        </div>

                                        <div className="fsec" style={{ marginTop: '20px' }}>
                                            <div className="fh">
                                                <b>Encuesta de cita</b>
                                                <span className="tagx" style={{ background: 'rgba(34,197,94,.2)', color: '#86EFAC' }}>✓ completada</span>
                                                <hr />
                                            </div>
                                            {selectedLead.survey_answers && selectedLead.survey_answers.length > 0 ? (
                                                selectedLead.survey_answers.map((ans, idx) => (
                                                    renderFormQuestion(ans.question, ans.answer, getCalificacionColor(ans.answer))
                                                ))
                                            ) : (
                                                <div className="note" style={{ background: 'rgba(255,255,255,.04)', borderLeft: '3px solid rgba(255,255,255,.12)' }}>
                                                    No hay respuestas a la encuesta registradas.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {modalTab === 'set' && (
                                    <div id="paneSet" className="space-y-4">
                                        <div className="note">
                                            Contexto de quien lo agendó y notas de cualificación.
                                        </div>
                                        {selectedLead.setter_notes ? (
                                            <div className="snote">
                                                <div className="sh">
                                                    <div className="sav">{(selectedLead.setter_name || 'S').charAt(0).toUpperCase()}</div>
                                                    <div className="sn">{selectedLead.setter_name || 'Setter'}</div>
                                                    <div className="sd">Nota Setter</div>
                                                </div>
                                                <p>"{selectedLead.setter_notes}"</p>
                                            </div>
                                        ) : (
                                            <div className="note" style={{ background: 'rgba(255,255,255,.04)', borderLeft: '3px solid rgba(255,255,255,.12)' }}>
                                                No hay notas previas del setter.
                                            </div>
                                        )}

                                        <div className="pt-4 border-t border-slate-800 space-y-3">
                                            <label className="text-[10px] font-black uppercase text-slate-400">Agregar nota rápida al lead</label>
                                            <textarea
                                                rows={3}
                                                value={reasonInput}
                                                onChange={(e) => setReasonInput(e.target.value)}
                                                placeholder="Escribe una nota interna para ti o para el equipo..."
                                                className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium custom-scrollbar"
                                            />
                                            <div className="flex flex-wrap gap-2 items-center pt-1">
                                                <span className="text-[9px] font-black uppercase text-slate-500">Mencionar:</span>
                                                {['@Elías', '@Jean Carlo', '@Sebastián', '@Dani'].map(m => (
                                                    <button
                                                        key={m}
                                                        type="button"
                                                        onClick={() => setReasonInput(prev => `${prev ? prev.trim() + ' ' : ''}${m} `)}
                                                        className="chipbtn"
                                                    >
                                                        {m}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                onClick={addLeadNote}
                                                disabled={reasonInput.trim().length < 5 || processingId === selectedLead.id}
                                                className="h-9 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                            >
                                                {processingId === selectedLead.id ? <Loader2 size={12} className="animate-spin" /> : 'Guardar Nota'}
                                            </button>
                                        </div>

                                        <div className="pt-4 border-t border-slate-800 space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-400">Comentarios e Hilo</label>
                                            <CommentsSection clientId={selectedLead.client_id || (selectedLead.id > 0 ? selectedLead.id : null)} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal de decisión: Con / Sin Decisor */}
            <AnimatePresence>
                {decisionMakerPrompt.apptId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2rem] p-6 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-200"
                        >
                            <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                                <Users size={22} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-black text-white uppercase italic tracking-tight">¿Asistió con Decisor?</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase">Indica si el tomador de decisiones estuvo presente en la llamada.</p>
                            </div>
                            <div className="flex flex-col gap-2.5 pt-2">
                                <button
                                    onClick={() => executeQuickAction(decisionMakerPrompt.apptId, 'Completada', true)}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                                >
                                    Sí, con Decisor
                                </button>
                                <button
                                    onClick={() => executeQuickAction(decisionMakerPrompt.apptId, 'Completada', false)}
                                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs uppercase tracking-widest rounded-xl border border-slate-700 transition-all cursor-pointer"
                                >
                                    No, sin Decisor
                                </button>
                                <button
                                    onClick={() => setDecisionMakerPrompt({ apptId: null })}
                                    className="w-full py-2.5 text-slate-500 hover:text-slate-400 font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Prompt intermedio: ¿Hubo venta? */}
            <AnimatePresence>
                {salePrompt.apptId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2rem] p-6 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-200"
                        >
                            <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                <DollarSign size={22} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-black text-white uppercase italic tracking-tight">¿Se cerró la venta?</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase">Indica si lograste cerrar la venta con este prospecto en la llamada.</p>
                            </div>
                            <div className="flex flex-col gap-2.5 pt-2">
                                <button
                                    onClick={() => {
                                        setSalePrompt({ apptId: null });
                                        setSaleStep(1);
                                        setSaleModalOpen(true);
                                    }}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-650/20 animate-pulse"
                                >
                                    Sí, Declarar Venta
                                </button>
                                <button
                                    onClick={() => {
                                        const apptId = salePrompt.apptId;
                                        const appt = agendas.find(a => a.id === apptId);
                                        setSalePrompt({ apptId: null });
                                        if (apptId) {
                                            setFollowUpModal({
                                                show: true,
                                                agendaId: apptId,
                                                leadName: appt?.lead_name || 'Prospecto',
                                                newStatus: 'Cierre de Venta',
                                                isSaleFollowUp: false
                                            });
                                        } else {
                                            fetchAgendas();
                                        }
                                    }}
                                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs uppercase tracking-widest rounded-xl border border-slate-700 transition-all cursor-pointer"
                                >
                                    No hubo venta (Configurar Seguimiento)
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal de declaración de venta por pasos */}
            <AnimatePresence>
                {saleModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden text-left flex flex-col space-y-6 max-h-[90vh] custom-scrollbar"
                        >
                            {/* Ambient Brillo */}
                            <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                                <div className="absolute top-0 right-0 w-64 h-64 blur-[120px] opacity-10 bg-indigo-500" />
                            </div>

                            <div className="flex justify-between items-center pb-4 border-b border-slate-800 relative z-10">
                                <div>
                                    <h3 className="text-lg font-black text-white uppercase italic tracking-tight flex items-center gap-2">
                                        <DollarSign size={20} className="text-emerald-405" />
                                        Declarar Venta
                                    </h3>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Sincronización directa con Google Sheets</p>
                                </div>
                                <button
                                    onClick={() => {
                                        const apptId = salePrompt.apptId;
                                        setSaleModalOpen(false);
                                        setSalePrompt({ apptId: null });
                                        if (apptId) {
                                            const appt = agendas.find(a => a.id === apptId);
                                            setFollowUpModal({
                                                show: true,
                                                agendaId: apptId,
                                                leadName: appt?.lead_name || 'Prospecto',
                                                newStatus: 'Cierre de Venta',
                                                isSaleFollowUp: false
                                            });
                                        } else {
                                            fetchAgendas();
                                        }
                                    }}
                                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Indicador de pasos premium */}
                            <div className="flex items-center justify-between px-4 py-2 bg-slate-950/40 rounded-2xl border border-slate-800 relative z-10">
                                {[
                                    { step: 1, label: "Cliente" },
                                    { step: 2, label: "Transacción" },
                                    { step: 3, label: "Confirmación" }
                                ].map((s, idx) => (
                                    <React.Fragment key={s.step}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border transition-all ${
                                                saleStep > s.step 
                                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                                                    : saleStep === s.step
                                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/35'
                                                    : 'bg-slate-800 border-slate-700 text-slate-500'
                                            }`}>
                                                {saleStep > s.step ? <Check size={10} /> : s.step}
                                            </div>
                                            <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${
                                                saleStep === s.step ? 'text-white font-bold' : 'text-slate-500'
                                            }`}>
                                                {s.label}
                                            </span>
                                        </div>
                                        {idx < 2 && (
                                            <div className={`flex-1 h-0.5 mx-4 transition-all duration-300 ${
                                                saleStep > s.step ? 'bg-emerald-500/50' : 'bg-slate-800'
                                            }`} />
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>

                            {/* Contenido del Paso */}
                            <div className="flex-1 py-2 relative z-10 overflow-y-auto custom-scrollbar pr-1">
                                {saleStep === 1 && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest text-left">Paso 1: Información del Prospecto</h4>
                                            <p className="text-[10px] text-slate-550 font-bold uppercase text-left">Revisa los datos obtenidos de la agenda y completa el documento de identidad.</p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                            <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo *</label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><User size={13} /></span>
                                                    <input
                                                        type="text"
                                                        value={saleForm.nombre_cliente}
                                                        onChange={e => setSaleForm({ ...saleForm, nombre_cliente: e.target.value })}
                                                        placeholder="ej. Juan Pérez"
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Instagram *</label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><Instagram size={13} /></span>
                                                    <input
                                                        type="text"
                                                        value={saleForm.instagram}
                                                        onChange={e => setSaleForm({ ...saleForm, instagram: e.target.value })}
                                                        placeholder="ej. @juanperez"
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Email del Cliente *</label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><Mail size={13} /></span>
                                                    <input
                                                        type="email"
                                                        value={saleForm.mail_cliente}
                                                        onChange={e => setSaleForm({ ...saleForm, mail_cliente: e.target.value })}
                                                        placeholder="ej. juan@gmail.com"
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Teléfono</label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><Phone size={13} /></span>
                                                    <input
                                                        type="text"
                                                        value={saleForm.telefono}
                                                        onChange={e => setSaleForm({ ...saleForm, telefono: e.target.value })}
                                                        placeholder="ej. +34600000000"
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1 text-left md:col-span-2">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Documento de identidad (DNI, NIE, Pasaporte)</label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><PenTool size={13} /></span>
                                                    <input
                                                        type="text"
                                                        value={saleForm.documento_identidad}
                                                        onChange={e => setSaleForm({ ...saleForm, documento_identidad: e.target.value })}
                                                        placeholder="Ingresa la cédula o DNI"
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1 text-left md:col-span-2">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Vendedor (Closer Asignado) *</label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><User size={13} /></span>
                                                    <input
                                                        type="email"
                                                        value={saleForm.email_vendedor}
                                                        onChange={e => setSaleForm({ ...saleForm, email_vendedor: e.target.value })}
                                                        placeholder="email@vendedor.com"
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                                        required
                                                    />
                                                </div>
                                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Confirma que sea el correo correcto para la atribución de comisiones.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {saleStep === 2 && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest text-left">Paso 2: Detalles de la Transacción</h4>
                                            <p className="text-[10px] text-slate-550 font-bold uppercase text-left">Define el programa académico, método y monto recaudado de la venta.</p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                            <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Programa Académico *</label>
                                                <select
                                                    value={saleForm.programa}
                                                    onChange={e => setSaleForm({ ...saleForm, programa: e.target.value })}
                                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                                    required
                                                >
                                                    <option value="RR">Residency Roadmap (RR)</option>
                                                    <option value="AL">Ace Learner (AL)</option>
                                                    <option value="SI">Specialist Initiative (SI)</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Pago *</label>
                                                <select
                                                    value={saleForm.tipo_pago_simple}
                                                    onChange={e => setSaleForm({ ...saleForm, tipo_pago_simple: e.target.value })}
                                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                                    required
                                                >
                                                    <option value="completo">Completo (PIF)</option>
                                                    <option value="parcial">Parcial (Primer Pago)</option>
                                                    <option value="Seña">Seña (Promesa)</option>
                                                    <option value="Cuota">Cuotas</option>
                                                    <option value="Renovacion">Renovación</option>
                                                    <option value="Upsell">Upsell</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Monto Cobrado (USD) *</label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><DollarSign size={13} /></span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={saleForm.monto}
                                                        onChange={e => setSaleForm({ ...saleForm, monto: e.target.value })}
                                                        placeholder="0.00"
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Método de Pago *</label>
                                                <select
                                                    value={saleForm.metodo_pago}
                                                    onChange={e => setSaleForm({ ...saleForm, metodo_pago: e.target.value })}
                                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
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
                                            <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-emerald-400 uppercase tracking-widest ml-1 block flex items-center gap-1">
                                                    <CalendarDays size={12} className="text-emerald-400" />
                                                    Fecha del Próximo Cobro (Seguimiento)
                                                </label>
                                                <input
                                                    type="date"
                                                    value={saleForm.fecha_cobro || ''}
                                                    onChange={e => setSaleForm({ ...saleForm, fecha_cobro: e.target.value })}
                                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-emerald-500 transition-all cursor-pointer"
                                                />
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Comentario / Detalles del Cobro</label>
                                                <input
                                                    type="text"
                                                    value={saleForm.segundo_pago || ''}
                                                    onChange={e => setSaleForm({ ...saleForm, segundo_pago: e.target.value })}
                                                    placeholder="ej. Cobro de $500 (2do pago / saldo)"
                                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {saleStep === 3 && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest text-left">Paso 3: Confirmación y Notas</h4>
                                            <p className="text-[10px] text-slate-550 font-bold uppercase text-left">Agrega observaciones finales, revisa la fecha y confirma el envío de mensajes.</p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                            <div className="space-y-1 text-left md:col-span-2">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Examen del Lead (ej. USMLE Step 1)</label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><PenTool size={13} /></span>
                                                    <input
                                                        type="text"
                                                        value={saleForm.examen_lead}
                                                        onChange={e => setSaleForm({ ...saleForm, examen_lead: e.target.value })}
                                                        placeholder="ej. USMLE Step 1"
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha de la Venta *</label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><Calendar size={13} /></span>
                                                    <input
                                                        type="date"
                                                        value={saleForm.date}
                                                        onChange={e => setSaleForm({ ...saleForm, date: e.target.value })}
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Estado de la Venta *</label>
                                                <select
                                                    value={saleForm.estado}
                                                    onChange={e => setSaleForm({ ...saleForm, estado: e.target.value })}
                                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                                    required
                                                >
                                                    <option value="Completada">Completada</option>
                                                    <option value="Pendiente">Pendiente</option>
                                                    <option value="Cancelada">Cancelada</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1 text-left md:col-span-2">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Notas de la Venta / Observaciones</label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-3 text-slate-500"><PenTool size={13} /></span>
                                                    <textarea
                                                        value={saleForm.notas}
                                                        onChange={e => setSaleForm({ ...saleForm, notas: e.target.value })}
                                                        placeholder="Detalles sobre el cierre, objeciones vencidas, etc..."
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder-slate-650 outline-none focus:border-indigo-500 transition-all min-h-[70px] resize-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="md:col-span-2 space-y-2">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 block text-left">¿Venta Cerrada en Llamada?</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSaleForm({ ...saleForm, sold_in_call: true })}
                                                        className={`p-3.5 rounded-2xl border font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                                            saleForm.sold_in_call
                                                                ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10'
                                                                : 'bg-slate-850/40 border-slate-800 text-slate-450 hover:border-slate-700'
                                                        }`}
                                                    >
                                                        <CheckCircle2 size={13} className={saleForm.sold_in_call ? 'opacity-100' : 'opacity-40'} />
                                                        Sí, en Meet
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSaleForm({ ...saleForm, sold_in_call: false })}
                                                        className={`p-3.5 rounded-2xl border font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                                            !saleForm.sold_in_call
                                                                ? 'bg-gradient-to-r from-rose-500/20 to-orange-500/20 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/10'
                                                                : 'bg-slate-855/40 border-slate-800 text-slate-450 hover:border-slate-700'
                                                        }`}
                                                    >
                                                        <X size={13} className={!saleForm.sold_in_call ? 'opacity-100' : 'opacity-40'} />
                                                        No, fuera
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Pie del Modal: Controles de paso */}
                            <div className="flex justify-between items-center pt-4 border-t border-slate-800 relative z-10">
                                {saleStep > 1 ? (
                                    <button
                                        type="button"
                                        onClick={handlePrevStep}
                                        className="h-9 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-slate-750"
                                    >
                                        <ArrowLeft size={12} />
                                        Anterior
                                    </button>
                                ) : (
                                    <div />
                                )}

                                {saleStep < 3 ? (
                                    <button
                                        type="button"
                                        onClick={handleNextStep}
                                        className="h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                        Siguiente
                                        <ArrowRight size={12} />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleRegisterSale}
                                        disabled={submittingSale}
                                        className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        {submittingSale ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                        {submittingSale ? 'Guardando...' : 'Registrar Venta'}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal de Motivo / Razón de Cambio (Reemplazo de window.prompt) */}
            <AnimatePresence>
                {reasonModal.show && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in text-left">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 relative"
                        >
                            <div className="flex justify-between items-start border-b border-slate-800/80 pb-4">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">
                                        Closer Workflow
                                    </span>
                                    <h3 className="text-lg font-black text-white italic tracking-tight">
                                        {reasonModal.title}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setReasonModal(prev => ({ ...prev, show: false }))}
                                    className="text-slate-500 hover:text-white transition-colors p-1 cursor-pointer bg-transparent border-none"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <p className="text-xs text-slate-300 font-medium leading-relaxed">
                                {reasonModal.description}
                            </p>

                            {reasonModal.actionType !== 'no_lead' && (
                                <div className="space-y-2">
                                    <textarea
                                        rows={3}
                                        value={reasonInput}
                                        onChange={(e) => setReasonInput(e.target.value)}
                                        placeholder={reasonModal.placeholder}
                                        className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium custom-scrollbar"
                                    />
                                </div>
                            )}

                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setReasonModal(prev => ({ ...prev, show: false }))}
                                    className="flex-1 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (reasonModal.requireText && !reasonInput.trim()) {
                                            toast.error("Por favor ingresa un motivo");
                                            return;
                                        }
                                        handleConfirmReason(reasonInput.trim());
                                    }}
                                    className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2 cursor-pointer border-none"
                                >
                                    <Check size={14} />
                                    <span>{reasonModal.confirmText || 'Guardar'}</span>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal de Configuración de Seguimiento */}
            <TriageFollowUpModal
                show={followUpModal.show}
                onClose={() => setFollowUpModal({ show: false, agendaId: null, leadName: '', newStatus: '', isSaleFollowUp: false })}
                onConfirm={handleConfirmFollowUp}
                onMarkLost={handleMarkLeadLost}
                leadName={followUpModal.leadName}
                newStatus={followUpModal.newStatus}
                subtitle="Closer Workflow"
                isSaleFollowUp={followUpModal.isSaleFollowUp}
                loading={savingFollowUp}
            />

            {/* Modal Nueva Agenda v7 (ovNew) */}
            <AnimatePresence>
                {newAgendaModalOpen && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md text-left">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 max-w-lg w-full shadow-2xl space-y-5 relative text-slate-100"
                        >
                            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                                <div>
                                    <h3 className="text-lg font-black text-white italic">Nueva agenda</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Referidos · leads propios</p>
                                </div>
                                <button onClick={() => setNewAgendaModalOpen(false)} className="text-slate-500 hover:text-white p-1">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre <span className="text-pink-500">*</span></label>
                                        <input
                                            value={newAgendaForm.lead_name}
                                            onChange={(e) => setNewAgendaForm(prev => ({ ...prev, lead_name: e.target.value }))}
                                            placeholder="Carla Mendoza"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Instagram <span className="text-pink-500">*</span></label>
                                        <input
                                            value={newAgendaForm.instagram}
                                            onChange={(e) => setNewAgendaForm(prev => ({ ...prev, instagram: e.target.value }))}
                                            placeholder="@usuario"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha <span className="text-pink-500">*</span></label>
                                        <input
                                            type="date"
                                            value={newAgendaForm.date}
                                            onChange={(e) => setNewAgendaForm(prev => ({ ...prev, date: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs font-bold text-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Hora <span className="text-pink-500">*</span></label>
                                        <input
                                            type="time"
                                            value={newAgendaForm.time}
                                            onChange={(e) => setNewAgendaForm(prev => ({ ...prev, time: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs font-bold text-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Fuente <span className="text-pink-500">*</span></label>
                                        <select
                                            value={newAgendaForm.origin}
                                            onChange={(e) => setNewAgendaForm(prev => ({ ...prev, origin: e.target.value }))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs font-bold text-white"
                                        >
                                            <option value="Setter">Setter</option>
                                            <option value="Workshop">Workshop</option>
                                            <option value="VSL">VSL</option>
                                            <option value="Referido">Referido</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Examen objetivo</label>
                                    <input
                                        value={newAgendaForm.examen}
                                        onChange={(e) => setNewAgendaForm(prev => ({ ...prev, examen: e.target.value }))}
                                        placeholder="ENARM / STEP 1 / MIR…"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                                <button type="button" onClick={() => setNewAgendaModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold uppercase">
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCreateAgenda}
                                    disabled={processingId === 'new_agenda'}
                                    className="px-5 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    {processingId === 'new_agenda' ? 'Creando...' : 'Crear y mandar a confirmar'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal Referido Manual v7 (ovRef) */}
            <AnimatePresence>
                {manualRefModalOpen && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md text-left">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 max-w-lg w-full shadow-2xl space-y-5 relative text-slate-100"
                        >
                            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                                <div>
                                    <h3 className="text-lg font-black text-white italic">🎁 Agregar referido</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sin lead de origen no hay trazabilidad</p>
                                </div>
                                <button onClick={() => setManualRefModalOpen(false)} className="text-slate-500 hover:text-white p-1">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl text-[10px] text-slate-400 font-bold uppercase leading-relaxed">
                                Todo referido tiene que colgar de alguien. Así sabés qué perfil de cliente refiere y cuánto vale cada referido en ventas.
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">¿Quién te lo pasó? <span className="text-pink-500">*</span></label>
                                    {manualRefForm.from_lead_name ? (
                                        <div className="flex justify-between items-center p-3 bg-violet-500/10 border border-violet-500/30 rounded-xl">
                                            <span className="text-xs font-bold text-violet-300">Colgado de: {manualRefForm.from_lead_name}</span>
                                            <button onClick={() => setManualRefForm(prev => ({ ...prev, from_lead_id: null, from_lead_name: '' }))} className="text-[10px] text-pink-400 font-bold underline">Cambiar</button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <input
                                                value={refSearchQuery}
                                                onChange={async (e) => {
                                                    const q = e.target.value;
                                                    setRefSearchQuery(q);
                                                    if (q.trim().length >= 2) {
                                                        try {
                                                            const res = await api.get(`/closer/leads/search?q=${encodeURIComponent(q)}`);
                                                            setRefSearchResults(res.data || []);
                                                        } catch (err) {
                                                            console.error(err);
                                                        }
                                                    } else {
                                                        setRefSearchResults([]);
                                                    }
                                                }}
                                                placeholder="Buscá el lead que te dio el referido…"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                                            />
                                            {refSearchResults.length > 0 && (
                                                <div className="max-h-40 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-850">
                                                    {refSearchResults.map(l => (
                                                        <div
                                                            key={l.id}
                                                            onClick={() => {
                                                                setManualRefForm(prev => ({ ...prev, from_lead_id: l.appointment?.id || l.id, from_lead_name: l.username || l.lead_name }));
                                                                setRefSearchResults([]);
                                                                setRefSearchQuery('');
                                                            }}
                                                            className="p-2.5 hover:bg-violet-500/10 cursor-pointer text-xs font-bold text-slate-200 flex justify-between"
                                                        >
                                                            <span>{l.username || l.lead_name}</span>
                                                            <span className="text-[10px] text-slate-500">{l.instagram ? `@${l.instagram}` : ''}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre del referido <span className="text-pink-500">*</span></label>
                                        <input
                                            value={manualRefForm.lead_name}
                                            onChange={(e) => setManualRefForm(prev => ({ ...prev, lead_name: e.target.value }))}
                                            placeholder="Ej: Carla Mendoza"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Instagram o teléfono</label>
                                        <input
                                            value={manualRefForm.contact}
                                            onChange={(e) => setManualRefForm(prev => ({ ...prev, contact: e.target.value }))}
                                            placeholder="@usuario o +52 ..."
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Contexto</label>
                                    <textarea
                                        rows={2}
                                        value={manualRefForm.notes}
                                        onChange={(e) => setManualRefForm(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="Es su compañera de guardia, también rinde ENARM en marzo."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white custom-scrollbar"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                                <button type="button" onClick={() => setManualRefModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold uppercase">
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveManualRef}
                                    disabled={!manualRefForm.from_lead_id || !manualRefForm.lead_name.trim() || processingId === 'manual_ref'}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    {processingId === 'manual_ref' ? 'Guardando...' : 'Crear referido'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* DOCK FLOTANTE v6 */}
            <div className={`dock-v6 ${reportSent ? 'done-v6' : ''}`}>
                <button 
                    className={`dk-v6 ${activeView === 'inbox' ? 'on' : ''}`}
                    onClick={() => setActiveView('inbox')}
                >
                    <span>📥 Bandeja</span>
                    {(counts.confirmations + counts.calls + counts.seguimientos) > 0 && (
                        <span className="b-v6">{counts.confirmations + counts.calls + counts.seguimientos}</span>
                    )}
                </button>
                <button 
                    className={`dk-v6 ${activeView === 'report' ? 'on' : ''} ${reportSent ? 'sent' : ''}`}
                    onClick={() => setActiveView('report')}
                >
                    {reportSent ? (
                        <span>✓ Reporte enviado</span>
                    ) : (
                        <span>📊 Reporte del día</span>
                    )}
                </button>
            </div>
        </div>
        </div>
    );
};

export default CloserWorkflowPage;
