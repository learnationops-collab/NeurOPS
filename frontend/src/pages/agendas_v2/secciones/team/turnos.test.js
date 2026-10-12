import { describe, expect, it } from 'vitest';
import { normalEvento, normalHorario, normalPersona } from '../../core/normalizar';
import { capacidadSemana, turnosSemana } from './turnos';

describe('capacidadSemana', () => {
    it('cuenta las sesiones encadenadas en cada franja; el último margen puede pasarse', () => {
        const h = normalHorario({ 1: [['09:00', '12:00']], 2: [['09:00', '10:00'], ['14:00', '14:30']] });
        // Lunes: 3 h con bloques de 30 + 20 → 09:00, 09:50, 10:40 y 11:30 (termina 12:00). Martes: 1 + 1.
        expect(capacidadSemana(h, 30, 20)).toEqual({ porDia: [0, 4, 2, 0, 0, 0, 0], total: 6 });
        expect(capacidadSemana(h, 60, 0).total).toBe(4); // 3 el lunes + 1 el martes (la de 30 min no entra)
        expect(capacidadSemana({}, 30, 0).total).toBe(0);
    });
});

describe('turnosSemana', () => {
    const ahora = Date.UTC(2026, 9, 5, 12); // lunes 08:00 en La Paz
    const H = (h, m = 0) => Date.UTC(2026, 9, 5, h + 4, m);
    const ana = normalPersona('a', { nombre: 'Ana', tz: 'America/La_Paz', horario: normalHorario({ 1: [['09:00', '12:00']], 2: [['09:00', '12:00']] }) });
    const ev = normalEvento('ev', { duracion: 45 });

    it('total con su horario y libres descontando reservas, margen y Google', () => {
        const reservasDe = () => [{ inicio_ms: H(9), fin_ms: H(9, 45), margen_min: 15 }];
        // Una reunión de 11:00 a 11:30 el lunes.
        const googleDe = () => ({ estado: 'ok', franjas: [[H(11), H(11, 30)]] });
        const t = turnosSemana({ personas: [ana], evento: ev, ahora, reservasDe, googleDe });
        const f = t.filas[0];
        expect(f.total.slice(0, 2)).toEqual([4, 4]);
        // Lunes: la reserva ocupa hasta 10:00; queda 10:00 (hasta 10:45) y, después de la reunión, 11:30
        // no entra (terminaría 12:15). Martes, entero.
        expect(f.libres.slice(0, 2)).toEqual([1, 4]);
        expect([t.nLibres, t.nTotal]).toEqual([5, 8]);
    });
    it('cada closer usa su sesión en ese evento', () => {
        const beto = normalPersona('b', { ...ana, id: 'b', sesiones: { ev: { duracion: 30, margen: 30 } } });
        const t = turnosSemana({ personas: [ana, beto], evento: ev, ahora });
        expect(t.filas.map(f => [f.dur, f.margen, f.nTotal])).toEqual([[45, 0, 8], [30, 30, 6]]);
    });
    it('lo que ya pasó no queda libre y un calendario sin leer se marca', () => {
        const t = turnosSemana({ personas: [ana], evento: ev, ahora: Date.UTC(2026, 9, 6, 20), googleDe: () => ({ estado: 'error', franjas: [] }) });
        expect(t.filas[0].libres.slice(0, 2)).toEqual([0, 0]);
        expect(t.filas[0].estado).toBe('error');
    });
});
