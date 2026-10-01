import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../services/api', () => ({
    default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));

import api from '../../services/api';
import AttributionModal from './AttributionModal';

const VENTA = {
    id: 7, nombre_cliente: 'Lead de prueba', instagram: 'lead_prueba',
    email_vendedor: 'jeancarlo@thelearnation.com', date: '2026-10-01',
};

describe('AttributionModal', () => {
    beforeEach(() => {
        api.get.mockResolvedValue({ data: [] });
    });

    it('va por portal a body con la X en la cabecera, y Escape lo cierra', async () => {
        const onClose = vi.fn();
        const { container } = render(<AttributionModal sale={VENTA} onClose={onClose} onSuccess={vi.fn()} />);
        const dialogo = screen.getByRole('dialog', { name: /Atribución de Agenda para Venta/ });
        expect(container).not.toContainElement(dialogo);
        expect(dialogo).toContainElement(screen.getByRole('button', { name: 'Cerrar' }));
        expect(screen.getByText('Lead de prueba')).toBeInTheDocument();

        await userEvent.setup().keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
