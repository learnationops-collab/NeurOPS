import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { Button, EmptyState } from '../../../components/standard';
import CabeceraWorkshop from './components/CabeceraWorkshop';
import useDatosWorkshop from './useDatosWorkshop';
import '../../comercial/comercial.css';
import './workshop-intel.css';
import './workshop-shell.css';
import WorkshopFormModal from './components/WorkshopFormModal';
import WorkshopTraficoView from './components/WorkshopTraficoView';
import WorkshopGoalsModal from './components/WorkshopGoalsModal';
import ResumenTab from './tabs/ResumenTab';
import HistorialTab from './tabs/HistorialTab';
import PlanificarTab from './tabs/PlanificarTab';
import RendimientoTab from './tabs/RendimientoTab';
import Legado from './tabs/Legado';
import CorrelacionesTab from './correlaciones/CorrelacionesTab';
import { aCamposLocales, aInicioUtc, esProximo, zonaNavegador } from './agendaTaller';

/**
 * Workshop: cuatro pestañas desde el 16/10/2026 (antes nueve sueltas), más Rendimiento (24/10/2026).
 *
 *  - Resumen: KPIs y salud del embudo de los talleres elegidos.
 *  - Talleres: el historial, con el embudo, los anuncios y la grabación de cada taller.
 *  - Planificar: próximos talleres, simulador y acciones para los que vienen.
 *  - Rendimiento: gasto y anuncios de Meta de Workshop (antes el embudo «Workshop» de Marketing).
 *  - Tráfico landings: visitas y clics de las landings (el único lugar donde está).
 *
 * La cabecera (`components/CabeceraWorkshop.jsx`) pone pestañas, filtros de la pestaña y acciones en
 * una sola línea; cada pestaña manda sus filtros ahí con <EnCabecera>. El contenido de cada pestaña
 * vive en `tabs/`; lo que todavía usa el estilo viejo se
 * envuelve solo en `.ws-shell` (`tabs/Legado.jsx`). La pestaña va en la URL (`?tab=`), así un link lleva a lo mismo.
 *
 * La página guarda solo lo que comparten las pestañas: los talleres (con su polling), metas,
 * acciones y el formulario de alta/edición.
 */

const PESTANAS = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'talleres', label: 'Talleres' },
    { key: 'planificar', label: 'Planificar' },
    { key: 'rendimiento', label: 'Rendimiento' },
    { key: 'trafico', label: 'Tráfico landings' },
    { key: 'correlaciones', label: 'Correlaciones' },
];

// Las pestañas viejas siguen abriendo lo mismo desde un link guardado.
const PESTANA_VIEJA = { list: 'talleres', funnel: 'talleres', anuncios: 'talleres', landing: 'talleres',
    proximos: 'planificar', simulador: 'planificar', acciones: 'planificar' };

const initialFormData = {
    date: '',
    // Hora en la zona del navegador; viaja como `inicio_at` en UTC (ver agendaTaller.js)
    hora: '',
    name: '',
    meet_url: '',
    whatsapp_url: '',
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
    cash_collected: 0.0,
    // Base del ticket promedio: no tiene campo en el formulario, viaja con el prefill
    cash_ventas: null,
    ventas_cobradas: null,
    replay_loom_id: '',
    replay_activo_desde: '',
    replay_vence_hasta: '',
    replay_info_minutos: 0,
    replay_oferta_minutos: 2
};

const WorkshopDashboardPage = () => {
    const [params, setParams] = useSearchParams();
    const pedida = PESTANA_VIEJA[params.get('tab')] || params.get('tab');
    const activeTab = PESTANAS.some((p) => p.key === pedida) ? pedida : 'resumen';
    // Lo que una pestaña le pide a Planificar al mandar ahí (ver PlanificarTab). Un link viejo a
    // «Simulador» o «Acciones» abre esa sección.
    const [enfoquePlan, setEnfoquePlan] = useState(() => (
        PESTANA_VIEJA[params.get('tab')] === 'planificar' ? { vista: params.get('tab') } : null));

    const irA = useCallback((tab, enfoque = null) => {
        const siguiente = new URLSearchParams(params);
        if (tab === 'resumen') siguiente.delete('tab'); else siguiente.set('tab', tab);
        setParams(siguiente, { replace: true });
        if (tab === 'planificar') setEnfoquePlan(enfoque ? { ...enfoque } : null);
    }, [params, setParams]);

    // Talleres, metas y acciones: null hasta que llega cada uno (ver useDatosWorkshop).
    const {
        events, goals, actions, fallas, recargando, recargar, fetchEvents, fetchActions, setGoals,
    } = useDatosWorkshop();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);

    const [goalsModalOpen, setGoalsModalOpen] = useState(false);

    // Formulario & Prefill
    const [formData, setFormData] = useState(initialFormData);
    const [loadingPrefill, setLoadingPrefill] = useState(false);
    const [agendaBreakdown, setAgendaBreakdown] = useState(null);
    const [prefilledDate, setPrefilledDate] = useState('');
    const [guardando, setGuardando] = useState(false);
    // Desglose vivo / grabación del taller abierto en el formulario
    const [desglose, setDesglose] = useState(null);
    const [ventana, setVentana] = useState(null);

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
                cash_collected: data.cash_collected,
                cash_ventas: data.cash_ventas,
                ventas_cobradas: data.ventas_cobradas
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
        const local = aCamposLocales(event.inicio_at);
        setFormData({
            date: local.fecha || event.date,
            hora: local.hora,
            name: event.name,
            meet_url: event.meet_url || '',
            whatsapp_url: event.whatsapp_url || '',
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
            cash_collected: event.cash_collected,
            cash_ventas: event.cash_ventas,
            ventas_cobradas: event.ventas_cobradas,
            replay_loom_id: event.replay_loom_id || '',
            replay_activo_desde: event.replay_activo_desde ? event.replay_activo_desde.slice(0, 16) : '',
            replay_vence_hasta: event.replay_vence_hasta ? event.replay_vence_hasta.slice(0, 16) : '',
            replay_info_minutos: event.replay_info_segundos != null ? Math.round((event.replay_info_segundos / 60) * 10) / 10 : 0,
            replay_oferta_minutos: event.replay_oferta_segundos != null ? Math.round((event.replay_oferta_segundos / 60) * 10) / 10 : 2
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

    // Guarda el taller. Con `cerrar: false` es el guardado parcial del wizard: el
    // director de marketing carga fecha, título e inversión antes del evento y va
    // actualizando leads, show up y pitch mientras corre, así que el modal queda
    // abierto. Si el taller todavía no existía, el primer guardado lo crea y el
    // modal pasa a modo edición para que los siguientes sean un PUT al mismo id.
    const guardarTaller = async ({ cerrar }) => {
        if (guardando) return false;
        // Un campo vaciado (el foco borra el 0) llega como '' y parseInt('') es NaN,
        // que viaja como null y el backend no lo puede convertir: cuenta como 0.
        const entero = (v) => parseInt(v) || 0;
        const decimal = (v) => parseFloat(v) || 0;
        const payload = {
            ...formData,
            inversion: decimal(formData.inversion),
            cpm: decimal(formData.cpm),
            cpc: decimal(formData.cpc),
            clics: entero(formData.clics),
            leads: entero(formData.leads),
            whatsapp_leads: entero(formData.whatsapp_leads),
            show_up: entero(formData.show_up),
            pitch_leads: entero(formData.pitch_leads),
            pitch_final_leads: entero(formData.pitch_final_leads),
            aplicaciones_form: entero(formData.aplicaciones_form),
            agendas_exitosas: entero(formData.agendas_exitosas),
            show_up_sales_call: entero(formData.show_up_sales_call),
            sales: entero(formData.sales),
            cash_collected: decimal(formData.cash_collected),
            replay_loom_id: formData.replay_loom_id || null,
            replay_activo_desde: formData.replay_activo_desde || null,
            replay_vence_hasta: formData.replay_vence_hasta || null,
            replay_info_segundos: Math.round((parseFloat(formData.replay_info_minutos) || 0) * 60),
            replay_oferta_segundos: Math.round((parseFloat(formData.replay_oferta_minutos) || 0) * 60),
            inicio_at: aInicioUtc(formData.date, formData.hora),
            zona: zonaNavegador(),
            meet_url: formData.meet_url?.trim() || null,
            whatsapp_url: formData.whatsapp_url?.trim() || null
        };
        delete payload.hora;
        delete payload.replay_info_minutos;
        delete payload.replay_oferta_minutos;

        setGuardando(true);
        try {
            let guardado;
            if (isEditMode && selectedEvent) {
                const res = await api.put(`workshop/events/${selectedEvent.id}`, payload);
                guardado = res.data;
                toast.success(cerrar ? "Registro actualizado" : "Taller guardado");
            } else {
                const res = await api.post('workshop/events', payload);
                guardado = res.data;
                toast.success(cerrar ? "Registro creado con éxito" : "Taller creado: seguí cargando y guardando");
            }
            if (cerrar) {
                setModalOpen(false);
                fetchEvents();
            } else {
                if (guardado?.id) {
                    setSelectedEvent(guardado);
                    setIsEditMode(true);
                }
                fetchEvents(true);
            }
            return true;
        } catch (err) {
            console.error("Error saving event:", err);
            const msg = err.response?.data?.error || "Error al guardar el evento";
            toast.error(msg);
            return false;
        } finally {
            setGuardando(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        guardarTaller({ cerrar: true });
    };

    // Los talleres programados que todavía no empezaron tienen todo en cero: fuera de los totales,
    // el diagnóstico y el historial. Se ven y se editan en Planificar › Próximos.
    const realizados = useMemo(() => (events ? events.filter(e => !esProximo(e)) : null), [events]);

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
        <div className="ws-espacio">
            {/* Tráfico tiene su propio recargar junto al período: el de acá recarga talleres, metas y
                acciones sin vaciar la pantalla (lo que se ve queda hasta que llega lo nuevo). */}
            <CabeceraWorkshop pestanas={PESTANAS} activa={activeTab} onPestana={(key) => irA(key)}
                eventos={events} onIrAProximos={() => irA('planificar', { vista: 'proximos' })}
                recargando={recargando} onRecargar={activeTab === 'trafico' || activeTab === 'rendimiento' ? null : recargar}
                onRegistrar={handleOpenCreateModal}>

                <div className="ws-contenido">
                        {/* Tráfico no depende de los talleres cargados: va fuera de los guards de abajo. */}
                        {activeTab === 'correlaciones' ? <CorrelacionesTab /> : activeTab === 'rendimiento' ? (
                            <RendimientoTab />
                        ) : activeTab === 'trafico' ? (
                            <WorkshopTraficoView />
                        ) : fallas.events && !events ? (
                            <div className="dc-shell dc-shell--embebido">
                                <EmptyState title="No se pudieron cargar los talleres"
                                    action={<Button onClick={() => fetchEvents()}>Reintentar</Button>}>
                                    Revisá la conexión y volvé a intentar.
                                </EmptyState>
                            </div>
                        ) : activeTab === 'planificar' ? (
                            <PlanificarTab
                                events={events}
                                realizados={realizados}
                                goals={goals}
                                onGoalsUpdated={setGoals}
                                actions={actions}
                                onActionsChanged={fetchActions}
                                enfoque={enfoquePlan}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDeleteEvent}
                                onProgramado={() => fetchEvents(true)}
                                formatCurrency={formatCurrency}
                            />
                        ) : activeTab === 'talleres' ? (
                            <HistorialTab
                                events={events}
                                realizados={realizados}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDeleteEvent}
                                onRefresh={fetchEvents}
                                formatDate={formatDate}
                                formatCurrency={formatCurrency}
                            />
                        ) : realizados?.length === 0 ? (
                            <Legado>
                                <section className="empty-state">
                                    <p className="eyebrow">Empezá por acá</p>
                                    <h2>No hay workshops registrados</h2>
                                    <p>Registrá el primero para empezar a medir el embudo.</p>
                                    <button type="button" className="primary-action" onClick={handleOpenCreateModal}>
                                        <Plus size={16} /> Registrar taller
                                    </button>
                                </section>
                            </Legado>
                        ) : (
                            <ResumenTab
                                realizados={realizados}
                                goals={goals}
                                actions={actions}
                                onEditGoals={() => setGoalsModalOpen(true)}
                                onGoToSimulador={(etapa) => irA('planificar', { vista: 'simulador', etapa })}
                            />
                        )}

                </div>

                {/* Los modales todavía son del estilo viejo. */}
                <Legado>
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
                            onGuardar={() => guardarTaller({ cerrar: false })}
                            guardando={guardando}
                            formatCurrency={formatCurrency}
                            deMeta={isEditMode && selectedEvent
                                ? { inversion: selectedEvent.inversion_de_meta, clics: selectedEvent.clics_de_meta,
                                    leads: selectedEvent.leads_de_meta }
                                : null}
                        />
                    )}
                </Legado>
            </CabeceraWorkshop>
        </div>
    );
};

export default WorkshopDashboardPage;
