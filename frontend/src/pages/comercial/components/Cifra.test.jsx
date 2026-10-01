import React from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Cifra from './Cifra';

/**
 * La cifra que cuenta: la del dashboard (desde 0) y la de la tira de totales de Revisar
 * (`desdeAnterior`: al cambiar el filtro va del número que se veía al nuevo).
 *
 * Los cuadros se corren a mano con un `requestAnimationFrame` falso: cada `correr(t)` es un cuadro
 * en el instante `t` (ms).
 */

let cola;
let siguiente;
const correr = (t) => {
    const cuadros = [...cola.values()];
    cola.clear();
    cuadros.forEach(cb => cb(t));
};
const monto = (el) => Number(el.textContent.replace(/[$,]/g, ''));

beforeEach(() => {
    cola = new Map();
    siguiente = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        siguiente += 1;
        cola.set(siguiente, cb);
        return siguiente;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { cola.delete(id); });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('Cifra', () => {
    it('el render deja el valor final y el conteo sube desde 0 con su formato', () => {
        const { container } = render(<Cifra tag="b" valor="$1,200" />);
        const el = container.querySelector('b');
        expect(el).toHaveTextContent('$1,200');

        correr(0);
        expect(el).toHaveTextContent('$0');
        correr(300);
        expect(monto(el)).toBeGreaterThan(0);
        expect(monto(el)).toBeLessThan(1200);
        expect(el.textContent).toMatch(/^\$[\d,]+$/);
        correr(820);
        expect(el).toHaveTextContent('$1,200');
        expect(cola.size).toBe(0);
    });

    it('con `desdeAnterior` va del número que se veía al nuevo', () => {
        const props = { tag: 'b', desdeAnterior: true, duracion: 600 };
        const { container, rerender } = render(<Cifra {...props} valor="$1,200" />);
        const el = container.querySelector('b');
        correr(0);
        correr(600);
        expect(el).toHaveTextContent('$1,200');

        rerender(<Cifra {...props} valor="$450" />);
        correr(1000);
        // Arranca donde estaba, con su coma: bajar de $1,200 pasa por montos de cuatro cifras.
        expect(el).toHaveTextContent('$1,200');
        correr(1300);
        expect(monto(el)).toBeGreaterThan(450);
        expect(monto(el)).toBeLessThan(1200);
        correr(1600);
        expect(el).toHaveTextContent('$450');
    });

    it('si el valor cambia a mitad del conteo, el siguiente sigue desde donde iba', () => {
        const props = { tag: 'b', desdeAnterior: true, duracion: 600 };
        const { container, rerender } = render(<Cifra {...props} valor="80%" />);
        const el = container.querySelector('b');
        correr(0);
        correr(200);
        const aMitad = el.textContent;
        expect(aMitad).not.toBe('80%');

        rerender(<Cifra {...props} valor="20%" />);
        correr(500);
        expect(el).toHaveTextContent(aMitad);
        correr(1100);
        expect(el).toHaveTextContent('20%');
    });

    it('con movimiento reducido no cuenta: el número queda quieto desde el principio', () => {
        vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
        const { container, rerender } = render(<Cifra tag="b" valor="$1,200" desdeAnterior />);

        expect(window.requestAnimationFrame).not.toHaveBeenCalled();
        rerender(<Cifra tag="b" valor="$300" desdeAnterior />);
        expect(window.requestAnimationFrame).not.toHaveBeenCalled();
        expect(container.querySelector('b')).toHaveTextContent('$300');
    });

    it('"—" no cuenta, y el número que le sigue sube desde 0', () => {
        const { container, rerender } = render(<Cifra tag="b" valor="—" desdeAnterior />);
        expect(cola.size).toBe(0);
        expect(container.querySelector('b')).toHaveTextContent('—');

        rerender(<Cifra tag="b" valor="$300" desdeAnterior />);
        correr(0);
        expect(container.querySelector('b')).toHaveTextContent('$0');
    });

    it('un número que no cambia no vuelve a contar', () => {
        const { rerender } = render(<Cifra tag="b" valor="12" desdeAnterior />);
        correr(0);
        correr(820);

        rerender(<Cifra tag="b" valor="12" desdeAnterior className="otra" />);
        expect(cola.size).toBe(0);
    });
});
