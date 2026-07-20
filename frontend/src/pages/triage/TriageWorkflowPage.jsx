import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { 
    Search, Calendar, RefreshCw, Loader2, ChevronDown, 
    Calendar as CalendarIcon, CheckSquare, Clock
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import TriageKpiCards from './components/TriageKpiCards';
import TriageLeadCard from './components/TriageLeadCard';
import TriageRightPanel from './components/TriageRightPanel';
import TriageDetailModal from './components/TriageDetailModal';
import TriageFollowUpModal from './components/TriageFollowUpModal';

const TriageWorkflowPage = () => {
    const { user } = useAuth();
    
    // Pestaña activa ('pendientes' | 'completadas')
    const [activeTab, setActiveTab] = useState('pendientes');

    // Filtros y estados de agendas
    const [selectedDate, setSelectedDate] = useState(() => {
        const offset = new Date().getTimezoneOffset();
        const localDate = new Date(new Date().getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('urgent');
    const [activeKpiFilter, setActiveKpiFilter] = useState('all');

    const [agendas, setAgendas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [selectedLead, setSelectedLead] = useState(null);

    // Modal de Seguimiento tras cambio de estado
    const [followUpModal, setFollowUpModal] = useState({
        show: false,
        agendaId: null,
        leadName: '',
        newStatus: ''
    });
    const [savingFollowUp, setSavingFollowUp] = useState(false);

    // Estados para reprogramación y notas
    const [rescheduleData, setRescheduleData] = useState({ apptId: null, date: '', status: '' });
    const [triageNote, setTriageNote] = useState('');
    const [meetDateInput, setMeetDateInput] = useState('');
    const [updatingDate, setUpdatingDate] = useState(false);

    useEffect(() => {
        if (selectedLead) {
            setMeetDateInput(selectedLead.fecha_meet || selectedLead.date || '');
        }
    }, [selectedLead]);

    // Cargar agendas del día seleccionado
    const fetchAgendas = async () => {
        setLoading(true);
        try {
            const res = await api.get('/public/financial-agendas', {
                params: {
                    start_date: selectedDate,
                    end_date: selectedDate,
                    date_filter_by: 'meet'
                }
            });
            const dataList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setAgendas(dataList);

            if (selectedLead) {
                const updated = dataList.find(a => a.id === selectedLead.id);
                if (updated) setSelectedLead(updated);
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
    }, [selectedDate]);

    // Actualizar fecha del meet
    const handleUpdateMeetDate = async () => {
        if (!selectedLead || !meetDateInput) return;
        setUpdatingDate(true);
        try {
            const payload = { fecha_meet: meetDateInput };
            const agendaId = selectedLead.id;
            
            if (agendaId > 0) {
                await api.put(`/public/financial-agendas/${agendaId}`, payload);
            }

            toast.success("Fecha del meet actualizada");
            fetchAgendas();
        } catch (err) {
            console.error("Error al actualizar fecha del meet:", err);
            toast.error("Error al actualizar la fecha del meet");
        } finally {
            setUpdatingDate(false);
        }
    };

    // Guardar comentario/observación de triaje en el Chat de Comunicación del Lead
    const saveTriageComment = async (clientId, noteText, actionStatus = 'Observación') => {
        if (!clientId || !noteText.trim()) return;
        try {
            const prefix = actionStatus ? `[Triaje - ${actionStatus}]: ` : `[Observación Call Confirmer]: `;
            await api.post(`/closer/leads/${clientId}/comments`, {
                text: `${prefix}${noteText.trim()}`
            });
            toast.success("Observación guardada en el Chat de Comunicación");
        } catch (err) {
            console.error("Error al registrar comentario de triaje:", err);
        }
    };

    const handleSendTriageNoteOnly = async () => {
        if (!selectedLead?.client_id || !triageNote.trim()) {
            toast.error("Escribe una observación para enviar");
            return;
        }
        await saveTriageComment(selectedLead.client_id, triageNote, 'Observación');
        setTriageNote('');
    };

    // Procesar cambio de estado de triaje y abrir modal de seguimiento
    const handleUpdateStatus = async (agendaId, nextStatus) => {
        setProcessingId(agendaId);
        try {
            const payload = { estado: nextStatus };
            if (user?.username) payload.encargado_triage = user.username;

            await api.put(`/public/financial-agendas/${agendaId}`, payload);
            toast.success(`Cita marcada como ${nextStatus}`);

            const targetAgenda = agendas.find(a => a.id === agendaId) || selectedLead;
            const leadName = targetAgenda ? (targetAgenda.lead || targetAgenda.nombre || 'Prospecto') : 'Prospecto';

            if (selectedLead?.client_id && triageNote.trim()) {
                await saveTriageComment(selectedLead.client_id, triageNote, nextStatus);
                setTriageNote('');
            }

            fetchAgendas();

            // Desplegar modal para consultar fecha de seguimiento en estados clave
            const triggerStatuses = ['contactado', 'confirmado', 'cancelada', 'reagendada'];
            if (triggerStatuses.includes(nextStatus.toLowerCase())) {
                setFollowUpModal({
                    show: true,
                    agendaId: agendaId,
                    leadName: leadName,
                    newStatus: nextStatus
                });
            }
        } catch (err) {
            console.error("Error al actualizar estado:", err);
            toast.error("Error al actualizar el estado");
        } finally {
            setProcessingId(null);
        }
    };

    // Guardar fecha de seguimiento programada
    const handleConfirmFollowUpDate = async (followUpDate) => {
        if (!followUpModal.agendaId || !followUpDate) return;
        setSavingFollowUp(true);
        try {
            await api.put(`/public/financial-agendas/${followUpModal.agendaId}`, {
                fecha_seguimiento: followUpDate,
                seguimiento_realizado: false
            });
            toast.success(`Seguimiento programado para el ${followUpDate}`);
            setFollowUpModal({ show: false, agendaId: null, leadName: '', newStatus: '' });
            fetchAgendas();
        } catch (err) {
            console.error("Error guardando fecha de seguimiento:", err);
            toast.error("Error al guardar la fecha de seguimiento");
        } finally {
            setSavingFollowUp(false);
        }
    };

    // Marcar seguimiento como realizado y consultar si desea agendar otro
    const handleMarkFollowUpDone = async (lead) => {
        if (!lead || !lead.id) return;
        setProcessingId(lead.id);
        try {
            await api.put(`/public/financial-agendas/${lead.id}`, {
                seguimiento_realizado: true
            });
            toast.success("Seguimiento marcado como realizado");
            fetchAgendas();

            // Consultar si desea agendar un próximo seguimiento
            setFollowUpModal({
                show: true,
                agendaId: lead.id,
                leadName: lead.lead || lead.nombre || 'Prospecto',
                newStatus: 'Seguimiento Realizado'
            });
        } catch (err) {
            console.error("Error marcando seguimiento como realizado:", err);
            toast.error("Error al actualizar seguimiento");
        } finally {
            setProcessingId(null);
        }
    };

    // Confirmar Reagenda
    const handleConfirmReschedule = async () => {
        const { apptId, date } = rescheduleData;
        if (!date) {
            toast.error("Selecciona una fecha y hora");
            return;
        }

        setProcessingId(apptId);
        try {
            const payload = {
                estado: 'Reagendada',
                date: date,
                reschedule_date: date
            };

            if (user?.username) payload.encargado_triage = user.username;

            await api.put(`/public/financial-agendas/${apptId}`, payload);
            toast.success("Cita reagendada exitosamente");

            const targetAgenda = agendas.find(a => a.id === apptId) || selectedLead;
            setFollowUpModal({
                show: true,
                agendaId: apptId,
                leadName: targetAgenda ? (targetAgenda.lead || targetAgenda.nombre || 'Prospecto') : 'Prospecto',
                newStatus: 'Reagendada'
            });

            setRescheduleData({ apptId: null, date: '', status: '' });
            fetchAgendas();
        } catch (err) {
            console.error("Error al reprogramar:", err);
            toast.error("Error al procesar la reagenda");
        } finally {
            setProcessingId(null);
        }
    };

    const handleSelectLead = (lead) => {
        setSelectedLead(lead);
    };

    const formatToDatetimeLocal = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '';
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch {
            return '';
        }
    };

    // Filtrar localmente por búsqueda
    const filteredAgendas = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return agendas;
        return agendas.filter(a => 
            (a.nombre && a.nombre.toLowerCase().includes(query)) ||
            (a.lead && a.lead.toLowerCase().includes(query)) ||
            (a.instagram && a.instagram.toLowerCase().includes(query)) ||
            (a.mail && a.mail.toLowerCase().includes(query)) ||
            (a.whatsapp && a.whatsapp.toLowerCase().includes(query))
        );
    }, [agendas, searchQuery]);

    // Agrupar items con criterio estricto para cada sección
    const categorizedData = useMemo(() => {
        const citas = [];
        const seguimientos = [];
        const reagendar = [];
        const completadas = [];

        filteredAgendas.forEach(a => {
            const est = (a.estado || 'Pendiente').toLowerCase();
            const isCompleted = ['confirmado', 'show up', 'no show', 'cancelada'].includes(est);

            // Criterio estricto de seguimiento programado
            const hasFollowUpToday = a.fecha_seguimiento && a.fecha_seguimiento.startsWith(selectedDate) && !a.seguimiento_realizado;

            if (hasFollowUpToday) {
                seguimientos.push(a);
            } else if (a.seguimiento_realizado || isCompleted) {
                completadas.push(a);
            } else if (est === 'reagendada') {
                reagendar.push(a);
            } else {
                citas.push(a);
            }
        });

        const sortFn = (a, b) => {
            if (sortBy === 'name') return (a.lead || a.nombre || '').localeCompare(b.lead || b.nombre || '');
            if (sortBy === 'setter') return (a.setter_name || a.setter || '').localeCompare(b.setter_name || b.setter || '');
            return new Date(a.date || a.fecha_meet || 0) - new Date(b.date || b.fecha_meet || 0);
        };

        return {
            citas: citas.sort(sortFn),
            seguimientos: seguimientos.sort(sortFn),
            reagendar: reagendar.sort(sortFn),
            completadas: completadas.sort(sortFn)
        };
    }, [filteredAgendas, sortBy, selectedDate]);

    const counts = useMemo(() => ({
        citas: categorizedData.citas.length,
        seguimientos: categorizedData.seguimientos.length,
        reagendar: categorizedData.reagendar.length,
        completadas: categorizedData.completadas.length,
        pendientesTotal: categorizedData.citas.length + categorizedData.seguimientos.length + categorizedData.reagendar.length
    }), [categorizedData]);

    return (
        <div className="min-h-screen bg-[#07080d] text-white p-4 sm:p-6 lg:p-8 space-y-6 text-left">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header Superior */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-2xl text-violet-400">
                            <CalendarIcon size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight italic">
                                Espacio de Confirmación (Triaje)
                            </h1>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                Gestioná, confirmá y hacé seguimiento de citas de venta
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <div className="relative flex-1 md:flex-none">
                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full md:w-44 pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50 cursor-pointer"
                            />
                        </div>

                        <button
                            onClick={fetchAgendas}
                            disabled={loading}
                            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer border-none"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Navegación por Pestañas */}
                <div className="flex border-b border-slate-850 gap-8">
                    <button
                        onClick={() => setActiveTab('pendientes')}
                        className={`pb-3 text-sm font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer border-none bg-transparent ${
                            activeTab === 'pendientes' 
                                ? 'border-violet-500 text-white' 
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <span>Pendientes</span>
                        <span className="px-2 py-0.5 text-xs bg-violet-500/10 text-violet-400 rounded-full border border-violet-500/20 font-mono">
                            {counts.pendientesTotal}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('completadas')}
                        className={`pb-3 text-sm font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer border-none bg-transparent ${
                            activeTab === 'completadas' 
                                ? 'border-emerald-500 text-emerald-400' 
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <span>Completadas</span>
                        <span className="px-2 py-0.5 text-xs bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 font-mono">
                            {counts.completadas}
                        </span>
                    </button>
                </div>

                {/* Tarjetas KPI Superiores */}
                {activeTab === 'pendientes' && (
                    <TriageKpiCards 
                        counts={counts} 
                        activeFilter={activeKpiFilter} 
                        onFilterChange={setActiveKpiFilter} 
                    />
                )}

                {/* Barra de Búsqueda y Ordenamiento */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-950/40 p-3 rounded-2xl border border-slate-850">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar por lead, instagram, correo o WhatsApp..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500/50"
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs text-slate-400 font-bold">
                        <span>Ordenar por:</span>
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="appearance-none bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 pr-8 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50 cursor-pointer"
                            >
                                <option value="urgent">Prioridad URGENTE</option>
                                <option value="time">Hora de cita</option>
                                <option value="name">Nombre del lead</option>
                                <option value="setter">Setter asignado</option>
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                        </div>
                    </div>
                </div>

                {/* Layout Principal con Subgrupos */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    <div className="lg:col-span-8 space-y-8">
                        {loading ? (
                            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-500">
                                <Loader2 className="animate-spin text-violet-500" size={28} />
                                <span className="text-xs uppercase font-black tracking-widest">Cargando tareas del espacio...</span>
                            </div>
                        ) : activeTab === 'completadas' ? (
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                                    <CheckSquare size={16} />
                                    Citas Completadas o Finalizadas ({categorizedData.completadas.length})
                                </h3>

                                <div className="space-y-3">
                                    {categorizedData.completadas.map(lead => (
                                        <TriageLeadCard
                                            key={lead.id}
                                            lead={lead}
                                            sectionType="citas"
                                            isSelected={selectedLead?.id === lead.id}
                                            onSelect={() => handleSelectLead(lead)}
                                            onActionClick={() => handleSelectLead(lead)}
                                            onOpenMenu={() => handleSelectLead(lead)}
                                        />
                                    ))}
                                    {categorizedData.completadas.length === 0 && (
                                        <div className="p-8 text-center text-xs text-slate-500 font-bold italic bg-slate-950/40 rounded-2xl border border-slate-850">
                                            No hay citas completadas en esta fecha
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* SUBGRUPO 1: CITAS POR CONFIRMAR */}
                                {(activeKpiFilter === 'all' || activeKpiFilter === 'citas') && (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center px-1">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-violet-400 flex items-center gap-2">
                                                <Clock size={16} />
                                                CITAS POR CONFIRMAR ({categorizedData.citas.length})
                                            </h3>
                                        </div>
                                        <div className="space-y-3">
                                            {categorizedData.citas.map(lead => (
                                                <TriageLeadCard
                                                    key={lead.id}
                                                    lead={lead}
                                                    sectionType="citas"
                                                    isSelected={selectedLead?.id === lead.id}
                                                    onSelect={() => handleSelectLead(lead)}
                                                    onActionClick={() => handleSelectLead(lead)}
                                                    onOpenMenu={() => handleSelectLead(lead)}
                                                />
                                            ))}
                                            {categorizedData.citas.length === 0 && (
                                                <div className="p-5 text-center text-xs text-slate-500 font-bold italic bg-slate-950/20 rounded-2xl border border-dashed border-slate-850">
                                                    Sin citas por confirmar pendientes
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* SUBGRUPO 2: SEGUIMIENTOS POR HACER */}
                                {(activeKpiFilter === 'all' || activeKpiFilter === 'seguimientos') && (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center px-1">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                                                <Clock size={16} />
                                                SEGUIMIENTOS POR HACER ({categorizedData.seguimientos.length})
                                            </h3>
                                        </div>
                                        <div className="space-y-3">
                                            {categorizedData.seguimientos.map(lead => (
                                                <TriageLeadCard
                                                    key={lead.id}
                                                    lead={lead}
                                                    sectionType="seguimientos"
                                                    isSelected={selectedLead?.id === lead.id}
                                                    onSelect={() => handleSelectLead(lead)}
                                                    onActionClick={() => handleSelectLead(lead)}
                                                    onOpenMenu={() => handleSelectLead(lead)}
                                                    onMarkFollowUpDone={handleMarkFollowUpDone}
                                                />
                                            ))}
                                            {categorizedData.seguimientos.length === 0 && (
                                                <div className="p-5 text-center text-xs text-slate-500 font-bold italic bg-slate-950/20 rounded-2xl border border-dashed border-slate-850">
                                                    Sin seguimientos pendientes programados para hoy
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* SUBGRUPO 3: REAGENDAR / ACTUALIZAR */}
                                {(activeKpiFilter === 'all' || activeKpiFilter === 'reagendar') && (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center px-1">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-2">
                                                <Clock size={16} />
                                                REAGENDAR / ACTUALIZAR ({categorizedData.reagendar.length})
                                            </h3>
                                        </div>
                                        <div className="space-y-3">
                                            {categorizedData.reagendar.map(lead => (
                                                <TriageLeadCard
                                                    key={lead.id}
                                                    lead={lead}
                                                    sectionType="reagendar"
                                                    isSelected={selectedLead?.id === lead.id}
                                                    onSelect={() => handleSelectLead(lead)}
                                                    onActionClick={() => handleSelectLead(lead)}
                                                    onOpenMenu={() => handleSelectLead(lead)}
                                                />
                                            ))}
                                            {categorizedData.reagendar.length === 0 && (
                                                <div className="p-5 text-center text-xs text-slate-500 font-bold italic bg-slate-950/20 rounded-2xl border border-dashed border-slate-850">
                                                    Sin citas por reagendar
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Columna Derecha: Resumen Donut Chart */}
                    <div className="lg:col-span-4">
                        <TriageRightPanel counts={counts} />
                    </div>
                </div>
            </div>

            {/* Modal Ficha Detallada del Lead */}
            <TriageDetailModal 
                selectedLead={selectedLead}
                onClose={() => setSelectedLead(null)}
                meetDateInput={meetDateInput}
                setMeetDateInput={setMeetDateInput}
                handleUpdateMeetDate={handleUpdateMeetDate}
                updatingDate={updatingDate}
                triageNote={triageNote}
                setTriageNote={setTriageNote}
                handleUpdateStatus={handleUpdateStatus}
                processingId={processingId}
                rescheduleData={rescheduleData}
                setRescheduleData={setRescheduleData}
                handleConfirmReschedule={handleConfirmReschedule}
                onSendNoteOnly={handleSendTriageNoteOnly}
                formatToDatetimeLocal={formatToDatetimeLocal}
            />

            {/* Modal de Configuración de Fecha de Seguimiento */}
            <TriageFollowUpModal
                show={followUpModal.show}
                onClose={() => setFollowUpModal({ show: false, agendaId: null, leadName: '', newStatus: '' })}
                onConfirm={handleConfirmFollowUpDate}
                leadName={followUpModal.leadName}
                newStatus={followUpModal.newStatus}
                loading={savingFollowUp}
            />
        </div>
    );
};

export default TriageWorkflowPage;
