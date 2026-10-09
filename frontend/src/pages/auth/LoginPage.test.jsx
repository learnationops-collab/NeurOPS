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
            <Route path="/finanzas" element={<p>finances</p>} />
            <Route path="*" element={<p>pantalla</p>} />
        </Routes>
    </MemoryRouter>,
);

// Cambia de rol en la cuenta: se mira a dónde manda la página entera.
const conLocation = async (fn) => {
    const original = window.location;
    delete window.location;
    window.location = { href: '' };
    try {
        await fn();
    } finally {
        window.location = original;
    }
};

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

/**
 * La tarjeta «Finances» (08/10/2026, se lee «Learnation Finances»): Finanzas y Payroll en /finanzas,
 * aparte del dashboard de la dirección comercial. Es para admin o dirección comercial con «ver finanzas».
 */
describe('LoginPage · la tarjeta Finances', () => {
    beforeEach(() => { login.mockReset(); post.mockReset(); localStorage.clear(); sessionStorage.clear(); });

    it('con «ver finanzas» va al final, se lee «Learnation Finances», y entra con admin a /finanzas', async () => {
        login.mockResolvedValue({ ...MARIO, roles: ['operator', 'admin'], can_view_finance: true });
        post.mockResolvedValue({ data: { token: 'tk', user: { ...MARIO, role: 'admin', roles: ['operator', 'admin'] } } });
        montar();
        await entrar();

        expect(tarjetas()).toEqual(['Operador', 'Administrador', 'Finances']);
        expect(screen.getByRole('button', { name: /Finances/ }).querySelector('small').textContent).toBe('Learnation');
        await conLocation(async () => {
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Finances/ })); });
            expect(post).toHaveBeenCalledWith('/auth/switch-role', { role: 'admin', isolated: false });
            expect(window.location.href).toBe('/finanzas');
        });
    });

    it('si ya entró con el rol que la habilita, va directo a /finanzas sin cambiar de rol', async () => {
        login.mockResolvedValue({ ...MARIO, role: 'admin', roles: ['admin', 'closer'], can_view_finance: true });
        montar();
        await entrar();

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Finances/ })); });

        expect(screen.getByText('finances')).toBeTruthy();
        expect(post).not.toHaveBeenCalled();
    });

    it('con un solo rol y «ver finanzas» elige igual: la dirección comercial o Finances', async () => {
        login.mockResolvedValue({ id: 4, username: 'Marlon', role: 'director_comercial', roles: ['director_comercial'], can_view_finance: true, cuentas_vinculadas: [] });
        montar();
        await entrar();

        expect(tarjetas()).toEqual(['Dirección comercial', 'Finances']);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Dirección comercial/ })); });
        expect(screen.getByText('pantalla')).toBeTruthy();
    });

    it('sin «ver finanzas» no hay tarjeta', async () => {
        login.mockResolvedValue({ ...MARIO, roles: ['operator', 'admin'] });
        montar();
        await entrar();
        expect(tarjetas()).toEqual(['Operador', 'Administrador']);
        expect(screen.queryByRole('button', { name: /Finances/ })).toBeNull();
    });

    it('«ver finanzas» con un rol que no la usa no cambia nada', async () => {
        login.mockResolvedValue({ id: 9, username: 'Cata', role: 'closer', roles: ['closer'], can_view_finance: true, cuentas_vinculadas: [] });
        montar();
        await entrar();

        expect(screen.getByText('pantalla')).toBeTruthy();
        expect(screen.queryByText(/Seleccioná tu rol/)).toBeNull();
    });
});
