import { describe, expect, it } from 'vitest';
import {
    formatoAcademia, haceCuanto, itemTotalAcademia, resumenAcademia, tramoEjecuciones, tramoHoras,
} from './academia';

/**
 * Las piezas sin React de la Academia en Revisar: la frescura, los tramos de las facetas y el
 * resumen que cuenta alumnos (clientes) y no filas.
 */

const AHORA = Date.parse('2026-09-30T15:00:00Z');
const bloque = (key, extra = {}) => ({ estado: { key, label: key, tone: 'idle' }, ...extra });

describe('haceCuanto', () => {
    it.each([
        ['2026-09-30T14:59:40Z', 'recién'],
        ['2026-09-30T14:20:00Z', 'hace 40 min'],
        ['2026-09-30T12:00:00Z', 'hace 3 h'],
        ['2026-09-29T15:00:00Z', 'hace 1 día'],
        ['2026-09-27T15:00:00Z', 'hace 3 días'],
        ['2026-06-30T15:00:00Z', 'hace 3 meses'],
    ])('%s es "%s"', (iso, texto) => {
        expect(haceCuanto(iso, AHORA)).toBe(texto);
    });

    it('sin fecha, o con una que no se entiende, no inventa nada', () => {
        expect(haceCuanto(null, AHORA)).toBeNull();
        expect(haceCuanto('ayer', AHORA)).toBeNull();
    });
});

describe('los tramos de las facetas', () => {
    it('reparten las horas y las ejecuciones, y sin dato no ofrecen opción', () => {
        const fila = (academia) => ({ academia });
        expect([0.5, 3, 12, 80].map(h => tramoHoras(fila({ horas: h })))).toEqual(
            ['Menos de 1 h', '1 a 9 h', '10 a 49 h', '50 h o más']);
        expect([0, 4, 20, 67].map(n => tramoEjecuciones(fila({ ejecuciones: n })))).toEqual(
            ['Ninguna', '1 a 9', '10 a 49', '50 o más']);
        expect(tramoHoras(fila(null))).toBeNull();
        expect(tramoEjecuciones(fila({ ejecuciones: null }))).toBeNull();
    });
});

describe('resumenAcademia', () => {
    it('cuenta cada cliente una vez aunque tenga varias filas (Ventas)', () => {
        const filas = [
            { client_id: 1, academia: bloque('activo', { sincronizado: '2026-09-30T10:00:00Z' }) },
            { client_id: 1, academia: bloque('activo', { sincronizado: '2026-09-30T10:00:00Z' }) },
            { client_id: 2, academia: bloque('inactivo', { sincronizado: '2026-09-25T10:00:00Z' }) },
            { client_id: 3, academia: bloque('sin_datos') },
            // Una venta que no se cruza con ningún cliente: no hay alumno que contar.
            { client_id: null, academia: null },
        ];

        expect(resumenAcademia(filas)).toEqual({
            clientes: 3, activos: 1, conCuenta: 2, sinDatos: 1, conDatos: 2,
            masViejo: '2026-09-25T10:00:00Z',
        });
    });

    it('el dato más viejo compara fechas, no textos (con y sin microsegundos)', () => {
        const filas = [
            { client_id: 1, academia: bloque('activo', { sincronizado: '2026-09-30T12:00:00.500000Z' }) },
            { client_id: 2, academia: bloque('activo', { sincronizado: '2026-09-30T12:00:00Z' }) },
        ];

        expect(resumenAcademia(filas).masViejo).toBe('2026-09-30T12:00:00Z');
    });

    it('el total de la tira dice activos sobre los que tienen cuenta', () => {
        const filas = [{ client_id: 1, academia: bloque('activo') }, { client_id: 2, academia: bloque('inactivo') }];

        expect(itemTotalAcademia(filas)).toMatchObject({ valor: '1', hint: 'de 2 con cuenta' });
    });
});

describe('formatoAcademia', () => {
    it('escribe cada métrica con su unidad, y un guión sin dato', () => {
        expect([formatoAcademia.horas(12), formatoAcademia.progreso(31.54), formatoAcademia.lecciones(11, 12),
            formatoAcademia.ejecuciones(1500), formatoAcademia.racha(1), formatoAcademia.racha(4)])
            .toEqual(['12 h', '31.5%', '11/12', '1,500', '1 día', '4 días']);
        expect([formatoAcademia.horas(null), formatoAcademia.lecciones(undefined, 12)]).toEqual(['—', '—']);
    });
});
