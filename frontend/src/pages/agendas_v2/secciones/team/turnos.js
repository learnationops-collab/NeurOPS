// Turnos: cuántas sesiones le entran a cada closer y cuántas le quedan libres, encadenadas una tras otra
// como las ofrece el sistema (core/disponibilidad.js, iniciosEnDias). Sin React, para poder probarlo.

import { aMin } from '../../core/catalogos';
import { buscar, ord, sesionDe } from '../../core/datos';
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
 * Cada fila trae también `inicios`: los horarios libres de la semana (para dibujarlos).
 * tz: en qué zona se cuentan los días (la de quien mira); sin ella, la que más se repite.
 */
export function turnosSemana({ personas, evento, semana = 0, ahora = Date.now(), reservasDe = () => [], googleDe = () => null, tz: zona = null }) {
    const { tz, lunes } = rangoSemana(personas, semana, ahora, zona);
    const claves = [0, 1, 2, 3, 4, 5, 6].map(i => new Date(lunes + i * DIA_MS).toISOString().slice(0, 10));
    // Un día de margen a cada lado: el horario de alguien en otra zona puede caer en el día vecino.
    const dias = [];
    for (let j = -1; j < 8; j++) {
        const b = new Date(lunes + j * DIA_MS);
        dias.push({ y: b.getUTCFullYear(), m: b.getUTCMonth(), d: b.getUTCDate(), dow: b.getUTCDay() });
    }
    const enSemana = (ts) => ts.filter(t => claves.includes(claveDia(t, tz)));
    const porDia = (ts) => claves.map(k => ts.filter(t => claveDia(t, tz) === k).length);
    const filas = personas.map(p => {
        const [dur, margen] = sesionDe(p, evento.id, evento.duracion, evento.margen);
        const g = googleDe(p.id);
        const ocupado = reservasDe(p.id)
            .map(r => ({ inicio: r.inicio_ms, fin: (r.fin_ms != null ? r.fin_ms : r.inicio_ms + 3600000) + (r.margen_min || 0) * 60000 }))
            .concat(g && g.estado === 'ok' ? (g.franjas || []).map(f => ({ inicio: f[0], fin: f[1] })) : []);
        const tTotal = enSemana(iniciosEnDias(p, dur, dias, { margen }));
        const tLibres = enSemana(iniciosEnDias(p, dur, dias, { margen, minimo: ahora, ocupado: (pid, t, largo) => seSolapa(ocupado, t, largo) }));
        return {
            p, dur, margen, estado: g ? g.estado : null, inicios: tLibres,
            total: porDia(tTotal), libres: porDia(tLibres), nTotal: tTotal.length, nLibres: tLibres.length,
        };
    });
    return { tz, claves, filas, nTotal: suma(filas.map(f => f.nTotal)), nLibres: suma(filas.map(f => f.nLibres)) };
}

const sesionTxt = (dur, margen) => dur + ' min' + (margen ? ' + ' + margen : '');

/**
 * Los eventos compartidos agrupados por cómo quedan las sesiones del equipo: dos eventos donde cada
 * closer tiene la misma duración y el mismo margen dan los mismos turnos, así que van juntos.
 * [{id, evento (el que representa al grupo), eventos, nombre (cada evento con su funnel), detalle}].
 */
export function gruposDeSesion(d, personas) {
    const evs = ord(d, 'eventos').filter(e => !e.persona).sort((a, b) => (b.activo ? 1 : 0) - (a.activo ? 1 : 0));
    const grupos = [];
    evs.forEach(e => {
        const sesiones = personas.map(p => sesionDe(p, e.id, e.duracion, e.margen));
        const firma = sesiones.length ? sesiones.map(x => x.join('+')).join('|') : e.duracion + '+' + (e.margen || 0);
        let g = grupos.find(x => x.firma === firma);
        if (!g) grupos.push(g = { firma, eventos: [], sesiones: sesiones.length ? sesiones : [[e.duracion, e.margen || 0]] });
        g.eventos.push(e);
    });
    return grupos.map(g => {
        const nombre = g.eventos.map(e => {
            const f = buscar(d, 'funnels', e.funnel);
            return e.nombre + (f ? ' · ' + f.nombre : '') + (e.activo ? '' : ' (pausado)');
        }).join(' / ');
        const distintas = [...new Set(g.sesiones.map(([dur, margen]) => sesionTxt(dur, margen)))];
        return { id: g.eventos[0].id, evento: g.eventos[0], eventos: g.eventos, nombre, detalle: distintas.length === 1 ? distintas[0] : 'según el closer' };
    });
}
