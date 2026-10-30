// Asignación: qué horarios ve el lead y a qué closer va cada uno.
// Orden: respuestas → regla → prioridad → estrategia de la prioridad → closer por horario.

import { TZ_DEF } from './catalogos';
import { buscar, closers, esCloser, esTriage, horasSemana, ord, sesionDe } from './datos';
import { GENERICA, agendaOpt, slotsPersona } from './disponibilidad';
import { calificar, grupoPorReglas } from './formulario';
import { claveDia } from './tiempo';

const DIA = 86400000;
// "Llenar en orden": un closer está lleno cuando no le queda ningún horario libre en esta ventana.
// Mientras tenga lugar en los próximos 7 días, el lead ve solo su agenda.
export const VENTANA_LLENAR_DIAS = 7;

export function miembrosValidos(d, g) {
    // El triage atiende las llamadas del grupo donde lo ponen (esTriage), aunque su rol no sea de closer.
    return g ? g.miembros.map(id => buscar(d, 'personas', id)).filter(p => p && (esCloser(d, p) || esTriage(d, p)) && horasSemana(p) > 0) : [];
}

// El porcentaje de un closer en una estrategia Distribuida; sin cargar, parte pareja.
export function pesoDe(g, pid, n) {
    const pesos = (g && g.pesos) || {};
    return pid in pesos ? pesos[pid] : 100 / n;
}

function porEstrategia(estrategia, miembros, slotsDe, { ahora, cargaDe }, g = null) {
    if (estrategia === 'llenar') {
        const limite = ahora + VENTANA_LLENAR_DIAS * DIA;
        let elegido = null, idx = -1;
        for (let i = 0; i < miembros.length; i++) {
            const s = slotsDe(miembros[i]);
            if (s.some(t => t < limite)) { elegido = miembros[i]; idx = i; break; }
            if (!elegido && s.length) { elegido = miembros[i]; idx = i; }
        }
        if (!elegido) return { slots: [], regla: '' };
        return {
            slots: slotsDe(elegido).map(t => ({ t, p: elegido.id })),
            regla: elegido.nombre + (idx ? ' (los anteriores están llenos)' : ' hasta llenarse'),
        };
    }
    const mapa = new Map();
    if (estrategia === 'horario') {
        // Máxima disponibilidad: el lead ve todos los horarios del grupo; cada uno va al primero de la
        // lista que esté libre.
        miembros.forEach(p => slotsDe(p).forEach(t => { if (!mapa.has(t)) mapa.set(t, p.id); }));
    } else {
        // Distribuida: cada horario va a quien está más lejos de su porcentaje (agendas por delante
        // / porcentaje); con 0% solo recibe si nadie más está libre. A igual, a quien tiene más lugar
        // libre; después, el orden de la lista. Sin porcentajes es parejo.
        const carga = {}, libres = {}, pos = {}, w = {};
        miembros.forEach((p, i) => { carga[p.id] = cargaDe(p.id); libres[p.id] = slotsDe(p).length; pos[p.id] = i; w[p.id] = pesoDe(g, p.id, miembros.length); });
        const mejor = (a, b) => {
            const za = w[a] <= 0, zb = w[b] <= 0;
            if (za !== zb) return za ? 1 : -1;
            return (za ? carga[a] - carga[b] : carga[a] * w[b] - carga[b] * w[a]) || libres[b] - libres[a] || pos[a] - pos[b];
        };
        miembros.forEach(p => slotsDe(p).forEach(t => { const x = mapa.get(t); if (!x || mejor(p.id, x) < 0) mapa.set(t, p.id); }));
    }
    const slots = [...mapa.keys()].sort((a, b) => a - b).map(t => ({ t, p: mapa.get(t) }));
    const nombres = miembros.map(p => p.nombre);
    return { slots, regla: estrategia === 'horario' ? 'Máxima disponibilidad: ' + nombres.join(' → ') : 'Distribuida entre ' + miembros.length };
}

// Si en los días del evento no queda ningún horario, se suma un día por vez hasta encontrar uno: el lead
// nunca se queda sin agendar porque la ventana se llenó. Tope de días agregados.
export const DIAS_EXTRA_MAX = 14;
// Un día con menos horarios que esto está virtualmente lleno: no cuenta como día de la ventana (Santi, 29/10/2026).
export const MIN_HORARIOS_DIA = 3;

// Cuántos días (en la zona del equipo) tienen MIN_HORARIOS_DIA horarios o más.
export function diasConLugar(slots) {
    const porDia = new Map();
    for (const s of slots) { const k = claveDia(s.t, TZ_DEF); porDia.set(k, (porDia.get(k) || 0) + 1); }
    return [...porDia.values()].filter(n => n >= MIN_HORARIOS_DIA).length;
}

// Como asignar(), con la ventana «N días» contada en días con lugar (diasConLugar): si el grupo del lead tiene
// menos de N, se abre un día más (y otro, hasta DIAS_EXTRA_MAX). Se abren días antes de pasar a otro grupo:
// recién si el grupo no tiene ningún horario en todos esos días, desborda como siempre (y si tampoco hay
// nadie, sigue abriendo días). `diasExtra` dice cuántos se abrieron.
export function asignacion(ctx, d, opts = {}) {
    const ag = ctx.ag;
    if (!ag || !ag.reservas || ag.reservas.modo !== 'dias') return asignar(ctx, d, opts);
    const n = ag.reservas.n || 0;
    const con = (extra, mas = {}) => {
        const r = asignar(extra ? { ...ctx, ag: { ...ag, reservas: { ...ag.reservas, n: n + extra } } } : ctx, d, { ...opts, ...mas });
        return extra ? { ...r, diasExtra: extra } : r;
    };
    let propio = null;
    for (let extra = 0; extra <= DIAS_EXTRA_MAX; extra++) {
        const r = con(extra, { sinDesborde: true });
        if (r.url || r.no) return r;
        if (r.slots.length) {
            propio = r;
            if (diasConLugar(r.slots) >= Math.max(n, 1)) break;
        }
    }
    if (propio) return propio;
    let primero = null;
    for (let extra = 0; extra <= DIAS_EXTRA_MAX; extra++) {
        const r = con(extra);
        if (r.slots.length) return r;
        primero = primero || r;
    }
    return primero;
}

/**
 * ctx: {preguntas, resp, dur, margen, eventoId, ag, reglas, resto, segmento, persona}. dur y margen son la propuesta
 * del evento; cada closer usa lo suyo si lo ajustó (sesionDe).
 * opts: {ahora, ocupado(personaId, t, dur), cargaDe(personaId) → agendas futuras,
 *        enSemana(personaId, t, tz) → agendas en la semana de t, prueba, sinDesborde (solo su grupo)}
 * Devuelve {nota, grupo, grupoRegla, reglaIdx, desborde, slots:[{t, p}], regla, aviso}.
 */
function asignar(ctx, d, opts = {}) {
    const ahora = opts.ahora ?? Date.now();
    const ocupado = opts.ocupado || (() => false);
    const cargaDe = opts.cargaDe || (() => 0);
    const enSemana = opts.enSemana || (() => 0);
    const nota = calificar(ctx.preguntas || [], ctx.resp || {});
    const o = agendaOpt(ctx.ag, ctx.dur);
    const memo = new Map();
    const slotsDe = (p) => {
        if (!memo.has(p.id)) {
            const [dur, margen] = sesionDe(p, ctx.eventoId, ctx.dur, ctx.margen);
            const slots = slotsPersona(p, dur, o, { ahora, ocupado, margen });
            // Con tope de llamadas por semana, una semana llena no ofrece horarios (Jean Carlo, 27/10/2026).
            const tope = p.llamadas_semana || 0, tz = p.tz || TZ_DEF;
            memo.set(p.id, tope ? slots.filter(t => enSemana(p.id, t, tz) < tope) : slots);
        }
        return memo.get(p.id);
    };
    const base = { nota, grupo: null, grupoRegla: '', reglaIdx: null, desborde: false, aviso: '' };

    if (ctx.persona) {
        const pp = buscar(d, 'personas', ctx.persona);
        return { ...base, regla: 'Persona fija', slots: pp ? slotsDe(pp).map(t => ({ t, p: pp.id })) : [] };
    }

    const r = ctx.reglas ? grupoPorReglas({ reglas: ctx.reglas, resto: ctx.resto, preguntas: ctx.preguntas || [], segmento: ctx.segmento }, ctx.resp || {}) : { grupo: '', regla: null };
    // La regla manda a otra página: no hay horarios que ofrecer.
    if (r.url) return { ...base, reglaIdx: r.regla, url: r.url, slots: [], regla: 'Redirige a ' + r.url };
    // La segmentación lo marca como que no califica: no agenda.
    if (r.no) return { ...base, reglaIdx: r.regla, no: true, slots: [], regla: 'No califica' };
    const g0 = buscar(d, 'grupos', r.grupo) || null;
    const res = { ...base, grupoRegla: g0 ? g0.id : '', reglaIdx: r.regla };

    if (g0) {
        // Desborde: si la prioridad elegida no tiene closers con lugar, pasa a las siguientes en orden.
        const grupos = ord(d, 'grupos');
        const desde = grupos.findIndex(g => g.id === g0.id);
        for (const g of opts.sinDesborde ? grupos.slice(desde, desde + 1) : grupos.slice(desde)) {
            const miembros = miembrosValidos(d, g);
            if (!miembros.length) continue;
            const x = porEstrategia(g.estrategia, miembros, slotsDe, { ahora, cargaDe }, g);
            if (x.slots.length) return { ...res, grupo: g, desborde: g.id !== g0.id, slots: x.slots, regla: (g.id !== g0.id ? g0.nombre + ' sin lugar → ' : '') + x.regla };
        }
        if (opts.sinDesborde) return { ...res, slots: [], regla: 'Sin horarios' };
    }

    const todos = closers(d).filter(p => horasSemana(p) > 0 && !esTriage(d, p));
    if (todos.length) {
        const x = porEstrategia('repartir', todos, slotsDe, { ahora, cargaDe });
        if (x.slots.length) return { ...res, desborde: !!g0, slots: x.slots, regla: (g0 ? g0.nombre + ' sin lugar → ' : '') + 'Todos los closers' };
    }

    if (opts.prueba) {
        return {
            ...res, slots: slotsPersona(GENERICA, ctx.dur, o, { ahora }).map(t => ({ t, p: null })),
            regla: 'Horarios de prueba', aviso: 'Horarios de prueba: cargá horarios en Team.',
        };
    }
    return { ...res, slots: [], regla: 'Sin horarios' };
}
