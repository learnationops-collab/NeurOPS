import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Filter, LayoutGrid, List, Rows, RotateCcw, Search,
    SlidersHorizontal, X } from 'lucide-react';
import { Cargando, fmt } from './Shared';
import { TABLAS, TABLAS_POR_ROL } from './tablasDef';
import PanelDetalle from '../../../components/dashboard/PanelDetalle';
import PanelConfigurar from './PanelConfigurar';
import RevisarLista from './RevisarLista';
import { useModoVista } from '../../../components/listas/useModoVista';

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

/** Ícono "i" con la explicación de lo que se está mirando. Se abre y cierra por CSS. */
const Ayuda = ({ titulo, texto }) => (
    <span className="tip" tabIndex={0} role="note" aria-label={`${titulo}: ${texto}`}>
        <span className="tip-dot" aria-hidden="true">i</span>
        <span className="tip-burbuja" aria-hidden="true"><b>{titulo}</b>{texto}</span>
    </span>
);

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

const Revisar = ({ tabla, setTabla, datos, cargando, rol, basis, setBasis, alcance, onAbrirFila,
    filtroInicial, onOlvidarFiltro }) => {
    const [query, setQuery] = useState('');
    const [facetas, setFacetas] = useState({});
    const [modo, setModo] = useState('todas');
    const [chip, setChip] = useState(null);
    const [menu, setMenu] = useState(null);
    const [agrupacion, setAgrupacion] = useState(null);
    const barra = useRef(null);

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
     */
    const token = filtroInicial?.__t ?? null;
    const [origen, setOrigen] = useState({ tabla, token: null, de: null, aviso: null });
    if (origen.tabla !== tabla || origen.token !== token) {
        const nuevas = {};
        let de = null;
        let aviso = null;
        if (token !== null && token !== origen.token) {
            de = filtroInicial.__de || null;
            aviso = filtroInicial.__aviso || null;
            Object.entries(filtroInicial).forEach(([k, valor]) => {
                // Las claves `__` son metadatos del drill-down (token, procedencia, advertencia),
                // no condiciones. Un array de etiquetas en la misma faceta es un OR.
                if (k.startsWith('__') || valor === null || valor === undefined) return;
                nuevas[k] = Array.isArray(valor) ? valor : [valor];
            });
        }
        setOrigen({ tabla, token, de, aviso });
        setFacetas(nuevas);
        setChip(null);
        setQuery('');
        setMenu(null);
        // La agrupación también se reinicia: las dimensiones son por tabla y la de Ventas no
        // existe en Leads.
        setAgrupacion(null);
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
    const dimension = (def.agrupables || []).find(d => d.key === agrupacion) || null;

    const limpiar = () => {
        setFacetas({});
        setChip(null);
        setQuery('');
        // Sacar el filtro también saca el aviso de procedencia: si no, la lista seguía diciendo
        // "viniste de Show up" arriba de las agendas completas del período.
        setOrigen(o => ({ ...o, de: null, aviso: null }));
        // Y lo saca de la URL, que es donde vive el filtro del drill-down: sin esto, salir de
        // Revisar y volver lo resucitaba.
        onOlvidarFiltro?.();
    };

    const quitarCriterio = (clave, valor) => setFacetas({
        ...facetas, [clave]: (facetas[clave] || []).filter(x => x !== valor),
    });

    /** Las condiciones activas, con el nombre de su faceta, para el aviso de procedencia. */
    const criterios = def.facetas.flatMap(fa => (facetas[fa.key] || []).map(
        valor => ({ clave: fa.key, faceta: fa.label, valor })));

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

                {/* Agrupar por: la dimensión sale de `def.agrupables`, así que cada tabla ofrece
                    las suyas y agregar un criterio nuevo es una línea en `tablasDef.js`. */}
                {(def.agrupables || []).length > 0 && (
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
                                {def.agrupables.map(d => (
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

                <span className="t-cap mut40 num" style={{ marginLeft: 'auto' }}>
                    mostrando {visibles.length} de {filtradas.length}
                </span>
                <Ayuda titulo="Qué estás mirando" texto={def.ayuda} />
            </div>

            {/* De dónde viene el filtro. Va arriba de los chips de faceta porque contesta la
                pregunta anterior: no "qué condición hay puesta" sino "qué número me trajo acá". */}
            <PanelDetalle de={origen.de} aviso={origen.aviso} criterios={criterios}
                cuantas={visibles.length} total={filas.length}
                onQuitarCriterio={quitarCriterio} onLimpiar={limpiar} />

            {activas > 0 && (
                <div className="fila" style={{ flexWrap: 'wrap', gap: 'var(--s2)', marginBottom: 'var(--s3)' }}>
                    <span className="t-rotulo">
                        {modo === 'alguna' ? 'Cumple alguna:' : 'Cumple todas:'}
                    </span>
                    {criterios.map(c => (
                        <button key={`${c.clave}-${c.valor}`} type="button" className="chip"
                            style={{ '--c': 'var(--brand-secondary)', textTransform: 'none',
                                letterSpacing: 0, fontWeight: 700 }}
                            aria-label={`Quitar ${c.valor}`}
                            onClick={() => quitarCriterio(c.clave, c.valor)}>
                            {c.valor}
                            <X size={12} />
                        </button>
                    ))}
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
                        <RevisarLista def={def} visibles={visibles} plantilla={plantilla}
                            onAbrirFila={onAbrirFila} dimension={dimension} modo={modoVista} />
                    )}
                </>
            )}
        </section>
    );
};

export default Revisar;
