import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const sesion = vi.hoisted(() => ({ user: null }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: sesion.user }) }));
const portal = vi.hoisted(() => ({ cambiarDeRolEnLaCuenta: vi.fn(() => new Promise(() => {})), cambiarDeCuenta: vi.fn() }));
vi.mock('../../utils/portal', async (orig) => {
    const real = await orig();
    // entrarPorTarjeta llama a los de adentro del módulo: se rehace con los simulados.
    return {
        ...real, ...portal,
        entrarPorTarjeta: (user, t, navegar) => (t.cuenta ? portal.cambiarDeCuenta(t.cuenta)
            : t.rol === user.role ? navegar(t.ruta) : portal.cambiarDeRolEnLaCuenta(t.rol, t.ruta)),
    };
});

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
const tarjetas = () => screen.getAllByRole('button').filter((b) => b.className.includes('el-tarjeta'));

const MARIO = { id: 3, username: 'mario', role: 'operator', roles: ['operator', 'admin'], can_view_finance: true };
const DIR = { id: 7, username: 'dire', role: 'director_comercial', roles: ['director_comercial'] };

describe('El Portal', () => {
    beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

    it('una sola elección: roles, áreas de cada rol y Finances', () => {
        sesion.user = MARIO;
        montar();
        expect(tarjetas().map((t) => t.querySelector('b').textContent))
            .toEqual(['Operador', 'Administración', 'Dirección', 'Agendamiento', 'Finances']);
        // Las áreas dicen de qué rol son.
        expect(tarjetas()[1].querySelector('small').textContent).toBe('Administrador');
        expect(tarjetas()[0].querySelector('small').textContent).toBe('Learnation');
    });

    it('elegir un área del rol con el que está solo navega; la de otro rol lo activa', async () => {
        sesion.user = MARIO;
        const { unmount } = montar();
        fireEvent.click(screen.getByRole('button', { name: /Operador/ }));
        expect(screen.getByTestId('donde').textContent).toBe('/ops/dashboard');
        unmount();

        montar();
        fireEvent.click(screen.getByRole('button', { name: /Finances/ }));
        expect(portal.cambiarDeRolEnLaCuenta).toHaveBeenCalledWith('admin', '/finanzas');
    });

    it('«Entrar directo la próxima vez» guarda la elegida y la próxima entra sola', async () => {
        sesion.user = DIR;
        const { unmount } = montar();
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: /Agendamiento/ }));
        expect(localStorage.getItem('portal_por_defecto_7')).toBe('director_comercial:agendamiento');
        unmount();

        montar();
        await waitFor(() => expect(screen.getByTestId('donde').textContent).toBe('/agendas-v2'));
    });

    it('con ?elegir=1 (desde el menú) se muestra aunque haya una por defecto, y la marca', () => {
        localStorage.setItem('portal_por_defecto_7', 'director_comercial:agendamiento');
        sesion.user = DIR;
        montar('/portal?elegir=1');
        expect(screen.getByText('Por defecto')).toBeTruthy();
        expect(screen.getByRole('checkbox').checked).toBe(true);
        fireEvent.click(screen.getByRole('checkbox'));
        expect(localStorage.getItem('portal_por_defecto_7')).toBeNull();
    });

    it('el número de cada tarjeta entra directo', () => {
        sesion.user = DIR;
        montar();
        fireEvent.keyDown(window, { key: '2' });
        expect(screen.getByTestId('donde').textContent).toBe('/agendas-v2');
    });

    it('sin nada que elegir, o simulando, va a la pantalla de su rol', () => {
        sesion.user = { id: 1, username: 'ana', role: 'closer', roles: ['closer'] };
        const { unmount } = montar();
        expect(screen.getByTestId('donde').textContent).toBe('/closer/deck');
        unmount();
        sesion.user = { ...DIR, is_impersonating: true };
        montar();
        expect(screen.getByTestId('donde').textContent).toBe('/admin/comercial');
    });

    it('el fondo no se elige acá: está en Configuración › Apariencia', () => {
        sesion.user = DIR;
        montar();
        expect(screen.queryByRole('radiogroup', { name: 'Fondo' })).toBeNull();
    });
});
