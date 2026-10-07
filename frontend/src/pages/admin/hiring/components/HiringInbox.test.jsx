import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../../services/api';
import HiringInbox from './HiringInbox';

/**
 * El inbox de Hiring: la barra de Pendientes (título + Híbridos/Online/Incompletas en una sola
 * línea), los contadores por modalidad y el borrado de postulaciones.
 *
 * Se mockea `api` para mirar el pedido real (filtro y modalidad) y el modal de la candidata
 * porque no es lo que se prueba acá.
 */

vi.mock('../../../../services/api', () => ({
    default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
vi.mock('./HiringCandidateModal', () => ({
    default: ({ applicationId }) => <div data-testid="modal-candidata">{applicationId}</div>,
}));

const fila = (id, nombre, extra = {}) => ({
    id, nombre, pais: 'Argentina', edad: '28', modalidad: 'online', veredicto: 'sin_analizar',
    experiencia: '', ia_avanzado: '', sheets: '', ingles: '', idioma2: '', remuneracion: '300',
    video_ok: false, cv: '', whatsapp: '', score: 70, ...extra,
});

const CONTEOS = {
    sin_analizar: 7, incompletas: 3, todas: 12, seleccionadas: 1, en_reserva: 1, descartadas: 0,
    testeo: 0, winners: 0, top_tier: 0, bajas: 0, completas: 9, con_video: 2, hibrido: 4, online: 3,
};

/** Backend de mentira: devuelve un listado fijo y guarda cada pedido para inspeccionarlo. */
const montarApi = ({ postulaciones = [fila(1, 'Ana Pérez'), fila(2, 'Bea Gómez')], conteos = CONTEOS, total = 9 } = {}) => {
    api.get.mockImplementation(() => Promise.resolve({
        data: { postulaciones, conteos, conteos_globales: conteos, total },
    }));
};

const pedidos = () => api.get.mock.calls.map(([ruta]) => ruta);

beforeEach(() => {
    vi.clearAllMocks();
    montarApi();
});
afterEach(() => vi.useRealTimers());

describe('barra de Pendientes', () => {
    it('pone el título y los toggles Híbridos, Online e Incompletas en la misma fila', async () => {
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');

        const titulo = screen.getByRole('heading', { level: 1, name: 'Pendientes' });
        const fila = titulo.parentElement;
        expect(fila.className).toContain('flex-wrap');
        for (const nombre of [/Híbridos/, /Online/, /Incompletas/]) {
            expect(fila).toContainElement(screen.getByRole('button', { name: nombre }));
        }
    });

    it('ya no tiene una segunda barra de sub-filtros ni un botón «Sin analizar»', async () => {
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');

        expect(screen.queryByRole('button', { name: /Sin analizar/ })).not.toBeInTheDocument();
    });

    it('arranca en «sin analizar» y muestra el contador de cada toggle', async () => {
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');

        expect(pedidos()[0]).toBe('/assistant-applications?filtro=sin_analizar');
        expect(screen.getByRole('button', { name: /Híbridos/ })).toHaveTextContent('4');
        expect(screen.getByRole('button', { name: /Online/ })).toHaveTextContent('3');
        expect(screen.getByRole('button', { name: /Incompletas/ })).toHaveTextContent('3');
    });

    it('Incompletas se prende y se apaga, y vuelve a «sin analizar»', async () => {
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');
        const incompletas = screen.getByRole('button', { name: /Incompletas/ });

        fireEvent.click(incompletas);
        await waitFor(() => expect(pedidos().at(-1)).toBe('/assistant-applications?filtro=incompletas'));
        expect(incompletas).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(incompletas);
        await waitFor(() => expect(pedidos().at(-1)).toBe('/assistant-applications?filtro=sin_analizar'));
        expect(incompletas).toHaveAttribute('aria-pressed', 'false');
    });

    it('Incompletas respeta la modalidad elegida', async () => {
        render(<HiringInbox grupo="pendientes" titulo="Pendientes" />);
        await screen.findByText('Ana Pérez');

        fireEvent.click(screen.getByRole('button', { name: /Híbridos/ }));
        await waitFor(() => expect(pedidos().at(-1)).toBe('/assistant-applications?filtro=sin_analizar&modalidad=hibrido'));
        fireEvent.click(screen.getByRole('button', { name: /Incompletas/ }));

        await waitFor(() => expect(pedidos().at(-1)).toBe('/assistant-applications?filtro=incompletas&modalidad=hibrido'));
    });
});

describe('Analizados, Finalistas y búsqueda', () => {
    it('Analizados mantiene su título y sus sub-filtros de estado', async () => {
        render(<HiringInbox grupo="analizados" titulo="Analizados" />);
        await screen.findByText('Ana Pérez');

        expect(screen.getByRole('heading', { level: 1, name: 'Analizados' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Seleccionadas/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Reserva/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Descartadas/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Híbridos/ })).not.toBeInTheDocument();
        expect(pedidos()[0]).toBe('/assistant-applications?filtro=seleccionadas');
    });

    it('Finalistas cambia de sub-filtro', async () => {
        render(<HiringInbox grupo="finalistas" titulo="Finalistas" />);
        await screen.findByText('Ana Pérez');

        fireEvent.click(screen.getByRole('button', { name: /Winner/ }));

        await waitFor(() => expect(pedidos().at(-1)).toBe('/assistant-applications?filtro=winners'));
    });

    it('la búsqueda recorre todo el pool y no ofrece toggles', async () => {
        render(<HiringInbox grupo="busqueda" query="ana" titulo="Resultados para «ana»" />);
        await screen.findByText('Ana Pérez');

        expect(screen.getByRole('heading', { level: 1, name: 'Resultados para «ana»' })).toBeInTheDocument();
        expect(pedidos()[0]).toBe('/assistant-applications?filtro=todas');
        expect(screen.queryByRole('button', { name: /Incompletas/ })).not.toBeInTheDocument();
        expect(screen.queryByText('Bea Gómez')).not.toBeInTheDocument();
    });
});
