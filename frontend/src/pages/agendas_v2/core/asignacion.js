// Asignación: qué horarios ve el lead y a qué closer va cada uno.
// Orden: respuestas → regla → prioridad → estrategia de la prioridad → closer por horario.

import { buscar, closers, esCloser, horasSemana, ord } from './datos';
import { GENERICA, agendaOpt, slotsPersona } from './disponibilidad';
import { calificar, grupoPorReglas } from './formulario';

const DIA = 86400000;
// "Llenar en orden": un closer está lleno cuando no le queda ningún horario libre en esta ventana.
// Mientras tenga lugar en los próximos 7 días, el lead ve solo su agenda.
export const VENTANA_LLENAR_DIAS = 7;

export function miembrosValidos(d, g) {
    return g ? g.miembros.map(id => buscar(d, 'personas', id)).filter(p => p && esCloser(d, p) && horasSemana(p) > 0) : [];
}

function porEstrategia(estrategia, miembros, slotsDe, { ahora, cargaDe }) {
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
        // Por horario: el lead ve todos los horarios; cada uno va al primero de la lista que esté libre.
        miembros.forEach(p => slotsDe(p).forEach(t => { if (!mapa.has(t)) mapa.set(t, p.id); }));
    } else {
        // Repartir parejo: cada horario va a quien tiene menos agendas por delante;
        // a igual cantidad, a quien tiene más lugar libre; después, el orden de la lista.
        const carga = {}, libres = {}, pos = {};
        miembros.forEach((p, i) => { carga[p.id] = cargaDe(p.id); libres[p.id] = slotsDe(p).length; pos[p.id] = i; });
        const mejor = (a, b) => carga[a] - carga[b] || libres[b] - libres[a] || pos[a] - pos[b];
        miembros.forEach(p => slotsDe(p).forEach(t => { const x = mapa.get(t); if (!x || mejor(p.id, x) < 0) mapa.set(t, p.id); }));
    }
    const slots = [...mapa.keys()].sort((a, b) => a - b).map(t => ({ t, p: mapa.get(t) }));
    const nombres = miembros.map(p => p.nombre);
    return { slots, regla: estrategia === 'horario' ? 'Por horario: ' + nombres.join(' → ') : 'Repartir parejo entre ' + miembros.length };
}

/**
 * ctx: {preguntas, resp, dur, ag, reglas, resto, persona}
 * opts: {ahora, ocupado(personaId, t, dur), cargaDe(personaId) → agendas futuras, prueba}
 * Devuelve {nota, grupo, grupoRegla, reglaIdx, desborde, slots:[{t, p}], regla, aviso}.
 */
export function asignacion(ctx, d, opts = {}) {
    const ahora = opts.ahora ?? Date.now();
    const ocupado = opts.ocupado || (() => false);
    const cargaDe = opts.cargaDe || (() => 0);
    const nota = calificar(ctx.preguntas || [], ctx.resp || {});
    const o = agendaOpt(ctx.ag, ctx.dur);
    const memo = new Map();
    const slotsDe = (p) => { if (!memo.has(p.id)) memo.set(p.id, slotsPersona(p, ctx.dur, o, { ahora, ocupado })); return memo.get(p.id); };
    const base = { nota, grupo: null, grupoRegla: '', reglaIdx: null, desborde: false, aviso: '' };

    if (ctx.persona) {
        const pp = buscar(d, 'personas', ctx.persona);
        return { ...base, regla: 'Persona fija', slots: pp ? slotsDe(pp).map(t => ({ t, p: pp.id })) : [] };
    }

    const r = ctx.reglas ? grupoPorReglas({ reglas: ctx.reglas, resto: ctx.resto }, ctx.resp || {}) : { grupo: '', regla: null };
    const g0 = buscar(d, 'grupos', r.grupo) || null;
    const res = { ...base, grupoRegla: g0 ? g0.id : '', reglaIdx: r.regla };

    if (g0) {
        // Desborde: si la prioridad elegida no tiene closers con lugar, pasa a las siguientes en orden.
        const grupos = ord(d, 'grupos');
        const desde = grupos.findIndex(g => g.id === g0.id);
        for (const g of grupos.slice(desde)) {
            const miembros = miembrosValidos(d, g);
            if (!miembros.length) continue;
            const x = porEstrategia(g.estrategia, miembros, slotsDe, { ahora, cargaDe });
            if (x.slots.length) return { ...res, grupo: g, desborde: g.id !== g0.id, slots: x.slots, regla: (g.id !== g0.id ? g0.nombre + ' sin lugar → ' : '') + x.regla };
        }
    }

    const todos = closers(d).filter(p => horasSemana(p) > 0);
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
