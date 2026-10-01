import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, CalendarRange, CheckCircle2, Ghost, Inbox, LogOut, Search, Target, Users, VenetianMask } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { revertImpersonation, simularA } from '../../utils/impersonation';
import './comercial.css';
import '../../components/dashboard/pareja.css';
import '../../components/learnation-ds/learnation-ds.css';
import { EsqueletoPagina, Humo, Isotipo, PillMenu, Segmented } from './components/Shared';
import DockSecciones, { HUMO_DOCK } from './components/DockSecciones';
import MenuSesion from './components/MenuSesion';
import Analizar from './components/Analizar';
import Comparativas from './components/Comparativas';
import Variabilidad from './components/Variabilidad';
import Revisar, { TABLAS_POR_ROL, duplicadasDe } from './components/Revisar';
import LeadModal from './components/LeadModal';
import FichaLeadModal from '../../components/ficha/FichaLeadModal';
import Reportar from './components/Reportar';
import RangoFechas, { mesEnCurso, rangoAnterior, rangoDe, textoRango } from './components/RangoFechas';
import { corregirAgenda, eliminarAgenda as eliminarAgendaApi, getComparativas, getContexto, getResumen, getTabla, getVariabilidad, marcarAgendaDuplicada } from './comercialApi';
import { sincronizarAcademia as sincronizarAcademiaApi } from './comercialApi';

/**
 * La ficha unificada se pide por agenda o por cliente, así que una fila la puede abrir solo si
 * trae uno de los dos.
 *
 * Una venta ahora sí: el backend le resuelve el `client_id` —el guardado, y si no lo tiene, el
 * que sale de cruzar su contacto (ver `clientes_de_ventas`)—, lo que cubre 867 de las 897 ventas
 * de la base local. Las 30 que no se cruzan con ningún cliente siguen con el modal viejo, porque
 * no hay ficha que abrir: no es una degradación, es que esa venta no tiene a quién pertenecer.
 *
 * Un lead de ManyChat sigue afuera por el mismo motivo, y ese sí es un pendiente: su fila no
 * trae ninguna de las dos claves.
 */
const esFichaUnificada = (fila) => (fila?.tipo === 'agenda' && !!fila.id)
    || (fila?.tipo === 'cliente' && !!fila.client_id)
    || (fila?.tipo === 'venta' && !!fila.client_id);

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
 * cambio, la salida la ofrece esta pantalla: la vuelta al lugar de trabajo de cada rol y, si es
 * una simulación, además "Volver a mi sesión" (ver `revertImpersonation`, que existe justamente
 * para las sub-apps sin MainLayout). Al final del dock va la sesión (`MenuSesion`): cerrar
 * sesión, volver de una simulación y, para la dirección, "Simular a un closer".
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
 * resuelve `onIrASeccion(seccion, queryString)`, con el que el host cambia su propia pestaña ("Mi
 * cartera" en el mazo del closer, Reporte · Registros en el espacio del setter). El segundo
 * argumento es la URL con el filtro ya escrito, para el host que también navega por la URL (el del
 * setter). Un host que no lo pasa no tiene lista, y entonces no hay drill-down.
 *
 * `onAbrirCliente` es la otra salida al host: en la tabla Clientes, una fila NO es una agenda que
 * corregir sino un cliente al que hay que cobrarle, y el modal de corrección de esta pantalla no
 * sirve para eso. Cuando el host sabe abrir la gestión del cliente (el mazo del closer, que tiene
 * el cockpit de cobro y el wizard de venta), le pasa el `client_id` y esta pantalla no abre nada.
 * Sin esa prop —la dirección comercial, que mira pero no cobra— se sigue abriendo el modal de
 * siempre, que es además lo único que sus permisos le permiten hacer.
 */

/**
 * A dónde vuelve cada rol cuando sale del dashboard. El setter no está: nunca lo ve suelto, lo ve
 * embebido en su espacio, donde la vuelta es el dock (ver `SetterEspacioPage`). La dirección
 * comercial tampoco, desde el 30/09/2026: su "Ir a Ventas" se sacó a pedido; su sesión (simular a
 * un closer, cerrar sesión) está en el menú del dock.
 */
const SALIDA = {
    closer: { to: '/closer/deck?step=confirmations', label: 'Volver al mazo' },
    admin: { to: '/admin/ventas', label: 'Ir a Ventas' },
};

/**
 * Quién puede elegir "Simular a un closer" en el menú de sesión: lo decide el backend
 * (`/auth/impersonate`), esto solo evita ofrecerle la opción a quien recibiría un 403. Se mira el
 * rol REAL: simulando a un closer, la dirección sigue pudiendo pasar a otro.
 */
const SIMULAN_CLOSERS = ['director_comercial', 'admin', 'operator'];

const ROTULO_DE_ROL = {
    director_comercial: 'Dirección comercial',
    admin: 'Admin',
    operator: 'Operaciones',
    closer: 'Closer',
};

const cargarCloseresParaSimular = async () => {
    const res = await api.get('/auth/impersonate/closers');
    return (res.data?.closers || []).map(c => ({
        id: c.id,
        label: c.username,
        onClick: async () => {
            const aviso = toast.loading(`Entrando como ${c.username}…`);
            try {
                await simularA(c.id);
            } catch (error) {
                toast.error(error?.response?.status === 403
                    ? `No podés simular a ${c.username}`
                    : `No se pudo simular a ${c.username}`, { id: aviso });
            }
        },
    }));
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

/**
 * Con qué fecha arranca el toggle "Fecha meet / F. creación" de cada tabla: la MISMA con la que el
 * backend cuenta su número, para que la lista recién abierta cierre con el dato de Analizar. Las
 * agendas generadas se cuentan por cuándo se reservaron (ver `ComercialService.generadas`); las
 * del closer, por cuándo cae la reunión.
 */
const BASIS_INICIAL = { generadas: 'creacion' };

const PRONTO = {
    proyectar: 'Vas a poder proyectar el cierre del mes con el ritmo actual y ajustar la meta. Estamos puliendo el cálculo.',
    simulador: 'Vas a poder mover cada palanca del embudo y ver cuánto cambia el resultado. Estamos puliendo el modelo.',
};

const ProntoSection = ({ seccion }) => (
    <section className="panel">
        <div className="vacio-grande">
            <span className="vacio-icono"><seccion.Icono size={24} /></span>
            <h2 className="t-h2">{seccion.label} llega pronto</h2>
            <p className="t-sm mut">{PRONTO[seccion.id]}</p>
        </div>
    </section>
);

/** En lugar de los datos, mientras a un rango personalizado le falta una fecha: con los campos
 *  ahí mismo, para no tener que ir a buscarlos a la píldora. */
const FaltaFecha = ({ texto, children }) => (
    <section className="panel">
        <div className="vacio-grande vacio-grande--rango">
            <span className="vacio-icono"><CalendarRange size={24} /></span>
            <p className="t-sm mut">{texto}</p>
            {children}
        </div>
    </section>
);

const DashboardComercial = ({ embebido = false, seccionFija = null, onIrASeccion = null, onAbrirCliente = null }) => {
    const [params, setParams] = useSearchParams();
    const [contexto, setContexto] = useState(null);
    const { user, logout } = useAuth();
    const [saliendo, setSaliendo] = useState(false);

    const seccion = seccionFija || params.get('s') || 'analizar';
    const period = params.get('p') || 'mes';
    const compare = params.get('vs') || 'prev';
    /**
     * Las fechas de "Personalizado" van en la URL (`d`/`h`), como el resto del filtro: así las
     * ven los dos montajes del mazo del closer, sobreviven al drill-down a Revisar y a "atrás", y
     * un link las comparte. Sin las dos no se pide nada (ver `faltaPeriodo`): el backend, sin
     * fechas, cae al mes en curso, y eso es lo que se veía bajo la etiqueta "Personalizado".
     */
    const rango = period === 'custom' ? rangoDe(params.get('d'), params.get('h')) : null;
    const faltaPeriodo = period === 'custom' && !rango;
    // La comparación personalizada tiene sus propias fechas (`vd`/`vh`), independientes del
    // período: un mes contra una semana es una lectura válida y el backend no la recorta.
    const rangoVs = compare === 'custom' ? rangoDe(params.get('vd'), params.get('vh')) : null;
    const faltaVs = compare === 'custom' && !rangoVs;
    const rolPedido = params.get('rol');
    const miembroPedido = params.get('m');
    const tabla = params.get('t') || null;

    const [tab, setTab] = useState('dashboard');
    // La fecha que alguien eligió A MANO en el toggle, por tabla. Sin elección manda `BASIS_INICIAL`.
    const [basisElegida, setBasisElegida] = useState({});
    const [resumen, setResumen] = useState(null);
    const [comparativas, setComparativas] = useState(null);
    const [variabilidad, setVariabilidad] = useState(null);
    const [datosTabla, setDatosTabla] = useState(null);
    const [cargandoTabla, setCargandoTabla] = useState(false);
    const [filaAbierta, setFilaAbierta] = useState(null);

    /**
     * El filtro del drill-down viaja en la QUERY STRING, no en estado local.
     *
     * Embebido en el mazo del closer hay DOS montajes distintos de esta pantalla —uno con
     * `seccionFija="analizar"` y otro con `seccionFija="revisar"`— y el host cambia de uno al
     * otro. Con el filtro en `useState` se perdía en el camino: se clickeaba un dato en "Ver mis
     * datos", aterrizaba en "Mi cartera" con la tabla correcta y sin ninguna condición puesta.
     * Solo `t` sobrevivía, porque era lo único que iba por la URL.
     *
     * En la URL además la vista filtrada se puede compartir y volver con el botón "atrás", y
     * cualquier otra pantalla puede linkear a un corte concreto de la lista (es así como los
     * datos del dashboard de performance del closer llegan acá).
     */
    const filtroInicial = useMemo(() => {
        const t = Number(params.get('ft'));
        if (!t) return null;
        const crudo = params.get('f');
        let filtro = {};
        if (crudo) {
            try {
                filtro = JSON.parse(crudo);
            } catch {
                // Una URL escrita a mano o cortada por un cliente de mail: se ignora el filtro y
                // se muestra la tabla entera, que es un destino válido, en vez de romper.
                filtro = {};
            }
        }
        return { ...filtro, __t: t };
    }, [params]);

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

    // Devuelve la query string que dejó escrita: el drill-down embebido se la pasa al host (ver
    // `irA`), que también escribe en la URL en el mismo clic y tiene que partir de esta.
    const set = useCallback((cambios) => {
        const siguiente = new URLSearchParams(params);
        Object.entries(cambios).forEach(([k, v]) => {
            if (v === null || v === undefined || v === '') siguiente.delete(k);
            else siguiente.set(k, v);
        });
        setParams(siguiente, { replace: true });
        return siguiente;
    }, [params, setParams]);

    useEffect(() => {
        getContexto().then(setContexto).catch(() => toast.error('No se pudo abrir el dashboard comercial'));
    }, []);

    // El rol y la persona efectivos: para un closer o un setter los manda el backend y la query
    // string no puede cambiarlos (ver `alcance_de` en app/api/comercial.py).
    const rol = contexto?.puede_elegir_equipo ? (rolPedido || 'closers') : contexto?.rol;
    // Las personas del selector son las del rol elegido: con Setters, los setters. Un `m` de la
    // URL que no es de ese rol (un link viejo, o el closer que quedó elegido al cambiar el switch)
    // se ignora y se ve el equipo: acotar las agendas de setters por el id de un closer daba 0.
    const miembrosDelRol = contexto?.miembros_por_rol?.[rol] || contexto?.miembros || [];
    const miembroId = contexto?.puede_elegir_equipo
        && miembrosDelRol.some(m => String(m.id) === String(miembroPedido)) ? miembroPedido : null;

    const filtros = useMemo(
        () => ({ period, compare, rol, miembroId, desde: rango?.desde, hasta: rango?.hasta,
            vsDesde: rangoVs?.desde, vsHasta: rangoVs?.hasta }),
        [period, compare, rol, miembroId, rango?.desde, rango?.hasta, rangoVs?.desde, rangoVs?.hasta]);

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

    // Una fecha por tabla y no una sola: con una sola, la fecha por creación de "Agendas generadas"
    // se arrastraba a "Agendas" del closer, cuyo número se cuenta por la reunión.
    const basis = basisElegida[tablaActual] || BASIS_INICIAL[tablaActual] || 'meet';
    const setBasis = useCallback(
        (valor) => setBasisElegida(prev => ({ ...prev, [tablaActual]: valor })), [tablaActual]);
    // Un drill-down abre la lista con la fecha con la que se contó el dato clickeado: una elección
    // manual anterior del toggle dejaría una lista que no cierra con ese número.
    const olvidarBasis = useCallback((cual) => setBasisElegida((prev) => {
        if (!cual || !(cual in prev)) return prev;
        const resto = { ...prev };
        delete resto[cual];
        return resto;
    }), []);

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

    /**
     * Solo la respuesta del ÚLTIMO pedido de cada cosa llega a la pantalla.
     *
     * Cambiar de filtro dispara un pedido nuevo sin cancelar el anterior, y no vuelven en orden:
     * 90 días tarda más que un día. Si la respuesta vieja llegaba después, pisaba los números con
     * los de un período que ya no estaba elegido, debajo de la píldora que decía el nuevo.
     */
    const pedidos = useRef({});
    const soloElUltimo = useCallback((clave, poner) => {
        const n = (pedidos.current[clave] || 0) + 1;
        pedidos.current[clave] = n;
        return (datos) => { if (pedidos.current[clave] === n) poner(datos); };
    }, []);

    /**
     * ¿Hay que esperar una fecha antes de pedir esta vista? Revisar no compara (su VS ni se
     * muestra), así que solo espera al período; y la cartera (tabla Clientes) es un saldo a hoy que
     * no se acota al período, así que se pide igual.
     */
    const esperaFechas = seccion === 'analizar' ? faltaPeriodo || faltaVs
        : seccion === 'revisar' && faltaPeriodo && tablaActual !== 'clientes';

    const cargarAnalizar = useCallback(() => {
        if (!rol || faltaPeriodo || faltaVs) return;
        getResumen(filtros).then(soloElUltimo('resumen', setResumen))
            .catch(() => toast.error('No se pudieron cargar los KPIs'));
        if (tab === 'comparativas' && contexto?.puede_elegir_equipo) {
            getComparativas(filtros).then(soloElUltimo('comparativas', setComparativas))
                .catch(() => toast.error('No se pudieron cargar las comparativas'));
        }
        // Las series por dia se piden solo al abrir su pestania: son seis y no hacen falta para
        // ver el dashboard. Se limpian antes de pedirlas para no mostrar las del rol anterior.
        if (tab === 'variabilidad') {
            setVariabilidad(null);
            getVariabilidad(filtros).then(soloElUltimo('variabilidad', setVariabilidad))
                .catch(() => toast.error('No se pudieron cargar las series por dia'));
        }
    }, [filtros, rol, tab, contexto, soloElUltimo, faltaPeriodo, faltaVs]);

    const cargarTabla = useCallback(() => {
        if (!rol || !tablaActual || (faltaPeriodo && tablaActual !== 'clientes')) return;
        setCargandoTabla(true);
        getTabla(filtros, tablaActual, basis)
            .then(soloElUltimo('tabla', setDatosTabla))
            .catch(() => toast.error('No se pudo cargar la tabla'))
            .finally(() => setCargandoTabla(false));
    }, [filtros, rol, tablaActual, basis, soloElUltimo, faltaPeriodo]);

    useEffect(() => { if (seccion === 'analizar') cargarAnalizar(); }, [seccion, cargarAnalizar]);
    useEffect(() => { if (seccion === 'revisar') cargarTabla(); }, [seccion, cargarTabla]);

    /**
     * Drill-down desde Analizar: abre Revisar en la tabla pedida, ya filtrada.
     *
     * `ft` es un contador y no `Date.now()`: dos clics dentro del mismo milisegundo daban el
     * mismo token y Revisar tomaba el segundo por un filtro ya consumido, así que ignoraba el
     * drill-down y mostraba el período entero. También distingue dos clics idénticos seguidos,
     * que como objeto serían iguales.
     *
     * El contador arranca del token que ya está en la URL y no de cero, porque los dos montajes
     * embebidos tienen cada uno su propio `ref`: sin el `max` el segundo montaje volvía a emitir
     * el token 1 y Revisar lo tomaba por el mismo filtro de antes.
     */
    const proximoToken = useCallback(() => {
        drillDown.current = Math.max(drillDown.current, Number(params.get('ft')) || 0) + 1;
        return drillDown.current;
    }, [params]);

    const irA = useCallback((cual, filtro) => {
        const limpio = Object.fromEntries(
            Object.entries(filtro || {}).filter(([, v]) => v !== null && v !== undefined));
        olvidarBasis(cual);
        const siguiente = set({
            ...(embebido ? {} : { s: 'revisar' }),
            t: cual,
            f: Object.keys(limpio).length ? JSON.stringify(limpio) : null,
            ft: proximoToken(),
        });
        // Embebido la sección no está en la query string, la elige el host: sin este aviso el
        // filtro se aplicaba a una tabla que seguía fuera de pantalla. Va con la query string
        // recién escrita porque un host que guarda su sección en la URL navega en este mismo
        // clic: `setSearchParams` arma la suya desde la URL del render, que todavía no tiene
        // `t`/`f`/`ft`, y pisaba el filtro — la lista abría sin ninguna condición.
        if (embebido) onIrASeccion?.('revisar', siguiente);
    }, [set, embebido, onIrASeccion, proximoToken, olvidarBasis]);

    /**
     * El drill-down solo existe si hay una lista a la que llegar. Embebido, esa lista es del host:
     * sin `onIrASeccion` no hay a dónde ir, y cada flecha y cada número cliqueable llevarían a
     * ninguna parte. Sin `irA`, Analizar y Variabilidad muestran los números como números.
     */
    const irADetalle = embebido && !onIrASeccion ? null : irA;

    /**
     * Ir a la lista de UNA persona, opcionalmente con el corte de una métrica.
     *
     * La persona se acota con `m` (el backend rearma el alcance) y no con la faceta Closer: así
     * la tira de totales y los contadores de faceta también quedan acotados, que es lo que hace
     * que el número de la celda cierre con lo que se ve abajo.
     */
    const irAPersona = useCallback((id, destino = null) => {
        if (!contexto?.puede_elegir_equipo) return;
        const filtro = destino?.filtro || {};
        if (destino) olvidarBasis(destino.tabla);
        set({
            s: 'revisar',
            m: id && id !== 'equipo' ? id : null,
            ...(destino ? {
                t: destino.tabla,
                f: Object.keys(filtro).length ? JSON.stringify(filtro) : null,
                ft: proximoToken(),
            } : {}),
        });
    }, [contexto, set, proximoToken, olvidarBasis]);

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

    // `puede_reportar` es exactamente "es dirección" en el backend (ver /comercial/contexto), que
    // es el mismo permiso con el que la ruta DELETE responde 403 al resto. Un solo criterio.
    const eliminarAgenda = useCallback(async (fila) => {
        try {
            await eliminarAgendaApi(fila.id);
            const datos = await getTabla(filtros, tablaActual, basis);
            setDatosTabla(datos);
            setFilaAbierta(null);
            toast.success('Agenda eliminada');
            getResumen(filtros).then(setResumen).catch(() => { /* el KPI viejo no rompe la acción */ });
        } catch (error) {
            toast.error(error?.response?.data?.message || 'No se pudo eliminar la agenda');
            throw error;
        }
    }, [filtros, tablaActual, basis]);

    /**
     * "Actualizar datos de la Academia" (solo la dirección): corre un lote de fotos y vuelve a pedir
     * la tabla. El mensaje lo arma el backend, que es el que sabe si el lote se cortó por el límite
     * de la Academia, por un token inválido o porque alcanzó su presupuesto.
     */
    const sincronizarAcademia = useCallback(async () => {
        try {
            const resultado = await sincronizarAcademiaApi();
            const aviso = ['401', 'red', 'sin_token'].includes(resultado.corte) ? toast.error
                : resultado.corte === '429' ? toast : toast.success;
            aviso(resultado.mensaje);
            cargarTabla();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'No se pudieron actualizar los datos de la Academia');
        }
    }, [cargarTabla]);

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
                <div className="wrap"><EsqueletoPagina /></div>
            </div>
        );
    }

    const secciones = SECCIONES.filter(s => !s.soloDireccion || contexto.puede_reportar);
    const titulo = contexto.puede_elegir_equipo ? seccionActual.label : `${seccionActual.label} · mis datos`;
    const salida = SALIDA[contexto.yo.rol];

    const miembroNombre = miembroId
        ? miembrosDelRol.find(m => String(m.id) === String(miembroId))?.nombre
        : null;
    const etiquetaPeriodo = contexto.periodos.find(p => p.key === period)?.label;
    // La cartera no se acota al periodo (es un saldo a hoy, ver `ComercialService.clientes`), asi
    // que su linea de alcance no puede decir "este mes": diria algo que no es. Un rango elegido a
    // mano se dice con sus fechas: "personalizado" no dice de cuándo son las filas.
    const alcance = [miembroNombre || (contexto.puede_elegir_equipo ? 'Todo el equipo' : contexto.yo.nombre),
        tablaActual === 'clientes'
            ? 'toda la cartera'
            : (rango ? textoRango(rango) : etiquetaPeriodo?.toLowerCase()),
    ].filter(Boolean).join(' · ');

    /**
     * Elegir "Personalizado" arranca del rango que se está viendo —el de los datos en pantalla—, y
     * si todavía no hay datos, del mes en curso: los campos nunca abren vacíos. Cualquier otro
     * período suelta las fechas, para que la URL no arrastre un rango que ya no se usa.
     */
    const fechasEnPantalla = seccion === 'revisar' ? datosVigentes?.dates : resumen?.dates;
    const elegirPeriodo = (k) => {
        if (k !== 'custom') {
            set({ p: k, d: null, h: null });
            return;
        }
        if (period === 'custom') return;
        const inicial = (fechasEnPantalla && rangoDe(fechasEnPantalla.start, fechasEnPantalla.end)) || mesEnCurso();
        set({ p: 'custom', d: inicial.desde, h: inicial.hasta });
    };
    const camposDelPeriodo = (
        <RangoFechas rotulo="Período"
            desde={rango?.desde ?? (params.get('d') || '')} hasta={rango?.hasta ?? (params.get('h') || '')}
            onCambiar={({ desde, hasta }) => set({ p: 'custom', d: desde || null, h: hasta || null })} />
    );

    /**
     * La comparación personalizada arranca de la comparación que se está viendo; sin una (con
     * "Sin comparar", o antes de los datos), de los mismos días justo antes del período.
     */
    const elegirComparacion = (k) => {
        if (k !== 'custom') {
            set({ vs: k, vd: null, vh: null });
            return;
        }
        if (compare === 'custom') return;
        const periodoEnPantalla = (fechasEnPantalla && rangoDe(fechasEnPantalla.start, fechasEnPantalla.end))
            || rango || mesEnCurso();
        const inicial = (resumen?.dates && rangoDe(resumen.dates.compare_start, resumen.dates.compare_end))
            || rangoAnterior(periodoEnPantalla);
        set({ vs: 'custom', vd: inicial.desde, vh: inicial.hasta });
    };
    const camposDeLaComparacion = (
        <RangoFechas rotulo="Comparación"
            desde={rangoVs?.desde ?? (params.get('vd') || '')} hasta={rangoVs?.hasta ?? (params.get('vh') || '')}
            onCambiar={({ desde, hasta }) => set({ vs: 'custom', vd: desde || null, vh: hasta || null })} />
    );

    const volverAMiSesion = async () => {
        setSaliendo(true);
        try {
            await revertImpersonation();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'No se pudo volver a tu sesión');
            setSaliendo(false);
        }
    };

    const rolReal = user?.is_impersonating ? user?.original_user_role : user?.role;
    const gruposDeSesion = [
        SIMULAN_CLOSERS.includes(rolReal) ? [{
            id: 'simular', label: 'Simular a un closer', Icono: VenetianMask,
            panel: { titulo: 'Simular a un closer', vacio: 'No hay closers activos.', cargar: cargarCloseresParaSimular },
        }] : [],
        [
            ...(user?.is_impersonating
                ? [{ id: 'volver', label: 'Volver a mi sesión', Icono: Ghost, onClick: volverAMiSesion }]
                : []),
            { id: 'salir', label: 'Cerrar sesión', Icono: LogOut, peligro: true,
                onClick: () => { if (window.confirm('¿Cerrar sesión?')) logout(); } },
        ],
    ];
    const rotuloDeRol = [ROTULO_DE_ROL[contexto.yo.rol] || contexto.yo.rol, user?.is_impersonating && 'simulación']
        .filter(Boolean).join(' · ');

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
                        {/* La vuelta al lugar de trabajo va SIEMPRE, también simulando. Antes era
                            una u otra: simulando a un closer, la única salida de esta pantalla era
                            terminar la simulación, y no había cómo volver a su mazo. */}
                        {salida && (
                            <Link to={salida.to} className="btn btn--linea btn--sm">
                                <ArrowLeft size={15} />
                                {salida.label}
                            </Link>
                        )}
                        {user?.is_impersonating && (
                            <button type="button" className="btn btn--linea btn--sm" disabled={saliendo}
                                title="Volver a tu sesión original" onClick={volverAMiSesion}>
                                <Ghost size={15} />
                                {saliendo ? 'Volviendo…' : 'Volver a mi sesión'}
                            </button>
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
                                    ...miembrosDelRol.map(m => ({ key: String(m.id), label: m.nombre }))]}
                                onChange={(k) => set({ m: k === 'all' ? null : k })} />
                        )}

                        {/* Con "Personalizado" la píldora dice el rango, y su menú queda abierto
                            con las dos fechas debajo de los períodos. */}
                        {seccion !== 'reportar' && (
                            <PillMenu icono={<Calendar size={14} />} rotulo="período"
                                texto={rango ? textoRango(rango) : etiquetaPeriodo}
                                detalle={period !== 'custom' && resumen?.dates
                                    ? `${resumen.dates.start.slice(8)}–${resumen.dates.end.slice(8)}` : null}
                                valor={period}
                                opciones={contexto.periodos.map(p => (p.key === 'custom' ? { ...p, quedaAbierto: true } : p))}
                                ancho={period === 'custom' ? 324 : undefined}
                                pie={period === 'custom' ? camposDelPeriodo : null}
                                onChange={elegirPeriodo} />
                        )}

                        {seccion === 'analizar' && (
                            <PillMenu icono={<span className="ln-muted" style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.14em' }}>VS</span>}
                                rotulo="comparación"
                                texto={rangoVs ? textoRango(rangoVs) : contexto.comparaciones.find(c => c.key === compare)?.label}
                                valor={compare}
                                opciones={contexto.comparaciones.map(c => (c.key === 'custom' ? { ...c, quedaAbierto: true } : c))}
                                ancho={compare === 'custom' ? 324 : 250}
                                pie={compare === 'custom' ? camposDeLaComparacion : null}
                                onChange={elegirComparacion} />
                        )}
                    </div>
                </div>

                {/* `.vista` es lo que separa las filas de paneles: sin el, cada seccion
                    renderiza sus filas como hermanas sueltas y quedan pegadas (medido: 0px
                    entre todas). Ademas trae la animacion de entrada de la referencia. */}
                <div className="vista">
                    {/* Sin las dos fechas no se pide nada: se piden acá, en vez de mostrar los
                        datos de otro rango bajo la etiqueta "Personalizado". */}
                    {esperaFechas && faltaPeriodo && (
                        <FaltaFecha texto="Elegí las dos fechas del período.">{camposDelPeriodo}</FaltaFecha>
                    )}
                    {esperaFechas && !faltaPeriodo && (
                        <FaltaFecha texto="Elegí las dos fechas de la comparación.">{camposDeLaComparacion}</FaltaFecha>
                    )}
                    {!esperaFechas && seccion === 'analizar' && tab === 'dashboard' && (
                        <Analizar datos={resumen} rol={rol} irA={irADetalle} />
                    )}
                    {!esperaFechas && seccion === 'analizar' && tab === 'comparativas' && contexto.puede_elegir_equipo && (
                        <Comparativas datos={comparativas} irAPersona={irAPersona} />
                    )}
                    {!esperaFechas && seccion === 'analizar' && tab === 'variabilidad' && (
                        <Variabilidad datos={variabilidad} rol={rol} irA={irADetalle} />
                    )}
                    {/* Cambiar de tabla o quitar el filtro a mano también lo saca de la URL: si
                        no, salir de Revisar y volver lo resucitaba, porque la URL es la que manda
                        y el estado interno de Revisar se pierde al desmontarse. */}
                    {!esperaFechas && seccion === 'revisar' && (
                        <Revisar tabla={tablaActual} setTabla={(t) => set({ t, f: null, ft: null })}
                            datos={datosVigentes}
                            cargando={cargandoTabla || !datosVigentes} rol={rol} basis={basis} setBasis={setBasis}
                            alcance={alcance} filtroInicial={filtroInicial}
                            puedeElegirEquipo={!!contexto.puede_elegir_equipo}
                            onOlvidarFiltro={() => set({ f: null, ft: null })}
                            onAbrirFila={abrirFila}
                            onSincronizarAcademia={contexto.puede_reportar ? sincronizarAcademia : null} />
                    )}
                    {seccionActual.pronto && <ProntoSection seccion={seccionActual} />}
                    {seccion === 'reportar' && contexto.puede_reportar && (
                        <Reportar tab={tab} setTab={setTab} miembros={contexto.miembros}
                            onStepper={setStepper}
                            irAPersona={(persona) => set({ s: 'revisar', m: persona.id, p: 'hoy', d: null, h: null })} />
                    )}
                </div>

                {/* Una agenda, un cliente y una venta abren la ficha unificada: el recorrido
                    entero del lead en un solo modal, con la pestaña que corresponde al estado en
                    el que está. Antes eran dos modales distintos y ninguno mostraba todo.

                    Un lead de ManyChat sigue con el modal viejo: su fila no trae ni agenda ni
                    cliente con los que pedir la ficha. */}
                {filaAbierta && (esFichaUnificada(filaAbierta) ? (
                    <FichaLeadModal
                        appointmentId={filaAbierta.tipo === 'agenda' ? filaAbierta.id : null}
                        clientId={filaAbierta.tipo === 'agenda' ? null : filaAbierta.client_id}
                        onCerrar={() => setFilaAbierta(null)}
                        onCambio={() => { cargarTabla(); cargarAnalizar(); }} />
                ) : (
                    <LeadModal fila={filaAbierta} estados={contexto.estados}
                        puedeCorregir={puedeCorregirFila(filaAbierta)}
                        duplicadaDe={duplicadas[filaAbierta.id]}
                        onCorregir={corregir} onMarcarDuplicada={marcarDuplicada}
                        onEliminar={contexto.puede_reportar ? eliminarAgenda : null}
                        onCerrar={() => setFilaAbierta(null)} />
                ))}

                {!embebido && (
                    <DockSecciones secciones={secciones} activa={seccion}
                        onElegir={(id) => set({ s: id })}
                        ariaLabel="Secciones del dashboard comercial"
                        despues={<MenuSesion nombre={contexto.yo.nombre} rol={rotuloDeRol} grupos={gruposDeSesion} />}
                        antes={contexto.puede_elegir_equipo && (
                            <div className="dock-rol caja">
                                <Humo colores={HUMO_DOCK} />
                                {[['closers', 'Closers'], ['setters', 'Setters']].map(([k, label]) => (
                                    <button key={k} type="button" aria-pressed={rol === k}
                                        onClick={() => set({ rol: k, t: null, m: null })}>
                                        <span className="punto" />
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>
                        )} />
                )}
            </div>
        </div>
    );
};

export default DashboardComercial;
