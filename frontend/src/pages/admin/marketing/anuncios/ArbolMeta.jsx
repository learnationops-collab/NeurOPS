import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, Check, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Columns, RotateCcw,
    Search, SlidersHorizontal, X } from 'lucide-react';
import PanelConfigurar from '../../../comercial/components/PanelConfigurar';
import { Tip } from '../../../comercial/components/Shared';
import { pasaFacetas } from '../../../../components/listas/ListaConfigurable';
import { useColumnasVisibles } from '../../../../components/listas/useColumnasVisibles';
import { useEnPantalla } from '../../../../components/ui/useEnPantalla';
import EnlaceMeta from './EnlaceMeta';
import { armarDesglose, clavesAbribles, ordenarDesglose, totalDelDesglose } from './desgloseMeta';
import { enlaceAdministrador } from './enlacesMeta';
import { EMBUDOS, formatear } from './metricas';
import '../../../../components/listas/listas.css';

/**
 * Meta Ads › Campañas, conjuntos y anuncios (16/10/2026): el desglose de `desgloseMeta.js` con la
 * barra de la lista estándar (filtro completo, columnas elegibles, búsqueda, «mostrando X de Y») y la
 * tabla de Marketing, que es la del Administrador de anuncios (nombre fijo al desplazar de lado). Los
 * números se suman en cada nivel; el embudo y la palabra clave se eligen por anuncio. Cada fila tiene
 * su enlace a esa campaña, conjunto o anuncio en Meta para editarla allá.
 *
 * `ListaConfigurable` es plana (no anida filas): de ella se usan `useColumnasVisibles` y `pasaFacetas`, y
 * el menú de columnas es una copia local del suyo, que no se exporta.
 */

export const AUTO = '__auto';
export const NINGUNA = '__ninguna';

export const ESTADOS = {
    ACTIVE: { label: 'Activo', tono: 'success' },
    PAUSED: { label: 'Pausado', tono: 'idle' },
    ADSET_PAUSED: { label: 'Conjunto pausado', tono: 'idle' },
    CAMPAIGN_PAUSED: { label: 'Campaña pausada', tono: 'idle' },
    WITH_ISSUES: { label: 'Con problemas', tono: 'warning' },
    DISAPPROVED: { label: 'Rechazado', tono: 'error' },
    PENDING_REVIEW: { label: 'En revisión', tono: 'info' },
    IN_PROCESS: { label: 'En proceso', tono: 'info' },
    ARCHIVED: { label: 'Archivado', tono: 'idle' },
    DELETED: { label: 'Borrado', tono: 'idle' },
    INACTIVO: { label: 'Sin activos', tono: 'idle' },
};
export const estadoDe = (clave) => ESTADOS[clave] || { label: clave || '—', tono: 'idle' };
export const etiquetaDeEmbudo = (key) => EMBUDOS.find((e) => e.key === key)?.label || (key ? key : 'Sin clasificar');

/** Adónde lleva el anuncio, corto: «DM de Instagram», «/live-class-t4/» o el dominio. */
export const textoDestino = (destino) => {
    if (!destino) return null;
    if (/instagram\.com|ig\.me|^cta:(INSTAGRAM|MESSAGE|WHATSAPP)/i.test(destino)) return 'DM de Instagram';
    try {
        const u = new URL(destino);
        return /thelearnation\.com$/i.test(u.hostname) ? u.pathname : u.hostname;
    } catch {
        return destino.replace(/^cta:/, '');
    }
};

const SIN_CLAVE = ['workshop', 'contratacion'];
const pct = (v) => (v == null ? '—' : `${Number(v).toFixed(2)}%`);
const NIVEL = { campana: 'Campaña', conjunto: 'Conjunto', anuncio: 'Anuncio' };

const embudosDeGrupo = (embudos) => {
    const claves = Object.keys(embudos || {});
    if (claves.length === 1) return etiquetaDeEmbudo(claves[0] === 'null' ? null : claves[0]);
    return claves.map((k) => `${etiquetaDeEmbudo(k === 'null' ? null : k)} ${embudos[k]}`).join(' · ');
};

// Como en el Administrador de anuncios: primero el nombre, el estado y los números; la clasificación
// (embudo y palabra clave), al final.
const COLUMNAS = [
    { key: 'nombre', header: 'Nombre', fija: true, valor: (n) => n.nombre },
    { key: 'estado', header: 'Estado', valor: (n) => estadoDe(n.estado).label },
    { key: 'gasto', header: 'Importe gastado', num: true, valor: (n) => n.gasto, formato: 'money' },
    { key: 'impresiones', header: 'Impresiones', num: true, valor: (n) => n.impresiones, formato: 'num' },
    { key: 'clics', header: 'Clics (todos)', num: true, valor: (n) => n.clics, formato: 'num' },
    { key: 'ctr', header: 'CTR', num: true, valor: (n) => n.ctr, formato: 'pct',
      ayuda: 'Clics (todos) ÷ impresiones.' },
    { key: 'cpc', header: 'CPC (enlace)', num: true, valor: (n) => n.cpc, formato: 'money',
      ayuda: 'Importe gastado ÷ clics en el enlace, como se carga en cada taller.' },
    { key: 'cpm', header: 'CPM', num: true, valor: (n) => n.cpm, formato: 'money', oculta: true,
      ayuda: 'Costo por mil impresiones.' },
    { key: 'leads', header: 'Leads', num: true, valor: (n) => n.leads, formato: 'num',
      ayuda: 'Los que entraron por la palabra clave del anuncio en el período (Rendimiento). En un grupo, cada palabra clave cuenta una vez; ManyChat no dice de qué anuncio vino cada lead.' },
    { key: 'embudo', header: 'Embudo', ayuda: 'A qué embudo va el gasto. Lo pone la sincronización por adónde lleva el anuncio; se corrige por anuncio.',
      valor: (n) => (n.tipo === 'anuncio' ? etiquetaDeEmbudo(n.anuncio.embudo) : embudosDeGrupo(n.embudos)) },
    { key: 'clave', header: 'Palabra clave', ayuda: 'La palabra clave de ManyChat a la que va el gasto (Rendimiento). Automática: la que el anuncio pide escribir.',
      valor: (n) => n.claves.join(', ') || null },
    { key: 'texto', header: 'Texto del anuncio', oculta: true, valor: (n) => n.anuncio?.texto || null },
    { key: 'destino', header: 'Lleva a', oculta: true, valor: (n) => textoDestino(n.anuncio?.destino) },
];

const FACETAS = [
    { key: 'estado', label: 'Estado', de: (a) => estadoDe(a.estado).label },
    { key: 'embudo', label: 'Embudo', de: (a) => etiquetaDeEmbudo(a.embudo) },
    { key: 'clave', label: 'Palabra clave', de: (a) => a.clave || 'Sin palabra clave' },
    { key: 'campana', label: 'Campaña', de: (a) => a.campana || 'Sin campaña' },
];

const normal = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const MenuColumnas = ({ columnas, visibles, alternar, restablecer, onCerrar }) => {
    const caja = useRef(null);
    const enPantalla = useEnPantalla(caja);
    useEffect(() => {
        const fuera = (e) => { if (!caja.current?.contains(e.target)) onCerrar(); };
        const escape = (e) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', escape);
        };
    }, [onCerrar]);
    const vistas = new Set(visibles.map((c) => c.key));
    return (
        <div className="menu lc-menu-columnas" role="menu" aria-label="Columnas" ref={enPantalla}>
            {columnas.map((c) => (
                <button key={c.key} type="button" className="menu-item" role="menuitemcheckbox"
                    aria-checked={vistas.has(c.key)} disabled={c.fija} onClick={() => alternar(c.key)}>
                    <span className="menu-caja" aria-hidden="true">{vistas.has(c.key) ? <Check size={11} /> : ''}</span>
                    <span className="trunc">{c.header}</span>
                </button>
            ))}
            <button type="button" className="menu-item lc-restablecer" onClick={restablecer}>
                <RotateCcw size={13} aria-hidden="true" />
                <span className="trunc">Columnas por defecto</span>
            </button>
        </div>
    );
};

const ArbolMeta = ({ anuncios, claves, leadsPorClave, cuentas, moneda, guardando, onElegirClave, onElegirEmbudo }) => {
    const quieto = useReducedMotion();
    const { visibles, alternar, restablecer } = useColumnasVisibles('mk-meta-columnas', COLUMNAS);
    const [query, setQuery] = useState('');
    const [soloActivos, setSoloActivos] = useState(false);
    const [elegidas, setElegidas] = useState({});
    const [modo, setModo] = useState('todas');
    const [orden, setOrden] = useState({ key: 'gasto', dir: 'desc' });
    const [menu, setMenu] = useState(null);
    const [abiertas, setAbiertas] = useState(() => new Set());

    const activas = FACETAS.reduce((n, f) => n + (elegidas[f.key]?.length || 0), 0);
    const filtrando = activas > 0 || soloActivos || !!query.trim();

    const filtrados = useMemo(() => {
        const q = normal(query.trim());
        return (anuncios || []).filter((a) => (!soloActivos || a.estado === 'ACTIVE')
            && pasaFacetas(a, FACETAS, elegidas, modo)
            && (!q || [a.nombre, a.campana, a.conjunto, a.clave, a.texto].some((x) => normal(x).includes(q))));
    }, [anuncios, query, soloActivos, elegidas, modo]);

    const arbol = useMemo(() => {
        const col = COLUMNAS.find((c) => c.key === orden?.key);
        const base = armarDesglose(filtrados, leadsPorClave);
        return col ? ordenarDesglose(base, col.valor, orden.dir) : base;
    }, [filtrados, leadsPorClave, orden]);
    const total = useMemo(() => totalDelDesglose(filtrados, leadsPorClave), [filtrados, leadsPorClave]);
    const todas = useMemo(() => clavesAbribles(arbol), [arbol]);
    // Buscando o filtrando se ve todo abierto: lo que se busca suele ser un anuncio.
    const abierta = (key) => filtrando || abiertas.has(key);
    const todoAbierto = todas.length > 0 && todas.every(abierta);

    const alternarFila = (key) => setAbiertas((a) => {
        const s = new Set(a);
        if (s.has(key)) s.delete(key); else s.add(key);
        return s;
    });
    const ordenar = (key) => setOrden((o) => {
        if (o?.key !== key) return { key, dir: key === 'nombre' ? 'asc' : 'desc' };
        return o.dir === 'desc' ? { key, dir: 'asc' } : { key, dir: 'desc' };
    });
    const quitar = (key, valor) => setElegidas((e) => ({ ...e, [key]: e[key].filter((v) => v !== valor) }));

    const enlace = (n) => {
        const cuenta = n.cuenta_id || n.anuncio?.cuenta_id || cuentas?.[0];
        if (n.tipo === 'campana') return enlaceAdministrador(cuenta, 'campana', { campanas: [n.campana_id] });
        if (n.tipo === 'conjunto') {
            return enlaceAdministrador(cuenta, 'conjunto', { campanas: [n.campana_id], conjuntos: [n.conjunto_id] });
        }
        return enlaceAdministrador(cuenta, 'anuncio', {
            campanas: [n.anuncio.campana_id], conjuntos: [n.anuncio.conjunto_id], anuncios: [n.anuncio.meta_ad_id] });
    };

    const celda = (col, n) => {
        if (col.num) {
            const v = col.valor(n);
            return <td key={col.key} className="mk-num num">{col.formato === 'pct' ? pct(v) : formatear(v, col.formato, moneda)}</td>;
        }
        if (col.key === 'estado') {
            const e = estadoDe(n.estado);
            return (
                <td key={col.key}>
                    <span className="chip mk-chip-estado" style={{ '--c': `var(--${e.tono})` }}><span className="trunc">{e.label}</span></span>
                    {n.tipo !== 'anuncio' && <span className="mk-sub-estado t-cap mut40 num">{n.activos} de {n.anuncios} activos</span>}
                </td>
            );
        }
        if (col.key === 'embudo' && n.tipo === 'anuncio') {
            const a = n.anuncio;
            return (
                <td key={col.key}>
                    <select className="mk-select" value={a.embudo_mapeo === 'manual' ? a.embudo : AUTO}
                        disabled={guardando === a.meta_ad_id} aria-label={`Embudo de ${a.nombre}`}
                        onChange={(e) => onElegirEmbudo(a, e.target.value)}>
                        <option value={AUTO}>
                            {a.embudo_mapeo === 'auto' && a.embudo ? `Automático: ${etiquetaDeEmbudo(a.embudo)}` : 'Automático (sin clasificar)'}
                        </option>
                        {EMBUDOS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
                    </select>
                </td>
            );
        }
        if (col.key === 'clave' && n.tipo === 'anuncio') {
            const a = n.anuncio;
            // Los de Workshop y Contratación no van a ManyChat: sin selector, salvo que alguien ya
            // les haya elegido una a mano.
            if (SIN_CLAVE.includes(a.embudo) && a.mapeo !== 'manual') {
                return <td key={col.key}><span className="mut40" title="Este embudo no lleva palabra clave de ManyChat">—</span></td>;
            }
            return (
                <td key={col.key}>
                    <select className="mk-select" value={a.mapeo === 'manual' ? (a.clave || NINGUNA) : AUTO}
                        disabled={guardando === a.meta_ad_id} aria-label={`Palabra clave de ${a.nombre}`}
                        onChange={(e) => onElegirClave(a, e.target.value)}>
                        <option value={AUTO}>{a.mapeo === 'auto' && a.clave ? `Automática: ${a.clave}` : 'Automática (no la encontró)'}</option>
                        <option value={NINGUNA}>Ninguna (no es de ManyChat)</option>
                        {(claves || []).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </td>
            );
        }
        const v = col.valor(n);
        return (
            <td key={col.key} className={col.key === 'texto' ? 'mk-texto' : undefined}>
                <span className="mk-celda-txt trunc" title={v || undefined}>{v || '—'}</span>
            </td>
        );
    };

    const fila = (n, i) => {
        const tieneHijos = n.tipo !== 'anuncio' && n.hijos?.length > 0;
        const abiertaN = tieneHijos && abierta(n.key);
        const href = enlace(n);
        // Debajo del nombre: qué tiene adentro (campaña, conjunto) o adónde lleva (anuncio).
        const sub = n.tipo === 'campana'
            ? `${n.hijos.length} ${n.hijos.length === 1 ? 'conjunto' : 'conjuntos'} · ${n.anuncios} ${n.anuncios === 1 ? 'anuncio' : 'anuncios'}`
            : n.tipo === 'conjunto' ? `${n.anuncios} ${n.anuncios === 1 ? 'anuncio' : 'anuncios'}`
                : textoDestino(n.anuncio.destino) ? `Lleva a ${textoDestino(n.anuncio.destino)}` : null;
        return (
            <Fragment key={n.key}>
                <motion.tr className={`mk-arbol-fila mk-arbol-fila--${n.tipo}`}
                    initial={quieto || n.tipo === 'campana' ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={quieto ? { duration: 0 } : { duration: 0.2, delay: Math.min(i, 8) * 0.025 }}>
                    <th className="mk-col-nombre" scope="row">
                        <div className="mk-arbol-nombre">
                            {tieneHijos ? (
                                <button type="button" className="mk-arbol-abrir" onClick={() => alternarFila(n.key)}
                                    aria-expanded={abiertaN} aria-label={`${abiertaN ? 'Cerrar' : 'Abrir'} ${NIVEL[n.tipo].toLowerCase()} ${n.nombre}`}>
                                    {abiertaN ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                                </button>
                            ) : <span className="mk-arbol-hueco" aria-hidden="true" />}
                            <span className="mk-nombre-txt">
                                <span className="mk-nombre-kw trunc" title={n.nombre}>{n.nombre}</span>
                                {sub && <span className="mk-nombre-sub trunc" title={sub}>{sub}</span>}
                            </span>
                            <EnlaceMeta href={href} className="ibtn mk-ibtn-meta" rotulo={`Abrir ${NIVEL[n.tipo].toLowerCase()} ${n.nombre} en Meta`}
                                titulo={`Editar ${NIVEL[n.tipo].toLowerCase()} en el Administrador de anuncios`} />
                        </div>
                    </th>
                    {visibles.filter((c) => !c.fija).map((c) => celda(c, n))}
                </motion.tr>
                {abiertaN && n.hijos.map((h, j) => fila(h, j))}
            </Fragment>
        );
    };

    return (
        <div className="mk-arbol">
            <div className="fila barra-tabla mk-arbol-barra">
                <div className="config-envoltura">
                    <button type="button" className={`pastilla${activas ? ' pastilla--on' : ''}`}
                        aria-expanded={menu === 'config'} aria-haspopup="dialog"
                        onClick={() => setMenu((m) => (m === 'config' ? null : 'config'))}>
                        <SlidersHorizontal size={15} />
                        Filtro completo
                        {activas > 0 && <span className="cuenta-burbuja">{activas}</span>}
                        <ChevronDown size={14} />
                    </button>
                    {menu === 'config' && (
                        <PanelConfigurar def={{ facetas: FACETAS }} filas={anuncios || []} facetas={elegidas}
                            setFacetas={setElegidas} modo={modo} setModo={setModo} tabla="lista"
                            onLimpiar={() => setElegidas({})} onCerrar={() => setMenu(null)} />
                    )}
                </div>
                <div style={{ position: 'relative' }}>
                    <button type="button" className="pastilla" aria-expanded={menu === 'columnas'} aria-haspopup="menu"
                        onClick={() => setMenu((m) => (m === 'columnas' ? null : 'columnas'))}>
                        <Columns size={15} />
                        Columnas
                        <span className="mut40 num" style={{ fontSize: 11.5 }}>{visibles.length}/{COLUMNAS.length}</span>
                        <ChevronDown size={14} />
                    </button>
                    {menu === 'columnas' && (
                        <MenuColumnas columnas={COLUMNAS} visibles={visibles} alternar={alternar}
                            restablecer={restablecer} onCerrar={() => setMenu(null)} />
                    )}
                </div>
                <button type="button" className={`pastilla${soloActivos ? ' pastilla--on' : ''}`}
                    aria-pressed={soloActivos} onClick={() => setSoloActivos((v) => !v)}>
                    Solo activos
                </button>
                <button type="button" className="pastilla" disabled={filtrando || !todas.length}
                    onClick={() => setAbiertas(todoAbierto ? new Set() : new Set(todas))}>
                    {todoAbierto ? <ChevronsDownUp size={15} aria-hidden="true" /> : <ChevronsUpDown size={15} aria-hidden="true" />}
                    {todoAbierto ? 'Cerrar todo' : 'Abrir todo'}
                </button>
                <label className="busca busca--sm">
                    <span className="mut40" style={{ display: 'flex' }}><Search size={14} /></span>
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar campaña, conjunto o anuncio" aria-label="Buscar anuncio de Meta" />
                </label>
                <span className="barra-cuenta">
                    <span className="t-cap mut40 num">mostrando {filtrados.length} de {(anuncios || []).length} anuncios</span>
                    <Tip titulo="Qué estás mirando" texto="Los anuncios de Meta que gastaron en el período, agrupados como en el Administrador de anuncios. Cada nivel suma a sus anuncios. El ícono de la flecha abre esa fila en Meta para editarla allá; al volver, la página trae lo que cambió." />
                </span>
            </div>

            {activas > 0 && (
                <div className="fila filtro-fila">
                    <span className="t-rotulo">{modo === 'alguna' ? 'Cumple alguna:' : 'Cumple todas:'}</span>
                    {FACETAS.flatMap((f) => (elegidas[f.key] || []).map((v) => (
                        <button key={`${f.key}-${v}`} type="button" className="chip filtro-tag"
                            style={{ '--c': 'var(--brand-secondary)', textTransform: 'none', letterSpacing: 0, fontWeight: 700 }}
                            aria-label={`Quitar ${f.label}: ${v}`} onClick={() => quitar(f.key, v)}>
                            {f.label}: {v}
                            <X size={12} />
                        </button>
                    )))}
                </div>
            )}

            {!filtrados.length ? (
                <p className="t-cap mut mk-vacio">Ningún anuncio cumple lo elegido.</p>
            ) : (
                <div className="mk-tabla-caja">
                    <table className="mk-tabla mk-tabla--meta mk-tabla--arbol">
                        <thead>
                            <tr>
                                {visibles.map((c) => {
                                    const dir = orden?.key === c.key ? orden.dir : null;
                                    return (
                                        <th key={c.key} scope="col" className={c.fija ? 'mk-col-nombre' : c.num ? 'mk-num' : undefined}
                                            aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                                            <span className={c.num ? 'mk-cab-celda' : 'mk-cab-celda mk-cab-celda--izq'}>
                                                <button type="button" className="mk-cab" onClick={() => ordenar(c.key)}
                                                    aria-label={`Ordenar por ${c.header}`}>
                                                    {c.header}
                                                    {dir && <ArrowDown size={11} aria-hidden="true"
                                                        className={dir === 'asc' ? 'cab-flecha cab-flecha--asc mk-flecha' : 'cab-flecha mk-flecha'} />}
                                                </button>
                                                {c.ayuda && <Tip texto={c.ayuda} titulo={c.header} />}
                                            </span>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>{arbol.map((n, i) => fila(n, i))}</tbody>
                        <tfoot>
                            <tr className="mk-arbol-total">
                                <th className="mk-col-nombre" scope="row">
                                    Total · {arbol.length} {arbol.length === 1 ? 'campaña' : 'campañas'}
                                </th>
                                {visibles.filter((c) => !c.fija).map((c) => (c.num
                                    ? <td key={c.key} className="mk-num num">{c.formato === 'pct' ? pct(c.valor(total)) : formatear(c.valor(total), c.formato, moneda)}</td>
                                    : <td key={c.key} />))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ArbolMeta;
