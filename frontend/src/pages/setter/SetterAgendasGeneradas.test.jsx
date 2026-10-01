import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SetterWorkflowPage from './SetterWorkflowPage';
import { filtrosDeMisDatos } from './periodosDelMazo';

/**
 * Agendas › Por fecha: el número del encabezado es el de "Mis datos" para el mismo período.
 *
 * Antes el encabezado decía "Mis Agendas N" con el largo de la lista, que trae también las
 * reuniones del período reservadas antes, y los chips "Esta semana" / "Este mes" eran 8 y 31 días.
 * El 01/10/2026 mostraba 84 para Elias con "Este mes" y "Mis datos" con "Este mes", 1.
 */

const llamadas = vi.hoisted(() => ({ tabla: [] }));

vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn((url) => Promise.resolve({
            data: url.startsWith('/setter/deck/agendas')
                // La lista trae cinco filas: tres reservadas en el período y dos reuniones.
                ? [1, 2, 3, 4, 5].map(id => ({ id, cliente: `Lead ${id}`, estado: 'Pendiente', tiene_anuncio: true, ad_name: 'Ad', closer: 'Marlon', instagram: `lead${id}`, date: null }))
                : [],
        })),
        post: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));
vi.mock('../comercial/comercialApi', () => ({
    getTabla: vi.fn((filtros, tabla) => {
        llamadas.tabla.push({ filtros, tabla });
        const porPeriodo = { hoy: 1, '7d': 21, '30d': 68, custom: 3 };
        return Promise.resolve({ totales: { agendas: porPeriodo[filtros.period] ?? 0 } });
    }),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn(), loading: vi.fn() } }));
vi.mock('./components/SetterComisionMesCard', () => ({ default: () => null }));
vi.mock('../../components/modals/SetterCualificacionModal', () => ({ default: () => null }));
vi.mock('../../components/modals/AgendaManagerModal', () => ({ default: () => null }));

const montar = async () => {
    render(<SetterWorkflowPage paso="agendas" />);
    await act(async () => {});
};

const elegirChip = async (nombre) => {
    fireEvent.click(screen.getByRole('button', { name: /Hoy|7 días|30 días|Ayer|Personalizado/ }));
    fireEvent.click(screen.getByRole('button', { name: nombre }));
    await act(async () => {});
};

describe('Agendas › Por fecha · el número es el de Mis datos', () => {
    beforeEach(() => { llamadas.tabla = []; });

    it('cada chip pide las generadas con el período de Mis datos del mismo nombre', () => {
        expect(filtrosDeMisDatos('today')).toEqual({ period: 'hoy', compare: 'none' });
        expect(filtrosDeMisDatos('yesterday')).toEqual({ period: 'ayer', compare: 'none' });
        expect(filtrosDeMisDatos('week')).toEqual({ period: '7d', compare: 'none' });
        expect(filtrosDeMisDatos('month')).toEqual({ period: '30d', compare: 'none' });
        expect(filtrosDeMisDatos('custom', '2026-09-15'))
            .toEqual({ period: 'custom', compare: 'none', desde: '2026-09-15', hasta: '2026-09-15' });
        expect(filtrosDeMisDatos('custom', '')).toBeNull();
    });

    it('el encabezado muestra las generadas, no el largo de la lista', async () => {
        await montar();

        expect(llamadas.tabla.at(-1)).toEqual({ filtros: { period: 'hoy', compare: 'none' }, tabla: 'generadas' });
        expect(screen.getByText('1 generada')).toBeTruthy();
        expect(screen.getAllByText(/^Lead \d$/)).toHaveLength(5);
        expect(screen.queryByText('5')).toBeNull();
    });

    it('los chips se llaman como en Mis datos y cambian el número', async () => {
        await montar();

        await elegirChip('30 días');
        expect(llamadas.tabla.at(-1).filtros).toEqual({ period: '30d', compare: 'none' });
        expect(screen.getByText('68 generadas')).toBeTruthy();

        await elegirChip('7 días');
        expect(llamadas.tabla.at(-1).filtros).toEqual({ period: '7d', compare: 'none' });
        expect(screen.getByText('21 generadas')).toBeTruthy();

        expect(screen.queryByText('Esta semana')).toBeNull();
        expect(screen.queryByText('Este mes')).toBeNull();
    });
});
