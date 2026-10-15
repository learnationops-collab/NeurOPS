import { describe, expect, it } from 'vitest';
import { aCamposLocales, aInicioUtc, nombreZona } from './agendaTaller';

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
