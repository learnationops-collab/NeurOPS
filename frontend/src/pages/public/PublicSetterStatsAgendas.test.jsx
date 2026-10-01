import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicSetterStatsPage from './PublicSetterStatsPage';

/**
 * Mis reportes: las agendas que se tipearon en los reportes no se llaman como la métrica real.
 *
 * La tarjeta sumaba `funnel_agenda` de los reportes y decía "Agendas Generadas", el nombre de
 * "Mis datos" (septiembre de 2026: Elias 75 reportadas contra 70 generadas). Ahora dice "Agendas
 * reportadas" y al lado muestra las generadas del mismo período.
 */

const respuesta = vi.hoisted(() => ({ generadas: 70 }));

const ceros = (claves) => Object.fromEntries(claves.map(k => [k, 0]));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 7, role: 'setter' } }) }));
vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn((url) => Promise.resolve({
            data: url.startsWith('/public/setter-stats')
                ? {
                    totals: { ...ceros(['entrantes', 'leads', 'funnel_qualification', 'funnel_pain', 'funnel_offer',
                        'funnel_link', 'total_fu_s', 'total_fu_r']), funnel_agenda: 75 },
                    percentages: {
                        rates: ceros(['total_fur']),
                        funnel_evolution: ceros(['qual_to_pain', 'pain_to_offer', 'offer_to_link', 'link_to_agenda']),
                        conversions_to_agenda: ceros(['opening_to_agenda']),
                        questions: {}, inbox: {},
                    },
                    setters_breakdown: [],
                    time_series: [],
                    generadas: respuesta.generadas,
                }
                : [],
        })),
    },
}));
vi.mock('../../components/charts/FunnelChart', () => ({ default: () => null }));
vi.mock('../../components/charts/EvolutionChart', () => ({ default: () => null }));
vi.mock('../../components/shared/LeadUnifiedKPI', () => ({ default: () => null }));
vi.mock('./SetterReportsTable', () => ({ default: () => null }));
vi.mock('./ConversationalStatsTab', () => ({ default: () => null }));
vi.mock('./IncomingLeadsTab', () => ({ default: () => null }));

const montar = async () => {
    render(<MemoryRouter><PublicSetterStatsPage embebido /></MemoryRouter>);
    await act(async () => {});
};

describe('Mis reportes · Agendas reportadas', () => {
    beforeEach(() => {
        window.localStorage.clear();
        respuesta.generadas = 70;
    });

    it('la suma de los reportes se llama "Agendas reportadas" y al lado van las generadas', async () => {
        await montar();

        expect(screen.getByText('Agendas reportadas')).toBeTruthy();
        expect(screen.queryByText('Agendas Generadas')).toBeNull();
        expect(screen.getByText('70 generadas')).toBeTruthy();
    });

    it('sin el número real (otro setter, sin rango) no se inventa', async () => {
        respuesta.generadas = null;
        await montar();

        expect(screen.getByText('Agendas reportadas')).toBeTruthy();
        expect(screen.queryByText(/generadas$/)).toBeNull();
    });
});
