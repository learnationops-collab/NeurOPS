import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PillMenu } from './Shared';

/**
 * En el teléfono la barra se parte en renglones y la píldora del VS queda contra el borde
 * izquierdo: su menú (250px) cuelga de su borde derecho (202px) y arrancaba en -48px, fuera de la
 * pantalla. jsdom no tiene layout, así que la caja se simula.
 */

const caja = (left, width) => ({ left, right: left + width, width, top: 0, bottom: 0, height: 0, x: left, y: 0 });

afterEach(() => vi.restoreAllMocks());

const abrir = () => {
    render(<PillMenu texto="Período anterior" valor="prev" onChange={() => {}} ancho={250}
        opciones={[{ key: 'prev', label: 'Período anterior' }]} />);
    fireEvent.click(screen.getByRole('button', { name: /Período anterior/ }));
    return screen.getByRole('menu');
};

describe('PillMenu · el menú no se sale de la pantalla', () => {
    it('si se saldría por la izquierda, se corre hasta el margen', () => {
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(caja(-48, 250));
        expect(abrir().style.transform).toBe('translateX(64px)');
    });

    it('si entra, queda donde estaba', () => {
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(caja(100, 250));
        Object.defineProperty(document.documentElement, 'clientWidth', { value: 1100, configurable: true });
        expect(abrir().style.transform).toBe('');
    });
});
