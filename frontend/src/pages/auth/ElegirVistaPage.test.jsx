import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// El hub de vistas, /vistas (08/10/2026): la elección del login con la sesión ya iniciada. Elegir
// funciona igual que al entrar; sin nada que elegir, o simulando, va a la pantalla del rol.

const post = vi.fn();
vi.mock('../../services/api', () => ({ default: { post: (...a) => post(...a), get: vi.fn() } }));

const estado = vi.hoisted(() => ({ user: null }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: estado.user }) }));

import ElegirVistaPage from './ElegirVistaPage';

const montar = (entradas = ['/vistas'], indice = entradas.length - 1) => render(
    <MemoryRouter initialEntries={entradas} initialIndex={indice}>
        <Routes>
            <Route path="/vistas" element={<ElegirVistaPage />} />
            <Route path="/finanzas" element={<p>finances</p>} />
            <Route path="/admin/comercial" element={<p>comercial</p>} />
            <Route path="*" element={<p>otra pantalla</p>} />
        </Routes>
    </MemoryRouter>,
);

const tarjetas = () => screen.getAllByRole('button').map((b) => b.querySelector('b')?.textContent).filter(Boolean);
const direccion = (extra = {}) => ({
    id: 4, username: 'Marlon', role: 'director_comercial', roles: ['director_comercial'], cuentas_vinculadas: [], ...extra,
});

describe('ElegirVistaPage · el hub de vistas', () => {
    beforeEach(() => { post.mockReset(); estado.user = null; });

    it('la dirección comercial con «ver finanzas» ve su tarjeta y la de Finances, que va a /finanzas', async () => {
        estado.user = direccion({ can_view_finance: true });
        montar();

        expect(screen.getByText('Elegí a qué vista entrar.')).toBeTruthy();
        expect(tarjetas()).toEqual(['Dirección comercial', 'Finances']);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Finances/ })); });

        expect(screen.getByText('finances')).toBeTruthy();
        expect(post).not.toHaveBeenCalled();
    });

    it('la dirección comercial sin «ver finanzas» no tiene la tarjeta Finances', () => {
        estado.user = direccion({ roles: ['director_comercial', 'closer'], can_view_finance: false });
        montar();

        expect(tarjetas()).toEqual(['Dirección comercial', 'Closer']);
        expect(screen.queryByRole('button', { name: /Finances/ })).toBeNull();
    });

    it('con un solo rol y sin «ver finanzas» no hay nada que elegir: va a la pantalla del rol', () => {
        estado.user = direccion({ can_view_finance: false });
        montar();

        expect(screen.getByText('comercial')).toBeTruthy();
    });

    it('simulando a otro tampoco hay hub', () => {
        estado.user = direccion({ roles: ['director_comercial', 'closer'], can_view_finance: true, is_impersonating: true });
        montar();

        expect(screen.getByText('comercial')).toBeTruthy();
    });

    it('elegir otro rol lo activa en la cuenta y entra a su pantalla, como al iniciar sesión', async () => {
        estado.user = direccion({ roles: ['director_comercial', 'closer'], can_view_finance: true });
        post.mockResolvedValue({ data: { token: 'tk', user: { ...estado.user, role: 'closer' } } });
        const original = window.location;
        delete window.location;
        window.location = { href: '' };
        try {
            montar();
            await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Closer/ })); });

            expect(post).toHaveBeenCalledWith('/auth/switch-role', { role: 'closer', isolated: false });
            expect(window.location.href).toBe('/closer/deck?step=confirmations');
        } finally {
            window.location = original;
        }
    });

    it('«Volver» deja todo como estaba: vuelve a la pantalla de la que vino', async () => {
        estado.user = direccion({ can_view_finance: true });
        montar(['/finanzas', '/vistas']);

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Volver' })); });
        expect(screen.getByText('finances')).toBeTruthy();
    });
});
