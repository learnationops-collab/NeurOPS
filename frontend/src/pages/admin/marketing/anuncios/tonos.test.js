import { describe, expect, it } from 'vitest';
import { embudoDe, referenciasDe, tonoDe } from './tonos';

const TOTALES = {
    entrantes: 1000, calificados: 600, agendas: 60, ventas: 6, cobrado: 6000, gasto: 1000,
    pct_calificados: 60, pct_descalificados: 10, pct_sin_respuesta: 30, cpl: 1, cpl_calificado: 1.67,
    costo_agenda: 16.67, costo_venta: 166.67, roas: 6,
};
const refs = referenciasDe(TOTALES, 10);

describe('tonoDe', () => {
    it('más calificados que la tabla es verde; más costo por lead, rojo', () => {
        expect(tonoDe({ entrantes: 100, pct_calificados: 75 }, 'calificados', refs)).toBe('bien');
        expect(tonoDe({ entrantes: 100, cpl: 1.5 }, 'cpl', refs)).toBe('mal');
        expect(tonoDe({ entrantes: 100, cpl: 0.6 }, 'cpl', refs)).toBe('bien');
    });

    it('cerca del promedio no lleva color', () => {
        expect(tonoDe({ entrantes: 100, pct_calificados: 63 }, 'calificados', refs)).toBeNull();
    });

    it('las cantidades se comparan con el promedio por fila', () => {
        expect(refs.agendas).toBe(6);
        expect(tonoDe({ agendas: 12 }, 'agendas', refs)).toBe('bien');
        expect(tonoDe({ agendas: 1 }, 'agendas', refs)).toBe('mal');
    });

    it('si la fila típica no llega a 1, un 0 no es rojo pero tener alguna es verde', () => {
        const pocas = referenciasDe({ ventas: 2 }, 10); // 0,2 ventas por fila
        expect(tonoDe({ ventas: 0 }, 'ventas', pocas)).toBeNull();
        expect(tonoDe({ ventas: 1 }, 'ventas', pocas)).toBe('bien');
    });

    it('con pocos leads, los porcentajes no se pintan', () => {
        expect(tonoDe({ entrantes: 4, pct_calificados: 100 }, 'calificados', refs)).toBeNull();
    });

    it('sin dato, o una métrica sin referencia (el gasto), no hay color', () => {
        expect(tonoDe({ entrantes: 100, cpl: null }, 'cpl', refs)).toBeNull();
        expect(tonoDe({ gasto: 5000 }, 'gasto', refs)).toBeNull();
        expect(tonoDe({ roas: 9 }, 'roas', null)).toBeNull();
    });
});

describe('embudoDe', () => {
    it('cada paso con su conversión y su color contra la de la tabla', () => {
        const pasos = embudoDe({ entrantes: 100, calificados: 80, agendas: 4, ventas: 0 }, TOTALES);
        expect(pasos.map((p) => p.valor)).toEqual([100, 80, 4, 0]);
        expect(pasos[1].conversion).toBe(0.8);
        expect(pasos[1].tono).toBe('bien'); // 80% contra 60%
        expect(pasos[2].tono).toBe('mal'); // 5% contra 10%
        expect(pasos[3].tono).toBeNull(); // 4 agendas: muy pocas para juzgar
        expect(pasos[0].conversion).toBeNull();
    });
});
