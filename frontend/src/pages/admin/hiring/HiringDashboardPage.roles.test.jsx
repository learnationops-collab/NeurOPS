import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Hiring no tiene el dock global: «Portal» (con todos sus roles y áreas) va en el menú de sesión del
// dock de Talent, como en los demás docks. Sin una salida, quien tiene varios roles quedaba encerrado en
// Hiring y solo podía cerrar sesión (Mario, operador con hiring como rol adicional, 08/10/2026).

vi.mock('../../../services/api', () => ({
    default: { post: vi.fn(), get: vi.fn(() => Promise.resolve({ data: {} })), put: vi.fn(), delete: vi.fn() },
}));

let usuario = null;
vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: usuario, logout: vi.fn() }),
}));
vi.mock('./components/HiringStats', () => ({ default: () => null }));
vi.mock('./components/forms/HiringForms', () => ({ default: () => null }));
// El menú real abre en un portal; acá alcanza con ver qué opciones y paneles recibe.
vi.mock('../../comercial/components/MenuSesion', () => ({
    default: ({ grupos }) => (
        <ul>
            {grupos.flat().map((op) => (
                <li key={op.id} data-panel={op.panel ? op.panel.cargar().map((o) => o.label).join('|') : undefined}>
                    {op.label}
                </li>
            ))}
        </ul>
    ),
}));

import HiringDashboardPage from './HiringDashboardPage';

const MARIO = {
    id: 3, username: 'Mario', role: 'hiring',
    roles: ['operator', 'closer', 'admin', 'hiring', 'director_comercial', 'director_marketing'],
};

const montar = () => render(<MemoryRouter><HiringDashboardPage /></MemoryRouter>);

describe('HiringDashboardPage · el Portal', () => {
    it('el menú de sesión lleva al Portal, simulando o no', () => {
        usuario = MARIO;
        const { unmount } = montar();
        expect(screen.getByText('Portal')).toBeTruthy();
        expect(screen.queryByText('Cambiar de rol')).toBeNull();
        unmount();

        usuario = { ...MARIO, is_impersonating: true };
        montar();
        expect(screen.getByText('Portal')).toBeTruthy();
    });
});
