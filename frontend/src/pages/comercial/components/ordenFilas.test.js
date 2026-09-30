import { describe, expect, it } from 'vitest';
import { columnasOrdenables, ordenarFilas, siguienteOrden } from './ordenFilas';

/**
 * El orden de Revisar: sin dato siempre al final, estable, y un ciclo de tres toques.
 */

const fila = (id, horas) => ({ id, horas });
const ids = (filas) => filas.map(f => f.id);
const porHoras = (f) => f.horas;

describe('ordenarFilas', () => {
    const FILAS = [fila(1, 5), fila(2, null), fila(3, 40), fila(4, 5), fila(5, undefined), fila(6, 0)];

    it('de mayor a menor, con los que no tienen dato al final', () => {
        expect(ids(ordenarFilas(FILAS, porHoras, 'desc'))).toEqual([3, 1, 4, 6, 2, 5]);
    });

    it('de menor a mayor, y los sin dato siguen al final', () => {
        // El cero es un dato (no estudió nada): va primero, no con los que no tienen cuenta.
        expect(ids(ordenarFilas(FILAS, porHoras, 'asc'))).toEqual([6, 1, 4, 3, 2, 5]);
    });

    it('es estable: dos filas empatadas conservan el orden del backend', () => {
        expect(ids(ordenarFilas([fila('b', 5), fila('a', 5)], porHoras, 'desc'))).toEqual(['b', 'a']);
    });

    it('compara textos como textos y fechas ISO en orden cronológico', () => {
        const fechas = [{ id: 1, f: '2026-09-02' }, { id: 2, f: '2026-10-01' }, { id: 3, f: '2025-12-31' }];
        expect(ids(ordenarFilas(fechas, x => x.f, 'desc'))).toEqual([2, 1, 3]);
    });

    it('sin columna devuelve las filas tal cual', () => {
        expect(ordenarFilas(FILAS, null, 'desc')).toBe(FILAS);
    });
});

describe('siguienteOrden', () => {
    it('una columna nueva arranca de mayor a menor, después invierte y al tercer toque se va', () => {
        const uno = siguienteOrden(null, 'horas');
        const dos = siguienteOrden(uno, 'horas');
        expect([uno, dos, siguienteOrden(dos, 'horas')]).toEqual([
            { key: 'horas', dir: 'desc' }, { key: 'horas', dir: 'asc' }, null]);
    });

    it('tocar otra columna la ordena a ella desde el principio', () => {
        expect(siguienteOrden({ key: 'horas', dir: 'asc' }, 'racha')).toEqual({ key: 'racha', dir: 'desc' });
    });
});

describe('columnasOrdenables', () => {
    it('son las que traen `orden`, una sola vez cada una', () => {
        const def = { cols: [{ key: 'a', orden: porHoras }, { key: 'b' }, { key: 'a', orden: porHoras }] };
        expect(columnasOrdenables(def).map(c => c.key)).toEqual(['a']);
    });
});
