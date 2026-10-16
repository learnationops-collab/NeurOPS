import { describe, it, expect } from 'vitest';
import { filtrarTalleres, talleresAnteriores, totalesResumen, variaciones } from './filtroTalleres';

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
