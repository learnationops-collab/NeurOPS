import { describe, expect, it } from 'vitest';
import { aCamposLocales, aInicioUtc, enLaLanding, esProximo, nombreZona, sugerenciaProgramar } from './agendaTaller';

describe('hora del taller en la zona del navegador', () => {
    it('ida y vuelta: lo que se carga es lo que se ve', () => {
        const iso = aInicioUtc('2026-10-19', '16:00');
        expect(iso).toMatch(/Z$/);
        expect(aCamposLocales(iso)).toEqual({ fecha: '2026-10-19', hora: '16:00' });
    });

    it('sin hora no hay instante', () => {
        expect(aInicioUtc('2026-10-19', '')).toBeNull();
        expect(aCamposLocales(null)).toEqual({ fecha: '', hora: '' });
    });

    it('nombra la zona como la dice la gente', () => {
        expect(nombreZona('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
        expect(nombreZona('America/Caracas')).toBe('Caracas');
    });
});

describe('próximos y el de la landing', () => {
    const ahora = new Date('2026-10-15T15:00:00Z');
    const pasado = { id: 1, date: '2026-10-12', inicio_at: '2026-10-12T20:00:00Z' };
    const proximo = { id: 2, date: '2026-10-19', inicio_at: '2026-10-19T20:00:00Z', meet_url: 'm', whatsapp_url: 'w' };
    const sinHoraFuturo = { id: 3, date: '2026-10-30' };
    const sinHoraViejo = { id: 4, date: '2026-10-01' };

    it('separa los que todavía no empezaron', () => {
        expect([pasado, proximo, sinHoraFuturo, sinHoraViejo].filter((e) => esProximo(e, ahora)).map((e) => e.id))
            .toEqual([2, 3]);
    });

    it('la landing muestra el primero que no terminó, también mientras está en vivo', () => {
        expect(enLaLanding([proximo, pasado], ahora).id).toBe(2);
        expect(enLaLanding([proximo, pasado], new Date('2026-10-12T20:10:00Z')).id).toBe(1);
        expect(enLaLanding([sinHoraFuturo], ahora)).toBeNull();
    });

    it('programar propone la semana siguiente al último, con sus links', () => {
        const s = sugerenciaProgramar([pasado, proximo], ahora);
        expect(aInicioUtc(s.fecha, s.hora)).toBe('2026-10-26T20:00:00.000Z');
        expect(s.meet_url).toBe('m');
        expect(s.whatsapp_url).toBe('w');
    });
});
