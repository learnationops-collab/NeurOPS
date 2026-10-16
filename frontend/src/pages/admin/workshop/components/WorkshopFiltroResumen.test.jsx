import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkshopFiltroResumen from './WorkshopFiltroResumen';
import { FILTRO_TODOS, comparacionPorDefecto, filtrarTalleres, talleresComparados } from '../filtroTalleres';

const TALLERES = [
    { id: 1, date: '2026-09-05', name: 'Webinar 5 sep', roas: 1.8 },
    { id: 2, date: '2026-09-12', name: 'Webinar 12 sep', roas: 0.9 },
    { id: 3, date: '2026-09-19', name: 'Webinar 19 sep', roas: 2.3 },
    { id: 4, date: '2026-09-26', name: 'Webinar 26 sep', roas: 4.1 },
    { id: 5, date: '2026-10-03', name: 'Webinar 3 oct', roas: 0.5 },
    { id: 6, date: '2026-10-12', name: 'Webinar 12 oct', roas: 2.9 },
];
const ids = (lista) => lista?.map((t) => t.id) ?? null;

// Las pastillas con el estado de verdad del Resumen (que en la página vive en la URL).
const ConEstado = ({ espia }) => {
    const [filtro, setFiltro] = useState(FILTRO_TODOS);
    const [elegida, setElegida] = useState(null);
    const comparacion = elegida || comparacionPorDefecto(filtro);
    const comparado = talleresComparados(TALLERES, filtro, comparacion);
    espia({ filtro, analizados: filtrarTalleres(TALLERES, filtro), comparacion, comparado });
    return (
        <WorkshopFiltroResumen talleres={TALLERES} filtro={filtro} comparacion={comparacion} comparado={comparado}
            onFiltro={setFiltro} onComparacion={setElegida} />
    );
};

const pastilla = (texto) => screen.getByRole('button', { name: new RegExp(texto) });
const opcion = (texto) => screen.getByRole('menuitemradio', { name: texto });

describe('Workshop › Resumen › qué talleres y contra qué', () => {
    it('últimos N: se comparan con los N de antes', async () => {
        const espia = vi.fn();
        render(<ConEstado espia={espia} />);
        expect(pastilla('Todos los talleres')).toHaveTextContent('6 talleres');
        expect(pastilla('Sin comparar')).toBeInTheDocument();

        await userEvent.click(pastilla('Todos los talleres'));
        await userEvent.click(opcion('Últimos 3'));
        const ultimo = espia.mock.lastCall[0];
        expect(ids(ultimo.analizados)).toEqual([6, 5, 4]);
        expect(ids(ultimo.comparado.talleres)).toEqual([3, 2, 1]);
        expect(pastilla('Los 3 anteriores')).toHaveTextContent('3 talleres');
    });

    it('elegir talleres arranca con lo que se estaba mirando y se marca uno por uno', async () => {
        const espia = vi.fn();
        render(<ConEstado espia={espia} />);
        await userEvent.click(pastilla('Todos los talleres'));
        await userEvent.click(opcion('Últimos 3'));
        await userEvent.click(pastilla('Últimos 3'));
        await userEvent.click(opcion('Elegir talleres'));

        // El menú queda abierto con la lista.
        expect(screen.getByRole('checkbox', { name: /Webinar 12 oct/ })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: /Webinar 5 sep/ })).not.toBeChecked();
        await userEvent.click(screen.getByRole('checkbox', { name: /Webinar 5 sep/ }));
        await userEvent.click(screen.getByRole('checkbox', { name: /Webinar 3 oct/ }));
        expect(ids(espia.mock.lastCall[0].analizados)).toEqual([6, 4, 1]);

        await userEvent.click(screen.getByRole('button', { name: 'Ninguno' }));
        expect(espia.mock.lastCall[0].analizados).toEqual([]);
    });

    it('período: toma las fechas de lo que se estaba mirando y compara con el anterior', async () => {
        const espia = vi.fn();
        render(<ConEstado espia={espia} />);
        await userEvent.click(pastilla('Todos los talleres'));
        await userEvent.click(opcion('Período'));
        // Desde «Todos» propone los últimos 4.
        expect(espia.mock.lastCall[0].filtro).toEqual({ modo: 'periodo', desde: '2026-09-19', hasta: '2026-10-12' });
        expect(screen.getByLabelText('Período: desde')).toHaveValue('2026-09-19');
        expect(ids(espia.mock.lastCall[0].comparado.talleres)).toEqual([2, 1]);
    });

    it('la comparación se elige aparte: mes anterior, elegidos y personalizado', async () => {
        const espia = vi.fn();
        render(<ConEstado espia={espia} />);
        await userEvent.click(pastilla('Todos los talleres'));
        await userEvent.click(opcion('Últimos 3'));

        await userEvent.click(pastilla('Los 3 anteriores'));
        await userEvent.click(opcion('Mes anterior'));
        // Últimos 3 terminan el 12/10: el mes anterior es septiembre entero.
        expect(ids(espia.mock.lastCall[0].comparado.talleres)).toEqual([4, 3, 2, 1]);

        await userEvent.click(pastilla('Mes anterior'));
        await userEvent.click(opcion('Elegir talleres'));
        // Arranca con lo que se estaba comparando.
        expect(screen.getByRole('checkbox', { name: /Webinar 19 sep/ })).toBeChecked();
        await userEvent.click(screen.getByRole('checkbox', { name: /Webinar 19 sep/ }));
        expect(ids(espia.mock.lastCall[0].comparado.talleres)).toEqual([4, 2, 1]);

        await userEvent.click(opcion('Personalizado'));
        expect(espia.mock.lastCall[0].comparacion).toEqual({ modo: 'custom', desde: '2026-09-05', hasta: '2026-09-26' });
        expect(screen.getByLabelText('Comparación: desde')).toHaveValue('2026-09-05');

        await userEvent.click(opcion('Sin comparar'));
        expect(espia.mock.lastCall[0].comparado).toBeNull();
    });
});
