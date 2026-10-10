import React from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CloserDashboard from './CloserDashboard';

/**
 * Quién elige qué closer mirar en el dashboard de performance.
 *
 * El 10/10/2026 se retiró la vista «Administración» y el filtro de closers pasa también a la dirección
 * comercial (el backend ya le respetaba el `closer_id`). El closer sigue viendo solo lo suyo.
 */

const sesion = vi.hoisted(() => ({ role: 'admin' }));
const filtros = vi.hoisted(() => ({ props: null }));
const datos = vi.hoisted(() => ({
    closers: [{ id: 1, username: 'ana' }],
    dates: {},
    current: { kpis: {} },
    cuotas_por_cobrar: {},
}));

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 7, role: sesion.role } }) }));
vi.mock('../../../services/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: datos })) } }));
vi.mock('./components/PerformanceFilters', () => ({
    default: (props) => { filtros.props = props; return null; },
}));
const nada = vi.hoisted(() => () => ({ default: () => null }));
vi.mock('./components/PerformanceHighlights', nada);
vi.mock('./components/PerformanceKpis', nada);
vi.mock('./components/PerformancePendientes', nada);
vi.mock('./components/PerformanceFunnel', () => ({ default: () => null, ConfirmacionesCard: () => null }));
vi.mock('./components/PerformanceQuality', nada);
vi.mock('./components/PerformanceCierres', nada);
vi.mock('./components/PerformanceSenas', nada);
vi.mock('./components/PerformanceMoney', nada);
vi.mock('./components/PerformanceActivity', nada);
vi.mock('./components/PerformanceRanking', nada);
vi.mock('./components/DataSourceLegend', nada);
vi.mock('./components/DataIssuesPanel', nada);
vi.mock('./components/SlotsPrompt', nada);
vi.mock('./dataIssues', () => ({ detectIssues: () => [] }));
vi.mock('./useDrillDown', () => ({ useDrillDown: () => () => {} }));

const montar = async () => {
    filtros.props = null;
    render(<CloserDashboard embedded />);
    await act(async () => {});
};

describe('Dashboard de performance · filtro de closers', () => {
    it.each(['admin', 'director_comercial'])('%s elige qué closer mirar', async (rol) => {
        sesion.role = rol;
        await montar();

        expect(filtros.props.showClosersFilter).toBe(true);
        expect(filtros.props.closers).toEqual(datos.closers);
    });

    it('el closer no tiene filtro: ve siempre lo suyo', async () => {
        sesion.role = 'closer';
        await montar();

        expect(filtros.props.showClosersFilter).toBe(false);
    });
});
