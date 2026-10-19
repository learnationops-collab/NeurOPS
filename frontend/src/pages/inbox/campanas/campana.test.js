import { describe, expect, it } from 'vitest';
import { cuerpo, diaLocal, errorDe, estadoDe, formulario, sumarPalabra } from './campana';

const local = (a, m, d) => new Date(a, m - 1, d).toISOString();

describe('campana', () => {
    it('el estado sale de la vigencia [desde, hasta)', () => {
        const ahora = new Date(2026, 9, 19, 12);
        expect(estadoDe({ desde: local(2026, 10, 1), hasta: null }, ahora)).toBe('vigente');
        expect(estadoDe({ desde: local(2026, 10, 20), hasta: null }, ahora)).toBe('proxima');
        expect(estadoDe({ desde: local(2026, 10, 1), hasta: local(2026, 10, 19) }, ahora)).toBe('terminada');
    });

    it('el último día del formulario se manda como el día siguiente (fin exclusivo) y vuelve igual', () => {
        const f = { ...formulario(null), nombre: ' Guía MIR ', desde: '2026-10-01', hasta: '2026-10-31', palabras: ['GUIA'], flujo_id: '3' };
        const c = cuerpo(f);
        expect(c).toMatchObject({ nombre: 'Guía MIR', flujo_id: 3, desde: local(2026, 10, 1), hasta: local(2026, 11, 1) });
        expect(diaLocal(c.hasta, true)).toBe('2026-10-31');
        expect(formulario({ ...c, palabras: ['GUIA'] }).hasta).toBe('2026-10-31');
    });

    it('sin último día la campaña no termina y sin flujo manda null', () => {
        expect(cuerpo({ ...formulario(null), nombre: 'x', palabras: ['A'] })).toMatchObject({ hasta: null, flujo_id: null });
    });

    it('valida antes de mandar', () => {
        const base = { ...formulario(null), nombre: 'x', desde: '2026-10-05', palabras: ['A'] };
        expect(errorDe(base)).toBeNull();
        expect(errorDe({ ...base, nombre: ' ' })).toMatch(/nombre/);
        expect(errorDe({ ...base, palabras: [] })).toMatch(/palabra/);
        expect(errorDe({ ...base, hasta: '2026-10-01' })).toMatch(/anterior/);
    });

    it('no suma una palabra repetida aunque cambien tildes o mayúsculas', () => {
        expect(sumarPalabra(['Guía MIR'], '  guia   mir ')).toEqual(['Guía MIR']);
        expect(sumarPalabra(['GUIA'], 'PDF')).toEqual(['GUIA', 'PDF']);
        expect(sumarPalabra([], '¿?')).toEqual([]);
    });
});
