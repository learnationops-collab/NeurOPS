import { afterEach, describe, expect, it, vi } from 'vitest';
import { ajustarAPantalla } from './useEnPantalla';

/** jsdom no tiene layout: la caja del flotante se simula. */
const caja = (left, width, top = 100) => ({ left, right: left + width, width, top, bottom: top + 200, height: 200 });

const nodo = (rect) => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => rect;
    return el;
};

afterEach(() => vi.restoreAllMocks());

describe('ajustarAPantalla', () => {
    const pantalla = (ancho, alto) => {
        Object.defineProperty(document.documentElement, 'clientWidth', { value: ancho, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: alto, configurable: true });
    };

    it('lo que se sale por la izquierda se corre hasta el margen', () => {
        pantalla(1366, 768);
        const el = nodo(caja(-120, 300));
        ajustarAPantalla(el);
        expect(el.style.translate).toBe('136px 0');
    });

    it('lo que se sale por la derecha se corre hacia adentro', () => {
        pantalla(1000, 768);
        const el = nodo(caja(800, 300));
        ajustarAPantalla(el);
        expect(el.style.translate).toBe('-116px 0');
    });

    it('lo que entra no se mueve', () => {
        pantalla(1366, 768);
        const el = nodo(caja(200, 300));
        ajustarAPantalla(el);
        expect(el.style.translate).toBe('');
    });

    it('se topa al alto que queda debajo y scrollea adentro', () => {
        pantalla(1366, 600);
        const el = nodo(caja(200, 300, 400));
        ajustarAPantalla(el);
        expect(el.style.maxHeight).toBe('184px');
        expect(el.style.overflowY).toBe('auto');
    });
});
