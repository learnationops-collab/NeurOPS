import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardComercial from './DashboardComercial';

/**
 * La sesión en el dock del dashboard comercial (30/09/2026): la dirección simula a cualquier closer
 * activo desde el menú del avatar, y ya no tiene "Ir a Ventas" en la cabecera. Quién puede simular
 * lo decide el backend; acá se comprueba que la opción se ofrezca a quien corresponde y que elegir
 * un closer lo simule a él.
 */

const estado = vi.hoisted(() => ({ user: null, yo: null }));
const api = vi.hoisted(() => ({ get: vi.fn() }));
const impersonation = vi.hoisted(() => ({ simularA: vi.fn(() => Promise.resolve()), revertImpersonation: vi.fn() }));

vi.mock('./comercialApi', () => ({
    getContexto: vi.fn(() => Promise.resolve({
        puede_elegir_equipo: estado.yo.rol === 'director_comercial', puede_reportar: estado.yo.rol === 'director_comercial',
        rol: 'closers', yo: estado.yo, miembros: [], estados: [],
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
    useAuth: () => ({ user: estado.user, logout: vi.fn() }),
}));
vi.mock('../../services/api', () => ({ default: api }));
vi.mock('../../utils/impersonation', () => impersonation);
vi.mock('./components/Analizar', () => ({ default: () => <div data-testid="analizar" /> }));

const montar = () => render(
    <MemoryRouter initialEntries={['/admin/comercial']}>
        <DashboardComercial />
    </MemoryRouter>,
);

const abrirSesion = async (nombre) => {
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: `Tu sesión: ${nombre}` })); });
};

describe('DashboardComercial · la sesión en el dock', () => {
    beforeEach(() => {
        api.get.mockReset();
        impersonation.simularA.mockClear();
    });

    it('la dirección no tiene "Ir a Ventas", y desde el avatar simula a un closer activo', async () => {
        estado.user = { id: 1, role: 'director_comercial', is_impersonating: false };
        estado.yo = { id: 1, rol: 'director_comercial', nombre: 'Dirección' };
        api.get.mockResolvedValue({ data: { closers: [{ id: 21, username: 'Marlon Closer' }, { id: 22, username: 'Jean Carlo' }] } });
        montar();
        await screen.findByTestId('analizar');

        expect(screen.queryByText(/Ir a Ventas/i)).toBeNull();
        await abrirSesion('Dirección');
        expect(screen.getByText('Dirección comercial')).toBeTruthy();
        expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Cambiar de área', 'Simular a un closer', 'Cerrar sesión']);

        await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Simular a un closer' })); });
        expect(api.get).toHaveBeenCalledWith('/auth/impersonate/closers');
        await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Marlon Closer' })); });
        expect(impersonation.simularA).toHaveBeenCalledWith(21);
    });

    it('un closer en "Mis datos" no ve "Simular a un closer", y sigue teniendo la vuelta al mazo', async () => {
        estado.user = { id: 21, role: 'closer', is_impersonating: false };
        estado.yo = { id: 21, rol: 'closer', nombre: 'Marlon Closer' };
        montar();
        await screen.findByTestId('analizar');

        expect(screen.getByRole('link', { name: 'Volver al mazo' })).toBeTruthy();
        await abrirSesion('Marlon Closer');
        expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Cerrar sesión']);
        expect(api.get).not.toHaveBeenCalled();
    });

    it('la dirección simulando a un closer puede pasar a otro y volver a su sesión', async () => {
        estado.user = { id: 21, role: 'closer', is_impersonating: true, original_user_role: 'director_comercial' };
        estado.yo = { id: 21, rol: 'closer', nombre: 'Marlon Closer' };
        montar();
        await screen.findByTestId('analizar');

        await abrirSesion('Marlon Closer');
        expect(screen.getByText('Closer · simulación')).toBeTruthy();
        expect(screen.getAllByRole('menuitem').map(i => i.textContent))
            .toEqual(['Simular a un closer', 'Volver a mi sesión', 'Cerrar sesión']);
        fireEvent.click(screen.getByRole('menuitem', { name: 'Volver a mi sesión' }));
        expect(impersonation.revertImpersonation).toHaveBeenCalledTimes(1);
    });
});
