import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus, Edit2, Trash2, Calendar, RefreshCw,
    TrendingUp, DollarSign, Activity, Loader2, Sparkles,
    X, Check, ArrowRight, ArrowLeft, AlertCircle, LayoutGrid, List, BarChart3, HelpCircle, Zap
} from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';

const StatCard = ({ label, value, icon: Icon, colorClass, subtitle }) => (
    <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group hover:border-slate-700/80 transition-all duration-300">
        <div className="absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 bg-indigo-500 group-hover:opacity-20 transition-opacity" />
        <div className="flex justify-between items-start relative z-10">
            <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-2">{label}</p>
                <p className="text-3xl font-black text-white italic tracking-tighter">{value}</p>
                {subtitle && <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-wider">{subtitle}</p>}
            </div>
            <div className={`p-3 rounded-2xl bg-slate-950 border border-slate-800 ${colorClass}`}>
                <Icon size={20} />
            </div>
        </div>
    </div>
);

const WorkshopDashboardPage = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentStep, setCurrentStep] = useState(1); // 1, 2, 3
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

    // Form states
    const [formData, setFormData] = useState({
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
    });

    const [loadingPrefill, setLoadingPrefill] = useState(false);
    const [agendaBreakdown, setAgendaBreakdown] = useState(null);
    const [activeTab, setActiveTab] = useState('list'); // 'list' | 'funnel'
    const [selectedEventForFunnel, setSelectedEventForFunnel] = useState(null);
    const [prefilledDate, setPrefilledDate] = useState(''); // Controlar si ya se precargó la fecha actual en el paso 3

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
        setFormData({
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
        });
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

    const handleNextStep = () => {
        if (currentStep === 1) {
            if (!formData.date || !formData.name) {
                toast.error("La fecha y el nombre son obligatorios");
                return;
            }
            setCurrentStep(2);
        } else if (currentStep === 2) {
            setCurrentStep(3);
            // Si no se han cargado datos para esta fecha, precargar automáticamente
            if (formData.date && prefilledDate !== formData.date) {
                handlePrefill(formData.date);
            }
        }
    };

    const handlePrevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
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

    // Resincronizar los campos del sistema desde el prefill sin abrir el modal
    const [resyncing, setResyncing] = useState(false);
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

    // Global stats computed from all workshops
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

    // Live calculations of ratios for modal preview
    const liveCalculations = useMemo(() => {
        const inv = parseFloat(formData.inversion) || 0;
        const cpm = parseFloat(formData.cpm) || 0;
        const clics = parseInt(formData.clics) || 0;
        const leads = parseInt(formData.leads) || 0;
        const wa_leads = parseInt(formData.whatsapp_leads) || 0;
        const show = parseInt(formData.show_up) || 0;
        const pitch = parseInt(formData.pitch_leads) || 0;
        const pitch_fin = parseInt(formData.pitch_final_leads) || 0;
        const apps = parseInt(formData.aplicaciones_form) || 0;
        const ags = parseInt(formData.agendas_exitosas) || 0;
        const call_show = parseInt(formData.show_up_sales_call) || 0;
        const sls = parseInt(formData.sales) || 0;
        const cash = parseFloat(formData.cash_collected) || 0;

        const impresiones = cpm > 0 ? (inv / cpm) * 1000 : 0;
        const ctr = impresiones > 0 ? (clics / impresiones) * 100 : 0;
        const conv_leads = clics > 0 ? (leads / clics) * 100 : 0;
        const cpl = leads > 0 ? inv / leads : 0;
        const tx_wa = leads > 0 ? (wa_leads / leads) * 100 : 0;
        const show_up_pct = wa_leads > 0 ? (show / wa_leads) * 100 : 0;
        const ret_clase = show > 0 ? (pitch / show) * 100 : 0;
        const ret_pitch = pitch > 0 ? (pitch_fin / pitch) * 100 : 0;
        const pct_app = pitch_fin > 0 ? (apps / pitch_fin) * 100 : 0;
        const pct_app_ag = apps > 0 ? (ags / apps) * 100 : 0;
        const pct_conv_ag = pitch_fin > 0 ? (ags / pitch_fin) * 100 : 0;
        const cost_ag = ags > 0 ? inv / ags : 0;
        const pct_show_call = apps > 0 ? (call_show / apps) * 100 : 0;
        const pct_close = call_show > 0 ? (sls / call_show) * 100 : 0;
        const ticket = sls > 0 ? cash / sls : 0;
        const roas = inv > 0 ? cash / inv : 0;

        return {
            impresiones,
            ctr,
            conv_leads,
            cpl,
            tx_wa,
            show_up_pct,
            ret_clase,
            ret_pitch,
            pct_app,
            pct_app_ag,
            pct_conv_ag,
            cost_ag,
            pct_show_call,
            pct_close,
            ticket,
            roas
        };
    }, [formData]);

    const activeFunnelData = useMemo(() => {
        if (!selectedEventForFunnel) return [];
        const e = selectedEventForFunnel;
        const leads = e.leads || 0;
        
        const pct = (val) => leads > 0 ? ((val / leads) * 100).toFixed(1) + '%' : '0%';
        
        return [
            { label: 'Leads', value: leads, rate: '100%', detail: 'Base del embudo — prospectos registrados' },
            { label: 'WhatsApp', value: e.whatsapp_leads, rate: pct(e.whatsapp_leads), sub: 'Entrada WA', detail: 'Leads que entraron al grupo' },
            { label: 'Asistencia Webinar', value: e.show_up, rate: pct(e.show_up), sub: 'Show up Webinar', detail: 'Vieron el webinar en vivo' },
            { label: 'Leads en Pitch', value: e.pitch_leads, rate: pct(e.pitch_leads), sub: 'Retención Clase', detail: 'Se quedaron hasta el pitch' },
            { label: 'Final de Pitch', value: e.pitch_final_leads, rate: pct(e.pitch_final_leads), sub: 'Retención Pitch', detail: 'Vieron la oferta final' },
            { label: 'Aplicaciones Calendly', value: e.aplicaciones_form, rate: pct(e.aplicaciones_form), sub: 'Tasa Aplicación', detail: 'Llenaron formulario Calendly' },
            { label: 'Agendas Exitosas', value: e.agendas_exitosas, rate: pct(e.agendas_exitosas), sub: 'Aplicación a Agenda', detail: 'Agendaron cita con closer' },
            { label: 'Show up Sales Call', value: e.show_up_sales_call, rate: pct(e.show_up_sales_call), sub: 'Show Up en Cita', detail: 'Asistieron a la llamada de ventas' },
            { label: 'Ventas (Sales)', value: e.sales, rate: pct(e.sales), sub: 'Close Rate', detail: 'Cierres de venta completados' }
        ];
    }, [selectedEventForFunnel]);

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
            {/* Background elements */}
            <div className="absolute top-0 inset-x-0 h-[400px] bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />
            <div className="absolute top-40 -left-40 w-96 h-96 bg-emerald-600/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-20 -right-40 w-96 h-96 bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-7xl mx-auto space-y-10 relative z-10">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-900 pb-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            <Sparkles size={12} className="animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Webinar Intelligence Hub</span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black text-white italic tracking-tighter uppercase leading-none">
                            Webinar & <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">Workshop Tracker</span>
                        </h1>
                        <p className="text-slate-500 font-bold text-xs md:text-sm uppercase tracking-widest max-w-2xl">
                            Consola de control de inversión publicitaria y embudo de conversión para webinars. Analiza la efectividad publicitaria y el ROAS real.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={fetchEvents}
                            className="p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                        
                        {/* Toggle Vista */}
                        <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
                            <button
                                onClick={() => setViewMode('cards')}
                                className={`px-4 py-2.5 rounded-xl flex items-center gap-2 text-[9px] font-black uppercase tracking-wider transition-all ${viewMode === 'cards' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                <LayoutGrid size={14} />
                                Tarjetas
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-4 py-2.5 rounded-xl flex items-center gap-2 text-[9px] font-black uppercase tracking-wider transition-all ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                <List size={14} />
                                Tabla
                            </button>
                        </div>

                        <button
                            onClick={handleOpenCreateModal}
                            className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 border border-indigo-500/30 text-white rounded-2xl hover:from-indigo-500 hover:to-indigo-400 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-600/20"
                        >
                            <Plus size={16} />
                            Registrar Taller
                        </button>
                    </div>
                </div>

                {/* KPI stats aggregated */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        label="Inversión Acumulada"
                        value={formatCurrency(totalStats.inversion)}
                        icon={DollarSign}
                        colorClass="text-slate-400"
                        subtitle={`Promedio: ${formatCurrency(events.length ? totalStats.inversion / events.length : 0)}`}
                    />
                    <StatCard
                        label="Leads Totales"
                        value={totalStats.leads.toLocaleString()}
                        icon={Activity}
                        colorClass="text-indigo-400"
                        subtitle={`Entrada WA: ${totalStats.whatsapp_leads.toLocaleString()}`}
                    />
                    <StatCard
                        label="Cash Collected"
                        value={formatCurrency(totalStats.cash)}
                        icon={DollarSign}
                        colorClass="text-emerald-400"
                        subtitle={`Ventas: ${totalStats.sales} trans.`}
                    />
                    <StatCard
                        label="ROAS Global"
                        value={`${totalStats.roas.toFixed(2)}x`}
                        icon={TrendingUp}
                        colorClass={totalStats.roas >= 3 ? "text-emerald-400" : "text-amber-400"}
                        subtitle={`Ticket Promedio: ${formatCurrency(totalStats.sales ? totalStats.cash / totalStats.sales : 0)}`}
                    />
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-900 gap-6">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'list' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        Historial de Eventos
                    </button>
                    <button
                        onClick={() => setActiveTab('funnel')}
                        className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'funnel' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        Embudo de Conversión (Funnel)
                    </button>
                </div>

                {/* Main Content Area */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40 space-y-4">
                        <Loader2 size={48} className="animate-spin text-indigo-500" />
                        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs">Cargando métricas de workshops...</p>
                    </div>
                ) : events.length === 0 ? (
                    <div className="py-32 text-center bg-slate-900/20 rounded-[2.5rem] border border-dashed border-slate-800 space-y-4">
                        <Activity size={48} className="mx-auto text-slate-700" />
                        <p className="text-slate-400 font-black uppercase text-sm">No hay workshops registrados</p>
                        <p className="text-xs text-slate-600 font-bold uppercase tracking-wider">Comienza haciendo clic en el botón "+ Registrar Taller" de arriba</p>
                    </div>
                ) : activeTab === 'list' ? (
                    viewMode === 'cards' ? (
                        /* Dashboard Cards View */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {events.map((e) => {
                                const roasColor = e.roas >= 3 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : e.roas >= 1.0 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-rose-400 bg-rose-500/10 border-rose-500/20";
                                const roasGlow = e.roas >= 3 ? "group-hover:border-emerald-500/30" : e.roas >= 1.0 ? "group-hover:border-amber-500/30" : "group-hover:border-rose-500/30";
                                return (
                                    <div key={e.id} className={`bg-slate-900/40 border border-slate-800 rounded-[2rem] p-6 space-y-6 relative overflow-hidden group hover:bg-slate-900/80 transition-all duration-300 ${roasGlow}`}>
                                        <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-10 bg-indigo-500 pointer-events-none" />
                                        
                                        {/* Card Header */}
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] font-black uppercase tracking-widest italic">
                                                    {formatDate(e.date)}
                                                </span>
                                                <h3 className="text-xl font-black text-white italic tracking-tighter uppercase mt-2 group-hover:text-indigo-400 transition-colors">
                                                    {e.name}
                                                </h3>
                                            </div>
                                            <span className={`px-3 py-1 rounded-xl text-[10px] font-black border tracking-widest ${roasColor}`}>
                                                {e.roas.toFixed(2)}x ROAS
                                            </span>
                                        </div>

                                        {/* Financial Overview */}
                                        <div className="grid grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/30">
                                            <div>
                                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Inversión</p>
                                                <p className="text-sm font-black text-slate-300">{formatCurrency(e.inversion)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Recaudado</p>
                                                <p className="text-sm font-black text-emerald-400">{formatCurrency(e.cash_collected)}</p>
                                            </div>
                                        </div>

                                        {/* Mini funnel stats grid */}
                                        <div className="grid grid-cols-3 gap-y-3 gap-x-2 text-xs">
                                            <div>
                                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Leads (WA)</p>
                                                <p className="font-bold text-white">{e.leads} <span className="text-[9px] text-slate-500">({e.whatsapp_leads})</span></p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Show Up</p>
                                                <p className="font-bold text-white">{e.show_up} <span className="text-[9px] text-indigo-400 font-black">{e.show_up_rate}%</span></p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Agendas</p>
                                                <p className="font-bold text-white">{e.agendas_exitosas}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Conv. Leads</p>
                                                <p className="font-bold text-white">{e.conversion_leads}%</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Costo Agenda</p>
                                                <p className="font-bold text-white">{formatCurrency(e.costo_por_agenda)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Ventas (Closes)</p>
                                                <p className="font-bold text-white">{e.sales} <span className="text-[9px] text-emerald-400 font-black">{e.pct_close_rate}%</span></p>
                                            </div>
                                        </div>

                                        {/* Action footer */}
                                        <div className="flex justify-between items-center border-t border-slate-900 pt-4 mt-2">
                                            <button
                                                onClick={() => {
                                                    setSelectedEventForFunnel(e);
                                                    setActiveTab('funnel');
                                                }}
                                                className="flex items-center gap-1.5 text-[9px] text-indigo-400 hover:text-indigo-300 font-black uppercase tracking-widest"
                                            >
                                                Ver Embudo
                                                <ArrowRight size={10} />
                                            </button>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleOpenEditModal(e)}
                                                    className="p-2 bg-slate-950 border border-slate-800 rounded-xl hover:bg-slate-800 hover:text-white text-slate-400 transition-colors"
                                                    title="Editar registro"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteEvent(e.id)}
                                                    className="p-2 bg-slate-950 border border-slate-800 rounded-xl hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 transition-colors"
                                                    title="Eliminar registro"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Table View */
                        <div className="bg-slate-950 border border-slate-900 rounded-3xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-900/50 border-b border-slate-900">
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Clase / Evento</th>
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Inversión</th>
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Leads</th>
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">CPL</th>
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Tasa WA</th>
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Show up %</th>
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Agendas</th>
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Costo Agenda</th>
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ventas</th>
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Collected</th>
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">ROAS</th>
                                            <th className="p-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-900/50">
                                        {events.map((e) => (
                                            <tr key={e.id} className="hover:bg-slate-900/25 transition-colors group">
                                                <td className="p-5 text-xs font-black text-white whitespace-nowrap italic">{formatDate(e.date)}</td>
                                                <td className="p-5 text-xs font-black text-slate-300 uppercase tracking-wider">{e.name}</td>
                                                <td className="p-5 text-xs font-black text-white text-right whitespace-nowrap">{formatCurrency(e.inversion)}</td>
                                                <td className="p-5 text-xs font-black text-indigo-300 text-right">{e.leads.toLocaleString()}</td>
                                                <td className="p-5 text-xs font-black text-indigo-400 text-right whitespace-nowrap">{formatCurrency(e.cpl)}</td>
                                                <td className="p-5 text-xs font-bold text-slate-400 text-right">{e.tx_entrada_whatsapp}%</td>
                                                <td className="p-5 text-xs font-bold text-slate-400 text-right">{e.show_up_rate}%</td>
                                                <td className="p-5 text-xs font-black text-white text-right">{e.agendas_exitosas}</td>
                                                <td className="p-5 text-xs font-black text-slate-400 text-right whitespace-nowrap">{formatCurrency(e.costo_por_agenda)}</td>
                                                <td className="p-5 text-xs font-black text-white text-right">{e.sales}</td>
                                                <td className="p-5 text-xs font-black text-emerald-400 text-right whitespace-nowrap">{formatCurrency(e.cash_collected)}</td>
                                                <td className="p-5 text-xs text-right">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest ${e.roas >= 3 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : e.roas >= 1 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                                        {e.roas.toFixed(2)}x
                                                    </span>
                                                </td>
                                                <td className="p-5 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handleOpenEditModal(e)}
                                                            className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 hover:text-white text-slate-400 transition-colors"
                                                            title="Editar datos"
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteEvent(e.id)}
                                                            className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 transition-colors"
                                                            title="Eliminar evento"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                ) : (
                    /* Funnel View */
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Selector de Evento */}
                        <div className="lg:col-span-1 bg-slate-900/30 border border-slate-900 p-6 rounded-3xl space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Seleccionar Evento</h3>
                            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                                {events.map((e) => (
                                    <button
                                        key={e.id}
                                        onClick={() => setSelectedEventForFunnel(e)}
                                        className={`w-full text-left p-4 rounded-2xl border transition-all flex justify-between items-center ${selectedEventForFunnel?.id === e.id ? 'bg-indigo-600/10 border-indigo-500/40 text-white' : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:bg-slate-900/40'}`}
                                    >
                                        <div>
                                            <p className="text-xs font-black italic leading-none mb-1">{formatDate(e.date)}</p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{e.name}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-white">{e.roas.toFixed(2)}x ROAS</p>
                                            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">{formatCurrency(e.inversion)} inv.</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Visual Funnel Chart */}
                        <div className="lg:col-span-2 bg-slate-900/20 border border-slate-900 p-8 rounded-[2.5rem] space-y-8">
                            <div className="flex justify-between items-start border-b border-slate-900 pb-4">
                                <div>
                                    <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">{selectedEventForFunnel?.name}</h3>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{formatDate(selectedEventForFunnel?.date)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleResyncFunnel}
                                        disabled={resyncing}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-300 text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                        title="Actualizar Aplicaciones, Agendas, Show up y Ventas desde el sistema"
                                    >
                                        {resyncing ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                                        {resyncing ? 'Actualizando...' : 'Resync Sistema'}
                                    </button>
                                    <div className="text-right">
                                        <span className="text-emerald-400 font-black text-2xl italic tracking-tighter">{selectedEventForFunnel && `${selectedEventForFunnel.roas.toFixed(2)}x ROAS`}</span>
                                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Retorno de Inversión</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-5">
                                {activeFunnelData.map((step, idx) => {
                                    let conversionFromPrev = '';
                                    if (idx > 0 && activeFunnelData[idx - 1].value > 0) {
                                        const pct = (step.value / activeFunnelData[idx - 1].value) * 100;
                                        conversionFromPrev = `${pct.toFixed(1)}% de retención`;
                                    }

                                    return (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex justify-between items-end text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-black text-slate-400 flex items-center justify-center italic">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="font-black text-white uppercase tracking-wider">{step.label}</span>
                                                    {conversionFromPrev && (
                                                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                                                            ({conversionFromPrev})
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-black text-white text-sm tracking-tighter">{step.value.toLocaleString()}</span>
                                                    {step.sub && (
                                                        <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[8px] text-indigo-400 font-black uppercase tracking-widest">
                                                            {step.rate}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Bar container */}
                                            <div className="w-full h-3 bg-slate-950 border border-slate-900 rounded-full overflow-hidden relative group/bar">
                                                <div
                                                    className="h-full bg-gradient-to-r from-indigo-600 to-emerald-500 rounded-full transition-all duration-1000 origin-left"
                                                    style={{ width: `${selectedEventForFunnel?.leads ? (step.value / selectedEventForFunnel.leads) * 100 : 0}%` }}
                                                />
                                            </div>
                                            <p className="text-[8px] text-slate-600 font-bold uppercase tracking-wider pl-7">{step.detail}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {modalOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
                        <div className="bg-slate-950 border border-slate-850 w-full max-w-xl rounded-[2.5rem] overflow-hidden shadow-2xl relative border-indigo-500/20">
                            
                            {/* Progress Header Steps */}
                            <div className="px-8 py-5 bg-slate-900/40 border-b border-slate-900 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${currentStep >= 1 ? 'bg-indigo-600 text-white border-indigo-500 border' : 'bg-slate-900 text-slate-500 border border-slate-850'}`}>1</div>
                                    <div className="w-6 h-0.5 bg-slate-800" />
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${currentStep >= 2 ? 'bg-indigo-600 text-white border-indigo-500 border' : 'bg-slate-900 text-slate-500 border border-slate-850'}`}>2</div>
                                    <div className="w-6 h-0.5 bg-slate-800" />
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${currentStep >= 3 ? 'bg-indigo-600 text-white border-indigo-500 border' : 'bg-slate-900 text-slate-500 border border-slate-850'}`}>3</div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Paso {currentStep} de 3</p>
                                    <p className="text-[10px] text-indigo-400 font-black uppercase tracking-wider italic">
                                        {currentStep === 1 ? 'Tráfico & Anuncios' : currentStep === 2 ? 'Embudo Webinar' : 'Confirmación Sistema'}
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="p-8 space-y-6">
                                
                                {/* PASO 1: Tráfico y Anuncios (Meta Ads) */}
                                {currentStep === 1 && (
                                    <div className="space-y-5 animate-fadeIn">
                                        <div>
                                            <h3 className="text-lg font-black text-white italic tracking-tighter uppercase">Tráfico & Meta Ads</h3>
                                            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Ingresa los datos generales del evento y la inversión en publicidad</p>
                                        </div>

                                        <div className="space-y-4 bg-slate-900/10 border border-slate-900 p-5 rounded-2xl">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Fecha del Evento</label>
                                                    <input
                                                        type="date"
                                                        disabled={isEditMode}
                                                        value={formData.date}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Nombre del Workshop</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Ej: Webinar IA"
                                                        value={formData.name}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none uppercase font-bold"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Inversión Ads (USD)</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-3 text-slate-500 text-xs">$</span>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={formData.inversion}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, inversion: e.target.value }))}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-8 p-3 text-xs text-white focus:border-indigo-500 outline-none font-bold"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">CPM (Ads)</label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={formData.cpm}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, cpm: e.target.value }))}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">CPC único</label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={formData.cpc}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, cpc: e.target.value }))}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Clics Únicos</label>
                                                <input
                                                    type="number"
                                                    value={formData.clics}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, clics: e.target.value }))}
                                                    className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* PASO 2: Conversión del Webinar (Datos del Evento) */}
                                {currentStep === 2 && (
                                    <div className="space-y-5 animate-fadeIn">
                                        <div>
                                            <h3 className="text-lg font-black text-white italic tracking-tighter uppercase">Asistencia & Retención</h3>
                                            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Ingresa los leads captados y las métricas de retención durante el webinar</p>
                                        </div>

                                        <div className="space-y-4 bg-slate-900/10 border border-slate-900 p-5 rounded-2xl">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Leads Totales</label>
                                                    <input
                                                        type="number"
                                                        value={formData.leads}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, leads: e.target.value }))}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Leads en WhatsApp</label>
                                                    <input
                                                        type="number"
                                                        value={formData.whatsapp_leads}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_leads: e.target.value }))}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Show Up en Webinar</label>
                                                <input
                                                    type="number"
                                                    value={formData.show_up}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, show_up: e.target.value }))}
                                                    className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Leads en Pitch</label>
                                                    <input
                                                        type="number"
                                                        value={formData.pitch_leads}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, pitch_leads: e.target.value }))}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Leads Final Pitch</label>
                                                    <input
                                                        type="number"
                                                        value={formData.pitch_final_leads}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, pitch_final_leads: e.target.value }))}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* PASO 3: Métricas del Sistema (Autocompletado) */}
                                {currentStep === 3 && (
                                    <div className="space-y-5 animate-fadeIn">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="text-lg font-black text-white italic tracking-tighter uppercase">Validación del Sistema</h3>
                                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Confirma los datos obtenidos automáticamente del sistema NeurOPS</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handlePrefill(formData.date)}
                                                className="p-2.5 bg-slate-900 border border-slate-850 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                                                title="Sincronizar del sistema"
                                            >
                                                <RefreshCw size={14} className={loadingPrefill ? 'animate-spin' : ''} />
                                            </button>
                                        </div>

                                        <div className="space-y-4 bg-slate-900/10 border border-slate-900 p-5 rounded-2xl relative">
                                            {loadingPrefill && (
                                                <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-20 space-y-2">
                                                    <Loader2 size={20} className="animate-spin text-indigo-500" />
                                                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Sincronizando base de datos...</p>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Aplicaciones Form</label>
                                                    <input
                                                        type="number"
                                                        value={formData.aplicaciones_form}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, aplicaciones_form: e.target.value }))}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none font-bold"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Agendas Exitosas</label>
                                                    <input
                                                        type="number"
                                                        value={formData.agendas_exitosas}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, agendas_exitosas: e.target.value }))}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none font-bold"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Show up Sales Call</label>
                                                    <input
                                                        type="number"
                                                        value={formData.show_up_sales_call}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, show_up_sales_call: e.target.value }))}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Ventas Cerradas</label>
                                                    <input
                                                        type="number"
                                                        value={formData.sales}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, sales: e.target.value }))}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none font-bold"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Cash Collected (USD)</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-3 text-emerald-500 text-xs">$</span>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={formData.cash_collected}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, cash_collected: e.target.value }))}
                                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-8 p-3 text-xs text-emerald-400 border-emerald-500/20 bg-emerald-500/5 focus:border-emerald-500 outline-none font-bold"
                                                    />
                                                </div>
                                            </div>

                                            {/* Agenda Breakdown visual details */}
                                            {agendaBreakdown && (
                                                <div className="mt-3 bg-slate-950/60 p-3 rounded-xl border border-slate-900 space-y-1.5">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Citas y Asistencias de Closer</p>
                                                    <div className="grid grid-cols-3 gap-1 text-[8px] font-bold text-slate-400">
                                                        <div className="bg-slate-900/60 p-1.5 rounded">Asistió: {agendaBreakdown["Show Up"]}</div>
                                                        <div className="bg-slate-900/60 p-1.5 rounded">No Asistió: {agendaBreakdown["No Show"]}</div>
                                                        <div className="bg-slate-900/60 p-1.5 rounded">Cancelada: {agendaBreakdown["Cancelada"]}</div>
                                                        <div className="bg-slate-900/60 p-1.5 rounded">Reagendada: {agendaBreakdown["Reagendada"]}</div>
                                                        <div className="bg-slate-900/60 p-1.5 rounded">Pendiente: {agendaBreakdown["Pendiente"]}</div>
                                                        <div className="bg-slate-900/60 p-1.5 rounded">Otros: {agendaBreakdown["Otros"]}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Previsualización KPIs */}
                                        <div className="bg-slate-900/5 border border-slate-900 p-4 rounded-xl space-y-2.5">
                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 leading-none">Previsualización de Métricas</p>
                                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900">
                                                    <p className="text-[8px] text-slate-500 font-bold uppercase">CPL</p>
                                                    <p className="font-black text-indigo-400">{formatCurrency(liveCalculations.cpl)}</p>
                                                </div>
                                                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900">
                                                    <p className="text-[8px] text-slate-500 font-bold uppercase">Costo Agenda</p>
                                                    <p className="font-black text-slate-300">{formatCurrency(liveCalculations.cost_ag)}</p>
                                                </div>
                                                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900">
                                                    <p className="text-[8px] text-slate-500 font-bold uppercase">ROAS</p>
                                                    <p className={`font-black ${liveCalculations.roas >= 3 ? 'text-emerald-400' : 'text-amber-400'}`}>{liveCalculations.roas.toFixed(2)}x</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Modal Actions Navigation */}
                                <div className="flex justify-between items-center border-t border-slate-900 pt-6 mt-4">
                                    {currentStep > 1 ? (
                                        <button
                                            type="button"
                                            onClick={handlePrevStep}
                                            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest border border-slate-800 flex items-center gap-2"
                                        >
                                            <ArrowLeft size={12} />
                                            Atrás
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setModalOpen(false)}
                                            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest border border-slate-800"
                                        >
                                            Cancelar
                                        </button>
                                    )}

                                    {currentStep < 3 ? (
                                        <button
                                            type="button"
                                            onClick={handleNextStep}
                                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-600/20 border border-indigo-500/30"
                                        >
                                            Siguiente
                                            <ArrowRight size={12} />
                                        </button>
                                    ) : (
                                        <button
                                            type="submit"
                                            className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 border border-emerald-500/30"
                                        >
                                            {isEditMode ? 'Guardar Cambios' : 'Registrar Evento'}
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkshopDashboardPage;
