import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../services/api', () => ({
    default: {
        get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
    },
}));

import api from '../../../services/api';
import TeamManagementPage from './TeamManagementPage';

const MARIO = {
    id: 3, username: 'Mario Opera', email: 'mario@thelearnation.com', role: 'operator',
    is_active: true, can_view_finance: false, two_chat_number: '', timezone: 'America/La_Paz',
};

describe('TeamManagementPage · modal de miembro', () => {
    beforeEach(() => {
        api.get.mockResolvedValue({ data: [MARIO] });
        api.put.mockResolvedValue({ data: {} });
    });

    it('editar abre el modal en body, con la X, Cancelar y Guardar a mano', async () => {
        const { container } = render(<TeamManagementPage />);
        const usuario = userEvent.setup();
        await usuario.click(await screen.findByTitle('Editar'));

        const dialogo = screen.getByRole('dialog', { name: 'Editar Miembro' });
        // Fuera del contenedor de la página: un `space-y-10` ya no le puede poner margen al velo.
        expect(container).not.toContainElement(dialogo);
        expect(dialogo).toContainElement(screen.getByRole('button', { name: 'Cerrar' }));
        expect(dialogo).toContainElement(screen.getByRole('button', { name: 'Cancelar' }));
        expect(dialogo).toContainElement(screen.getByRole('button', { name: /Guardar Cambios/ }));
        expect(screen.getByDisplayValue('Mario Opera')).toBeInTheDocument();
    });

    it('Escape lo cierra sin guardar', async () => {
        render(<TeamManagementPage />);
        const usuario = userEvent.setup();
        await usuario.click(await screen.findByTitle('Editar'));
        await usuario.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(api.put).not.toHaveBeenCalled();
    });

    it('Guardar del pie envía el mismo PUT de siempre y cierra', async () => {
        render(<TeamManagementPage />);
        const usuario = userEvent.setup();
        await usuario.click(await screen.findByTitle('Editar'));
        await usuario.click(screen.getByRole('button', { name: /Guardar Cambios/ }));

        expect(api.put).toHaveBeenCalledWith('/admin/users/3', expect.objectContaining({
            username: 'Mario Opera', email: 'mario@thelearnation.com', role: 'operator', password: '',
        }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

describe('TeamManagementPage · pestañas por rol', () => {
    const EQUIPO = [
        { ...MARIO, roles: ['operator', 'closer'] },
        { id: 7, username: 'Ana', email: 'ana@x.com', role: 'setter', roles: ['setter'], is_active: true },
        { id: 8, username: 'Beto', email: 'beto@x.com', role: 'closer', roles: ['closer'], is_active: true },
    ];

    beforeEach(() => { api.get.mockResolvedValue({ data: EQUIPO }); });

    it('el filtro es una fila de pestañas con la cuenta de cada rol, no una columna de botones', async () => {
        render(<TeamManagementPage embebido />);

        const pestanas = await screen.findByRole('tablist', { name: 'Filtrar el equipo por rol' });
        expect(screen.getByRole('tab', { name: /Todos/ })).toHaveTextContent('3');
        expect(screen.getByRole('tab', { name: /Closers/ })).toHaveTextContent('2');
        expect(screen.getByRole('tab', { name: /Setters/ })).toHaveTextContent('1');
        expect(pestanas).toBeInTheDocument();
        // Embebido: el título de la página lo pone la pantalla que lo contiene.
        expect(screen.queryByRole('heading', { name: /Gestión de Equipo/ })).not.toBeInTheDocument();
    });

    it('una persona con varios roles aparece en la pestaña de cada uno', async () => {
        render(<TeamManagementPage />);
        const usuario = userEvent.setup();
        await usuario.click(await screen.findByRole('tab', { name: /Closers/ }));

        expect(screen.getByText('Mario Opera')).toBeInTheDocument();
        expect(screen.getByText('Beto')).toBeInTheDocument();
        // Las tarjetas que salen se animan antes de irse del DOM.
        await waitFor(() => expect(screen.queryByText('Ana')).not.toBeInTheDocument());
    });
});
