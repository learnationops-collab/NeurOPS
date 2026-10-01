import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SetterAgendasPage from './SetterAgendasPage';

/**
 * Historial: el total es de personas y de siempre, no el largo de la lista.
 *
 * Antes decía "Total: N" con las filas que trajo la lista: quien reagendó contaba varias veces y la
 * lista se corta en 500, así que a Elias le decía 500 (01/10/2026).
 */

const filas = [1, 2, 3, 4, 5, 6].map(id => ({
    id, lead_name: id <= 3 ? 'Ana' : `Lead ${id}`, closer_name: 'Marlon', start_time: null, result: 'Pendiente',
}));

vi.mock('../../../services/api', () => ({
    default: {
        get: vi.fn((url) => Promise.resolve({
            data: url === '/setter/agendas' ? filas
                : url === '/setter/agendas/total' ? { personas: 4, agendas: 6 }
                    : [],
        })),
    },
}));
vi.mock('../../../components/dashboard/BookingLinkModal', () => ({ default: () => null }));
vi.mock('../../../components/modals/AgendaManagerModal', () => ({ default: () => null }));
vi.mock('./SetterUnclaimedAgendas', () => ({ default: () => null }));

describe('SetterAgendasPage · Total histórico', () => {
    it('muestra las personas de siempre, no las filas de la lista', async () => {
        render(<SetterAgendasPage />);
        await act(async () => {});

        expect(screen.getByText(/Total histórico: 4 personas/)).toBeTruthy();
        expect(screen.queryByText(/Total: 6/)).toBeNull();
        expect(screen.getAllByText('Ana')).toHaveLength(3);
    });
});
