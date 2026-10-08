import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = { login: vi.fn(), entrarConGoogle: vi.fn(), completarLoginGoogle: vi.fn(), cargarEmail: vi.fn() };
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));
vi.mock('../../utils/cuentasVinculadas', async (orig) => ({ ...(await orig()), cambiarDeRolEnLaCuenta: vi.fn() }));
vi.mock('../../components/modals/DebugConsole', () => ({ default: () => null }));

import LoginPage from './LoginPage';
import { cambiarDeRolEnLaCuenta } from '../../utils/cuentasVinculadas';

const montar = (url = '/login') => render(<MemoryRouter initialEntries={[url]}><LoginPage /></MemoryRouter>);

const entrar = async (user) => {
    auth.login.mockResolvedValue(user);
    montar();
    fireEvent.change(screen.getByPlaceholderText('Usuario o email'), { target: { value: 'ana' } });
    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
};

describe('LoginPage', () => {
    beforeEach(() => vi.clearAllMocks());

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

    it('con varios roles elige con cuál entra', async () => {
        await entrar({ id: 1, username: 'ana', role: 'operator', roles: ['operator', 'closer'], email: 'a@x.com' });
        fireEvent.click(await screen.findByRole('button', { name: /closer/i }));
        await waitFor(() => expect(cambiarDeRolEnLaCuenta).toHaveBeenCalledWith('closer'));
        expect(navigate).not.toHaveBeenCalled();
    });

    it('con «ver finanzas» suma la tarjeta Finanzas: entra con admin y va a /finanzas', async () => {
        await entrar({ id: 1, username: 'mario', role: 'operator', roles: ['operator', 'admin'], can_view_finance: true, email: 'm@x.com' });
        fireEvent.click(await screen.findByRole('button', { name: /Finanzas/ }));
        await waitFor(() => expect(cambiarDeRolEnLaCuenta).toHaveBeenCalledWith('admin', '/finanzas'));
    });

    it('si ya entró con el rol de Finanzas, va directo a /finanzas', async () => {
        await entrar({ id: 1, username: 'mario', role: 'admin', roles: ['admin', 'closer'], can_view_finance: true, email: 'm@x.com' });
        fireEvent.click(await screen.findByRole('button', { name: /Finanzas/ }));
        expect(navigate).toHaveBeenCalledWith('/finanzas');
        expect(cambiarDeRolEnLaCuenta).not.toHaveBeenCalled();
    });

    it('sin «ver finanzas» no hay tarjeta Finanzas', async () => {
        await entrar({ id: 1, username: 'mario', role: 'operator', roles: ['operator', 'admin'], email: 'm@x.com' });
        await screen.findByRole('button', { name: /Administrador/ });
        expect(screen.queryByRole('button', { name: /Finanzas/ })).toBeNull();
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
