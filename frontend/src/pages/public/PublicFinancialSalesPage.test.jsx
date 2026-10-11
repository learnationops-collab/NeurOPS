import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
    default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../../services/api';
import PublicFinancialSalesPage from './PublicFinancialSalesPage';

// El Registro de Ventas (pestaña de /admin/ventas) perdió el 10/10/2026 lo que no funcionaba: el
// botón «Registrar Venta» (llevaba a /closer/sales/new, una ruta solo de closer, y al admin lo
// devolvía a su inicio), el modal de alta que nada abría y la sincronización con la hoja sin botón.
describe('PublicFinancialSalesPage', () => {
    beforeEach(() => {
        api.get.mockImplementation((url) => Promise.resolve(
            url === '/public/financial-sales/transferido-a'
                ? { data: [] }
                : { data: { data: [], has_more: false, total: 0 } },
        ));
    });

    it('no ofrece registrar una venta ni sincroniza con la hoja', async () => {
        render(<MemoryRouter><PublicFinancialSalesPage /></MemoryRouter>);

        expect(await screen.findByRole('heading', { name: 'Registro de Ventas' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Registrar Venta/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog', { name: /Registrar Nueva Venta/i })).not.toBeInTheDocument();
        expect(api.post).not.toHaveBeenCalled();
        // Lo que sigue: la edición masiva y las exportaciones.
        expect(screen.getByRole('button', { name: /Modificación Masiva/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Exportar CSV/ })).toBeInTheDocument();
    });
});
