import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Hiring no tiene el dock global: «Cambiar de rol» va en el menú de sesión del dock de Talent, como
// en los demás docks. Sin él, quien tiene varios roles quedaba encerrado en Hiring y solo podía cerrar
// sesión (Mario, operador con hiring como rol adicional, 08/10/2026).

vi.mock('../../../services/api', () => ({
    default: { post: vi.fn(), get: vi.fn(() => Promise.resolve({ data: {} })), put: vi.fn(), delete: vi.fn() },
}));

let usuario = null;
vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: usuario, logout: vi.fn() }),
}));
vi.mock('../../../components/modals/OperatorControls', () => ({ default: () => null }));
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

describe('HiringDashboardPage · cambiar de rol', () => {
    it('quien tiene más roles puede pasar a cualquiera de los otros desde el menú de sesión', () => {
        usuario = MARIO;
        montar();

        const opcion = screen.getByText('Cambiar de rol');
        expect(opcion.dataset.panel.split('|')).toEqual([
            'Operador', 'Closer', 'Administrador', 'Dirección comercial', 'Dirección de marketing',
        ]);
    });

    it('con un solo rol, o simulando a alguien, no hay a dónde cambiar', () => {
        usuario = { id: 9, username: 'Hire', role: 'hiring', roles: ['hiring'] };
        const { unmount } = montar();
        expect(screen.queryByText('Cambiar de rol')).toBeNull();
        unmount();

        usuario = { ...MARIO, is_impersonating: true };
        montar();
        expect(screen.queryByText('Cambiar de rol')).toBeNull();
    });
});
