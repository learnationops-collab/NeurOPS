import { describe, expect, it } from 'vitest';
import { BASES, baseDe, tieneAnuncios, tonoDe, variacion, variacionTexto } from './comparacion';

const taller = (totales) => ({ anuncios_workshop: 3, campanas: [{}], totales });

describe('variacion', () => {
    it('da el cambio porcentual y su dirección', () => {
        expect(variacion(120, 100)).toEqual({ pct: 20, dir: 1 });
        expect(variacion(75, 100)).toEqual({ pct: -25, dir: -1 });
        expect(variacion(100, 100).dir).toBe(0);
    });

    it('sin base o sin dato no hay cambio (nunca un salto desde cero)', () => {
        expect(variacion(10, 0)).toBeNull();
        expect(variacion(null, 5)).toBeNull();
        expect(variacion(5, null)).toBeNull();
    });
});

describe('tonoDe', () => {
    it('en un costo bajar es bueno y subir es malo', () => {
        expect(tonoDe('cpm', -1)).toBe('success');
        expect(tonoDe('cpc', 1)).toBe('error');
    });

    it('en alcance y respuesta subir es bueno', () => {
        expect(tonoDe('ctr', 1)).toBe('success');
        expect(tonoDe('clics_whatsapp', -1)).toBe('error');
    });

    it('el gasto y lo que no cambió no se juzgan', () => {
        expect(tonoDe('gasto', 1)).toBe('muted');
        expect(tonoDe('ctr', 0)).toBe('muted');
    });
});

describe('variacionTexto', () => {
    it('lleva signo, coma decimal y sin decimales desde 100%', () => {
        expect(variacionTexto(12.34)).toBe('+12,3%');
        expect(variacionTexto(-4)).toBe('−4,0%');
        expect(variacionTexto(250.4)).toBe('+250%');
        expect(variacionTexto(0.01)).toBe('0%');
    });
});

describe('baseDe', () => {
    const a = taller({ gasto: 100, cpm: 10, ctr: 2, cpc: null });
    const b = taller({ gasto: 300, cpm: 20, ctr: 4, cpc: 1 });
    const c = taller({ gasto: 500, cpm: 30, ctr: 6, cpc: 3 });

    it('con n = 1 es el taller anterior tal cual', () => {
        expect(baseDe([a, b, c], 1).totales.gasto).toBe(100);
    });

    it('con n > 1 promedia los n más cercanos', () => {
        const base = baseDe([a, b, c], 2);
        expect(base.cuantos).toBe(2);
        expect(base.totales.gasto).toBe(200);
        expect(base.totales.cpm).toBe(15);
    });

    it('un número que un taller no tiene no entra en su promedio', () => {
        expect(baseDe([a, b], 2).totales.cpc).toBe(1);
    });

    it('un taller sin anuncios que gastaron no sirve de base', () => {
        const vacio = { anuncios_workshop: 3, campanas: [], totales: { gasto: 0 } };
        expect(tieneAnuncios(vacio)).toBe(false);
        expect(baseDe([vacio], 1)).toBeNull();
        expect(baseDe([vacio, b], 2).cuantos).toBe(1);
    });

    it('sin anteriores no hay base', () => {
        expect(baseDe([], 3)).toBeNull();
    });
});

describe('BASES', () => {
    it('ofrece sin comparar, el anterior y el promedio de 2 y 3', () => {
        expect(BASES.map((b) => b.n)).toEqual([0, 1, 2, 3]);
    });
});
