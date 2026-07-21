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
    
    const activeStep = searchParams.get('step') || 'agendas';

    // Agendas y carga
    const [agendas, setAgendas] = useState([]);
    const [unreadNoAgenda, setUnreadNoAgenda] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [submittingBulk, setSubmittingBulk] = useState(false);
    
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
    
    // Cita seleccionada para el visor de la derecha
    const [selectedLead, setSelectedLead] = useState(null);

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
                await api.post(`/closer/appointments/${apptId}/process`, { status: 'No Lead', note: note });
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

    const handleSelectLead = (lead) => {
        setSelectedLead(lead);
        setAgendas(prev => prev.map(item => item.id === lead.id ? { ...item, unread_comment: false } : item));
        setUnreadNoAgenda(prev => prev.map(item => item.id === lead.id ? { ...item, unread_comment: false } : item));
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

    return (
        <div className="h-screen overflow-y-auto bg-slate-950 text-slate-100 flex flex-col custom-scrollbar pb-32">
            
            {/* Header del Espacio de Trabajo */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 space-y-4">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-white italic uppercase tracking-tight flex items-center gap-2">
                            Closer Workspace
                        </h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            Flujo de Trabajo Operativo • {activeStep === 'seguimientos' ? '2. Seguimientos por Hacer' : activeStep === 'reagendar' ? '3. Reagendar / Actualizar' : '1. Citas del Día'}
                        </p>
                    </div>

                    {/* Selector de Pestaña de Categoría */}
                    <div className="flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800/80">
                        <button
                            onClick={() => setSearchParams({ step: 'agendas', selected_date: selectedDate })}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeStep === 'agendas'
                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                            }`}
                        >
                            <Calendar size={12} />
                            <span>Citas del Día</span>
                        </button>
                        <button
                            onClick={() => setSearchParams({ step: 'seguimientos', selected_date: selectedDate })}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeStep === 'seguimientos'
                                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                            }`}
                        >
                            <Clock size={12} />
                            <span>Seguimientos por Hacer</span>
                        </button>
                        <button
                            onClick={() => setSearchParams({ step: 'reagendar', selected_date: selectedDate })}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeStep === 'reagendar'
                                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/25'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                            }`}
                        >
                            <RefreshCw size={12} />
                            <span>Reagendar / Actualizar</span>
                        </button>
                    </div>

                    {/* Controles de Búsqueda y Filtro de Fecha */}
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        {(activeStep === 'agendas' || activeStep === 'seguimientos') && (
                            <div className="relative">
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-slate-900 border border-slate-800/80 rounded-xl px-4 py-2 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all cursor-pointer font-bold"
                                />
                            </div>
                        )}
                        <div className="relative w-full md:w-64">
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
            </div>

            {/* Área de Trabajo Principal */}
            <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Columna Izquierda: Cola de Citas del Día (ancho completo en agendas) */}
                <div className={`${activeStep === 'agendas' ? 'lg:col-span-12' : 'lg:col-span-7'} space-y-4`}>
                    
                    {/* Sección Especial: Mensajes de Leads sin Agenda */}
                    {activeStep === 'agendas' && unreadNoAgenda.length > 0 && (
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
                                {filteredAgendas.length} Confirmadas Hoy
                            </span>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="animate-spin text-violet-500" size={32} />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cargando agendas...</span>
                            </div>
                        ) : filteredAgendas.length === 0 ? (
                            <div className="text-center py-16 text-slate-500 text-xs font-bold uppercase tracking-wide">
                                👏 No tienes agendas programadas para el día de hoy.
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                                <AnimatePresence initial={false}>
                                    {filteredAgendas.map((a) => {
                                        const isSelected = selectedIds.has(a.id);
                                        const isViewed = selectedLead?.id === a.id;
                                        const isRescheduling = rescheduleData.apptId === a.id;
                                        
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
                                                    {/* Checkbox y Nombre */}
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
                                                                        <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md animate-pulse">
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
                                                                {a.is_rescheduled && (
                                                                    <span className="text-[8px] font-black uppercase text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-md">
                                                                        Reagenda
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

                                                    {/* Estado actual e indicador */}
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
                </div>

                {/* Columna Derecha: Visor Detallado - Oculto en agendas */}
                {activeStep !== 'agendas' && (
                    <div className="lg:col-span-5 h-[76vh] overflow-y-auto custom-scrollbar sticky top-28 bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 shadow-xl">
                        {selectedLead ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                                    <h3 className="text-xs font-black text-violet-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <AlertCircle size={13} />
                                        Ficha de Seguimiento
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
                                    availableKeywords={[]}
                                    userRole={user?.role}
                                    appointmentId={selectedLead.id}
                                    compact={true}
                                    onUpdate={() => {
                                        fetchAgendas();
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center text-slate-500 mb-4 shadow-xl">
                                    <Users size={28} />
                                </div>
                                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                                    Perfil del Prospecto
                                </h3>
                                <p className="text-[10px] text-slate-655 font-bold uppercase tracking-wider mt-1.5 max-w-xs leading-relaxed">
                                    Selecciona una cita de la agenda de hoy para calificar objeciones, guardar notas e investigar respuestas del prospecto.
                                </p>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Modal de Detalle de Agenda Custom (para agendas del Closer) */}
            <AnimatePresence>
                {activeStep === 'agendas' && selectedLead && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden text-left relative flex flex-col max-h-[90vh] text-slate-100 animate-in zoom-in-95 duration-250"
                        >
                            {/* Cabecera */}
                            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                                        <AlertCircle size={20} className="text-violet-400" />
                                        {selectedLead.lead_name || 'Sin Nombre'}
                                    </h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                        Ficha Operativa de Cierre • ID Cita: #{selectedLead.id}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedLead(null)}
                                    className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer border-none bg-transparent"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            
                            {/* Grid principal */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 pr-2">
                                {/* Columna Izquierda: Info y Acciones */}
                                <div className="lg:col-span-7 space-y-6">
                                    {/* Bloque 1: Info Principal del Lead */}
                                    <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-4">
                                        <h4 className="text-[10px] font-black text-violet-400 uppercase tracking-wider border-b border-slate-900 pb-2">
                                            Información del Prospecto
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-slate-500 uppercase font-black block">Instagram</span>
                                                {selectedLead.instagram ? (
                                                    <a
                                                        href={selectedLead.ig_chat_link || `https://instagram.com/${selectedLead.instagram.replace('@', '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-violet-400 hover:text-violet-300 font-black hover:underline inline-flex items-center gap-1.5"
                                                    >
                                                        <Instagram size={12} />
                                                        @{selectedLead.instagram.replace('@', '')}
                                                        <ExternalLink size={10} />
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400 font-bold">No asignado</span>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-slate-500 uppercase font-black block">Fuente del Lead</span>
                                                <span className="text-slate-200 font-bold">{selectedLead.origin || 'Meta Ads / ManyChat'}</span>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-slate-500 uppercase font-black block">Email</span>
                                                <span className="text-slate-350 font-bold">{selectedLead.email || 'N/A'}</span>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-slate-500 uppercase font-black block">Teléfono</span>
                                                <span className="text-slate-350 font-bold">{selectedLead.phone || 'N/A'}</span>
                                            </div>
                                            <div className="space-y-1 sm:col-span-2">
                                                <span className="text-[9px] text-slate-500 uppercase font-black block">Setter Asignado</span>
                                                <span className="text-slate-200 font-black">{selectedLead.setter_name || 'Sin Asignar'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bloque 2: Notas del Setter */}
                                    {selectedLead.setter_notes && (
                                        <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-2">
                                            <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-wider">
                                                Notas de Cualificación (Setter)
                                            </h4>
                                            <p className="text-xs text-slate-300 italic leading-relaxed">
                                                "{selectedLead.setter_notes}"
                                            </p>
                                        </div>
                                    )}

                                    {/* Bloque 3: Respuestas del Formulario */}
                                    {selectedLead.survey_answers && selectedLead.survey_answers.length > 0 && (
                                        <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-3">
                                            <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-wider border-b border-slate-900 pb-2">
                                                Respuestas de la Encuesta
                                            </h4>
                                            <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                                {selectedLead.survey_answers.map((ans, index) => (
                                                    <div key={index} className="space-y-0.5 border-l-2 border-emerald-500/20 pl-3">
                                                        <p className="text-[9px] font-bold text-slate-500 leading-tight">{ans.question}</p>
                                                        <p className="text-xs font-black text-slate-200">{ans.answer || 'Sin respuesta'}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Bloque 4: Modificar Estado (Acciones del Closer) */}
                                    <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                                            <h4 className="text-[10px] font-black text-violet-400 uppercase tracking-wider">
                                                Modificar Estado del Lead
                                            </h4>
                                            <span className="text-[10px] font-black uppercase bg-violet-650/20 text-violet-400 border border-violet-500/25 px-2.5 py-0.5 rounded-lg">
                                                Actual: {selectedLead.closer_result || 'Pendiente'}
                                            </span>
                                        </div>
                                        {selectedLead.id < 0 ? (
                                            <div className="py-6 px-6 bg-slate-950/40 rounded-2xl border border-slate-850/50 text-xs font-semibold text-slate-400 text-center italic">
                                                Este lead no posee una cita agendada para hoy. Utiliza la sección de Notas & Comentarios a la derecha para comunicarte.
                                            </div>
                                        ) : (
                                            <>
                                                {/* Botonera de acciones rápidas */}
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={(e) => { handleQuickAction(selectedLead.id, 'Completada', e); setSelectedLead(null); }}
                                                        disabled={processingId === selectedLead.id}
                                                        className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                    >
                                                        Asistió
                                                    </button>
                                                    <button
                                                        onClick={(e) => { handleQuickAction(selectedLead.id, 'No Show', e); setSelectedLead(null); }}
                                                        disabled={processingId === selectedLead.id}
                                                        className="h-10 px-4 bg-rose-650/90 hover:bg-rose-550 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                    >
                                                        No Show
                                                    </button>
                                                    <button
                                                        onClick={(e) => { handleQuickAction(selectedLead.id, 'Cancelada', e); setSelectedLead(null); }}
                                                        disabled={processingId === selectedLead.id}
                                                        className="h-10 px-4 bg-amber-600/90 hover:bg-amber-505 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                    >
                                                        Canceló
                                                    </button>
                                                    <button
                                                        onClick={() => setRescheduleData({ apptId: selectedLead.id, date: '', status: 'Reprogramada' })}
                                                        disabled={processingId === selectedLead.id}
                                                        className="h-10 px-4 bg-violet-650/80 hover:bg-violet-550 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                    >
                                                        Reagendar
                                                    </button>
                                                    <button
                                                        onClick={() => setRescheduleData({ apptId: selectedLead.id, date: '', status: 'Primera Agenda' })}
                                                        disabled={processingId === selectedLead.id}
                                                        className="h-10 px-4 bg-blue-650/80 hover:bg-blue-550 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                    >
                                                        2ª Llamada
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            if (e) e.stopPropagation();
                                                            setReasonInput('');
                                                            setReasonModal({
                                                                show: true,
                                                                title: "Calificar como No Lead",
                                                                description: `¿Seguro que deseas calificar a ${selectedLead.lead_name || 'este prospecto'} como No Lead? Puedes ingresar un detalle opcional:`,
                                                                placeholder: "Detalles opcionales...",
                                                                confirmText: "Confirmar No Lead",
                                                                requireText: false,
                                                                actionType: 'no_lead',
                                                                apptId: selectedLead.id
                                                            });
                                                        }}
                                                        disabled={processingId === selectedLead.id}
                                                        className="h-10 px-4 bg-slate-800 hover:bg-slate-700 text-slate-350 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border border-slate-750"
                                                    >
                                                        No Lead
                                                    </button>
                                                </div>

                                                {/* Formulario de reprogramación inline si se activó */}
                                                {rescheduleData.apptId === selectedLead.id && (
                                                    <div className="pt-4 border-t border-slate-900 flex flex-wrap items-center gap-3 animate-in slide-in-from-bottom-2 duration-200">
                                                        <span className="text-[10px] font-black uppercase text-violet-400 tracking-wider flex items-center gap-1">
                                                            <CalendarDays size={14} className="text-violet-500" />
                                                            {rescheduleData.status === 'Reprogramada' ? 'Nueva Fecha Reagenda:' : 'Nueva Fecha 2ª Llamada:'}
                                                        </span>
                                                        <input 
                                                            type="datetime-local" 
                                                            value={rescheduleData.date ? formatToDatetimeLocal(rescheduleData.date) : ''}
                                                            onChange={(e) => setRescheduleData(prev => ({ ...prev, date: e.target.value }))}
                                                            className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50"
                                                        />
                                                        <button
                                                            onClick={handleConfirmReschedule}
                                                            disabled={processingId === selectedLead.id || !rescheduleData.date}
                                                            className="h-9 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center cursor-pointer"
                                                        >
                                                            {processingId === selectedLead.id ? <Loader2 size={12} className="animate-spin" /> : 'Confirmar Reprogramación'}
                                                        </button>
                                                        <button 
                                                            onClick={() => setRescheduleData({ apptId: null, date: '', status: '' })}
                                                            className="h-9 px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all"
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Columna Derecha: Chat / Comentarios */}
                                <div className="lg:col-span-5 h-[65vh]">
                                    <CommentsSection clientId={selectedLead.client_id} />
                                </div>
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
        </div>
    );
};

export default CloserWorkflowPage;
