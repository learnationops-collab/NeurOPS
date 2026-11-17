import { useState } from 'react';
import { Humo } from './Shared';
import { abrir } from '../../../components/dashboard/MetricaClicable';
import { Pct } from '../../../components/dashboard/MatrizCierres';
import './reparto-estados.css';

/**
 * El destino de las agendas del período, en las dos vistas del panel (ADR-W144, 16/11/2026).
 *
 *   · Gráfico: la dona y las filas reparten el 100% entre los cuatro destinos (se presentó, no show,
 *     canceló, reprogramó) más «Sin reportar», que es la MISMA base de la tarjeta Show up. Al medio,
 *     el show up con su cuenta. Lo que no tiene destino (aún no ocurre, descalificadas, descartadas) va
 *     debajo, en la tira «No cuentan en el show up». Detrás, el humo del tablero (`Humo`).
 *   · Tabla: una fila por estado, con la barra escalada al estado más grande y el % sobre todas.
 *
 * Qué estado va en qué grupo lo decide el backend (`GRUPO_DE_ESTADO` en `comercial_analitica.py`):
 * cada estado llega con su `grupo` y acá solo se suma.
 *
 * Cada cifra abre su lista con `onVer(clave, rótulo)` (las agendas que la suman, ni una más). Sin
 * `onVer` lleva a Revisar por la etiqueta del estado, como antes.
 *
 * Los colores salen del `tone` de cada estado (`var(--tone)`). Los pesos van en `<b>` / `<small>`,
 * como en `MatrizCierres`: son las etiquetas que el CSS global no fuerza a 400.
 */

// `base`: cuenta en el show up. `fijo`: se dibuja también en cero, para que lo que se viene a mirar
// no cambie de lugar de un período a otro.
export const GRUPOS = [
    { key: 'show_up', label: 'Se presentó', tone: 'success', base: true, fijo: true },
    { key: 'no_show', label: 'No show', tone: 'error', base: true, fijo: true },
    { key: 'canceladas', label: 'Canceló', tone: 'brand-primary', base: true, fijo: true },
    { key: 'reprogramadas', label: 'Reprogramó', tone: 'info', base: true, fijo: true },
    { key: 'sin_reporte', label: 'Sin reportar', tone: 'warning', base: true },
    { key: 'por_ocurrir', label: 'Aún no ocurren', tone: 'idle' },
    // Las que el closer descalificó (23/10/2026): la dirección las mira siempre, también en cero.
    { key: 'descalificadas', label: 'Descalificadas', tone: 'cat-6', fijo: true },
    { key: 'descartadas', label: 'Descartadas', tone: 'idle' },
];

// Un estado que llegue sin grupo (un backend viejo) se cuenta como descartado, para que los grupos
// sigan sumando el total: perderlo de la suma rompería las cuentas en silencio.
const GRUPO_POR_DEFECTO = 'descartadas';

const ORDEN_DE_GRUPO = Object.fromEntries(GRUPOS.map((g, i) => [g.key, i]));
const BASE = new Set(GRUPOS.filter(g => g.base).map(g => g.key));
const grupoDe = (e) => (e.grupo in ORDEN_DE_GRUPO ? e.grupo : GRUPO_POR_DEFECTO);
const ordenDe = (e) => ORDEN_DE_GRUPO[grupoDe(e)];

const color = (tone) => `var(--${tone || 'idle'})`;

/**
 * Reparte el 100% entre `ns` con `decimales` fijos y por resto mayor: los porcentajes redondeados
 * por separado pueden sumar 99.9 o 100.1, y acá tienen que cerrar exacto con el total.
 */
export const repartir = (ns, decimales = 1) => {
    const total = ns.reduce((a, n) => a + n, 0);
    if (!total) return ns.map(() => 0);
    const escala = 100 * 10 ** decimales;
    const crudos = ns.map(n => (n / total) * escala);
    const pisos = crudos.map(Math.floor);
    const falta = escala - pisos.reduce((a, p) => a + p, 0);
    crudos
        .map((c, i) => [c - pisos[i], i])
        .sort((a, b) => b[0] - a[0] || a[1] - b[1])
        .slice(0, falta)
        .forEach(([, i]) => { pisos[i] += 1; });
    return pisos.map(p => p / 10 ** decimales);
};

/**
 * Los grupos con su cuenta y sus estados; los que no son `fijo` solo si tienen agendas. El 100% se
 * reparte entre los de la base del show up; los de afuera llevan `fuera` y `pct` null.
 */
export const agrupar = (estados) => {
    const grupos = GRUPOS.map(g => ({ ...g, n: 0, estados: [] }));
    const porKey = Object.fromEntries(grupos.map(g => [g.key, g]));
    estados.forEach((e) => {
        const g = porKey[grupoDe(e)];
        g.n += e.n;
        g.estados.push(e);
    });
    const deBase = grupos.filter(g => g.base);
    const pcts = repartir(deBase.map(g => g.n));
    return grupos
        .map(g => ({ ...g, fuera: !g.base, pct: g.base ? pcts[deBase.indexOf(g)] : null }))
        .filter(g => g.fijo || g.n);
};

/** Cuántas agendas entran en el show up: los cuatro destinos más las que ya pasaron sin reporte. */
export const baseDe = (grupos) => grupos.reduce((a, g) => a + (g.fuera ? 0 : g.n), 0);

/**
 * El show up del centro, con la misma definición que la tarjeta del tablero (ADR-W112): se presentaron
 * sobre los cuatro destinos más las pasadas sin reporte. Descalificadas, descartadas y las que todavía
 * no llegan no tienen destino y no entran.
 */
export const showUpDe = (grupos) => {
    const base = baseDe(grupos);
    return base ? ((grupos.find(g => g.key === 'show_up')?.n || 0) / base) * 100 : null;
};

const pct1 = (x) => x.toFixed(1);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Lo que abre una cifra: su lista (`onVer`) o, sin ella, Revisar con la etiqueta de sus estados. */
const irDe = ({ onVer, irA }, clave, label, filtros) => (onVer
    ? () => onVer(clave, label)
    : abrir(irA, { tabla: 'agendas', filtro: { estado: filtros.length === 1 ? filtros[0] : filtros }, de: `Estados: ${label}` }));

/* --- Gráfico ------------------------------------------------------------------------------- */

// Geometría de la dona, en px del viewBox: 168 de diámetro como en el diseño, con 4 de margen
// para que el arco que se resalta (más grueso) no quede cortado por el borde del SVG.
const LADO = 176;
const C = LADO / 2;
const GRUESO = 22;
const R = 84 - GRUESO / 2;
// La rendija entre arcos, en % de la vuelta. A un arco muy chico se le come a lo sumo el 40%, así
// un estado con una sola agenda sigue viéndose.
const RENDIJA = 0.7;

const Dona = ({ estados, base, presentes, showUp, activo, ver }) => {
    // Dónde arranca cada arco: la suma de los anteriores, en % de la vuelta.
    const arranques = estados.map((_, i) => estados
        .slice(0, i).reduce((a, e) => a + (e.n / base) * 100, 0));
    const pcts = repartir(estados.map(e => e.n));
    const resumen = estados.map((e, i) => `${e.label} ${e.n} (${pct1(pcts[i])}%)`).join(', ');
    const clicable = Boolean(ver.onVer || ver.irA);
    return (
        <div className="est-dona" role={clicable ? 'group' : 'img'}
            aria-label={`${plural(base, 'agenda', 'agendas')} con destino${resumen ? `: ${resumen}` : ''}`}>
            <svg className="est-dona-svg" viewBox={`0 0 ${LADO} ${LADO}`}
                aria-hidden={clicable ? undefined : 'true'}>
                {estados.map((e, i) => {
                    const p = (e.n / base) * 100;
                    const largo = Math.max(p - Math.min(RENDIJA, p * 0.4), 0);
                    const ir = irDe(ver, e.key, e.label, [e.filtro]);
                    const texto = `${e.label}: ${plural(e.n, 'agenda', 'agendas')}, ${pct1(pcts[i])}%`;
                    return (
                        <circle key={e.key} className="est-seg" data-grupo={e.grupo}
                            data-apagado={activo && activo !== e.grupo ? '1' : undefined}
                            cx={C} cy={C} r={R} fill="none" stroke={color(e.tone)} strokeWidth={GRUESO}
                            pathLength="100" strokeDasharray={`${largo.toFixed(3)} ${(100 - largo).toFixed(3)}`}
                            strokeDashoffset={(-arranques[i]).toFixed(3)} transform={`rotate(-90 ${C} ${C})`}
                            {...(ir ? {
                                role: 'button', tabIndex: 0, 'aria-label': `${texto}. Ver la lista`,
                                onClick: ir,
                                onKeyDown: (ev) => {
                                    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ir(); }
                                },
                            } : {})}>
                            <title>{e.ayuda ? `${texto}. ${e.ayuda}` : texto}</title>
                        </circle>
                    );
                })}
            </svg>
            <span className="est-centro">
                {showUp === null
                    ? <b className="est-centro-pct">—</b>
                    : <Pct valor={Math.round(showUp)} className="est-centro-pct" />}
                <small className="est-centro-rot">show up</small>
                {base > 0 && <small className="est-centro-cta num">{presentes} de {base}</small>}
            </span>
        </div>
    );
};

const FilaGrupo = ({ g, i, base, ver, onActivo }) => {
    const ir = g.n ? irDe(ver, g.key, g.label, g.estados.map(e => e.filtro)) : undefined;
    const Tag = ir ? 'button' : 'div';
    const detalle = g.estados.map(e => `${e.label} ${e.n}`).join(' · ');
    // Los no show que el closer descartó (no respondieron) siguen dentro del no show (ADR-W110).
    const descartados = g.estados.reduce((a, e) => a + (e.descartados || 0), 0);
    return (
        <Tag className="est-grupo" style={{ '--c': color(g.tone), '--i': i }}
            {...(ir ? {
                type: 'button', onClick: ir,
                'aria-label': `${g.label}: ${g.n} de ${plural(base, 'agenda', 'agendas')} con destino, `
                    + `${pct1(g.pct)}%${detalle ? ` (${detalle})` : ''}. Ver la lista`,
            } : {})}
            title={detalle || undefined}
            onMouseEnter={() => onActivo(g.key)} onMouseLeave={() => onActivo(null)}
            onFocus={() => onActivo(g.key)} onBlur={() => onActivo(null)}>
            <span className="est-grupo-cab">
                <small className="est-grupo-nom">{g.label}</small>
                <span className="est-grupo-der">
                    <small className="est-grupo-n num">{g.n}</small>
                    <Pct valor={pct1(g.pct)} className="est-grupo-pct" />
                </span>
            </span>
            <span className="est-riel" aria-hidden="true">
                <i style={{ '--ancho': `${g.pct}%` }} />
            </span>
            {descartados > 0 && (
                <small className="est-grupo-sub" title="No respondieron ningún mensaje; el closer los descartó.">
                    {descartados} {descartados === 1 ? 'descartado' : 'descartados'} · {g.n - descartados} sin descartar
                </small>
            )}
        </Tag>
    );
};

/** Lo que no tiene destino: una cifra por grupo, y por estado en «Descartadas» (lead perdido, archivada). */
const Fuera = ({ grupos, ver }) => {
    const celdas = grupos.flatMap(g => (g.key === 'descartadas'
        ? g.estados.map(e => ({ key: e.key, label: e.label, n: e.n, ayuda: e.ayuda, filtros: [e.filtro] }))
        : [{ key: g.key, label: g.label, n: g.n, ayuda: g.estados.find(e => e.ayuda)?.ayuda, filtros: g.estados.map(e => e.filtro) }]));
    if (!celdas.length) return null;
    return (
        <div className="est-desc est-fuera" role="group" aria-label="No cuentan en el show up">
            <small className="est-desc-tit">No cuentan en el show up</small>
            {celdas.map((c) => {
                const ir = c.n ? irDe(ver, c.key, c.label, c.filtros) : undefined;
                const Tag = ir ? 'button' : 'span';
                return (
                    <Tag key={c.key} className="est-desc-celda est-fuera-celda" title={c.ayuda}
                        {...(ir ? { type: 'button', onClick: ir,
                            'aria-label': `${c.label}: ${plural(c.n, 'agenda', 'agendas')}, fuera del show up. Ver la lista` } : {})}>
                        <b className="est-desc-n num">{c.n}</b>
                        <small className="est-desc-rot">{c.label}</small>
                    </Tag>
                );
            })}
        </div>
    );
};

const Grafico = ({ estados, ver }) => {
    const [activo, setActivo] = useState(null);
    const grupos = agrupar(estados);
    const deBase = grupos.filter(g => !g.fuera);
    const base = baseDe(grupos);
    // Los arcos van en el orden de los grupos, así cada grupo queda en un tramo seguido de la dona.
    const enOrden = estados.filter(e => BASE.has(grupoDe(e))).sort((a, b) => ordenDe(a) - ordenDe(b));
    return (
        <>
            <div className="est-caja caja">
                <Humo clase="est-aura" colores={[color('success'), color('brand-secondary'), color('brand-primary')]} />
                <Dona estados={enOrden} base={base} presentes={deBase.find(g => g.key === 'show_up')?.n || 0}
                    showUp={showUpDe(grupos)} activo={activo} ver={ver} />
                <div className="est-grupos">
                    {deBase.map((g, i) => (
                        <FilaGrupo key={g.key} g={g} i={i} base={base} ver={ver} onActivo={setActivo} />
                    ))}
                </div>
            </div>
            <Fuera grupos={grupos.filter(g => g.fuera)} ver={ver} />
        </>
    );
};

/* --- Tabla --------------------------------------------------------------------------------- */

const Tabla = ({ estados: crudos, ver }) => {
    const estados = [...crudos].sort((a, b) => ordenDe(a) - ordenDe(b));
    const max = Math.max(...estados.map(e => e.n), 1);
    const pcts = repartir(estados.map(e => e.n));
    return (
        <div className="est-tabla">
            {estados.map((e, i) => {
                const ir = irDe(ver, e.key, e.label, [e.filtro]);
                const Tag = ir ? 'button' : 'div';
                return (
                    <Tag key={e.key} className="est-fila" data-grupo={e.grupo}
                        style={{ '--c': color(e.tone), '--i': i }} title={e.ayuda}
                        {...(ir ? {
                            type: 'button', onClick: ir,
                            'aria-label': `${e.label}: ${plural(e.n, 'agenda', 'agendas')}, `
                                + `${pct1(pcts[i])}%. Ver la lista`,
                        } : {})}>
                        <i className="est-punto" aria-hidden="true" />
                        <small className="est-fila-nom">{e.label}</small>
                        <span className="est-fila-riel" aria-hidden="true">
                            <i style={{ '--ancho': `${(e.n / max) * 100}%` }} />
                        </span>
                        <b className="est-fila-n">{e.n}</b>
                        <small className="est-fila-p">{pct1(pcts[i])}%</small>
                    </Tag>
                );
            })}
        </div>
    );
};

/**
 * `estados`: `[{key, label, tone, n, filtro, grupo}]` tal como los manda `estados_de`, más `ayuda`
 * (el tooltip) en los estados que hay que explicar: «Lead perdido» y «Archivada sin reporte».
 * `vista`: 'grafico' | 'tabla'. `onVer(clave, rótulo)`: abre la lista de un grupo o de un estado.
 * `irA`: el drill-down a Revisar, si no hay `onVer`; sin ninguno de los dos nada es cliqueable.
 */
const RepartoEstados = ({ estados, vista = 'grafico', irA, onVer = null }) => {
    const total = estados.reduce((a, e) => a + e.n, 0);
    if (!total) return null;
    const ver = { onVer, irA };
    return (
        // `key`: al cambiar de vista la nueva entra con su animación (la dona barre, las barras
        // crecen) en vez de aparecer de golpe.
        <div key={vista} className={`est est--${vista}`}>
            {vista === 'tabla' ? <Tabla estados={estados} ver={ver} /> : <Grafico estados={estados} ver={ver} />}
        </div>
    );
};

export default RepartoEstados;
