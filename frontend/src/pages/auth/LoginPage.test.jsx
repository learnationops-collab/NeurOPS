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
