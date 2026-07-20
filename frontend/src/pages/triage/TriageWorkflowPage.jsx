import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
    Search, Calendar, RefreshCw, Loader2, ChevronDown, 
    Calendar as CalendarIcon, MessageSquare, CheckSquare, Clock
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import TriageKpiCards from './components/TriageKpiCards';
import TriageLeadCard from './components/TriageLeadCard';
import TriageRightPanel from './components/TriageRightPanel';
import TriageDetailModal from './components/TriageDetailModal';

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
    const [unreadNoAgenda, setUnreadNoAgenda] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [selectedLead, setSelectedLead] = useState(null);

    // Estados para reprogramación y notas
    const [rescheduleData, setRescheduleData] = useState({ apptId: null, date: '', status: '' });
    const [triageNote, setTriageNote] = useState('');
    const [meetDateInput, setMeetDateInput] = useState('');
    const [updatingDate, setUpdatingDate] = useState(false);

    // Sincronizar input de fecha cuando cambia el lead
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
                    date_filter_by: 'meet'
                }
            });
            const dataList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setAgendas(dataList);

            try {
                const unreadRes = await api.get('/public/financial-agendas/unread-no-agenda');
                setUnreadNoAgenda(unreadRes.data || []);
            } catch (err) {
                console.error("Error al cargar leads sin agenda:", err);
            }

            if (selectedLead) {
                const updated = dataList.find(a => a.id === selectedLead.id) || unreadNoAgenda.find(a => a.id === selectedLead.id);
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
            
            const oldDateStr = selectedLead.fecha_meet ? new Date(selectedLead.fecha_meet).toLocaleString('es-ES') : 'N/A';
            const newDateStr = new Date(meetDateInput).toLocaleString('es-ES');
            const commentText = `[Cambio Fecha Meet] Modificada por Triaje -> Antes: ${oldDateStr} | Ahora: ${newDateStr}`;
            
            if (selectedLead.client_id) {
                await saveTriageComment(selectedLead.client_id, commentText, 'Cambio Fecha');
            }

            fetchAgendas();
        } catch (err) {
            console.error("Error al actualizar fecha del meet:", err);
            toast.error("Error al actualizar la fecha del meet");
        } finally {
            setUpdatingDate(false);
        }
    };

    // Guardar comentario en cliente
    const saveTriageComment = async (clientId, noteText, actionStatus) => {
        if (!clientId || !noteText.trim()) return;
        try {
            await api.post('/comments', {
                text: `[Confirmación Triaje: ${actionStatus}] ${noteText.trim()}`,
                type: 'client',
                associated_id: clientId
            });
        } catch (err) {
            console.error("Error al registrar comentario de triaje:", err);
        }
    };

    // Procesar cambio de estado de triaje
    const handleUpdateStatus = async (agendaId, nextStatus) => {
        setProcessingId(agendaId);
        try {
            const payload = { estado: nextStatus };
            if (user?.username) payload.encargado_triage = user.username;

            await api.put(`/public/financial-agendas/${agendaId}`, payload);
            toast.success(`Cita marcada como ${nextStatus}`);

            if (selectedLead?.client_id && triageNote.trim()) {
                await saveTriageComment(selectedLead.client_id, triageNote, nextStatus);
                setTriageNote('');
            }

            fetchAgendas();
        } catch (err) {
            console.error("Error al actualizar estado:", err);
            toast.error("Error al actualizar el estado");
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
                reschedule_date: date,
                note: triageNote.trim() || 'Cita reagendada por el Call Confirmer (Triaje)'
            };

            if (user?.username) payload.encargado_triage = user.username;

            await api.put(`/public/financial-agendas/${apptId}`, payload);
            toast.success("Cita reagendada exitosamente");

            if (selectedLead?.client_id) {
                const commentText = triageNote.trim() 
                    ? `[Cita Reagendada] ${triageNote.trim()} -> Nueva fecha: ${new Date(date).toLocaleString('es-ES')}`
                    : `Cita reagendada para el ${new Date(date).toLocaleString('es-ES')}`;
                await saveTriageComment(selectedLead.client_id, commentText, 'Reagendada');
                setTriageNote('');
            }

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
        setAgendas(prev => prev.map(item => item.id === lead.id ? { ...item, unread_comment: false } : item));
        setUnreadNoAgenda(prev => prev.map(item => item.id === lead.id ? { ...item, unread_comment: false } : item));
    };

    // Formatear datetime-local
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

    // Agrupar items por categorías del espacio de confirmación
    const categorizedData = useMemo(() => {
        const citas = [];
        const mensajes = [];
        const seguimientos = [];
        const reagendar = [];
        const completadas = [];

        filteredAgendas.forEach(a => {
            const est = (a.estado || 'Pendiente').toLowerCase();
            const isCompleted = ['confirmado', 'show up', 'no show', 'cancelada'].includes(est);

            if (isCompleted) {
                completadas.push(a);
            } else if (a.unread_comment) {
                mensajes.push(a);
            } else if (est === 'reagendada') {
                reagendar.push(a);
            } else if (est === 'contactado' || est === 'sin respuesta') {
                seguimientos.push(a);
            } else {
                citas.push(a);
            }
        });

        // Incluir sin agenda en mensajes pendientes
        unreadNoAgenda.forEach(u => {
            if (!mensajes.some(m => m.id === u.id)) mensajes.push(u);
        });

        // Ordenamiento
        const sortFn = (a, b) => {
            if (sortBy === 'name') return (a.lead || a.nombre || '').localeCompare(b.lead || b.nombre || '');
            if (sortBy === 'setter') return (a.setter_name || a.setter || '').localeCompare(b.setter_name || b.setter || '');
            if (sortBy === 'time') return new Date(a.date || a.fecha_meet || 0) - new Date(b.date || b.fecha_meet || 0);
            // 'urgent'
            return (b.unread_comment ? 1 : 0) - (a.unread_comment ? 1 : 0);
        };

        return {
            citas: citas.sort(sortFn),
            mensajes: mensajes.sort(sortFn),
            seguimientos: seguimientos.sort(sortFn),
            reagendar: reagendar.sort(sortFn),
            completadas: completadas.sort(sortFn)
        };
    }, [filteredAgendas, unreadNoAgenda, sortBy]);

    // Conteo total para tarjetas KPI
    const counts = useMemo(() => ({
        citas: categorizedData.citas.length,
        mensajes: categorizedData.mensajes.length,
        seguimientos: categorizedData.seguimientos.length,
        reagendar: categorizedData.reagendar.length,
        completadas: categorizedData.completadas.length,
        pendientesTotal: categorizedData.citas.length + categorizedData.mensajes.length + categorizedData.seguimientos.length + categorizedData.reagendar.length
    }), [categorizedData]);

    // Acciones Rápidas del panel derecho
    const handleQuickAction = async (actionType) => {
        if (actionType === 'confirm_all') {
            const pending = categorizedData.citas;
            if (!pending.length) {
                toast("No hay citas pendientes de confirmación", { icon: 'ℹ️' });
                return;
            }
            try {
                for (const item of pending) {
                    await api.put(`/public/financial-agendas/${item.id}`, { estado: 'Confirmado' });
                }
                toast.success(`${pending.length} citas confirmadas masivamente`);
                fetchAgendas();
            } catch (err) {
                toast.error("Error confirmando citas masivamente");
            }
        } else if (actionType === 'mass_reminders') {
            toast.success("Recordatorios masivos enviados");
        } else if (actionType === 'view_calendar') {
            toast("Mostrando calendario de agendas", { icon: '📅' });
        }
    };

    const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : 'JD';

    return (
        <div className="min-h-screen bg-[#07080d] text-white p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header Superior */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-2xl text-violet-400">
                            <CalendarIcon size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                                Espacio de Confirmación (Triaje)
                            </h1>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                Gestioná, confirmá y hacé seguimiento de citas de venta
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        {/* Selector de Fecha */}
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
                            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
                            title="Recargar"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>

                        {/* Avatar Usuario */}
                        <div className="w-9 h-9 rounded-xl bg-slate-850 border border-slate-750 flex items-center justify-center text-xs font-black text-slate-200">
                            {initials}
                        </div>
                    </div>
                </div>

                {/* Pestañas Principales (Pendientes / Completadas) */}
                <div className="flex items-center gap-2 border-b border-slate-900 pb-1">
                    <button
                        onClick={() => setActiveTab('pendientes')}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-none ${
                            activeTab === 'pendientes'
                                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                                : 'bg-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <span>Pendientes</span>
                        <span className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-violet-500/20 text-violet-300">
                            {counts.pendientesTotal}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('completadas')}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-none ${
                            activeTab === 'completadas'
                                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                                : 'bg-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <span>Completadas</span>
                        <span className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-slate-800 text-slate-400">
                            {counts.completadas}
                        </span>
                    </button>
                </div>

                {/* Tarjetas KPI Superiores */}
                <TriageKpiCards
                    counts={counts}
                    activeFilter={activeKpiFilter}
                    onSelectFilter={setActiveKpiFilter}
                />

                {/* Barra de Búsqueda y Ordenamiento */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                            type="text"
                            placeholder="Buscar por nombre, Instagram, email o WhatsApp..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-850 rounded-2xl text-xs font-medium text-slate-200 outline-none focus:border-violet-500/40 transition-all placeholder-slate-600"
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs text-slate-400">
                        <span className="font-semibold">Ordenar por:</span>
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="bg-slate-900/80 border border-slate-800 text-slate-200 text-xs font-semibold py-2 pl-3 pr-8 rounded-xl appearance-none outline-none cursor-pointer"
                            >
                                <option value="urgent">Más urgente</option>
                                <option value="time">Hora de cita</option>
                                <option value="name">Nombre de lead</option>
                                <option value="setter">Setter</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Grid Principal de 2 Columnas */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Columna Izquierda: Listado de Grupos (8 cols) */}
                    <div className="lg:col-span-8 space-y-6">
                        {loading ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-500 bg-slate-950/40 rounded-3xl border border-slate-850">
                                <Loader2 className="animate-spin mb-2" size={24} />
                                <span className="text-xs uppercase font-black tracking-widest">Cargando datos de triaje...</span>
                            </div>
                        ) : activeTab === 'completadas' ? (
                            <div className="space-y-4">
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                                    <span>Completadas ({categorizedData.completadas.length})</span>
                                </h3>
                                {categorizedData.completadas.length === 0 ? (
                                    <div className="py-12 text-center text-slate-500 text-xs italic bg-slate-950/40 rounded-2xl border border-slate-850">
                                        No hay citas completadas para este día
                                    </div>
                                ) : (
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
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {/* Subgrupo 1: CITAS POR CONFIRMAR */}
                                {(activeKpiFilter === 'all' || activeKpiFilter === 'citas') && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-black text-violet-400 uppercase tracking-wider">
                                            <CalendarIcon size={14} />
                                            <span>CITAS POR CONFIRMAR ({categorizedData.citas.length})</span>
                                        </div>
                                        {categorizedData.citas.length === 0 ? (
                                            <p className="text-xs text-slate-600 italic py-3">No hay citas pendientes por confirmar</p>
                                        ) : (
                                            <div className="space-y-2.5">
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
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Subgrupo 2: MENSAJES POR CONTESTAR */}
                                {(activeKpiFilter === 'all' || activeKpiFilter === 'mensajes') && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-wider">
                                            <MessageSquare size={14} />
                                            <span>MENSAJES POR CONTESTAR ({categorizedData.mensajes.length})</span>
                                        </div>
                                        {categorizedData.mensajes.length === 0 ? (
                                            <p className="text-xs text-slate-600 italic py-3">No hay mensajes pendientes</p>
                                        ) : (
                                            <div className="space-y-2.5">
                                                {categorizedData.mensajes.map(lead => (
                                                    <TriageLeadCard
                                                        key={lead.id}
                                                        lead={lead}
                                                        sectionType="mensajes"
                                                        isSelected={selectedLead?.id === lead.id}
                                                        onSelect={() => handleSelectLead(lead)}
                                                        onActionClick={() => handleSelectLead(lead)}
                                                        onOpenMenu={() => handleSelectLead(lead)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Subgrupo 3: SEGUIMIENTOS POR HACER */}
                                {(activeKpiFilter === 'all' || activeKpiFilter === 'seguimientos') && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-black text-emerald-400 uppercase tracking-wider">
                                            <CheckSquare size={14} />
                                            <span>SEGUIMIENTOS POR HACER ({categorizedData.seguimientos.length})</span>
                                        </div>
                                        {categorizedData.seguimientos.length === 0 ? (
                                            <p className="text-xs text-slate-600 italic py-3">No hay seguimientos pendientes</p>
                                        ) : (
                                            <div className="space-y-2.5">
                                                {categorizedData.seguimientos.map(lead => (
                                                    <TriageLeadCard
                                                        key={lead.id}
                                                        lead={lead}
                                                        sectionType="seguimientos"
                                                        isSelected={selectedLead?.id === lead.id}
                                                        onSelect={() => handleSelectLead(lead)}
                                                        onActionClick={() => handleSelectLead(lead)}
                                                        onOpenMenu={() => handleSelectLead(lead)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Subgrupo 4: REAGENDAR / ACTUALIZAR */}
                                {(activeKpiFilter === 'all' || activeKpiFilter === 'reagendar') && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-black text-rose-400 uppercase tracking-wider">
                                            <Clock size={14} />
                                            <span>REAGENDAR / ACTUALIZAR ({categorizedData.reagendar.length})</span>
                                        </div>
                                        {categorizedData.reagendar.length === 0 ? (
                                            <p className="text-xs text-slate-600 italic py-3">No hay citas por reagendar</p>
                                        ) : (
                                            <div className="space-y-2.5">
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
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Columna Derecha: Panel de Resumen (4 cols) */}
                    <div className="lg:col-span-4 sticky top-6">
                        <TriageRightPanel
                            counts={counts}
                            onQuickAction={handleQuickAction}
                        />
                    </div>
                </div>

            </div>

            {/* Modal de Detalle */}
            <TriageDetailModal
                selectedLead={selectedLead}
                onClose={() => { setSelectedLead(null); setTriageNote(''); setRescheduleData({ apptId: null, date: '', status: '' }); }}
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
                formatToDatetimeLocal={formatToDatetimeLocal}
            />
        </div>
    );
};

export default TriageWorkflowPage;
