import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
