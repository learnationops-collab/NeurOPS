import { describe, expect, it } from 'vitest';
import {
    colorCelda, formatoR, formatoValor, frasePar, intensidadDe, puntosDelPar, rankingContra, recta,
} from './correlaciones';

describe('formato', () => {
    it('muestra signo y usa guion si no hay cálculo', () => {
        expect(formatoR(0.624)).toBe('+0.62');
        expect(formatoR(-0.35)).toBe('−0.35');
        expect(formatoR(null)).toBe('–');
    });

    it('formatea según el tipo de métrica', () => {
        expect(formatoValor(35.04, 'pct')).toBe('35%');
        expect(formatoValor(1500, 'usd')).toBe('$1,500');
        expect(formatoValor(null, 'usd')).toBe('–');
    });

    it('clasifica la intensidad', () => {
        expect([0.9, -0.5, 0.25, 0.05, null].map(intensidadDe)).toEqual(['fuerte', 'moderada', 'débil', 'nula', null]);
    });

    it('pinta verde lo positivo, rojo lo negativo y nada si no hay cálculo', () => {
        expect(colorCelda(0.5)).toContain('--success');
        expect(colorCelda(-0.5)).toContain('--error');
        expect(colorCelda(null)).toBe('transparent');
    });
});

describe('ranking', () => {
    const matriz = {
        cash: {
            cash: { pearson: 1 },
            a: { pearson: 0.2 },
            b: { pearson: -0.9 },
            c: { pearson: null },
            d: { pearson: 0.5 },
        },
    };

    it('ordena por fuerza sin importar el signo y deja al final las sin cálculo', () => {
        expect(rankingContra(matriz, 'cash', 'pearson').map((f) => f.key)).toEqual(['b', 'd', 'a', 'c']);
    });

    it('sin la métrica en la matriz devuelve vacío', () => {
        expect(rankingContra(matriz, 'nada', 'pearson')).toEqual([]);
        expect(rankingContra(null, 'cash', 'pearson')).toEqual([]);
    });
});

describe('dispersión', () => {
    const talleres = [
        { id: 1, name: 'A', date: '2026-08-01', valores: { x: 1, y: 2 } },
        { id: 2, name: 'B', date: '2026-08-08', valores: { x: 2, y: null } },
        { id: 3, name: 'C', date: '2026-08-15', valores: { x: 3, y: 6 } },
    ];

    it('ignora los talleres que no tienen alguno de los dos datos', () => {
        expect(puntosDelPar(talleres, 'x', 'y').map((p) => p.id)).toEqual([1, 3]);
    });

    it('calcula la recta y devuelve null con datos que no la permiten', () => {
        const r = recta([{ x: 1, y: 2 }, { x: 3, y: 6 }]);
        expect(r.pendiente).toBeCloseTo(2);
        expect(r.ordenada).toBeCloseTo(0);
        expect(recta([{ x: 1, y: 2 }])).toBeNull();
        expect(recta([{ x: 1, y: 2 }, { x: 1, y: 5 }])).toBeNull();
    });
});

describe('frasePar', () => {
    it('no afirma causalidad y avisa cuando no se puede calcular', () => {
        expect(frasePar('A', 'B', { n: 9, pearson: 0.8 }, 'pearson')).toMatch(/No prueba que uno cause/);
        expect(frasePar('A', 'B', { n: 2, pearson: null }, 'pearson')).toMatch(/2 talleres/);
        expect(frasePar('A', 'B', { n: 5, pearson: null, constante: true }, 'pearson')).toMatch(/no cambia/);
        expect(frasePar('A', 'B', { n: 5, pearson: 0.05 }, 'pearson')).toMatch(/casi no se mueven/);
    });
});
