import { STAGE_ORDER, projectSales } from '../funnelMath';
import { enLaLanding, esProximo } from '../agendaTaller';

/*
 * Planificar (16/10/2026): los próximos talleres, el simulador y las acciones en una sola vista.
 * Kerwin: «simular qué puedo cambiar de los workshops y luego generar acciones que debo cumplir en
 * los siguientes workshops, agregar esa acción a un siguiente workshop». Cada acción lleva su taller
 * destino (`event_id`, opcional: las de antes no tienen).
 */

const orden = (e) => e.inicio_at || `${e.date}T23:59`;

/**
 * Los talleres que se planifican: el que está en la landing (aunque ya haya empezado: es el de esta
 * semana) y los que todavía no empezaron, en orden.
 */
export const talleresPorDelante = (eventos, ahora = new Date()) => {
    const vigente = enLaLanding(eventos, ahora);
    const lista = eventos.filter((e) => esProximo(e, ahora) || (vigente && e.id === vigente.id));
    return lista.sort((a, b) => orden(a).localeCompare(orden(b)));
};

/** El taller al que va una acción nueva si no se elige otro: el primero que todavía no empezó. */
export const siguienteTaller = (eventos, ahora = new Date()) => (
    talleresPorDelante(eventos, ahora).find((e) => esProximo(e, ahora)) || null
);

/** Pendientes primero; dentro de cada grupo, la de más puntaje. */
export const ordenarAcciones = (a, b) => {
    if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
    return (b.score || 0) - (a.score || 0);
};

/**
 * Reparte las acciones: las de cada próximo taller, las que no tienen taller y las de un taller
 * que ya pasó (o se borró del panel). Ninguna se pierde de vista.
 */
export const agruparAcciones = (acciones, talleres) => {
    const ids = new Set(talleres.map((t) => t.id));
    const porTaller = Object.fromEntries(talleres.map((t) => [t.id, []]));
    const sinTaller = [];
    const pasadas = [];
    (acciones || []).forEach((a) => {
        if (a.event_id == null) sinTaller.push(a);
        else if (ids.has(a.event_id)) porTaller[a.event_id].push(a);
        else pasadas.push(a);
    });
    Object.values(porTaller).forEach((l) => l.sort(ordenarAcciones));
    sinTaller.sort(ordenarAcciones);
    pasadas.sort(ordenarAcciones);
    return { porTaller, sinTaller, pasadas };
};

/**
 * Cuánto suma en ventas y cash una acción: su `target_delta_pp` aplicado SOLO a su etapa, con las
 * demás en la tasa real (el mismo modelo lineal del simulador).
 */
export const estimarImpacto = (accion, totals, rates, ticket) => {
    if (!accion.stage_key) return { ventas: 0, cash: 0 };
    const leads = totals.leads || 0;
    const antes = projectSales(leads, rates);
    const conMejora = {
        ...rates,
        [accion.stage_key]: Math.min(0.95, (rates[accion.stage_key] || 0) + (accion.target_delta_pp || 0) / 100),
    };
    const ventas = Math.max(0, projectSales(leads, conMejora) - antes);
    return { ventas, cash: ventas * ticket };
};

const pct1 = (v) => Math.round(v * 10) / 10;

/**
 * El borrador de acción que sale de mover una palanca del simulador: la etapa, cuántos puntos la
 * subió y un título que lo dice. `null` si la palanca no subió (bajar una tasa no es una acción).
 */
export const borradorDesdePalanca = (etapa, tasaBase, tasaNueva, eventId = null) => {
    const desde = pct1(tasaBase * 100);
    const hasta = pct1(tasaNueva * 100);
    const delta = pct1(hasta - desde);
    if (delta <= 0) return null;
    const stage = STAGE_ORDER.find((s) => s.key === etapa);
    return {
        stage_key: etapa,
        title: `Subir ${stage ? stage.label.toLowerCase() : etapa} de ${desde}% a ${hasta}%`,
        target_delta_pp: delta,
        event_id: eventId,
        origen: { desde, hasta },
    };
};

/** Lo que se le manda a la API: sin lo que es solo de la vista. */
export const cuerpoAccion = (borrador) => {
    const { origen, id, score, created_by, created_at, completed_at, ...resto } = borrador; // eslint-disable-line no-unused-vars
    return {
        ...resto,
        title: (resto.title || '').trim(),
        stage_key: resto.stage_key || null,
        note: resto.note?.trim() || null,
        event_id: resto.event_id || null,
        target_delta_pp: parseFloat(resto.target_delta_pp) || 0,
    };
};
