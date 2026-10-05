// Horarios libres de una persona según su horario semanal y las reglas de agenda del evento.

import { MS_U, TZ_DEF, aMin } from './catalogos';
import { normalHorario } from './normalizar';
import { claveDia, zonedToUtc } from './tiempo';

export const MAX_DIAS = 120;

const AG_DEF = { reservas: { modo: 'dias', n: 30, tipo: 'corridos', desde: '', hasta: '' }, antel: { n: 4, u: 'h' } };

// Reglas del evento en minutos y milisegundos: hasta cuándo, antelación mínima e intervalo entre inicios.
export function agendaOpt(ag, dur) {
    ag = ag || { ...AG_DEF, paso: { n: dur <= 30 ? 30 : 60, u: 'min' } };
    const r = ag.reservas;
    return {
        paso: Math.max(5, ag.paso.n * (ag.paso.u === 'h' ? 60 : 1)), ant: ag.antel.n * MS_U[ag.antel.u],
        modo: r.modo, n: r.n, tipo: r.tipo, desde: r.desde || '', hasta: r.hasta || '',
    };
}

// Días (claves YYYY-MM-DD en la zona `tz`) en los que el evento ofrece horarios, desde hoy.
// "Días hábiles" cuenta y ofrece solo de lunes a viernes.
export function diasDelHorizonte(o, tz, ahora) {
    const hoy = claveDia(ahora, tz).split('-').map(Number), out = [];
    const tope = o.modo === 'siempre' ? MAX_DIAS : o.modo === 'rango' ? 400 : o.tipo === 'habiles' ? o.n * 2 + 6 : o.n + 1;
    let habiles = 0;
    for (let i = 0; i < Math.min(tope, 400) && out.length < MAX_DIAS; i++) {
        const b = new Date(Date.UTC(hoy[0], hoy[1] - 1, hoy[2] + i)), dow = b.getUTCDay(), clave = b.toISOString().slice(0, 10);
        if (o.modo === 'dias' && o.tipo === 'habiles') {
            if (dow === 0 || dow === 6) continue;
            if (i > 0) habiles++;
            if (habiles > o.n) break;
        }
        if (o.modo === 'rango') { if (o.desde && clave < o.desde) continue; if (o.hasta && clave > o.hasta) break; }
        out.push({ y: b.getUTCFullYear(), m: b.getUTCMonth(), d: b.getUTCDate(), dow, clave });
    }
    return out;
}

// Inicios libres (ms UTC, ordenados) de la persona `p` para un evento de `dur` minutos.
// `ocupado(personaId, inicio, dur)` dice si ya tiene algo en ese rato (reservas, Google Calendar).
export function slotsPersona(p, dur, o, { ahora = Date.now(), ocupado = () => false } = {}) {
    o = o || agendaOpt(null, dur);
    const tz = p.tz || TZ_DEF, minimo = ahora + o.ant, out = [];
    diasDelHorizonte(o, tz, ahora).forEach(dia => {
        (p.horario[dia.dow] || []).forEach(r => {
            for (let m = aMin(r[0]); m + dur <= aMin(r[1]); m += o.paso) {
                const t = zonedToUtc(dia.y, dia.m, dia.d, Math.floor(m / 60), m % 60, tz);
                if (t >= minimo && !ocupado(p.id, t, dur)) out.push(t);
            }
        });
    });
    return out.sort((a, b) => a - b);
}

// Horario genérico, solo para probar un evento cuando todavía no hay closers con horario.
export const GENERICA = {
    id: '', tz: TZ_DEF,
    horario: normalHorario({ 1: [['09:00', '19:00']], 2: [['09:00', '19:00']], 3: [['09:00', '19:00']], 4: [['09:00', '19:00']], 5: [['09:00', '19:00']], 6: [['09:00', '13:00']] }),
};

// ¿Se pisa [t, t+dur) con alguna reserva de la lista? Las reservas traen {inicio, fin} en ms.
export function seSolapa(reservas, t, dur) {
    const fin = t + dur * 60000;
    return reservas.some(r => r.inicio < fin && t < r.fin);
}
