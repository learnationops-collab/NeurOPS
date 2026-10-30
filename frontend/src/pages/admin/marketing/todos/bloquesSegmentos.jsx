import { Accordion } from '../../../../components/standard';
import { Columnas, Grupos } from './ControlesSegmentos';
import CruceSegmentos from './CruceSegmentos';
import TablaSegmentos from './TablaSegmentos';
import { COLUMNAS_SEGMENTO, valorDe } from './segmentos';

/**
 * Los bloques de «Segmentos» (Kerwin, 29/10/2026): cada uno es un desplegable del `Accordion`, y la vista los arma
 * recorriendo esta lista. AGREGAR O QUITAR UN BLOQUE = sumar o sacar una función de `BLOQUES`; el resto no cambia.
 *
 * Un bloque es `(ctx) => item | [item] | null`. El item es el de `Accordion` (`key`, `title`, `meta`, `color`, `children`,
 * `open`: abierto la primera vez); `null` = no aplica. `ctx` trae lo que la vista ya calculó (grupos, columnas, ajustes y
 * los `onVer…` que abren las listas). Lo que la persona abre o cierra se recuerda por `key`.
 */
const COLOR = { setting: 'var(--brand-secondary)', workshop: 'var(--info)', otras: 'var(--warning)' };
const CORTAS = { leads: 'leads', agendas: 'agendas', ventas: 'ventas', new_cash: 'New Cash' };
const NOTA_WORKSHOP = 'Los leads de Workshop son clics al grupo de WhatsApp: no traen formulario, así que no se parten por segmento.';

/** Lo que se lee con el desplegable cerrado: las cifras del total del grupo (solo las columnas que se ven). */
const Resumen = ({ grupo, columnas, moneda }) => (
    <span className="sg-meta">
        {columnas.filter((c) => CORTAS[c.key]).map((c) => (
            <span key={c.key}><b className="num">{valorDe(c, grupo.total, moneda)}</b> {CORTAS[c.key]}</span>
        ))}
    </span>
);

const ajustes = (ctx) => ({
    key: 'ajustes', title: 'Qué mostrar',
    meta: (
        <span className="sg-meta">
            <span><b className="num">{ctx.columnas.length}</b> de {COLUMNAS_SEGMENTO.length} columnas</span>
            {ctx.todosLosGrupos.length > 1 && <span><b className="num">{ctx.grupos.length}</b> de {ctx.todosLosGrupos.length} grupos</span>}
        </span>
    ),
    children: () => (
        <div className="sg-ajustes">
            <Columnas columnas={COLUMNAS_SEGMENTO} ocultas={ctx.ocultas} onChange={ctx.onOcultas} />
            <Grupos grupos={ctx.todosLosGrupos} quitados={ctx.quitados} onChange={ctx.onQuitados} />
        </div>
    ),
});

const cruce = (ctx) => (ctx.grupos.length > 1 ? {
    key: 'cruce', title: 'Cruce por segmento', open: true,
    meta: <span className="sg-meta"><span><b>{ctx.campo.label}</b></span></span>,
    children: () => (
        <CruceSegmentos plano grupos={ctx.grupos} campo={ctx.campo} campos={ctx.campos} onCampo={ctx.onCampo} moneda={ctx.moneda}
            onVer={ctx.onVerCruce} orden={ctx.orden} onOrden={ctx.onOrden} onQuitar={ctx.onQuitar} />
    ),
} : null);

// Con más grupos que esto (un corte por closer) cada tabla suma otra fila al desplegable de afuera: se juntan en uno.
const MAX_SUELTAS = 4;

const tablaDe = (ctx) => (g, i) => ({
    key: `tabla:${g.key}`, title: g.label, color: COLOR[g.key] || 'var(--brand-secondary)', open: ctx.grupos.length === 1 || (!cruce(ctx) && i === 0),
    meta: <Resumen grupo={g} columnas={ctx.columnas} moneda={ctx.moneda} />,
    children: () => (
        <TablaSegmentos plano grupo={g} columnas={ctx.columnas} moneda={ctx.moneda} onVer={ctx.onVerTabla(g)}
            nota={ctx.corte === 'fuente' && g.key === 'workshop' ? NOTA_WORKSHOP : null} />
    ),
});

const tablas = (ctx) => {
    const items = ctx.grupos.map(tablaDe(ctx));
    if (items.length <= MAX_SUELTAS) return items;
    return {
        key: 'tablas', title: 'Tabla por grupo', meta: <span className="sg-meta"><span><b className="num">{items.length}</b> grupos</span></span>,
        children: () => <Accordion items={items.map((it) => ({ ...it, open: false }))} />,
    };
};

export const BLOQUES = [ajustes, cruce, tablas];

/** Los items del `Accordion`, en el orden de `BLOQUES`. */
export const itemsDe = (ctx) => BLOQUES.flatMap((b) => b(ctx) || []);

/** Abiertos de la primera vez (los `open` de cada bloque) o los que la persona dejó. */
export const abiertosDe = (items, guardados) => (Array.isArray(guardados) ? guardados : items.filter((i) => i.open).map((i) => i.key));
