import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
    Users, Layers, Search, Check, X, ChevronRight, Loader2,
    Calendar, Phone, Mail, Instagram, ExternalLink,
    CalendarDays, AlertCircle, DollarSign, CreditCard,
    Save, ArrowLeft, ArrowRight, CheckCircle2, User, PenTool, LogOut, Trash2, Pencil
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import ClientHistoryModal from '../../components/shared/ClientHistoryModal';
import LeadRoadmapDetail from '../../components/leads/LeadRoadmapDetail';
import CommentsSection from '../../components/shared/CommentsSection';
import TriageFollowUpModal from '../triage/components/TriageFollowUpModal';
import OperatorControls from '../../components/modals/OperatorControls';
import CloserDashboard from './dashboard/CloserDashboard';
import CloserLeadsAudit from './audit/CloserLeadsAudit';
import SeguimientosPane from './components/SeguimientosPane';
import MiCarteraPane from './components/MiCarteraPane';
import LeadEditModal from './components/LeadEditModal';
import ProcrastinarModal from './components/ProcrastinarModal';
import { localInputsToUtcIso, parseUtcIso, splitLocalDateTime, toLocalDateStr, localToday, localDateFromNow } from '../../utils/datetime';

const ORDINALES = ['primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'];

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Qué falta para poder guardar, en palabras y al lado del botón. Nace de un reporte real: un
// closer completaba todo lo que la pantalla marcaba como obligatorio, tocaba "Completar
// Seguimiento" y no pasaba nada — el botón estaba deshabilitado por un requisito que no se
// mostraba en ningún lado, y un botón deshabilitado no da ninguna señal al tocarlo.
const MissingFieldsHint = ({ items }) => (
    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
            {items.length === 1 ? 'Falta esto para poder guardar' : `Faltan ${items.length} cosas para poder guardar`}
        </p>
        <ul className="space-y-1">
            {items.map(t => (
                <li key={t} className="text-[11px] font-bold text-amber-200/90 flex gap-1.5">
                    <span className="text-amber-400">•</span>{t}
                </li>
            ))}
        </ul>
    </div>
);

// Aviso por WhatsApp del seguimiento que se está programando: si lo quiere y a qué hora.
// La hora es la del closer y es obligatoria para que salga el mensaje, así que al activar el
// check sin hora se repone 09:00 en vez de dejar un aviso que nunca se enviaría.
const AvisoSeguimientoWhatsApp = ({ enabled, time, onChange, fecha }) => (
    <div className="space-y-2 p-3 bg-slate-950/40 border border-slate-850 rounded-2xl">
        <label className="flex items-center gap-2 cursor-pointer">
            <input
                type="checkbox"
                checked={!!enabled}
                onChange={(e) => onChange({ enabled: e.target.checked, time: time || '09:00' })}
                className="w-4 h-4 accent-violet-500"
            />
            <h4 className="text-[10px] font-black uppercase text-slate-400">
                Avisarme por WhatsApp este seguimiento
            </h4>
        </label>
        {enabled && (
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase text-slate-500">A las</span>
                <input
                    type="time"
                    value={time || '09:00'}
                    onChange={(e) => onChange({ enabled: true, time: e.target.value })}
                    className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200"
                />
                <span className="text-[9px] font-medium text-slate-500 normal-case">
                    hora tuya{fecha ? `, el ${fecha}` : ''}
                </span>
            </div>
        )}
    </div>
);

// Fecha corta legible para las fichas de lead (fecha de agendamiento / fecha de ingreso).
const formatIdcardDate = (iso) => {
    if (!iso) return null;
    const d = parseUtcIso(iso) || new Date(iso);
    if (!d || isNaN(d.getTime())) return null;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Cuenta regresiva/tiempo transcurrido respecto a la hora agendada de una cita ("en 2 h 10 min",
// "hace 3 días"), en vez de una fecha cruda que no dice nada sobre urgencia sin hacer la cuenta
// a mano. `nowMs` se pasa desde afuera (no `Date.now()` acá adentro) para que el resultado
// dependa del reloj vivo del componente (`nowTick`) y no quede pegado al momento del primer
// render — así se actualiza solo con el tiempo real.
const formatApptCountdown = (startIso, nowMs) => {
    const start = parseUtcIso(startIso);
    if (!start) return null;
    const diffMs = start.getTime() - nowMs;
    const absMs = Math.abs(diffMs);

    // Media hora de margen para "ahora mismo": ni el closer ni el lead miran el reloj al segundo.
    if (absMs <= 5 * 60 * 1000) return { label: 'Ahora mismo', kind: 'now' };

    const mins = Math.floor(absMs / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    let amount;
    if (days >= 1) {
        const remH = hours % 24;
        amount = `${days} día${days !== 1 ? 's' : ''}${remH > 0 ? ` ${remH} h` : ''}`;
    } else if (hours >= 1) {
        const remM = mins % 60;
        amount = `${hours} h${remM > 0 ? ` ${remM} min` : ''}`;
    } else {
        amount = `${mins} min`;
    }

    if (diffMs > 0) {
        return { label: `En ${amount}`, kind: hours < 2 ? 'soon' : 'future' };
    }
    return { label: `Hace ${amount}`, kind: 'past' };
};

// Link de WhatsApp para contactar al lead directamente desde la ficha durante el seguimiento.
const waLinkForPhone = (phone, leadName) => {
    const clean = phone ? phone.replace(/\D/g, '') : '';
    if (!clean) return null;
    const greeting = `Hola ${leadName || ''}, te saluda tu asesor de NeurOPS. ¿Cómo estás?`.replace(/\s+/g, ' ').trim();
    return `https://wa.me/${clean}?text=${encodeURIComponent(greeting)}`;
};

const CloserWorkflowPage = () => {
    const { user, logout } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [showOperatorControls, setShowOperatorControls] = useState(false);

    const activeStep = searchParams.get('step') || 'confirmations';

    // Atajo 'w' para Acceso Simulado (operador). CloserWorkflowPage corre fuera de
    // MainLayout (para que los modales fixed funcionen standalone), por lo que no
    // hereda el HotkeysManager global y necesita su propio listener.
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (
                e.target.tagName === 'INPUT' ||
                e.target.tagName === 'TEXTAREA' ||
                e.target.isContentEditable
            ) return;
            if (e.key.toLowerCase() === 'w' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                setShowOperatorControls(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Reloj vivo para las cuentas regresivas de las tarjetas del mazo ("en 2 h", "hace 20 min"):
    // sin esto, "cuánto falta" quedaría congelado en el momento en que se cargó la página.
    // 30s alcanza para que se sienta "en vivo" sin recalcular en cada render.
    const [nowTick, setNowTick] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNowTick(Date.now()), 30000);
        return () => clearInterval(id);
    }, []);

    // Vista activa v6: 'inbox' (bandeja) o 'report' (reporte del día)
    const [activeView, setActiveView] = useState('inbox');
    // Pestaña temporal "Auditoría" — solo visible mientras Operaciones la tenga activada
    // (ver LeadsAuditTogglePanel.jsx y GET /closer/leads-audit/status).
    const [auditEnabled, setAuditEnabled] = useState(false);
    useEffect(() => {
        api.get('/closer/leads-audit/status')
            .then(res => setAuditEnabled(!!res.data?.enabled))
            .catch(() => setAuditEnabled(false));
    }, []);
    const [reportSent, setReportSent] = useState(false);
    const [sendingReport, setSendingReport] = useState(false);
    // Día que se está reportando (por defecto hoy) — permite reportar días anteriores sin
    // límite, para que el closer pueda ponerse al día si se le pasó alguno.
    const [reportDate, setReportDate] = useState(localToday());
    const [reportSentAt, setReportSentAt] = useState(null);
    const [loadingReportStatus, setLoadingReportStatus] = useState(false);
    // Estado de HOY específicamente (independiente del día que se esté viendo en el selector de
    // arriba) — es lo que decora el dock flotante ("✓ Reporte enviado"), que siempre habla de hoy.
    const [todayReportSent, setTodayReportSent] = useState(false);

    // Estado del reporte v6
    const [reflection, setReflection] = useState({ win: '', fix: '' });
    // Único número del reporte que el sistema no puede calcular solo (no existe ninguna señal
    // persistida de "slots disponibles configurados" ese día) — se pide a mano, todo lo demás
    // sale de la Bandeja.
    const [reportSlots, setReportSlots] = useState('');
    const [offDaysMode, setOffDaysMode] = useState(null); // 0 = no, 1 = si
    const [selectedOffDays, setSelectedOffDays] = useState(new Set());
    const [submittingReport, setSubmittingReport] = useState(false);
    // Resumen en vivo de lo que el closer tocó ese día (Conversando/Confirmados/Show ups/
    // Reagendas/Seguimientos/Referidos) — reemplaza los inputs manuales de referidos: todo sale
    // de CloserService.get_daily_activity_summary.
    const [dailyActivity, setDailyActivity] = useState(null);
    // Puntos de experiencia del día: se usa tanto en "Tu día" (arriba de todo) como en el
    // Resumen del Reporte del día — un solo lugar para no repetir la fórmula ni que se
    // desincronicen. Pesos documentados en detalle donde se usa por primera vez, más abajo.
    const dailyXp = useMemo(() => {
        if (!dailyActivity) return 0;
        return (
            (dailyActivity.confirmados_hoy || 0) * 10 +
            (dailyActivity.confirmados_proximos || 0) * 5 +
            (dailyActivity.show_ups || 0) * 20 +
            (dailyActivity.seguimientos_hechos || 0) * 8 +
            (dailyActivity.referidos_capturados || 0) * 15 +
            (dailyActivity.ventas_count || 0) * 100
        );
    }, [dailyActivity]);
    const [reportStatusRefreshKey, setReportStatusRefreshKey] = useState(0);
    // Trabajo atrasado de días ANTERIORES al que se está reportando (confirmaciones nunca
    // gestionadas, llamadas confirmadas sin registrar su resultado, seguimientos vencidos sin
    // marcar como hechos) — bloquea el envío del reporte hasta que se resuelva (ver
    // CloserService.get_previous_days_pending).
    const [pendingPreviousDays, setPendingPreviousDays] = useState(null);
    // Últimos 7 días de cash cobrado (GET /closer/deck/daily-trend), para el mini gráfico de
    // barras del hero de "Cerrar el día" — solo se pide al entrar a esa vista.
    const [dailyTrend, setDailyTrend] = useState([]);
    // Seguimientos "cerrada" (cobros) del día que se está reportando — para el 4° KPI
    // ("Cobros resueltos") y el logro "Primer cobro". Mismo endpoint que ya usa SeguimientosPane.
    const [seguimientosHoyGrouped, setSeguimientosHoyGrouped] = useState(null);
    // Meta diaria de seguimientos (mismo dato que ya muestra la pestaña ③ Seguir) — para el
    // logro "Meta de seguimientos".
    const [seguimientosGoal, setSeguimientosGoal] = useState(null);
    // Si ese atraso además TRABA el envío del reporte, o solo se avisa. Lo decide el toggle
    // `bloqueo_reporte_backlog` desde Operaciones → Configuración, no el frontend.
    const [backlogBlocksReport, setBacklogBlocksReport] = useState(false);
    // Si "slots" no tiene valor guardado para el día elegido, se sugiere automáticamente el
    // último valor que el closer haya reportado (para no reescribir la misma cifra todos los
    // días) — sigue siendo editable, no es un valor fijo.
    const [reportSlotsIsDefault, setReportSlotsIsDefault] = useState(false);
    // Lead cuya ficha se está corrigiendo (nombre/teléfono/correo/instagram/fecha de la llamada).
    const [editingLead, setEditingLead] = useState(null);
    // Aviso en vivo si los slots escritos no llegan a las agendas del día: un cupo agendado
    // sigue siendo un cupo, así que ese número es imposible (venía pasando en reportes reales).
    const slotsPorDebajoDeAgendas = (
        reportSlots.trim() !== '' &&
        dailyActivity?.agendas_del_dia !== undefined &&
        Number(reportSlots) < dailyActivity.agendas_del_dia
    );

    // Consultar si el día elegido ya tiene un reporte enviado (y precargar lo que ya se había
    // escrito) cada vez que se entra a la pestaña de reporte, se cambia el día a reportar, o se
    // pide un refresh manual (botón "Actualizar" del resumen, tras corregir algo en la bandeja).
    useEffect(() => {
        if (activeView !== 'report') return;
        setLoadingReportStatus(true);
        api.get('/closer/deck/daily-report', { params: { date: reportDate } })
            .then(res => {
                const d = res.data || {};
                setReportSent(!!d.sent);
                setReportSentAt(d.sent_at || null);
                setReflection({ win: d.reflection_victory || '', fix: d.reflection_opportunity || '' });
                // Prioridad del default (pedido del usuario, 28/ago/2026): los slots del día NUNCA
                // pueden ser menos que las agendas que realmente tiene ese día (`agendas_del_dia` —
                // un cupo ocupado sigue siendo un cupo), así que ese es el default correcto, no un
                // valor recordado de otro día distinto (`slots_last_value`, que puede no tener nada
                // que ver con la cantidad de agendas de HOY). El closer sigue pudiendo editarlo hacia
                // arriba si tuvo más cupos disponibles que los que ocupó.
                if (d.slots !== null && d.slots !== undefined) {
                    setReportSlots(String(d.slots));
                    setReportSlotsIsDefault(false);
                } else if (d.activity?.agendas_del_dia) {
                    setReportSlots(String(d.activity.agendas_del_dia));
                    setReportSlotsIsDefault(true);
                } else if (d.slots_last_value !== null && d.slots_last_value !== undefined) {
                    setReportSlots(String(d.slots_last_value));
                    setReportSlotsIsDefault(true);
                } else {
                    setReportSlots('');
                    setReportSlotsIsDefault(false);
                }
                setDailyActivity(d.activity || null);
                setPendingPreviousDays(d.pending_previous_days || null);
                setBacklogBlocksReport(!!d.backlog_blocks_report);
                if (reportDate === localToday()) setTodayReportSent(!!d.sent);
            })
            .catch(err => console.error('Error al consultar el estado del reporte:', err))
            .finally(() => setLoadingReportStatus(false));
    }, [activeView, reportDate, reportStatusRefreshKey]);

    // Datos extra de "Cerrar el día" — gráfico de 7 días y cobros del día, calcados de la
    // referencia visual. Solo se piden en esa vista, igual que el resto del estado del reporte.
    useEffect(() => {
        if (activeView !== 'report') return;
        api.get('/closer/deck/daily-trend', { params: { date: reportDate } })
            .then(res => setDailyTrend(res.data || []))
            .catch(() => setDailyTrend([]));
        api.get(`/closer/followups/today?selected_date=${reportDate}`)
            .then(res => setSeguimientosHoyGrouped(res.data?.grouped || null))
            .catch(() => setSeguimientosHoyGrouped(null));
        api.get(`/closer/followups/goal?selected_date=${reportDate}`)
            .then(res => setSeguimientosGoal(res.data || null))
            .catch(() => setSeguimientosGoal(null));
    }, [activeView, reportDate, reportStatusRefreshKey]);

    // Agendas y carga
    const [agendas, setAgendas] = useState([]);
    // Señal de recarga para la pestaña de seguimientos (ver fetchAgendas): sube en cada acción
    // que modifica el mazo para que el panel vuelva a pedir sus propios datos.
    const [seguimientosRefreshKey, setSeguimientosRefreshKey] = useState(0);

    // Chequeo silencioso del estado de hoy al cargar el mazo, sin depender de que el closer
    // entre a la pestaña de reporte — la tarjeta "Tu día" necesita `activity` (trabajo real de
    // hoy, no solo lo que trajo la pestaña activa) desde el arranque, y se vuelve a pedir cada
    // vez que `seguimientosRefreshKey` sube (esa señal ya se dispara después de cualquier acción
    // que modifica el mazo, así que "Tu día" queda al día sin agregar otro punto de recarga).
    useEffect(() => {
        api.get('/closer/deck/daily-report', { params: { date: localToday() } })
            .then(res => {
                setTodayReportSent(!!res.data?.sent);
                setDailyActivity(res.data?.activity || null);
            })
            .catch(() => {});
    }, [seguimientosRefreshKey]);

    const [unreadNoAgenda, setUnreadNoAgenda] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    // Llamadas de hoy YA reportadas (para la columna "Reportadas" del Kanban de ② Reportar).
    // `step=calls` del mazo excluye por diseño lo ya procesado (closer_processed=true) — no hay
    // forma de pedirlo por ahí. `step=agendas` sí trae todo lo del día sin filtrar por estado,
    // así que se filtra acá del lado del cliente.
    const [reportedTodayCalls, setReportedTodayCalls] = useState([]);

    // Contadores de pestañas (v6)
    const [counts, setCounts] = useState({ confirmations: 0, calls: 0, seguimientos: 0 });

    // "Quiero procrastinar" (v7): calculadora de "esto vale la pena antes de irte a scrollear",
    // a pedido del usuario (27/ago/2026). Es una simulación editable, no un reporte de datos
    // reales — no hay una tasa "de verdad" de respuesta/cierre de seguimientos disponible acá
    // sin pegarle a otro endpoint, así que arranca con valores por defecto razonables y el closer
    // los ajusta con los sliders.
    const [showProcrastinar, setShowProcrastinar] = useState(false);

    // Celebraciones de hitos en el pipeline de confirmaciones (v7)
    const [confirmadosHoy, setConfirmadosHoy] = useState(0);
    const [vaciamosPorConfirmar, setVaciamosPorConfirmar] = useState(false);
    const [celebration, setCelebration] = useState(null);

    // Plan de cuotas del lead (seguimiento de cobro - cliente ya cerrado)
    const [cuotasPlan, setCuotasPlan] = useState([]);
    const [loadingCuotas, setLoadingCuotas] = useState(false);

    // Búsqueda global (v6)
    const [searchScope, setSearchScope] = useState('all');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [searching, setSearching] = useState(false);
    // Historial completo del cliente (agendas/ventas/pagos) — accesible como vista secundaria
    // desde el modal de etapa (botón "Ver historial completo"), ya no es lo que abre por
    // defecto un resultado de búsqueda (ver handleSelectSearchResult).
    const [historyClientId, setHistoryClientId] = useState(null);

    // Selector de agenda cuando la búsqueda global encuentra un lead con varias agendas
    // pendientes de confirmar — el closer elige a cuál de todas le está marcando el estado.
    const [agendaPicker, setAgendaPicker] = useState({ open: false, appointments: [] });

    // Modal de Seguimiento tras cambio de estado / venta
    const [followUpModal, setFollowUpModal] = useState({
        show: false,
        agendaId: null,
        leadName: '',
        newStatus: '',
        isSaleFollowUp: false
    });
    const [savingFollowUp, setSavingFollowUp] = useState(false);
    
    // Búsqueda local
    const [searchQuery, setSearchQuery] = useState('');
    const [decisionMakerPrompt, setDecisionMakerPrompt] = useState({ apptId: null });
    const [selectedDate, setSelectedDate] = useState(localToday);
    
    // Cita seleccionada para el visor de la derecha (modal overlay v7)
    const [selectedLead, setSelectedLead] = useState(null);

    // Estado del árbol de decisiones del modal de lead v7 (pestaña, paso actual, camino recorrido y formulario de sesión)
    const [modalTab, setModalTab] = useState('act');
    const [modalStep, setModalStep] = useState('root');
    const [modalFlowLabel, setModalFlowLabel] = useState('');
    const [decisionPath, setDecisionPath] = useState([]);
    const [sessionForm, setSessionForm] = useState({});

    // Modales secundarios v7: Nueva Agenda y Referido Manual
    const [newAgendaModalOpen, setNewAgendaModalOpen] = useState(false);
    const [newAgendaForm, setNewAgendaForm] = useState({
        lead_name: '',
        instagram: '',
        phone: '',
        email: '',
        date: localToday(),
        time: '18:00',
        origin: 'Setter',
        examen: ''
    });

    const [manualRefModalOpen, setManualRefModalOpen] = useState(false);
    const [manualRefForm, setManualRefForm] = useState({
        from_lead_id: null,
        from_lead_name: '',
        lead_name: '',
        instagram: '',
        phone: '',
        email: '',
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

    // Equipo (menciones) para el modal de seguimiento — fetch perezoso, una sola vez
    const [teamMembers, setTeamMembers] = useState(null);
    const fetchTeamMembers = useCallback(async () => {
        if (teamMembers !== null) return;
        try {
            const res = await api.get('/closer/team-members');
            setTeamMembers(res.data || []);
        } catch (err) {
            console.error("Error al cargar el equipo:", err);
            setTeamMembers([]);
        }
    }, [teamMembers]);

    useEffect(() => {
        if (selectedLead) {
            fetchTeamMembers();
        }
    }, [selectedLead, fetchTeamMembers]);

    // Reasignar lead a otro closer — estado del selector inline en la ficha del modal.
    const [reassignOpen, setReassignOpen] = useState(false);
    const [reassigning, setReassigning] = useState(false);

    // Flujo de registro de venta directo post-Show Up
    const [salePrompt, setSalePrompt] = useState({ apptId: null });
    const [saleModalOpen, setSaleModalOpen] = useState(false);
    const [saleStep, setSaleStep] = useState(1);
    const [submittingSale, setSubmittingSale] = useState(false);
    const [saleForm, setSaleForm] = useState({
        lead_id: '',
        client_id: null,
        email_vendedor: user?.email || '',
        nombre_cliente: '',
        telefono: '',
        mail_cliente: '',
        programa: 'RR',
        tipo_pago_simple: 'completo',
        monto: '',
        precio_total: '',
        num_cuotas: 3,
        cuotaFechas: {},
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
        date: localToday()
    });

    // Sincronizar email del closer en cuanto esté cargado en la sesión
    useEffect(() => {
        if (user?.email) {
            setSaleForm(prev => ({ ...prev, email_vendedor: user.email }));
        }
    }, [user]);

    // Estado de pago del cliente para el programa seleccionado (cuánto ya pagó, cuánto le
    // falta, qué tipos de pago corresponden a continuación) — evita volver a pedir el monto
    // total de un programa que el cliente ya viene pagando, y deshabilita tipos de pago que
    // romperían la secuencia (ej. Cuota sin Parcial previo).
    const [saleClientState, setSaleClientState] = useState(null);
    const [loadingSaleState, setLoadingSaleState] = useState(false);
    const [settleBalanceWithSale, setSettleBalanceWithSale] = useState(false);

    useEffect(() => {
        if (!saleModalOpen) {
            setSaleClientState(null);
            setSettleBalanceWithSale(false);
            return;
        }
        setLoadingSaleState(true);
        const params = saleForm.client_id
            ? { client_id: saleForm.client_id, programa: saleForm.programa }
            : { email: saleForm.mail_cliente, instagram: saleForm.instagram, phone: saleForm.telefono, name: saleForm.nombre_cliente, programa: saleForm.programa };
        api.get('/closer/sales/client-state', { params })
            .then(res => {
                setSaleClientState(res.data);
                // Sugerir el Total del cliente (ya pagando o recién autoasignado por programa:
                // AL 1000 / RR 1500 / SI 2000) sin pisar lo que el closer ya haya escrito a mano.
                setSaleForm(prev => ({
                    ...prev,
                    precio_total: prev.precio_total || String(res.data.program_price || ''),
                    monto: (res.data?.total_paid > 0 && !prev.monto && res.data.balance_remaining > 0) ? String(res.data.balance_remaining) : prev.monto
                }));
                // Si el tipo de pago actualmente elegido ya no corresponde para este cliente,
                // saltar al primer tipo permitido en vez de dejar seleccionada una opción
                // deshabilitada (el backend igual bloquea, esto es solo para no confundir).
                const allowed = res.data?.allowed_types || {};
                setSaleForm(prev => {
                    const current = (prev.tipo_pago_simple || '').toLowerCase();
                    if (allowed[current]?.ok !== false) return prev;
                    const TIPO_OPTION_VALUES = { completo: 'completo', parcial: 'parcial', 'seña': 'Seña', cuota: 'Cuota', renovacion: 'Renovacion', upsell: 'Upsell' };
                    const firstAllowed = Object.keys(allowed).find(k => allowed[k].ok);
                    return firstAllowed ? { ...prev, tipo_pago_simple: TIPO_OPTION_VALUES[firstAllowed] || prev.tipo_pago_simple } : prev;
                });
            })
            .catch(err => { console.error('Error al obtener el estado de pago del cliente:', err); setSaleClientState(null); })
            .finally(() => setLoadingSaleState(false));
    }, [saleModalOpen, saleForm.client_id, saleForm.programa, saleForm.mail_cliente, saleForm.instagram, saleForm.telefono]);

    // Plan de cuotas YA existente de este cliente (de un Parcial declarado antes). Al registrar
    // una Cuota hay que marcar cuál de las cuotas ya planificadas se está pagando, no volver a
    // armar el cronograma desde cero (eso borraba el historial de cuotas ya cobradas).
    const [saleExistingCuotas, setSaleExistingCuotas] = useState([]);
    const [loadingSaleCuotas, setLoadingSaleCuotas] = useState(false);
    const [selectedCuotaId, setSelectedCuotaId] = useState(null);
    const isCuotaPayment = (saleForm.tipo_pago_simple || '').toLowerCase() === 'cuota';

    useEffect(() => {
        if (!saleModalOpen || !isCuotaPayment || !salePrompt.apptId) {
            setSaleExistingCuotas([]);
            setSelectedCuotaId(null);
            return;
        }
        setLoadingSaleCuotas(true);
        api.get(`/closer/installments/${salePrompt.apptId}`, { params: { programa_code: saleForm.programa } })
            .then(res => {
                const cuotas = res.data?.cuotas || [];
                setSaleExistingCuotas(cuotas);
                const pendientes = cuotas.filter(c => c.estado !== 'pagado');
                if (pendientes.length > 0) {
                    setSelectedCuotaId(pendientes[0].id);
                    setSaleForm(prev => ({ ...prev, monto: prev.monto || String(pendientes[0].monto) }));
                }
            })
            .catch(err => console.error('Error al cargar el plan de cuotas existente:', err))
            .finally(() => setLoadingSaleCuotas(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saleModalOpen, isCuotaPayment, salePrompt.apptId, saleForm.programa]);

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

    // Seleccionar lead desde resultados de búsqueda global — en vez de abrir siempre el resumen
    // genérico del cliente, resuelve en qué etapa real está (confirmación pendiente, llamada por
    // reportar, seguimiento en curso, o llamada cerrada/cobranza) y abre el modal correspondiente
    // a esa etapa (GET /closer/leads/<client_id>/stage). Si tiene varias agendas pendientes de
    // confirmar, se muestra un selector para elegir sobre cuál marcar el estado.
    const handleSelectSearchResult = async (lead) => {
        setShowSearchResults(false);
        setSearchQuery('');

        if (!lead.id) {
            // Sin Client todavía (lead sintético desde FinancialAgenda, sin fila propia en la
            // base local) — no hay etapa que resolver, se abre la ficha simple de siempre.
            setSelectedLead({
                id: -Math.floor(Math.random() * 100000),
                lead_name: lead.username || "Sin Nombre",
                email: lead.email || "",
                phone: lead.phone || "",
                instagram: lead.instagram || "",
                origin: lead.appointment?.setter_name ? "Setter" : "Desconocido",
                setter_name: lead.appointment?.setter_name || "Sin Asignar",
                closer_result: "Pendiente"
            });
            return;
        }

        setLoading(true);
        try {
            const res = await api.get(`/closer/leads/${lead.id}/stage`);
            const stage = res.data;

            if (stage.stage === 'confirm') {
                if (stage.appointments.length > 1) {
                    setAgendaPicker({ open: true, appointments: stage.appointments });
                } else if (stage.appointments.length === 1) {
                    const a = stage.appointments[0];
                    handleSelectLead({ id: a.id, fase: 'confirm', result: a.result });
                } else {
                    toast.error('Este cliente no tiene agendas pendientes de confirmar.');
                }
            } else if (stage.stage === 'seg') {
                handleSelectLead({ id: stage.appointment_id, fase: 'seg', tipo: stage.tipo });
            } else if (stage.stage === 'cerrada') {
                handleSelectLead({
                    id: stage.appointment_id,
                    client_id: stage.client_id,
                    lead_name: stage.lead_name,
                    instagram: stage.instagram,
                    phone: stage.phone,
                    examen: stage.examen,
                    origin: stage.origin,
                    closer_notes: stage.closer_notes,
                    seguimiento_intento: stage.seguimiento_intento,
                    call_date: stage.call_date,
                    enrollment_date: stage.enrollment_date,
                    deuda: stage.deuda,
                    programa_nombre: stage.programa_nombre,
                    programa_code: stage.programa_code,
                    proxima_cuota: stage.proxima_cuota,
                    fase: 'seg',
                    tipo: 'cerrada'
                });
            } else if (stage.stage === 'call') {
                handleSelectLead({ id: stage.appointment_id, fase: 'call' });
            } else {
                toast.error('Este cliente no tiene ninguna agenda activa — se abre su historial completo.');
                setHistoryClientId(lead.id);
            }
        } catch (err) {
            console.error("Error al resolver la etapa del lead:", err);
            toast.error("Error al abrir el lead");
        } finally {
            setLoading(false);
        }
    };

    // Abrir una agenda puntual específica desde el historial completo del cliente — reporte de
    // llamada de esa cita (misma ruta que "llamada por reportar" de la búsqueda global).
    const handleOpenAppointmentFromHistory = (appointmentId) => {
        setHistoryClientId(null);
        handleSelectLead({ id: appointmentId, fase: 'call' });
    };

    // "Registrar venta/pago" desde el resumen del cliente — abre el mismo modal de Declarar
    // Venta de siempre, precargado con los datos del cliente, anclado a su agenda más reciente
    // (el modal necesita una cita de referencia para el plan de cuotas y el registro del pago).
    const handleRegisterSaleFromHistory = (client, mostRecentAppointmentId) => {
        setHistoryClientId(null);
        if (!mostRecentAppointmentId) {
            toast.error("Este cliente no tiene ninguna agenda registrada todavía — creale una agenda antes de declarar una venta.");
            return;
        }
        openSaleModalForLead({
            id: mostRecentAppointmentId,
            client_id: client.id,
            lead_name: client.full_name,
            phone: client.phone,
            email: client.email,
            instagram: client.instagram,
            examen: '',
            setter_name: ''
        }, true);
    };

    // Crear Nueva Agenda (Modal v7)
    const handleCreateAgenda = async () => {
        if (!newAgendaForm.lead_name.trim()) {
            toast.error("El nombre del prospecto es obligatorio");
            return;
        }
        if (!newAgendaForm.phone.trim()) {
            toast.error("El teléfono del prospecto es obligatorio");
            return;
        }
        if (!newAgendaForm.instagram.trim()) {
            toast.error("El Instagram del prospecto es obligatorio");
            return;
        }
        if (!newAgendaForm.email.trim()) {
            toast.error("El correo del prospecto es obligatorio");
            return;
        }
        if (!isValidEmail(newAgendaForm.email.trim())) {
            toast.error("El correo del prospecto no es válido");
            return;
        }
        if (!newAgendaForm.date || !newAgendaForm.time) {
            toast.error("La fecha y hora son obligatorias");
            return;
        }
        setProcessingId('new_agenda');
        try {
            const payload = {
                start_time: localInputsToUtcIso(newAgendaForm.date, newAgendaForm.time),
                origin: newAgendaForm.origin,
                client_data: {
                    name: newAgendaForm.lead_name,
                    instagram: newAgendaForm.instagram.replace('@', '').trim(),
                    phone: newAgendaForm.phone.trim(),
                    email: newAgendaForm.email.trim()
                }
            };
            await api.post('/closer/appointments', payload);
            toast.success("Agenda creada correctamente");
            setNewAgendaModalOpen(false);
            setNewAgendaForm({
                lead_name: '',
                instagram: '',
                phone: '',
                email: '',
                date: localToday(),
                time: '18:00',
                origin: 'Setter',
                examen: ''
            });
            fetchAgendas();
        } catch (err) {
            console.error("Error al crear agenda:", err);
            toast.error(err.response?.data?.error || "Error al crear la agenda");
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
        if (!manualRefForm.phone.trim()) {
            toast.error("El teléfono del referido es obligatorio");
            return;
        }
        if (!manualRefForm.instagram.trim()) {
            toast.error("El Instagram del referido es obligatorio");
            return;
        }
        if (!manualRefForm.email.trim()) {
            toast.error("El correo del referido es obligatorio");
            return;
        }
        if (!isValidEmail(manualRefForm.email.trim())) {
            toast.error("El correo del referido no es válido");
            return;
        }
        setProcessingId('manual_ref');
        try {
            const payload = {
                from_lead_id: manualRefForm.from_lead_id,
                lead_name: manualRefForm.lead_name,
                instagram: manualRefForm.instagram.replace('@', '').trim(),
                phone: manualRefForm.phone.trim(),
                email: manualRefForm.email.trim(),
                notes: manualRefForm.notes
            };
            await api.post('/closer/deck/referrals/manual', payload);
            toast.success("Referido guardado correctamente");
            setManualRefModalOpen(false);
            setManualRefForm({
                from_lead_id: null,
                from_lead_name: '',
                lead_name: '',
                instagram: '',
                phone: '',
                email: '',
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

    // Reasignar el lead abierto a otro closer — pase de mano rápido, sin necesidad de admin ni
    // de ser el dueño actual (mismo criterio permisivo del resto del flujo: cualquier closer
    // puede editar cualquier lead).
    const handleReassignLead = async (newCloserId) => {
        if (!selectedLead?.id || !newCloserId) return;
        setReassigning(true);
        try {
            const res = await api.patch(`/closer/appointments/${selectedLead.id}/reassign`, { closer_id: Number(newCloserId) });
            setSelectedLead(prev => prev ? { ...prev, closer_id: res.data.closer_id, closer_name: res.data.closer_name, owner_closer_name: null } : prev);
            setReassignOpen(false);
            toast.success(`Lead reasignado a ${res.data.closer_name}`);
            fetchAgendas();
        } catch (err) {
            console.error("Error al reasignar lead:", err);
            toast.error(err.response?.data?.error || "Error al reasignar el lead");
        } finally {
            setReassigning(false);
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

    // Cargar agendas del día del closer.
    // `refreshSeguimientos`: la pestaña de seguimientos no se alimenta de `agendas` sino de sus
    // propios endpoints (/closer/followups/*), así que cualquier acción que recargue el mazo debe
    // avisarle para que un seguimiento recién resuelto desaparezca sin recargar la página. Se
    // apaga solo en la carga por cambio de pestaña/día, donde el panel ya se monta pidiendo datos.
    const fetchAgendas = async ({ refreshSeguimientos = true } = {}) => {
        setLoading(true);
        try {
            const url = `/closer/deck?step=${activeStep}&selected_date=${selectedDate}`;
            const res = await api.get(url);
            const dataList = res.data || [];
            setAgendas(dataList);

            // Llamadas del día seleccionado ya reportadas, solo relevante en la pestaña de
            // Llamadas (columna "Reportadas" del Kanban) — ver el estado `reportedTodayCalls`
            // para el porqué de la consulta aparte.
            if (activeStep === 'calls') {
                try {
                    const allDayRes = await api.get(`/closer/deck?step=agendas&selected_date=${selectedDate}`);
                    setReportedTodayCalls((allDayRes.data || []).filter(a => a.closer_processed));
                } catch (err) {
                    console.error("Error al cargar llamadas reportadas del día:", err);
                }
            } else {
                setReportedTodayCalls([]);
            }

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
            // Aunque falle la carga del mazo: la acción que la disparó ya se guardó, y el panel
            // de seguimientos tiene que reflejarla igual.
            if (refreshSeguimientos) setSeguimientosRefreshKey(k => k + 1);
        }
    };

    useEffect(() => {
        fetchAgendas({ refreshSeguimientos: false });
    }, [activeStep, selectedDate]);

    // Cargar el plan de cuotas real al abrir el seguimiento de cobro de un cliente ya cerrado
    useEffect(() => {
        if (modalStep !== 'segventa' || !selectedLead?.id || selectedLead.id <= 0) {
            setCuotasPlan([]);
            return;
        }
        setLoadingCuotas(true);
        api.get(`/closer/installments/${selectedLead.id}`)
            .then(res => setCuotasPlan(res.data.cuotas || []))
            .catch(err => console.error('Error al cargar el plan de cuotas:', err))
            .finally(() => setLoadingCuotas(false));
    }, [modalStep, selectedLead?.id]);

    const handleMarkCuotaPaid = async (cuotaId) => {
        try {
            await api.patch(`/closer/installments/cuota/${cuotaId}`, { estado: 'pagado' });
            setCuotasPlan(prev => prev.map(c => c.id === cuotaId ? { ...c, estado: 'pagado' } : c));
            toast.success('Cuota marcada como pagada');
        } catch (err) {
            console.error('Error al marcar la cuota como pagada:', err);
            toast.error('Error al marcar la cuota como pagada');
        }
    };

    // Guardar la fecha de seguimiento del modal (soporta string o objeto con cobro + normal)
    const handleConfirmFollowUp = async (followUpData) => {
        if (!followUpModal.agendaId) return;
        setSavingFollowUp(true);
        try {
            const payload = {};
            if (typeof followUpData === 'object' && followUpData !== null) {
                if (followUpData.normal) payload.fecha_seguimiento = followUpData.normal;
                if (followUpData.cobro) {
                    payload.fecha_seguimiento_cobro = followUpData.cobro;
                    if (!followUpData.normal) payload.fecha_seguimiento = followUpData.cobro;
                }
                payload.seguimiento_realizado = false;
            } else {
                payload.fecha_seguimiento = followUpData;
                payload.seguimiento_realizado = false;
            }
            if (followUpModal.tipo) {
                payload.seguimiento_tipo = followUpModal.tipo;
                payload.seguimiento_sub = followUpModal.newStatus || 'Seguimiento programado';
                payload.seguimiento_intento = 1;
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
        } else if (actionType === 'confirm_discard') {
            setProcessingId(apptId);
            try {
                await api.post(`/closer/appointments/${apptId}/process`, { status: 'No Lead', role: 'closer', note: note });
                toast.success("Lead descartado del pipeline de confirmaciones");
                if (selectedLead?.id === apptId) setSelectedLead(null);
                fetchAgendas();
            } catch (err) {
                console.error(err);
                toast.error("Error al descartar el lead");
            } finally {
                setProcessingId(null);
            }
        } else if (actionType === 'lost_no_show' || actionType === 'lost_after_pres' || actionType === 'lost_no_pres') {
            // Descarte post-llamada (no show reiterado, perdido tras presentar oferta, o sin
            // presentación) — a diferencia de 'confirm_discard'/'no_lead' (pre-llamada, prospecto
            // nunca calificado), acá el lead sí llegó a estar en el funnel de cierre, así que se
            // marca 'Lead Perdido' en vez de 'No Lead'. Faltaba este branch por completo: el modal
            // se cerraba sin llamar a ningún endpoint, así que "Descartar lead" no hacía nada
            // (reportado por un closer real intentando descartar por bloqueo tras un No Show).
            setProcessingId(apptId);
            // Si venía de "No Show" con un motivo puntual elegido (ej. "Bloqueó / desapareció"),
            // se antepone al comentario libre en vez de perderse — mismo formato que ya usa el
            // camino de "Programar seguimiento" (sessionForm.rmot) para no show/cancelación.
            const fullNote = actionType === 'lost_no_show' && sessionForm.motivo
                ? `${sessionForm.motivo}. ${note}`
                : note;
            try {
                await api.post(`/closer/appointments/${apptId}/process`, { status: 'Lead Perdido', role: 'closer', note: fullNote });
                toast.success("Lead marcado como perdido");
                if (selectedLead?.id === apptId) setSelectedLead(null);
                fetchAgendas();
            } catch (err) {
                console.error(err);
                toast.error("Error al descartar el lead");
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
        setReassignOpen(false);
        const tomorrowStr = localDateFromNow(1);

        // Recordatorio pre-llamada: si el lead ya tiene uno guardado, prellenarlo; si no,
        // sugerir 2 horas antes de la hora de la cita como default editable.
        let defaultReminder = '';
        if (lead.pre_call_reminder_at) {
            const { date, time } = splitLocalDateTime(lead.pre_call_reminder_at);
            defaultReminder = date && time ? `${date}T${time}` : '';
        } else if (lead.start_time) {
            const startDate = parseUtcIso(lead.start_time);
            if (startDate) {
                const suggested = new Date(startDate.getTime() - 2 * 60 * 60 * 1000);
                const { date, time } = splitLocalDateTime(suggested.toISOString());
                defaultReminder = date && time ? `${date}T${time}` : '';
            }
        }

        const isSeguimientoLead = activeStep === 'seguimientos' || lead.fase === 'seg';

        setSessionForm({
            confirm_status: null,
            notes: lead.closer_notes || lead.notes || '',
            // Para seguimientos, "result" trackea el resultado de ESTE intento (no_resp/contesto/...) y
            // debe arrancar vacío; para el resto de flujos sigue reflejando el estado actual del lead.
            result: isSeguimientoLead ? null : (lead.closer_result || lead.result || 'Pendiente'),
            fecha_seguimiento: tomorrowStr,
            pre_call_reminder_at: defaultReminder,
            pre_call_reminder_enabled: !!lead.pre_call_reminder_at,
            // Aviso del seguimiento por WhatsApp. Si el lead YA tiene un seguimiento programado
            // se respeta lo que el closer haya elegido para él; si se está creando uno nuevo,
            // viene activado. No sirve mirar `followup_reminder_enabled !== undefined`: la API
            // siempre manda el campo (false cuando no hay aviso), así que el default nunca
            // llegaría a aplicarse.
            followup_reminder_enabled: lead.fecha_seguimiento ? !!lead.followup_reminder_enabled : true,
            // El check sin hora no manda nada, así que la hora siempre arranca con un valor.
            followup_reminder_time: lead.followup_reminder_time || '09:00',
            modalidad: [],
            sig_action: null,
            cierre_motivo: null,
            fecha_seguimiento_cobro_next: localDateFromNow(3),
            refs_ask: undefined,
            refs_rows: [],
            showRefsStep: false
        });

        // 2. Determinar paso inicial del árbol por contexto. `lead.fase`, cuando viene
        // explícito (ej. desde la búsqueda global, que ya resolvió la etapa real del lead en
        // el backend — ver handleSelectSearchResult), manda sobre `activeStep` (la pestaña que
        // esté abierta en ese momento no debería reinterpretar la etapa de un lead ajeno a
        // ella). `activeStep` solo se usa como respaldo cuando `lead.fase` no viene seteado
        // (tarjetas del mazo, que dependen de la pestaña donde viven).
        if (lead.fase === 'confirm' || (lead.fase === undefined && activeStep === 'confirmations')) {
            // Un lead ya "Confirmado" no tiene nada más que confirmar: se abre directo en el
            // reporte de resultado de la llamada, igual que si viniera de la pestaña Llamadas.
            const normalizedResult = (lead.result || '').toLowerCase();
            if (normalizedResult === 'confirmado') {
                setModalStep('root');
                setModalFlowLabel('Reporte de llamada');
            } else {
                setModalStep('confirm');
                setModalFlowLabel('Proceso de confirmación');
            }
        } else if (lead.fase === 'seg' || (lead.fase === undefined && activeStep === 'seguimientos')) {
            setModalStep(lead.tipo === 'cerrada' ? 'segventa' : 'seg');
            setModalFlowLabel('Seguimiento');
        } else {
            setModalStep('root');
            setModalFlowLabel('Reporte de llamada');
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

    // "Tu siguiente paso": el lead más urgente dentro de la pestaña activa, para no tener que
    // escanear toda la bandeja buscando qué tocar primero. Se arma con los mismos datos que ya
    // trajo esa pestaña (sin pegarle de nuevo a la API); por eso solo aplica a 'confirmations' y
    // 'calls' -las dos que manejan su lista acá- y no a 'seguimientos', que vive aparte en
    // SeguimientosPane y no expone sus datos a este nivel.
    const heroLead = useMemo(() => {
        if (activeView !== 'inbox') return null;
        let pool;
        if (activeStep === 'confirmations') {
            pool = [...confirmationsPipeline.porConfirmar, ...confirmationsPipeline.conversando];
        } else if (activeStep === 'calls') {
            pool = filteredAgendas;
        } else {
            return null;
        }
        if (!pool.length) return null;
        // El más atrasado primero (fecha agendada más vieja); si nada está atrasado, el más próximo.
        return pool.slice().sort((a, b) => {
            const da = parseUtcIso(a.start_time)?.getTime() ?? Infinity;
            const db = parseUtcIso(b.start_time)?.getTime() ?? Infinity;
            return da - db;
        })[0];
    }, [activeView, activeStep, confirmationsPipeline, filteredAgendas]);

    // Pipeline Kanban para Llamadas (v7), calcado de la referencia visual: "Atrasadas" (sin
    // reportar, de días anteriores al seleccionado), "Hoy" (sin reportar, del día seleccionado —
    // "por tomar") y "Reportadas" (del día seleccionado, ya procesadas). A diferencia del
    // countdown de la tarjeta (que mide urgencia en horas/minutos), acá el corte es por fecha
    // calendario: una llamada de las 8am de hoy sigue siendo "de hoy", no "atrasada", aunque ya
    // sean las 3pm — es lo que pidió el usuario explícitamente.
    const callsPipeline = useMemo(() => {
        const atrasadas = [];
        const hoy = [];
        (filteredAgendas || []).forEach(a => {
            const { date: apptDate } = splitLocalDateTime(a.start_time);
            if (apptDate === selectedDate) hoy.push(a);
            else atrasadas.push(a);
        });
        return { atrasadas, hoy, reportadas: reportedTodayCalls };
    }, [filteredAgendas, selectedDate, reportedTodayCalls]);

    // Sistema de "lote diario" (v7): en vez de enfrentar de una todo el backlog de "② Llamadas",
    // se ofrece un lote aleatorio de N leads a la vez — mismo flujo de tarjeta→modal→guardar de
    // siempre, sin ningún cambio ahí. El progreso se deriva de cuántos ids del lote siguen en la
    // lista (al guardar un reporte, closer_processed pasa a true y el lead sale de "Llamadas" solo).
    const BATCH_SIZE = 10;
    const [batchMode, setBatchMode] = useState(false);
    const [batchIds, setBatchIds] = useState([]);

    const batchItems = useMemo(() => {
        if (!batchMode) return [];
        const idSet = new Set(batchIds);
        return filteredAgendas.filter(a => idSet.has(a.id));
    }, [filteredAgendas, batchMode, batchIds]);

    const startBatch = () => {
        const pool = [...filteredAgendas];
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const picked = pool.slice(0, BATCH_SIZE).map(a => a.id);
        setBatchIds(picked);
        setBatchMode(true);
    };

    // Renderizar una tarjeta individual del Kanban de confirmación (v6)
    const renderKanbanCard = (a, phase) => {
        const isViewed = selectedLead?.id === a.id;

        // Un referido manual se crea sin fecha real de cita (todavía no se acordó una) —
        // el backend le pone start_time=ahora solo para que entre al pipeline de confirmación
        // como cualquier otra agenda. Mostrar esa hora tal cual confundía al closer (parecía
        // una cita ya coordinada a una hora exacta); en vez de eso se marca "Por agendar".
        const isPendingReferral = (a.origin || '').startsWith('Referido de');

        // Formatear fecha y hora legible (hora LOCAL del navegador, no UTC crudo)
        const { date: apptDate, time: apptTime } = splitLocalDateTime(a.start_time);

        // Calcular etiqueta "Hoy", "Mañana", etc.
        let dateLabel = apptDate;
        const { date: todayStr } = splitLocalDateTime(new Date().toISOString());
        if (apptDate === todayStr) {
            dateLabel = 'Hoy';
        } else {
            try {
                const parts = apptDate.split('-');
                if (parts.length === 3) dateLabel = `${parts[2]}/${parts[1]}`;
            } catch (e) {}
        }

        // Cuenta regresiva/tiempo transcurrido en vez de la fecha cruda: cuánto falta para la
        // cita, si es ahora mismo, o hace cuánto que pasó sin resolverse. Se amortigua a color
        // neutro en las etapas "ya resuelto" (`confirmado`, `call_done`): ahí el atraso no
        // bloquea nada — cada una tiene su propia tarjeta ✓ para eso.
        const DONE_PHASES = new Set(['confirmado', 'call_done']);
        const countdown = isPendingReferral ? null : formatApptCountdown(a.start_time, nowTick);
        const whenCls = !countdown ? ''
            : countdown.kind === 'now' ? 'now-v6'
            : countdown.kind === 'soon' ? 'soon-v6'
            : countdown.kind === 'past' && !DONE_PHASES.has(phase) ? 'late-v6'
            : '';

        // Recordatorio pre-llamada: vencido (rojo) si ya pasó y sigue sin contactarse,
        // hoy (ámbar) si es el día calendario local actual, oculto si es un día futuro.
        let reminderBadge = null;
        const reminderDate = parseUtcIso(a.pre_call_reminder_at);
        if (reminderDate) {
            const now = new Date();
            const { date: reminderDay, time: reminderTime } = splitLocalDateTime(a.pre_call_reminder_at);
            if (reminderDate <= now) {
                reminderBadge = { label: `Recordatorio vencido · ${reminderTime}`, cls: 'bg-red-500/15 border-red-500/40 text-red-400' };
            } else if (reminderDay === todayStr) {
                reminderBadge = { label: `Recordatorio hoy ${reminderTime}`, cls: 'bg-amber-500/15 border-amber-500/40 text-amber-400' };
            }
        }

        return (
            <div 
                key={a.id} 
                className={`kcard-v6 ${isViewed ? 'border-pink-500/50 bg-pink-500/5 shadow-[0_0_15px_rgba(255,63,164,0.1)]' : ''}`}
                onClick={() => handleSelectLead(a)}
            >
                <div className={`when-v6 ${whenCls}`} title={isPendingReferral ? undefined : `${dateLabel} · ${apptTime}`}>
                    <span className={`wd-v6 ${countdown?.kind === 'now' ? 'animate-pulse' : ''}`}></span>
                    {isPendingReferral ? 'Por agendar' : (countdown ? countdown.label : `${dateLabel} · ${apptTime}`)}
                </div>
                <b className="flex items-center gap-1.5 flex-wrap">
                    {a.lead_name || 'Sin Nombre'}
                    {a.unread_comment && (
                        <span className="px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-450 border border-rose-500/20 rounded animate-pulse">
                            Nuevo
                        </span>
                    )}
                </b>
                <div className="m-v6">@{a.instagram ? a.instagram.replace('@', '') : 'usuario'}</div>

                <div className="flex gap-1.5 flex-wrap mt-2">
                    <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-900 border border-slate-850 text-slate-400">
                        {a.origin || 'Meta Ads'}
                    </span>
                    {isPendingReferral && (
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-violet-500/15 border border-violet-500/40 text-violet-300">
                            Contactar y acordar fecha
                        </span>
                    )}
                    {a.examen && (
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-900 border border-slate-850 text-slate-400">
                            {a.examen}
                        </span>
                    )}
                    {(phase === 'call' || phase === 'call_done') && a.closer_result && a.closer_result !== 'Pendiente' && (
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-violet-500/15 border border-violet-500/40 text-violet-300">
                            {a.closer_result}
                        </span>
                    )}
                    {reminderBadge && (
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${reminderBadge.cls}`}>
                            {reminderBadge.label}
                        </span>
                    )}
                </div>
                
                {a.setter_notes && (
                    <div className="nt-v6 text-[10px] text-slate-350">
                        {a.setter_notes}
                    </div>
                )}
                
                {/* El botón no cambia la etapa por sí solo: abre el mismo modal de proceso de
                    confirmación que el resto de la tarjeta (según en qué etapa esté el lead),
                    para no saltarse las notas obligatorias ni el resto del flujo guiado. */}
                {phase === 'por_confirmar' && (
                    <button
                        className="kadv-v6"
                        onClick={(e) => { e.stopPropagation(); handleSelectLead(a); }}
                    >
                        Contactar y registrar
                    </button>
                )}
                {phase === 'conversando' && (
                    <button
                        className="kadv-v6"
                        onClick={(e) => { e.stopPropagation(); handleSelectLead(a); }}
                    >
                        Confirmar asistencia
                    </button>
                )}
                {phase === 'call' && (
                    <button
                        className="kadv-v6"
                        onClick={(e) => { e.stopPropagation(); handleSelectLead(a); }}
                    >
                        Reportar resultado
                    </button>
                )}
                {phase === 'call_done' && (
                    <div className="flex gap-1 mt-2.5">
                        <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-full text-center">
                            ✓ Reportado
                        </span>
                    </div>
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
                        client_id: appt.client_id || null,
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
                        date: localToday()
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

    // Formatear fecha para input datetime-local (hora LOCAL del navegador, no UTC crudo)
    const formatToDatetimeLocal = (dateStr) => {
        const { date, time } = splitLocalDateTime(dateStr);
        return date && time ? `${date}T${time}` : '';
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

    const buildSalePayload = (tipoOverride, montoOverride, commentOverride) => ({
        email_vendedor: saleForm.email_vendedor,
        nombre_cliente: saleForm.nombre_cliente,
        telefono: saleForm.telefono ? saleForm.telefono.replace(/\+/g, '').trim() : '',
        mail_cliente: saleForm.mail_cliente,
        tipo_pago: `${saleForm.programa} - ${tipoOverride ?? saleForm.tipo_pago_simple}`,
        monto: montoOverride ?? (parseFloat(saleForm.monto) || 0.0),
        precio_total: parseFloat(saleForm.precio_total) || undefined,
        segundo_pago: commentOverride ?? (saleForm.segundo_pago || ''),
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
    });

    const handleRegisterSale = async () => {
        if (!saleForm.date) {
            toast.error("La fecha de la venta es obligatoria");
            return;
        }
        setSubmittingSale(true);
        try {
            // Renovación/Upsell con saldo pendiente del programa actual: si el closer activó
            // "liquidar saldo junto con esta venta", primero se registra una Cuota que cierra
            // el saldo restante, y solo si eso funciona se continúa con la venta principal.
            const isRenewalOrUpsell = ['Renovacion', 'Upsell'].includes(saleForm.tipo_pago_simple);
            if (isRenewalOrUpsell && settleBalanceWithSale && saleClientState?.balance_remaining > 0) {
                const settlePayload = buildSalePayload('Cuota', saleClientState.balance_remaining, 'Liquidación de saldo previo a Renovación/Upsell');
                const settleRes = await api.post('/sheets/push?tabla=Ventas_DB', settlePayload);
                if (settleRes.data.status !== 'success') {
                    toast.error(settleRes.data.message || "No se pudo liquidar el saldo pendiente");
                    setSubmittingSale(false);
                    return;
                }
            }

            const res = await api.post('/sheets/push?tabla=Ventas_DB', buildSalePayload());

            if (res.data.status === 'success') {
                toast.success("Venta declarada y sincronizada correctamente");
                const savedApptId = salePrompt.apptId;

                // Si se definió una fecha de cobro en la venta, auto-guardarla para la agenda
                if (savedApptId && saleForm.fecha_cobro) {
                    try {
                        await api.post(`/closer/deck/${savedApptId}`, {
                            fecha_seguimiento_cobro: saleForm.fecha_cobro,
                            fecha_seguimiento: saleForm.fecha_cobro,
                            seguimiento_tipo: 'cerrada',
                            seguimiento_sub: 'Seguimiento de cobro',
                            seguimiento_intento: 1,
                            seguimiento_realizado: false
                        });
                    } catch (e) {
                        console.error("Error al auto-guardar fecha_seguimiento_cobro:", e);
                    }
                }

                // Persistir en la agenda si hubo decisor/presentación de oferta (viene del árbol
                // de decisión) — necesario para las métricas de conversión de señas del dashboard.
                if (savedApptId && (sessionForm.with_decision_maker !== undefined || sessionForm.offer_presented !== undefined)) {
                    try {
                        await api.post(`/closer/deck/${savedApptId}`, {
                            with_decision_maker: sessionForm.with_decision_maker,
                            offer_presented: sessionForm.offer_presented
                        });
                    } catch (e) {
                        console.error("Error al guardar decisor/oferta presentada:", e);
                    }
                }

                if (isCuotaPayment && selectedCuotaId) {
                    // Ya existía un plan: esto es UNA cuota de ese plan cobrándose, no un plan
                    // nuevo — marcarla pagada en vez de recrear todo el cronograma (eso borraba
                    // el historial de cuotas ya cobradas).
                    try {
                        await api.patch(`/closer/installments/cuota/${selectedCuotaId}`, {
                            estado: 'pagado',
                            monto: parseFloat(saleForm.monto) || 0
                        });
                    } catch (e) {
                        console.error("Error al marcar la cuota como pagada:", e);
                        toast.error("La venta se guardó, pero hubo un error al marcar la cuota como pagada");
                    }
                } else if (savedApptId && saleForm.tipo_pago_simple !== 'completo' && saleForm.precio_total) {
                    // Primera vez que se define el plan (Parcial), o Cuota sin plan previo (caso
                    // de datos históricos incompletos) — acá sí corresponde crear el cronograma.
                    const total = parseFloat(saleForm.precio_total) || 0;
                    // "Cobrado hoy" para el cronograma tiene que incluir TODO lo que el cliente ya
                    // pagó antes (ej. una Seña previa), no solo el monto de esta transacción puntual
                    // — si no, el saldo a financiar se recalcula sobre el total completo otra vez y
                    // se le cobran de más las cuotas restantes.
                    const pagadoAntes = saleClientState?.total_paid || 0;
                    const cobradoHoy = pagadoAntes + (parseFloat(saleForm.monto) || 0);
                    if (total > cobradoHoy) {
                        try {
                            const numCuotas = parseInt(saleForm.num_cuotas) || 1;
                            const fechas = Array.from({ length: numCuotas }, (_, i) => saleForm.cuotaFechas?.[i + 1] || null);
                            await api.post('/closer/installments', {
                                appointment_id: savedApptId,
                                total,
                                cobrado_hoy: cobradoHoy,
                                num_cuotas: numCuotas,
                                fechas,
                                programa_code: saleForm.programa
                            });
                        } catch (e) {
                            console.error("Error al guardar el plan de cuotas:", e);
                            toast.error(e.response?.data?.error || "La venta se guardó, pero hubo un error al guardar el plan de cuotas");
                        }
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
                        isSaleFollowUp: true,
                        tipo: 'cerrada'
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
        if (sessionForm.notes.trim().length < 10) {
            toast.error("Contá en qué va el proceso con al menos 10 caracteres");
            return;
        }
        if (!sessionForm.confirm_status) {
            toast.error("Elegí si ya hubo contacto o confirmó antes de guardar");
            return;
        }
        const leadName = selectedLead.lead_name || 'El lead';
        const newStatus = sessionForm.confirm_status;
        const prevStatus = (selectedLead.result || '').toLowerCase();
        const wasPorConfirmar = !['conversando', 'contactado', 'confirmado'].includes(prevStatus);
        const pcRemaining = confirmationsPipeline.porConfirmar.filter(a => a.id !== selectedLead.id).length;
        const cvRemaining = confirmationsPipeline.conversando.filter(a => a.id !== selectedLead.id).length;

        // Misma derivación de "etapa actual" que usa el paso de confirmación al renderizar
        const normalizedCurrentResult = (selectedLead.result || '').toLowerCase();
        const isPorConfirmar = normalizedCurrentResult !== 'confirmado'
            && normalizedCurrentResult !== 'conversando' && normalizedCurrentResult !== 'contactado';

        let reminderPayload;
        if (isPorConfirmar) {
            if (sessionForm.pre_call_reminder_enabled && sessionForm.pre_call_reminder_at) {
                const [d, t] = sessionForm.pre_call_reminder_at.split('T');
                reminderPayload = localInputsToUtcIso(d, t);
            } else {
                reminderPayload = null;
            }
        }

        setProcessingId(selectedLead.id);
        try {
            await api.post(`/closer/deck/${selectedLead.id}`, {
                confirm_status: newStatus,
                closer_notes: sessionForm.notes,
                ...(reminderPayload !== undefined ? { pre_call_reminder_at: reminderPayload } : {})
            });
            setSelectedLead(null);
            fetchAgendas();

            if (newStatus === 'Confirmado') {
                const newConfirmadosHoy = confirmadosHoy + 1;
                setConfirmadosHoy(newConfirmadosHoy);
                if (pcRemaining === 0 && cvRemaining === 0) {
                    setCelebration({
                        emoji: '🏆',
                        title: 'Pipeline blindado',
                        body: `${newConfirmadosHoy} agenda${newConfirmadosHoy !== 1 ? 's' : ''} confirmada${newConfirmadosHoy !== 1 ? 's' : ''}. Ninguna se te va a caer por falta de recordatorio.`,
                        next: 'Siguiente paso: reportá las llamadas que ya ocurrieron.',
                        bar: null
                    });
                } else {
                    setCelebration({
                        emoji: '✅',
                        title: `Tu ${ORDINALES[Math.min(9, newConfirmadosHoy - 1)]} confirmado del día`,
                        body: `${leadName} asiste seguro. Una agenda confirmada muestra el doble que una sin confirmar.`,
                        next: pcRemaining
                            ? `Te quedan ${pcRemaining} por confirmar y ${cvRemaining} conversando.`
                            : `No queda nadie sin tocar. Faltan ${cvRemaining} conversando.`,
                        bar: { v: newConfirmadosHoy, t: newConfirmadosHoy + pcRemaining + cvRemaining, label: 'Confirmados del día' }
                    });
                }
            } else if (newStatus === 'conversando' && wasPorConfirmar) {
                if (pcRemaining === 0 && !vaciamosPorConfirmar) {
                    setVaciamosPorConfirmar(true);
                    setCelebration({
                        emoji: '🎯',
                        title: 'Ninguno quedó sin tocar',
                        body: 'Todas tus agendas tienen contacto registrado. Eso es lo que desbloquea el reporte del día.',
                        next: 'Los que están conversando no bloquean: no todos responden y eso no es tu culpa.',
                        bar: null
                    });
                } else {
                    toast.success(`${leadName} → Conversando 💬`);
                }
            } else {
                toast.success("Nota guardada. Sigue en la misma etapa.");
            }
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

    // Abre el modal de venta/cobro con los datos del lead precargados. Se llama DESPUÉS de
    // persistir el cierre del seguimiento (antes se abría de inmediato al hacer clic en la
    // opción, sin guardar nada de lo que el closer ya había escrito).
    const openSaleModalForLead = (lead, isCierreVenta) => {
        setSalePrompt({ apptId: lead.id });
        setSaleForm({
            lead_id: lead.id,
            client_id: lead.client_id || null,
            email_vendedor: user?.email || '',
            nombre_cliente: lead.lead_name || '',
            telefono: lead.phone || '',
            mail_cliente: lead.email || '',
            programa: isCierreVenta ? 'RR' : (lead.programa_code || 'RR'),
            tipo_pago_simple: isCierreVenta ? 'completo' : 'parcial',
            monto: '',
            segundo_pago: '',
            fecha_cobro: '',
            metodo_pago: 'Stripe',
            examen_lead: lead.examen || '',
            notes: '',
            estado: 'Completada',
            instagram: lead.instagram || '',
            setter: lead.setter_name || '',
            documento_identidad: '',
            enviar_mensaje: true,
            sold_in_call: isCierreVenta,
            date: localToday()
        });
        setSaleStep(isCierreVenta ? 1 : 2);
        setSaleModalOpen(true);
    };

    const saveSeguimientoReport = async () => {
        setProcessingId(selectedLead.id);
        try {
            // 1. Referidos con datos de contacto: cada uno crea su propia agenda nueva
            // (reusa el mismo endpoint del modal de "Referido manual").
            if (sessionForm.refs_ask === 'si' && sessionForm.refs_rows?.length) {
                for (const row of sessionForm.refs_rows) {
                    if (!row.nombre?.trim() || !row.contacto?.trim()) continue;
                    try {
                        await api.post('/closer/deck/referrals/manual', {
                            from_lead_id: selectedLead.id,
                            lead_name: row.nombre.trim(),
                            contact: row.contacto.trim(),
                            notes: `Referido durante seguimiento de ${selectedLead.lead_name || 'el lead'}.`
                        });
                    } catch (e) {
                        console.error("Error al crear referido:", e);
                        toast.error(`No se pudo crear el referido ${row.nombre}`);
                    }
                }
            }

            const modalidadPrefix = modalStep === 'seg' && sessionForm.modalidad?.length
                ? `[Modalidad: ${sessionForm.modalidad.join(', ')}] `
                : '';
            let refsNote = '';
            if (sessionForm.refs_ask === 'si') {
                const rows = sessionForm.refs_rows || [];
                const conContacto = rows.filter(r => r.nombre?.trim() && r.contacto?.trim());
                const sinContacto = rows.filter(r => r.nombre?.trim() && !r.contacto?.trim());
                const parts = [];
                if (conContacto.length) parts.push(`${conContacto.length} referido(s) con datos → agenda creada`);
                if (sinContacto.length) parts.push(`Referido(s) sin datos: ${sinContacto.map(r => r.nombre.trim()).join(', ')}`);
                if (parts.length) refsNote = ` | Referidos: ${parts.join('; ')}`;
            } else if (sessionForm.refs_ask === 'no') {
                refsNote = ' | Se pidieron referidos, no dejó.';
            } else if (sessionForm.refs_ask === null) {
                refsNote = ' | No se pidieron referidos.';
            }
            const finalNotes = `${modalidadPrefix}${sessionForm.notes}${refsNote}`;

            if (sessionForm.result === 'agendo' && sessionForm.nueva_fecha_agenda) {
                await api.patch(`/closer/appointments/${selectedLead.id}`, {
                    start_time: localInputsToUtcIso(sessionForm.nueva_fecha_agenda, sessionForm.nueva_hora_agenda || '12:00')
                });
                await api.post(`/closer/deck/${selectedLead.id}`, {
                    confirm_status: 'por_confirmar',
                    result: 'Pendiente',
                    closer_notes: finalNotes,
                    contact_result: sessionForm.result
                });
                toast.success("Lead reagendado y enviado a confirmación");
                setSelectedLead(null);
                fetchAgendas();
            } else if (sessionForm.result === 'cerro' || sessionForm.result === 'pago') {
                // Se persiste el cierre del seguimiento ANTES de abrir venta/cobro.
                await api.post(`/closer/deck/${selectedLead.id}`, {
                    closer_notes: finalNotes,
                    seguimiento_realizado: true,
                    fecha_seguimiento: null,
                    contact_result: sessionForm.result
                });
                const leadSnapshot = selectedLead;
                setSelectedLead(null);
                fetchAgendas();
                openSaleModalForLead(leadSnapshot, sessionForm.result === 'cerro');
            } else if (sessionForm.sig_action === 'close') {
                await api.post(`/closer/deck/${selectedLead.id}`, {
                    closer_notes: `${finalNotes} | Motivo de cierre: ${sessionForm.cierre_motivo}`,
                    seguimiento_realizado: true,
                    fecha_seguimiento: null,
                    contact_result: sessionForm.result
                });
                toast.success("Seguimiento cerrado");
                setSelectedLead(null);
                fetchAgendas();
            } else {
                // Continúa la cadencia: NO se marca como realizado (sigue vivo en el pool/asignados),
                // se incrementa el intento y se guarda la fecha del próximo contacto.
                const nextIntento = Math.min(4, (selectedLead.seguimiento_intento || 1) + 1);
                const payload = {
                    closer_notes: finalNotes,
                    seguimiento_realizado: false,
                    seguimiento_intento: nextIntento,
                    contact_result: sessionForm.result
                };
                if (modalStep === 'segventa') {
                    payload.fecha_seguimiento = sessionForm.fecha_seguimiento_cobro_next || null;
                    payload.fecha_seguimiento_cobro = sessionForm.fecha_seguimiento_cobro_next || null;
                    payload.seguimiento_tipo = 'cerrada';
                    payload.followup_reminder_enabled = !!sessionForm.followup_reminder_enabled;
                    payload.followup_reminder_time = sessionForm.followup_reminder_time || null;
                } else {
                    payload.fecha_seguimiento = sessionForm.fecha_seguimiento || null;
                    payload.seguimiento_tipo = selectedLead.seguimiento_tipo || (sessionForm.result === 'contesto' ? 'tomada' : 'no_tomada');
                }
                await api.post(`/closer/deck/${selectedLead.id}`, payload);
                toast.success(`Seguimiento ${nextIntento} de 4 programado`);
                setSelectedLead(null);
                fetchAgendas();
            }
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

    const renderFormQuestion = (q, a, c = 'info', key = undefined) => {
        const borderCls =
            c === 'good' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' :
            c === 'bad' ? 'border-rose-500/20 bg-rose-500/5 text-rose-400' :
            c === 'warn' ? 'border-amber-500/20 bg-amber-500/5 text-amber-400' :
            'border-slate-850 bg-slate-950/30 text-slate-300';

        return (
            <div key={key} className={`p-4 rounded-2xl border text-left flex flex-col gap-1 ${borderCls}`}>
                <div className="text-[10px] text-slate-500 font-bold uppercase leading-none">{q}</div>
                <div className="text-xs font-black leading-normal mt-1">{a || 'Sin respuesta'}</div>
            </div>
        );
    };

    // Etiquetas legibles de las respuestas del formulario de n8n (Client.form_data). Mismas que ya
    // usa FormsManagementPage para este mismo JSON, para que closer y operaciones lean lo mismo.
    // El orden de este objeto define el orden en que se muestran las respuestas.
    const FORM_DATA_LABELS = {
        examen: 'Examen / Dolor principal',
        puntaje: 'Puntaje / Calificación',
        profesion: 'Profesión',
        empleo: 'Empleo actual',
        formacion: 'Formación requerida / Meta',
        interes: 'Interés',
        inversion: 'Capacidad de inversión',
        apoyo: 'Apoyo / Red familiar'
    };

    // Campos de form_data que NO son respuestas del formulario: datos de contacto ya visibles en la
    // cabecera/ficha del modal, o metadata interna. Se excluyen para no duplicar ni ensuciar.
    const FORM_DATA_HIDDEN = new Set(['nombre', 'telefono', 'instagram', 'fuente_form', 'submitted_at']);

    // Respuestas reales del formulario: primero las conocidas en el orden de FORM_DATA_LABELS, y
    // después cualquier campo nuevo que n8n empiece a mandar (para no perderlo si cambia el form).
    const getFormDataAnswers = (formData) => {
        if (!formData || typeof formData !== 'object') return [];
        const hasValue = (k) => !FORM_DATA_HIDDEN.has(k) && formData[k] !== null && formData[k] !== undefined && String(formData[k]).trim() !== '';
        const known = Object.keys(FORM_DATA_LABELS).filter(hasValue);
        const extra = Object.keys(formData).filter(k => hasValue(k) && !(k in FORM_DATA_LABELS));
        return [...known, ...extra].map(k => ({
            key: k,
            question: FORM_DATA_LABELS[k] || k.replace(/_/g, ' '),
            answer: String(formData[k])
        }));
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
        const option = (fn, type, label, sub, selected = false) => (
            <button
                type="button"
                onClick={fn}
                data-t={type}
                className={`opt ${selected ? 'sel' : ''}`}
            >
                {selected && <Check size={13} className="absolute top-3 right-3 text-white" />}
                {label}
                {sub && <small>{sub}</small>}
            </button>
        );

        // Chips de menciones (equipo) debajo de las notas del seguimiento — insertan "@usuario " en el texto.
        const mencionesChips = (teamMembers && teamMembers.length > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Mencionar:</span>
                {teamMembers.filter(m => m.username !== user?.username).map(m => (
                    <button
                        key={m.id}
                        type="button"
                        onClick={() => setSessionForm(prev => ({
                            ...prev,
                            notes: `${prev.notes || ''}${prev.notes && !prev.notes.endsWith(' ') ? ' ' : ''}@${m.username} `
                        }))}
                        className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-slate-900 border border-slate-800 text-slate-400 hover:border-violet-500/40 hover:text-violet-400 transition-all cursor-pointer"
                    >
                        @{m.username}
                    </button>
                ))}
            </div>
        );

        // Último paso antes de guardar un seguimiento con contacto humano real: preguntar por
        // referidos. Reemplaza el contenido normal de 'seg'/'segventa' mientras está activo.
        const renderRefsStep = () => (
            <div className="space-y-4">
                <div className="p-3 bg-pink-500/5 border border-pink-500/10 rounded-2xl text-[10px] font-black uppercase tracking-wider text-pink-400 text-center">
                    ▸ Último paso antes de guardar. Se pregunta en todo contacto real.
                </div>
                <div className="q req space-y-2">
                    <h4 className="text-[10px] font-black uppercase text-slate-400">
                        ¿Le pediste referidos a {(selectedLead.lead_name || 'el lead').split(' ')[0]}?
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {option(() => setSessionForm(prev => ({
                            ...prev, refs_ask: 'si', refs_rows: prev.refs_rows?.length ? prev.refs_rows : [{ nombre: '', contacto: '' }]
                        })), 'ok', 'Sí, dejó referidos', 'Cargá los datos abajo', sessionForm.refs_ask === 'si')}
                        {option(() => setSessionForm(prev => ({ ...prev, refs_ask: 'no', refs_rows: [] })), 'no', 'Se lo pedí, no dejó', 'Cuenta como solicitado', sessionForm.refs_ask === 'no')}
                        {option(() => setSessionForm(prev => ({ ...prev, refs_ask: null, refs_rows: [] })), 'bad', 'No se lo pedí', 'No cuenta como solicitado', sessionForm.refs_ask === null)}
                    </div>
                </div>

                {sessionForm.refs_ask === 'si' && (
                    <div className="space-y-2">
                        <p className="text-[10px] text-slate-500 font-medium">Con nombre y contacto entran directo a Confirmaciones. Sin contacto, se anota para pedirle los datos después.</p>
                        {(sessionForm.refs_rows || []).map((row, i) => (
                            <div key={i} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-center">
                                <span className="text-[10px] font-black text-slate-500">{i + 1}</span>
                                <input
                                    placeholder="Nombre del referido"
                                    value={row.nombre}
                                    onChange={(e) => setSessionForm(prev => ({ ...prev, refs_rows: prev.refs_rows.map((r, ri) => ri === i ? { ...r, nombre: e.target.value } : r) }))}
                                    className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-slate-200"
                                />
                                <input
                                    placeholder="@instagram o teléfono"
                                    value={row.contacto}
                                    onChange={(e) => setSessionForm(prev => ({ ...prev, refs_rows: prev.refs_rows.map((r, ri) => ri === i ? { ...r, contacto: e.target.value } : r) }))}
                                    className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-bold text-slate-200"
                                />
                                <button
                                    onClick={() => setSessionForm(prev => ({ ...prev, refs_rows: prev.refs_rows.filter((_, ri) => ri !== i) }))}
                                    className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={() => setSessionForm(prev => ({ ...prev, refs_rows: [...(prev.refs_rows || []), { nombre: '', contacto: '' }] }))}
                            className="text-[10px] font-black uppercase text-violet-400 hover:text-violet-300 cursor-pointer"
                        >
                            + Agregar otro referido
                        </button>
                    </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-850">
                    <button
                        onClick={() => setSessionForm(prev => ({ ...prev, showRefsStep: false }))}
                        className="h-9 px-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer"
                    >
                        Volver
                    </button>
                    <button
                        onClick={saveSeguimientoReport}
                        disabled={
                            sessionForm.refs_ask === undefined ||
                            (sessionForm.refs_ask === 'si' && !(sessionForm.refs_rows || []).some(r => r.nombre?.trim())) ||
                            processingId === selectedLead.id
                        }
                        className="h-9 px-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
                    >
                        {processingId === selectedLead.id ? <Loader2 size={12} className="animate-spin" /> : 'Guardar y cerrar'}
                    </button>
                </div>
            </div>
        );

        if (modalStep === 'confirm') {
            const steps = [
                { k: 'por_confirmar', label: 'Por confirmar', desc: 'Sin contacto' },
                { k: 'conversando', label: 'Conversando', desc: 'Respondió' },
                { k: 'confirmado', label: 'Confirmado', desc: 'Asiste seguro' }
            ];
            const normalizedResult = (selectedLead.result || '').toLowerCase();
            const currentKey = normalizedResult === 'confirmado'
                ? 'confirmado'
                : (normalizedResult === 'conversando' || normalizedResult === 'contactado') ? 'conversando' : 'por_confirmar';
            const currentIdx = steps.findIndex(x => x.k === currentKey);

            return (
                <div className="space-y-6">
                    {/* Banda de pipeline (v7) */}
                    <div className="pipe">
                        {steps.map((st, i) => (
                            <React.Fragment key={st.k}>
                                <div className={`pstep ${i < currentIdx ? 'done' : ''} ${i === currentIdx ? 'cur' : ''}`}>
                                    <div className="pn">{st.label}</div>
                                    <div className="pd">{st.desc}</div>
                                </div>
                                {i < steps.length - 1 && <span className="parrow">›</span>}
                            </React.Fragment>
                        ))}
                    </div>

                    {currentKey === 'confirmado' ? (
                        <div className="space-y-4">
                            <div className="note">✓ Este lead ya está confirmado: no bloquea nada.</div>
                            <div className="q">
                                <h4>Otras acciones</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {option(() => setModalStep('reagQ'), 'info', 'Reagendar', 'Cambia fecha')}
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
                            <div className={`q req ${sessionForm.notes.trim().length >= 10 ? 'done' : ''}`}>
                                <h4><span className="num">1</span>¿En qué va el proceso?</h4>
                                <p>Sin esto no se puede avanzar. Es lo que ve el resto del equipo.</p>
                                <textarea
                                    rows={3}
                                    value={sessionForm.notes}
                                    onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Le escribí por WhatsApp e Instagram. Me contestó que está de turno, le hablo por la tarde."
                                    className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium custom-scrollbar"
                                />
                            </div>

                            <div className={`q req ${sessionForm.confirm_status ? 'done' : ''}`}>
                                <h4><span className="num">2</span>{currentKey === 'por_confirmar' ? '¿Ya hubo contacto?' : '¿Confirmó que asiste?'}</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {currentKey === 'por_confirmar' ? (
                                        <>
                                            {option(() => setSessionForm(prev => ({ ...prev, confirm_status: 'conversando' })), 'info', 'Sí, conversando', 'Respondió mensaje', sessionForm.confirm_status === 'conversando')}
                                            {option(() => setSessionForm(prev => ({ ...prev, confirm_status: 'por_confirmar' })), 'no', 'No responde aún', 'Registrar intento', sessionForm.confirm_status === 'por_confirmar')}
                                        </>
                                    ) : (
                                        <>
                                            {option(() => setSessionForm(prev => ({ ...prev, confirm_status: 'Confirmado' })), 'ok', 'Sí, confirmó', 'Asiste seguro', sessionForm.confirm_status === 'Confirmado')}
                                            {option(() => setSessionForm(prev => ({ ...prev, confirm_status: 'conversando' })), 'no', 'Sigue conversando', 'Aún no confirma', sessionForm.confirm_status === 'conversando')}
                                        </>
                                    )}
                                </div>
                            </div>

                            {currentKey === 'por_confirmar' && (
                                <div className="q space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!!sessionForm.pre_call_reminder_enabled}
                                            onChange={(e) => setSessionForm(prev => ({ ...prev, pre_call_reminder_enabled: e.target.checked }))}
                                            className="w-4 h-4 accent-violet-500"
                                        />
                                        <h4 className="text-[10px] font-black uppercase text-slate-400">
                                            Recordarme escribirle antes de la llamada
                                        </h4>
                                    </label>
                                    {sessionForm.pre_call_reminder_enabled && (
                                        <input
                                            type="datetime-local"
                                            value={sessionForm.pre_call_reminder_at || ''}
                                            onChange={(e) => setSessionForm(prev => ({ ...prev, pre_call_reminder_at: e.target.value }))}
                                            className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium"
                                        />
                                    )}
                                </div>
                            )}

                            <div className="q">
                                <h4>Otras acciones</h4>
                                <div className={`grid ${currentKey === 'conversando' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                                    {currentKey === 'conversando' && option(() => setModalStep('reagQ'), 'info', 'Reagendar', 'Pidió otra fecha')}
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
                                    }, 'bad', 'Descartar lead', 'Exige motivo')}
                                </div>
                                {currentKey === 'por_confirmar' && (
                                    <p className="text-[10px] text-slate-500 font-medium">
                                        Reagendar aparece recién cuando el lead está conversando: si todavía no respondió, no hay nada que reagendar.
                                    </p>
                                )}
                            </div>

                            <div className="pt-4 border-t border-slate-800">
                                <button
                                    onClick={saveConfirmReport}
                                    disabled={sessionForm.notes.trim().length < 10 || !sessionForm.confirm_status || processingId === selectedLead.id}
                                    className="w-full h-11 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center"
                                >
                                    {processingId === selectedLead.id ? <Loader2 size={14} className="animate-spin" /> : 'Guardar Reporte'}
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
                        <span className="num">1</span>
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
                        <span className="num">2</span>
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
                        <span className="num">3</span>
                        ¿Se hizo la presentación de la oferta?
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        {option(() => {
                            setSessionForm(prev => ({ ...prev, offer_presented: true }));
                            addDecisionPath("Con presentation", "venta");
                        }, 'ok', 'Sí, se presentó')}
                        {option(() => {
                            setSessionForm(prev => ({ ...prev, offer_presented: false }));
                            addDecisionPath("Sin presentación", "nopres");
                        }, 'no', 'No se presentó')}
                    </div>
                </div>
            );
        }

        if (modalStep === 'venta') {
            return (
                <div className="q space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                        <span className="num">4</span>
                        ¿Se cerró la venta?
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        {option(() => {
                            setSalePrompt({ apptId: selectedLead.id });
                            setSaleForm({
                                lead_id: selectedLead.id,
                                client_id: selectedLead.client_id || null,
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
                                date: localToday()
                            });
                            setSaleStep(1);
                            setSelectedLead(null);
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
                        <span className="num">5</span>
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
                        <span className="num">4</span>
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
                                        start_time: localInputsToUtcIso(sessionForm.nueva_fecha_agenda, sessionForm.nueva_hora_agenda || '12:00')
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
                                        start_time: localInputsToUtcIso(sessionForm.nueva_fecha_agenda, sessionForm.nueva_hora_agenda || '12:00')
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
                                        const dt = cd.d === null ? '' : localDateFromNow(cd.d);
                                        setSessionForm(prev => ({ ...prev, fecha_seguimiento: dt }));
                                    }}
                                    className={`py-2 px-3 border rounded-xl text-left transition-all cursor-pointer font-bold text-[10px] uppercase flex flex-col gap-0.5 ${
                                        (cd.d === null && !sessionForm.fecha_seguimiento) || (cd.d !== null && sessionForm.fecha_seguimiento === localDateFromNow(cd.d))
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
                        {sessionForm.fecha_seguimiento && (
                            <AvisoSeguimientoWhatsApp
                                enabled={sessionForm.followup_reminder_enabled}
                                time={sessionForm.followup_reminder_time}
                                fecha={sessionForm.fecha_seguimiento}
                                onChange={({ enabled, time }) => setSessionForm(prev => ({
                                    ...prev, followup_reminder_enabled: enabled, followup_reminder_time: time
                                }))}
                            />
                        )}
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
                                        fecha_seguimiento: sessionForm.fecha_seguimiento || localDateFromNow(1),
                                        seguimiento_tipo: sessionForm.result === 'tomada' ? 'tomada' : 'no_tomada',
                                        seguimiento_sub: sessionForm.rmot || 'Seguimiento programado',
                                        seguimiento_intento: 1,
                                        seguimiento_realizado: false,
                                        with_decision_maker: sessionForm.with_decision_maker,
                                        offer_presented: sessionForm.offer_presented,
                                        followup_reminder_enabled: !!sessionForm.followup_reminder_enabled,
                                        followup_reminder_time: sessionForm.followup_reminder_time || null
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
            if (sessionForm.showRefsStep) return renderRefsStep();

            const seq = selectedLead.seguimiento_intento || 1;
            const isCierra = sessionForm.result === 'cerro';
            const isAgendo = sessionForm.result === 'agendo';
            const needsSig = sessionForm.result && !isAgendo && !isCierra;
            // Qué falta para poder completar, en palabras. `canComplete` se deriva de esta lista
            // (no al revés) para que no puedan divergir: si aparece un requisito nuevo, el closer
            // lo ve nombrado. Antes esto era una sola expresión booleana y el botón simplemente
            // quedaba gris sin decir por qué — un closer reportó "le doy y no continúa" teniendo
            // completo todo lo que la pantalla marcaba como obligatorio (le faltaba elegir "¿y
            // ahora qué hacemos?", que era requerido pero no estaba marcado como tal).
            const notasLen = (sessionForm.notes || '').trim().length;
            const faltantes = [];
            if (!sessionForm.result) faltantes.push('Elegí qué pasó con este contacto');
            if ((sessionForm.modalidad || []).length === 0) faltantes.push('Marcá la modalidad: mensaje, llamada o las dos');
            if (notasLen < 10) faltantes.push(`Contá qué le dijiste y qué respondió (mínimo 10 caracteres, llevás ${notasLen})`);
            if (isAgendo && !(sessionForm.nueva_fecha_agenda && sessionForm.nueva_hora_agenda)) {
                faltantes.push('Poné la nueva fecha y hora de la agenda');
            }
            if (needsSig) {
                if (!sessionForm.sig_action) faltantes.push('Elegí qué hacemos ahora: programar el próximo seguimiento o cerrarlo');
                else if (sessionForm.sig_action === 'next' && !sessionForm.fecha_seguimiento) faltantes.push('Elegí la fecha del próximo seguimiento');
                else if (sessionForm.sig_action === 'close' && !sessionForm.cierre_motivo) faltantes.push('Elegí por qué se cierra el seguimiento');
            }
            const canComplete = faltantes.length === 0;
            const btnLabel = isCierra ? 'Continuar al reporte de venta →' : 'Completar Seguimiento';
            const needsRefs = ['contesto', 'agendo', 'cerro'].includes(sessionForm.result) && sessionForm.refs_ask === undefined;

            const toggleModalidad = (m) => setSessionForm(prev => ({
                ...prev,
                modalidad: prev.modalidad.includes(m) ? prev.modalidad.filter(x => x !== m) : [...prev.modalidad, m]
            }));

            return (
                <div className="space-y-4">
                    <div className="p-3 bg-[#111219]/90 border border-slate-900 rounded-2xl text-xs font-bold text-slate-350 flex justify-between">
                        <span><b>Seguimiento {seq} de 4</b></span>
                        <span>Cadencia automática</span>
                    </div>

                    <div className={`q req space-y-2 ${sessionForm.result ? 'done' : ''}`}>
                        <h4 className="text-[10px] font-black uppercase text-slate-400">¿Qué pasó con este contacto?</h4>
                        <div className="grid grid-cols-2 gap-2">
                            {option(() => setSessionForm(prev => ({ ...prev, result: 'no_resp' })), 'no', 'No respondió', 'Lo hice, no contestó', sessionForm.result === 'no_resp')}
                            {option(() => setSessionForm(prev => ({ ...prev, result: 'contesto' })), 'info', 'Contestó', 'Estamos conversando', sessionForm.result === 'contesto')}
                            {option(() => setSessionForm(prev => ({ ...prev, result: 'agendo' })), 'ok', 'Contestó y agendó', 'Vuelve al meet', sessionForm.result === 'agendo')}
                            {option(() => setSessionForm(prev => ({ ...prev, result: 'cerro' })), 'ok', 'Cerró la venta', 'Registrar pago', sessionForm.result === 'cerro')}
                        </div>
                        {isCierra && (
                            <p className="text-[10px] text-slate-500 font-medium">Al continuar se abre el reporte de venta con los datos del lead ya cargados.</p>
                        )}
                    </div>

                    <div className={`q req space-y-2 ${(sessionForm.modalidad || []).length > 0 ? 'done' : ''}`}>
                        <h4 className="text-[10px] font-black uppercase text-slate-400">Modalidad</h4>
                        <p className="text-[10px] text-slate-500 font-medium">Marcá al menos una — podés marcar las dos si hiciste ambas.</p>
                        <div className="flex gap-2">
                            {option(() => toggleModalidad('Mensaje'), 'info', 'Mensaje', null, (sessionForm.modalidad || []).includes('Mensaje'))}
                            {option(() => toggleModalidad('Llamada'), 'info', 'Llamada', null, (sessionForm.modalidad || []).includes('Llamada'))}
                        </div>
                    </div>

                    {isAgendo && (
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
                        {mencionesChips}
                    </div>

                    {needsSig && (
                        // `req`: es obligatorio para poder completar el seguimiento (lo pide
                        // `canComplete`), pero estaba sin marcar — el closer daba por hecho que
                        // era opcional y no entendía por qué el botón no se activaba.
                        <div className={`q req space-y-2 ${sessionForm.sig_action === 'next' || (sessionForm.sig_action === 'close' && sessionForm.cierre_motivo) ? 'done' : ''}`}>
                            <h4 className="text-[10px] font-black uppercase text-slate-400">¿Y ahora qué hacemos?</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {option(() => {
                                    const delayDays = [0, 3, 7, 14][Math.min(3, seq)];
                                    const nextDate = localDateFromNow(delayDays);
                                    setSessionForm(prev => ({ ...prev, fecha_seguimiento: nextDate, sig_action: 'next' }));
                                }, 'ok', `Programar Seguimiento ${Math.min(4, seq + 1)}`, `Sugerido para +${[0, 3, 7, 14][Math.min(3, seq)]} días`, sessionForm.sig_action === 'next')}
                                {option(() => setSessionForm(prev => ({ ...prev, sig_action: 'close' })), 'bad', 'Cerrar Seguimiento', 'Lead frío o agotado', sessionForm.sig_action === 'close')}
                            </div>
                            {sessionForm.sig_action === 'close' && (
                                <div className="q req space-y-2 pt-2">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400">¿Por qué se cierra?</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['Pidió que no lo contacten', 'Se agotaron los 4 intentos', 'Compró en otro lado', 'Ya no califica'].map(motivo => (
                                            option(() => setSessionForm(prev => ({ ...prev, cierre_motivo: motivo })), 'bad', motivo, null, sessionForm.cierre_motivo === motivo)
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {faltantes.length > 0 && <MissingFieldsHint items={faltantes} />}

                    <div className="flex justify-between items-center pt-2 border-t border-slate-850">
                        <div />
                        <button
                            onClick={() => {
                                if (needsRefs) {
                                    setSessionForm(prev => ({ ...prev, showRefsStep: true }));
                                } else {
                                    saveSeguimientoReport();
                                }
                            }}
                            disabled={!canComplete || processingId === selectedLead.id}
                            className="h-9 px-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
                        >
                            {processingId === selectedLead.id ? <Loader2 size={12} className="animate-spin" /> : btnLabel}
                        </button>
                    </div>
                </div>
            );
        }

        if (modalStep === 'segventa') {
            if (sessionForm.showRefsStep) return renderRefsStep();

            const isPago = sessionForm.result === 'pago';
            const needsCobroDate = sessionForm.result === 'no_resp' || sessionForm.result === 'contesto';
            // Mismo criterio que el paso de seguimiento: la lista de faltantes es la fuente de
            // verdad y el botón se deriva de ella, para que nunca quede gris sin explicación.
            const notasLenCobro = (sessionForm.notes || '').trim().length;
            const faltantesCobro = [];
            if (!sessionForm.result) faltantesCobro.push('Elegí qué pasó con el cobro');
            if (notasLenCobro < 10) faltantesCobro.push(`Contá qué le dijiste y qué respondió (mínimo 10 caracteres, llevás ${notasLenCobro})`);
            if (needsCobroDate && !sessionForm.fecha_seguimiento_cobro_next) faltantesCobro.push('Elegí la fecha del próximo intento de cobro');
            const canComplete = faltantesCobro.length === 0;
            const btnLabel = isPago ? 'Continuar al registro de cobro →' : 'Completar Cobro';
            const needsRefs = ['contesto', 'pago'].includes(sessionForm.result) && sessionForm.refs_ask === undefined;

            return (
                <div className="space-y-4">
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-xs font-bold uppercase tracking-wide text-emerald-400 text-center">
                        ▸ Seguimiento de Cliente. Ya cerró la venta: el foco es cobrar la deuda.
                    </div>
                    <div className="grid grid-cols-2 gap-2 bg-slate-950/20 border border-slate-800 p-4 rounded-2xl text-sm font-bold text-slate-300">
                        <div><span className="text-slate-400 text-[11px] font-semibold block">Programa</span><b>{selectedLead.programa_nombre || 'Sin datos'}</b></div>
                        <div>
                            <span className="text-slate-400 text-[11px] font-semibold block">Deuda pendiente</span>
                            <b className={typeof selectedLead.deuda === 'number' && selectedLead.deuda > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                {typeof selectedLead.deuda === 'number' ? `$${Math.round(selectedLead.deuda).toLocaleString('en-US')}` : 'Sin datos'}
                            </b>
                        </div>
                    </div>

                    {loadingCuotas ? (
                        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-violet-500" size={18} /></div>
                    ) : cuotasPlan.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-300">Plan de cuotas</h4>
                            <div className="rounded-xl border border-slate-800 overflow-hidden">
                                <table className="w-full text-xs">
                                    <tbody>
                                        {cuotasPlan.map(c => (
                                            <tr key={c.id} className="border-t border-slate-800 first:border-t-0">
                                                <td className="px-3 py-2 font-bold text-white">Cuota {c.numero_cuota}</td>
                                                <td className="px-3 py-2 font-bold text-slate-300">${Math.round(c.monto).toLocaleString('en-US')}</td>
                                                <td className="px-3 py-2 font-bold text-slate-300">{c.fecha_vencimiento}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`px-2 py-1 rounded-md text-[11px] font-bold uppercase border ${
                                                        c.estado === 'pagado' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                                                        c.estado === 'vencido' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' :
                                                        'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                                    }`}>
                                                        {c.estado}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {c.estado !== 'pagado' && (
                                                        <button
                                                            onClick={() => handleMarkCuotaPaid(c.id)}
                                                            className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-bold uppercase rounded-lg transition-all cursor-pointer"
                                                        >
                                                            Marcar pagada
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="q req space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-300">¿Qué pasó con el cobro?</h4>
                        <div className="grid grid-cols-4 gap-2">
                            {option(() => setSessionForm(prev => ({ ...prev, result: 'no_resp', sig_action: null, cierre_motivo: null })), 'no', 'No respondió', null, sessionForm.result === 'no_resp')}
                            {option(() => setSessionForm(prev => ({ ...prev, result: 'contesto', sig_action: null, cierre_motivo: null })), 'info', 'Estamos conversando', null, sessionForm.result === 'contesto')}
                            {option(() => setSessionForm(prev => ({ ...prev, result: 'pago', sig_action: null, cierre_motivo: null })), 'ok', 'Pagó', null, sessionForm.result === 'pago')}
                            {/* "No va a pagar": pedido del usuario (loom, 27/ago/2026) para poder sacar de
                                la cola de cobros a un cliente que ya avisó que no va a pagar, en vez de
                                seguir programando intentos indefinidamente. Reusa el mecanismo de "Cerrar
                                Seguimiento" que ya existe en el paso normal de seguimientos (sig_action:
                                'close' -> seguimiento_realizado:true, fecha_seguimiento:null, ver
                                saveSeguimientoReport) — no hace falta un endpoint nuevo. */}
                            {option(() => setSessionForm(prev => ({ ...prev, result: 'no_paga', sig_action: 'close', cierre_motivo: 'No va a pagar' })), 'bad', 'No va a pagar', 'Sale de la cola', sessionForm.result === 'no_paga')}
                        </div>
                        {isPago && (
                            <p className="text-xs text-slate-400 font-medium">Al continuar se abre el registro de cobro con el historial de pagos y el plan de cuotas ya cargados.</p>
                        )}
                    </div>

                    {needsCobroDate && (
                        <div className="space-y-1.5 text-left">
                            <label className="text-xs text-slate-300 font-bold uppercase tracking-wide block">¿Cuándo es el siguiente seguimiento de cobro? <span className="rq text-pink-500">*</span></label>
                            <input
                                type="date"
                                value={sessionForm.fecha_seguimiento_cobro_next}
                                onChange={(e) => setSessionForm(prev => ({ ...prev, fecha_seguimiento_cobro_next: e.target.value }))}
                                className="w-full max-w-[220px] bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200"
                            />
                            <p className="text-xs text-slate-400 font-medium">Puede ser hoy mismo si quedaste en volver a escribirle más tarde.</p>
                            {sessionForm.fecha_seguimiento_cobro_next && (
                                <AvisoSeguimientoWhatsApp
                                    enabled={sessionForm.followup_reminder_enabled}
                                    time={sessionForm.followup_reminder_time}
                                    fecha={sessionForm.fecha_seguimiento_cobro_next}
                                    onChange={({ enabled, time }) => setSessionForm(prev => ({
                                        ...prev, followup_reminder_enabled: enabled, followup_reminder_time: time
                                    }))}
                                />
                            )}
                        </div>
                    )}

                    <div className="space-y-1.5 text-left">
                        <label className="text-xs text-slate-300 font-bold uppercase tracking-wide block">Qué sucedió exactamente (Requerido)</label>
                        <textarea
                            rows={3}
                            value={sessionForm.notes}
                            onChange={(e) => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Le recordé la cuota de este mes. Dijo que cobra el viernes y transfiere a primera hora del lunes..."
                            className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-medium custom-scrollbar"
                        />
                        {mencionesChips}
                    </div>

                    {faltantesCobro.length > 0 && <MissingFieldsHint items={faltantesCobro} />}

                    <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                        <div />
                        <button
                            onClick={() => {
                                if (needsRefs) {
                                    setSessionForm(prev => ({ ...prev, showRefsStep: true }));
                                } else {
                                    saveSeguimientoReport();
                                }
                            }}
                            disabled={!canComplete || processingId === selectedLead.id}
                            className="h-9 px-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wide rounded-xl transition-all cursor-pointer"
                        >
                            {processingId === selectedLead.id ? <Loader2 size={12} className="animate-spin" /> : btnLabel}
                        </button>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="h-screen overflow-y-auto bg-v6 text-slate-100 flex flex-col custom-scrollbar pb-32">
            
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
                                                {appt?.id && (
                                                    <button
                                                        type="button"
                                                        title="Abrir la última agenda directamente"
                                                        onClick={(e) => { e.stopPropagation(); setShowSearchResults(false); handleOpenAppointmentFromHistory(appt.id); }}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                                                    >
                                                        <Calendar size={13} />
                                                    </button>
                                                )}
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
                    
                    {counts.seguimientos > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowProcrastinar(true)}
                            className="shrink-0 flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 hover:bg-pink-500/20 transition-all px-4 py-2 cursor-pointer"
                            title="Ver cuánto valdría hacer unos seguimientos ahora"
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest text-pink-400">Quiero procrastinar</span>
                        </button>
                    )}

                    <div className="who-v6">
                        <span className="lbl-v6">{user?.name || user?.username || 'Closer'}</span>
                        <div className="av-v6">
                            {(user?.name || user?.username || 'CL').substring(0, 2).toUpperCase()}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => { if (window.confirm('¿Cerrar sesión?')) logout(); }}
                        title="Cerrar sesión"
                        className="ml-2 w-9 h-9 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            {/* Área de Trabajo Principal */}
            <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 flex flex-col gap-6">
                
                {/* TU SIGUIENTE PASO + TU DÍA (v7) */}
                {(() => {
                    // "Tu día" tiene que reflejar el trabajo real de HOY en las 3 pestañas, no solo lo
                    // que trajo la pestaña activa (`agendas` es la lista de una sola pestaña, y para
                    // "Confirmar"/"Reportar" solo incluye lo PENDIENTE por diseño del backend — nunca
                    // iba a poder mostrar progreso real). `dailyActivity` (misma fuente que "Reporte
                    // del día") trae lo ya hecho hoy; `counts` trae lo que todavía falta.
                    const doneToday = dailyActivity
                        ? (dailyActivity.confirmados_hoy || 0) + (dailyActivity.show_ups || 0) + (dailyActivity.seguimientos_hechos || 0)
                        : 0;
                    const pendingToday = counts.confirmations + counts.calls + counts.seguimientos;
                    const totalToday = doneToday + pendingToday;
                    const pct = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;
                    // Puntos de experiencia: pondera cada acción real de hoy (no un número inventado —
                    // sale de las mismas cuentas de arriba) para darle una lectura más "de juego" al
                    // esfuerzo del día. Los pesos son una primera pasada editorial, no una medida
                    // científica — se pueden ajustar sin tocar de dónde sale cada componente. Fórmula
                    // en `dailyXp` (arriba del componente): se comparte con el Resumen del Reporte del
                    // día para que los dos lugares siempre digan el mismo número.
                    const xp = dailyXp;
                    // Racha real de días consecutivos que cerró el día (`CloserService.get_report_streak`,
                    // backend) — reemplaza el "Racha de 12 días" que estaba hardcodeado acá sin salir
                    // de ningún dato (pedido del usuario, feedback en video del 27/ago/2026).
                    const streakDays = dailyActivity?.streak_days ?? 0;
                    const heroCountdown = heroLead ? formatApptCountdown(heroLead.start_time, nowTick) : null;
                    const heroBadgeCls = !heroCountdown ? '' : heroCountdown.kind === 'now' ? 'now' : heroCountdown.kind === 'soon' ? 'soon' : heroCountdown.kind === 'past' ? 'late' : '';
                    return (
                        <div className="tsprow-v6">
                            {heroLead ? (
                                <div className="tsp-v6" onClick={() => handleSelectLead(heroLead)}>
                                    <div className="tsp-top-v6">
                                        <span className="tsp-dot-v6"></span>
                                        <span className="tsp-lbl-v6">Tu siguiente paso</span>
                                        <div className="flex-1"></div>
                                        {heroCountdown && (
                                            <span className={`tsp-badge-v6 ${heroBadgeCls}`}>{heroCountdown.label}</span>
                                        )}
                                    </div>
                                    <h3 className="tsp-name-v6">{heroLead.lead_name || 'Sin Nombre'}</h3>
                                    <p className="tsp-sub-v6">{heroLead.origin || 'Meta Ads'} · @{heroLead.instagram ? heroLead.instagram.replace('@', '') : 'usuario'}</p>
                                    <button
                                        type="button"
                                        className="tsp-cta-v6"
                                        onClick={(e) => { e.stopPropagation(); handleSelectLead(heroLead); }}
                                    >
                                        {activeStep === 'confirmations' ? 'Ir a confirmar' : 'Ir a reportar'} →
                                    </button>
                                </div>
                            ) : (() => {
                                // Sin nada urgente en LA PESTAÑA ACTIVA, no hay por qué decir que no queda
                                // nada — casi siempre sigue habiendo trabajo real en las otras dos (pedido
                                // del usuario, 27/ago/2026): antes esto siempre decía "nada urgente por
                                // ahora" apenas la pestaña activa se vaciaba, aunque quedaran 78 seguimientos
                                // sin tocar. `counts` ya trae las 3 bandejas completas, sin pegarle de nuevo
                                // a la API.
                                const suggestions = [
                                    { key: 'confirmations', label: 'Confirmar', count: counts.confirmations, step: 'confirmations' },
                                    { key: 'calls', label: 'Reportar', count: counts.calls, step: 'calls' },
                                    { key: 'seguimientos', label: 'Seguir', count: counts.seguimientos, step: 'seguimientos' }
                                ].filter(s => s.count > 0 && s.step !== activeStep);
                                const goTo = (step) => { setActiveView('inbox'); setSearchParams({ step, selected_date: selectedDate }); };

                                if (suggestions.length === 0) {
                                    return (
                                        <div className="tsp-v6 tsp-done-v6">
                                            <div className="tsp-top-v6">
                                                <span className="tsp-dot-v6 ok"></span>
                                                <span className="tsp-lbl-v6">Tu siguiente paso</span>
                                            </div>
                                            <h3 className="tsp-name-v6">🎉 Nada urgente por ahora</h3>
                                            <p className="tsp-sub-v6">Cada lead que resolvés es un dato que ya no tenés que inventar a las 11 de la noche.</p>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="tsp-v6 tsp-done-v6">
                                        <div className="tsp-top-v6">
                                            <span className="tsp-dot-v6 ok"></span>
                                            <span className="tsp-lbl-v6">Tu siguiente paso</span>
                                        </div>
                                        <h3 className="tsp-name-v6">Podés seguir avanzando con</h3>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {suggestions.map(s => (
                                                <button
                                                    key={s.key}
                                                    type="button"
                                                    className="tsp-cta-v6"
                                                    onClick={(e) => { e.stopPropagation(); goTo(s.step); }}
                                                >
                                                    {s.label} {s.count} →
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="tud-v6">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="tud-lbl-v6">Tu día</div>
                                    <div className="tud-xp-v6">🔥 Racha {streakDays} d</div>
                                </div>
                                <div className="tud-pct-v6">{pct}%</div>
                                <div className="tud-sub-v6">del día completado</div>
                                <div className="pbarw-v6">
                                    <i style={{ width: `${pct}%` }}></i>
                                </div>
                                <div className="tud-foot-row-v6">
                                    <span className="tud-foot-v6">{doneToday} de {totalToday} resueltos hoy</span>
                                    <span className="tud-foot-xp-v6">⚡ {xp} XP</span>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* NAVEGACIÓN 01-05 (v7): reemplaza las 3 pestañas + el dock flotante como fuente
                    principal de "adónde ir" — el dock sigue abajo como acceso rápido mientras se
                    hace scroll, esto es la vista completa. */}
                <div className="nav5-v6">
                    <button
                        type="button"
                        className={`nc-v6 ${activeView === 'inbox' && activeStep === 'confirmations' ? 'on' : ''}`}
                        onClick={() => { setActiveView('inbox'); setSearchParams({ step: 'confirmations', selected_date: selectedDate }); }}
                    >
                        <span className="nc-n-v6">01</span>
                        <span className="nc-lbl-v6">Confirmar</span>
                        <span className={`nc-count-v6 ${counts.confirmations === 0 ? 'zero' : ''}`}>{counts.confirmations}</span>
                    </button>
                    <button
                        type="button"
                        className={`nc-v6 ${activeView === 'inbox' && activeStep === 'calls' ? 'on' : ''}`}
                        onClick={() => { setActiveView('inbox'); setSearchParams({ step: 'calls', selected_date: selectedDate }); }}
                    >
                        <span className="nc-n-v6">02</span>
                        <span className="nc-lbl-v6">Reportar</span>
                        <span className={`nc-count-v6 ${counts.calls === 0 ? 'zero' : ''}`}>{counts.calls}</span>
                    </button>
                    <button
                        type="button"
                        className={`nc-v6 ${activeView === 'inbox' && activeStep === 'seguimientos' ? 'on' : ''}`}
                        onClick={() => { setActiveView('inbox'); setSearchParams({ step: 'seguimientos', selected_date: selectedDate }); }}
                    >
                        <span className="nc-n-v6">03</span>
                        <span className="nc-lbl-v6">Seguir</span>
                        <span className={`nc-count-v6 ${counts.seguimientos === 0 ? 'zero' : ''}`}>{counts.seguimientos}</span>
                    </button>
                    <button
                        type="button"
                        className={`nc-v6 ${activeView === 'report' ? 'on' : ''}`}
                        onClick={() => setActiveView('report')}
                    >
                        <span className="nc-n-v6">04</span>
                        <span className="nc-lbl-v6">Cerrar el día</span>
                        {todayReportSent && <span className="nc-check-v6">✓</span>}
                    </button>
                    <button
                        type="button"
                        className={`nc-v6 ${activeView === 'dashboard' ? 'on' : ''}`}
                        onClick={() => setActiveView('dashboard')}
                    >
                        <span className="nc-n-v6">05</span>
                        <span className="nc-lbl-v6">Ver mis datos</span>
                    </button>
                    <button
                        type="button"
                        className={`nc-v6 ${activeView === 'cartera' ? 'on' : ''}`}
                        onClick={() => setActiveView('cartera')}
                    >
                        <span className="nc-n-v6">06</span>
                        <span className="nc-lbl-v6">Mi cartera</span>
                    </button>
                    {/* Pestaña temporal: solo aparece mientras Operaciones la tenga activada
                        (ver GET /closer/leads-audit/status). No tiene número fijo en la
                        referencia visual porque no forma parte de su flujo habitual. */}
                    {auditEnabled && (
                        <button
                            type="button"
                            className={`nc-v6 ${activeView === 'auditoria' ? 'on' : ''}`}
                            onClick={() => setActiveView('auditoria')}
                        >
                            <span className="nc-n-v6">🗂️</span>
                            <span className="nc-lbl-v6">Auditoría</span>
                        </button>
                    )}
                </div>

                {activeView === 'inbox' ? (
                <div className="space-y-6">
                {/* Barra de utilidades del mazo (v6): la navegación entre pestañas ahora vive en
                    la grilla 01-05 de arriba; esto son acciones/filtros que no tienen otro lugar. */}
                <div className="tabs-v6">
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
                    ) : activeStep === 'seguimientos' ? (
                        <SeguimientosPane selectedDate={selectedDate} onOpenLead={handleSelectLead} refreshKey={seguimientosRefreshKey} />
                    ) : (
                        /* Renderizado Kanban para Llamadas (v7): mismo lenguaje visual que
                           Confirmaciones (3 columnas, kcard-v6), agrupado por urgencia en vez de por
                           etapa de proceso — acá todo está en el mismo estado, "sin reportar". */
                        <>
                            {/* Notificación / progreso de Lote Diario (v7) */}
                            {activeStep === 'calls' && (
                                batchMode ? (
                                    batchItems.length === 0 ? (
                                        <div className="bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border border-emerald-500/40 rounded-[2rem] p-6 flex items-center gap-5">
                                            <div className="text-4xl">🎉</div>
                                            <div className="flex-1">
                                                <h4 className="text-lg font-black text-white">¡Lote completado!</h4>
                                                <p className="text-xs text-emerald-200 mt-1">Procesaste {batchIds.length} leads atrasados. {filteredAgendas.length > 0 ? `Todavía quedan ${filteredAgendas.length} en la cola.` : 'No queda ninguno pendiente. 👏'}</p>
                                            </div>
                                            {filteredAgendas.length > 0 && (
                                                <button
                                                    onClick={startBatch}
                                                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shrink-0"
                                                >
                                                    Otro lote de {Math.min(BATCH_SIZE, filteredAgendas.length)}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setBatchMode(false)}
                                                className="px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shrink-0"
                                            >
                                                Terminar por hoy
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-violet-500/10 border border-violet-500/30 rounded-[2rem] p-5 flex items-center gap-4">
                                            <div className="text-2xl">🎯</div>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-black text-white">Lote en progreso</h4>
                                                <p className="text-[11px] text-violet-200 mt-0.5">{batchIds.length - batchItems.length} de {batchIds.length} completados. Seguí tocando tarjetas hasta vaciar el lote.</p>
                                            </div>
                                            <div className="w-32 h-2 bg-slate-900 rounded-full overflow-hidden shrink-0">
                                                <div className="h-full bg-violet-500 transition-all" style={{ width: `${Math.round(((batchIds.length - batchItems.length) / batchIds.length) * 100)}%` }} />
                                            </div>
                                            <button
                                                onClick={() => setBatchMode(false)}
                                                className="text-[10px] font-black uppercase text-slate-400 hover:text-white underline cursor-pointer shrink-0"
                                            >
                                                Salir del lote
                                            </button>
                                        </div>
                                    )
                                ) : filteredAgendas.length > 0 && (
                                    <div className="bg-slate-900/60 border border-slate-800 rounded-[2rem] p-5 flex items-center gap-4">
                                        <div className="text-2xl">📋</div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-black text-white">Tenés {filteredAgendas.length} lead{filteredAgendas.length !== 1 ? 's' : ''} atrasado{filteredAgendas.length !== 1 ? 's' : ''} por procesar</h4>
                                            <p className="text-[11px] text-slate-400 mt-0.5">No hace falta hacerlos todos hoy — con un lote de {Math.min(BATCH_SIZE, filteredAgendas.length)} al azar ya mantenés el sistema al día.</p>
                                        </div>
                                        <button
                                            onClick={startBatch}
                                            className="px-5 py-3 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shrink-0"
                                        >
                                            Procesar lote de {Math.min(BATCH_SIZE, filteredAgendas.length)}
                                        </button>
                                    </div>
                                )
                            )}

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

                            {/* En modo lote: lista plana del lote actual (nunca son tantas como para
                                necesitar columnas). Fuera de modo lote: Kanban por urgencia. */}
                            {batchMode ? (
                                batchItems.length > 0 && (
                                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                                        <AnimatePresence initial={false}>
                                            {batchItems.map(a => renderKanbanCard(a, 'call'))}
                                        </AnimatePresence>
                                    </div>
                                )
                            ) : loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Loader2 className="animate-spin text-pink-500" size={32} />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cargando llamadas...</span>
                                </div>
                            ) : filteredAgendas.length === 0 ? (
                                <div className="text-center py-16 text-slate-500 text-xs font-bold uppercase tracking-wide bg-[#111219]/95 border border-slate-900 rounded-[2rem]">
                                    👏 Ninguna llamada pendiente de reportar.
                                </div>
                            ) : (
                                <div className="kb-v6">
                                    <div className="kcol-v6 k1-v6">
                                        <div className="kch-v6">
                                            <span className="dt-v6"></span>
                                            <b>Atrasadas</b>
                                            <span className="n-v6">{callsPipeline.atrasadas.length}</span>
                                        </div>
                                        <div className="kbody-v6">
                                            {callsPipeline.atrasadas.length > 0 ? (
                                                callsPipeline.atrasadas.map(a => renderKanbanCard(a, 'call'))
                                            ) : (
                                                <div className="kempty-v6 done-v6">✓ Ninguna atrasada</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="kcol-v6 k2-v6">
                                        <div className="kch-v6">
                                            <span className="dt-v6"></span>
                                            <b>Hoy</b>
                                            <span className="n-v6">{callsPipeline.hoy.length}</span>
                                        </div>
                                        <div className="kbody-v6">
                                            {callsPipeline.hoy.length > 0 ? (
                                                callsPipeline.hoy.map(a => renderKanbanCard(a, 'call'))
                                            ) : (
                                                <div className="kempty-v6">Sin llamadas hoy.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="kcol-v6 k3-v6">
                                        <div className="kch-v6">
                                            <span className="dt-v6"></span>
                                            <b>Reportadas</b>
                                            <span className="n-v6">{callsPipeline.reportadas.length}</span>
                                        </div>
                                        <div className="kbody-v6">
                                            {callsPipeline.reportadas.length > 0 ? (
                                                callsPipeline.reportadas.map(a => renderKanbanCard(a, 'call_done'))
                                            ) : (
                                                <div className="kempty-v6">Todavía ninguna reportada.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
                </div>
                </div>
                ) : activeView === 'report' ? (
                <div className="space-y-5 text-left">
                    {/* Hero "CIERRE DEL DÍA" — calcado del artboard de la referencia visual: saludo +
                        pills (movido/XP/racha) a la izquierda, gráfico de "últimos 7 días" a la
                        derecha. Reemplaza el banner de estado + selector de fecha separados de
                        antes: acá viven juntos, como en la referencia. */}
                    {(() => {
                        const isToday = reportDate === localToday();
                        const doneToday = dailyActivity
                            ? (dailyActivity.confirmados_hoy || 0) + (dailyActivity.show_ups || 0) + (dailyActivity.seguimientos_hechos || 0)
                            : 0;
                        // `counts` es siempre "lo pendiente de HOY" — solo tiene sentido sumarlo al
                        // total cuando se está reportando el día de hoy; para un día pasado ya cerrado
                        // no hay "pendiente" que sumar, así que el total es lo hecho ese día.
                        const pendingToday = isToday ? (counts.confirmations + counts.calls + counts.seguimientos) : 0;
                        const totalToday = doneToday + pendingToday;
                        const firstName = user?.name?.split(' ')[0] || user?.username || 'Closer';
                        const cashToday = dailyActivity?.ventas_cash || 0;
                        const maxTrend = Math.max(1, ...dailyTrend.map(d => d.cash), 1);
                        const [y, m, d] = reportDate.split('-');

                        return (
                            <div className="rpt-hero-v6">
                                <div>
                                    <div className="rpt-hero-lbl-v6">CIERRE DEL DÍA · {d}/{m}</div>
                                    <h2>Buen avance, {firstName}</h2>
                                    <p>{doneToday} de {totalToday} resueltos · ${Math.round(cashToday).toLocaleString()} movidos {isToday ? 'hoy' : 'ese día'}</p>
                                    <div className="flex items-center gap-3 flex-wrap mt-4">
                                        <span className="rpt-pill-v6" style={{ background: 'rgba(255,63,164,.12)', border: '1px solid rgba(255,63,164,.45)' }}>
                                            <span style={{ color: 'rgba(255,255,255,.6)' }}>MOVISTE</span>
                                            <span style={{ color: 'var(--v6-pink)', fontVariantNumeric: 'tabular-nums' }}>${Math.round(cashToday).toLocaleString()}</span>
                                        </span>
                                        <span className="rpt-pill-v6" style={{ background: 'rgba(78,139,216,.12)', border: '1px solid rgba(78,139,216,.45)', color: '#4E8BD8' }}>
                                            {dailyXp} XP
                                        </span>
                                        <span className="rpt-pill-v6" style={{ background: 'rgba(217,164,65,.12)', border: '1px solid rgba(217,164,65,.45)', color: '#D9A441' }}>
                                            RACHA {dailyActivity?.streak_days ?? 0} DÍAS
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '.24em', color: 'var(--v6-tx3)', marginBottom: '14px' }}>ÚLTIMOS 7 DÍAS</div>
                                    {dailyTrend.length > 0 ? (
                                        <div className="rpt-trend-v6">
                                            {dailyTrend.map(dtItem => (
                                                <div key={dtItem.date} className="rpt-trend-col-v6">
                                                    <div
                                                        className="rpt-trend-bar-v6"
                                                        style={{
                                                            height: `${Math.max(4, (dtItem.cash / maxTrend) * 74)}px`,
                                                            background: dtItem.is_target ? 'var(--v6-ok)' : 'rgba(78,139,216,.55)'
                                                        }}
                                                        title={`$${Math.round(dtItem.cash).toLocaleString()}`}
                                                    ></div>
                                                    <span className="rpt-trend-lbl-v6">{dtItem.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[11px]" style={{ color: 'var(--v6-tx3)' }}>Sin reportes previos todavía.</p>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Selector de día a reportar — por defecto hoy, pero se puede retroceder para
                        ponerse al día con reportes atrasados. */}
                    <div className="rpt-card-v6 flex items-center gap-3" style={{ padding: '14px 20px' }}>
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Reportando el día</label>
                            <input
                                type="date"
                                max={localToday()}
                                value={reportDate}
                                onChange={(e) => setReportDate(e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                            />
                        </div>
                        {reportDate !== localToday() && (
                            <button
                                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer"
                                onClick={() => setReportDate(localToday())}
                            >
                                Volver a hoy
                            </button>
                        )}
                        {reportSent && (
                            <span className="tud-xp-v6" style={{ color: '#7DEAC0', background: 'rgba(47,191,143,.14)', borderColor: 'rgba(47,191,143,.32)' }}>
                                ✓ Enviado {reportSentAt ? new Date(reportSentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                        )}
                        {loadingReportStatus && <Loader2 size={14} className="animate-spin text-slate-500" />}
                    </div>

                    {/* 4 KPI del día — mismos 4 de la referencia visual (fracción hecho/total +
                        barra), en vez de las 9 cajas sueltas de antes. "Total" = hecho + pendiente
                        real de cada pestaña, no un número inventado. */}
                    {(() => {
                        const cobrosPendientes = seguimientosHoyGrouped?.cerrada?.length || 0;
                        const kpis = [
                            { label: 'Confirmaciones', done: dailyActivity?.confirmados_hoy || 0, pending: counts.confirmations, color: '#4E8BD8' },
                            { label: 'Llamadas reportadas', done: dailyActivity?.show_ups || 0, pending: counts.calls, color: '#4E8BD8' },
                            { label: 'Seguimientos hechos', done: dailyActivity?.seguimientos_hechos || 0, pending: counts.seguimientos, color: '#2FBF8F' },
                            { label: 'Cobros resueltos', done: dailyActivity?.ventas_count || 0, pending: cobrosPendientes, color: '#FF3FA4' },
                        ];
                        return (
                            <div className="rpt-kpis-v6">
                                {kpis.map(k => {
                                    const total = k.done + k.pending;
                                    const pct = total ? Math.min(100, Math.round((k.done / total) * 100)) : 0;
                                    return (
                                        <div key={k.label} className="rpt-kpi-v6">
                                            <div className="flex items-baseline gap-1.5">
                                                <b style={{ color: k.color, fontSize: '30px' }}>{k.done}</b>
                                                <span style={{ fontSize: '13px', color: 'var(--v6-tx3)', fontWeight: 900 }}>/{total}</span>
                                            </div>
                                            <div className="rpt-kpi-bar-v6"><i style={{ width: `${pct}%`, background: k.color }}></i></div>
                                            <span>{k.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {/* LOGROS + REFLEXIÓN, lado a lado como en la referencia. Los 3 logros salen de
                        datos ya reales en esta misma pantalla (nunca un número inventado): si
                        hubo algún cobro hoy, si la bandeja quedó limpia, y la meta diaria de
                        seguimientos (③ Seguir). */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rpt-card-v6">
                            <h3 className="rpt-title-v6" style={{ marginBottom: '4px' }}>LOGROS</h3>
                            {(() => {
                                const pendienteHoyTotal = counts.confirmations + counts.calls + counts.seguimientos;
                                const cobrosHechos = dailyActivity?.ventas_count || 0;
                                const segFaltan = seguimientosGoal?.faltan;
                                const achievements = [
                                    {
                                        name: 'Primer cobro',
                                        done: cobrosHechos > 0,
                                        status: cobrosHechos > 0 ? '✓ logrado' : 'cobrá 1 venta'
                                    },
                                    {
                                        name: 'Día limpio',
                                        done: pendienteHoyTotal === 0,
                                        status: pendienteHoyTotal === 0 ? '✓ logrado' : `faltan ${pendienteHoyTotal}`
                                    },
                                    {
                                        name: 'Meta de seguimientos',
                                        done: segFaltan === 0,
                                        status: segFaltan === undefined || segFaltan === null ? '—' : segFaltan === 0 ? '✓ logrado' : `faltan ${segFaltan}`
                                    },
                                ];
                                return achievements.map(a => (
                                    <div key={a.name} className={`rpt-ach-v6 ${a.done ? 'done' : ''}`}>
                                        <div className="rpt-ach-ic-v6">{a.done ? '✓' : '◆'}</div>
                                        <div className="flex-1">
                                            <div className="rpt-ach-name-v6">{a.name}</div>
                                        </div>
                                        <div className="rpt-ach-status-v6">{a.status}</div>
                                    </div>
                                ));
                            })()}
                        </div>

                        <div className="rpt-card-v6 space-y-4">
                            <div className="flex items-center gap-3">
                                <h3 className="rpt-title-v6">REFLEXIÓN</h3>
                                <div className="flex-1"></div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--v6-tx3)' }}>Slots</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={reportSlots}
                                        onChange={(e) => { setReportSlots(e.target.value); setReportSlotsIsDefault(false); }}
                                        placeholder="0"
                                        className="rpt-slots-input-v6"
                                        style={slotsPorDebajoDeAgendas ? { borderColor: 'var(--v6-warn)' } : reportSlotsIsDefault ? { borderColor: 'rgba(139,92,246,.6)' } : undefined}
                                    />
                                </div>
                            </div>
                            {/* El mínimo posible siempre visible: la cantidad de agendas del día no
                                puede quedar enterrada en un párrafo — es lo que pidió el usuario. Un
                                cupo ocupado sigue siendo un cupo, así que los slots nunca pueden ser
                                menos que esto. */}
                            {dailyActivity?.agendas_del_dia !== undefined && (
                                <p className="text-[11px] font-bold" style={{ color: slotsPorDebajoDeAgendas ? '#F3D08A' : 'var(--v6-tx3)' }}>
                                    {slotsPorDebajoDeAgendas ? '⚠️ ' : ''}Mínimo {dailyActivity.agendas_del_dia} — ese día tenés {dailyActivity.agendas_del_dia} agenda(s) registradas, y un cupo ocupado sigue contando.
                                </p>
                            )}
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--v6-ok)' }}>Victoria del día</span>
                                <input
                                    value={reflection.win}
                                    onChange={(e) => setReflection(prev => ({ ...prev, win: e.target.value }))}
                                    placeholder="Qué te salió bien y por qué…"
                                    className="rpt-input-v6"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--v6-warn)' }}>Una cosa a mejorar</span>
                                <input
                                    value={reflection.fix}
                                    onChange={(e) => setReflection(prev => ({ ...prev, fix: e.target.value }))}
                                    placeholder="Una sola, concreta…"
                                    className="rpt-input-v6"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Aviso + enviar — reenviar el mismo día actualiza el reporte existente y lo
                        reenvía a Discord, no lo duplica. */}
                    <div className="rpt-card-v6 flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--v6-warn)' }}></span>
                            <span className="text-xs font-bold" style={{ color: '#F3D08A' }}>
                                {counts.confirmations + counts.calls + counts.seguimientos} cosa(s) quedaron sin resolver
                            </span>
                        </div>
                        <div className="flex-1"></div>
                        <button
                            disabled={sendingReport || (backlogBlocksReport && pendingPreviousDays && pendingPreviousDays.total > 0)}
                            title={backlogBlocksReport && pendingPreviousDays && pendingPreviousDays.total > 0 ? 'Resolvé el trabajo atrasado de días anteriores antes de poder enviar' : undefined}
                            onClick={async () => {
                                if (backlogBlocksReport && pendingPreviousDays && pendingPreviousDays.total > 0) {
                                    toast.error('Tenés tareas pendientes de días anteriores — resolvelas antes de enviar el reporte.');
                                    return;
                                }
                                if (reportSlots.trim() === '') {
                                    toast.error('Ingresá los slots disponibles del día — es el único dato que no se calcula solo.');
                                    return;
                                }
                                setSendingReport(true);
                                try {
                                    const res = await api.post('/closer/deck/daily-report', {
                                        date: reportDate,
                                        slots: parseInt(reportSlots) || 0,
                                        reflections: { victory: reflection.win, opportunity: reflection.fix }
                                    });
                                    setReportSent(true);
                                    setReportSentAt(new Date().toISOString());
                                    if (res.data?.date === localToday()) setTodayReportSent(true);
                                    toast.success(res.data?.date === localToday() ? "Reporte del día enviado con éxito" : `Reporte del ${res.data?.date || reportDate} enviado con éxito`);
                                } catch (err) {
                                    if (err.response?.status === 409 && err.response?.data?.pending_previous_days) {
                                        setPendingPreviousDays(err.response.data.pending_previous_days);
                                    }
                                    toast.error(err.response?.data?.error || "Error al enviar el reporte del día");
                                } finally {
                                    setSendingReport(false);
                                }
                            }}
                            className="h-[52px] px-8 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-full transition-all cursor-pointer flex items-center gap-2"
                            style={{ background: 'var(--v6-gradb)', boxShadow: '0 10px 15px -3px rgba(19,35,198,.35)' }}
                        >
                            {sendingReport ? <Loader2 size={14} className="animate-spin" /> : null}
                            {sendingReport ? 'Enviando...' : reportSent ? 'Actualizar y reenviar reporte' : 'Enviar reporte del día'}
                        </button>
                    </div>

                    {/* Trabajo atrasado de días ANTERIORES — pedido del usuario (feedback en video,
                        28/ago/2026): "ponlo al final, que se vea chiquitico, no muy grande... no me
                        gusta cómo se ve ahí, está muy aparatoso". Antes era un bloque grande con lista
                        de viñetas entre el selector de fecha y los KPI; ahora es una píldora chica al
                        final de la página, sin perder la función de bloqueo (el botón de enviar sigue
                        chequeando `backlogBlocksReport`/`pendingPreviousDays` directo, sin depender de
                        que este aviso esté visible). */}
                    {pendingPreviousDays && pendingPreviousDays.total > 0 && (
                        <div className={`flex items-center gap-2.5 flex-wrap px-4 py-2.5 rounded-full border text-[10.5px] font-bold ${backlogBlocksReport ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
                            <span>{backlogBlocksReport ? '🚫' : '⏳'}</span>
                            <span>
                                {pendingPreviousDays.total} tarea{pendingPreviousDays.total === 1 ? '' : 's'} atrasada{pendingPreviousDays.total === 1 ? '' : 's'} de días anteriores
                                {backlogBlocksReport ? ' — traba el envío' : ''}
                            </span>
                            <button
                                type="button"
                                className="ml-auto underline font-black uppercase tracking-wide cursor-pointer"
                                onClick={() => setActiveView('inbox')}
                            >
                                Ir a resolver
                            </button>
                        </div>
                    )}
                </div>
                ) : activeView === 'auditoria' ? (
                    <CloserLeadsAudit embedded />
                ) : activeView === 'cartera' ? (
                    <MiCarteraPane onOpenLead={handleSelectLead} />
                ) : (
                    <CloserDashboard
                        embedded
                        onNavigate={(view, opts) => {
                            // El dashboard puede pedir un día concreto ("te falta el reporte del 5"),
                            // así que la pestaña se abre ya posicionada en esa fecha.
                            if (opts?.date) setReportDate(opts.date);
                            // …o un paso concreto del mazo ("tenés 8 llamadas sin reportar"), para
                            // caer directo en la pestaña que resuelve ese pendiente.
                            if (opts?.step) setSearchParams({ step: opts.step, selected_date: selectedDate });
                            setActiveView(view);
                        }}
                    />
                )}

            {/* Modal de Detalle de Lead v7 (ovLead) */}
            {/* Sin AnimatePresence a propósito: con esta versión de framer-motion el overlay nunca
                se desmontaba al cerrarse (se quedaba fijo tapando la pantalla, con o sin motion
                component como hijo directo), y la única salida era recargar la página. Era la razón
                real de que un seguimiento resuelto "no desapareciera". La animación de entrada se
                mantiene; se pierde solo el fundido de salida, que dura 0,2s y no lo extraña nadie. */}
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
                                        {modalFlowLabel}
                                        {selectedLead.date ? ` · ${selectedLead.date} ${selectedLead.time || ''}` : ''}
                                    </p>
                                    {selectedLead.phone && (
                                        <a
                                            href={waLinkForPhone(selectedLead.phone, selectedLead.lead_name)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 mt-1 text-[10.5px] font-black text-emerald-400 hover:text-emerald-300 transition-colors"
                                        >
                                            <Phone size={11} /> {selectedLead.phone}
                                        </a>
                                    )}
                                </div>
                                {selectedLead.can_edit !== false && (
                                    <button
                                        className="p-2 hover:bg-violet-500/20 text-violet-300 rounded-xl transition-all cursor-pointer border border-violet-500/30 mr-2"
                                        title="Corregir datos del lead (nombre, teléfono, correo, fecha)"
                                        onClick={() => setEditingLead(selectedLead)}
                                    >
                                        <Pencil size={16} />
                                    </button>
                                )}
                                {selectedLead.can_edit !== false && (
                                    <button
                                        className="p-2 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all cursor-pointer border border-rose-500/30 mr-2"
                                        title="Eliminar lead"
                                        onClick={() => handleDeleteLead(selectedLead.id, selectedLead.lead_name)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                                <button className="x" onClick={() => setSelectedLead(null)}>
                                    ×
                                </button>
                            </div>

                            {selectedLead.can_edit === false && (
                                <div className="mx-5 mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] font-bold text-amber-300 uppercase tracking-wide">
                                    Este lead pertenece a {selectedLead.owner_closer_name || 'otro closer'} — solo podés consultarlo, no editarlo ni declarar ventas sobre él.
                                </div>
                            )}

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
                                        <span>◈ Examen</span>
                                        <b>{selectedLead.examen || 'MIR / ENARM'}</b>
                                    </div>
                                    <div className="idc">
                                        <span>▤ Grupo</span>
                                        <b>{selectedLead.grupo || 'Grupo sin asignar'}</b>
                                    </div>
                                    <div className="idc">
                                        <span>◐ Fecha agendamiento</span>
                                        <b>{formatIdcardDate(selectedLead.start_time || selectedLead.call_date) || 'Sin fecha'}</b>
                                    </div>
                                    {formatIdcardDate(selectedLead.enrollment_date) && (
                                        <div className="idc">
                                            <span>✓ Fecha de ingreso</span>
                                            <b>{formatIdcardDate(selectedLead.enrollment_date)}</b>
                                        </div>
                                    )}
                                    <div className="idc hl">
                                        <span>● Estado</span>
                                        <b>{selectedLead.closer_result || selectedLead.result || 'Sin reportar'}</b>
                                    </div>
                                </div>

                                {/* Responsable del lead — pase de mano rápido a otro closer, sin
                                    pasar por admin (ver PATCH /closer/appointments/<id>/reassign). */}
                                {selectedLead.id > 0 && (
                                    <div className="w-full bg-black/20 border border-slate-900/60 rounded-xl px-3 py-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400">
                                                Responsable: <b className="text-white">{selectedLead.closer_name || 'Sin asignar'}</b>
                                            </span>
                                            <button
                                                onClick={() => setReassignOpen(v => !v)}
                                                className="text-[9.5px] font-black uppercase tracking-wide text-violet-350 hover:text-violet-300 transition-colors cursor-pointer"
                                            >
                                                {reassignOpen ? 'Cancelar' : 'Cambiar de closer'}
                                            </button>
                                        </div>
                                        {reassignOpen && (
                                            <div className="flex items-center gap-2 mt-2">
                                                <select
                                                    disabled={reassigning}
                                                    defaultValue=""
                                                    onChange={(e) => e.target.value && handleReassignLead(e.target.value)}
                                                    className="flex-1 bg-slate-950 border border-slate-850 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-200"
                                                >
                                                    <option value="" disabled>Elegí un closer...</option>
                                                    {(teamMembers || [])
                                                        .filter(m => m.role === 'closer' && m.id !== selectedLead.closer_id)
                                                        .map(m => (
                                                            <option key={m.id} value={m.id}>{m.username}</option>
                                                        ))}
                                                </select>
                                                {reassigning && <Loader2 size={14} className="animate-spin text-violet-400 shrink-0" />}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedLead.client_id && (
                                    <button
                                        onClick={() => {
                                            const clientId = selectedLead.client_id;
                                            setSelectedLead(null);
                                            setHistoryClientId(clientId);
                                        }}
                                        className="w-full text-[9.5px] font-black uppercase tracking-wide text-violet-350 hover:text-violet-300 py-1.5 transition-colors cursor-pointer"
                                    >
                                        Ver historial completo del cliente →
                                    </button>
                                )}

                                {/* Contenido por pestaña */}
                                {modalTab === 'act' && (
                                    <div id="paneAct">
                                        {selectedLead.can_edit === false ? (
                                            <div className="note" style={{ background: 'rgba(255,255,255,.04)', borderLeft: '3px solid rgba(245,158,11,.4)' }}>
                                                No podés reportar la llamada, declarar una venta ni tomar ninguna acción sobre este lead — pertenece a {selectedLead.owner_closer_name || 'otro closer'}. Usá la pestaña "Formulario" para consultar sus datos.
                                            </div>
                                        ) : (
                                            <>
                                                <div className="trail">
                                                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#A9B3EE' }}>Camino:</span>
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
                                            </>
                                        )}
                                    </div>
                                )}

                                {modalTab === 'form' && (() => {
                                    const formAnswers = getFormDataAnswers(selectedLead.form_data);
                                    const surveyAnswers = selectedLead.survey_answers || [];
                                    const fuenteForm = selectedLead.form_data?.fuente_form;
                                    const submittedAt = selectedLead.form_data?.submitted_at;
                                    return (
                                        <div id="paneForm">
                                            <div className="fsec">
                                                <div className="fh">
                                                    <b>Datos del lead</b>
                                                    <span className="tagx" style={{ background: 'rgba(99,102,241,.2)', color: '#A5B4FC' }}>n8n</span>
                                                    <hr />
                                                </div>
                                                {renderFormQuestion("Instagram", `@${selectedLead.instagram || 'N/A'}`)}
                                                {renderFormQuestion("Fuente del Lead", fuenteForm || selectedLead.origin || 'Meta Ads')}
                                                {renderFormQuestion("Setter", selectedLead.setter_name || 'Sin Asignar')}
                                            </div>

                                            {/* Respuestas del formulario de calificación de n8n (Client.form_data). */}
                                            <div className="fsec" style={{ marginTop: '20px' }}>
                                                <div className="fh">
                                                    <b>Formulario de calificación</b>
                                                    {formAnswers.length > 0 && (
                                                        <span className="tagx" style={{ background: 'rgba(34,197,94,.2)', color: '#86EFAC' }}>
                                                            ✓ {formAnswers.length} respuesta{formAnswers.length === 1 ? '' : 's'}
                                                        </span>
                                                    )}
                                                    <hr />
                                                </div>
                                                {formAnswers.length > 0 ? (
                                                    <>
                                                        {selectedLead.form_data_recovered && (
                                                            <div className="text-[9px] font-bold uppercase tracking-wide text-amber-400 pb-1">
                                                                ⚠ Recuperado de otro registro con el mismo teléfono/instagram/correo — verificá que corresponda a este lead.
                                                            </div>
                                                        )}
                                                        {formAnswers.map(ans => (
                                                            renderFormQuestion(ans.question, ans.answer, getCalificacionColor(ans.answer), `fd-${ans.key}`)
                                                        ))}
                                                        {submittedAt && (
                                                            <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500 pt-1">
                                                                Respondido el {formatIdcardDate(submittedAt) || submittedAt}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="note" style={{ background: 'rgba(255,255,255,.04)', borderLeft: '3px solid rgba(255,255,255,.12)' }}>
                                                        Este lead no completó el formulario de calificación.
                                                    </div>
                                                )}
                                            </div>

                                            {/* Encuesta propia de la página de reserva (SurveyAnswer) — origen distinto
                                                del formulario de n8n de arriba. Solo se muestra si tiene respuestas. */}
                                            {surveyAnswers.length > 0 && (
                                                <div className="fsec" style={{ marginTop: '20px' }}>
                                                    <div className="fh">
                                                        <b>Encuesta de cita</b>
                                                        <span className="tagx" style={{ background: 'rgba(34,197,94,.2)', color: '#86EFAC' }}>✓ completada</span>
                                                        <hr />
                                                    </div>
                                                    {surveyAnswers.map((ans, idx) => (
                                                        renderFormQuestion(ans.question, ans.answer, getCalificacionColor(ans.answer), `sa-${idx}`)
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

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

                                        {selectedLead.can_edit !== false && (
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
                                        )}

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

            {/* Modal de decisión: Con / Sin Decisor */}
            {/* Ver ovLead: AnimatePresence deja estos overlays pegados al cerrarse */}
            <>
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
            </>

            {/* Prompt intermedio: ¿Hubo venta? */}
            <>
                {salePrompt.apptId && !saleModalOpen && (
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
            </>

            {/* Modal de declaración de venta por pasos */}
            <>
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
                                <div className="absolute top-0 right-0 w-64 h-64 blur-[120px] opacity-10 bg-violet-500" />
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
                                                    ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/35'
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
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500 transition-all"
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
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500 transition-all"
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
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500 transition-all"
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
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500 transition-all"
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
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500 transition-all"
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
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500 transition-all"
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
                                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500 transition-all cursor-pointer"
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
                                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500 transition-all cursor-pointer disabled:opacity-40"
                                                    required
                                                >
                                                    {[
                                                        { value: 'completo', label: 'Completo (PIF)' },
                                                        { value: 'parcial', label: 'Parcial (Primer Pago)' },
                                                        { value: 'Seña', label: 'Seña (Promesa)' },
                                                        { value: 'Cuota', label: 'Cuotas' },
                                                        { value: 'Renovacion', label: 'Renovación' },
                                                        { value: 'Upsell', label: 'Upsell' },
                                                    ].map(opt => {
                                                        const rule = saleClientState?.allowed_types?.[opt.value.toLowerCase()];
                                                        const disabled = rule ? !rule.ok : false;
                                                        return (
                                                            <option key={opt.value} value={opt.value} disabled={disabled} title={disabled ? rule.reason : undefined}>
                                                                {opt.label}{disabled ? ' — no disponible' : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                {(() => {
                                                    const rule = saleClientState?.allowed_types?.[(saleForm.tipo_pago_simple || '').toLowerCase()];
                                                    if (rule && !rule.ok) {
                                                        return <p className="text-[9px] text-rose-400 font-bold mt-1">{rule.reason}</p>;
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                            {saleClientState && saleClientState.total_paid > 0 && (
                                                <div className="md:col-span-2 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl text-[10px] font-bold text-violet-300 uppercase tracking-wide">
                                                    Este cliente ya pagó ${saleClientState.total_paid.toFixed(2)} de ${saleClientState.program_price.toFixed(2)} en {saleForm.programa} — saldo restante ${saleClientState.balance_remaining.toFixed(2)}.
                                                </div>
                                            )}
                                            {['Renovacion', 'Upsell'].includes(saleForm.tipo_pago_simple) && saleClientState?.can_settle_balance_with_installment && (
                                                <div className="md:col-span-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                                    <label className="flex items-center gap-2 text-[10px] font-bold text-amber-300 uppercase tracking-wide cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={settleBalanceWithSale}
                                                            onChange={e => setSettleBalanceWithSale(e.target.checked)}
                                                            className="rounded"
                                                        />
                                                        Incluir el pago del saldo pendiente (${saleClientState.balance_remaining.toFixed(2)}) junto con esta venta
                                                    </label>
                                                </div>
                                            )}
                                            {saleForm.tipo_pago_simple !== 'completo' && (
                                                <div className="space-y-1 text-left">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Precio Total (USD) *</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><DollarSign size={13} /></span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={saleForm.precio_total}
                                                            onChange={e => setSaleForm({ ...saleForm, precio_total: e.target.value })}
                                                            placeholder="0.00"
                                                            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500 transition-all"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                                    {saleForm.tipo_pago_simple === 'completo' ? 'Monto Cobrado (USD) *' : 'Cobrado Hoy (USD) *'}
                                                </label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"><DollarSign size={13} /></span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={saleForm.monto}
                                                        onChange={e => setSaleForm({ ...saleForm, monto: e.target.value })}
                                                        placeholder="0.00"
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500 transition-all"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Método de Pago *</label>
                                                <select
                                                    value={saleForm.metodo_pago}
                                                    onChange={e => setSaleForm({ ...saleForm, metodo_pago: e.target.value })}
                                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500 transition-all cursor-pointer"
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
                                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500 transition-all"
                                                />
                                            </div>
                                        </div>

                                        {saleForm.tipo_pago_simple === 'completo' ? (
                                            <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                                Pago único: se cobra todo hoy, no hay saldo ni cronograma de cuotas.
                                            </div>
                                        ) : isCuotaPayment && (loadingSaleCuotas || saleExistingCuotas.length > 0) ? (
                                            <div className="space-y-3 pt-2 border-t border-slate-800">
                                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest text-left pt-2">¿Cuál cuota del plan ya existente se está pagando?</h4>
                                                {loadingSaleCuotas ? (
                                                    <div className="flex justify-center py-4"><Loader2 className="animate-spin text-violet-400" size={20} /></div>
                                                ) : (
                                                    <div className="rounded-xl border border-slate-800 overflow-hidden">
                                                        <table className="w-full text-xs">
                                                            <thead className="bg-slate-950/60">
                                                                <tr>
                                                                    <th className="text-left px-3 py-2 text-[9px] font-black text-slate-500 uppercase"></th>
                                                                    <th className="text-left px-3 py-2 text-[9px] font-black text-slate-500 uppercase">Cuota</th>
                                                                    <th className="text-left px-3 py-2 text-[9px] font-black text-slate-500 uppercase">Monto</th>
                                                                    <th className="text-left px-3 py-2 text-[9px] font-black text-slate-500 uppercase">Vence</th>
                                                                    <th className="text-left px-3 py-2 text-[9px] font-black text-slate-500 uppercase">Estado</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {saleExistingCuotas.map(c => {
                                                                    const isPagado = c.estado === 'pagado';
                                                                    const isVencida = c.estado === 'vencido';
                                                                    return (
                                                                        <tr key={c.id} className={`border-t border-slate-850 ${isPagado ? 'opacity-40' : 'cursor-pointer hover:bg-slate-900/40'} ${selectedCuotaId === c.id ? 'bg-violet-500/10' : ''}`}
                                                                            onClick={() => { if (!isPagado) { setSelectedCuotaId(c.id); setSaleForm(prev => ({ ...prev, monto: String(c.monto) })); } }}
                                                                        >
                                                                            <td className="px-3 py-2">
                                                                                {!isPagado && <input type="radio" checked={selectedCuotaId === c.id} onChange={() => {}} className="cursor-pointer" />}
                                                                            </td>
                                                                            <td className="px-3 py-2 font-bold text-white">Cuota {c.numero_cuota}</td>
                                                                            <td className="px-3 py-2 font-bold text-slate-300">${Number(c.monto).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                                            <td className="px-3 py-2 font-bold text-slate-300">{c.fecha_vencimiento}</td>
                                                                            <td className="px-3 py-2">
                                                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                                                                                    isPagado ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                                                    isVencida ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                                                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                                                }`}>{isPagado ? 'Pagada' : isVencida ? 'Vencida' : 'Pendiente'}</span>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                                <p className="text-[9px] text-slate-550 font-medium">
                                                    Elegí cualquier cuota pendiente (podés adelantar una futura o pagar una vencida) — se marca como pagada con el monto de arriba, sin tocar el resto del plan.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3 pt-2 border-t border-slate-800">
                                                {isCuotaPayment && (
                                                    <p className="text-[9px] text-amber-400 font-bold uppercase tracking-wide">
                                                        Este cliente no tiene un plan de cuotas previo registrado — se creará uno nuevo con esta cuota.
                                                    </p>
                                                )}
                                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest text-left pt-2">Plan de Cuotas (Próximos Pagos)</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1 text-left">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Cuotas Restantes *</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={saleForm.num_cuotas}
                                                            onChange={e => setSaleForm({ ...saleForm, num_cuotas: e.target.value })}
                                                            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500 transition-all"
                                                        />
                                                    </div>
                                                    <div className="space-y-1 text-left">
                                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Saldo a Financiar</label>
                                                        <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-black text-violet-400">
                                                            ${Math.max(0, (parseFloat(saleForm.precio_total) || 0) - (saleClientState?.total_paid || 0) - (parseFloat(saleForm.monto) || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </div>
                                                    </div>
                                                </div>
                                                {(() => {
                                                    const total = parseFloat(saleForm.precio_total) || 0;
                                                    // Igual que en el submit: descontar lo ya pagado antes, no solo el monto de hoy.
                                                    const now = (saleClientState?.total_paid || 0) + (parseFloat(saleForm.monto) || 0);
                                                    const n = Math.max(1, parseInt(saleForm.num_cuotas) || 1);
                                                    const rest = Math.max(0, total - now);
                                                    if (rest <= 0) return null;
                                                    const each = Math.round((rest / n) * 100) / 100;
                                                    const overrides = saleForm.cuotaFechas || {};
                                                    const rows = Array.from({ length: n }, (_, i) => {
                                                        const monto = i === n - 1 ? Math.round((rest - each * (n - 1)) * 100) / 100 : each;
                                                        const d = new Date();
                                                        d.setMonth(d.getMonth() + i + 1);
                                                        const numero = i + 1;
                                                        return { n: numero, monto, fecha: overrides[numero] || toLocalDateStr(d) };
                                                    });
                                                    return (
                                                        <div className="rounded-xl border border-slate-800 overflow-hidden">
                                                            <table className="w-full text-xs">
                                                                <thead className="bg-slate-950/60">
                                                                    <tr>
                                                                        <th className="text-left px-3 py-2 text-[9px] font-black text-slate-500 uppercase">Cuota</th>
                                                                        <th className="text-left px-3 py-2 text-[9px] font-black text-slate-500 uppercase">Monto</th>
                                                                        <th className="text-left px-3 py-2 text-[9px] font-black text-slate-500 uppercase">Vence — cuándo la vas a cobrar</th>
                                                                        <th className="text-left px-3 py-2 text-[9px] font-black text-slate-500 uppercase">Estado</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {rows.map(r => (
                                                                        <tr key={r.n} className="border-t border-slate-850">
                                                                            <td className="px-3 py-2 font-bold text-white">Cuota {r.n}</td>
                                                                            <td className="px-3 py-2 font-bold text-slate-300">${r.monto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                                                            <td className="px-3 py-2">
                                                                                <input
                                                                                    type="date"
                                                                                    value={r.fecha}
                                                                                    onChange={(e) => setSaleForm(prev => ({
                                                                                        ...prev,
                                                                                        cuotaFechas: { ...prev.cuotaFechas, [r.n]: e.target.value }
                                                                                    }))}
                                                                                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-200"
                                                                                />
                                                                            </td>
                                                                            <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">Pendiente</span></td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    );
                                                })()}
                                                <p className="text-[9px] text-slate-550 font-medium">Se guarda automáticamente al declarar la venta con las fechas que dejes arriba (por defecto, una por mes) — también se pueden ajustar después.</p>
                                            </div>
                                        )}
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
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-violet-500 transition-all"
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
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500 transition-all"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Estado de la Venta *</label>
                                                <select
                                                    value={saleForm.estado}
                                                    onChange={e => setSaleForm({ ...saleForm, estado: e.target.value })}
                                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500 transition-all cursor-pointer"
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
                                                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder-slate-650 outline-none focus:border-violet-500 transition-all min-h-[70px] resize-none"
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
                                        className="h-9 px-5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
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
            </>

            {/* Modal de Motivo / Razón de Cambio (Reemplazo de window.prompt) */}
            <>
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
            </>

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
            <>
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

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Teléfono <span className="text-pink-500">*</span></label>
                                        <input
                                            value={newAgendaForm.phone}
                                            onChange={(e) => setNewAgendaForm(prev => ({ ...prev, phone: e.target.value }))}
                                            placeholder="+52 55 1234 5678"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Correo <span className="text-pink-500">*</span></label>
                                        <input
                                            type="email"
                                            value={newAgendaForm.email}
                                            onChange={(e) => setNewAgendaForm(prev => ({ ...prev, email: e.target.value }))}
                                            placeholder="carla@mail.com"
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
            </>

            {/* Modal Referido Manual v7 (ovRef) */}
            <>
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
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Instagram <span className="text-pink-500">*</span></label>
                                        <input
                                            value={manualRefForm.instagram}
                                            onChange={(e) => setManualRefForm(prev => ({ ...prev, instagram: e.target.value }))}
                                            placeholder="@usuario"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Teléfono <span className="text-pink-500">*</span></label>
                                        <input
                                            value={manualRefForm.phone}
                                            onChange={(e) => setManualRefForm(prev => ({ ...prev, phone: e.target.value }))}
                                            placeholder="+52 55 1234 5678"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Correo <span className="text-pink-500">*</span></label>
                                        <input
                                            type="email"
                                            value={manualRefForm.email}
                                            onChange={(e) => setManualRefForm(prev => ({ ...prev, email: e.target.value }))}
                                            placeholder="carla@mail.com"
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
                                    disabled={!manualRefForm.from_lead_id || !manualRefForm.lead_name.trim() || !manualRefForm.phone.trim() || !manualRefForm.instagram.trim() || !manualRefForm.email.trim() || processingId === 'manual_ref'}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                                >
                                    {processingId === 'manual_ref' ? 'Guardando...' : 'Crear referido'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </>

            {historyClientId && (
                <ClientHistoryModal
                    clientId={historyClientId}
                    onClose={() => setHistoryClientId(null)}
                    onOpenAppointment={handleOpenAppointmentFromHistory}
                    onRegisterSale={handleRegisterSaleFromHistory}
                />
            )}

            {/* Selector de agenda — lead con varias agendas pendientes de confirmar encontrado
                desde la búsqueda global: elegir sobre cuál se está marcando el estado. */}
            <>
                {agendaPicker.open && (
                    <div className="ov on">
                        <motion.div
                            initial={{ opacity: 0, y: 18, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 18, scale: 0.97 }}
                            transition={{ duration: 0.2 }}
                            className="md"
                            style={{ maxWidth: 420 }}
                        >
                            <div className="mdh">
                                <div style={{ flex: 1 }}>
                                    <h3>ELEGÍ LA AGENDA</h3>
                                    <p>Este lead tiene varias agendas pendientes de confirmar</p>
                                </div>
                                <button className="x" onClick={() => setAgendaPicker({ open: false, appointments: [] })}>×</button>
                            </div>
                            <div className="mdb space-y-2">
                                {agendaPicker.appointments.map(a => (
                                    <button
                                        key={a.id}
                                        onClick={() => {
                                            setAgendaPicker({ open: false, appointments: [] });
                                            handleSelectLead({ id: a.id, fase: 'confirm', result: a.result });
                                        }}
                                        className="w-full text-left px-4 py-3 bg-slate-950/60 hover:bg-slate-900 border border-slate-800 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3"
                                    >
                                        <div>
                                            <div className="text-xs font-black text-white">{formatIdcardDate(a.start_time) || 'Sin fecha'}</div>
                                            <div className="text-[10px] font-bold text-slate-500">{a.result || 'Pendiente'}</div>
                                        </div>
                                        <ChevronRight size={16} className="text-slate-500" />
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </>


            {/* Corrección de la ficha del lead: nombre, teléfono, correo, instagram y fecha/hora
                de la llamada. Al guardar se recarga el mazo y se cierra el modal de detalle, para
                que el lead vuelva a leerse con los datos nuevos en vez de los de la copia vieja. */}
            {editingLead && (
                <LeadEditModal
                    lead={editingLead}
                    onClose={() => setEditingLead(null)}
                    onSaved={() => { setSelectedLead(null); fetchAgendas(); }}
                />
            )}

            {showProcrastinar && (
                <ProcrastinarModal
                    pendientes={counts.seguimientos}
                    onClose={() => setShowProcrastinar(false)}
                    onGo={() => {
                        setShowProcrastinar(false);
                        setActiveView('inbox');
                        setSearchParams({ step: 'seguimientos', selected_date: selectedDate });
                    }}
                />
            )}

            <OperatorControls
                isOpen={showOperatorControls}
                onClose={() => setShowOperatorControls(false)}
            />

            {/* Modal de Celebración de Hitos (Pipeline de Confirmaciones v7) */}
            <>
                {celebration && (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 22, stiffness: 220 }}
                            className="w-full max-w-md bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950 border border-violet-500/40 rounded-[2rem] p-10 text-center shadow-2xl shadow-violet-900/40"
                        >
                            <span className="text-6xl leading-none block mb-3">{celebration.emoji}</span>
                            <h3 className="text-2xl font-black text-white tracking-tight">{celebration.title}</h3>
                            <p className="text-sm text-slate-300 mt-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: celebration.body }} />

                            {celebration.bar && (
                                <div className="mt-5">
                                    <div className="h-2 rounded-full bg-black/40 border border-white/10 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-pink-500 to-violet-500"
                                            style={{ width: `${Math.min(100, (celebration.bar.v / celebration.bar.t) * 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-2">
                                        {celebration.bar.label} · {celebration.bar.v} de {celebration.bar.t}
                                    </p>
                                </div>
                            )}

                            {celebration.next && (
                                <div className="mt-5 text-[11px] font-black uppercase tracking-wider text-pink-300 bg-pink-500/10 border border-pink-500/30 rounded-xl px-4 py-3">
                                    {celebration.next}
                                </div>
                            )}

                            <button
                                onClick={() => setCelebration(null)}
                                className="mt-6 w-full py-3.5 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl text-sm font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                                Seguir
                            </button>
                        </motion.div>
                    </div>
                )}
            </>
        </div>
        </div>
    );
};

export default CloserWorkflowPage;
