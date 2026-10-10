import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const sesion = vi.hoisted(() => ({ user: null }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: sesion.user }) }));
const portal = vi.hoisted(() => ({ cambiarDeRolEnLaCuenta: vi.fn(() => new Promise(() => {})), cambiarDeCuenta: vi.fn() }));
vi.mock('../../utils/portal', async (orig) => {
    const real = await orig();
    // entrarPorTarjeta llama a los de adentro del módulo: se rehace con los simulados.
    return {
        ...real, ...portal,
        entrarPorTarjeta: (user, t, navegar) => (t.comun ? navegar(t.ruta) : t.cuenta ? portal.cambiarDeCuenta(t.cuenta, t.ruta)
            : t.rol === user.role ? navegar(t.ruta) : portal.cambiarDeRolEnLaCuenta(t.rol, t.ruta)),
    };
});
vi.mock('./SimularEnPortal', () => ({ default: () => <div data-testid="simular" /> }));

import { PortalProvider, PortalRuta } from '../../sesion/PortalContext';
import { abrirPortal } from '../../sesion/portalBus';
import { abrirSimulacion } from '../../sesion/simulacion';

function Pantalla() {
    const l = useLocation();
    return <span data-testid="donde">{l.pathname}</span>;
}
// La app con el Portal montado encima de lo que sea que se esté viendo.
const montar = (url = '/admin/comercial') => render(
    <MemoryRouter initialEntries={[url]}>
        <PortalProvider>
            <Routes>
                <Route path="/portal" element={<PortalRuta />} />
                <Route path="*" element={<Pantalla />} />
            </Routes>
        </PortalProvider>
    </MemoryRouter>,
);
const abrir = (paso) => act(() => { abrirPortal(paso); });
const tarjetas = () => screen.getAllByRole('button').filter((b) => b.className.includes('el-tarjeta'))
    .map((b) => b.querySelector('b').textContent);
const portalAbierto = () => screen.queryByRole('dialog', { name: 'Portal' });

const MARIO = { id: 3, username: 'mario', role: 'operator', roles: ['operator', 'admin'], can_view_finance: true };
const DIR = { id: 7, username: 'dire', role: 'director_comercial', roles: ['director_comercial'] };
const CLOSER = { id: 1, username: 'ana', role: 'closer', roles: ['closer'] };

describe('El Portal', () => {
    beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

    it('es una pantalla encima de lo que se ve: abrirlo no cambia de ruta, y cerrarlo deja todo igual', () => {
        sesion.user = DIR;
        montar('/admin/comercial');
        expect(portalAbierto()).toBeNull();
        abrir();
        expect(portalAbierto()).toBeTruthy();
        expect(screen.getByTestId('donde').textContent).toBe('/admin/comercial');
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar el Portal' }));
        expect(portalAbierto()).toBeNull();
        expect(screen.getByTestId('donde').textContent).toBe('/admin/comercial');
    });

    it('una sola grilla: cada área con su rol arriba, Finances al final, y después Cortex y Simular', () => {
        sesion.user = MARIO;
        montar();
        abrir();
        expect(screen.getByText('¿A dónde vamos?')).toBeTruthy();
        expect(tarjetas()).toEqual(['Operaciones', 'Administración', 'Ventas', 'Agendamiento', 'Finances', 'Cortex', 'Simular a alguien']);
        const sobre = screen.getAllByRole('button').filter((b) => b.className.includes('el-tarjeta'))
            .map((b) => b.querySelector('small').textContent);
        expect(sobre).toEqual(['Operador', 'Administrador', 'Administrador', 'Administrador', 'Administrador', 'Para todos', 'Equipo']);
    });

    it('con un solo rol: sus áreas y Cortex', () => {
        sesion.user = CLOSER;
        montar('/closer/deck');
        abrir();
        expect(tarjetas()).toEqual(['Cierres', 'Cortex']);
    });

    it('un área del rol de ahora navega y cierra el Portal; la de otro rol cambia de rol', () => {
        sesion.user = MARIO;
        montar('/ops/dashboard');
        abrir();
        fireEvent.click(screen.getByRole('button', { name: /Cortex/ }));
        expect(screen.getByTestId('donde').textContent).toBe('/cortex');
        expect(portalAbierto()).toBeNull();

        abrir();
        fireEvent.click(screen.getByRole('button', { name: /Finances/ }));
        expect(portal.cambiarDeRolEnLaCuenta).toHaveBeenCalledWith('admin', '/finanzas');
    });

    it('«Simular a alguien» elige a un miembro del equipo en el mismo Portal; la «w» abre ahí', () => {
        sesion.user = DIR;
        montar();
        abrir();
        fireEvent.click(screen.getByRole('button', { name: /Simular a alguien/ }));
        expect(screen.getByTestId('simular')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Volver al Portal/ }));
        expect(screen.queryByTestId('simular')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar el Portal' }));

        act(() => { abrirSimulacion(); });
        expect(screen.getByTestId('simular')).toBeTruthy();
    });

    it('quien no simula no tiene Simular, y la «w» no abre nada', () => {
        sesion.user = CLOSER;
        montar();
        act(() => { abrirSimulacion(); });
        expect(portalAbierto()).toBeNull();
    });

    it('Escape vuelve de Simular a la grilla y desde la grilla cierra', () => {
        sesion.user = DIR;
        montar();
        abrir();
        fireEvent.click(screen.getByRole('button', { name: /Simular a alguien/ }));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(tarjetas()).toEqual(['Ventas', 'Agendamiento', 'Cortex', 'Simular a alguien']);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(portalAbierto()).toBeNull();
    });

    it('«Entrar directo la próxima vez» guarda el área elegida, y la marca', () => {
        sesion.user = DIR;
        const { unmount } = montar();
        abrir();
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: /Agendamiento/ }));
        expect(localStorage.getItem('portal_por_defecto_v2_7')).toBe('director_comercial:agendamiento');
        unmount();

        montar();
        abrir();
        expect(screen.getByText('Por defecto')).toBeTruthy();
        expect(screen.getByRole('checkbox').checked).toBe(true);
    });

    it('un link viejo a /portal va a la pantalla de su rol con el Portal abierto', () => {
        sesion.user = CLOSER;
        montar('/portal');
        expect(screen.getByTestId('donde').textContent).toBe('/closer/deck');
        expect(portalAbierto()).toBeTruthy();
    });
});
