import React, { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, CalendarDays, Loader2, LayoutGrid, List, Layers, Target, Zap, Video } from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import './workshop-intel.css';
import WorkshopKpiCards from './components/WorkshopKpiCards';
import WorkshopCardsView from './components/WorkshopCardsView';
import WorkshopTableView from './components/WorkshopTableView';
import WorkshopFunnelView from './components/WorkshopFunnelView';
import WorkshopFormModal from './components/WorkshopFormModal';
import WorkshopLandingView from './components/WorkshopLandingView';
import WorkshopDiagnostico from './components/WorkshopDiagnostico';
import WorkshopGoalsModal from './components/WorkshopGoalsModal';
import WorkshopSimuladorView from './components/WorkshopSimuladorView';
import WorkshopAccionesView from './components/WorkshopAccionesView';
import WorkshopCompareModal from './components/WorkshopCompareModal';

const initialFormData = {
    date: '',
    name: '',
    inversion: 0.0,
    cpm: 0.0,
    cpc: 0.0,
    clics: 0,
    leads: 0,
    whatsapp_leads: 0,
    show_up: 0,
    pitch_leads: 0,
    pitch_final_leads: 0,
    aplicaciones_form: 0,
    agendas_exitosas: 0,
    show_up_sales_call: 0,
    sales: 0,
    cash_collected: 0.0
};

const WorkshopDashboardPage = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
    const [activeTab, setActiveTab] = useState('list'); // 'list' | 'funnel' | 'simulador' | 'acciones' | 'landing'
    const [selectedEventForFunnel, setSelectedEventForFunnel] = useState(null);

    // Diagnóstico / Metas / Simulador / Acciones (Workshop Intelligence 2.0)
    const [goals, setGoals] = useState(null);
    const [actions, setActions] = useState([]);
    const [goalsModalOpen, setGoalsModalOpen] = useState(false);
    const [highlightStage, setHighlightStage] = useState(null);
    const [compareIds, setCompareIds] = useState([]);
    const [compareModalOpen, setCompareModalOpen] = useState(false);

    // Formulario & Prefill
    const [formData, setFormData] = useState(initialFormData);
    const [loadingPrefill, setLoadingPrefill] = useState(false);
    const [agendaBreakdown, setAgendaBreakdown] = useState(null);
    const [prefilledDate, setPrefilledDate] = useState('');
    const [resyncing, setResyncing] = useState(false);

    // Desglose vivo / grabación del evento abierto en la pestaña de embudo
    const [desglose, setDesglose] = useState(null);
    const [ventana, setVentana] = useState(null);
    const [cargandoDesglose, setCargandoDesglose] = useState(false);

    useEffect(() => {
        fetchEvents();
        fetchGoals();
        fetchActions();
    }, []);

    const fetchGoals = async () => {
        try {
            const res = await api.get('workshop/goals');
            setGoals(res.data);
        } catch (err) {
            console.error('Error cargando metas del workshop:', err);
        }
    };

    const fetchActions = async () => {
        try {
            const res = await api.get('workshop/actions');
            setActions(res.data);
        } catch (err) {
            console.error('Error cargando el plan de acciones:', err);
        }
    };

    const goToSimulador = (stageKey) => {
        setHighlightStage(stageKey);
        setActiveTab('simulador');
    };

    const toggleCompareId = (id) => {
        setCompareIds((prev) => {
            if (prev.includes(id)) return prev.filter((x) => x !== id);
            if (prev.length >= 4) {
                toast.error('Podés comparar hasta 4 talleres a la vez');
                return prev;
            }
            return [...prev, id];
        });
    };

    // El desglose por embudo se pide solo al abrir el análisis de un evento:
    // recorre agendas y ventas, así que no vale la pena calcularlo para la lista.
    useEffect(() => {
        if (activeTab !== 'funnel' || !selectedEventForFunnel?.date) return;
        let cancelado = false;
        setCargandoDesglose(true);
        api.get(`workshop/prefill?date=${selectedEventForFunnel.date}`)
            .then(res => {
                if (cancelado) return;
                setDesglose(res.data.desglose || null);
                setVentana(res.data.ventana || null);
            })
            .catch(err => {
                if (!cancelado) console.error('Error cargando el desglose del workshop:', err);
            })
            .finally(() => { if (!cancelado) setCargandoDesglose(false); });
        return () => { cancelado = true; };
    }, [activeTab, selectedEventForFunnel?.date]);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const res = await api.get('workshop/events');
            if (Array.isArray(res.data)) {
                setEvents(res.data);
                if (res.data.length > 0 && !selectedEventForFunnel) {
                    setSelectedEventForFunnel(res.data[0]);
                }
            }
        } catch (err) {
            console.error("Error fetching events:", err);
            toast.error("Error al cargar los eventos");
        } finally {
            setLoading(false);
        }
    };

    const handlePrefill = async (selectedDate) => {
        if (!selectedDate) return;
        setLoadingPrefill(true);
        setAgendaBreakdown(null);
        try {
            const res = await api.get(`workshop/prefill?date=${selectedDate}`);
            const data = res.data;
            setFormData(prev => ({
                ...prev,
                aplicaciones_form: data.aplicaciones_form,
                agendas_exitosas: data.agendas_exitosas,
                show_up_sales_call: data.show_up_sales_call,
                sales: data.sales,
                cash_collected: data.cash_collected
            }));
            setAgendaBreakdown(data.agendas_breakdown);
            setDesglose(data.desglose || null);
            setVentana(data.ventana || null);
            setPrefilledDate(selectedDate);
            toast.success("Métricas autocompletadas del sistema para este día");
        } catch (err) {
            console.error("Error prefilling metrics:", err);
            toast.error("No se pudo autocompletar desde el sistema.");
        } finally {
            setLoadingPrefill(false);
        }
    };

    const handleOpenCreateModal = () => {
        setIsEditMode(false);
        setSelectedEvent(null);
        setAgendaBreakdown(null);
        setDesglose(null);
        setVentana(null);
        setCurrentStep(1);
        setPrefilledDate('');
        setFormData(initialFormData);
        setModalOpen(true);
    };

    const handleOpenEditModal = (event) => {
        setIsEditMode(true);
        setSelectedEvent(event);
        setAgendaBreakdown(null);
        setCurrentStep(1);
        setPrefilledDate(event.date);
        setFormData({
            date: event.date,
            name: event.name,
            inversion: event.inversion,
            cpm: event.cpm,
            cpc: event.cpc,
            clics: event.clics,
            leads: event.leads,
            whatsapp_leads: event.whatsapp_leads,
            show_up: event.show_up,
            pitch_leads: event.pitch_leads,
            pitch_final_leads: event.pitch_final_leads,
            aplicaciones_form: event.aplicaciones_form,
            agendas_exitosas: event.agendas_exitosas,
            show_up_sales_call: event.show_up_sales_call,
            sales: event.sales,
            cash_collected: event.cash_collected
        });
        setModalOpen(true);
        fetchHistoricalBreakdown(event.date);
    };

    const fetchHistoricalBreakdown = async (date) => {
        try {
            const res = await api.get(`workshop/prefill?date=${date}`);
            setAgendaBreakdown(res.data.agendas_breakdown);
            setDesglose(res.data.desglose || null);
            setVentana(res.data.ventana || null);
        } catch (e) {
            console.error("Error loading breakdown", e);
        }
    };

    const handleDeleteEvent = async (id) => {
        if (!window.confirm("¿Estás seguro de que deseas eliminar este registro de clase/workshop?")) return;
        try {
            await api.delete(`workshop/events/${id}`);
            toast.success("Registro eliminado con éxito");
            fetchEvents();
        } catch (err) {
            console.error("Error deleting event:", err);
            toast.error("No se pudo eliminar el registro");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            ...formData,
            inversion: parseFloat(formData.inversion),
            cpm: parseFloat(formData.cpm),
            cpc: parseFloat(formData.cpc),
            clics: parseInt(formData.clics),
            leads: parseInt(formData.leads),
            whatsapp_leads: parseInt(formData.whatsapp_leads),
            show_up: parseInt(formData.show_up),
            pitch_leads: parseInt(formData.pitch_leads),
            pitch_final_leads: parseInt(formData.pitch_final_leads),
            aplicaciones_form: parseInt(formData.aplicaciones_form),
            agendas_exitosas: parseInt(formData.agendas_exitosas),
            show_up_sales_call: parseInt(formData.show_up_sales_call),
            sales: parseInt(formData.sales),
            cash_collected: parseFloat(formData.cash_collected)
        };

        try {
            if (isEditMode && selectedEvent) {
                await api.put(`workshop/events/${selectedEvent.id}`, payload);
                toast.success("Registro actualizado");
            } else {
                await api.post('workshop/events', payload);
                toast.success("Registro creado con éxito");
            }
            setModalOpen(false);
            fetchEvents();
        } catch (err) {
            console.error("Error saving event:", err);
            const msg = err.response?.data?.error || "Error al guardar el evento";
            toast.error(msg);
        }
    };

    const handleResyncFunnel = async () => {
        if (!selectedEventForFunnel || resyncing) return;
        try {
            setResyncing(true);
            const res = await api.get(`workshop/prefill?date=${selectedEventForFunnel.date}`);
            const data = res.data;
            const patch = {
                aplicaciones_form: data.aplicaciones_form,
                agendas_exitosas: data.agendas_exitosas,
                show_up_sales_call: data.show_up_sales_call,
                sales: data.sales,
                cash_collected: data.cash_collected
            };
            await api.put(`workshop/events/${selectedEventForFunnel.id}`, {
                ...selectedEventForFunnel,
                ...patch
            });
            toast.success('Datos del sistema actualizados correctamente');
            setAgendaBreakdown(data.agendas_breakdown);
            setDesglose(data.desglose || null);
            setVentana(data.ventana || null);
            fetchEvents();
        } catch (err) {
            console.error('Error resincronizando embudo:', err);
            toast.error(err.response?.data?.error || 'Error al actualizar desde sistema');
        } finally {
            setResyncing(false);
        }
    };

    const totalStats = useMemo(() => {
        let inversion = 0;
        let clics = 0;
        let leads = 0;
        let whatsapp_leads = 0;
        let agendas = 0;
        let sales = 0;
        let cash = 0;

        events.forEach(e => {
            inversion += e.inversion || 0;
            clics += e.clics || 0;
            leads += e.leads || 0;
            whatsapp_leads += e.whatsapp_leads || 0;
            agendas += e.agendas_exitosas || 0;
            sales += e.sales || 0;
            cash += e.cash_collected || 0;
        });

        const roas = inversion > 0 ? cash / inversion : 0;

        return {
            inversion,
            clics,
            leads,
            whatsapp_leads,
            agendas,
            sales,
            cash,
            roas
        };
    }, [events]);

    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            const [y, m, d] = dateStr.split('-');
            const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            return `${parseInt(d)} ${months[parseInt(m) - 1]}. ${y}`;
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="ws-shell">
            <div className="dashboard">
                {/* Hero */}
                <section className="hero" aria-labelledby="workshop-intel-title">
                    <div>
                        <p className="eyebrow"><span className="live-dot" />Sistema actualizado · {events.length} talleres</p>
                        <h1 id="workshop-intel-title">Rendimiento & Workshop Intelligence.</h1>
                        <p className="hero-copy">Consola ejecutiva de análisis financiero, ROI publicitario y eficiencia de embudo para talleres y webinars.</p>
                        <div className="hero-actions" style={{ marginTop: 20 }}>
                            <button type="button" className="icon-button" onClick={fetchEvents} title="Recargar eventos" aria-label="Recargar eventos">
                                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            </button>
                            <div className="section-tabs" role="tablist" aria-label="Modo de vista">
                                <button type="button" className={viewMode === 'cards' ? 'active' : ''} onClick={() => setViewMode('cards')}>
                                    <LayoutGrid size={14} /> Tarjetas
                                </button>
                                <button type="button" className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>
                                    <List size={14} /> Tabla comparativa
                                </button>
                            </div>
                            <button type="button" className="primary-action" onClick={handleOpenCreateModal}>
                                <Plus size={16} /> Registrar taller
                            </button>
                        </div>
                    </div>
                    {events.length > 0 && (
                        <div className="hero-period">
                            <span>Período analizado</span>
                            <strong>{formatDate(events[events.length - 1]?.date)} — {formatDate(events[0]?.date)}</strong>
                        </div>
                    )}
                </section>

                {/* Tarjetas KPI Ejecutivas */}
                <WorkshopKpiCards totalStats={totalStats} eventsCount={events.length} />

                {/* Diagnóstico: siempre visible, no es una pestaña más — la lectura
                    rápida de qué etapa frena las ventas antes de bajar al detalle. */}
                {events.length > 0 && (
                    <WorkshopDiagnostico
                        events={events}
                        goals={goals}
                        actions={actions}
                        onEditGoals={() => setGoalsModalOpen(true)}
                        onGoToSimulador={goToSimulador}
                    />
                )}

                {/* Navegación por pestañas */}
                <nav className="section-tabs" aria-label="Secciones de Workshop Intelligence" style={{ margin: '28px 0 22px', width: 'fit-content' }}>
                    <button type="button" className={activeTab === 'list' ? 'active' : ''} onClick={() => setActiveTab('list')} aria-current={activeTab === 'list' ? 'page' : undefined}>
                        <Layers size={14} /> Historial ({events.length})
                    </button>
                    <button type="button" className={activeTab === 'funnel' ? 'active' : ''} onClick={() => setActiveTab('funnel')} aria-current={activeTab === 'funnel' ? 'page' : undefined}>
                        <CalendarDays size={14} /> Embudo
                    </button>
                    <button type="button" className={activeTab === 'simulador' ? 'active' : ''} onClick={() => setActiveTab('simulador')} aria-current={activeTab === 'simulador' ? 'page' : undefined}>
                        <Target size={14} /> Simulador
                    </button>
                    <button type="button" className={activeTab === 'acciones' ? 'active' : ''} onClick={() => setActiveTab('acciones')} aria-current={activeTab === 'acciones' ? 'page' : undefined}>
                        <Zap size={14} /> Acciones {actions.length > 0 && `(${actions.filter(a => a.status === 'pending').length})`}
                    </button>
                    {/* La grabación es OTRO embudo que el workshop en vivo: mismo
                        producto, fuente distinta ('workshop landing'). */}
                    <button type="button" className={activeTab === 'landing' ? 'active' : ''} onClick={() => setActiveTab('landing')} aria-current={activeTab === 'landing' ? 'page' : undefined}>
                        <Video size={14} /> Landing grabación
                    </button>
                </nav>

                {/* Area Principal de Contenido */}
                {/* La landing va PRIMERO y fuera de los guards de abajo: sus datos
                    no dependen de que haya workshops en vivo cargados, asi que el
                    "no hay workshops registrados" no tiene que taparla. */}
                {activeTab === 'landing' ? (
                    <WorkshopLandingView />
                ) : loading ? (
                    <section className="empty-state loading-state" role="status">
                        <div><span /></div>
                        <p className="eyebrow">Sincronizando</p>
                        <h2>Cargando inteligencia de workshops…</h2>
                    </section>
                ) : events.length === 0 ? (
                    <section className="empty-state">
                        <div><CalendarDays size={26} /></div>
                        <p className="eyebrow">Empezá por acá</p>
                        <h2>No hay workshops registrados</h2>
                        <p>Registrá el primero para empezar a medir el embudo.</p>
                        <button type="button" className="primary-action" onClick={handleOpenCreateModal}>
                            <Plus size={16} /> Registrar taller
                        </button>
                    </section>
                ) : activeTab === 'list' ? (
                    viewMode === 'cards' ? (
                        <WorkshopCardsView
                            events={events}
                            onSelectFunnel={(e) => {
                                setSelectedEventForFunnel(e);
                                setActiveTab('funnel');
                            }}
                            onEdit={handleOpenEditModal}
                            onDelete={handleDeleteEvent}
                            formatDate={formatDate}
                            formatCurrency={formatCurrency}
                            selectedIds={compareIds}
                            onToggleSelect={toggleCompareId}
                        />
                    ) : (
                        <WorkshopTableView
                            events={events}
                            onSelectFunnel={(e) => {
                                setSelectedEventForFunnel(e);
                                setActiveTab('funnel');
                            }}
                            onEdit={handleOpenEditModal}
                            onDelete={handleDeleteEvent}
                            formatDate={formatDate}
                            formatCurrency={formatCurrency}
                            selectedIds={compareIds}
                            onToggleSelect={toggleCompareId}
                        />
                    )
                ) : activeTab === 'funnel' ? (
                    <WorkshopFunnelView
                        events={events}
                        selectedEvent={selectedEventForFunnel}
                        onSelectEvent={setSelectedEventForFunnel}
                        onResync={handleResyncFunnel}
                        resyncing={resyncing}
                        formatDate={formatDate}
                        formatCurrency={formatCurrency}
                        desglose={desglose}
                        ventana={ventana}
                        cargandoDesglose={cargandoDesglose}
                    />
                ) : activeTab === 'simulador' ? (
                    <WorkshopSimuladorView
                        events={events}
                        goals={goals}
                        highlightStage={highlightStage}
                        onGoalsUpdated={setGoals}
                        formatCurrency={formatCurrency}
                    />
                ) : (
                    <WorkshopAccionesView
                        events={events}
                        goals={goals}
                        actions={actions}
                        onActionsChanged={fetchActions}
                        formatCurrency={formatCurrency}
                    />
                )}

                {/* Barra flotante de comparación (hasta 4 talleres) */}
                {compareIds.length > 0 && activeTab === 'list' && (
                    <div className="compare-bar">
                        <span>{compareIds.length} seleccionados</span>
                        <button type="button" className="confirm" onClick={() => setCompareModalOpen(true)} disabled={compareIds.length < 2}>
                            Comparar
                        </button>
                        <button type="button" className="clear" onClick={() => setCompareIds([])}>
                            Limpiar
                        </button>
                    </div>
                )}

                {compareModalOpen && (
                    <WorkshopCompareModal
                        events={events.filter((e) => compareIds.includes(e.id))}
                        onClose={() => setCompareModalOpen(false)}
                        formatDate={formatDate}
                        formatCurrency={formatCurrency}
                    />
                )}

                {goalsModalOpen && goals && (
                    <WorkshopGoalsModal
                        goals={goals}
                        onClose={() => setGoalsModalOpen(false)}
                        onSaved={(updated) => { setGoals(updated); setGoalsModalOpen(false); }}
                    />
                )}

                {/* Modal Wizard de Creación / Edición */}
                {modalOpen && (
                    <WorkshopFormModal
                        isEditMode={isEditMode}
                        currentStep={currentStep}
                        setCurrentStep={setCurrentStep}
                        formData={formData}
                        setFormData={setFormData}
                        agendaBreakdown={agendaBreakdown}
                        desglose={desglose}
                        ventana={ventana}
                        loadingPrefill={loadingPrefill}
                        prefilledDate={prefilledDate}
                        onPrefill={handlePrefill}
                        onClose={() => setModalOpen(false)}
                        onSubmit={handleSubmit}
                        formatCurrency={formatCurrency}
                    />
                )}
            </div>
        </div>
    );
};

export default WorkshopDashboardPage;
