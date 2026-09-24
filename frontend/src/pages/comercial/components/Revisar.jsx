import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Filter, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { Cargando, fmt } from './Shared';

/**
 * Revisar: el libro de registros con un buscador, un filtro rápido, UN botón que abre todas las
 * facetas y la tira de totales de lo filtrado arriba de la tabla.
 *
 * Todo el filtrado (búsqueda, facetas y filtro rápido) pasa por `aplicarFiltros` y se hace en el
 * cliente sobre las filas del período, que ya vienen del backend. Eso es lo que permite que los
 * contadores del filtro rápido, el "mostrando X de Y" y los totales se recalculen juntos con el
 * mismo conjunto de filas: si cada uno consultara por su cuenta, podrían discrepar.
 *
 * Los totales ignoran el filtro rápido a propósito (es un atajo de lectura, no un filtro del
 * alcance), pero sí respetan el período, la búsqueda y las facetas.
 *
 * `datos` puede llegar en `null` mientras el backend todavía no devolvió las filas de la tabla
 * pedida (ver el fix de DashboardComercial): las filas que llegan acá SON siempre de la tabla
 * que se pidió, así que los accesores no llevan guardas.
 */

/** Chip de estado con el tono que manda el backend (nunca uno elegido en el frontend). */
export const ChipTono = ({ chip }) => (chip
    ? <span className="chip" style={{ '--c': `var(--${chip.tone})` }}>{chip.label}</span>
    : null);

/** Ícono "i" con la explicación de lo que se está mirando. Se abre y cierra por CSS. */
const Ayuda = ({ titulo, texto }) => (
    <span className="tip" tabIndex={0} role="note" aria-label={`${titulo}: ${texto}`}>
        <span className="tip-dot" aria-hidden="true">i</span>
        <span className="tip-burbuja" aria-hidden="true"><b>{titulo}</b>{texto}</span>
    </span>
);

/**
 * El estado con el que el panel Estados cuenta cada agenda.
 *
 * "Pendiente" es un solo valor en la tabla pero dos cosas distintas para leer: una llamada que ya
 * pasó y nadie reportó, y una que todavía no ocurrió. El panel las separa, así que la faceta
 * tiene que separarlas igual — si no, clic en "Sin reporte · 62" aterriza en las 71 pendientes.
 * La derivación es la MISMA que hace `estados_de` en el backend, sobre el mismo campo.
 */
export const estadoDeAgenda = (fila) => {
    if (fila.post_call?.key !== 'pendiente') return fila.post_call?.label;
    return fila.retraso_dias > 0 ? 'Sin reporte' : 'Aún no ocurrió';
};

/**
 * Las facetas de sí/no de los pasos del embudo.
 *
 * Los cinco pasos intermedios —Confirmadas, Asistieron, Presentaciones del embudo de closers, y
 * Respondieron y Cualificados del de setters— no eran clickeables porque ninguna faceta los
 * aislaba: el corte no es un valor de una columna sino una condición sobre la fila. Cada una
 * repite EXACTAMENTE el criterio con el que el backend cuenta ese paso, así que el clic abre
 * tantas filas como dice el número.
 */
const SI = 'Sí';
const NO = 'No';
const siNo = (condicion) => (fila) => (condicion(fila) ? SI : NO);

// Una llamada a la que el lead asistió estaba confirmada, por definición: el mismo criterio de
// `bloque_closers`, que existe porque el embudo es una cadena de subconjuntos.
export const fueConfirmada = siNo((f) => f.pre_call?.key === 'confirmada' || f.asistio);
export const asistio = siNo((f) => f.asistio);
// Presentar requiere haber asistido: sin eso el embudo mostraría más presentaciones que
// asistencias, que es imposible.
export const presento = siNo((f) => f.asistio && f.presento);
export const respondio = siNo((f) => f.respondio);
export const cualificado = siNo((f) => f.cualificado);

// Definición de cada tabla: columnas, facetas y filtros rápidos. Una sola fuente para las cuatro.
const TABLAS = {
    agendas: {
        label: 'Agendas',
        ayuda: 'Todas las llamadas agendadas del período. Tocá una fila para abrir el recorrido '
            + 'del lead y, si hace falta, corregir su estado.',
        cols: [
            { key: 'fecha', header: 'Reunión', width: '0.9fr' },
            { key: 'cliente', header: 'Cliente', width: '1.8fr' },
            { key: 'fuente', header: 'Fuente', width: '1fr' },
            { key: 'closer', header: 'Closer', width: '0.8fr' },
            { key: 'pre_call', header: 'Pre call', width: '1fr' },
            { key: 'post_call', header: 'Post call', width: '1.4fr' },
            { key: 'ver', header: '', width: '0.4fr' },
        ],
        facetas: [
            { key: 'estado', label: 'Estado', de: estadoDeAgenda },
            { key: 'pre_call', label: 'Pre call', de: (f) => f.pre_call.label },
            { key: 'post_call', label: 'Post call', de: (f) => f.post_call.label },
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
            { key: 'fuente', label: 'Fuente', de: (f) => f.fuente },
            { key: 'confirmada', label: 'Confirmada', de: fueConfirmada },
            { key: 'asistio', label: 'Asistió', de: asistio },
            { key: 'presento', label: 'Presentó', de: presento },
        ],
        chips: [
            { key: 'todas', label: 'Todas', filtro: () => true },
            { key: 'asistieron', label: 'Asistieron', filtro: (f) => f.asistio },
            { key: 'pendientes', label: 'Pendientes', filtro: (f) => f.post_call.key === 'pendiente' },
            { key: 'no_show', label: 'No show', filtro: (f) => f.post_call.key === 'no_show' },
        ],
    },
    ventas: {
        label: 'Ventas',
        ayuda: 'Las ventas cobradas en el período, con su programa, forma de pago y medio de cobro.',
        cols: [
            { key: 'fecha', header: 'Venta', width: '0.8fr' },
            { key: 'cliente', header: 'Cliente', width: '1.9fr' },
            { key: 'programa', header: 'Programa', width: '1.3fr' },
            { key: 'tipo_pago', header: 'Pago', width: '1.1fr' },
            { key: 'monto', header: 'Monto', width: '1fr' },
            { key: 'closer', header: 'Closer', width: '0.9fr' },
            { key: 'ver', header: '', width: '0.4fr' },
        ],
        facetas: [
            { key: 'programa', label: 'Programa', de: (f) => f.programa },
            { key: 'tipo_pago', label: 'Tipo de pago', de: (f) => f.tipo_pago.label },
            { key: 'metodo', label: 'Método', de: (f) => f.metodo },
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
        ],
        chips: [
            { key: 'todas', label: 'Todas', filtro: () => true },
            { key: 'completo', label: 'Pago completo', filtro: (f) => f.tipo_pago.key === 'completo' },
            { key: 'parcial', label: 'Split Pay', filtro: (f) => f.tipo_pago.key === 'parcial' },
        ],
    },
    leads: {
        label: 'Leads entrantes',
        ayuda: 'Los leads nuevos que entraron al inbox en el período, con su estado de conversación.',
        cols: [
            { key: 'fecha', header: 'Llegó', width: '0.9fr' },
            { key: 'cliente', header: 'Lead', width: '1.9fr' },
            { key: 'fuente', header: 'Fuente', width: '1fr' },
            { key: 'setter', header: 'Setter', width: '0.9fr' },
            { key: 'estado', header: 'Estado', width: '1.1fr' },
            { key: 'mensajes', header: 'Mensajes', width: '0.9fr' },
            { key: 'ver', header: '', width: '0.4fr' },
        ],
        facetas: [
            { key: 'estado', label: 'Estado', de: (f) => f.estado.label },
            { key: 'setter', label: 'Setter', de: (f) => f.setter },
            { key: 'respondio', label: 'Respondió', de: respondio },
            { key: 'cualificado', label: 'Cualificado', de: cualificado },
        ],
        chips: [
            { key: 'todos', label: 'Todos', filtro: () => true },
            { key: 'agendo', label: 'Agendaron', filtro: (f) => f.agendo },
            { key: 'sin_respuesta', label: 'Sin respuesta', filtro: (f) => !f.respondio },
        ],
    },
    clientes: {
        label: 'Clientes',
        ayuda: 'Cada cliente que el equipo ya vendió, con lo que pagó, lo que debe y su próxima '
            + 'cuota. NO depende del período: la cartera es un saldo a hoy, no un flujo — acotarla '
            + 'al mes dejaría afuera justamente a los que arrastran deuda de antes. La atribución '
            + 'es por quién VENDIÓ, así que su deuda no es la misma cifra que el "por cobrar" del '
            + 'panel Cash, que cuenta por quién tiene hoy la agenda del cliente — y que además '
            + 'incluye saldos de clientes que nadie del equipo actual vendió.',
        cols: [
            { key: 'cliente', header: 'Cliente', width: '1.7fr' },
            { key: 'programa', header: 'Programa', width: '1.2fr' },
            { key: 'closer', header: 'Vendió', width: '0.8fr' },
            { key: 'pagado', header: 'Pagado', width: '0.8fr' },
            { key: 'deuda', header: 'Debe', width: '0.8fr' },
            { key: 'cuota', header: 'Próxima cuota', width: '1.3fr' },
            { key: 'ver', header: '', width: '0.4fr' },
        ],
        facetas: [
            { key: 'estado', label: 'Estado', de: (f) => f.estado.label },
            { key: 'programa', label: 'Programa', de: (f) => f.programa },
            { key: 'closer', label: 'Vendió', de: (f) => f.closer },
        ],
        chips: [
            { key: 'todos', label: 'Todos', filtro: () => true },
            { key: 'con_deuda', label: 'Con deuda', filtro: (f) => f.deuda > 0.01 },
            { key: 'vencida', label: 'Cuota vencida', filtro: (f) => f.cuota_vencida },
            { key: 'al_dia', label: 'Al día', filtro: (f) => f.deuda <= 0.01 },
        ],
    },
    generadas: {
        label: 'Agendas generadas',
        ayuda: 'Las agendas que generó el equipo de setting, con el closer asignado y cómo '
            + 'terminó la llamada.',
        cols: [
            { key: 'fecha', header: 'Reunión', width: '0.9fr' },
            { key: 'cliente', header: 'Lead', width: '1.8fr' },
            { key: 'setter', header: 'Setter', width: '0.9fr' },
            { key: 'closer', header: 'Closer', width: '0.9fr' },
            { key: 'pre_call', header: 'Pre call', width: '1fr' },
            { key: 'post_call', header: 'Post call', width: '1.4fr' },
            { key: 'ver', header: '', width: '0.4fr' },
        ],
        facetas: [
            { key: 'estado', label: 'Estado', de: estadoDeAgenda },
            { key: 'setter', label: 'Setter', de: (f) => f.setter },
            { key: 'pre_call', label: 'Pre call', de: (f) => f.pre_call.label },
            { key: 'post_call', label: 'Post call', de: (f) => f.post_call.label },
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
            { key: 'confirmada', label: 'Confirmada', de: fueConfirmada },
            { key: 'asistio', label: 'Asistió', de: asistio },
            { key: 'presento', label: 'Presentó', de: presento },
        ],
        chips: [
            { key: 'todas', label: 'Todas', filtro: () => true },
            { key: 'asistieron', label: 'Asistieron', filtro: (f) => f.asistio },
            { key: 'pendientes', label: 'Pendientes', filtro: (f) => f.post_call.key === 'pendiente' },
        ],
    },
};

export const TABLAS_POR_ROL = {
    // "Clientes" es la cartera: a quién le vendió y cómo va con los pagos. Es la única de las
    // cinco que NO se acota al período (ver `ComercialService.clientes`), y va tercera porque se
    // consulta cuando hay que cobrar, no cuando se revisa el día.
    closers: ['agendas', 'ventas', 'clientes'],
    setters: ['leads', 'generadas'],
};

/** Las dos tablas de agendas comparten totales, columna de post call y el selector de fecha. */
const esTablaDeAgendas = (tabla) => tabla === 'agendas' || tabla === 'generadas';

const texto = (fila) => [fila.cliente, fila.ig, fila.email, fila.telefono, fila.closer, fila.setter,
    fila.fuente, fila.programa].filter(Boolean).join(' ').toLowerCase();

/** Búsqueda + facetas. El filtro rápido se aplica aparte, para que los totales lo ignoren. */
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

/**
 * Panel de Configurar: un solo botón abre TODAS las facetas, cada una en su columna.
 *
 * Se ancla al borde IZQUIERDO de su botón (`.config-panel`): el panel es ancho (680px) y el botón
 * vive a la izquierda de la barra, así que alinearlo a la derecha lo sacaba de la pantalla. Debajo
 * de 900px el CSS lo saca del flujo flotante y lo despliega en su propia fila, empujando la tabla.
 */
const PanelConfigurar = ({ def, filas, facetas, setFacetas, modo, setModo, tabla, basis, setBasis,
    onLimpiar, onCerrar }) => {
    const opcionesDe = (faceta) => {
        // Las opciones se cuentan sobre TODAS las filas del período, no sobre lo ya filtrado: si
        // se contaran sobre lo filtrado, tildar un valor haría desaparecer a sus vecinos.
        const conteo = new Map();
        filas.forEach(f => {
            const v = faceta.de(f);
            if (v) conteo.set(v, (conteo.get(v) || 0) + 1);
        });
        return [...conteo.entries()].sort((a, b) => b[1] - a[1]);
    };

    const alternar = (faceta, valor) => {
        const actuales = facetas[faceta.key] || [];
        setFacetas({
            ...facetas,
            [faceta.key]: actuales.includes(valor)
                ? actuales.filter(v => v !== valor)
                : [...actuales, valor],
        });
    };

    const seleccionados = def.facetas.reduce((a, fa) => a + (facetas[fa.key]?.length || 0), 0);

    return (
        <div className="config-panel" role="dialog" aria-label="Filtro completo">
            <div className="config-cab">
                <p className="t-h3" style={{ fontSize: 16 }}>Filtro completo</p>
                {seleccionados > 0 && <span className="cuenta-burbuja">{seleccionados}</span>}
                <button type="button" className="ibtn ibtn--sm" style={{ marginLeft: 'auto' }}
                    onClick={onCerrar} aria-label="Cerrar">
                    <X size={15} />
                </button>
            </div>

            <div className="fila" style={{ gap: 'var(--s3)', flexWrap: 'wrap', marginBottom: 'var(--s4)' }}>
                {esTablaDeAgendas(tabla) && (
                    <>
                        <span className="t-rotulo">Fecha</span>
                        <div className="seg">
                            {[['meet', 'Fecha meet'], ['creacion', 'F. creación']].map(([k, label]) => (
                                <button key={k} type="button" aria-pressed={basis === k}
                                    onClick={() => setBasis(k)}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
                <span className="t-rotulo">Cumple</span>
                <div className="seg">
                    {[['todas', 'Todas'], ['alguna', 'Alguna']].map(([k, label]) => (
                        <button key={k} type="button" aria-pressed={modo === k}
                            onClick={() => setModo(k)}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="config-grid">
                {def.facetas.map(faceta => {
                    const sel = facetas[faceta.key] || [];
                    return (
                        <div key={faceta.key} className="config-col">
                            <p className="t-rotulo">
                                {faceta.label}{sel.length > 0 ? ` · ${sel.length}` : ''}
                            </p>
                            <div className="config-lista">
                                {opcionesDe(faceta).map(([valor, n]) => {
                                    const on = sel.includes(valor);
                                    return (
                                        <button key={valor} type="button" className="config-op"
                                            role="checkbox" aria-checked={on}
                                            onClick={() => alternar(faceta, valor)}>
                                            <span className="config-caja">{on ? '✓' : ''}</span>
                                            <span className="trunc">{valor}</span>
                                            <span className="cuenta">{n}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="config-pie">
                <span className="t-cap mut40">
                    {seleccionados === 0
                        ? 'Sin condiciones: se ve todo el período.'
                        : `${seleccionados} ${seleccionados === 1 ? 'condición' : 'condiciones'} sobre ${def.facetas.length} facetas.`}
                </span>
                <button type="button" className="btn btn--linea btn--sm" style={{ marginLeft: 'auto' }}
                    disabled={seleccionados === 0} onClick={onLimpiar}>
                    <RotateCcw size={13} />
                    Limpiar
                </button>
            </div>
        </div>
    );
};

/**
 * Totales de lo filtrado: una tira de verificación, no un panel de tarjetas. Son los mismos
 * números de antes (con su bajada, que es lo que los hace verificables: "18 de 22 asistieron"),
 * con mucho menos peso visual.
 */
const TotalesTira = ({ items, alcance }) => (
    <div className="tot-tira">
        {items.map(t => (
            <span key={t.label} className="tot-item">
                <b style={{ color: t.color }}>{t.valor}</b>
                {t.label}
                {t.hint && <span className="mut40"> · {t.hint}</span>}
            </span>
        ))}
        <span className="t-cap mut40" style={{ marginLeft: 'auto' }}>{alcance}</span>
    </div>
);

const Celda = ({ fila, col }) => {
    switch (col.key) {
        case 'fecha':
            return (
                <span className="celda num">
                    {fmt.fecha(fila.fecha)}
                    {fmt.hora(fila.fecha) && <span className="celda-sub num">{fmt.hora(fila.fecha)}</span>}
                </span>
            );
        case 'cliente':
            return (
                <span className="celda">
                    {fila.cliente}
                    {fila.ig && <span className="celda-sub">{fila.ig}</span>}
                </span>
            );
        case 'pre_call':
            return <ChipTono chip={fila.pre_call} />;
        case 'post_call':
            // El retraso va DEBAJO del chip de resultado: el chip dice qué pasó y la bajada dice
            // desde cuándo nadie lo carga, que es lo que hay que ir a resolver.
            return (
                <>
                    <ChipTono chip={fila.post_call} />
                    {fila.retraso_dias > 0 && (
                        <span className="celda-sub num"
                            style={{ color: 'var(--error)', fontWeight: 700 }}>
                            {fila.retraso_dias} {fila.retraso_dias === 1 ? 'día' : 'días'} sin reportar
                        </span>
                    )}
                </>
            );
        case 'estado':
            return <ChipTono chip={fila.estado} />;
        case 'tipo_pago':
            return (
                <>
                    <ChipTono chip={fila.tipo_pago} />
                    {fila.metodo && <span className="celda-sub">{fila.metodo}</span>}
                </>
            );
        case 'monto':
            return <span className="celda celda--num">{fmt.money(fila.monto)}</span>;
        case 'pagado':
            return (
                <span className="celda celda--num">
                    {fmt.money(fila.pagado)}
                    <span className="celda-sub num">{fmt.plural(fila.cobros, 'cobro', 'cobros')}</span>
                </span>
            );
        case 'deuda':
            // Cero no se escribe "$0": un cliente que no debe nada es una fila que no hay que
            // mirar, y el guión la saca del camino.
            return (
                <span className="celda celda--num"
                    style={fila.deuda > 0.01 ? { color: 'var(--error)', fontWeight: 800 } : undefined}>
                    {fila.deuda > 0.01 ? fmt.money(fila.deuda) : '—'}
                </span>
            );
        case 'cuota':
            // El chip dice en qué situación está y la bajada dice qué y cuándo cobrar, que es lo
            // que se viene a buscar acá.
            return (
                <>
                    <ChipTono chip={fila.estado} />
                    {fila.cuota_monto != null && (
                        <span className="celda-sub num"
                            style={fila.cuota_vencida ? { color: 'var(--error)', fontWeight: 700 } : undefined}>
                            {fmt.money(fila.cuota_monto)}
                            {fila.cuota_fecha ? ` · ${fmt.fecha(fila.cuota_fecha)}` : ' · sin plan'}
                        </span>
                    )}
                </>
            );
        case 'programa':
            return (
                <span className="chip" style={{
                    '--c': fila.programa === 'Residency Roadmap'
                        ? 'var(--prog-elite-b)' : 'var(--prog-ace)',
                }}>
                    {fila.programa}
                </span>
            );
        case 'mensajes':
            return <span className="celda celda--num">{fmt.num(fila.mensajes)}</span>;
        case 'ver':
            return <span className="celda-ver"><ArrowRight size={14} /></span>;
        default:
            return <span className="celda">{fila[col.key] || '—'}</span>;
    }
};

const Revisar = ({ tabla, setTabla, datos, cargando, rol, basis, setBasis, alcance, onAbrirFila,
    filtroInicial }) => {
    const [query, setQuery] = useState('');
    const [facetas, setFacetas] = useState({});
    const [modo, setModo] = useState('todas');
    const [chip, setChip] = useState(null);
    const [menu, setMenu] = useState(null);
    const barra = useRef(null);

    const def = TABLAS[tabla];

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
     */
    const token = filtroInicial?.__t ?? null;
    const [origen, setOrigen] = useState({ tabla, token: null });
    if (origen.tabla !== tabla || origen.token !== token) {
        const nuevas = {};
        if (token !== null && token !== origen.token) {
            Object.entries(filtroInicial).forEach(([k, valor]) => {
                if (k !== '__t') nuevas[k] = [valor];
            });
        }
        setOrigen({ tabla, token });
        setFacetas(nuevas);
        setChip(null);
        setQuery('');
        setMenu(null);
    }

    // Un solo menú abierto por vez, y se cierra al clickear afuera de la barra.
    useEffect(() => {
        if (!menu) return undefined;
        const fuera = (e) => { if (barra.current && !barra.current.contains(e.target)) setMenu(null); };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, [menu]);

    const filas = datos?.filas || [];
    const filtradas = useMemo(
        () => aplicarFiltros(filas, def, query, facetas, modo),
        [filas, def, query, facetas, modo]);

    const chipActivo = chip || def.chips[0].key;
    const rapido = def.chips.find(c => c.key === chipActivo) || def.chips[0];
    const visibles = useMemo(() => filtradas.filter(rapido.filtro), [filtradas, rapido]);

    const activas = def.facetas.reduce((a, f) => a + (facetas[f.key]?.length || 0), 0);
    const plantilla = def.cols.map(c => `minmax(0,${c.width})`).join(' ');

    const limpiar = () => { setFacetas({}); setChip(null); setQuery(''); };

    /**
     * Los seis números de la tira, recalculados sobre lo filtrado con las mismas reglas del
     * backend. Se recalculan acá y no se leen de `datos.totales` porque los del backend son del
     * período completo: el pie tiene que cerrar con lo que se ve arriba.
     */
    const totales = useMemo(() => {
        const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);

        if (tabla === 'ventas') {
            const cash = filtradas.reduce((a, f) => a + f.monto, 0);
            const ventas = filtradas.filter(f => f.es_venta).length;
            const neto = filtradas.reduce((a, f) => a + f.monto_neto, 0);
            return [
                { label: 'cash', valor: fmt.money(Math.round(cash * 100) / 100),
                    color: 'var(--text-on-surface)', hint: fmt.plural(filtradas.length, 'cobro', 'cobros') },
                { label: 'ventas', valor: fmt.num(ventas), color: 'var(--brand-secondary)',
                    hint: 'completo o split' },
                { label: 'ticket', valor: fmt.money(ventas ? Math.round((cash / ventas) * 100) / 100 : null),
                    color: 'var(--text-on-surface)', hint: 'cash / ventas' },
                { label: 'cash neto', valor: fmt.money(Math.round(neto * 100) / 100),
                    color: 'var(--success)', hint: 'sin fees de pasarela' },
            ];
        }

        if (tabla === 'clientes') {
            const deuda = filtradas.reduce((a, f) => a + f.deuda, 0);
            const conDeuda = filtradas.filter(f => f.deuda > 0.01).length;
            const vencidas = filtradas.filter(f => f.cuota_vencida);
            const vencido = vencidas.reduce((a, f) => a + (f.cuota_monto || 0), 0);
            const pagado = filtradas.reduce((a, f) => a + f.pagado, 0);
            return [
                { label: 'clientes', valor: fmt.num(filtradas.length), color: 'var(--text-on-surface)',
                    hint: `${filtradas.length - conDeuda} al día` },
                // "de esta cartera" y no "a hoy" a secas: el panel Cash de Analizar muestra
                // otro "por cobrar", atribuido por quién tiene HOY la agenda del cliente y sobre
                // todos los saldos del sistema. Los dos son correctos y dan distinto; el rótulo
                // es lo que evita que parezca que uno de los dos está mal.
                { label: 'deuda · de esta cartera', valor: fmt.money(Math.round(deuda * 100) / 100),
                    color: conDeuda ? 'var(--error)' : 'var(--success)',
                    hint: `${conDeuda} con saldo` },
                { label: 'vencido', valor: fmt.money(Math.round(vencido * 100) / 100),
                    color: 'var(--warning)',
                    hint: `${vencidas.length} ${vencidas.length === 1 ? 'cuota' : 'cuotas'}` },
                { label: 'cobrado', valor: fmt.money(Math.round(pagado * 100) / 100),
                    color: 'var(--success)', hint: 'desde siempre' },
            ];
        }

        if (tabla === 'leads') {
            const respondieron = filtradas.filter(f => f.respondio).length;
            const cualificados = filtradas.filter(f => f.cualificado).length;
            const agendaron = filtradas.filter(f => f.agendo).length;
            return [
                { label: 'leads', valor: fmt.num(filtradas.length), color: 'var(--text-on-surface)',
                    hint: `${fmt.num(filtradas.reduce((a, f) => a + f.mensajes, 0))} mensajes` },
                { label: 'respuesta', valor: fmt.pct(pct(respondieron, filtradas.length)),
                    color: 'var(--info)', hint: `${respondieron} de ${filtradas.length}` },
                { label: 'cualificación', valor: fmt.pct(pct(cualificados, respondieron)),
                    color: 'var(--success)', hint: `${cualificados} de ${respondieron}` },
                { label: 'conversión', valor: fmt.pct(pct(agendaron, filtradas.length)),
                    color: 'var(--brand-secondary)', hint: `${agendaron} agendaron` },
            ];
        }

        const realizadas = filtradas.filter(f => f.realizada).length;
        const asistieron = filtradas.filter(f => f.asistio).length;
        const ventas = filtradas.filter(f => f.post_call.key === 'venta').length;
        const noShow = filtradas.filter(f => f.post_call.key === 'no_show').length;
        const pendientes = filtradas.filter(f => f.post_call.key === 'pendiente');
        const conRetraso = pendientes.filter(f => f.retraso_dias > 0).length;
        const seguimiento = filtradas.filter(
            f => ['seguimiento', 'presento_no_cerro'].includes(f.post_call.key)).length;
        return [
            { label: 'agendas', valor: fmt.num(filtradas.length), color: 'var(--text-on-surface)',
                hint: `${realizadas} ya realizadas` },
            { label: 'show up', valor: fmt.pct(pct(asistieron, realizadas)), color: 'var(--success)',
                hint: `${asistieron} de ${realizadas} asistieron` },
            { label: 'close rate', valor: fmt.pct(pct(ventas, asistieron)),
                color: 'var(--brand-secondary)', hint: `${ventas} de ${asistieron} cerraron` },
            { label: 'seguimiento', valor: fmt.num(seguimiento), color: 'var(--warning)',
                hint: 'asistieron sin cerrar' },
            { label: 'no show', valor: fmt.num(noShow), color: 'var(--error)',
                hint: `${fmt.pct(pct(noShow, realizadas))} de las realizadas` },
            { label: 'pendientes', valor: fmt.num(pendientes.length),
                color: conRetraso ? 'var(--warning)' : 'var(--idle)',
                hint: conRetraso ? `${conRetraso} con retraso` : 'al día' },
        ];
    }, [filtradas, tabla]);

    const alcanceTexto = [alcance, query ? `"${query}"` : null].filter(Boolean).join(' · ');

    return (
        <section className="panel">
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
                                    onClick={() => { setChip(c.key); setMenu(null); }}>
                                    <span className="trunc">{c.label}</span>
                                    <span className="cuenta">{filtradas.filter(c.filtro).length}</span>
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
                        <PanelConfigurar def={def} filas={filas} facetas={facetas} setFacetas={setFacetas}
                            modo={modo} setModo={setModo} tabla={tabla} basis={basis} setBasis={setBasis}
                            onLimpiar={() => setFacetas({})} onCerrar={() => setMenu(null)} />
                    )}
                </div>

                <label className="busca busca--sm">
                    <span className="mut40" style={{ display: 'flex' }}><Search size={14} /></span>
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar cliente, @ig, persona…" aria-label="Buscar" />
                </label>

                <span className="t-cap mut40 num" style={{ marginLeft: 'auto' }}>
                    mostrando {visibles.length} de {filtradas.length}
                </span>
                <Ayuda titulo="Qué estás mirando" texto={def.ayuda} />
            </div>

            {activas > 0 && (
                <div className="fila" style={{ flexWrap: 'wrap', gap: 'var(--s2)', marginBottom: 'var(--s3)' }}>
                    <span className="t-rotulo">
                        {modo === 'alguna' ? 'Cumple alguna:' : 'Cumple todas:'}
                    </span>
                    {def.facetas.flatMap(fa => (facetas[fa.key] || []).map(v => (
                        <button key={`${fa.key}-${v}`} type="button" className="chip"
                            style={{ '--c': 'var(--brand-secondary)', textTransform: 'none',
                                letterSpacing: 0, fontWeight: 700 }}
                            aria-label={`Quitar ${v}`}
                            onClick={() => setFacetas({
                                ...facetas, [fa.key]: facetas[fa.key].filter(x => x !== v),
                            })}>
                            {v}
                            <X size={12} />
                        </button>
                    )))}
                    <button type="button" className="btn btn--linea btn--sm" onClick={limpiar}>
                        <RotateCcw size={13} />
                        Limpiar
                    </button>
                </div>
            )}

            {cargando ? <Cargando /> : (
                <>
                    <TotalesTira items={totales} alcance={alcanceTexto} />

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
                        <div className="tabla">
                            <div className="tabla-cab" style={{ '--cols': plantilla }}>
                                {def.cols.map(c => <span key={c.key}>{c.header}</span>)}
                            </div>
                            {visibles.map(fila => (
                                <div key={`${fila.tipo}-${fila.id}`} className="tabla-fila"
                                    role="button" tabIndex={0} style={{ '--cols': plantilla }}
                                    aria-label={`Abrir ${fila.cliente}`}
                                    onClick={() => onAbrirFila(fila)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onAbrirFila(fila);
                                        }
                                    }}>
                                    {def.cols.map(c => (
                                        // `data-h` es el rótulo que el CSS pinta a la izquierda de
                                        // cada dato cuando la tabla se apila en móvil.
                                        <div key={c.key} data-h={c.header}>
                                            <Celda fila={fila} col={c} />
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

export default Revisar;
