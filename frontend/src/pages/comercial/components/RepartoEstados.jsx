import { useState } from 'react';
import { Humo } from './Shared';
import { abrir } from '../../../components/dashboard/MetricaClicable';
import { Pct } from '../../../components/dashboard/MatrizCierres';
import './reparto-estados.css';

/**
 * Qué pasó con las agendas del período, en las dos vistas del panel Estados.
 *
 * El diseño es el de Kerwin (30/09/2026):
 *
 *   · Gráfico: una dona con un arco por estado y, al lado, los grupos (desde el 23/10/2026: show
 *     up, no show, canceladas, reprogramadas, descalificadas, sin reporte, aún no ocurrió y
 *     descartadas) con su porcentaje y su barra. Al medio, el show up. Detrás, el humo del tablero
 *     (`Humo`).
 *   · Tabla: una fila por estado, con la barra escalada al estado más grande.
 *
 * Qué estado va en qué grupo lo decide el backend (`GRUPO_DE_ESTADO` en `comercial_analitica.py`):
 * cada estado llega con su `grupo` y acá solo se suma.
 *
 * Cada estado y cada grupo lleva a Revisar con las agendas que lo componen: un estado filtra por su
 * etiqueta y un grupo por las de todos sus estados (un array en la misma faceta es un OR).
 *
 * Los colores salen del `tone` de cada estado (`var(--tone)`). Los pesos van en `<b>` / `<small>`,
 * como en `MatrizCierres`: son las etiquetas que el CSS global no fuerza a 400.
 */

// Los grupos del 23/10/2026 (antes: sin resultado, en curso y cerradas). `fijo`: se dibuja también
// en cero, para que lo que se viene a mirar no cambie de lugar de un período a otro.
export const GRUPOS = [
    { key: 'show_up', label: 'Show up', tone: 'success', fijo: true },
    { key: 'no_show', label: 'No show', tone: 'error', fijo: true },
    { key: 'canceladas', label: 'Canceladas', tone: 'brand-primary', fijo: true },
    { key: 'reprogramadas', label: 'Reprogramadas', tone: 'info', fijo: true },
    // Las que el closer descalificó al confirmar (23/10/2026): la dirección las mira siempre, aunque
    // el período no tenga ninguna. El violeta es el de `TONO_EN_PANEL` en el backend.
    { key: 'descalificadas', label: 'Descalificadas', tone: 'cat-6', fijo: true },
    { key: 'sin_reporte', label: 'Sin reporte', tone: 'warning' },
    { key: 'por_ocurrir', label: 'Aún no ocurrió', tone: 'idle' },
    { key: 'descartadas', label: 'Descartadas', tone: 'idle' },
];

// Un estado que llegue sin grupo (un backend viejo) se cuenta como descartado, para que los grupos
// sigan sumando el total: perderlo de la suma rompería el 100% en silencio.
const GRUPO_POR_DEFECTO = 'descartadas';

const ORDEN_DE_GRUPO = Object.fromEntries(GRUPOS.map((g, i) => [g.key, i]));
const ordenDe = (e) => ORDEN_DE_GRUPO[e.grupo] ?? ORDEN_DE_GRUPO[GRUPO_POR_DEFECTO];

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

/** Los grupos con su cuenta, su porcentaje y sus estados; los que no son `fijo` solo si tienen agendas. */
export const agrupar = (estados) => {
    const grupos = GRUPOS.map(g => ({ ...g, n: 0, estados: [] }));
    const porKey = Object.fromEntries(grupos.map(g => [g.key, g]));
    estados.forEach((e) => {
        const g = porKey[e.grupo] || porKey[GRUPO_POR_DEFECTO];
        g.n += e.n;
        g.estados.push(e);
    });
    const pcts = repartir(grupos.map(g => g.n));
    return grupos.map((g, i) => ({ ...g, pct: pcts[i] })).filter(g => g.fijo || g.n);
};

/**
 * El show up del centro, con la misma definición que la tarjeta del tablero (`comercial_service`):
 * asistieron / (asistieron + no show). Las canceladas, reprogramadas y las que no pasaron no son
 * llamadas que ocurrieron y no entran en la cuenta.
 */
export const showUpDe = (grupos) => {
    const n = (key) => grupos.find(g => g.key === key)?.n || 0;
    const realizadas = n('show_up') + n('no_show');
    return realizadas ? (n('show_up') / realizadas) * 100 : null;
};

const pct1 = (x) => x.toFixed(1);

/** El destino de Revisar de un estado o de un grupo. */
const destinoDe = (label, filtros) => ({
    tabla: 'agendas',
    filtro: { estado: filtros.length === 1 ? filtros[0] : filtros },
    de: `Estados: ${label}`,
});

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

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

const Dona = ({ estados, total, showUp, activo, irA }) => {
    // Dónde arranca cada arco: la suma de los anteriores, en % de la vuelta.
    const arranques = estados.map((_, i) => estados
        .slice(0, i).reduce((a, e) => a + (e.n / total) * 100, 0));
    const pcts = repartir(estados.map(e => e.n));
    const resumen = estados.map((e, i) => `${e.label} ${e.n} (${pct1(pcts[i])}%)`).join(', ');
    return (
        <div className="est-dona" role={irA ? 'group' : 'img'}
            aria-label={`${plural(total, 'agenda', 'agendas')}: ${resumen}`}>
            <svg className="est-dona-svg" viewBox={`0 0 ${LADO} ${LADO}`}
                aria-hidden={irA ? undefined : 'true'}>
                {estados.map((e, i) => {
                    const p = (e.n / total) * 100;
                    const largo = Math.max(p - Math.min(RENDIJA, p * 0.4), 0);
                    const ir = abrir(irA, destinoDe(e.label, [e.filtro]));
                    const texto = `${e.label}: ${plural(e.n, 'agenda', 'agendas')}, ${pct1(pcts[i])}%`;
                    return (
                        <circle key={e.key} className="est-seg" data-grupo={e.grupo}
                            data-apagado={activo && activo !== e.grupo ? '1' : undefined}
                            cx={C} cy={C} r={R} fill="none" stroke={color(e.tone)} strokeWidth={GRUESO}
                            pathLength="100" strokeDasharray={`${largo.toFixed(3)} ${(100 - largo).toFixed(3)}`}
                            strokeDashoffset={(-arranques[i]).toFixed(3)} transform={`rotate(-90 ${C} ${C})`}
                            {...(ir ? {
                                role: 'button', tabIndex: 0, 'aria-label': `${texto}. Ver en Revisar`,
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
            </span>
        </div>
    );
};

const FilaGrupo = ({ g, i, total, irA, onActivo }) => {
    const ir = g.n ? abrir(irA, destinoDe(g.label, g.estados.map(e => e.filtro))) : undefined;
    const Tag = ir ? 'button' : 'div';
    const detalle = g.estados.map(e => `${e.label} ${e.n}`).join(' · ');
    return (
        <Tag className="est-grupo" style={{ '--c': color(g.tone), '--i': i }}
            {...(ir ? {
                type: 'button', onClick: ir,
                'aria-label': `${g.label}: ${g.n} de ${plural(total, 'agenda', 'agendas')}, `
                    + `${pct1(g.pct)}%${detalle ? ` (${detalle})` : ''}. Ver en Revisar`,
            } : {})}
            title={detalle || undefined}
            onMouseEnter={() => onActivo(g.key)} onMouseLeave={() => onActivo(null)}
            onFocus={() => onActivo(g.key)} onBlur={() => onActivo(null)}>
            <span className="est-grupo-cab">
                <small className="est-grupo-nom">{g.label}</small>
                <Pct valor={pct1(g.pct)} className="est-grupo-pct" />
            </span>
            <span className="est-riel" aria-hidden="true">
                <i style={{ '--ancho': `${g.pct}%` }} />
            </span>
        </Tag>
    );
};

const Grafico = ({ estados, total, irA }) => {
    const [activo, setActivo] = useState(null);
    const grupos = agrupar(estados);
    // Los arcos van en el orden de los grupos, así cada grupo queda en un tramo seguido de la dona.
    const enOrden = [...estados].sort((a, b) => ordenDe(a) - ordenDe(b));
    return (
        <div className="est-caja caja">
            <Humo clase="est-aura" colores={[color('success'), color('brand-secondary'), color('brand-primary')]} />
            <Dona estados={enOrden} total={total} showUp={showUpDe(grupos)} activo={activo} irA={irA} />
            <div className="est-grupos">
                {grupos.map((g, i) => (
                    <FilaGrupo key={g.key} g={g} i={i} total={total} irA={irA} onActivo={setActivo} />
                ))}
            </div>
        </div>
    );
};

/* --- Tabla --------------------------------------------------------------------------------- */

const Tabla = ({ estados: crudos, irA }) => {
    const estados = [...crudos].sort((a, b) => ordenDe(a) - ordenDe(b));
    const max = Math.max(...estados.map(e => e.n), 1);
    const pcts = repartir(estados.map(e => e.n));
    return (
        <div className="est-tabla">
            {estados.map((e, i) => {
                const ir = abrir(irA, destinoDe(e.label, [e.filtro]));
                const Tag = ir ? 'button' : 'div';
                return (
                    <Tag key={e.key} className="est-fila" data-grupo={e.grupo}
                        style={{ '--c': color(e.tone), '--i': i }} title={e.ayuda}
                        {...(ir ? {
                            type: 'button', onClick: ir,
                            'aria-label': `${e.label}: ${plural(e.n, 'agenda', 'agendas')}, `
                                + `${pct1(pcts[i])}%. Ver en Revisar`,
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
 * `vista`: 'grafico' | 'tabla'. `irA`: el drill-down del tablero; sin él nada es cliqueable.
 */
const RepartoEstados = ({ estados, vista = 'grafico', irA }) => {
    const total = estados.reduce((a, e) => a + e.n, 0);
    if (!total) return null;
    return (
        // `key`: al cambiar de vista la nueva entra con su animación (la dona barre, las barras
        // crecen) en vez de aparecer de golpe.
        <div key={vista} className={`est est--${vista}`}>
            {vista === 'tabla'
                ? <Tabla estados={estados} irA={irA} />
                : <Grafico estados={estados} total={total} irA={irA} />}
        </div>
    );
};

export default RepartoEstados;
