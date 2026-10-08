import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hiring no tiene el dock global: «Pasar a <rol>» va en el menú de sesión del dock de Talent. Es la
// única forma de volver a otro rol de la cuenta sin cerrar sesión (Mario, operador con hiring como
// rol adicional, 08/10/2026).

const post = vi.fn();
vi.mock('../../../services/api', () => ({
    default: { post: (...a) => post(...a), get: vi.fn(() => Promise.resolve({ data: {} })), put: vi.fn(), delete: vi.fn() },
}));

let usuario = null;
vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: usuario, logout: vi.fn() }),
}));
vi.mock('../../../components/modals/OperatorControls', () => ({ default: () => null }));
vi.mock('./components/HiringStats', () => ({ default: () => null }));
vi.mock('./components/forms/HiringForms', () => ({ default: () => null }));

import HiringDashboardPage from './HiringDashboardPage';

const MARIO = {
    id: 3, username: 'Mario', role: 'hiring',
    roles: ['operator', 'closer', 'admin', 'hiring', 'director_comercial', 'director_marketing'],
};

const montar = () => render(<MemoryRouter><HiringDashboardPage /></MemoryRouter>);
const abrirSesion = (nombre) => fireEvent.click(screen.getByRole('button', { name: `Tu sesión: ${nombre}` }));

describe('HiringDashboardPage · cambiar de rol', () => {
    beforeEach(() => { post.mockReset(); localStorage.clear(); sessionStorage.clear(); });

    it('quien tiene más roles los ve todos menos el actual', () => {
        usuario = MARIO;
        montar();
        abrirSesion('Mario');
        const pasar = screen.getAllByRole('menuitem').map((b) => b.textContent).filter((t) => t.startsWith('Pasar a'));
        expect(pasar).toEqual([
            'Pasar a Operador', 'Pasar a Closer', 'Pasar a Administrador',
            'Pasar a Dirección comercial', 'Pasar a Dirección de marketing',
        ]);
    });

    it('«Pasar a Operador» cambia el rol de la cuenta y entra a su pantalla', async () => {
        usuario = MARIO;
        post.mockResolvedValue({ data: { token: 'tk', user: { ...MARIO, role: 'operator' } } });
        const original = window.location;
        delete window.location;
        window.location = { href: '' };
        try {
            montar();
            abrirSesion('Mario');
            fireEvent.click(screen.getByRole('menuitem', { name: 'Pasar a Operador' }));
            await waitFor(() => expect(window.location.href).toBe('/ops/dashboard'));
            expect(post).toHaveBeenCalledWith('/auth/switch-role', { role: 'operator', isolated: false });
        } finally {
            window.location = original;
        }
    });

    it('con un solo rol, o simulando a alguien, no hay a dónde cambiar', () => {
        usuario = { id: 9, username: 'Hire', role: 'hiring', roles: ['hiring'] };
        const { unmount } = montar();
        abrirSesion('Hire');
        expect(screen.queryByRole('menuitem', { name: /Pasar a/ })).toBeNull();
        unmount();

        usuario = { ...MARIO, is_impersonating: true };
        montar();
        abrirSesion('Mario');
        expect(screen.queryByRole('menuitem', { name: /Pasar a/ })).toBeNull();
    });
});
