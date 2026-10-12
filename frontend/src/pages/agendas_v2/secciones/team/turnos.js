// Turnos: cuántas sesiones le entran a cada closer y cuántas le quedan libres, encadenadas una tras otra
// como las ofrece el sistema (core/disponibilidad.js, iniciosEnDias). Sin React, para poder probarlo.

import { aMin } from '../../core/catalogos';
import { sesionDe } from '../../core/datos';
import { iniciosEnDias, seSolapa } from '../../core/disponibilidad';
import { claveDia } from '../../core/tiempo';
import { rangoSemana } from './cobertura';

const DIA_MS = 86400000;
const suma = (xs) => xs.reduce((a, b) => a + b, 0);

/**
 * Cuántas sesiones de `dur` minutos con `margen` después entran en un horario semanal sin nada ocupado.
 * En cada franja: la primera si entra la sesión, y una más por cada sesión + margen (el último margen
 * puede pasarse del horario). {porDia: [7, por día de la semana, 0 = domingo], total}.
 */
export function capacidadSemana(horario, dur, margen = 0) {
    const porDia = [0, 1, 2, 3, 4, 5, 6].map(dow => ((horario || {})[dow] || []).reduce((n, r) => {
        const largo = aMin(r[1]) - aMin(r[0]);
        return n + (largo >= dur ? Math.floor((largo - dur) / (dur + margen)) + 1 : 0);
    }, 0));
    return { porDia, total: suma(porDia) };
}

/**
 * Los turnos de una semana para un evento. Cada persona usa su sesión en ese evento (sesionDe).
 * total: los que le entran con su horario; libres: los que le quedan desde ahora, descontando sus
 * reservas (con su margen) y lo ocupado en su Google Calendar. Por día en la zona del equipo.
 * o: {personas, evento, semana, ahora, reservasDe(id) → [{inicio_ms, fin_ms, margen_min}],
 *     googleDe(id) → {estado, franjas} | null}
 */
export function turnosSemana({ personas, evento, semana = 0, ahora = Date.now(), reservasDe = () => [], googleDe = () => null }) {
    const { tz, lunes } = rangoSemana(personas, semana, ahora);
    const claves = [0, 1, 2, 3, 4, 5, 6].map(i => new Date(lunes + i * DIA_MS).toISOString().slice(0, 10));
    // Un día de margen a cada lado: el horario de alguien en otra zona puede caer en el día vecino.
    const dias = [];
    for (let j = -1; j < 8; j++) {
        const b = new Date(lunes + j * DIA_MS);
        dias.push({ y: b.getUTCFullYear(), m: b.getUTCMonth(), d: b.getUTCDate(), dow: b.getUTCDay() });
    }
    const porDia = (ts) => {
        const out = claves.map(() => 0);
        ts.forEach(t => { const i = claves.indexOf(claveDia(t, tz)); if (i >= 0) out[i]++; });
        return out;
    };
    const filas = personas.map(p => {
        const [dur, margen] = sesionDe(p, evento.id, evento.duracion, evento.margen);
        const g = googleDe(p.id);
        const ocupado = reservasDe(p.id)
            .map(r => ({ inicio: r.inicio_ms, fin: (r.fin_ms != null ? r.fin_ms : r.inicio_ms + 3600000) + (r.margen_min || 0) * 60000 }))
            .concat(g && g.estado === 'ok' ? (g.franjas || []).map(f => ({ inicio: f[0], fin: f[1] })) : []);
        const total = porDia(iniciosEnDias(p, dur, dias, { margen }));
        const libres = porDia(iniciosEnDias(p, dur, dias, { margen, minimo: ahora, ocupado: (pid, t, largo) => seSolapa(ocupado, t, largo) }));
        return { p, dur, margen, estado: g ? g.estado : null, total, libres, nTotal: suma(total), nLibres: suma(libres) };
    });
    return { tz, claves, filas, nTotal: suma(filas.map(f => f.nTotal)), nLibres: suma(filas.map(f => f.nLibres)) };
}
