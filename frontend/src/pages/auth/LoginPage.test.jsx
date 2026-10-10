import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = { login: vi.fn(), entrarConGoogle: vi.fn(), completarLoginGoogle: vi.fn(), cargarEmail: vi.fn() };
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));
vi.mock('../../components/modals/DebugConsole', () => ({ default: () => null }));
const bus = vi.hoisted(() => ({ abrirPortal: vi.fn() }));
vi.mock('../../sesion/portalBus', () => bus);

import LoginPage from './LoginPage';

const montar = (url = '/login') => render(<MemoryRouter initialEntries={[url]}><LoginPage /></MemoryRouter>);

const entrar = async (user) => {
    auth.login.mockResolvedValue(user);
    montar();
    fireEvent.change(screen.getByPlaceholderText('Usuario o email'), { target: { value: 'ana' } });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
};

describe('LoginPage', () => {
    beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

    it('arranca directo en el inicio de sesión', () => {
        montar();
        expect(screen.getByPlaceholderText('Usuario o email')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Entrar con Google' })).toBeTruthy();
    });

    it('con un solo rol y email entra directo', async () => {
        await entrar({ id: 1, username: 'ana', role: 'closer', roles: ['closer'], email: 'a@x.com' });
        await waitFor(() => expect(navigate).toHaveBeenCalled());
    });

    it('sin email lo pide, y «Ahora no» sigue', async () => {
        await entrar({ id: 1, username: 'ana', role: 'closer', roles: ['closer'], email: null });
        fireEvent.click(await screen.findByRole('button', { name: 'Ahora no' }));
        expect(navigate).toHaveBeenCalled();
        expect(auth.cargarEmail).not.toHaveBeenCalled();
    });

    it('con un solo rol entra a su pantalla', async () => {
        await entrar({ id: 1, username: 'ana', role: 'closer', roles: ['closer'], email: 'a@x.com' });
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/closer/deck?step=confirmations'));
        expect(bus.abrirPortal).not.toHaveBeenCalled();
    });

    it('con varios roles entra a la pantalla de su rol con el Portal abierto encima', async () => {
        await entrar({ id: 1, username: 'ana', role: 'operator', roles: ['operator', 'closer'], email: 'a@x.com' });
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/ops/dashboard'));
        expect(bus.abrirPortal).toHaveBeenCalled();
    });

    it('un solo rol que además ve Finances también elige en el Portal', async () => {
        await entrar({ id: 4, username: 'marlon', role: 'director_comercial', roles: ['director_comercial'], can_view_finance: true, email: 'm@x.com' });
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin/comercial'));
        expect(bus.abrirPortal).toHaveBeenCalled();
    });

    it('con una tarjeta por defecto del mismo rol entra directo ahí', async () => {
        localStorage.setItem('portal_por_defecto_v2_4', 'director_comercial:agendamiento');
        await entrar({ id: 4, username: 'marlon', role: 'director_comercial', roles: ['director_comercial'], email: 'm@x.com' });
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/agendas-v2'));
    });

    it('la vuelta de Google sin cuenta muestra el motivo', () => {
        montar('/login?google=sin_cuenta');
        expect(screen.getByRole('alert').textContent).toMatch(/Ninguna cuenta tiene ese email/);
    });

    it('la vuelta de Google ok canjea la sesión', async () => {
        auth.completarLoginGoogle.mockResolvedValue({ id: 1, username: 'ana', role: 'closer', roles: ['closer'], email: 'a@x.com' });
        montar('/login?google=ok');
        await waitFor(() => expect(navigate).toHaveBeenCalled());
    });
});
