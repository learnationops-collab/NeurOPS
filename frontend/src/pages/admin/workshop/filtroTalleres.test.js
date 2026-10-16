import { describe, it, expect } from 'vitest';
import {
    comparacionDeParams, comparacionPorDefecto, filtrarTalleres, filtroDeParams, paramsDeComparacion, paramsDeFiltro,
    rangoComparado, rangoDeSeleccion, talleresAnteriores, talleresComparados, totalesResumen, variaciones,
} from './filtroTalleres';

// Llegan desordenados a propósito: el filtro no depende del orden de la API.
const TALLERES = [
    { id: 3, date: '2026-09-26', inversion: 300, cash_collected: 1200, leads: 300, agendas_exitosas: 20, sales: 2 },
    { id: 5, date: '2026-10-12', inversion: 200, cash_collected: 600, leads: 140, agendas_exitosas: 24, sales: 2 },
    { id: 1, date: '2026-09-12', inversion: 100, cash_collected: 0, leads: 100, agendas_exitosas: 5, sales: 0 },
    { id: 4, date: '2026-10-03', inversion: 250, cash_collected: 120, leads: 200, agendas_exitosas: 10, sales: 1 },
    { id: 2, date: '2026-09-19', inversion: 150, cash_collected: 450, leads: 120, agendas_exitosas: 8, sales: 1 },
];
const ids = (lista) => lista?.map((t) => t.id) ?? null;

describe('Workshop › filtro del Resumen', () => {
    it('todos, del más nuevo al más viejo', () => {
        expect(ids(filtrarTalleres(TALLERES, { modo: 'todos' }))).toEqual([5, 4, 3, 2, 1]);
        expect(talleresAnteriores(TALLERES, { modo: 'todos' })).toBeNull();
    });

    it('los últimos N se comparan con los N de antes', () => {
        expect(ids(filtrarTalleres(TALLERES, { modo: 'ultimos', n: 2 }))).toEqual([5, 4]);
        expect(ids(talleresAnteriores(TALLERES, { modo: 'ultimos', n: 2 }))).toEqual([3, 2]);
        // Si no hay nada antes, no se compara.
        expect(talleresAnteriores(TALLERES, { modo: 'ultimos', n: 5 })).toBeNull();
    });

    it('un período incluye sus dos puntas y se compara con el de igual largo justo antes', () => {
        const filtro = { modo: 'periodo', desde: '2026-09-27', hasta: '2026-10-12' };
        expect(ids(filtrarTalleres(TALLERES, filtro))).toEqual([5, 4]);
        // 16 días: del 11/09 al 26/09.
        expect(ids(talleresAnteriores(TALLERES, filtro))).toEqual([3, 2, 1]);
        expect(talleresAnteriores(TALLERES, { modo: 'periodo', desde: '2026-10-13', hasta: '2026-10-01' })).toBeNull();
    });

    it('los elegidos a mano no tienen anterior', () => {
        const filtro = { modo: 'elegidos', ids: [1, 5] };
        expect(ids(filtrarTalleres(TALLERES, filtro))).toEqual([5, 1]);
        expect(talleresAnteriores(TALLERES, filtro)).toBeNull();
    });

    it('las sumas se comparan por taller y el ROAS como razón', () => {
        const actual = totalesResumen(filtrarTalleres(TALLERES, { modo: 'ultimos', n: 2 }));
        expect(actual).toMatchObject({ inversion: 450, cash: 720, leads: 340, agendas: 34, sales: 3 });
        expect(actual.roas).toBeCloseTo(1.6);

        const antes = totalesResumen([TALLERES[0], TALLERES[4], TALLERES[2]]); // 3 talleres: 450 / 1650
        const v = variaciones(actual, 2, antes, 3);
        // Inversión: 225 por taller contra 183,33 → +22,7%.
        expect(v.inversion).toBeCloseTo(22.73, 1);
        expect(v.roas).toBeCloseTo(((1.6 - 1650 / 550) / (1650 / 550)) * 100, 5);
        expect(variaciones(actual, 2, null, 0)).toBeNull();
    });
});

describe('Workshop › comparación del Resumen', () => {
    const ultimos2 = { modo: 'ultimos', n: 2 };

    it('los talleres anteriores son los N de antes del más viejo de la selección', () => {
        expect(ids(talleresComparados(TALLERES, ultimos2, { modo: 'anteriores' }).talleres)).toEqual([3, 2]);
        // Elegidos 5 y 3: los dos de antes del 26/09, sin repetir los elegidos.
        expect(ids(talleresComparados(TALLERES, { modo: 'elegidos', ids: [5, 3] }, { modo: 'anteriores' }).talleres))
            .toEqual([2, 1]);
        expect(talleresComparados(TALLERES, { modo: 'todos' }, { modo: 'anteriores' })).toBeNull();
    });

    it('período anterior de igual largo, también para los últimos N (del primero al último taller)', () => {
        // Últimos 2: del 03/10 al 12/10 (10 días) → del 23/09 al 02/10.
        const r = talleresComparados(TALLERES, ultimos2, { modo: 'prev' });
        expect(r.rango).toEqual({ desde: '2026-09-23', hasta: '2026-10-02' });
        expect(ids(r.talleres)).toEqual([3]);
    });

    it('mes anterior es el mes calendario entero; mismo período, los mismos días un mes antes', () => {
        const filtro = { modo: 'periodo', desde: '2026-10-01', hasta: '2026-10-12' };
        expect(rangoComparado({ modo: 'mes' }, rangoDeSeleccion(TALLERES, filtro)))
            .toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
        expect(ids(talleresComparados(TALLERES, filtro, { modo: 'mes' }).talleres)).toEqual([3, 2, 1]);
        expect(ids(talleresComparados(TALLERES, filtro, { modo: 'mismo_mes' }).talleres)).toEqual([1]);
        // El 31 cae en el último día del mes anterior; enero va a diciembre del año anterior.
        expect(rangoComparado({ modo: 'mismo_mes' }, { desde: '2026-03-31', hasta: '2026-03-31' }))
            .toEqual({ desde: '2026-02-28', hasta: '2026-02-28' });
        expect(rangoComparado({ modo: 'mes' }, { desde: '2026-01-05', hasta: '2026-01-20' }))
            .toEqual({ desde: '2025-12-01', hasta: '2025-12-31' });
    });

    it('elegidos a mano y fechas personalizadas', () => {
        expect(ids(talleresComparados(TALLERES, ultimos2, { modo: 'elegidos', ids: [1, 2] }).talleres)).toEqual([2, 1]);
        const custom = talleresComparados(TALLERES, ultimos2, { modo: 'custom', desde: '2026-09-20', hasta: '2026-09-10' });
        expect(custom.rango).toEqual({ desde: '2026-09-10', hasta: '2026-09-20' });
        expect(ids(custom.talleres)).toEqual([2, 1]);
        expect(talleresComparados(TALLERES, ultimos2, { modo: 'custom', desde: '', hasta: '' })).toBeNull();
        expect(talleresComparados(TALLERES, ultimos2, { modo: 'none' })).toBeNull();
    });

    it('la comparación por defecto es la de antes: últimos → anteriores, período → anterior', () => {
        expect(comparacionPorDefecto(ultimos2)).toEqual({ modo: 'anteriores' });
        expect(comparacionPorDefecto({ modo: 'periodo' })).toEqual({ modo: 'prev' });
        expect(comparacionPorDefecto({ modo: 'todos' })).toEqual({ modo: 'none' });
    });
});

describe('Workshop › Resumen en la URL', () => {
    const ida = (filtro, comparacion) => {
        const p = new URLSearchParams('tab=x');
        Object.entries({ ...paramsDeFiltro(filtro), ...paramsDeComparacion(comparacion, filtro) })
            .forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
        return p;
    };

    it('ida y vuelta, sin tocar las otras claves', () => {
        const casos = [
            [{ modo: 'ultimos', n: 3 }, { modo: 'mes' }],
            [{ modo: 'periodo', desde: '2026-09-01', hasta: '2026-09-30' }, { modo: 'custom', desde: '2026-08-01', hasta: '2026-08-31' }],
            [{ modo: 'elegidos', ids: [4, 2] }, { modo: 'elegidos', ids: [1] }],
            [{ modo: 'todos' }, { modo: 'none' }],
        ];
        casos.forEach(([filtro, comparacion]) => {
            const p = ida(filtro, comparacion);
            expect(p.get('tab')).toBe('x');
            const vuelta = filtroDeParams(p);
            expect(vuelta).toEqual(filtro);
            expect(comparacionDeParams(p, vuelta)).toEqual(comparacion);
        });
    });

    it('la comparación por defecto no se escribe', () => {
        expect(ida({ modo: 'ultimos', n: 3 }, { modo: 'anteriores' }).toString()).toBe('tab=x&rf=ultimos&rn=3');
        expect(ida({ modo: 'todos' }, { modo: 'none' }).toString()).toBe('tab=x');
    });
});
