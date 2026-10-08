import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Filter, LayoutGrid, List, Plus, Rows, RotateCcw, Search,
    SlidersHorizontal, X } from 'lucide-react';
// El ícono "i" es el `Tip` compartido: la burbuja va en un portal porque acá cae al final de la
// barra, pegada al borde derecho, y antes se cortaba (ver `Tip.jsx`).
import { Tip, fmt } from './Shared';
import Cifra from './Cifra';
import { DIMENSION_PROPIA, TABLAS, TABLAS_POR_ROL } from './tablasDef';
import PanelConfigurar from './PanelConfigurar';
import RevisarLista, { EsqueletoRevisar } from './RevisarLista';
import { columnasOrdenables, ordenarFilas, siguienteOrden } from './ordenFilas';
import MenuOrdenar from './MenuOrdenar';
import AcademiaBarra, { SelectorColumnas } from './AcademiaBarra';
import { itemTotalAcademia } from './academia';
import { useModoVista } from '../../../components/listas/useModoVista';
import { useGruposElegidos } from '../../../components/listas/useGruposElegidos';

// La definición de las tablas vive en `tablasDef.js` (ver su docstring). Se re-exporta lo que ya
// importaban otros archivos por este camino, para no mover los imports de media pantalla.
export { TABLAS_POR_ROL, duplicadasDe, estadoDeAgenda, fueConfirmada, asistio, presento, respondio,
    cualificado } from './tablasDef';
// `ChipTono` se fue con la celda a `RevisarLista.jsx`; se re-exporta porque `LeadModal` la pide
// por este camino.
export { ChipTono } from './RevisarLista';

/**
 * Revisar: el libro de registros con un buscador, un filtro rápido, UN botón que abre todas las
 * facetas y la tira de totales de lo filtrado arriba de la tabla.
 *
 * Todo el filtrado (búsqueda, facetas y filtro rápido) se hace en el cliente sobre las filas del
 * período, que ya vienen del backend. Eso es lo que permite que los contadores del filtro rápido,
 * el "mostrando X de Y" y los totales se recalculen juntos con el mismo conjunto de filas: si cada
 * uno consultara por su cuenta, podrían discrepar.
 *
 * Los totales cuentan EXACTAMENTE las filas que muestra la lista: período, búsqueda, facetas y
 * filtro rápido. Hasta el 30/09/2026 ignoraban el filtro rápido (se lo tomaba como un atajo de
 * lectura); el usuario pidió que la tira muestre los datos según lo que se está filtrando, así que
 * con «Con deuda» elegido, la deuda de la tira es la de esa lista y su cuenta es la de "mostrando".
 *
 * `datos` puede llegar en `null` mientras el backend todavía no devolvió las filas de la tabla
 * pedida (ver el fix de DashboardComercial): las filas que llegan acá SON siempre de la tabla
 * que se pidió, así que los accesores no llevan guardas.
 */

const texto = (fila) => [fila.cliente, fila.ig, fila.email, fila.telefono, fila.closer, fila.setter,
    fila.fuente, fila.programa].filter(Boolean).join(' ').toLowerCase();

/** Si alguna faceta de la tabla tiene al menos un valor puesto. */
const hayCondiciones = (def, facetas) => def.facetas.some(fa => (facetas[fa.key] || []).length > 0);

/**
 * El texto de una etiqueta de filtro: el valor solo, salvo en las facetas de sí/no. Un «Sí» suelto
 * no dice nada —lo que trae el número de Show up es «Asistió: Sí»—, y desde que no está el aviso
 * grande que nombraba la faceta, la etiqueta es lo único que lo cuenta.
 */
const rotuloDe = (c) => (c.valor === 'Sí' || c.valor === 'No' ? `${c.faceta}: ${c.valor}` : c.valor);

/**
 * Búsqueda + facetas. El filtro rápido se aplica aparte porque su menú cuenta cuántas filas deja
 * CADA opción sobre este mismo conjunto (el "Con deuda 9" del desplegable).
 */
const aplicarFiltros = (filas, def, query, facetas, modo) => {
    const q = query.trim().toLowerCase();
    return filas.filter(f => {
        if (q && !texto(f).includes(q)) return false;
        const activas = def.facetas.filter(fa => (facetas[fa.key] || []).length > 0);
        if (activas.length === 0) return true;
        const cumple = activas.map(fa => facetas[fa.key].includes(fa.de(f)));
        return modo === 'alguna' ? cumple.some(Boolean) : cumple.every(Boolean);
    });
};

const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** "1 cliente" / "3 clientes": el rótulo de una cuenta concuerda con su número. */
const segun = (n, uno, varios) => (n === 1 ? uno : varios);

/**
 * Totales de lo filtrado: una tira de verificación, no un panel de tarjetas.
 *
 * Cada número lleva un rótulo corto y, como mucho, una bajada que sirve para comprobarlo ("18 de
 * 22", "9 con saldo"). Lo que antes iba escrito al lado para que no se lo malinterprete ("deuda ·
 * de esta cartera", "cobrado · desde siempre") pasó al "i" del rótulo: el usuario pidió menos texto
 * (30/09/2026) y esas aclaraciones se leen una vez, no cada vez que se mira la tira.
 *
 * El dibujo sigue a la tarjeta de Cierre del dashboard: el número grande y en negrita, y debajo su
 * rótulo y su bajada, chicos y apagados. Arriba, de quién es la lista (`alcance`, corto: la
 * búsqueda ya se lee en su campo).
 *
 * `filtrada` (hay filtro rápido, etiquetas o búsqueda) se dice sin palabras: el borde y un embudo
 * junto al alcance toman el rosa de las pastillas de filtro encendidas, que es la misma señal que
 * el usuario ya lee arriba. No se repite "11 de 40" en cada número: el "mostrando X de Y" de la
 * barra ya lo cuenta, y en una tasa ("63%") ese "de" no significa nada.
 *
 * La grilla (CSS, `.tot-grid`) nunca deja un número solo en la última fila: `data-n` es cuántos
 * hay, y con eso cada ancho elige una fila, una grilla pareja o una columna.
 *
 * Cada número cuenta hasta su valor (`Cifra`, la del dashboard): desde 0 al llegar la tabla y
 * desde el que se veía cuando cambia el filtro. Con movimiento reducido, quieto. Sin
 * `AnimatePresence` a propósito: Revisar vive también dentro del mazo del closer.
 */
const TotalesTira = ({ items, alcance, filtrada }) => (
    <div className={`tot-tira${filtrada ? ' tot-tira--filtrada' : ''}`} data-n={items.length}
        style={{ '--n': items.length }} role="group"
        aria-label={filtrada ? 'Totales de lo filtrado' : 'Totales de la lista'}>
        {alcance && (
            <small className="tot-alcance" title={filtrada ? 'Totales de lo filtrado' : undefined}>
                {filtrada && <Filter size={11} strokeWidth={2.6} className="tot-embudo" aria-hidden="true" />}
                <small className="trunc">{alcance}</small>
            </small>
        )}
        <div className="tot-grid">
            {items.map(t => (
                <div key={t.key} className="tot-celda" data-total={t.key}>
                    {/* `<b>` y `<small>`, no `<span>`: fuera de `.dc-shell` el CSS global fuerza el
                        peso de los span con !important, y estas dos conservan el suyo. La cifra
                        cuenta desde la que se estaba viendo: al cambiar el filtro se ve moverse. */}
                    <Cifra tag="b" className="tot-n" style={{ color: t.color }} valor={t.valor}
                        desdeAnterior duracion={600} />
                    <span className="tot-pie">
                        <small className="tot-rot">
                            {t.label}
                            {t.ayuda && <Tip titulo={mayuscula(t.label)} texto={t.ayuda} />}
                        </small>
                        {t.hint && <small className="tot-hint">{t.hint}</small>}
                    </span>
                </div>
            ))}
        </div>
    </div>
);

const Revisar = ({ tabla, setTabla, datos, cargando, rol, basis, setBasis, alcance, onAbrirFila,
    filtroInicial, onOlvidarFiltro, puedeElegirEquipo = true, onSincronizarAcademia = null }) => {
    const [query, setQuery] = useState('');
    const [facetas, setFacetas] = useState({});
    const [modo, setModo] = useState('todas');
    const [chip, setChip] = useState(null);
    /**
     * Una selección de filas puntuales que llega de otra sección: `{ ids: Set, rotulo }`. Hoy la
     * manda Payroll (08/10/2026): «las ventas de la comisión de Andy» no se pueden escribir con
     * las facetas de la tabla —al setter lo cuenta la agenda que originó la venta, a Fulfillment
     * la seña previa del cliente—, así que viajan las ventas mismas (`__ids` en el filtro del
     * drill-down). Se ve como UNA etiqueta con su X, como cualquier otra condición.
     */
    const [seleccion, setSeleccion] = useState(null);
    const [menu, setMenu] = useState(null);
    const [agrupacion, setAgrupacion] = useState(null);
    // `{ key, dir }` de la columna por la que se ordena, o null para el orden de la tabla.
    const [orden, setOrden] = useState(null);
    // Qué juego de columnas se ve: el de siempre o el de la Academia (solo Clientes y Ventas, las
    // tablas con `colsAcademia`). Son las mismas filas y el mismo filtro: cambia qué se muestra.
    const [columnas, setColumnas] = useState('base');
    const barra = useRef(null);
    const mas = useRef(null);

    // Lista o tarjetas, con la elección recordada. La clave es por tabla: mirar las agendas como
    // lista y las ventas como tarjetas es una preferencia razonable, no una inconsistencia.
    const { modo: modoVista, setModo: setModoVista } = useModoVista(`comercial_view_mode_${tabla}`);

    const def = TABLAS[tabla];
    const panel = useRef(null);

    /**
     * Los filtros se ajustan DURANTE el render y no en un efecto, que es el patrón de React para
     * "recalcular estado cuando cambia una prop". Dos intentos previos fallaron:
     *
     *  1. Dos efectos —uno aplicaba el filtro del drill-down, el otro limpiaba al cambiar de
     *     tabla— y en un drill-down las dos cosas cambian en el MISMO render. Corren en orden de
     *     declaración, así que el segundo borraba lo que acababa de poner el primero: clic en
     *     "Split Pay · 5 cobros" aterrizaba en Ventas con las 24 filas del período.
     *  2. Un solo efecto con un ref que marcaba el token como consumido. StrictMode invoca los
     *     efectos DOS veces al montar: la segunda ve el token ya consumido y limpia igual. El
     *     síntoma era idéntico, y en producción no aparecía — justo lo que StrictMode existe
     *     para destapar.
     *
     * Acá no hay nada que "consumir": el token viaja en el estado, así que repetir el render
     * da el mismo resultado. El token distingue además "llegó un drill-down" de "el usuario
     * cambió de pestaña a mano", que tiene que limpiar.
     *
     * `de` es el nombre del número que trajo el filtro, y es lo que dice el "i" de la fila de
     * etiquetas. Solo se guarda si ese número trajo condiciones: uno que se mide sobre el período
     * entero (Cash, por ejemplo) lleva a la lista completa, sin etiquetas que explicar.
     */
    const token = filtroInicial?.__t ?? null;
    const [origen, setOrigen] = useState({ tabla, token: null, de: null, soltado: false });
    if (origen.tabla !== tabla || origen.token !== token) {
        if (origen.soltado && origen.tabla === tabla && token === null) {
            // La URL soltó el filtro porque esta lista se quedó sin etiquetas y lo pidió (ver
            // `olvidarOrigen`). Se anota y no se toca nada más: la búsqueda, la agrupación, el
            // orden y el panel abierto son del usuario, y antes quitar el filtro se los llevaba
            // puestos.
            setOrigen({ tabla, token: null, de: null, soltado: false });
        } else {
            const nuevas = {};
            if (token !== null && token !== origen.token) {
                Object.entries(filtroInicial).forEach(([k, valor]) => {
                    // Las claves `__` son metadatos del drill-down (token, procedencia,
                    // advertencia), no condiciones. Un array de etiquetas en la misma faceta es
                    // un OR.
                    if (k.startsWith('__') || valor === null || valor === undefined) return;
                    nuevas[k] = Array.isArray(valor) ? valor : [valor];
                });
            }
            const ids = token !== null && token !== origen.token && Array.isArray(filtroInicial.__ids)
                ? filtroInicial.__ids : null;
            const de = Object.keys(nuevas).length || ids ? filtroInicial.__de || null : null;
            setOrigen({ tabla, token, de, soltado: false });
            setFacetas(nuevas);
            setSeleccion(ids ? { ids: new Set(ids.map(Number)), rotulo: filtroInicial.__ids_rotulo || 'Selección' } : null);
            setChip(null);
            setQuery('');
            setMenu(null);
            // La agrupación también se reinicia: las dimensiones son por tabla y la de Ventas no
            // existe en Leads. El orden, por lo mismo: "por monto" no existe en Clientes.
            setAgrupacion(null);
            setOrden(null);
            setColumnas('base');
        }
    }

    /**
     * Al aterrizar de un drill-down, el panel parpadea una vez y se trae a la vista.
     *
     * Reusa la clase `.destacado` que ya existe para el mismo gesto en Analizar (bajar de un tile
     * a su panel) en vez de duplicar la animación: es el mismo mensaje —"lo que buscabas está
     * acá"— y tiene que verse igual. El reflow forzado entre quitar y poner la clase es lo que
     * hace que dos drill-downs seguidos vuelvan a parpadear: sin él, reagregarla en el mismo
     * cuadro no reinicia la animación.
     *
     * `prefers-reduced-motion` lo apaga por CSS, junto al resto de la animación del tablero.
     */
    useEffect(() => {
        const el = panel.current;
        if (!el || origen.token === null) return;
        el.classList.remove('destacado');
        void el.offsetWidth;
        el.classList.add('destacado');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [origen.token]);

    // Un solo menú abierto por vez, y se cierra al clickear afuera de la barra. El "+" de la fila
    // de etiquetas cuenta como barra: abre el mismo panel, y sin esto el `mousedown` lo cerraba
    // y el `click` lo volvía a abrir, así que no había forma de cerrarlo desde ahí.
    useEffect(() => {
        if (!menu) return undefined;
        const fuera = (e) => {
            if (mas.current?.contains(e.target)) return;
            if (barra.current && !barra.current.contains(e.target)) setMenu(null);
        };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, [menu]);

    const filas = useMemo(() => {
        const todas = datos?.filas || [];
        return seleccion ? todas.filter(f => seleccion.ids.has(f.id)) : todas;
    }, [datos, seleccion]);
    const filtradas = useMemo(
        () => aplicarFiltros(filas, def, query, facetas, modo),
        [filas, def, query, facetas, modo]);

    const chipActivo = chip || def.chips[0].key;
    const rapido = def.chips.find(c => c.key === chipActivo) || def.chips[0];
    // El filtro rápido recibe también las facetas: el de por defecto de Clientes deja afuera a los
    // dados de baja salvo que se los pida por estado (ver `entraPorDefecto` en `tablasDef.js`).
    // Con una flecha y no pasando `rapido.filtro` directo: `Array.filter` le daría el índice.
    const pasaRapido = (c) => (f) => c.filtro(f, facetas);
    // Lo que muestra la lista, sin ordenar: es lo que cuenta la tira de totales.
    const mostradas = useMemo(
        () => filtradas.filter(f => rapido.filtro(f, facetas)),
        [filtradas, rapido, facetas]);
    // El orden va DESPUÉS de todo el filtrado (ver `ordenFilas.js`): no cambia qué filas entran,
    // así que los contadores y la tira de totales no se enteran.
    const ordenables = useMemo(() => columnasOrdenables(def), [def]);
    const colOrden = ordenables.find(c => c.key === orden?.key) || null;
    const visibles = useMemo(
        () => ordenarFilas(mostradas, colOrden?.orden, orden?.dir),
        [mostradas, colOrden, orden]);
    const ordenar = (key) => setOrden(o => siguienteOrden(o, key));
    // Desde el menú: elegir la columna que ya ordena invierte la dirección; null vuelve al orden
    // de la tabla.
    const elegirOrden = (col) => {
        setMenu(null);
        setOrden(o => (col ? { key: col.key, dir: o?.key === col.key && o.dir === 'desc' ? 'asc' : 'desc' }
            : null));
        // Ordenar por horas de estudio sin ver las horas no se puede comprobar: se muestran sus
        // columnas.
        if (col?.academia) setColumnas('academia');
    };

    const activas = def.facetas.reduce((a, f) => a + (facetas[f.key]?.length || 0), 0);
    const conAcademia = columnas === 'academia' && !!def.colsAcademia;
    // La definición que se DIBUJA: la de la tabla con el juego de columnas elegido. Filtros, chips,
    // facetas y totales siguen leyendo `def`, que es la misma para los dos juegos.
    const defVista = useMemo(() => (conAcademia ? { ...def, cols: def.colsAcademia } : def),
        [def, conAcademia]);
    // `min` (px) es el ancho del que una columna no baja (ver `COLS_ACADEMIA`): la que no lo trae
    // puede angostarse hasta 0 y corta su texto con «…».
    const plantilla = defVista.cols.map(c => `minmax(${c.min || 0}px,${c.width})`).join(' ');
    // Quien ve solo sus propias filas no puede agruparse por sí mismo: sería un grupo único con
    // todo adentro. La dirección conserva todas las dimensiones (ver `DIMENSION_PROPIA`).
    const agrupables = useMemo(
        () => (def.agrupables || []).filter(d => puedeElegirEquipo || d.key !== DIMENSION_PROPIA[rol]),
        [def, puedeElegirEquipo, rol]);
    const dimension = agrupables.find(d => d.key === agrupacion) || null;

    // Qué grupos abrió el usuario se guarda ACÁ y no en la lista, porque Revisar la desmonta
    // mientras recarga (el esqueleto la reemplaza), cuando un filtro la deja vacía y al alternar
    // lista/tarjetas. Con la memoria en la lista, el closer abría su grupo, registraba algo en la
    // ficha —que recarga la tabla— y el grupo volvía cerrado; lo mismo al cambiar el período o la
    // base de fecha. La clave lleva la tabla además de la dimensión, así que cambiar cualquiera de
    // las dos vuelve todo a cerrado: "por closer" en Agendas y en Ventas no son los mismos grupos.
    const [gruposElegidos, elegirGrupo] = useGruposElegidos(
        dimension ? `${tabla}.${dimension.key}` : null);

    /**
     * La lista deja de venir de un número: se borra de dónde venía (si no, el "i" seguiría
     * diciendo "Filtro de Show up" sobre etiquetas que ya no son las de Show up) y se saca de la
     * URL, que es donde vive el filtro del drill-down: sin esto, salir de Revisar y volver lo
     * resucitaba. `soltado` avisa que la URL vacía que va a llegar la pidió esta lista.
     */
    const olvidarOrigen = () => {
        setOrigen(o => ({ ...o, de: null, soltado: o.token !== null }));
        onOlvidarFiltro?.();
    };

    /**
     * Todo cambio de etiquetas pasa por acá —la X de cada una, el panel Filtro completo y su
     * Limpiar— porque quedarse sin ninguna es lo mismo que limpiar: la lista ya es la del
     * período, y lo que trajo el número se olvida.
     */
    const cambiarFacetas = (nuevas) => {
        setFacetas(nuevas);
        if (!hayCondiciones(def, nuevas) && !seleccion && (origen.de || token !== null)) olvidarOrigen();
    };

    const quitarSeleccion = () => {
        setSeleccion(null);
        if (!hayCondiciones(def, facetas) && (origen.de || token !== null)) olvidarOrigen();
    };

    const limpiar = () => {
        setSeleccion(null);
        setFacetas({});
        setChip(null);
        setQuery('');
        olvidarOrigen();
    };

    const quitarCriterio = (clave, valor) => cambiarFacetas({
        ...facetas, [clave]: (facetas[clave] || []).filter(x => x !== valor),
    });

    /** Las condiciones activas, con el nombre de su faceta, para la fila de etiquetas. */
    const criterios = def.facetas.flatMap(fa => (facetas[fa.key] || []).map(
        valor => ({ clave: fa.key, faceta: fa.label, valor })));

    /**
     * Los números de la tira, recalculados sobre las filas que muestra la lista (búsqueda, facetas
     * y filtro rápido) con las mismas reglas del backend. Se recalculan acá y no se leen de
     * `datos.totales` porque los del backend son del período completo: la tira tiene que cerrar
     * con lo que se ve debajo, y su cuenta es la del "mostrando X".
     *
     * Cada número lleva una `key` estable: el rótulo puede cambiar (singular y plural) y la tira
     * la usa para no volver a montar la cifra cuando cambia el filtro.
     */
    const totales = useMemo(() => {
        const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
        const lista = mostradas;
        // "1,057 de 1,836": las bajadas con separador de miles, como los números.
        const de = (a, b) => `${fmt.num(a)} de ${fmt.num(b)}`;

        if (tabla === 'ventas') {
            const cash = lista.reduce((a, f) => a + f.monto, 0);
            // El ticket promedia solo lo cobrado en las ventas nuevas: las cuotas y las señas
            // suman al cash pero no son ventas (igual que `totales_ventas` en el backend).
            const nuevas = lista.filter(f => f.es_venta);
            const ventas = nuevas.length;
            const cashVentas = nuevas.reduce((a, f) => a + f.monto, 0);
            const neto = lista.reduce((a, f) => a + f.monto_neto, 0);
            return [
                { key: 'cash', label: 'cash', valor: fmt.money(Math.round(cash * 100) / 100),
                    color: 'var(--text-on-surface)', hint: fmt.plural(lista.length, 'cobro', 'cobros') },
                { key: 'ventas', label: segun(ventas, 'venta', 'ventas'), valor: fmt.num(ventas),
                    color: 'var(--brand-secondary)',
                    ayuda: 'Pago completo y split pay. Una seña es una reserva: no cuenta como venta.' },
                { key: 'ticket', label: 'ticket', color: 'var(--text-on-surface)',
                    valor: fmt.money(ventas ? Math.round((cashVentas / ventas) * 100) / 100 : null),
                    ayuda: 'Ticket promedio: lo cobrado en las ventas nuevas dividido por cuántas '
                        + 'fueron. Las cuotas y las señas no entran.' },
                { key: 'neto', label: 'cash neto', valor: fmt.money(Math.round(neto * 100) / 100),
                    color: 'var(--success)', ayuda: 'El cash sin los fees de la pasarela de pago.' },
                itemTotalAcademia(lista),
            ].filter(Boolean);
        }

        if (tabla === 'clientes') {
            const deuda = lista.reduce((a, f) => a + f.deuda, 0);
            const conDeuda = lista.filter(f => f.deuda > 0.01).length;
            const vencidas = lista.filter(f => f.cuota_vencida);
            const vencido = vencidas.reduce((a, f) => a + (f.cuota_monto || 0), 0);
            const pagado = lista.reduce((a, f) => a + f.pagado, 0);
            // Un dado de baja no debe nada pero no está "al día": se cuenta aparte. Si la lista lo
            // muestra («Dados de baja», o su estado pedido en el filtro), lo que pagó suma en
            // "cobrado", que es plata que entró (mismo criterio que `totales_clientes`).
            const bajas = lista.filter(f => f.baja).length;
            const alDia = lista.length - conDeuda - bajas;
            return [
                { key: 'clientes', label: segun(lista.length, 'cliente', 'clientes'),
                    valor: fmt.num(lista.length), color: 'var(--text-on-surface)',
                    // Sin ceros: en «Con deuda» "0 al día" y en «Dados de baja» "0 al día" son ruido.
                    // Con saldo, al día y de baja suman la cuenta (el "con saldo" va en deuda).
                    hint: [alDia ? `${fmt.num(alDia)} al día` : null, bajas ? `${fmt.num(bajas)} de baja` : null]
                        .filter(Boolean).join(' · ') || null },
                // La aclaración va en el "i" y no en el rótulo (antes decía "deuda · de esta
                // cartera"): el panel Cash de Analizar muestra otro "por cobrar", atribuido por quién
                // tiene HOY la agenda del cliente y sobre todos los saldos del sistema. Los dos son
                // correctos y dan distinto; el "i" es lo que evita que parezca que uno está mal.
                { key: 'deuda', label: 'deuda', valor: fmt.money(Math.round(deuda * 100) / 100),
                    color: conDeuda ? 'var(--error)' : 'var(--success)', hint: `${fmt.num(conDeuda)} con saldo`,
                    ayuda: 'Lo que deben hoy los clientes de esta lista. No coincide con el «por cobrar» '
                        + 'de Cash, que atribuye cada saldo por otra regla.' },
                { key: 'vencido', label: 'vencido', valor: fmt.money(Math.round(vencido * 100) / 100),
                    color: 'var(--warning)',
                    hint: fmt.plural(vencidas.length, 'cuota', 'cuotas') },
                { key: 'cobrado', label: 'cobrado', valor: fmt.money(Math.round(pagado * 100) / 100),
                    color: 'var(--success)',
                    ayuda: 'Todo lo que pagaron los clientes de esta lista desde su primer cobro: no '
                        + 'depende del período.' },
                itemTotalAcademia(lista),
            ].filter(Boolean);
        }

        if (tabla === 'leads') {
            const respondieron = lista.filter(f => f.respondio).length;
            const cualificados = lista.filter(f => f.cualificado).length;
            const agendaron = lista.filter(f => f.agendo).length;
            const mensajes = lista.reduce((a, f) => a + f.mensajes, 0);
            return [
                { key: 'leads', label: segun(lista.length, 'lead', 'leads'), valor: fmt.num(lista.length),
                    color: 'var(--text-on-surface)', hint: fmt.plural(mensajes, 'mensaje', 'mensajes') },
                { key: 'respuesta', label: 'respuesta', valor: fmt.pct(pct(respondieron, lista.length)),
                    color: 'var(--info)', hint: de(respondieron, lista.length) },
                { key: 'cualificacion', label: 'cualificación', valor: fmt.pct(pct(cualificados, respondieron)),
                    color: 'var(--success)', hint: de(cualificados, respondieron) },
                { key: 'conversion', label: 'conversión', valor: fmt.pct(pct(agendaron, lista.length)),
                    color: 'var(--brand-secondary)', hint: fmt.plural(agendaron, 'agendó', 'agendaron') },
            ];
        }

        const realizadas = lista.filter(f => f.realizada).length;
        const asistieron = lista.filter(f => f.asistio).length;
        const ventas = lista.filter(f => f.post_call.key === 'venta').length;
        const noShow = lista.filter(f => f.post_call.key === 'no_show').length;
        const pendientes = lista.filter(f => f.post_call.key === 'pendiente');
        const conRetraso = pendientes.filter(f => f.retraso_dias > 0).length;
        const seguimiento = lista.filter(
            f => ['seguimiento', 'presento_no_cerro'].includes(f.post_call.key)).length;
        return [
            { key: 'agendas', label: segun(lista.length, 'agenda', 'agendas'), valor: fmt.num(lista.length),
                color: 'var(--text-on-surface)',
                hint: fmt.plural(realizadas, 'realizada', 'realizadas') },
            { key: 'show_up', label: 'show up', valor: fmt.pct(pct(asistieron, realizadas)),
                color: 'var(--success)', hint: de(asistieron, realizadas) },
            { key: 'close_rate', label: 'close rate', valor: fmt.pct(pct(ventas, asistieron)),
                color: 'var(--brand-secondary)', hint: de(ventas, asistieron) },
            { key: 'seguimiento', label: 'seguimiento', valor: fmt.num(seguimiento), color: 'var(--warning)',
                ayuda: 'Asistieron y no cerraron: siguen en seguimiento.' },
            { key: 'no_show', label: 'no show', valor: fmt.num(noShow), color: 'var(--error)',
                hint: realizadas ? `${fmt.pct(pct(noShow, realizadas))} de ${fmt.num(realizadas)}` : null },
            { key: 'pendientes', label: segun(pendientes.length, 'pendiente', 'pendientes'),
                valor: fmt.num(pendientes.length), color: conRetraso ? 'var(--warning)' : 'var(--idle)',
                hint: conRetraso ? `${fmt.num(conRetraso)} con retraso` : 'al día' },
        ];
    }, [mostradas, tabla]);

    // ¿La lista está recortada por algo que eligió el usuario? Es lo que enciende la tira (ver
    // `TotalesTira`). El período no cuenta: es el de toda la pantalla y ya lo dice el alcance.
    const filtrando = chipActivo !== def.chips[0].key || activas > 0 || !!seleccion || query.trim() !== '';

    return (
        <section className="panel" ref={panel}>
            <div className="tabs" role="tablist" aria-label="Tabla"
                style={{ marginBottom: 'var(--s4)' }}>
                {TABLAS_POR_ROL[rol].map(k => (
                    <button key={k} type="button" role="tab" aria-selected={tabla === k}
                        className="tab" onClick={() => setTabla(k)}>
                        {TABLAS[k].label}
                    </button>
                ))}
            </div>

            {/* Todo el control en una línea: rápido, completo, búsqueda y la cuenta de lo visible. */}
            <div className="fila barra-tabla" ref={barra}>
                <div style={{ position: 'relative' }}>
                    <button type="button"
                        className={`pastilla${chipActivo !== def.chips[0].key ? ' pastilla--on' : ''}`}
                        aria-expanded={menu === 'rapido'} aria-haspopup="menu"
                        onClick={() => setMenu(m => (m === 'rapido' ? null : 'rapido'))}>
                        <Filter size={15} />
                        {rapido.label}
                        <span className="mut40 num" style={{ fontSize: 11.5 }}>{visibles.length}</span>
                        <ChevronDown size={14} />
                    </button>
                    {menu === 'rapido' && (
                        <div className="menu" role="menu" aria-label="Filtro rápido">
                            {def.chips.map(c => (
                                <button key={c.key} type="button" className="menu-item"
                                    role="menuitemradio" aria-checked={chipActivo === c.key}
                                    onClick={() => {
                                        setChip(c.key);
                                        // "Activos en la Academia" sin sus columnas mostraría
                                        // una lista que no dice por qué entró cada fila.
                                        if (c.academia) setColumnas('academia');
                                        setMenu(null);
                                    }}>
                                    <span className="trunc">{c.label}</span>
                                    <span className="cuenta">{filtradas.filter(pasaRapido(c)).length}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="config-envoltura">
                    <button type="button" className={`pastilla${activas ? ' pastilla--on' : ''}`}
                        aria-expanded={menu === 'config'} aria-haspopup="dialog"
                        onClick={() => setMenu(m => (m === 'config' ? null : 'config'))}>
                        <SlidersHorizontal size={15} />
                        Filtro completo
                        {activas > 0 && <span className="cuenta-burbuja">{activas}</span>}
                        <ChevronDown size={14} />
                    </button>
                    {menu === 'config' && (
                        <PanelConfigurar def={def} filas={filas} facetas={facetas} setFacetas={cambiarFacetas}
                            modo={modo} setModo={setModo} tabla={tabla} basis={basis} setBasis={setBasis}
                            onLimpiar={() => cambiarFacetas({})} onCerrar={() => setMenu(null)} />
                    )}
                </div>

                {/* Agrupar por: la dimensión sale de `def.agrupables`, así que cada tabla ofrece
                    las suyas y agregar un criterio nuevo es una línea en `tablasDef.js`. */}
                {agrupables.length > 0 && (
                    <div style={{ position: 'relative' }}>
                        <button type="button"
                            className={`pastilla${dimension ? ' pastilla--on' : ''}`}
                            aria-expanded={menu === 'agrupar'} aria-haspopup="menu"
                            onClick={() => setMenu(m => (m === 'agrupar' ? null : 'agrupar'))}>
                            <Rows size={15} />
                            {dimension ? `Por ${dimension.label.toLowerCase()}` : 'Sin agrupar'}
                            <ChevronDown size={14} />
                        </button>
                        {menu === 'agrupar' && (
                            <div className="menu" role="menu" aria-label="Agrupar por">
                                <button type="button" className="menu-item" role="menuitemradio"
                                    aria-checked={!agrupacion}
                                    onClick={() => { setAgrupacion(null); setMenu(null); }}>
                                    <span className="trunc">Sin agrupar</span>
                                </button>
                                {agrupables.map(d => (
                                    <button key={d.key} type="button" className="menu-item"
                                        role="menuitemradio" aria-checked={agrupacion === d.key}
                                        onClick={() => { setAgrupacion(d.key); setMenu(null); }}>
                                        <span className="trunc">{d.label}</span>
                                        <span className="cuenta">
                                            {new Set(visibles.map(f => d.de(f) || '—')).size}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <MenuOrdenar ordenables={ordenables} orden={orden} abierto={menu === 'ordenar'}
                    onAlternar={() => setMenu(m => (m === 'ordenar' ? null : 'ordenar'))}
                    onElegir={elegirOrden} />

                {def.colsAcademia && (
                    <SelectorColumnas base={def.vistaBase} academia={conAcademia} onCambiar={setColumnas} />
                )}

                {/* Lista o tarjetas. Dos posiciones, no un menú: es una sola decisión. */}
                <div className="seg" role="group" aria-label="Forma de ver la lista">
                    <button type="button" aria-pressed={modoVista === 'lista'}
                        title="Ver como lista" aria-label="Ver como lista"
                        onClick={() => setModoVista('lista')}>
                        <List size={14} />
                    </button>
                    <button type="button" aria-pressed={modoVista === 'tarjetas'}
                        title="Ver como tarjetas" aria-label="Ver como tarjetas"
                        onClick={() => setModoVista('tarjetas')}>
                        <LayoutGrid size={14} />
                    </button>
                </div>

                <label className="busca busca--sm">
                    <span className="mut40" style={{ display: 'flex' }}><Search size={14} /></span>
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar cliente, @ig, persona…" aria-label="Buscar" />
                </label>

                {/* La cuenta y su "i" van juntos: sueltos, cuando la barra no entraba en una
                    línea el "i" caía solo en la de abajo, lejos de lo que explica. */}
                <span className="barra-cuenta">
                    <span className="t-cap mut40 num">
                        mostrando {visibles.length} de {filtradas.length}
                    </span>
                    <Tip titulo="Qué estás mirando" texto={def.ayuda} />
                </span>
            </div>

            {/* Las etiquetas del filtro: el único lugar que las muestra, cada una con su X, más el
                "+" que abre el panel Filtro completo para sumar otra. Hubo arriba un aviso grande
                ("Viniste de… · 13 de 238 registros", con las mismas etiquetas repetidas y un
                "Quitar el filtro"); se sacó por pedido del usuario (30/09) y de qué número viene
                la lista quedó en el "i" del rótulo. La cuenta ya la dice "mostrando X de Y". */}
            {(activas > 0 || seleccion) && (
                <div className="fila filtro-fila">
                    <span className="filtro-rotulo">
                        <span className="t-rotulo">
                            {modo === 'alguna' ? 'Cumple alguna:' : 'Cumple todas:'}
                        </span>
                        {origen.de && (
                            <Tip titulo={`Filtro de ${origen.de}`} texto="Viene del número que tocaste." />
                        )}
                    </span>
                    {seleccion && (
                        <button type="button" className="chip filtro-tag"
                            style={{ '--c': 'var(--brand-secondary)', textTransform: 'none',
                                letterSpacing: 0, fontWeight: 700 }}
                            aria-label={`Quitar ${seleccion.rotulo}`}
                            onClick={quitarSeleccion}>
                            {seleccion.rotulo}
                            <X size={12} />
                        </button>
                    )}
                    {criterios.map(c => (
                        <button key={`${c.clave}-${c.valor}`} type="button" className="chip filtro-tag"
                            style={{ '--c': 'var(--brand-secondary)', textTransform: 'none',
                                letterSpacing: 0, fontWeight: 700 }}
                            aria-label={`Quitar ${c.faceta}: ${c.valor}`}
                            onClick={() => quitarCriterio(c.clave, c.valor)}>
                            {rotuloDe(c)}
                            <X size={12} />
                        </button>
                    ))}
                    <button ref={mas} type="button" className="chip filtro-mas"
                        aria-label="Agregar filtro" title="Agregar filtro"
                        aria-expanded={menu === 'config'} aria-haspopup="dialog"
                        onClick={() => setMenu(m => (m === 'config' ? null : 'config'))}>
                        <Plus size={14} />
                    </button>
                    <button type="button" className="btn btn--linea btn--sm" onClick={limpiar}>
                        <RotateCcw size={13} />
                        Limpiar
                    </button>
                </div>
            )}

            {cargando ? <EsqueletoRevisar def={defVista} plantilla={plantilla} modo={modoVista}
                totales={totales.length} /> : (
                <>
                    {conAcademia && <AcademiaBarra filas={filas} onSincronizar={onSincronizarAcademia} />}
                    <TotalesTira items={totales} alcance={alcance} filtrada={filtrando} />

                    {visibles.length === 0 ? (
                        <div className="tabla">
                            <div className="vacio">
                                <p className="t-h3">Ningún registro entra por este filtro</p>
                                <p className="t-sm mut">
                                    Con este período, esta búsqueda y estas facetas no queda ninguna
                                    fila. Sacá una condición para volver a ver el listado.
                                </p>
                                <button type="button" className="btn btn--linea btn--sm" onClick={limpiar}>
                                    <RotateCcw size={14} />
                                    Limpiar todo
                                </button>
                            </div>
                        </div>
                    ) : (
                        <RevisarLista def={defVista} visibles={visibles} plantilla={plantilla}
                            onAbrirFila={onAbrirFila} dimension={dimension} modo={modoVista}
                            gruposElegidos={gruposElegidos} onElegirGrupo={elegirGrupo}
                            orden={orden} onOrdenar={ordenar}
                            variante={`${columnas}-${orden ? `${orden.key}-${orden.dir}` : ''}`} />
                    )}
                </>
            )}
        </section>
    );
};

export default Revisar;
