import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkshopFiltroResumen from './WorkshopFiltroResumen';
import { filtrarTalleres, talleresAnteriores, FILTRO_TODOS } from '../filtroTalleres';

const TALLERES = [
    { id: 1, date: '2026-09-05', name: 'Webinar 5 sep', roas: 1.8 },
    { id: 2, date: '2026-09-12', name: 'Webinar 12 sep', roas: 0.9 },
    { id: 3, date: '2026-09-19', name: 'Webinar 19 sep', roas: 2.3 },
    { id: 4, date: '2026-09-26', name: 'Webinar 26 sep', roas: 4.1 },
    { id: 5, date: '2026-10-03', name: 'Webinar 3 oct', roas: 0.5 },
    { id: 6, date: '2026-10-12', name: 'Webinar 12 oct', roas: 2.9 },
];

// El panel con el estado de verdad de la página, para ver lo que queda seleccionado.
const ConEstado = ({ espia }) => {
    const [filtro, setFiltro] = useState(FILTRO_TODOS);
    const analizados = filtrarTalleres(TALLERES, filtro);
    espia(filtro, analizados);
    return (
        <WorkshopFiltroResumen talleres={TALLERES} filtro={filtro} onCambiar={setFiltro} formatDate={(d) => d}
            cantidad={analizados.length} cantidadAnterior={talleresAnteriores(TALLERES, filtro)?.length || 0} />
    );
};

describe('Workshop › Resumen › qué talleres analizar', () => {
    it('últimos: arranca en 5 y se compara con los anteriores', async () => {
        const espia = vi.fn();
        render(<ConEstado espia={espia} />);
        expect(screen.getByText('6 talleres en el análisis')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Últimos' }));
        expect(espia.mock.lastCall[1].map((t) => t.id)).toEqual([6, 5, 4, 3, 2]);

        await userEvent.click(screen.getByRole('button', { name: '3' }));
        expect(espia.mock.lastCall[1].map((t) => t.id)).toEqual([6, 5, 4]);
        expect(screen.getByRole('status')).toHaveTextContent('3 talleres en el análisis · las flechas comparan el promedio por taller con los 3 anteriores');
    });

    it('elegir arranca con lo que se estaba mirando y se marca o desmarca uno por uno', async () => {
        const espia = vi.fn();
        render(<ConEstado espia={espia} />);
        await userEvent.click(screen.getByRole('button', { name: 'Últimos' }));
        await userEvent.click(screen.getByRole('button', { name: '3' }));
        await userEvent.click(screen.getByRole('button', { name: 'Elegir talleres' }));

        expect(screen.getByRole('checkbox', { name: /Webinar 12 oct/ })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: /Webinar 5 sep/ })).not.toBeChecked();
        await userEvent.click(screen.getByRole('checkbox', { name: /Webinar 5 sep/ }));
        await userEvent.click(screen.getByRole('checkbox', { name: /Webinar 3 oct/ }));
        expect(espia.mock.lastCall[1].map((t) => t.id)).toEqual([6, 4, 1]);

        await userEvent.click(screen.getByRole('button', { name: 'Ninguno' }));
        expect(screen.getByRole('status')).toHaveTextContent('Ningún taller en esta selección.');
    });

    it('período: toma las fechas de lo que se estaba mirando y se pueden cambiar', async () => {
        const espia = vi.fn();
        render(<ConEstado espia={espia} />);
        await userEvent.click(screen.getByRole('button', { name: 'Período' }));
        // Desde «Todos» propone los últimos 4.
        expect(espia.mock.lastCall[0]).toEqual({ modo: 'periodo', desde: '2026-09-19', hasta: '2026-10-12' });
        expect(screen.getByRole('status')).toHaveTextContent('el período anterior del mismo largo (2 talleres)');
    });
});
