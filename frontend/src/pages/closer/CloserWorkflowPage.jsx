import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
    Layers, Search, Check, X, ChevronRight, Loader2,
    Calendar, Phone, Mail, Instagram, ExternalLink,
    CalendarDays, AlertCircle, CreditCard,
    Save, ArrowLeft, ArrowRight, CheckCircle2, User, PenTool, Pencil,
    DollarSign, UserPlus,
    CalendarCheck, PhoneCall, MessageCircle, ClipboardList, BarChart3, Briefcase, FileSearch,
    CalendarPlus, Gift, Hourglass, Ghost, Filter
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { usePlaybook } from '../../contexts/PlaybookContext';
import TriageFollowUpModal from '../triage/components/TriageFollowUpModal';
import { abrirSimulacion } from '../../sesion/simulacion';
import CloserLeadsAudit from './audit/CloserLeadsAudit';
import SeguimientosPane from './components/SeguimientosPane';
import EsqueletoKanban from './components/EsqueletoKanban';
import EsqueletoSiguientePaso from './components/EsqueletoSiguientePaso';
import { escalonDe, useVentanaDeEntrada } from '../../components/huesos/Huesos';
import DashboardComercial from '../comercial/DashboardComercial';
import DockSecciones from '../comercial/components/DockSecciones';
import MenuSesion from '../comercial/components/MenuSesion';
import { revertImpersonation } from '../../utils/impersonation';
import { armarMenuSesion, rotuloDeSesion } from '../../sesion/menuSesion';
import { useConfiguracion } from '../../sesion/ConfiguracionContext';
import '../comercial/comercial.css';
import '../../components/dashboard/pareja.css';
import './clarity-v6.css';
import ComisionMesCard from './components/ComisionMesCard';
import TriageMetricas from '../triage/components/TriageMetricas';
import ProcrastinarModal from './components/ProcrastinarModal';
import YaTieneAgenda from './components/YaTieneAgenda';
import { localInputsToUtcIso, parseUtcIso, splitLocalDateTime, localToday, localDateFromNow, formatCountdown, formatAgendaDateTime, viewerTimezoneLabel } from '../../utils/datetime';
import AgendaCountdown from '../../components/shared/AgendaCountdown';
import FichaLeadModal from '../../components/ficha/FichaLeadModal';
import { telefonoLegible } from '../../components/ficha/FichaHeader';
import ClienteNuevoVenta from './components/ClienteNuevoVenta';
import DiaDelReporte, { etiquetaDia } from './components/DiaDelReporte';
import { agendaParaVender, ejecutarAccion, mensajeDeError } from '../../components/ficha/fichaApi';
import { ayudaDeResultado } from '../../utils/estadosAgenda';

const ORDINALES = ['primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'];

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Las secciones del dock que son pestañas del mazo (`?step=`); el resto son vistas de la página.
const PASOS_DEL_MAZO = ['confirmations', 'calls', 'seguimientos'];

// La insignia "hecho/total" de una pestaña del mazo en el dock, apagada cuando ya no queda nada.
const cuentaDelDock = (hechas, total, nadaPendiente, que) => ({
    tipo: 'cuenta', texto: `${hechas}/${total}`, titulo: `${hechas} de ${total} ${que}`, apagada: nadaPendiente,
});




// Deriva el confirm_status (result) de 3 valores que ya entiende el resto del pipeline
// (Kanban/heroLead/reportes) a partir de la etapa granular del wizard — 'por_contactar' sigue
// siendo "por_confirmar"; cualquier etapa intermedia ya es "conversando"; "Confirmado" solo lo
// pone la acción explícita "Listo · 100% confirmado", nunca con solo llegar a Testimonio.
const stageToConfirmStatus = (stageKey) => (stageKey === 'por_contactar' ? 'por_confirmar' : 'conversando');

// Las tres columnas del tablero de Confirmar, en el orden de la ficha. `fase` es la que ya
// entiende `renderKanbanCard` (color de la tarjeta y su botón); `columna`, su lugar en la fila de
// entrada.
const ETAPAS_DEL_TABLERO = [
    { clave: 'por_contactar', titulo: 'Por contactar', lista: 'porContactar', fase: 'por_confirmar', clase: 'k1-v6', columna: 0, vacio: '✓ Ninguno sin tocar' },
    { clave: 'contactado', titulo: 'Contactado', lista: 'contactado', fase: 'conversando', clase: 'k2-v6', columna: 1, vacio: '✓ Nadie esperando confirmar' },
    { clave: 'confirmado', titulo: 'Confirmado', lista: 'confirmado', fase: 'confirmado', clase: 'k3-v6', columna: 2, vacio: 'Sin leads confirmados.' },
];
// La inversión del formulario en pocas palabras, para la tarjeta: «Entre $200 y $500 USD.» →
// «$200–500 USD», «Más de 1000 USD» → «+$1.000 USD» y cualquier forma de «no puedo» → «Sin
// inversión» (pedido del 23/10/2026). El texto completo queda en el `title`.
const milesAr = (n) => Number(n).toLocaleString('es-AR');
const inversionCorta = (txt) => {
    const t = String(txt || '').trim().replace(/\.$/, '');
    if (/\b(no\s+(puedo|estoy|tengo|cuento|dispongo)|ninguna|nada|sin\s+(inversi|presupuesto|dinero))/i.test(t)) return { texto: 'Sin inversión', sin: true };
    const nums = (t.match(/\d[\d.,]*/g) || []).map(x => Number(x.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'))).filter(n => n > 0);
    const usd = /usd|d[oó]lar/i.test(t) ? ' USD' : '';
    if (nums.length >= 2) return { texto: `$${milesAr(nums[0])}–${milesAr(nums[1])}${usd}` };
    if (nums.length === 1) {
        const signo = /m[aá]s\s+de|desde|\+/i.test(t) ? '+' : /menos\s+de|hasta/i.test(t) ? '<' : '';
        return { texto: `${signo}$${milesAr(nums[0])}${usd}` };
    }
    return { texto: t.length > 22 ? `${t.slice(0, 21)}…` : t };
};

// Si decide solo o necesita a alguien más, sacado del formulario: la pregunta que habla de
// decidir, de acompañamiento o de quién paga. Sin una pregunta así, no se muestra nada.
const decisionDe = (a) => {
    const fd = a.form_data && typeof a.form_data === 'object' ? a.form_data : {};
    const clave = Object.keys(fd).find(k => /decisi|decid|acompa|qui[eé]n\s+(paga|financ|apoya)|apoyo/i.test(k));
    const v = clave ? String(fd[clave] ?? '').trim() : '';
    if (!v) return null;
    if (/pareja|familia|padre|madre|espos|consult|acompa|otra persona|alguien|junto|no\b/i.test(v)) {
        return { texto: 'No decisor', solo: false, title: v };
    }
    if (/yo\b|solo|sola|m[ií] mism|por mi cuenta|s[ií]\b/i.test(v)) return { texto: 'Decisor', solo: true, title: v };
    return { texto: v.length > 20 ? `${v.slice(0, 19)}…` : v, solo: null, title: v };
};

// Color del segmento en la tarjeta: A y B son los que más importan, C y D los que se pueden desplazar.
const TONO_SEGMENTO = { A: 'var(--cl-success)', B: 'var(--cl-info)', C: 'var(--cl-warning)', D: 'var(--cl-magenta)' };
const fmtPuntos = (n) => (Number(n) > 0 ? '+' : '') + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 1 });
const ETAPA_DE_FASE = Object.fromEntries(ETAPAS_DEL_TABLERO.map(e => [e.fase, e.clave]));

// En qué etapa está una cita, con la misma regla que la pestaña Confirmación de la ficha
// (`ficha_lead_service._confirmacion`): Confirmado solo si `result` lo dice; si no, la etapa
// guardada, donde vacía es Por contactar y cualquier otra (las viejas incluidas) es Contactado.
const etapaDeConfirmacion = (a) => {
    if ((a.result || '').trim().toLowerCase() === 'confirmado') return 'confirmado';
    const etapa = a.confirmation_stage || 'por_contactar';
    return etapa === 'por_contactar' ? 'por_contactar' : 'contactado';
};

// Qué llamada es cada cita (`tipo_llamada` del backend, `manual.tipo_de_llamada`): la franja de la
// tarjeta lo dice y las métricas de Confirmar y Reportar lo separan (24/10/2026).
const TIPOS_DE_LLAMADA = [
    { tipo: 'primera', lbl: '1ª llamada' },
    { tipo: 'segunda', lbl: '2ª llamada' },
    { tipo: 'momentum', lbl: 'Momentum' },
];
const rotuloDeLlamada = (a) => TIPOS_DE_LLAMADA.find(t => t.tipo === a.tipo_llamada)?.lbl || 'Llamada';
// Una línea por tipo con lo que `contar` diga de sus citas; nada si todas son primeras llamadas.
const partesPorTipo = (citas, contar) => {
    if (!(citas || []).some(a => a.tipo_llamada && a.tipo_llamada !== 'primera')) return [];
    return TIPOS_DE_LLAMADA.map(t => {
        const lista = citas.filter(a => (a.tipo_llamada || 'primera') === t.tipo);
        const texto = lista.length ? contar(lista).filter(Boolean).join(' · ') : '';
        return texto ? { ...t, texto } : null;
    }).filter(Boolean);
};


// Puntos de experiencia de un día a partir de su actividad (ver `dailyXp` en el componente).
const xpDelDia = (actividad) => {
    if (!actividad) return 0;
    return (
        (actividad.confirmados_hoy || 0) * 10 +
        (actividad.confirmados_proximos || 0) * 5 +
        (actividad.show_ups || 0) * 20 +
        (actividad.seguimientos_hechos || 0) * 8 +
        (actividad.referidos_capturados || 0) * 15 +
        (actividad.ventas_count || 0) * 100
    );
};

// Fecha corta legible para las fichas de lead (fecha de agendamiento / fecha de ingreso).
const formatIdcardDate = (iso) => {
    if (!iso) return null;
    const d = parseUtcIso(iso) || new Date(iso);
    if (!d || isNaN(d.getTime())) return null;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};



const CloserWorkflowPage = () => {
    const { user, logout } = useAuth();
    const { pendingCount, openPlaybook } = usePlaybook();
    const [searchParams, setSearchParams] = useSearchParams();
    // El triage trabaja en esta misma vista con sus agendas: confirma, reporta (con su propio
    // resultado en la ficha) y sigue. No cierra el día, no tiene cartera ni comisión: en su lugar,
    // «Métricas» con el embudo de sus llamadas.
    const esTriage = user?.role === 'triage';

    const activeStep = searchParams.get('step') || 'confirmations';

    // «Declarar venta» del dock (antes la página /closer/sales/new) llega con `?venta=1`: el closer
    // elige al cliente en el buscador y la ficha se abre en «Registrar una venta». El parámetro se
    // saca de la URL al leerlo, para que recargar no vuelva a pedir a quién se le vendió.
    const pideVenta = searchParams.get('venta') === '1';
    const [paraVender, setParaVender] = useState(pideVenta);
    if (pideVenta && !paraVender) setParaVender(true);
    const buscadorRef = useRef(null);
    // «¿No está? Registrar cliente nuevo»: `{busqueda}` con lo que se había buscado, o null.
    const [clienteNuevo, setClienteNuevo] = useState(null);
    useEffect(() => {
        if (!pideVenta) return;
        const sinVenta = new URLSearchParams(searchParams);
        sinVenta.delete('venta');
        setSearchParams(sinVenta, { replace: true });
    }, [pideVenta, searchParams, setSearchParams]);
    useEffect(() => {
        if (paraVender) buscadorRef.current?.focus();
    }, [paraVender]);

    // Atajo 'w' para Simular a alguien (sesion/Simular.jsx). CloserWorkflowPage corre fuera de
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
                abrirSimulacion();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Tick grueso (30s) para lo que depende del paso del tiempo pero NO necesita precisión de
    // segundo: el color de urgencia de las tarjetas y el badge del hero. El número que se mueve
    // segundo a segundo lo maneja `<AgendaCountdown/>` con su propio reloj, para no re-renderizar
    // este componente (5.000 líneas) una vez por segundo.
    const [nowTick, setNowTick] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNowTick(Date.now()), 30000);
        return () => clearInterval(id);
    }, []);

    // Vista activa v6: 'inbox' (bandeja) o 'report' (reporte del día).
    const [activeView, setActiveView] = useState('inbox');
    // Configuración es la de todos (sesion/ConfiguracionContext.jsx): una hoja encima del mazo. Al
    // cerrarla se vuelve a mirar si faltan Calendar o WhatsApp.
    const { abierta: configAbierta, abrir: abrirConfiguracion } = useConfiguracion();
    // Google Calendar conectado y WhatsApp confirmado (null mientras no se sabe): sin ellos, el closer
    // no recibe agendas del sistema nuevo, así que «Configuración» lleva un aviso en el menú de sesión.
    const [calendarConectado, setCalendarConectado] = useState(null);
    const [whatsappConfirmado, setWhatsappConfirmado] = useState(null);
    useEffect(() => {
        let vivo = true;
        api.get('/google/calendars', { params: { solo_estado: 1 }, skipBugReport: true })
            .then(res => { if (vivo) setCalendarConectado(!!res.data?.connected); })
            .catch(() => {});
        api.get('/auth/me/whatsapp', { skipBugReport: true })
            .then(res => { if (vivo) setWhatsappConfirmado(!!res.data?.confirmado); })
            .catch(() => {});
        return () => { vivo = false; };
    }, [activeView, configAbierta]);
    const faltaConfigurar = [calendarConectado === false && 'Google Calendar sin conectar', whatsappConfirmado === false && 'WhatsApp sin confirmar'].filter(Boolean);
    // Pestaña temporal "Auditoría" — solo visible mientras Operaciones la tenga activada
    // (ver LeadsAuditTogglePanel.jsx y GET /closer/leads-audit/status).
    const [auditEnabled, setAuditEnabled] = useState(false);
    useEffect(() => {
        if (esTriage) return;
        api.get('/closer/leads-audit/status')
            .then(res => setAuditEnabled(!!res.data?.enabled))
            .catch(() => setAuditEnabled(false));
    }, [esTriage]);
    const [reportSent, setReportSent] = useState(false);
    const [sendingReport, setSendingReport] = useState(false);
    const [reportSentAt, setReportSentAt] = useState(null);
    const [loadingReportStatus, setLoadingReportStatus] = useState(false);
    // Estado de HOY específicamente (independiente del día que se esté viendo en el selector de
    // arriba) — es lo que pone el "✓" de «Cerrar el día» en el dock, que siempre habla de hoy.
    const [todayReportSent, setTodayReportSent] = useState(false);
    // "Hoy" y "ayer" del closer según el backend (`today`/`yesterday` de GET /closer/deck/daily-report),
    // no según el reloj del navegador: un admin simulando a un closer de otro país tiene otro "hoy"
    // cerca de la medianoche. Mientras no llegan, se usa el del navegador.
    const [diasReporte, setDiasReporte] = useState(null);
    const hoyReporte = diasReporte?.hoy || localToday();
    const ayerReporte = diasReporte?.ayer || localDateFromNow(-1);
    // Día que se está reportando: hoy (por defecto) o ayer, nada más (ver DiaDelReporte y
    // `_dia_reportable` en el backend) — para que el closer que se fue sin cerrar el día lo pueda
    // mandar a la mañana siguiente. `null` = hoy: así el pedido va SIN fecha y el backend decide
    // cuál es hoy, y una pestaña que queda abierta pasada la medianoche sigue en el día nuevo.
    const [diaElegido, setDiaElegido] = useState(null);
    const reportDate = diaElegido || hoyReporte;
    const reportandoHoy = !diaElegido || diaElegido === hoyReporte;
    const elegirDiaDelReporte = useCallback((fecha) => {
        setDiaElegido(fecha === hoyReporte ? null : fecha);
    }, [hoyReporte]);
    // Si ayer quedó sin reportar (`yesterday` del mismo GET): aviso en «Cerrar el día» y punto en el dock.
    const [estadoDeAyer, setEstadoDeAyer] = useState(null);
    const leerDiasReporte = useCallback((d) => {
        if (!d?.today || !d.yesterday) return;
        setDiasReporte(prev => (prev?.hoy === d.today && prev?.ayer === d.yesterday.date
            ? prev : { hoy: d.today, ayer: d.yesterday.date }));
        setEstadoDeAyer(d.yesterday);
    }, []);
    // Un 400 del reporte trae el hoy/ayer del closer: si el día elegido quedó fuera de la ventana
    // (pestaña abierta desde anteayer), se vuelve a hoy.
    const resincronizarDia = useCallback((err) => {
        const d = err?.response?.data;
        if (err?.response?.status !== 400 || !d?.today) return false;
        setDiasReporte({ hoy: d.today, ayer: d.yesterday });
        setDiaElegido(null);
        return true;
    }, []);

    // Estado del reporte v6
    const [reflection, setReflection] = useState({ win: '', fix: '' });
    // Único número del reporte que el sistema no puede calcular solo (no existe ninguna señal
    // persistida de "slots disponibles configurados" ese día) — se pide a mano, todo lo demás
    // sale de la Bandeja.
    const [reportSlots, setReportSlots] = useState('');
    // Resumen en vivo de lo que el closer tocó HOY (Conversando/Confirmados/Show ups/
    // Reagendas/Seguimientos/Referidos) — reemplaza los inputs manuales de referidos: todo sale
    // de CloserService.get_daily_activity_summary. Alimenta "Tu día" y el dock.
    const [dailyActivity, setDailyActivity] = useState(null);
    // Lo mismo, pero del día que se está cerrando en «Cerrar el día» (hoy o ayer). Va aparte para
    // que elegir Ayer no le cambie los números a "Tu día", que siempre habla de hoy.
    const [reportActivity, setReportActivity] = useState(null);
    // Puntos de experiencia del día: se usa tanto en "Tu día" (arriba de todo) como en el
    // Resumen del Reporte del día — una sola fórmula (`xpDelDia`) para que no se
    // desincronicen. Pesos documentados en detalle donde se usa por primera vez, más abajo.
    const dailyXp = useMemo(() => xpDelDia(dailyActivity), [dailyActivity]);
    const reportXp = useMemo(() => xpDelDia(reportActivity), [reportActivity]);
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
    // Aviso en vivo si los slots escritos no llegan a las agendas del día: un cupo agendado
    // sigue siendo un cupo, así que ese número es imposible (venía pasando en reportes reales).
    const slotsPorDebajoDeAgendas = (
        reportSlots.trim() !== '' &&
        reportActivity?.agendas_del_dia !== undefined &&
        Number(reportSlots) < reportActivity.agendas_del_dia
    );

    // Consultar si el día elegido ya tiene un reporte enviado (y precargar lo que ya se había
    // escrito) cada vez que se entra a la pestaña de reporte, se cambia el día a reportar, o se
    // pide un refresh manual (botón "Actualizar" del resumen, tras corregir algo en la bandeja).
    useEffect(() => {
        if (activeView !== 'report') return;
        setLoadingReportStatus(true);
        api.get('/closer/deck/daily-report', { params: diaElegido ? { date: diaElegido } : {} })
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
                setReportActivity(d.activity || null);
                setPendingPreviousDays(d.pending_previous_days || null);
                setBacklogBlocksReport(!!d.backlog_blocks_report);
                leerDiasReporte(d);
                if (d.date === d.today) {
                    setTodayReportSent(!!d.sent);
                    setDailyActivity(d.activity || null);
                }
            })
            .catch(err => {
                if (!resincronizarDia(err)) console.error('Error al consultar el estado del reporte:', err);
            })
            .finally(() => setLoadingReportStatus(false));
    }, [activeView, diaElegido, reportStatusRefreshKey, leerDiasReporte, resincronizarDia]);

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
    // A quién seguir primero (cobros -> hot -> fríos), reportado por SeguimientosPane — ver su
    // prop `onTopPending`. `undefined` = todavía no se sabe (recién montado/cargando), `null` =
    // no hay nadie a quien seguir, objeto = { item, tipo, source, payload }.
    const [seguimientoHero, setSeguimientoHero] = useState(undefined);

    // Chequeo silencioso del estado de hoy al cargar el mazo, sin depender de que el closer
    // entre a la pestaña de reporte — la tarjeta "Tu día" necesita `activity` (trabajo real de
    // hoy, no solo lo que trajo la pestaña activa) desde el arranque, y se vuelve a pedir cada
    // vez que `seguimientosRefreshKey` sube (esa señal ya se dispara después de cualquier acción
    // que modifica el mazo, así que "Tu día" queda al día sin agregar otro punto de recarga).
    // Sin `date`: el backend contesta por el "hoy" del closer, y de paso dice si ayer quedó sin
    // reportar (el punto de «Cerrar el día» en el dock tiene que verse sin entrar a esa pestaña).
    useEffect(() => {
        api.get('/closer/deck/daily-report')
            .then(res => {
                setTodayReportSent(!!res.data?.sent);
                setDailyActivity(res.data?.activity || null);
                leerDiasReporte(res.data);
            })
            .catch(() => {});
    }, [seguimientosRefreshKey, leerDiasReporte]);

    const [unreadNoAgenda, setUnreadNoAgenda] = useState([]);
    const [loading, setLoading] = useState(true);
    // De qué pestaña y qué día son las agendas que el kanban tiene dibujadas. El esqueleto sólo
    // tiene sentido cuando todavía no hay nada que mostrar —la primera carga, o cambiar de pestaña
    // o de día—; en la recarga que sigue a una acción (confirmar, reportar, crear una agenda…) la
    // lista se reemplaza en silencio. Si no, cada acción borraba el tablero entero y lo volvía a
    // hacer entrar tarjeta por tarjeta. Mismo criterio que `loadedDateRef` en SeguimientosPane.
    const mazoCargadoRef = useRef(null);
    // Las tarjetas entran escalonadas sólo en la tanda que reemplaza al esqueleto (ver
    // `useVentanaDeEntrada`). Una que cambia de columna por una acción —la recarga silenciosa de
    // arriba— entra enseguida, en vez de quedarse invisible esperando su turno con el resto quieto.
    const [tableroEntrando, abrirEntradaDelTablero] = useVentanaDeEntrada();
    const [processingId, setProcessingId] = useState(null);
    // Llamadas de hoy YA reportadas (para la columna "Reportadas" del Kanban de ② Reportar).
    // `step=calls` del mazo excluye por diseño lo ya procesado (closer_processed=true) — no hay
    // forma de pedirlo por ahí. `step=agendas` sí trae todo lo del día sin filtrar por estado,
    // así que se filtra acá del lado del cliente.
    const [reportedTodayCalls, setReportedTodayCalls] = useState([]);

    // Contadores de pestañas (v6)
    const [counts, setCounts] = useState({ confirmations: 0, calls: 0, seguimientos: 0 });
    // Si `counts` ya vino del servidor alguna vez. Los ceros de arriba son el valor inicial, no un
    // "no hay nada": hasta que llegan, "Tu siguiente paso" va en hueso (ver EsqueletoSiguientePaso).
    const [countsCargados, setCountsCargados] = useState(false);

    // "Quiero procrastinar" (v7): calculadora de "esto vale la pena antes de irte a scrollear",
    // a pedido del usuario (27/ago/2026). Es una simulación editable, no un reporte de datos
    // reales — no hay una tasa "de verdad" de respuesta/cierre de seguimientos disponible acá
    // sin pegarle a otro endpoint, así que arranca con valores por defecto razonables y el closer
    // los ajusta con los sliders.
    const [showProcrastinar, setShowProcrastinar] = useState(false);

    // Celebraciones de hitos en el pipeline de confirmaciones (v7)
    const [celebration, setCelebration] = useState(null);

    // Plan de cuotas del lead (seguimiento de cobro - cliente ya cerrado)
    const [cuotasPlan, setCuotasPlan] = useState([]);
    const [loadingCuotas, setLoadingCuotas] = useState(false);

    // Búsqueda global (v6)
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [searching, setSearching] = useState(false);
    // Mientras se averigua en qué etapa está el lead que se tocó en los resultados (ver
    // handleSelectSearchResult). El desplegable ya se cerró, así que el aviso va en el buscador.
    const [resolviendoLead, setResolviendoLead] = useState(false);
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
    // El lead ya tiene una agenda abierta: se pregunta si se reprograma o se suma otra (como Thalamus).
    const [yaTieneAgenda, setYaTieneAgenda] = useState(null);
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
                // Sin filtro por fase: el buscador busca en TODO. Tenia un selector de
                // alcance (Confirmaciones / Llamadas / Seguimientos / Resueltos) que ocupaba
                // 126px fijos en el header y empujaba el resto de los botones fuera de la
                // linea. Cada resultado ya trae su fase como etiqueta de color, que es lo que
                // se venia a buscar: en que anda ese lead. Lo saco el usuario.
                setSearchResults(res.data || []);
                setShowSearchResults(true);
            } catch (err) {
                console.error("Error al buscar leads:", err);
            } finally {
                setSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

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

        if (paraVender) {
            abrirParaVender(lead);
            return;
        }

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

        // Estado propio y no `loading`: `loading` es la carga del mazo, y con él el kanban se
        // cambiaba por su esqueleto ("Cargando confirmaciones…") mientras se resolvía la etapa de
        // un lead, aunque el tablero no estuviera cargando nada; al volver, todas las tarjetas
        // entraban de nuevo una por una. La espera se nota en el buscador, que es donde se tocó.
        setResolviendoLead(true);
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
                    person_uuid: stage.person_uuid || null,
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
                    etapa_cobro: stage.etapa_cobro,
                    fase: 'seg',
                    tipo: 'cerrada'
                });
            } else if (stage.stage === 'call') {
                handleSelectLead({ id: stage.appointment_id, fase: 'call' });
            } else {
                // Sin agenda activa: la ficha del cliente, abierta en su Historial. Era un modal
                // de historial aparte, con su propio «Registrar venta / pago» que abría OTRO
                // modal; en la ficha la venta es «Registrar una venta» de Resultado y el cobro,
                // «Registrar pago» de Acciones. El id negativo hace que la ficha se pida por
                // cliente: el backend elige su agenda más reciente.
                handleSelectLead({ id: -lead.id, client_id: lead.id, person_uuid: lead.person_uuid || null, fase: 'hist' });
            }
        } catch (err) {
            console.error("Error al resolver la etapa del lead:", err);
            toast.error("Error al abrir el lead");
        } finally {
            setResolviendoLead(false);
        }
    };

    // La ficha del cliente elegido, lista para vender: en la agenda que devuelve el backend (la
    // suya más reciente o, si no tenía ninguna, una creada para la venta), en «Registrar una venta».
    const abrirParaVender = async (lead) => {
        if (!lead.id) {
            toast.error('Este lead todavía no tiene ficha: no hay dónde registrarle la venta.');
            return;
        }
        setResolviendoLead(true);
        try {
            const { appointment_id: agenda } = await agendaParaVender(lead.id);
            setParaVender(false);
            handleSelectLead({ id: agenda, fase: 'venta' });
        } catch (err) {
            console.error('Error al abrir la ficha para la venta:', err);
            toast.error(mensajeDeError(err));
        } finally {
            setResolviendoLead(false);
        }
    };

    // Crear Nueva Agenda (Modal v7)
    const handleCreateAgenda = async (siYaTiene = null) => {
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
                },
                ...(siYaTiene ? { si_ya_tiene: siYaTiene } : {})
            };
            const { data } = await api.post('/closer/appointments', payload);
            if (data?.con_evento === false) {
                toast.error("Agenda creada, pero sin evento en tu Google Calendar: creálo a mano con Meet e invitá al lead.");
            } else {
                toast.success("Agenda creada: el lead recibe la invitación con el Meet");
            }
            setYaTieneAgenda(null);
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
            if (err.response?.data?.codigo === 'ya_tiene') {
                setYaTieneAgenda(err.response.data);
                return;
            }
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



    // Obtener contadores de las pestañas
    const fetchCounts = async () => {
        try {
            const countsRes = await api.get(`/closer/deck/counts?selected_date=${selectedDate}`);
            setCounts(countsRes.data || { confirmations: 0, calls: 0, seguimientos: 0 });
            setCountsCargados(true);
        } catch (err) {
            console.error("Error al obtener conteos de deck:", err);
        }
    };

    // Cargar agendas del día del closer.
    // `refreshSeguimientos`: la pestaña de seguimientos no se alimenta de `agendas` sino de sus
    // propios endpoints (/closer/followups/*), así que cualquier acción que recargue el mazo debe
    // avisarle para que un seguimiento recién resuelto desaparezca sin recargar la página. Se
    // apaga solo en la carga por cambio de pestaña/día, donde el panel ya se monta pidiendo datos.
    // Solo la última carga escribe (24/10/2026): con dos en vuelo —la de la pestaña y la que dispara
    // agendar una 2da llamada— la más lenta llegaba después y dejaba el tablero sin la cita nueva
    // hasta recargar la página varias veces.
    const pedidoMazoRef = useRef(0);
    const fetchAgendas = async ({ refreshSeguimientos = true, conservarFicha = false } = {}) => {
        const pedido = ++pedidoMazoRef.current;
        const vigente = () => pedido === pedidoMazoRef.current;
        const clave = `${activeStep}|${selectedDate}`;
        const conEsqueleto = mazoCargadoRef.current !== clave;
        if (conEsqueleto) setLoading(true);
        try {
            const url = `/closer/deck?step=${activeStep}&selected_date=${selectedDate}`;
            const res = await api.get(url);
            if (!vigente()) return;
            const dataList = res.data || [];
            setAgendas(dataList);

            // Llamadas del día seleccionado ya reportadas, solo relevante en la pestaña de
            // Llamadas (columna "Reportadas" del Kanban) — ver el estado `reportedTodayCalls`
            // para el porqué de la consulta aparte.
            if (activeStep === 'calls') {
                try {
                    const allDayRes = await api.get(`/closer/deck?step=agendas&selected_date=${selectedDate}`);
                    if (!vigente()) return;
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
            if (!conservarFicha && selectedLead && !dataList.some(l => l.id === selectedLead.id) && !unreadNoAgenda.some(l => l.id === selectedLead.id)) {
                setSelectedLead(null);
            }

            // Actualizar contadores
            await fetchCounts();
        } catch (err) {
            if (!vigente()) return;
            console.error("Error al cargar agendas:", err);
            toast.error("Error al cargar las agendas");
        } finally {
            // Una carga que quedó vieja no toca el mazo: la que la reemplazó cierra el esqueleto.
            if (vigente()) {
                mazoCargadoRef.current = clave;
                setLoading(false);
                // En el mismo render que saca el esqueleto: las tarjetas que se montan ahí son la tanda.
                if (conEsqueleto) abrirEntradaDelTablero();
            }
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
        } else if (actionType === 'conversando_no_show') {
            // Lead que nunca pasó de "Conversando": la hora de la llamada ya pasó sin
            // confirmación. Se manda por /deck (no /appointments/.../process) y solo con
            // `result` (closer_result) — sin tocar `confirm_status` — para que el estado de
            // confirmación quede tal cual estaba (nunca llega a "Confirmado").
            setProcessingId(apptId);
            try {
                await api.post(`/closer/deck/${apptId}`, {
                    result: 'No Show',
                    closer_notes: note || sessionForm.notes || 'No show: nunca confirmó antes de la hora de la llamada'
                });
                toast.success("Marcado como No Show");
                if (selectedLead?.id === apptId) setSelectedLead(null);
                fetchAgendas();
            } catch (err) {
                console.error(err);
                toast.error("Error al marcar como No Show");
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
            showRefsStep: false,
        });

        // 2. Determinar paso inicial del árbol por contexto. `lead.fase`, cuando viene
        // explícito (ej. desde la búsqueda global, que ya resolvió la etapa real del lead en
        // el backend — ver handleSelectSearchResult), manda sobre `activeStep` (la pestaña que
        // esté abierta en ese momento no debería reinterpretar la etapa de un lead ajeno a
        // ella). `activeStep` solo se usa como respaldo cuando `lead.fase` no viene seteado
        // (tarjetas del mazo, que dependen de la pestaña donde viven).
        if (lead.fase === 'confirm' || (lead.fase === undefined && activeStep === 'confirmations')) {
            // v8: un lead ya "Confirmado" también abre acá (antes saltaba directo al reporte de
            // llamada) — el wizard es ahora la vista durable de todo el pipeline de confirmación,
            // con la etapa completa y el panel de éxito ya armados; "reportar la llamada" sigue
            // viviendo aparte, en la pestaña Reportar, para cuando la hora de la cita ya pasó.
            setModalStep('confirm');
            setModalFlowLabel('Proceso de confirmación');
        } else if (lead.fase === 'seg' || (lead.fase === undefined && activeStep === 'seguimientos')) {
            setModalStep(lead.tipo === 'cerrada' ? 'segventa' : 'seg');
            setModalFlowLabel('Seguimiento');
        } else if (lead.fase === 'hist') {
            setModalStep('hist');
            setModalFlowLabel('Historial');
        } else if (lead.fase === 'venta') {
            setModalStep('venta');
            setModalFlowLabel('Venta');
        } else {
            setModalStep('root');
            setModalFlowLabel('Reporte de llamada');
        }

        setAgendas(prev => prev.map(item => item.id === lead.id ? { ...item, unread_comment: false } : item));
        setUnreadNoAgenda(prev => prev.map(item => item.id === lead.id ? { ...item, unread_comment: false } : item));

    };

    // Con que pestaña abre la ficha. El mazo ya sabe a que vino el closer por la columna desde
    // la que abrio, y eso gana sobre "donde el backend cree que hay trabajo": alguien que esta
    // confirmando no quiere caer en Resultado. Un seguimiento abre en Resultado, reportandolo:
    // `seg` es la cadencia de un lead que no compro y `segventa` el cobro de un cliente, con las
    // preguntas del mazo de main («¿Que paso con el cobro?»). Antes el cobro caia en Acciones,
    // que registra un pago o agenda otro seguimiento pero no reporta el que se acaba de hacer.
    // `hist` es un cliente sin agenda activa buscado desde el buscador. `venta` viene de
    // «Declarar venta» y abre en Resultado, en la venta.
    const pestanaDeLaFicha = modalStep === 'confirm' ? 'conf'
        : modalStep === 'hist' ? 'hist'
            : 'resultado';
    const seguimientoDeLaFicha = modalStep === 'segventa' ? 'cobro'
        : modalStep === 'seg' ? 'contacto'
            : null;

    // Cada escritura de la ficha puede mover el mazo: un lead reportado sale de la columna de
    // llamadas, uno confirmado cambia de carril. Se recarga la lista y, si el lead se borro, se
    // cierra la ficha en vez de recargar algo que ya no existe.
    const alCambiarLaFicha = (accion) => {
        if (accion === 'eliminar') {
            setSelectedLead(null);
            fetchAgendas();
            return;
        }
        // Al recargar, el mazo cierra el lead que ya no está en la columna abierta: era la regla
        // del modal viejo. Con la ficha no: se trabaja adentro y se cierra cuando se terminó. Una
        // venta o un reporte sacan al lead de la columna, y una ficha abierta desde el buscador
        // (un cliente de «Mi cartera», uno sin agenda activa) casi nunca estaba en ella: corregir
        // un pago en su historial la cerraba en la cara del closer.
        fetchAgendas({ conservarFicha: true });
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

    // Pipeline Kanban de confirmaciones: las tres etapas de la ficha (Por contactar · Contactado ·
    // Confirmado, 23/10/2026), una por columna. Se agrupa con la misma regla que la pestaña
    // Confirmación de la ficha (`ficha_lead_service._confirmacion`), para que el tablero y el
    // detalle digan siempre lo mismo: Confirmado = `result` confirmado; si no, la etapa guardada
    // (`confirmation_stage`, vacía = Por contactar; las viejas Horario/VideoAsk/Testimonio se leen
    // como Contactado).
    const confirmationsPipeline = useMemo(() => {
        const porContactar = [];
        const contactado = [];
        const confirmado = [];
        (filteredAgendas || []).forEach(a => {
            const etapa = etapaDeConfirmacion(a);
            if (etapa === 'confirmado') confirmado.push(a);
            else if (etapa === 'contactado') contactado.push(a);
            else porContactar.push(a);
        });
        return { porContactar, contactado, confirmado };
    }, [filteredAgendas]);

    // Arrastrar un lead a otra columna cambia su etapa de verdad, con las mismas acciones que usa
    // la ficha (`PATCH /ficha/<id>/confirmacion`). Pasar a Confirmado es «Listo · 100%
    // confirmado»; sacarlo de Confirmado es «Deshacer» (vuelve a Contactado) y, si va a Por
    // contactar, además se baja la etapa. La tarjeta se mueve al instante y, si el guardado falla,
    // vuelve a su columna.
    const [arrastrando, setArrastrando] = useState(null); // { id, desde }
    const [columnaDestino, setColumnaDestino] = useState(null);
    const moverDeEtapa = async (leadId, destino) => {
        const lead = agendas.find(a => a.id === leadId);
        if (!lead || leadId <= 0) return;
        const desde = etapaDeConfirmacion(lead);
        if (desde === destino) return;
        const antes = { result: lead.result, confirmation_stage: lead.confirmation_stage };
        const despues = destino === 'confirmado'
            ? { result: 'Confirmado', confirmation_stage: 'confirmado' }
            : { result: destino === 'por_contactar' ? 'por_confirmar' : 'conversando', confirmation_stage: destino };
        const aplicar = (campos) => setAgendas(prev => prev.map(a => a.id === leadId ? { ...a, ...campos } : a));
        aplicar(despues);
        try {
            if (destino === 'confirmado') {
                await ejecutarAccion('cerrar_confirmacion', leadId);
            } else {
                if (desde === 'confirmado') await ejecutarAccion('etapa_confirmacion', leadId, { cerrada: false });
                if (destino === 'por_contactar' || desde !== 'confirmado') {
                    await ejecutarAccion('etapa_confirmacion', leadId, { etapa: destino });
                }
            }
            toast.success(`${lead.lead_name || 'Lead'} · ${ETAPAS_DEL_TABLERO.find(e => e.clave === destino)?.titulo}`);
        } catch (err) {
            aplicar(antes);
            toast.error(mensajeDeError(err) || 'No se pudo cambiar la etapa');
        } finally {
            fetchAgendas({ refreshSeguimientos: false, conservarFicha: true });
        }
    };

    // "Tu siguiente paso": el lead más urgente dentro de la pestaña activa, para no tener que
    // escanear toda la bandeja buscando qué tocar primero. Se arma con los mismos datos que ya
    // trajo esa pestaña (sin pegarle de nuevo a la API); por eso solo aplica a 'confirmations' y
    // 'calls' -las dos que manejan su lista acá- y no a 'seguimientos', que vive aparte en
    // SeguimientosPane y no expone sus datos a este nivel.
    const heroLead = useMemo(() => {
        if (activeView !== 'inbox') return null;
        let pool;
        if (activeStep === 'confirmations') {
            pool = [...confirmationsPipeline.porContactar, ...confirmationsPipeline.contactado];
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
    //
    // "Atrasadas" es SOLO lo de un día anterior al seleccionado. Antes era "todo lo que no es del
    // día seleccionado", y una llamada de mañana temprano —que el backend trae porque cae en el día
    // del closer, en su zona— aparecía como atrasada diciendo "En 6 h" (02/10/2026). Lo que no es
    // de un día anterior va a "Hoy": todavía está por tomar.
    const callsPipeline = useMemo(() => {
        const atrasadas = [];
        const hoy = [];
        (filteredAgendas || []).forEach(a => {
            const { date: apptDate } = splitLocalDateTime(a.start_time);
            if (apptDate && apptDate < selectedDate) atrasadas.push(a);
            else hoy.push(a);
        });
        return { atrasadas, hoy, reportadas: reportedTodayCalls };
    }, [filteredAgendas, selectedDate, reportedTodayCalls]);

    // Lo que el lead dijo que puede invertir en el formulario de calificación: la clave `inversion`
    // del formulario viejo (n8n) o, en uno de Agendas 2.0, la pregunta que habla de invertir. Un
    // número suelto se muestra como monto; un rango o un texto, tal cual.
    const inversionDe = (a) => {
        const fd = a.form_data && typeof a.form_data === 'object' ? a.form_data : {};
        let v = fd.inversion;
        if (!v) {
            const clave = Object.keys(fd).find(k => /invert|inversi|presupuesto/i.test(k));
            v = clave ? fd[clave] : null;
        }
        if (v == null || String(v).trim() === '') return null;
        const txt = String(v).trim();
        const n = Number(txt.replace(/[$\s,.]/g, ''));
        return /^\$?\s*[\d.,]+\s*(usd)?$/i.test(txt) && n > 0 ? `$${n.toLocaleString('es-AR')}` : txt;
    };

    // Renderizar una tarjeta individual del Kanban de confirmación (v6).
    // `orden` es su lugar en la fila de entrada: el renglón del tablero por la cantidad de
    // columnas, más la columna. Así entran de a una, de izquierda a derecha y de arriba abajo, con
    // el mismo escalón (`escalonDe`) que el esqueleto que ocupaba su lugar. Sólo mientras dura la
    // entrada del tablero (`tableroEntrando`): fuera de ella, la tarjeta que aparece entra ya.
    const renderKanbanCard = (a, phase, orden = 0) => {
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
        // cita, si es ahora mismo, o hace cuánto que pasó sin resolverse.
        const countdown = isPendingReferral ? null : formatCountdown(a.start_time, nowTick);

        // Recordatorio pre-llamada: vencido (rojo) si ya pasó y sigue sin contactarse,
        // hoy (ámbar) si es el día calendario local actual, oculto si es un día futuro.
        let reminderBadge = null;
        const reminderDate = parseUtcIso(a.pre_call_reminder_at);
        if (reminderDate) {
            const now = new Date();
            const { date: reminderDay, time: reminderTime } = splitLocalDateTime(a.pre_call_reminder_at);
            if (reminderDate <= now) {
                reminderBadge = { label: `Recordatorio vencido · ${reminderTime}`, tono: '#E85C4A' };
            } else if (reminderDay === todayStr) {
                reminderBadge = { label: `Recordatorio hoy ${reminderTime}`, tono: 'var(--cl-warning)' };
            }
        }

        // Franja viva (diseño «Tarjetas de lead · 5a»): la tarjeta abre con la hora de la llamada.
        // Sólo la que pide acción —la cita es ahora o ya pasó sin resolverse— se tiñe de ámbar y
        // lleva aura; las demás quedan quietas, en verde mientras falta, para que esa destaque. En
        // las etapas "ya resuelto" el atraso no bloquea nada y va en neutro.
        const DONE_PHASES = new Set(['confirmado', 'call_done']);
        const pideAccion = !!countdown && (countdown.kind === 'now' || (countdown.kind === 'past' && !DONE_PHASES.has(phase)));
        const tono = isPendingReferral ? 'var(--cl-lila)'
            : pideAccion ? 'var(--cl-warning)'
            : !countdown || countdown.kind === 'past' ? 'var(--cl-muted-40)'
            : 'var(--cl-success)';
        // Primera, segunda o Momentum (24/10/2026): se lee antes que la hora.
        const llamada = isPendingReferral ? 'Llamada' : rotuloDeLlamada(a);
        const rotuloFranja = isPendingReferral || !countdown || countdown.kind === 'now' ? llamada
            : countdown.kind === 'past' ? `${llamada} hace` : `${llamada} en`;
        // Cuánto falta para la cita, como riel de 24 h que se llena a medida que se acerca.
        const horasFaltan = a.start_time ? ((parseUtcIso(a.start_time)?.getTime() ?? Date.now()) - nowTick) / 3600000 : 0;
        const rielCita = isPendingReferral || !countdown ? 0
            : countdown.kind === 'future' || countdown.kind === 'soon' ? Math.round(Math.min(1, Math.max(0.04, 1 - horasFaltan / 24)) * 100)
            : 100;

        // Clarity: cada etapa tiñe la tarjeta con su color (`--c`).
        const TONO_ETAPA = { por_confirmar: 'var(--cl-warning)', conversando: 'var(--cl-info)', confirmado: 'var(--cl-success)', call: 'var(--cl-magenta)', call_done: 'var(--cl-success)' };
        const origen = a.origin || 'Meta Ads';
        const origenEsEvento = /workshop|webinar|evento|clase|masterclass/i.test(origen);
        const iniciales = (a.lead_name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
        const inversionTxt = inversionDe(a);
        const inversion = inversionTxt ? inversionCorta(inversionTxt) : null;
        const decision = decisionDe(a);
        const telefono = (a.phone || '').trim();
        const etiquetas = [
            a.desplazada && { texto: 'Reagendar: horario tomado', tono: 'var(--cl-warning)', title: 'Un lead A/B o una Momentum tomó este horario. La agenda sigue en pie: acordá otro con el lead.' },
            isPendingReferral && { texto: 'Contactar y acordar fecha', tono: 'var(--cl-lila)' },
            // El triage confirma los A y B de los closers (plan_segmentos_triage.md §8.5).
            esTriage && a.closer_id && a.closer_id !== user?.id
                && { texto: `${a.segmento || ''} de ${a.closer_name}`.trim(), tono: 'var(--cl-info)', title: 'Confirmala antes de su llamada con el closer' },
            // El segmento y sus puntos (la del triage ya lo dice en «A de <closer>»).
            a.segmento && !(esTriage && a.closer_id && a.closer_id !== user?.id)
                && { texto: a.segmento_puntos != null ? `${a.segmento} · ${fmtPuntos(a.segmento_puntos)} pts` : a.segmento, tono: TONO_SEGMENTO[a.segmento] || 'var(--cl-info)', title: 'Segmento del lead según su formulario' },
            a.examen && { texto: a.examen, tono: 'var(--cl-lila)' },
            (phase === 'call' || phase === 'call_done') && a.closer_result && a.closer_result !== 'Pendiente'
                && { texto: a.closer_result, tono: 'var(--cl-magenta)', title: ayudaDeResultado(a.closer_result) },
            reminderBadge && { texto: reminderBadge.label, tono: reminderBadge.tono },
        ].filter(Boolean);

        return (
            <div 
                key={a.id} 
                className={`kcard-v6 kcard-franja${pideAccion ? ' kcard-vivo' : ''} ${isViewed ? 'kc-visto border-pink-500/50 bg-pink-500/5 shadow-[0_0_15px_rgba(255,63,164,0.1)]' : ''}`}
                style={{ animationDelay: `${tableroEntrando ? escalonDe(orden) : 0}ms`, '--c': TONO_ETAPA[phase] || 'var(--cl-lila)', '--t': tono }}
                onClick={() => handleSelectLead(a)}
                {...(ETAPA_DE_FASE[phase] && a.id > 0 ? {
                    draggable: true,
                    'data-arrastrando': arrastrando?.id === a.id || undefined,
                    title: 'Arrastralo a otra columna para cambiar su etapa',
                    onDragStart: (e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(a.id));
                        setArrastrando({ id: a.id, desde: ETAPA_DE_FASE[phase] });
                    },
                    onDragEnd: () => { setArrastrando(null); setColumnaDestino(null); },
                } : {})}
            >
                {/* El aura toma sus colores de los datos del lead: la urgencia, el magenta de la
                    marca y la inversión (verde si dijo que puede invertir). */}
                {pideAccion && (
                    <span className="kc-aura" aria-hidden="true">
                        <i /><i /><i style={{ '--a': inversion && !inversion.sin ? 'var(--cl-success)' : 'var(--cl-warning)' }} />
                    </span>
                )}

                <div
                    className="kc-banda"
                    title={isPendingReferral ? undefined : `${formatAgendaDateTime(a.start_time)} (${viewerTimezoneLabel()}, tu zona horaria)`}
                >
                    <span className="kc-banda-lbl">
                        {pideAccion
                            ? <span className="kc-vivo" aria-hidden="true"></span>
                            : <svg className="kc-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></svg>}
                        {rotuloFranja}
                    </span>
                    <span className="kc-banda-t">
                        {isPendingReferral
                            ? 'Por agendar'
                            : <AgendaCountdown startTime={a.start_time} bare fallback={`${dateLabel} · ${apptTime}`} />}
                    </span>
                    {rielCita > 0 && (
                        <span className="kc-banda-riel" style={{ '--w': `${rielCita}%` }} aria-hidden="true">
                            {!pideAccion && countdown?.kind !== 'past' && <i />}
                        </span>
                    )}
                </div>

                <div className="kc-cuerpo">
                <div className="kc-top">
                <span className="kc-av" aria-hidden="true">{iniciales}</span>
                <div className="kc-id">
                <b className="kc-nombre">
                    <span className="kc-nombre-t" title={a.lead_name || 'Sin Nombre'}>{a.lead_name || 'Sin Nombre'}</span>
                    {a.unread_comment && (
                        <span className="kc-nuevo">Nuevo</span>
                    )}
                </b>
                {telefono && (
                    <div className="kc-tel">
                        <span className="kc-tel-n">{telefonoLegible(telefono)}</span>
                        <button type="button" className="kc-copiar" title="Copiar teléfono" aria-label="Copiar teléfono"
                            onClick={(e) => {
                                e.stopPropagation();
                                const btn = e.currentTarget;
                                navigator.clipboard?.writeText(telefono).then(() => {
                                    btn.dataset.ok = '1';
                                    setTimeout(() => { delete btn.dataset.ok; }, 1400);
                                    toast.success('Teléfono copiado');
                                }).catch(() => toast.error('No se pudo copiar'));
                            }}>
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="kc-copiar-i"><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" /></svg>
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="kc-copiar-ok"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                        </button>
                    </div>
                )}
                </div>
                </div>

                {/* Cada dato con su ícono, en una línea separada por filetes: inversión, decisión
                    y origen (un evento lleva calendario; una persona, su inicial). */}
                <div className="kc-datos">
                    {inversion && (
                        <span className={`kc-dato kc-plata${inversion.sin ? ' kc-plata--sin' : ''}`} title={`Inversión: ${inversionTxt}`}>
                            <span className="kc-dato-ic" aria-hidden="true">$</span>
                            <span className="kc-plata-n">{inversion.texto}</span>
                        </span>
                    )}
                    {decision && (
                        <span className={`kc-dato kc-decide${decision.solo === false ? ' kc-decide--con' : decision.solo ? '' : ' kc-decide--otro'}`} title={`Decisión: ${decision.title}`}>
                            <svg className="kc-ic" viewBox="0 0 24 24" aria-hidden="true">
                                {decision.solo === false
                                    ? <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14a5.5 5.5 0 0 1 3 5" /></>
                                    : <><circle cx="12" cy="8" r="3.4" /><path d="M6 19.5a6 6 0 0 1 12 0" /></>}
                            </svg>
                            <span className="kc-dato-tx">{decision.texto}</span>
                        </span>
                    )}
                    <span className="kc-dato kc-origen" title={`Origen: ${origen}`}>
                        {origenEsEvento
                            ? <svg className="kc-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
                            : <span className="kc-origen-ini" aria-hidden="true">{[...origen.replace(/^Referido de\s+/i, '')][0]?.toUpperCase()}</span>}
                        <span className="kc-dato-tx">{origen}</span>
                    </span>
                </div>

                {etiquetas.length > 0 && (
                    <div className="kc-etiquetas">
                        {etiquetas.map((t) => (
                            <span key={t.texto} className="ktag-v6" style={{ '--c': t.tono }} title={t.title}>{t.texto}</span>
                        ))}
                    </div>
                )}
                
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
                {/* Estado resuelto: check que se dibuja y una palabra. Cuánto falta para la cita ya
                    lo dice la franja de arriba. */}
                {phase === 'call_done' && (
                    <span className="klisto-v6">
                        <svg className="kc-check" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M7.5 12.5l3 3 6-6.5" /></svg><span className="kc-ok-tx">Reportado</span>
                    </span>
                )}
                {phase === 'confirmado' && (
                    <span className="klisto-v6" title="Listo · espera su fecha">
                        <svg className="kc-check" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M7.5 12.5l3 3 6-6.5" /></svg><span className="kc-ok-tx">Confirmado</span>
                    </span>
                )}
                </div>
            </div>
        );
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

            // Después del cambio de estado se pregunta por el seguimiento. Acá había también un
            // «¿Se cerró la venta?» que abría el wizard de venta en otro modal, pero lo disparaba
            // un «¿Asistió con decisor?» que ya nada abría: la venta se declara en la ficha.
            const appt = agendas.find(a => a.id === leadId);
            setFollowUpModal({
                show: true,
                agendaId: leadId,
                leadName: appt?.lead_name || selectedLead?.lead_name || 'Prospecto',
                newStatus: nextStatus,
                isSaleFollowUp: false
            });
        } catch (err) {
            console.error("Error al procesar acción rápida:", err);
            toast.error("Error al actualizar el estado");
        } finally {
            setProcessingId(null);
        }
    };

    // El dock de abajo, el mismo de la dirección comercial y del setter (ver DockSecciones): antes
    // estas secciones eran una fila de pestañas entre "Tu siguiente paso" y el tablero, y le
    // robaban a lo que hay que mirar el alto de una pantalla (pedido del 30/09/2026).
    //
    // Las tres de trabajo muestran lo hecho sobre el total (pedido del 28/ago/2026: "si hay cinco
    // llamadas por confirmar y hay dos confirmadas, entonces hay dos de cinco"). Confirmar y
    // Reportar usan `confirmations_done`/`calls_done` (backend, `/deck/counts`) y no
    // `dailyActivity`: ese mide "hecho HOY por el closer", que no es lo mismo que "ya aparece
    // resuelto en el pool que se está mostrando" —una cita confirmada (o una llamada reportada) un
    // día anterior pero todavía visible hoy en el Kanban contaba "0 hechas", aunque el Kanban ya la
    // mostrara en "Confirmado"/"Reportadas"—. `counts.confirmations` ya es el total del pool
    // (incluye las resueltas que siguen visibles); `counts.calls`, solo lo que falta. Seguir no
    // tiene ese problema: lo resuelto sale del pool, así que ahí `dailyActivity` es la fuente.
    const llamadasHechas = counts.calls_done || 0;
    const seguimientosHechos = dailyActivity?.seguimientos_hechos || 0;
    const seccionesDelDock = [
        { id: 'confirmations', label: 'Confirmar', Icono: CalendarCheck,
            marca: cuentaDelDock(counts.confirmations_done || 0, counts.confirmations, counts.confirmations === 0, 'confirmadas') },
        { id: 'calls', label: 'Reportar', Icono: PhoneCall,
            marca: cuentaDelDock(llamadasHechas, llamadasHechas + counts.calls, counts.calls === 0, 'reportadas') },
        { id: 'seguimientos', label: 'Seguir', Icono: MessageCircle,
            marca: cuentaDelDock(seguimientosHechos, seguimientosHechos + counts.seguimientos, counts.seguimientos === 0, 'hechos hoy') },
        // El triage tiene sus métricas (el embudo de la llamada de filtro) y, como el closer, sus datos y
        // su cartera: el dashboard comercial acotado a sus agendas (`alcance_de`, app/api/comercial.py).
        ...(esTriage ? [
            { id: 'metricas', label: 'Métricas', Icono: Filter },
            { id: 'dashboard', label: 'Mis datos', Icono: BarChart3 },
            { id: 'cartera', label: 'Mi cartera', Icono: Briefcase },
        ] : []),
    ];
    if (!esTriage) seccionesDelDock.push(
        { id: 'report', label: 'Cerrar el día', Icono: ClipboardList, marcas: [
            estadoDeAyer?.unreported && { tipo: 'aviso', texto: '', titulo: 'ayer quedó sin reportar' },
            todayReportSent && { texto: '✓', titulo: 'reporte de hoy enviado' },
        ].filter(Boolean) },
        { id: 'dashboard', label: 'Mis datos', Icono: BarChart3 },
        { id: 'cartera', label: 'Mi cartera', Icono: Briefcase },
        // Temporal: solo mientras Operaciones la tenga activada (GET /closer/leads-audit/status).
        ...(auditEnabled ? [{ id: 'auditoria', label: 'Auditoría', Icono: FileSearch }] : []),
    );
    const seccionDelDock = activeView === 'inbox' ? activeStep : activeView;

    // Al final del dock, la sesión (ver MenuSesion): lo que antes eran botones del header. "Quiero
    // procrastinar" sale solo si hay seguimientos, como antes; "Volver a mi sesión", solo si es una
    // simulación (igual que en el espacio del setter).
    const nombreDeSesion = user?.name || user?.username || 'Closer';
    const volverAMiSesion = async () => {
        try {
            await revertImpersonation();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'No se pudo volver a tu sesión');
        }
    };
    const gruposDeSesion = armarMenuSesion({
        user, logout, navigate: (ruta) => window.location.assign(ruta),
        acciones: [
            ...(esTriage ? [] : [
                { id: 'agenda', label: 'Nueva agenda', Icono: CalendarPlus, onClick: () => { setYaTieneAgenda(null); setNewAgendaModalOpen(true); } },
                { id: 'referido', label: 'Referido manual', Icono: Gift, onClick: () => setManualRefModalOpen(true) },
            ]),
            ...(counts.seguimientos > 0
                ? [{ id: 'procrastinar', label: 'Quiero procrastinar', Icono: Hourglass, onClick: () => setShowProcrastinar(true) }]
                : []),
        ],
        configuracion: { onClick: () => abrirConfiguracion(), avisos: faltaConfigurar },
        playbook: { onClick: () => openPlaybook('pending'), pendientes: pendingCount },
    });
    // La página scrollea dentro de su propio contenedor, no en la ventana: al cambiar de sección se
    // vuelve arriba ahí, para no caer en la mitad de la otra.
    const paginaRef = useRef(null);
    const irASeccion = (id) => {
        if (id === seccionDelDock) return;
        if (PASOS_DEL_MAZO.includes(id)) {
            setActiveView('inbox');
            setSearchParams({ step: id, selected_date: selectedDate });
        } else {
            setActiveView(id);
        }
        paginaRef.current?.scrollTo({ top: 0 });
    };

    return (
        <div ref={paginaRef} className={`h-screen overflow-y-auto bg-v6 text-slate-100 flex flex-col custom-scrollbar${activeView === 'inbox' && (activeStep === 'confirmations' || activeStep === 'calls') ? ' clarity-v6' : ''}`}
            style={{ paddingBottom: 'calc(132px + env(safe-area-inset-bottom, 0px))' }}>

            {/* Header del Espacio de Trabajo Premium v6. Solo la marca y el buscador (pedido del
                30/09/2026): crear una agenda o un referido, "Quiero procrastinar" y la sesión
                viven al final del dock, en `MenuSesion`; el Playbook y Learnito, en Cortex (el Portal). */}
            <header className="top-v6 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
                <div className="topin topin--buscador">
                    <div className="brand-v6">
                        <div className="logo-v6">L</div>
                        <div>
                            <h1>{esTriage ? 'Triage Workspace' : 'Closer Workspace'}</h1>
                            <small>Learnation</small>
                        </div>
                    </div>
                    
                    <div className="search-v6">
                        <div className="sinner-v6">
                            {/* Mientras se abre el lead que se tocó, la lupa gira: es un aviso de
                                la acción, en el lugar donde se hizo, no una carga del mazo. */}
                            {resolviendoLead
                                ? <Loader2 className="animate-spin" aria-hidden="true" />
                                : <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>}
                            <input
                                id="q"
                                ref={buscadorRef}
                                placeholder={paraVender ? '¿A quién le vendiste? Nombre, @IG o email…' : 'Buscar lead por nombre, @IG o examen…'}
                                autoComplete="off"
                                aria-busy={resolviendoLead}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => { if (searchResults.length > 0) setShowSearchResults(true); }}
                            />
                        </div>
                        {/* Siempre presente y con el texto cambiando: un lector de pantalla sólo
                            anuncia los cambios de una región que ya estaba en la página. */}
                        <span className="sr-only" role="status">{resolviendoLead ? 'Abriendo el lead…' : ''}</span>
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
                                                {appt?.id && !paraVender && (
                                                    <button
                                                        type="button"
                                                        title="Abrir la última agenda directamente"
                                                        onClick={(e) => { e.stopPropagation(); setShowSearchResults(false); handleSelectLead({ id: appt.id, fase: 'call' }); }}
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
                                {/* La página vieja le vendía también a quien no estaba cargado. */}
                                {paraVender && !searching && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowSearchResults(false);
                                            setClienteNuevo({ busqueda: searchQuery });
                                            setSearchQuery('');
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-left text-xs text-emerald-300 hover:bg-emerald-500/10 border-t border-slate-800 transition-colors"
                                    >
                                        <UserPlus size={14} aria-hidden="true" className="shrink-0" />
                                        <span>¿No está? Registrar «{searchQuery.trim()}» como cliente nuevo</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Simulando (la dirección comercial o un admin que entró como este closer), la
                        salida va a la vista, a la derecha del buscador, y no solo en el menú del
                        dock: es lo primero que busca quien termina de mirar. Dice a quién se
                        simula, porque la cabecera ya no muestra el nombre. */}
                    {user?.is_impersonating && (
                        <button type="button" className="sim-v6" onClick={volverAMiSesion}
                            title={`Estás simulando a ${nombreDeSesion}`}>
                            <Ghost size={16} aria-hidden="true" />
                            <span>
                                <small>Simulando a {nombreDeSesion.trim().split(/\s+/)[0]}</small>
                                <b>Volver a mi sesión</b>
                            </span>
                        </button>
                    )}
                </div>
                {/* Mientras dura, el buscador elige a quién se le vende y no qué lead abrir: se
                    dice acá, pegado al buscador, y no en un aviso que se va solo. */}
                {paraVender && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        role="status"
                        className="max-w-7xl w-full mx-auto px-6 pb-3 flex flex-wrap items-center gap-3 text-xs"
                    >
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                            <DollarSign size={14} aria-hidden="true" className="shrink-0" />
                            <span>
                                <b className="text-emerald-200">Declarar una venta.</b> Buscá al cliente y se abre su ficha en «Registrar una venta».
                            </span>
                        </span>
                        {!clienteNuevo && (
                            <button
                                type="button"
                                onClick={() => setClienteNuevo({ busqueda: searchQuery })}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-500/10 transition-colors"
                            >
                                <UserPlus size={13} aria-hidden="true" /> ¿No está? Registrar cliente nuevo
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => { setParaVender(false); setClienteNuevo(null); }}
                            className="px-2 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Cancelar
                        </button>
                    </motion.div>
                )}
                {paraVender && clienteNuevo && (
                    <ClienteNuevoVenta
                        busqueda={clienteNuevo.busqueda}
                        onCancelar={() => setClienteNuevo(null)}
                        onAbierto={({ appointment_id: agenda, nombre, nuevo }) => {
                            setClienteNuevo(null);
                            setParaVender(false);
                            // Si ya estaba (el buscador no lo encontró porque se lo buscó
                            // distinto), se dice: la ficha que se abre es la suya.
                            if (!nuevo) toast(`${nombre} ya estaba en el sistema: se abre su ficha.`);
                            handleSelectLead({ id: agenda, fase: 'venta' });
                        }}
                    />
                )}
            </header>

            {/* Área de Trabajo Principal */}
            <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 flex flex-col gap-6">
                
                {/* TU SIGUIENTE PASO · TU DÍA · COMISIÓN: tres tarjetas iguales en una fila (pedido del
                    30/09/2026). Antes eran dos arriba y la comisión en otra fila entera: entre las dos
                    filas y las pestañas, lo que había que mirar —el tablero, los datos— empezaba a
                    media pantalla. En `.pareja` para que, si no entran las tres, se apilen las tres
                    y nunca quede una sola abajo. */}
                {(() => {
                    // "Tu día" tiene que reflejar el trabajo real de HOY en las 3 pestañas, no solo lo
                    // que trajo la pestaña activa (`agendas` es la lista de una sola pestaña, y para
                    // "Confirmar"/"Reportar" solo incluye lo PENDIENTE por diseño del backend — nunca
                    // iba a poder mostrar progreso real). `dailyActivity` (misma fuente que "Reporte
                    // del día") trae lo ya hecho hoy; `counts` trae lo que todavía falta.
                    const doneToday = dailyActivity
                        ? (dailyActivity.confirmados_hoy || 0) + (dailyActivity.show_ups || 0) + (dailyActivity.seguimientos_hechos || 0)
                        : 0;
                    // `counts.confirmations` es el pool entero, con las ya confirmadas que siguen
                    // visibles: lo que falta es eso menos `confirmations_done`. Sin restarlas, con
                    // las tres confirmadas decía «Te falta 3 por confirmar» (23/10/2026).
                    const confirmacionesPendientes = Math.max(0, counts.confirmations - (counts.confirmations_done || 0));
                    const pendingToday = confirmacionesPendientes + counts.calls + counts.seguimientos;
                    const totalToday = doneToday + pendingToday;
                    const pct = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;
                    // En Confirmar y Reportar la segunda tarjeta mide esa sección, no el día entero
                    // (pedido del 23/10/2026): Confirmar, el porcentaje de confirmación del pool;
                    // Reportar, el de asistencia de las llamadas reportadas del día. Asistió todo lo
                    // reportado menos No Show y Cancelada; una reagendada no cuenta para ningún lado.
                    let metrica = null;
                    // En Reportar, sin nada por reportar, la primera tarjeta muestra la presentación
                    // (llamadas con oferta presentada sobre las que asistieron) en vez de mandar a
                    // Confirmar (pedido del 23/10/2026).
                    let presentacion = null;
                    if (activeView === 'inbox' && activeStep === 'confirmations') {
                        const total = counts.confirmations || 0;
                        const hechas = counts.confirmations_done || 0;
                        metrica = { lbl: 'Confirmación', sub: 'confirmado', hechas, total, pie: `${hechas} de ${total} confirmados`, pendientes: confirmacionesPendientes };
                    } else if (activeView === 'inbox' && activeStep === 'calls') {
                        const res = r => (r.closer_result || r.result || '').trim().toLowerCase();
                        const concluidas = reportedTodayCalls.filter(r => !['reagendado', 'reagendada'].includes(res(r)));
                        const conShow = concluidas.filter(r => !['no show', 'cancelado', 'cancelada'].includes(res(r)));
                        const asistieron = conShow.length;
                        metrica = { lbl: 'Asistencia', sub: 'de asistencia', hechas: asistieron, total: concluidas.length, pie: `${asistieron} de ${concluidas.length} asistieron`, pendientes: counts.calls };
                        const presentadas = conShow.filter(r => r.offer_presented === true).length;
                        presentacion = { presentadas, asistieron, pct: asistieron ? Math.round((presentadas / asistieron) * 100) : 0 };
                        // Asistencia de cada tipo de llamada aparte (24/10/2026): las segundas y las
                        // Momentum, con sus reprogramaciones, que en el porcentaje no cuentan.
                        metrica.partes = partesPorTipo(reportedTodayCalls, (lista) => {
                            const reprog = lista.filter(r => ['reagendado', 'reagendada'].includes(res(r))).length;
                            const fin = lista.filter(r => !['reagendado', 'reagendada'].includes(res(r)));
                            const fueron = fin.filter(r => !['no show', 'cancelado', 'cancelada'].includes(res(r))).length;
                            return [fin.length && `${fueron} de ${fin.length} asistieron`, reprog && `${reprog} ${reprog === 1 ? 'reprogramó' : 'reprogramaron'}`];
                        });
                    }
                    if (metrica && activeStep === 'confirmations') {
                        metrica.partes = partesPorTipo(agendas, (lista) => {
                            const si = lista.filter(a => etapaDeConfirmacion(a) === 'confirmado').length;
                            return [`${si} de ${lista.length} ${lista.length === 1 ? 'confirmada' : 'confirmadas'}`];
                        });
                    }
                    const metricaPct = metrica && metrica.total ? Math.round((metrica.hechas / metrica.total) * 100) : 0;
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
                    const heroCountdown = heroLead ? formatCountdown(heroLead.start_time, nowTick) : null;
                    const heroBadgeCls = !heroCountdown ? '' : heroCountdown.kind === 'now' ? 'now' : heroCountdown.kind === 'soon' ? 'soon' : heroCountdown.kind === 'past' ? 'late' : '';
                    return (
                        <div className="tsprow-v6 pareja">
                            {/* En la primera carga, en hueso: con los contadores todavía en su cero
                                inicial, las ramas de abajo caían en "todo el día resuelto" mientras el
                                kanban de al lado decía que estaba cargando. Si la carga termina sin
                                contadores (falló la consulta), se vuelve a lo de siempre: un hueso que
                                no se va nunca sería peor. */}
                            {loading && !countsCargados ? (
                                <EsqueletoSiguientePaso />
                            ) : heroLead ? (
                                <div className="tsp-v6" onClick={() => handleSelectLead(heroLead)}>
                                    <div className="tsp-top-v6">
                                        <span className="tsp-dot-v6"></span>
                                        <span className="tsp-lbl-v6">Tu siguiente paso</span>
                                        <div className="flex-1"></div>
                                        {heroCountdown && (
                                            <AgendaCountdown
                                                startTime={heroLead.start_time}
                                                className={`tsp-badge-v6 ${heroBadgeCls}`}
                                            />
                                        )}
                                    </div>
                                    <h3 className="tsp-name-v6 truncate" title={heroLead.lead_name || undefined}>{heroLead.lead_name || 'Sin Nombre'}</h3>
                                    <p className="tsp-sub-v6 truncate">{heroLead.origin || 'Meta Ads'} · @{heroLead.instagram ? heroLead.instagram.replace('@', '') : 'usuario'}</p>
                                    <button
                                        type="button"
                                        className="tsp-cta-v6"
                                        onClick={(e) => { e.stopPropagation(); handleSelectLead(heroLead); }}
                                    >
                                        {activeStep === 'confirmations' ? 'Ir a confirmar' : 'Ir a reportar'} →
                                    </button>
                                </div>
                            ) : activeView === 'inbox' && activeStep === 'seguimientos' && seguimientoHero ? (
                                // Mismo mecanismo que confirmaciones/llamadas de arriba, pero para la pestaña
                                // Seguir: antes acá nunca había un lead concreto (heroLead no la cubre, ver su
                                // comentario), así que caía siempre en el fallback de "podés avanzar con" y
                                // terminaba mostrando hasta 2 botones sueltos. Pedido del usuario (28/ago/2026):
                                // "quiero que sea uno que me lleve a seguir a alguien... como prioridad va a
                                // tomar algún cobro" — `seguimientoHero` (reportado por SeguimientosPane, ver su
                                // prop `onTopPending`) ya viene con esa prioridad (cobros -> hot -> fríos),
                                // primero de lo asignado hoy y si no hay nada, del pool sin fecha.
                                <div className="tsp-v6" onClick={() => handleSelectLead(seguimientoHero.payload)}>
                                    <div className="tsp-top-v6">
                                        <span className="tsp-dot-v6"></span>
                                        <span className="tsp-lbl-v6">Tu siguiente paso</span>
                                    </div>
                                    <h3 className="tsp-name-v6 truncate" title={seguimientoHero.item.lead_name || undefined}>{seguimientoHero.item.lead_name || 'Sin Nombre'}</h3>
                                    <p className="tsp-sub-v6 truncate">
                                        {seguimientoHero.item.origin || 'Meta Ads'} · @{seguimientoHero.item.instagram ? seguimientoHero.item.instagram.replace('@', '') : 'usuario'}
                                    </p>
                                    <button
                                        type="button"
                                        className="tsp-cta-v6"
                                        onClick={(e) => { e.stopPropagation(); handleSelectLead(seguimientoHero.payload); }}
                                    >
                                        {seguimientoHero.tipo === 'cerrada' ? 'Ir a cobrar' : 'Ir a seguir'} →
                                    </button>
                                </div>
                            ) : activeView === 'inbox' && activeStep === 'confirmations' ? (
                                // En Confirmar, sin nadie por confirmar, la tarjeta muestra los confirmados
                                // y nada más: no manda a otra sección (pedido del 23/10/2026, decía
                                // «Te falta 1 por reportar» estando en Confirmar).
                                <div className="tsp-v6 tsp-done-v6">
                                    <div className="tsp-top-v6">
                                        <span className="tsp-dot-v6 ok"></span>
                                        <span className="tsp-lbl-v6">Confirmados</span>
                                    </div>
                                    <h3 className="tsp-name-v6">
                                        {(counts.confirmations_done || 0) === 1 ? '1 confirmado' : `${counts.confirmations_done || 0} confirmados`}
                                    </h3>
                                    <p className="tsp-sub-v6">
                                        {(counts.confirmations_done || 0) > 0 ? 'Listos para su llamada · nada por confirmar' : 'Nada por confirmar'}
                                    </p>
                                </div>
                            ) : presentacion ? (
                                <div className="tsp-v6 tsp-done-v6">
                                    <div className="tsp-top-v6">
                                        <span className="tsp-dot-v6 ok"></span>
                                        <span className="tsp-lbl-v6">Presentación</span>
                                    </div>
                                    <h3 className="tsp-name-v6">{presentacion.pct}% de presentación</h3>
                                    <p className="tsp-sub-v6">
                                        {presentacion.asistieron
                                            ? `Oferta presentada en ${presentacion.presentadas} de ${presentacion.asistieron} · nada por reportar`
                                            : 'Nada por reportar'}
                                    </p>
                                </div>
                            ) : (() => {
                                // Una sola acción, no una lista de bandejas (pedido del usuario, 28/ago/2026:
                                // "en ver mis datos, mi cartera y cerrar el día debería ser ese mismo mecanismo
                                // de un solo botón y una sola acción") — se elige la de mayor prioridad (mismo
                                // orden que la navegación 01-02-03) usando `counts`, ya cargado sin pegarle de
                                // nuevo a la API. Cubre tanto "estoy en una pestaña del mazo que ya está vacía"
                                // como "estoy en Ver mis datos/Mi cartera/Cerrar el día" — antes esas 3 vistas
                                // no ofrecían ninguna acción concreta, o hasta 2 sueltas sin prioridad.
                                const PRIORITY = [
                                    { key: 'confirmations', label: 'Ir a confirmar', accion: 'confirmar', count: confirmacionesPendientes, step: 'confirmations' },
                                    { key: 'calls', label: 'Ir a reportar', accion: 'reportar', count: counts.calls, step: 'calls' },
                                    { key: 'seguimientos', label: 'Ir a seguir', accion: 'seguir', count: counts.seguimientos, step: 'seguimientos' }
                                ];
                                const next = PRIORITY.find(s => s.count > 0);

                                if (!next) {
                                    return (
                                        <div className="tsp-v6 tsp-done-v6">
                                            <div className="tsp-top-v6">
                                                <span className="tsp-dot-v6 ok"></span>
                                                <span className="tsp-lbl-v6">Tu siguiente paso</span>
                                            </div>
                                            <h3 className="tsp-name-v6">🎉 Tenés absolutamente todo el día resuelto</h3>
                                            <p className="tsp-sub-v6">Nada pendiente en confirmar, reportar ni seguir.</p>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="tsp-v6 tsp-done-v6">
                                        <div className="tsp-top-v6">
                                            <span className="tsp-dot-v6 ok"></span>
                                            <span className="tsp-lbl-v6">Tu siguiente paso</span>
                                        </div>
                                        <h3 className="tsp-name-v6">Te falta {next.count} por {next.accion}</h3>
                                        <button
                                            type="button"
                                            className="tsp-cta-v6"
                                            onClick={(e) => { e.stopPropagation(); irASeccion(next.step); }}
                                        >
                                            {next.label} →
                                        </button>
                                    </div>
                                );
                            })()}

                            {metrica ? (
                            <div className="tud-v6">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="tud-lbl-v6">{metrica.lbl}</div>
                                    <div className="tud-xp-v6">🔥 Racha {streakDays} d</div>
                                </div>
                                <div className="tud-pct-row-v6">
                                    <span className="tud-pct-v6">{metricaPct}%</span>
                                    <span className="tud-sub-v6">{metrica.sub}</span>
                                </div>
                                <div className="pbarw-v6">
                                    <i style={{ width: `${metricaPct}%` }}></i>
                                </div>
                                <div className="tud-foot-row-v6">
                                    <span className="tud-foot-v6">{metrica.pie}</span>
                                    <span className="tud-foot-v6">{metrica.pendientes} {metrica.pendientes === 1 ? 'pendiente' : 'pendientes'}</span>
                                </div>
                                {metrica.partes?.length > 0 && (
                                    <div className="tud-partes-v6">
                                        {metrica.partes.map(p => (
                                            <span key={p.tipo} className="tud-parte-v6" data-tipo={p.tipo}>
                                                <b>{p.lbl}</b> {p.texto}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            ) : (
                            <div className="tud-v6">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="tud-lbl-v6">Tu día</div>
                                    <div className="tud-xp-v6">🔥 Racha {streakDays} d</div>
                                </div>
                                <div className="tud-pct-row-v6">
                                    <span className="tud-pct-v6">{pct}%</span>
                                    <span className="tud-sub-v6">del día completado</span>
                                </div>
                                <div className="pbarw-v6">
                                    <i style={{ width: `${pct}%` }}></i>
                                </div>
                                <div className="tud-foot-row-v6">
                                    <span className="tud-foot-v6">{doneToday} de {totalToday} resueltos hoy</span>
                                    <span className="tud-foot-xp-v6">⚡ {xp} XP</span>
                                </div>
                            </div>
                            )}

                            {!esTriage && <ComisionMesCard />}
                        </div>
                    );
                })()}

                {activeView === 'inbox' ? (
                <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Columna Única de Ancho Completo v7 */}
                <div className="lg:col-span-12 space-y-4">
                    
                    {activeStep === 'confirmations' ? (
                        /* Renderizado del Kanban de Confirmaciones */
                        loading ? (
                            /* La forma del kanban de abajo, no un spinner (ver EsqueletoKanban).
                               Las columnas son las mismas tres (`ETAPAS_DEL_TABLERO`): si cambia una de
                               abajo, cambia acá. */
                            <EsqueletoKanban rotulo="Cargando confirmaciones…" columnas={ETAPAS_DEL_TABLERO.map(e => ({
                                clase: e.clase, titulo: e.titulo, hecha: e.clave === 'confirmado',
                            }))} />
                        ) : filteredAgendas.length === 0 ? (
                            <div className="text-center py-16 text-slate-500 text-xs font-bold uppercase tracking-wide bg-[#111219]/95 border border-slate-900 rounded-[2rem]">
                                👏 No hay citas pendientes de confirmación.
                            </div>
                        ) : (
                            <div className={`kb-v6 kb-etapas${arrastrando ? ' kb-arrastre' : ''}`}>
                                {/* Una columna por etapa de la ficha. Cada una recibe tarjetas
                                    arrastradas de las otras (ver `moverDeEtapa`). */}
                                {ETAPAS_DEL_TABLERO.map(etapa => {
                                    const leads = confirmationsPipeline[etapa.lista];
                                    const recibe = arrastrando && arrastrando.desde !== etapa.clave;
                                    return (
                                        <div key={etapa.clave}
                                            className={`kcol-v6 ${etapa.clase}${recibe ? ' kcol-recibe' : ''}${recibe && columnaDestino === etapa.clave ? ' kcol-encima' : ''}`}
                                            onDragOver={recibe ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (columnaDestino !== etapa.clave) setColumnaDestino(etapa.clave); } : undefined}
                                            onDragLeave={recibe ? (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setColumnaDestino(null); } : undefined}
                                            onDrop={recibe ? (e) => {
                                                e.preventDefault();
                                                const id = Number(e.dataTransfer.getData('text/plain')) || arrastrando.id;
                                                setArrastrando(null);
                                                setColumnaDestino(null);
                                                moverDeEtapa(id, etapa.clave);
                                            } : undefined}
                                        >
                                            <div className="kch-v6">
                                                <span className="dt-v6"></span>
                                                <b>{etapa.titulo}</b>
                                                <span className="n-v6">{leads.length}</span>
                                            </div>
                                            <div className="kbody-v6">
                                                {leads.length > 0
                                                    ? leads.map((a, i) => renderKanbanCard(a, etapa.fase, i * ETAPAS_DEL_TABLERO.length + etapa.columna))
                                                    : <div className={`kempty-v6${etapa.clave !== 'confirmado' ? ' done-v6' : ''}`}>{etapa.vacio}</div>}
                                                {recibe && <div className="kdrop-v6" aria-hidden="true">Soltalo acá · pasa a {etapa.titulo}</div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    ) : activeStep === 'seguimientos' ? (
                        <SeguimientosPane selectedDate={selectedDate} onOpenLead={handleSelectLead} refreshKey={seguimientosRefreshKey} onTopPending={setSeguimientoHero} />
                    ) : (
                        /* Renderizado Kanban para Llamadas (v7): mismo lenguaje visual que
                           Confirmaciones (3 columnas, kcard-v6), agrupado por urgencia en vez de por
                           etapa de proceso — acá todo está en el mismo estado, "sin reportar". */
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

                            {loading ? (
                                /* Ídem Confirmar: las tres columnas de abajo, en hueso. */
                                <EsqueletoKanban rotulo="Cargando llamadas…" columnas={[
                                    { clase: 'k1-v6', titulo: 'Atrasadas' },
                                    { clase: 'k2-v6', titulo: 'Hoy' },
                                    { clase: 'k3-v6', titulo: 'Reportadas', hecha: true },
                                ]} />
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
                                                /* Orden de entrada: renglón × 3 columnas + columna. */
                                                callsPipeline.atrasadas.map((a, i) => renderKanbanCard(a, 'call', i * 3))
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
                                                callsPipeline.hoy.map((a, i) => renderKanbanCard(a, 'call', i * 3 + 1))
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
                                                callsPipeline.reportadas.map((a, i) => renderKanbanCard(a, 'call_done', i * 3 + 2))
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
                        const isToday = reportandoHoy;
                        const doneToday = reportActivity
                            ? (reportActivity.confirmados_hoy || 0) + (reportActivity.show_ups || 0) + (reportActivity.seguimientos_hechos || 0)
                            : 0;
                        // `counts` es siempre "lo pendiente de HOY" — solo tiene sentido sumarlo al
                        // total cuando se está reportando el día de hoy; para un día pasado ya cerrado
                        // no hay "pendiente" que sumar, así que el total es lo hecho ese día.
                        const pendingToday = isToday ? (Math.max(0, counts.confirmations - (counts.confirmations_done || 0)) + counts.calls + counts.seguimientos) : 0;
                        const totalToday = doneToday + pendingToday;
                        const firstName = user?.name?.split(' ')[0] || user?.username || 'Closer';
                        const cashToday = reportActivity?.ventas_cash || 0;
                        const maxTrend = Math.max(1, ...dailyTrend.map(d => d.cash), 1);
                        const [, m, d] = reportDate.split('-');

                        return (
                            <div className="rpt-hero-v6">
                                <div>
                                    <div className="rpt-hero-lbl-v6">{isToday ? 'CIERRE DEL DÍA' : 'CIERRE DE AYER'} · {d}/{m}</div>
                                    <h2>Buen avance, {firstName}</h2>
                                    <p>{doneToday} de {totalToday} resueltos · ${Math.round(cashToday).toLocaleString()} movidos {isToday ? 'hoy' : 'ayer'}</p>
                                    <div className="flex items-center gap-3 flex-wrap mt-4">
                                        <span className="rpt-pill-v6" style={{ background: 'color-mix(in srgb, var(--ln-brand, #ff3fa4) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--ln-brand, #ff3fa4) 45%, transparent)' }}>
                                            <span style={{ color: 'color-mix(in srgb, var(--ln-text-out, #ffffff) 60%, transparent)' }}>MOVISTE</span>
                                            <span style={{ color: 'var(--v6-pink)', fontVariantNumeric: 'tabular-nums' }}>${Math.round(cashToday).toLocaleString()}</span>
                                        </span>
                                        <span className="rpt-pill-v6" style={{ background: 'color-mix(in srgb, var(--ln-brand-2-accent, #4e8bd8) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--ln-brand-2-accent, #4e8bd8) 45%, transparent)', color: 'var(--ln-brand-2-accent, #4E8BD8)' }}>
                                            {reportXp} XP
                                        </span>
                                        <span className="rpt-pill-v6" style={{ background: 'color-mix(in srgb, var(--ln-warning, #d9a441) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--ln-warning, #d9a441) 45%, transparent)', color: 'var(--ln-warning, #D9A441)' }}>
                                            RACHA {reportActivity?.streak_days ?? 0} DÍAS
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
                                                            background: dtItem.is_target ? 'var(--v6-ok)' : 'color-mix(in srgb, var(--ln-brand-2-accent, #4e8bd8) 55%, transparent)'
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

                    {/* Hoy o ayer (pedido del usuario, 30/09/2026: «que me pueda permitir reportar
                        el día de ayer»). El 29/ago se había sacado el selector de fecha libre; este
                        solo tiene dos opciones y el backend rechaza cualquier otra. Si ayer quedó
                        sin reportar, el aviso vive acá y lleva directo a Ayer. */}
                    <DiaDelReporte
                        hoy={hoyReporte}
                        ayer={ayerReporte}
                        valor={reportDate}
                        onElegir={elegirDiaDelReporte}
                        enviado={reportSent}
                        enviadoEl={reportSentAt}
                        ayerSinReportar={!!estadoDeAyer?.unreported}
                        agendasDeAyer={estadoDeAyer?.agendas || 0}
                        cargando={loadingReportStatus}
                    />

                    {/* 4 KPI del día — mismos 4 de la referencia visual (fracción hecho/total +
                        barra), en vez de las 9 cajas sueltas de antes. "Total" = hecho + pendiente
                        real de cada pestaña, no un número inventado. */}
                    {(() => {
                        const cobrosPendientes = seguimientosHoyGrouped?.cerrada?.length || 0;
                        // Confirmaciones: `counts.confirmations` ya es el total del pool (incluye las
                        // ya resueltas que siguen visibles, ver la cuenta del dock) — sumarle
                        // `done` encima las contaba dos veces. Bug real confirmado en producción
                        // (08/sep/2026, Nerina): con 1 sola agenda del día mostraba "2 de 3" acá
                        // mientras la navegación, para el mismo pool, mostraba "1/1" correctamente.
                        const confirmDoneKpi = reportActivity?.confirmados_hoy || 0;
                        const confirmPendingKpi = Math.max(0, counts.confirmations - confirmDoneKpi);
                        // `counts` es lo pendiente de HOY: cerrando ayer no se suma (mismo criterio
                        // que el hero), cada KPI queda en lo que se hizo ese día.
                        const pendiente = (n) => (reportandoHoy ? n : 0);
                        const kpis = [
                            { label: 'Confirmaciones', done: confirmDoneKpi, pending: pendiente(confirmPendingKpi), color: 'var(--ln-brand-2-accent, #4E8BD8)' },
                            { label: 'Llamadas reportadas', done: reportActivity?.show_ups || 0, pending: pendiente(counts.calls), color: 'var(--ln-brand-2-accent, #4E8BD8)' },
                            { label: 'Seguimientos hechos', done: reportActivity?.seguimientos_hechos || 0, pending: pendiente(counts.seguimientos), color: 'var(--ln-success, #2FBF8F)' },
                            { label: 'Cobros resueltos', done: reportActivity?.ventas_count || 0, pending: cobrosPendientes, color: 'var(--ln-brand, #FF3FA4)' },
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
                                const pendienteHoyTotal = Math.max(0, counts.confirmations - (counts.confirmations_done || 0)) + counts.calls + counts.seguimientos;
                                const cobrosHechos = reportActivity?.ventas_count || 0;
                                const segFaltan = seguimientosGoal?.faltan;
                                const achievements = [
                                    {
                                        name: 'Primer cobro',
                                        done: cobrosHechos > 0,
                                        status: cobrosHechos > 0 ? '✓ logrado' : 'cobrá 1 venta'
                                    },
                                    // Lo pendiente que se conoce es el de hoy: de ayer no se sabe
                                    // cómo quedó la bandeja a la noche, así que no se inventa.
                                    {
                                        name: 'Día limpio',
                                        done: reportandoHoy && pendienteHoyTotal === 0,
                                        status: !reportandoHoy ? '—' : pendienteHoyTotal === 0 ? '✓ logrado' : `faltan ${pendienteHoyTotal}`
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
                                        style={slotsPorDebajoDeAgendas ? { borderColor: 'var(--v6-warn)' } : reportSlotsIsDefault ? { borderColor: 'color-mix(in srgb, var(--ln-brand-2, #8b5cf6) 60%, transparent)' } : undefined}
                                    />
                                </div>
                            </div>
                            {/* El mínimo posible siempre visible: la cantidad de agendas del día no
                                puede quedar enterrada en un párrafo — es lo que pidió el usuario. Un
                                cupo ocupado sigue siendo un cupo, así que los slots nunca pueden ser
                                menos que esto. */}
                            {reportActivity?.agendas_del_dia !== undefined && (
                                <p className="text-[11px] font-bold" style={{ color: slotsPorDebajoDeAgendas ? 'var(--ln-warning-text, #F3D08A)' : 'var(--v6-tx3)' }}>
                                    {slotsPorDebajoDeAgendas ? '⚠️ ' : ''}Mínimo {reportActivity.agendas_del_dia} — ese día tenés {reportActivity.agendas_del_dia} agenda(s) registradas, y un cupo ocupado sigue contando.
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
                            <span className="text-xs font-bold" style={{ color: 'var(--ln-warning-text, #F3D08A)' }}>
                                {reportandoHoy
                                    ? `${Math.max(0, counts.confirmations - (counts.confirmations_done || 0)) + counts.calls + counts.seguimientos} cosa(s) quedaron sin resolver`
                                    : `Se guarda como el reporte del ${etiquetaDia(reportDate, { largo: true })}`}
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
                                    // Hoy va sin fecha (el backend sabe cuál es el hoy del closer).
                                    const res = await api.post('/closer/deck/daily-report', {
                                        date: diaElegido || undefined,
                                        slots: parseInt(reportSlots) || 0,
                                        reflections: { victory: reflection.win, opportunity: reflection.fix }
                                    });
                                    setReportSent(true);
                                    setReportSentAt(new Date().toISOString());
                                    const enviadoAyer = !!res.data?.late;
                                    if (!enviadoAyer) setTodayReportSent(true);
                                    // El de ayer ya está: se apagan el aviso y el punto del dock.
                                    if (enviadoAyer) setEstadoDeAyer(prev => (prev ? { ...prev, sent: true, unreported: false } : prev));
                                    toast.success(enviadoAyer
                                        ? `Reporte de ayer (${etiquetaDia(res.data?.date || reportDate, { largo: true })}) enviado con éxito`
                                        : 'Reporte del día enviado con éxito');
                                } catch (err) {
                                    if (err.response?.status === 409 && err.response?.data?.pending_previous_days) {
                                        setPendingPreviousDays(err.response.data.pending_previous_days);
                                    }
                                    // Fuera de la ventana hoy/ayer (pestaña abierta desde anteayer): se vuelve a hoy.
                                    resincronizarDia(err);
                                    toast.error(err.response?.data?.error || "Error al enviar el reporte del día");
                                } finally {
                                    setSendingReport(false);
                                }
                            }}
                            className="h-[52px] px-8 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase text-[11px] tracking-widest rounded-full transition-all cursor-pointer flex items-center gap-2"
                            style={{ background: 'var(--v6-gradb)', boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--ln-brand-2, #1323c6) 35%, transparent)' }}
                        >
                            {sendingReport ? <Loader2 size={14} className="animate-spin" /> : null}
                            {sendingReport ? 'Enviando...' : reportSent ? 'Actualizar y reenviar reporte' : reportandoHoy ? 'Enviar reporte del día' : 'Enviar reporte de ayer'}
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
                ) : activeView === 'metricas' ? (
                    <TriageMetricas />
                ) : activeView === 'auditoria' ? (
                    <CloserLeadsAudit embedded />
                ) : activeView === 'cartera' ? (
                    /* "Mi cartera" es la seccion Revisar del director comercial, acotada a este
                       closer POR EL BACKEND (ver `alcance_de` en app/api/comercial.py): sus
                       agendas y sus ventas, con la tira de totales de lo filtrado arriba. Pedido
                       del usuario, que ademas hizo sacar los 4 KPIs que tenia la cartera vieja. */
                    /* `onAbrirCliente`: en la tabla Clientes, tocar una fila abre la gestión de
                       cobro de ese cliente —el mismo modal que la cola de cobro, resuelto por su
                       etapa real— en vez del modal de corrección de agendas, que sobre un cliente
                       no sirve para nada. Se resuelve con `handleSelectSearchResult` porque es la
                       misma pregunta que hace el buscador global: "¿en qué etapa está este
                       cliente?". Así registrar el pago sigue saliendo por el wizard de venta de
                       esta pantalla, sin duplicar el camino que alimenta cash collected. */
                    <DashboardComercial embebido seccionFija="revisar"
                        onAbrirCliente={(clientId) => handleSelectSearchResult({ id: clientId })} />
                ) : (
                    /* Y "Mis datos" es la seccion Analizar de esa misma pantalla, sin el
                       selector de persona (el backend no se lo ofrece a un closer). El drill-down
                       de un dato cambia a "Mi cartera", que es donde vive la tabla. */
                    <DashboardComercial embebido seccionFija="analizar"
                        onIrASeccion={() => irASeccion('cartera')} />
                )}

            {/* Fijo abajo. Dentro de un `.dc-shell` porque de ahí cuelgan sus estilos; el resto de
                la página NO va adentro: el reset de botones del shell le borraría el Tailwind. */}
            <div className="dc-shell dc-shell--embebido">
                <DockSecciones secciones={seccionesDelDock} activa={seccionDelDock}
                    onElegir={irASeccion} ariaLabel="Secciones del espacio del closer"
                    despues={(
                        <MenuSesion nombre={nombreDeSesion} rol={rotuloDeSesion(user)}
                            aviso={pendingCount > 0
                                ? { texto: pendingCount, titulo: `${pendingCount} ${pendingCount === 1 ? 'video pendiente' : 'videos pendientes'} del Playbook` }
                                : null}
                            grupos={gruposDeSesion} />
                    )} />
            </div>

            {/* Modal de Detalle de Lead v7 (ovLead) */}
            {/* Sin AnimatePresence a propósito: con esta versión de framer-motion el overlay nunca
                se desmontaba al cerrarse (se quedaba fijo tapando la pantalla, con o sin motion
                component como hijo directo), y la única salida era recargar la página. Era la razón
                real de que un seguimiento resuelto "no desapareciera". La animación de entrada se
                mantiene; se pierde solo el fundido de salida, que dura 0,2s y no lo extraña nadie. */}
            {/* La ficha unificada reemplaza al modal propio del mazo. Antes habia uno para
                confirmar y otro para reportar la llamada, y ninguno mostraba el recorrido
                entero del lead: ni la deuda, ni el formulario con el que entro, ni el hilo
                del equipo. Las acciones rapidas siguen viviendo en la tarjeta, que es donde
                estan: esto reemplaza el modal, no el mazo. */}
            {selectedLead && (
                <FichaLeadModal
                    appointmentId={selectedLead.id > 0 ? selectedLead.id : null}
                    clientId={selectedLead.id > 0 ? null : (selectedLead.client_id || null)}
                    personUuid={selectedLead.id > 0 ? null : (selectedLead.person_uuid || null)}
                    pestanaInicial={pestanaDeLaFicha}
                    abrirEnVenta={modalStep === 'venta'}
                    seguimiento={seguimientoDeLaFicha}
                    onCerrar={() => setSelectedLead(null)}
                    onCambio={alCambiarLaFicha}
                />
            )}

            {/* Modal de Motivo / Razón de Cambio (Reemplazo de window.prompt) */}
            <>
                {reasonModal.show && (
                    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in text-left">
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
                    <div className="fixed inset-0 z-[1150] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md text-left">
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

                            <YaTieneAgenda
                                aviso={yaTieneAgenda}
                                cargando={processingId === 'new_agenda'}
                                onElegir={(decision) => handleCreateAgenda(decision)}
                                onCancelar={() => setYaTieneAgenda(null)}
                            />

                            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                                <button type="button" onClick={() => { setYaTieneAgenda(null); setNewAgendaModalOpen(false); }} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold uppercase">
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCreateAgenda()}
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
                    <div className="fixed inset-0 z-[1150] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md text-left">
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


            {/* Los datos del lead ya no se corrigen en un modal aparte encima de la ficha: el lápiz
                de la cabecera los edita en el lugar, igual que desde el dashboard comercial (ver
                `FichaHeader`). Guardar pasa por `onCambio`, que recarga el mazo. La fecha/hora
                de la llamada, que ese modal también movía, queda para la edición de agendas del
                Historial de la ficha. */}
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

            {/* Modal de Celebración de Hitos (Pipeline de Confirmaciones v7) */}
            <>
                {celebration && (
                    <div className="fixed inset-0 z-[1250] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
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
