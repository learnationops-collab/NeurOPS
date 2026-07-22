import React, { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Activity, Loader2, Sparkles, LayoutGrid, List } from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import WorkshopKpiCards from './components/WorkshopKpiCards';
import WorkshopCardsView from './components/WorkshopCardsView';
import WorkshopTableView from './components/WorkshopTableView';
import WorkshopFunnelView from './components/WorkshopFunnelView';
import WorkshopFormModal from './components/WorkshopFormModal';

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
    const [activeTab, setActiveTab] = useState('list'); // 'list' | 'funnel'
    const [selectedEventForFunnel, setSelectedEventForFunnel] = useState(null);
    
    // Formulario & Prefill
    const [formData, setFormData] = useState(initialFormData);
    const [loadingPrefill, setLoadingPrefill] = useState(false);
    const [agendaBreakdown, setAgendaBreakdown] = useState(null);
    const [prefilledDate, setPrefilledDate] = useState('');
    const [resyncing, setResyncing] = useState(false);

    useEffect(() => {
        fetchEvents();
    }, []);

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
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 inset-x-0 h-[400px] bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />
            <div className="absolute top-40 -left-40 w-96 h-96 bg-emerald-600/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-20 -right-40 w-96 h-96 bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-7xl mx-auto space-y-8 relative z-10">
                {/* Header Ejecutiva CEO */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-900 pb-8">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            <Sparkles size={12} className="animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">CEO Executive Analytics</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
                            Rendimiento & <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400">Workshop Intelligence</span>
                        </h1>
                        <p className="text-slate-500 font-bold text-xs md:text-sm uppercase tracking-widest max-w-2xl">
                            Consola ejecutiva de análisis financiero, ROI publicitario y eficiencia de embudo para talleres y webinars.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={fetchEvents}
                            className="p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                            title="Recargar eventos"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                        
                        <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
                            <button
                                onClick={() => setViewMode('cards')}
                                className={`px-4 py-2.5 rounded-xl flex items-center gap-2 text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    viewMode === 'cards' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <LayoutGrid size={14} />
                                Tarjetas
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-4 py-2.5 rounded-xl flex items-center gap-2 text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    viewMode === 'table' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <List size={14} />
                                Tabla Comparativa
                            </button>
                        </div>

                        <button
                            onClick={handleOpenCreateModal}
                            className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 border border-indigo-500/30 text-white rounded-2xl hover:from-indigo-500 hover:to-indigo-400 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-600/20 cursor-pointer"
                        >
                            <Plus size={16} />
                            Registrar Taller
                        </button>
                    </div>
                </div>

                {/* Tarjetas KPI Ejecutivas */}
                <WorkshopKpiCards totalStats={totalStats} eventsCount={events.length} />

                {/* Navegación por pestañas */}
                <div className="flex border-b border-slate-900 gap-6">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
                            activeTab === 'list' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        Historial de Eventos ({events.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('funnel')}
                        className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
                            activeTab === 'funnel' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        Análisis de Embudo (Funnel)
                    </button>
                </div>

                {/* Area Principal de Contenido */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40 space-y-4">
                        <Loader2 size={48} className="animate-spin text-indigo-500" />
                        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs">Cargando inteligencia de workshops...</p>
                    </div>
                ) : events.length === 0 ? (
                    <div className="py-32 text-center bg-slate-900/20 rounded-[2.5rem] border border-dashed border-slate-800 space-y-4">
                        <Activity size={48} className="mx-auto text-slate-700" />
                        <p className="text-slate-400 font-black uppercase text-sm">No hay workshops registrados</p>
                        <p className="text-xs text-slate-600 font-bold uppercase tracking-wider">Haz clic en "+ Registrar Taller" para agregar tu primer evento</p>
                    </div>
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
                        />
                    )
                ) : (
                    <WorkshopFunnelView
                        events={events}
                        selectedEvent={selectedEventForFunnel}
                        onSelectEvent={setSelectedEventForFunnel}
                        onResync={handleResyncFunnel}
                        resyncing={resyncing}
                        formatDate={formatDate}
                        formatCurrency={formatCurrency}
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
