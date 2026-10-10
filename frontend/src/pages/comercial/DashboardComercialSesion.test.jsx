import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardComercial from './DashboardComercial';

/**
 * La sesión en el dock del dashboard comercial (30/09/2026): la dirección simula desde el menú del
 * avatar, y ya no tiene "Ir a Ventas" en la cabecera. Desde el 10/10/2026 «Simular a un closer» y «a
 * un setter» son una sola opción, «Simular a alguien» (la hoja de sesion/Simular.jsx), y «Cambiar de
 * área» es «Cambiar de vista» (el Portal). Quién puede simular lo decide el backend; acá se comprueba
 * que la opción se ofrezca a quien corresponde y que abra la simulación.
 */
const simulacion = vi.hoisted(() => ({ abrirSimulacion: vi.fn() }));
vi.mock('../../sesion/simulacion', async (orig) => ({ ...(await orig()), abrirSimulacion: simulacion.abrirSimulacion }));

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
        simulacion.abrirSimulacion.mockClear();
    });

    it('la dirección no tiene "Ir a Ventas", y desde el avatar abre «Simular a alguien»', async () => {
        estado.user = { id: 1, role: 'director_comercial', is_impersonating: false };
        estado.yo = { id: 1, rol: 'director_comercial', nombre: 'Dirección' };
        montar();
        await screen.findByTestId('analizar');

        expect(screen.queryByText(/Ir a Ventas/i)).toBeNull();
        await abrirSesion('Dirección');
        expect(screen.getByText('Dirección comercial')).toBeTruthy();
        expect(screen.getAllByRole('menuitem').map(i => i.textContent))
            .toEqual(['Configuración', 'Playbook', 'Cambiar de vista', 'Simular a alguien', 'Reportar un problema', 'Mis reportes', 'Cerrar sesión']);

        await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Simular a alguien' })); });
        expect(simulacion.abrirSimulacion).toHaveBeenCalledTimes(1);
    });

    it('un closer en "Mis datos" no ve «Simular a alguien», y sigue teniendo la vuelta al mazo', async () => {
        estado.user = { id: 21, role: 'closer', is_impersonating: false };
        estado.yo = { id: 21, rol: 'closer', nombre: 'Marlon Closer' };
        montar();
        await screen.findByTestId('analizar');

        expect(screen.getByRole('link', { name: 'Volver al mazo' })).toBeTruthy();
        await abrirSesion('Marlon Closer');
        expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Configuración', 'Playbook', 'Reportar un problema', 'Mis reportes', 'Cerrar sesión']);
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
            .toEqual(['Configuración', 'Playbook', 'Simular a alguien', 'Reportar un problema', 'Mis reportes', 'Volver a mi sesión', 'Cerrar sesión']);
        fireEvent.click(screen.getByRole('menuitem', { name: 'Volver a mi sesión' }));
        expect(impersonation.revertImpersonation).toHaveBeenCalledTimes(1);
    });
});
