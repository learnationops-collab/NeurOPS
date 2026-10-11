import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../services/api', () => ({
    default: { get: vi.fn(), post: vi.fn() },
}));

import api from '../../../services/api';
import AgendasBulkEditModal from './AgendasBulkEditModal';

const montar = () => {
    const onClose = vi.fn();
    const { container } = render(
        <AgendasBulkEditModal selectedIds={[1, 2]} totalFiltradas={7} filterParams={{}}
            filtrosActivos={[]} onClose={onClose} onDone={vi.fn()} />,
    );
    return { onClose, container };
};

describe('AgendasBulkEditModal', () => {
    beforeEach(() => {
        api.get.mockResolvedValue({ data: { fuentes: ['workshop'], closers: [], estados: [] } });
    });

    // Call Confirmer se retiró el 10/10/2026: los closers confirman sus propias agendas.
    it('ofrece Fuente, Closer y Estado pre call, y ya no Call Confirmer', async () => {
        montar();
        await screen.findByRole('button', { name: 'workshop' });
        for (const campo of ['Fuente', 'Closer', 'Estado pre call']) {
            expect(screen.getByRole('button', { name: campo })).toBeInTheDocument();
        }
        expect(screen.queryByRole('button', { name: 'Call Confirmer' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Sin asignar' })).not.toBeInTheDocument();
    });

    it('va en el cascarón compartido: portal a body, con Cancelar y Aplicar en el pie', async () => {
        const { container } = montar();
        const dialogo = screen.getByRole('dialog', { name: 'Modificación Masiva' });
        expect(container).not.toContainElement(dialogo);
        expect(dialogo).toContainElement(screen.getByRole('button', { name: 'Cancelar' }));
        expect(dialogo).toContainElement(screen.getByRole('button', { name: /Aplicar a 2/ }));
        expect(await screen.findByRole('button', { name: 'workshop' })).toBeInTheDocument();
    });

    it('Escape lo cierra', async () => {
        const { onClose } = montar();
        await screen.findByRole('button', { name: 'workshop' });
        await userEvent.setup().keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
