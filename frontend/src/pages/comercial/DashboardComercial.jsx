import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, CheckCircle2, Ghost, Inbox, Search, Target, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { revertImpersonation } from '../../utils/impersonation';
import './comercial.css';
import '../../components/learnation-ds/learnation-ds.css';
import { Cargando, Humo, PillMenu, Segmented } from './components/Shared';
import Analizar from './components/Analizar';
import Comparativas from './components/Comparativas';
import Variabilidad from './components/Variabilidad';
import Revisar, { TABLAS_POR_ROL, duplicadasDe } from './components/Revisar';
import LeadModal from './components/LeadModal';
import Reportar from './components/Reportar';
import { corregirAgenda, getComparativas, getContexto, getResumen, getTabla, getVariabilidad, marcarAgendaDuplicada } from './comercialApi';

/**
 * Dashboard comercial.
 *
 * Un solo componente para tres audiencias: la dirección comercial (todo el equipo, con selector
 * de persona y de rol, y la sección Reportar) y "Mis datos" de closers y setters (los mismos
 * paneles acotados a esa persona). Quién ve qué lo decide el backend: acá solo se esconden los
 * controles que esa persona no puede usar, según lo que diga `/comercial/contexto`.
 *
 * El período y la sección viven en la query string, para poder compartir una vista tal como se
 * está mirando.
 *
 * Va montada SIN `MainLayout` (mismo patrón que el mazo del closer y el panel de contratación):
 * tiene su propio dock fijo abajo y el de la app quedaba encima, superpuesto pixel a pixel. A
 * cambio, la salida la ofrece esta pantalla: "Volver a mi sesión" si es una simulación (ver
 * `revertImpersonation`, que existe justamente para las sub-apps sin MainLayout) y, si no, la
 * vuelta al lugar de trabajo de cada rol.
 *
 * ## Modo embebido
 *
 * Con `embebido` la pantalla renderiza UNA sección —la que diga `seccionFija`— sin su header ni
 * su dock, para vivir dentro del mazo del closer y del setter: ahí "Ver mis datos" y "Mi cartera"
 * son esta misma pantalla, no una copia. Se eligió reusar el componente en vez de extraer los
 * paneles a una tercera pieza porque la carga de datos, el drill-down, la corrección de estados y
 * el modal del lead son todos el mismo comportamiento; duplicarlos garantizaba que las dos
 * versiones se fueran separando.
 *
 * El drill-down de Analizar tiene que cambiar de sección, y embebido no hay dock que lo haga: lo
 * resuelve `onIrASeccion`, con el que el host cambia su propia pestaña.
 *
 * `onAbrirCliente` es la otra salida al host: en la tabla Clientes, una fila NO es una agenda que
 * corregir sino un cliente al que hay que cobrarle, y el modal de corrección de esta pantalla no
 * sirve para eso. Cuando el host sabe abrir la gestión del cliente (el mazo del closer, que tiene
 * el cockpit de cobro y el wizard de venta), le pasa el `client_id` y esta pantalla no abre nada.
 * Sin esa prop —la dirección comercial, que mira pero no cobra— se sigue abriendo el modal de
 * siempre, que es además lo único que sus permisos le permiten hacer.
 */

/** A dónde vuelve cada rol cuando sale del dashboard. */
const SALIDA = {
    closer: { to: '/closer/deck?step=confirmations', label: 'Volver al mazo' },
    setter: { to: '/setter/deck?step=cualificacion', label: 'Volver al mazo' },
    director_comercial: { to: '/admin/ventas', label: 'Ir a Ventas' },
    admin: { to: '/admin/ventas', label: 'Ir a Ventas' },
};

const SECCIONES = [
    // `soloDireccion` en una tab: igual que en una sección, pero por pestaña. Comparativas es la
    // única vista que muestra los números de OTRAS personas con nombre y apellido, así que un
    // closer o un setter no la ve — su tablero es el suyo y nada más.
    { id: 'analizar', label: 'Analizar', Icono: Search, tabs: [{ key: 'dashboard', label: 'Dashboard' },
        { key: 'comparativas', label: 'Comparativas', soloDireccion: true },
        { key: 'variabilidad', label: 'Variabilidad' }] },
    { id: 'revisar', label: 'Revisar', Icono: CheckCircle2, tabs: [] },
    { id: 'proyectar', label: 'Proyectar', Icono: Calendar, tabs: [], pronto: true },
    { id: 'simulador', label: 'Simulador', Icono: Target, tabs: [], pronto: true },
    { id: 'reportar', label: 'Reportar', Icono: Inbox, tabs: [{ key: 'reporte', label: 'Reporte del día' }, { key: 'historial', label: 'Historial' }], soloDireccion: true },
];

const PRONTO = {
    proyectar: 'Vas a poder proyectar el cierre del mes con el ritmo actual y ajustar la meta. Estamos puliendo el cálculo.',
    simulador: 'Vas a poder mover cada palanca del embudo y ver cuánto cambia el resultado. Estamos puliendo el modelo.',
};

/** Isotipo de Learnation, con el degradado de marca. */
const Isotipo = () => (
    <svg width="36" height="36" viewBox="0 0 100 100" role="img" aria-label="Learnation">
        <defs>
            <linearGradient id="lnGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--brand-secondary)" />
                <stop offset="100%" stopColor="var(--brand-secondary-light)" />
            </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" rx="26" fill="url(#lnGrad)" />
        <g fill="#FFFFFF" stroke="#FFFFFF">
            <path d="M49 18 L23 44 L23 83 L77 83 L77 61 L49 61 Z" strokeWidth="5" strokeLinejoin="round" />
            <path d="M23 18 L42 18 L23 37 Z" strokeWidth="5" strokeLinejoin="round" />
        </g>
    </svg>
);

const ProntoSection = ({ seccion }) => (
    <section className="panel">
        <div className="vacio-grande">
            <span className="vacio-icono"><seccion.Icono size={24} /></span>
            <h2 className="t-h2">{seccion.label} llega pronto</h2>
            <p className="t-sm mut">{PRONTO[seccion.id]}</p>
        </div>
    </section>
);

const DashboardComercial = ({ embebido = false, seccionFija = null, onIrASeccion = null, onAbrirCliente = null }) => {
    const [params, setParams] = useSearchParams();
    const [contexto, setContexto] = useState(null);
    const { user } = useAuth();
    const [saliendo, setSaliendo] = useState(false);

    const seccion = seccionFija || params.get('s') || 'analizar';
    const period = params.get('p') || 'mes';
    const compare = params.get('vs') || 'prev';
    const rolPedido = params.get('rol');
    const miembroPedido = params.get('m');
    const tabla = params.get('t') || null;

    const [tab, setTab] = useState('dashboard');
    const [basis, setBasis] = useState('meet');
    const [resumen, setResumen] = useState(null);
    const [comparativas, setComparativas] = useState(null);
    const [variabilidad, setVariabilidad] = useState(null);
    const [datosTabla, setDatosTabla] = useState(null);
    const [cargandoTabla, setCargandoTabla] = useState(false);
    const [filaAbierta, setFilaAbierta] = useState(null);
    const [filtroInicial, setFiltroInicial] = useState(null);

    // Una fila de la tabla Clientes no es una agenda que corregir: es alguien a quien hay que
    // cobrarle. Si el host sabe abrir la gestión del cliente (ver el docstring de arriba), se la
    // pasa; si no, cae en el modal de corrección de siempre.
    const abrirFila = useCallback((fila) => {
        if (fila?.tipo === 'cliente' && fila.client_id && onAbrirCliente) {
            onAbrirCliente(fila.client_id, fila);
            return;
        }
        setFilaAbierta(fila);
    }, [onAbrirCliente]);
    const drillDown = useRef(0);
    const [stepper, setStepper] = useState(null);

    const set = useCallback((cambios) => {
        const siguiente = new URLSearchParams(params);
        Object.entries(cambios).forEach(([k, v]) => {
            if (v === null || v === undefined || v === '') siguiente.delete(k);
            else siguiente.set(k, v);
        });
        setParams(siguiente, { replace: true });
    }, [params, setParams]);

    useEffect(() => {
        getContexto().then(setContexto).catch(() => toast.error('No se pudo abrir el dashboard comercial'));
    }, []);

    // El rol y la persona efectivos: para un closer o un setter los manda el backend y la query
    // string no puede cambiarlos (ver `alcance_de` en app/api/comercial.py).
    const rol = contexto?.puede_elegir_equipo ? (rolPedido || 'closers') : contexto?.rol;
    const miembroId = contexto?.puede_elegir_equipo ? miembroPedido : null;

    const filtros = useMemo(
        () => ({ period, compare, rol, miembroId }),
        [period, compare, rol, miembroId]);

    // El indicador del dock se mide del DOM porque su ancho es el del botón activo, y eso
    // depende del texto de cada sección y de si el label está visible (bajo 1120px se esconde
    // el de los inactivos). Se remide al cambiar de sección, de rol y al redimensionar.
    const navRef = useRef(null);
    const [indicador, setIndicador] = useState({ '--w': '0px', '--x': '0px' });
    useEffect(() => {
        const medir = () => {
            const nav = navRef.current;
            const activo = nav?.querySelector('[aria-current="page"]');
            if (!nav || !activo) return;
            setIndicador({ '--w': `${activo.offsetWidth}px`, '--x': `${activo.offsetLeft}px` });
        };
        const id = requestAnimationFrame(medir);
        window.addEventListener('resize', medir);
        return () => { cancelAnimationFrame(id); window.removeEventListener('resize', medir); };
    }, [seccion, rol, contexto]);

    const seccionActual = SECCIONES.find(s => s.id === seccion) || SECCIONES[0];

    /**
     * Las pestañas que esta persona puede ver. Se filtra acá y no al pintarlas porque el efecto
     * que elige la pestaña activa tiene que mirar la MISMA lista: si no, para un closer el
     * `tab` podría quedar en una pestaña que no está en pantalla y la sección se vería vacía.
     */
    const tabsVisibles = useMemo(
        () => seccionActual.tabs.filter(t => !t.soloDireccion || contexto?.puede_elegir_equipo),
        [seccionActual, contexto]);
    const tablaActual = tabla && TABLAS_POR_ROL[rol]?.includes(tabla) ? tabla : TABLAS_POR_ROL[rol]?.[0];

    /**
     * Las filas cargadas solo se le pasan a Revisar si son DE ESA tabla.
     *
     * Al cambiar de tabla (Ventas → Agendas) o de rol (Closers → Setters), `tablaActual` cambia
     * en el mismo render y las filas viejas siguen en memoria hasta que vuelve el fetch. Revisar
     * armaba entonces las columnas y las facetas de la tabla NUEVA contra las filas VIEJAS: una
     * fila de venta no tiene `pre_call`, una de agenda no tiene `estado`, y leer `.label` sobre
     * eso tira una excepción que se lleva puesto todo el árbol de React — la pantalla quedaba en
     * el fondo de la página y había que recargar (reportado por el usuario).
     *
     * La respuesta del backend ya viene rotulada con su `tabla` y su `rol`, así que alcanza con
     * compararlos. Mientras no coincidan, Revisar recibe `null` y muestra su estado de carga, que
     * es la verdad: esas filas todavía no llegaron.
     */
    const datosVigentes = datosTabla && datosTabla.tabla === tablaActual && datosTabla.rol === rol
        ? datosTabla
        : null;

    // Al cambiar de sección o de rol, la tab vuelve a la primera válida.
    useEffect(() => {
        const primera = tabsVisibles[0]?.key;
        if (primera && !tabsVisibles.some(t => t.key === tab)) setTab(primera);
    }, [tabsVisibles, tab]);

    const cargarAnalizar = useCallback(() => {
        if (!rol) return;
        getResumen(filtros).then(setResumen).catch(() => toast.error('No se pudieron cargar los KPIs'));
        if (tab === 'comparativas' && contexto?.puede_elegir_equipo) {
            getComparativas(filtros).then(setComparativas)
                .catch(() => toast.error('No se pudieron cargar las comparativas'));
        }
        // Las series por dia se piden solo al abrir su pestania: son seis y no hacen falta para
        // ver el dashboard. Se limpian antes de pedirlas para no mostrar las del rol anterior.
        if (tab === 'variabilidad') {
            setVariabilidad(null);
            getVariabilidad(filtros).then(setVariabilidad)
                .catch(() => toast.error('No se pudieron cargar las series por dia'));
        }
    }, [filtros, rol, tab, contexto]);

    const cargarTabla = useCallback(() => {
        if (!rol || !tablaActual) return;
        setCargandoTabla(true);
        getTabla(filtros, tablaActual, basis)
            .then(setDatosTabla)
            .catch(() => toast.error('No se pudo cargar la tabla'))
            .finally(() => setCargandoTabla(false));
    }, [filtros, rol, tablaActual, basis]);

    useEffect(() => { if (seccion === 'analizar') cargarAnalizar(); }, [seccion, cargarAnalizar]);
    useEffect(() => { if (seccion === 'revisar') cargarTabla(); }, [seccion, cargarTabla]);

    /**
     * Drill-down desde Analizar: abre Revisar en la tabla pedida, ya filtrada.
     *
     * `__t` es un contador y no `Date.now()`: dos clics dentro del mismo milisegundo daban el
     * mismo token y Revisar tomaba el segundo por un filtro ya consumido, así que ignoraba el
     * drill-down y mostraba el período entero. También distingue dos clics idénticos seguidos,
     * que como objeto serían iguales.
     */
    const irA = useCallback((cual, filtro) => {
        setFiltroInicial({ ...filtro, __t: ++drillDown.current });
        set(embebido ? { t: cual } : { s: 'revisar', t: cual });
        // Embebido la sección no está en la query string, la elige el host: sin este aviso el
        // filtro se aplicaba a una tabla que seguía fuera de pantalla.
        if (embebido) onIrASeccion?.('revisar');
    }, [set, embebido, onIrASeccion]);

    const irAPersona = useCallback((id) => {
        if (contexto?.puede_elegir_equipo) set({ s: 'revisar', m: id });
    }, [contexto, set]);

    /**
     * Corrige un estado y vuelve a pedir TODO lo que depende de él. Es el requisito del diseño:
     * la tabla, los chips rápidos, los totales y los KPIs se recalculan sin recargar la página.
     */
    /**
     * Agendas que parecen una copia de otra, sobre las filas cargadas. Se calcula acá y no en
     * Revisar porque el modal del lead — que es donde vive la acción — lo monta este componente.
     */
    const duplicadas = useMemo(() => duplicadasDe(datosVigentes?.filas), [datosVigentes]);

    /** Cancela una agenda duplicada y vuelve a pedir la tabla y los KPIs, como una corrección. */
    const marcarDuplicada = useCallback(async (fila) => {
        try {
            await marcarAgendaDuplicada(fila.id);
            const datos = await getTabla(filtros, tablaActual, basis);
            setDatosTabla(datos);
            setFilaAbierta(null);
            toast.success('Agenda marcada como duplicada y cancelada');
            getResumen(filtros).then(setResumen).catch(() => { /* el KPI viejo no rompe la acción */ });
        } catch (error) {
            toast.error(error?.response?.data?.message || 'No se pudo marcar la agenda como duplicada');
            throw error;
        }
    }, [filtros, tablaActual, basis]);

    const corregir = useCallback(async (fila, campo, valor) => {
        try {
            await corregirAgenda(fila.id, campo, valor);
            const datos = await getTabla(filtros, tablaActual, basis);
            setDatosTabla(datos);
            setFilaAbierta(datos.filas.find(f => f.id === fila.id && f.tipo === fila.tipo) || null);
            getResumen(filtros).then(setResumen).catch(() => { /* el KPI viejo no rompe la corrección */ });
        } catch (error) {
            toast.error(error?.response?.status === 403
                ? 'Solo puede corregirla quien la atiende o la dirección comercial'
                : 'No se pudo guardar la corrección');
            throw error;
        }
    }, [filtros, tablaActual, basis]);

    if (!contexto) {
        return (
            <div className={embebido ? 'dc-shell dc-shell--embebido' : 'dc-shell'}>
                <div className="wrap"><Cargando texto="Abriendo el dashboard…" /></div>
            </div>
        );
    }

    const secciones = SECCIONES.filter(s => !s.soloDireccion || contexto.puede_reportar);
    const titulo = contexto.puede_elegir_equipo ? seccionActual.label : `${seccionActual.label} · mis datos`;
    const salida = SALIDA[contexto.yo.rol];

    const miembroNombre = miembroId
        ? contexto.miembros.find(m => String(m.id) === String(miembroId))?.nombre
        : null;
    // La cartera no se acota al periodo (es un saldo a hoy, ver `ComercialService.clientes`), asi
    // que su linea de alcance no puede decir "este mes": diria algo que no es.
    const alcance = [miembroNombre || (contexto.puede_elegir_equipo ? 'Todo el equipo' : contexto.yo.nombre),
        tablaActual === 'clientes'
            ? 'toda la cartera'
            : contexto.periodos.find(p => p.key === period)?.label.toLowerCase(),
    ].filter(Boolean).join(' · ');

    const puedeCorregirFila = (fila) => {
        if (!fila || fila.tipo !== 'agenda') return false;
        if (contexto.puede_reportar) return true;
        if (contexto.yo.rol === 'closer') return fila.closer_id === contexto.yo.id;
        if (contexto.yo.rol === 'setter') return fila.setter_id === contexto.yo.id;
        return false;
    };

    return (
        <div className={embebido ? 'dc-shell dc-shell--embebido' : 'dc-shell'}>
            <div className="wrap">
                {!embebido && (
                <header className="tope">
                    <div className="tope-id">
                        <Isotipo />
                        <h1 className="t-h1">{titulo}</h1>
                    </div>
                    <div className="tope-meta" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                        {user?.is_impersonating ? (
                            <button type="button" className="btn btn--linea btn--sm" disabled={saliendo}
                                title="Volver a tu sesión original"
                                onClick={async () => {
                                    setSaliendo(true);
                                    try {
                                        await revertImpersonation();
                                    } catch (error) {
                                        toast.error(error?.response?.data?.message || 'No se pudo volver a tu sesión');
                                        setSaliendo(false);
                                    }
                                }}>
                                <Ghost size={15} />
                                {saliendo ? 'Volviendo…' : 'Volver a mi sesión'}
                            </button>
                        ) : salida && (
                            <Link to={salida.to} className="btn btn--linea btn--sm">
                                <ArrowLeft size={15} />
                                {salida.label}
                            </Link>
                        )}
                    </div>
                </header>
                )}

                <div className="barra">
                    {tabsVisibles.length > 0 && (
                        <Segmented opciones={tabsVisibles} valor={tab} onChange={setTab}
                            ariaLabel={`Vistas de ${seccionActual.label}`} />
                    )}

                    {seccion === 'reportar' && stepper}

                    <div className="barra-der">
                        {contexto.puede_elegir_equipo && seccion === 'analizar' && (
                            <PillMenu icono={<Users size={14} />}
                                texto={miembroNombre || 'Todo el equipo'}
                                valor={miembroId || 'all'}
                                opciones={[{ key: 'all', label: 'Todo el equipo' },
                                    ...contexto.miembros.map(m => ({ key: String(m.id), label: m.nombre }))]}
                                onChange={(k) => set({ m: k === 'all' ? null : k })} />
                        )}

                        {seccion !== 'reportar' && (
                            <PillMenu icono={<Calendar size={14} />}
                                texto={contexto.periodos.find(p => p.key === period)?.label}
                                detalle={resumen?.dates ? `${resumen.dates.start.slice(8)}–${resumen.dates.end.slice(8)}` : null}
                                valor={period} opciones={contexto.periodos}
                                onChange={(k) => set({ p: k })} />
                        )}

                        {seccion === 'analizar' && (
                            <PillMenu icono={<span className="ln-muted" style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.14em' }}>VS</span>}
                                texto={contexto.comparaciones.find(c => c.key === compare)?.label}
                                valor={compare} opciones={contexto.comparaciones} ancho={250}
                                onChange={(k) => set({ vs: k })} />
                        )}
                    </div>
                </div>

                {/* `.vista` es lo que separa las filas de paneles: sin el, cada seccion
                    renderiza sus filas como hermanas sueltas y quedan pegadas (medido: 0px
                    entre todas). Ademas trae la animacion de entrada de la referencia. */}
                <div className="vista">
                    {seccion === 'analizar' && tab === 'dashboard' && (
                        <Analizar datos={resumen} rol={rol} irA={irA} />
                    )}
                    {seccion === 'analizar' && tab === 'comparativas' && contexto.puede_elegir_equipo && (
                        <Comparativas datos={comparativas} irAPersona={irAPersona} />
                    )}
                    {seccion === 'analizar' && tab === 'variabilidad' && (
                        <Variabilidad datos={variabilidad} />
                    )}
                    {seccion === 'revisar' && (
                        <Revisar tabla={tablaActual} setTabla={(t) => set({ t })} datos={datosVigentes}
                            cargando={cargandoTabla || !datosVigentes} rol={rol} basis={basis} setBasis={setBasis}
                            alcance={alcance} filtroInicial={filtroInicial}
                            onAbrirFila={abrirFila} />
                    )}
                    {seccionActual.pronto && <ProntoSection seccion={seccionActual} />}
                    {seccion === 'reportar' && contexto.puede_reportar && (
                        <Reportar tab={tab} setTab={setTab} miembros={contexto.miembros}
                            onStepper={setStepper}
                            irAPersona={(persona) => set({ s: 'revisar', m: persona.id, p: 'hoy' })} />
                    )}
                </div>

                <LeadModal fila={filaAbierta} estados={contexto.estados}
                    puedeCorregir={puedeCorregirFila(filaAbierta)}
                    duplicadaDe={filaAbierta ? duplicadas[filaAbierta.id] : null}
                    onCorregir={corregir} onMarcarDuplicada={marcarDuplicada}
                    onCerrar={() => setFilaAbierta(null)} />

                {!embebido && (
                <nav className="dock caja" aria-label="Secciones del dashboard comercial">
                    <Humo colores={['var(--brand-secondary)', 'var(--brand-primary)',
                        'var(--brand-secondary-light)', 'var(--brand-navy)']} />
                    {contexto.puede_elegir_equipo && (
                        <div className="dock-rol caja">
                            <Humo colores={['var(--brand-secondary)', 'var(--brand-primary)',
                                'var(--brand-secondary-light)', 'var(--brand-navy)']} />
                            {[['closers', 'Closers'], ['setters', 'Setters']].map(([k, label]) => (
                                <button key={k} type="button" aria-pressed={rol === k}
                                    onClick={() => set({ rol: k, t: null, m: null })}>
                                    <span className="punto" />
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {contexto.puede_elegir_equipo && <span className="dock-sep" />}
                    <div className="dock-nav" ref={navRef}>
                        {/* Indicador que se desliza hasta el item activo, en vez de que cada uno
                            pinte su propio fondo: el movimiento dice de dónde a dónde se fue. */}
                        <span className="dock-ind" style={indicador} aria-hidden="true" />
                        {secciones.map((s_, i) => (
                            <button key={s_.id} type="button" className="dock-item"
                                aria-current={seccion === s_.id ? 'page' : undefined}
                                aria-label={s_.label} onClick={() => set({ s: s_.id })}>
                                <span className="dock-num">{i + 1}</span>
                                <s_.Icono size={20} />
                                <span className="dock-label">{s_.label}</span>
                                {s_.pronto && <span className="dock-pronto">Pronto</span>}
                            </button>
                        ))}
                    </div>
                </nav>
                )}
            </div>
        </div>
    );
};

export default DashboardComercial;
