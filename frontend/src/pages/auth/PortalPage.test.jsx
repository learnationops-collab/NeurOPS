import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const sesion = vi.hoisted(() => ({ user: null }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: sesion.user }) }));
const portal = vi.hoisted(() => ({ cambiarDeRolEnLaCuenta: vi.fn(() => new Promise(() => {})), cambiarDeCuenta: vi.fn() }));
vi.mock('../../utils/portal', async (orig) => {
    const real = await orig();
    // entrarPorTarjeta llama a los de adentro del módulo: se rehace con los simulados.
    return {
        ...real, ...portal,
        entrarPorTarjeta: (user, t, navegar) => (t.cuenta ? portal.cambiarDeCuenta(t.cuenta, t.ruta)
            : t.rol === user.role ? navegar(t.ruta) : portal.cambiarDeRolEnLaCuenta(t.rol, t.ruta)),
    };
});
vi.mock('./SimularEnPortal', () => ({ default: () => <div data-testid="simular" /> }));

import PortalPage from './PortalPage';

function Donde() {
    const l = useLocation();
    return <span data-testid="donde">{l.pathname}</span>;
}
const montar = (url = '/portal') => render(
    <MemoryRouter initialEntries={[url]}>
        <Routes>
            <Route path="/portal" element={<PortalPage />} />
            <Route path="*" element={<Donde />} />
        </Routes>
    </MemoryRouter>,
);
const grupo = (nombre) => screen.getByRole('region', { name: nombre });
const titulos = (nombre) => within(grupo(nombre)).getAllByRole('button').map((b) => b.querySelector('b').textContent);

const MARIO = { id: 3, username: 'mario', role: 'operator', roles: ['operator', 'admin'], can_view_finance: true };
const DIR = { id: 7, username: 'dire', role: 'director_comercial', roles: ['director_comercial'] };
const CLOSER = { id: 1, username: 'ana', role: 'closer', roles: ['closer'] };

describe('El Portal', () => {
    beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

    it('separa roles de áreas: un grupo por rol, con sus áreas como tarjetas', () => {
        sesion.user = MARIO;
        montar();
        expect(titulos('Operador')).toEqual(['Operaciones']);
        expect(titulos('Administrador')).toEqual(['Administración', 'Ventas', 'Agendamiento', 'Finances']);
        expect(within(grupo('Administrador')).getByText('Tu rol · 4 áreas')).toBeTruthy();
        expect(within(grupo('Administrador')).getAllByText('Área')).toHaveLength(4);
    });

    it('aparte, las herramientas: Cortex para todos y Simular para quien puede', () => {
        sesion.user = MARIO;
        const { unmount } = montar();
        expect(titulos('Herramientas')).toEqual(['Cortex', 'Simular a alguien']);
        unmount();

        sesion.user = CLOSER;
        montar('/portal?elegir=1');
        expect(titulos('Herramientas')).toEqual(['Cortex']);
        fireEvent.click(screen.getByRole('button', { name: /Cortex/ }));
        expect(screen.getByTestId('donde').textContent).toBe('/cortex');
    });

    it('«Simular a alguien» elige a un miembro del equipo en el mismo Portal', () => {
        sesion.user = DIR;
        montar();
        fireEvent.click(screen.getByRole('button', { name: /Simular a alguien/ }));
        expect(screen.getByRole('heading', { name: 'Simular a alguien' })).toBeTruthy();
        expect(screen.getByTestId('simular')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Volver al Portal' }));
        expect(screen.queryByTestId('simular')).toBeNull();
    });

    it('elegir un área del rol con el que está solo navega; la de otro rol lo activa', () => {
        sesion.user = MARIO;
        const { unmount } = montar();
        fireEvent.click(screen.getByRole('button', { name: /Operaciones/ }));
        expect(screen.getByTestId('donde').textContent).toBe('/ops/dashboard');
        unmount();

        montar();
        fireEvent.click(screen.getByRole('button', { name: /Finances/ }));
        expect(portal.cambiarDeRolEnLaCuenta).toHaveBeenCalledWith('admin', '/finanzas');
    });

    it('«Entrar directo la próxima vez» guarda el área y la próxima entra sola', async () => {
        sesion.user = DIR;
        const { unmount } = montar();
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: /Agendamiento/ }));
        expect(localStorage.getItem('portal_por_defecto_v2_7')).toBe('director_comercial:agendamiento');
        unmount();

        montar();
        await waitFor(() => expect(screen.getByTestId('donde').textContent).toBe('/agendas-v2'));
    });

    it('desde el menú (?elegir=1) se muestra aunque haya una por defecto, y la marca', () => {
        localStorage.setItem('portal_por_defecto_v2_7', 'director_comercial:agendamiento');
        sesion.user = DIR;
        montar('/portal?elegir=1');
        expect(screen.getByText('Por defecto')).toBeTruthy();
        expect(screen.getByRole('checkbox').checked).toBe(true);
        fireEvent.click(screen.getByRole('checkbox'));
        expect(localStorage.getItem('portal_por_defecto_v2_7')).toBeNull();
    });

    it('el número de cada tarjeta entra directo', () => {
        sesion.user = DIR;
        montar();
        fireEvent.keyDown(window, { key: '2' });
        expect(screen.getByTestId('donde').textContent).toBe('/agendas-v2');
    });

    it('al entrar sin nada que elegir va a su área; desde el menú, el Portal está igual', () => {
        sesion.user = CLOSER;
        const { unmount } = montar();
        expect(screen.getByTestId('donde').textContent).toBe('/closer/deck');
        unmount();
        montar('/portal?elegir=1');
        expect(titulos('Closer')).toEqual(['Cierres']);
        expect(screen.queryByRole('checkbox')).toBeNull();
    });

    it('el fondo no se elige acá: está en Configuración › Apariencia', () => {
        sesion.user = DIR;
        montar();
        expect(screen.queryByRole('radiogroup', { name: 'Fondo' })).toBeNull();
    });
});
