import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FlujoEmbudo, { conversion } from './FlujoEmbudo';

/**
 * El embudo horizontal del reporte nuevo (artifact del 10/10/2026): una barra por etapa y, entre
 * dos barras, la píldora con la conversión. Lo que se fija acá es lo que se lee: los números, las
 * conversiones, el cruce del reporte al sistema marcado aparte, y que una etapa con lista se abra.
 * jsdom no mide: sin ancho se dibuja horizontal, como en una pantalla ancha.
 */

const ETAPAS = [
    { key: 'entrantes', label: 'Entrantes', n: 200 },
    { key: 'cualificados', label: 'Cualificados', n: 150 },
    { key: 'agendas', label: 'Agendas', n: 20 },
    { key: 'generadas', label: 'Generadas', n: 25, cruce: true },
];

describe('FlujoEmbudo', () => {
    it('dibuja cada etapa con su número y la conversión contra la anterior', () => {
        const { container } = render(<FlujoEmbudo etapas={ETAPAS} />);

        ['ENTRANTES', 'CUALIFICADOS', 'AGENDAS', 'GENERADAS'].forEach(r => expect(screen.getByText(r)).toBeInTheDocument());
        ['200', '150', '20', '25'].forEach(n => expect(screen.getByText(n)).toBeInTheDocument());
        const pildoras = [...container.querySelectorAll('.flj-pildora text')].map(p => p.textContent);
        expect(pildoras).toEqual(['75%', '13%', '125%']);
    });

    it('el cruce del reporte al sistema va punteado y arriba de 100% va en ámbar', () => {
        const { container } = render(<FlujoEmbudo etapas={ETAPAS} />);

        const cruce = container.querySelectorAll('.flj-pildora')[2];
        expect(cruce).toHaveClass('flj-pildora--cruce');
        expect(cruce).toHaveClass('flj-pildora--alta');
        expect(cruce.querySelector('title').textContent).toBe('Generadas: el sistema registra 25 y se reportaron 20');
        expect(container.querySelectorAll('.flj-pildora')[0]).not.toHaveClass('flj-pildora--cruce');
    });

    it('sin denominador la conversión es «—», no 0%', () => {
        const { container } = render(<FlujoEmbudo etapas={[
            { key: 'a', label: 'A', n: 0 }, { key: 'b', label: 'B', n: 0 }]} />);

        expect(container.querySelector('.flj-pildora text').textContent).toBe('—');
        expect(conversion(3, 0)).toBeNull();
    });

    it('una etapa con lista se abre con el clic y con el teclado', () => {
        const ir = vi.fn();
        render(<FlujoEmbudo etapas={[ETAPAS[0], { ...ETAPAS[3], ir }]} />);

        const etapa = screen.getByRole('button', { name: 'Ver la lista: Generadas, 25' });
        fireEvent.click(etapa);
        fireEvent.keyDown(etapa, { key: 'Enter' });
        expect(ir).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole('button', { name: /Entrantes/ })).toBeNull();
    });

    it('apilado es el mismo embudo, una fila por etapa', () => {
        const ir = vi.fn();
        const { container } = render(<FlujoEmbudo apilar etapas={[ETAPAS[0], { ...ETAPAS[1], ir }]} />);

        expect(container.querySelector('svg.flj-svg')).toBeNull();
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(container.querySelector('.flj-pildora').textContent).toBe('75%');
        fireEvent.click(screen.getByRole('button', { name: 'Ver la lista: Cualificados, 150' }));
        expect(ir).toHaveBeenCalled();
    });

    it('sin bandas no hay píldoras: son barras sueltas', () => {
        const { container } = render(<FlujoEmbudo bandas={false} etapas={ETAPAS} />);

        expect(container.querySelectorAll('.flj-pildora')).toHaveLength(0);
        expect(container.querySelectorAll('.flj-banda')).toHaveLength(0);
    });
});
