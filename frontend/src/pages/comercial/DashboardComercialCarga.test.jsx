import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardComercial from './DashboardComercial';
import { getContexto, getResumen } from './comercialApi';

/**
 * La carga del tablero: cada bloque muestra su esqueleto mientras espera SU pedido, y si la primera
 * carga falla ofrece reintentar en vez de quedarse en el esqueleto para siempre.
 */

const CONTEXTO = {
    puede_elegir_equipo: false, puede_reportar: false, rol: 'setters',
    yo: { id: 7, rol: 'setter', nombre: 'Ana Setter' }, miembros: [], estados: [],
    periodos: [{ key: 'mes', label: 'Este mes' }],
    comparaciones: [{ key: 'prev', label: 'Período anterior' }],
};

vi.mock('./comercialApi', () => ({
    getContexto: vi.fn(),
    getResumen: vi.fn(),
    getComparativas: vi.fn(() => Promise.resolve({})),
    getVariabilidad: vi.fn(() => Promise.resolve({})),
    getTabla: vi.fn(() => Promise.resolve({ filas: [] })),
    getNoCerradas: vi.fn(),
    corregirAgenda: vi.fn(),
    marcarAgendaDuplicada: vi.fn(),
    eliminarAgenda: vi.fn(),
    sincronizarAcademia: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 7, role: 'setter', is_impersonating: false } }),
}));

const montar = () => render(
    <MemoryRouter initialEntries={['/x']}>
        <DashboardComercial embebido seccionFija="analizar" />
    </MemoryRouter>,
);

beforeEach(() => {
    getContexto.mockReset();
    getResumen.mockReset();
});

describe('DashboardComercial · carga', () => {
    it('mientras llega el resumen, el tablero es un esqueleto con las pestañas de canal ya a la vista', async () => {
        getContexto.mockResolvedValue(CONTEXTO);
        getResumen.mockReturnValue(new Promise(() => {}));
        montar();

        expect(await screen.findByRole('status', { name: 'Cargando el tablero…' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Inbound' })).toBeInTheDocument();
    });

    it('si el resumen falla, ofrece reintentar y vuelve a pedirlo', async () => {
        getContexto.mockResolvedValue(CONTEXTO);
        getResumen.mockRejectedValueOnce(new Error('red')).mockReturnValue(new Promise(() => {}));
        montar();

        fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

        expect(getResumen).toHaveBeenCalledTimes(2);
        expect(await screen.findByRole('status', { name: 'Cargando el tablero…' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    });

    it('si el contexto falla, ofrece reintentar en vez de quedarse en el esqueleto', async () => {
        getContexto.mockRejectedValueOnce(new Error('red')).mockResolvedValue(CONTEXTO);
        getResumen.mockReturnValue(new Promise(() => {}));
        montar();

        fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

        expect(await screen.findByRole('status', { name: 'Cargando el tablero…' })).toBeInTheDocument();
        expect(getContexto).toHaveBeenCalledTimes(2);
    });
});
