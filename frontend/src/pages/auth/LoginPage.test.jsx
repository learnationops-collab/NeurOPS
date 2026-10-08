import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Al iniciar sesión, quien tiene varios roles elige con cuál entra (la pantalla de elección de develop);
// con uno solo entra directo a su pantalla.

const post = vi.fn();
vi.mock('../../services/api', () => ({ default: { post: (...a) => post(...a), get: vi.fn() } }));

const login = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ login }) }));
vi.mock('../../components/modals/DebugConsole', () => ({ default: () => null }));

import LoginPage from './LoginPage';

const MARIO = { id: 3, username: 'Mario Bühler', role: 'operator', roles: ['operator', 'closer', 'hiring'], cuentas_vinculadas: [] };

const montar = () => render(
    <MemoryRouter initialEntries={['/login']}>
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<p>pantalla</p>} />
        </Routes>
    </MemoryRouter>,
);

const entrar = async () => {
    fireEvent.change(screen.getByPlaceholderText(/usuario/i), { target: { value: 'mario' } });
    fireEvent.change(screen.getByPlaceholderText(/•|contraseña|password/i), { target: { value: 'secreto' } });
    await act(async () => { fireEvent.submit(screen.getByPlaceholderText(/usuario/i).closest('form')); });
};

const tarjetas = () => screen.getAllByRole('button').map((b) => b.querySelector('b')?.textContent).filter(Boolean);

describe('LoginPage · elegir rol al entrar', () => {
    beforeEach(() => { login.mockReset(); post.mockReset(); localStorage.clear(); sessionStorage.clear(); });

    it('con varios roles muestra una tarjeta por rol', async () => {
        login.mockResolvedValue(MARIO);
        montar();
        await entrar();

        expect(screen.getByText(/Seleccioná tu rol/)).toBeTruthy();
        expect(tarjetas()).toEqual(['Operador', 'Closer', 'Hiring']);
    });

    it('elegir el rol principal entra a su pantalla sin cambiar de rol', async () => {
        login.mockResolvedValue(MARIO);
        montar();
        await entrar();

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Operador/ })); });

        expect(screen.getByText('pantalla')).toBeTruthy();
        expect(post).not.toHaveBeenCalled();
    });

    it('elegir otro rol lo activa en la cuenta y entra a la pantalla de ese rol', async () => {
        login.mockResolvedValue(MARIO);
        post.mockResolvedValue({ data: { token: 'tk', user: { ...MARIO, role: 'hiring' } } });
        const original = window.location;
        delete window.location;
        window.location = { href: '' };
        try {
            montar();
            await entrar();
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Hiring/ })); });

            expect(post).toHaveBeenCalledWith('/auth/switch-role', { role: 'hiring', isolated: false });
            expect(window.location.href).toBe('/admin/hiring');
        } finally {
            window.location = original;
        }
    });

    it('con un solo rol entra directo', async () => {
        login.mockResolvedValue({ id: 9, username: 'Cata', role: 'closer', roles: ['closer'], cuentas_vinculadas: [] });
        montar();
        await entrar();

        expect(screen.getByText('pantalla')).toBeTruthy();
        expect(screen.queryByText(/Seleccioná tu rol/)).toBeNull();
    });
});
