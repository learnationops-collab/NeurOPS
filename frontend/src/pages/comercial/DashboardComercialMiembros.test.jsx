import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardComercial from './DashboardComercial';
import { getResumen } from './comercialApi';

/**
 * El selector de persona de la dirección lista a la gente del rol elegido en el switch.
 *
 * Reportado en producción (01/10/2026): con Setters, el selector ofrecía a los closers. El
 * contexto se pide una sola vez y sin `rol`, así que `miembros` eran siempre los closers; elegir
 * uno acotaba las agendas de setters por el id de un closer y todo daba 0.
 */

const CLOSERS = [{ id: 1, nombre: 'Marlon', rol: 'closer' }, { id: 2, nombre: 'Nerina', rol: 'closer' }];
const SETTERS = [{ id: 11, nombre: 'Elias', rol: 'setter' }, { id: 12, nombre: 'Paula', rol: 'setter' }];

vi.mock('./comercialApi', () => ({
    getContexto: vi.fn(() => Promise.resolve({
        puede_elegir_equipo: true, puede_reportar: true, rol: 'closers', miembro_id: null,
        yo: { id: 99, rol: 'director_comercial', nombre: 'Director' },
        miembros: CLOSERS, miembros_por_rol: { closers: CLOSERS, setters: SETTERS }, estados: [],
        periodos: [{ key: 'mes', label: 'Este mes' }],
        comparaciones: [{ key: 'prev', label: 'Período anterior' }],
    })),
    getResumen: vi.fn(() => Promise.resolve({})),
    getComparativas: vi.fn(() => Promise.resolve({})),
    getVariabilidad: vi.fn(() => Promise.resolve({})),
    getTabla: vi.fn(() => Promise.resolve({ filas: [] })),
    corregirAgenda: vi.fn(),
    marcarAgendaDuplicada: vi.fn(),
    eliminarAgenda: vi.fn(),
    sincronizarAcademia: vi.fn(() => Promise.resolve({ mensaje: 'ok', corte: null })),
}));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 99, role: 'director_comercial', is_impersonating: false } }),
}));
vi.mock('./components/Analizar', () => ({ default: () => <div data-testid="analizar" /> }));

const montar = (url) => render(
    <MemoryRouter initialEntries={[url]}>
        <DashboardComercial />
    </MemoryRouter>,
);

const opcionesDelSelector = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /Todo el equipo/ }));
    return screen.getAllByRole('menuitemradio').map(o => o.textContent);
};

describe('DashboardComercial · selector de persona', () => {
    beforeEach(() => getResumen.mockClear());

    it('con Closers lista a los closers', async () => {
        montar('/x?rol=closers');
        expect(await opcionesDelSelector()).toEqual(['Todo el equipo', 'Marlon', 'Nerina']);
    });

    it('con Setters lista a los setters, no a los closers', async () => {
        montar('/x?rol=setters');
        expect(await opcionesDelSelector()).toEqual(['Todo el equipo', 'Elias', 'Paula']);
    });

    it('un closer que quedó en la URL con Setters no acota los datos: se ve el equipo', async () => {
        montar('/x?rol=setters&m=1');
        expect(await screen.findByRole('button', { name: /Todo el equipo/ })).toBeInTheDocument();
        await waitFor(() => expect(getResumen).toHaveBeenCalled());
        expect(getResumen.mock.calls.at(-1)[0]).toMatchObject({ rol: 'setters', miembroId: null });
    });

    it('un setter del rol sí acota', async () => {
        montar('/x?rol=setters&m=12');
        expect(await screen.findByRole('button', { name: /Paula/ })).toBeInTheDocument();
        await waitFor(() => expect(getResumen).toHaveBeenCalled());
        expect(getResumen.mock.calls.at(-1)[0]).toMatchObject({ rol: 'setters', miembroId: '12' });
    });
});
