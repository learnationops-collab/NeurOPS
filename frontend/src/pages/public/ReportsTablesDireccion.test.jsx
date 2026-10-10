import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CloserReportsTable from './CloserReportsTable';
import SetterReportsTable from './SetterReportsTable';

/**
 * Las tablas de reportes de closers y setters: lo que antes era solo del admin.
 *
 * El 10/10/2026 se retiró la vista «Administración» y la dirección comercial hereda la tira de
 * pendientes, la vista previa de Discord y el reenvío del reporte de cualquiera. El admin lo conserva;
 * el closer y el setter siguen reenviando solo el suyo (y no ven la vista previa).
 */

const sesion = vi.hoisted(() => ({ role: 'admin' }));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 7, role: sesion.role } }) }));
vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn((url) => Promise.resolve({
            data: url.startsWith('/closer/pending-summary')
                ? { total: 4, agendas_sin_reportar: {}, por_confirmar: {}, seguimientos: {} }
                : { reports: [{ id: 31, date: '2026-10-09', closer_name: 'ana', setter_name: 'beto' }], pages: 1 },
        })),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        delete: vi.fn(),
        put: vi.fn(),
    },
}));

const montar = async (Tabla, props) => {
    render(<MemoryRouter><Tabla {...props} /></MemoryRouter>);
    await act(async () => {});
};

const vistaPrevia = () => screen.queryByTitle('Vista Previa de Discord');
const reenviar = () => screen.queryByTitle('Reenviar a Discord');

describe('Reportes de closers', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it.each(['admin', 'director_comercial'])('%s ve la tira de pendientes, la vista previa y el reenvío', async (rol) => {
        sesion.role = rol;
        await montar(CloserReportsTable, { closers: [] });

        expect(screen.getByText('Total pendiente (a hoy)')).toBeTruthy();
        expect(vistaPrevia()).toBeTruthy();
        expect(reenviar()).toBeTruthy();
    });

    it('el closer reenvía el suyo pero no ve la vista previa ni los pendientes del equipo', async () => {
        sesion.role = 'closer';
        await montar(CloserReportsTable, { closers: [] });

        expect(screen.queryByText('Total pendiente (a hoy)')).toBeNull();
        expect(vistaPrevia()).toBeNull();
        expect(reenviar()).toBeTruthy();
    });

    describe('vista previa', () => {
        const abrir = vi.fn();
        beforeEach(() => { vi.stubGlobal('open', abrir); });
        afterEach(() => { vi.unstubAllGlobals(); abrir.mockReset(); });

        it('la dirección la abre en otra pestaña con su token', async () => {
            sesion.role = 'director_comercial';
            window.localStorage.setItem('auth_token', 'tk-direccion');
            await montar(CloserReportsTable, { closers: [] });

            fireEvent.click(vistaPrevia());

            expect(abrir).toHaveBeenCalledWith('/api/public/closer-reports/31/preview?token=tk-direccion', '_blank');
        });
    });
});

describe('Reportes de setters', () => {
    it.each(['admin', 'director_comercial'])('%s ve la vista previa y el reenvío', async (rol) => {
        sesion.role = rol;
        await montar(SetterReportsTable, { setters: [] });

        expect(vistaPrevia()).toBeTruthy();
        expect(reenviar()).toBeTruthy();
    });

    it('el setter reenvía el suyo pero no ve la vista previa', async () => {
        sesion.role = 'setter';
        await montar(SetterReportsTable, { setters: [] });

        expect(vistaPrevia()).toBeNull();
        expect(reenviar()).toBeTruthy();
    });

    it('otro rol no ve ninguna de las dos', async () => {
        sesion.role = 'director_marketing';
        await montar(SetterReportsTable, { setters: [] });

        expect(vistaPrevia()).toBeNull();
        expect(reenviar()).toBeNull();
    });
});
