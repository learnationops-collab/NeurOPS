import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SeguimientosPane from './SeguimientosPane';
import api from '../../../services/api';
import { escalonDe } from '../../../components/huesos/Huesos';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn() } }));

/**
 * Las filas entran de a una sólo en la tanda que reemplaza al esqueleto (o al desplegar una
 * lista). Una fila que aparece suelta después —la que vuelve al borrar letras del buscador del
 * pool— entra enseguida: antes esperaba el turno de su índice, invisible y con el hueco reservado,
 * mientras el resto de la lista estaba quieto.
 */

const fila = (id, lead_name) => ({ id, lead_name, dias_retraso: 0, origin: 'Meta Ads' });
const COBROS = [fila(1, 'Ana Uno'), fila(2, 'Beto Dos'), fila(3, 'Caro Tres')];
const POOL = [fila(11, 'Dani Pool'), fila(12, 'Eli Pool'), fila(13, 'Fer Pool')];

const RESPUESTAS = {
    '/closer/followups/today': { grouped: { cerrada: COBROS, tomada: [], no_tomada: [] } },
    '/closer/followups/pool-counts': { cerrada: 0, tomada: POOL.length, no_tomada: 0 },
    '/closer/followups/goal': { hechos: 1, meta: 50, faltan: 49, pct: 2 },
    '/closer/followups/earnings-stats': null,
    '/closer/followups/pool': { items: POOL },
};

const retrasos = (filas) => filas.map(f => f.closest('.row-v6').style.animationDelay);

describe('SeguimientosPane: entrada de las filas', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        api.get.mockImplementation((url) => Promise.resolve({ data: RESPUESTAS[url.split('?')[0]] }));
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('la tanda que reemplaza al esqueleto entra escalonada', async () => {
        render(<SeguimientosPane selectedDate="2026-09-29" onOpenLead={() => {}} />);
        const filas = await Promise.all(COBROS.map(i => screen.findByText(i.lead_name)));
        expect(retrasos(filas)).toEqual([0, 1, 2].map(i => `${escalonDe(i)}ms`));
    });

    it('una fila que vuelve con el buscador, pasada la entrada, no espera su turno', async () => {
        render(<SeguimientosPane selectedDate="2026-09-29" onOpenLead={() => {}} />);
        fireEvent.click(await screen.findByText('Llamadas tomadas'));
        const alAbrir = await Promise.all(POOL.map(i => screen.findByText(i.lead_name)));
        // Abrir el pool también es una tanda.
        expect(retrasos(alAbrir)).toEqual([0, 1, 2].map(i => `${escalonDe(i)}ms`));

        // Termina la entrada; el buscador esconde las dos últimas y después vuelven.
        act(() => { vi.advanceTimersByTime(5000); });
        const buscador = screen.getByLabelText('Buscar en el pool');
        fireEvent.change(buscador, { target: { value: 'dani' } });
        expect(screen.queryByText('Fer Pool')).toBeNull();
        fireEvent.change(buscador, { target: { value: '' } });

        const alVolver = POOL.map(i => screen.getByText(i.lead_name));
        expect(retrasos(alVolver)).toEqual(['0ms', '0ms', '0ms']);
    });
});
