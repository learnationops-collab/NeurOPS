import { describe, expect, it } from 'vitest';
import { columnas } from './Eleccion';

/**
 * Las tarjetas de la elección (rol o área) van en filas parejas: con la tarjeta «Finanzas» (08/10/2026)
 * Mario tiene cinco, y la grilla automática las dejaba 4 + 1 (y 3 + 1 con cuatro hasta 900px).
 */
describe('columnas', () => {
    it('en ancho completo, hasta cinco en una fila y después dos filas', () => {
        expect([1, 2, 3, 4, 5].map((n) => columnas(n).ancho)).toEqual([1, 2, 3, 4, 5]);
        expect(columnas(6).ancho).toBe(3);
        expect(columnas(8).ancho).toBe(4);
    });

    it('nunca deja una sola en la última fila, ni en ancho completo ni hasta 900px', () => {
        for (let n = 2; n <= 10; n += 1) {
            const { ancho, medio } = columnas(n);
            expect(n % ancho === 0 || n % ancho > 1).toBe(true);
            expect(n % medio === 0 || n % medio > 1).toBe(true);
        }
    });
});
