import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConversationalStatsTab from './ConversationalStatsTab';

/**
 * Rendimiento conversacional: sus agendas no se llaman como las del setter en "Mis datos".
 *
 * El tile decía "Agendas generadas" y cuenta otra cosa: las agendas de todo el equipo (también
 * taller, VSL y landing) atribuidas al último mensaje que recibió el lead. En septiembre de 2026
 * eran 90, y Elias tenía 70 generadas en "Mis datos".
 */

vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn((url) => Promise.resolve({
            data: url === '/conversational/stats/conversational'
                ? {
                    kpis: {
                        total_sends: 100, daily_avg_sends: 3.3, total_responses: 40, global_response_rate: 40,
                        total_leads: 30, total_disqualified: 0, global_qualification_rate: 75,
                        total_agendas: 90, agenda_rate: 10, total_ventas: 3, venta_rate_from_agendas: 3.3,
                    },
                    table: [],
                    period: { start: '2026-09-01T00:00:00', end: '2026-09-30T23:59:59' },
                }
                : [],
        })),
    },
}));
vi.mock('../setter/dashboard/MessageManagerModal', () => ({ default: () => null }));

describe('Rendimiento conversacional · Agendas atribuidas', () => {
    it('el tile de agendas no usa el nombre de la métrica de Mis datos', async () => {
        render(<ConversationalStatsTab />);
        await act(async () => {});

        expect(screen.getByText('Agendas atribuidas')).toBeTruthy();
        expect(screen.queryByText(/^Agendas generadas$/i)).toBeNull();
        expect(screen.getByText('90')).toBeTruthy();
    });
});
