import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RepartoEstados, { agrupar } from './RepartoEstados';
import TiraDescalificadas from './TiraDescalificadas';

/**
 * Descalificadas (23/10/2026): las agendas que el closer descalificó al confirmar tienen su propio
 * grupo en el panel Estados, siempre a la vista, y debajo del panel se dice cuántos leads descalificó
 * el closer y cuántos el formulario de agenda.
 */

const AYUDA = 'El closer vio que el lead no calificaba.';
const ESTADOS = [
    { key: 'asistio', label: 'Asistió', tone: 'success', n: 6, filtro: 'Asistió', grupo: 'show_up' },
    { key: 'descalificada', label: 'Descalificada', tone: 'cat-6', n: 2, filtro: 'Descalificada',
        grupo: 'descalificadas', ayuda: AYUDA },
    { key: 'lead_perdido', label: 'Lead perdido', tone: 'error', n: 1, filtro: 'Lead perdido', grupo: 'descartadas' },
];

describe('RepartoEstados · Descalificadas', () => {
    it('es un grupo propio, aparte de «Descartadas»', () => {
        const grupos = agrupar(ESTADOS);
        const por = Object.fromEntries(grupos.map(g => [g.key, g]));

        expect(por.descalificadas.n).toBe(2);
        expect(por.descalificadas.estados.map(e => e.key)).toEqual(['descalificada']);
        expect(por.descartadas.n).toBe(1);
    });

    it('se ve siempre, también en cero: lo que la dirección viene a mirar no cambia de lugar', () => {
        const grupos = agrupar([ESTADOS[0]]);

        expect(grupos.map(g => g.key)).toContain('descalificadas');
        expect(grupos.find(g => g.key === 'descalificadas').n).toBe(0);
    });

    it('en el gráfico lleva a Revisar con las descalificadas', () => {
        const irA = vi.fn();
        render(<RepartoEstados estados={ESTADOS} vista="grafico" irA={irA} />);

        const grupo = screen.getByRole('button', { name: /^Descalificadas: 2 de 9 agendas/ });
        grupo.click();

        // La carga del drill-down viaja aplanada: faceta → etiqueta, más `__de` (ver `cargaDe`).
        expect(irA).toHaveBeenCalledWith('agendas', expect.objectContaining({
            estado: 'Descalificada', __de: 'Estados: Descalificadas',
        }));
    });

    it('en la tabla la fila lleva su tooltip', () => {
        render(<RepartoEstados estados={ESTADOS} vista="tabla" irA={vi.fn()} />);

        expect(screen.getByRole('button', { name: /^Descalificada:/ })).toHaveAttribute('title', AYUDA);
    });
});

describe('TiraDescalificadas', () => {
    it('dice cuántas descalificó el closer y cuántas el formulario', () => {
        render(<TiraDescalificadas datos={{ closer: 4, formulario: 12 }} irA={vi.fn()} />);
        const tira = screen.getByRole('group', { name: 'Leads descalificados' });

        expect(within(tira).getByText('Por el closer')).toBeInTheDocument();
        expect(within(tira).getByText('Por el formulario')).toBeInTheDocument();
        expect(within(tira).getByText('4')).toBeInTheDocument();
        expect(within(tira).getByText('12')).toBeInTheDocument();
    });

    it('la cifra del closer lleva a las agendas descalificadas en Revisar', () => {
        const irA = vi.fn();
        render(<TiraDescalificadas datos={{ closer: 4, formulario: 12 }} irA={irA} />);

        screen.getByRole('button', { name: /Por el closer, 4/ }).click();

        expect(irA).toHaveBeenCalledWith('agendas', expect.objectContaining({
            estado: 'Descalificada', __de: 'Descalificadas por el closer',
        }));
    });

    it('la del formulario no tiene lista: nunca llegaron a ser una agenda', () => {
        render(<TiraDescalificadas datos={{ closer: 4, formulario: 12 }} irA={vi.fn()} />);

        expect(screen.queryByRole('button', { name: /Por el formulario/ })).toBeNull();
    });

    it('con un closer elegido el formulario no se dibuja (esos leads no son de nadie)', () => {
        render(<TiraDescalificadas datos={{ closer: 3, formulario: null }} irA={vi.fn()} />);

        expect(screen.getByText('Por el closer')).toBeInTheDocument();
        expect(screen.queryByText('Por el formulario')).toBeNull();
    });

    it('con un backend anterior, que no manda el bloque, no dibuja nada', () => {
        const { container } = render(<TiraDescalificadas datos={undefined} />);

        expect(container).toBeEmptyDOMElement();
    });
});
