import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardComercial from './DashboardComercial';
import { getTabla } from './comercialApi';

/**
 * Quien opera los registros (admin y operador, `puede_operar` del contexto) pide las tablas de
 * Revisar para operarlas: en Ventas el backend le suma las no completadas, su estado y su agenda
 * (10/10/2026). La dirección y los closers las piden como siempre.
 */

const estado = vi.hoisted(() => ({ opera: false, yo: 'director_comercial' }));

vi.mock('./comercialApi', () => ({
    getContexto: vi.fn(() => Promise.resolve({
        puede_elegir_equipo: estado.yo !== 'closer', puede_reportar: estado.yo === 'director_comercial',
        puede_operar: estado.opera, rol: 'closers', miembro_id: estado.yo === 'closer' ? 7 : null,
        yo: { id: 7, rol: estado.yo, nombre: 'Quien mira' },
        miembros: [], miembros_por_rol: { closers: [], setters: [] }, estados: [],
        periodos: [{ key: 'mes', label: 'Este mes' }],
        comparaciones: [{ key: 'prev', label: 'Período anterior' }],
    })),
    getResumen: vi.fn(() => Promise.resolve({})),
    getComparativas: vi.fn(() => Promise.resolve({})),
    getVariabilidad: vi.fn(() => Promise.resolve({})),
    getTabla: vi.fn((filtros, tabla) => Promise.resolve({ tabla, rol: filtros.rol, filas: [] })),
    getNoCerradas: vi.fn(() => Promise.resolve({ filas: [] })),
    corregirAgenda: vi.fn(),
    marcarAgendaDuplicada: vi.fn(),
    eliminarAgenda: vi.fn(),
    sincronizarAcademia: vi.fn(() => Promise.resolve({ mensaje: 'ok', corte: null })),
}));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 7, role: estado.yo, is_impersonating: false }, logout: vi.fn() }),
}));

const montar = () => render(
    <MemoryRouter initialEntries={['/x?s=revisar&t=ventas']}>
        <DashboardComercial />
    </MemoryRouter>,
);

// Con llaves: `mockClear` devuelve el mock, y una función devuelta por `beforeEach` vitest la corre
// como limpieza (llamaría a `getTabla` sin argumentos).
beforeEach(() => { getTabla.mockClear(); });

describe('DashboardComercial · quien opera pide las tablas para operarlas', () => {
    it.each([['operator', true], ['admin', true], ['director_comercial', false], ['closer', false]])(
        '%s: operar = %s', async (rol, opera) => {
            Object.assign(estado, { yo: rol, opera });
            montar();
            await screen.findByRole('button', { name: /Filtro completo/ });
            await waitFor(() => expect(getTabla).toHaveBeenCalled());

            getTabla.mock.calls.forEach(([, tabla, , opciones]) => {
                expect(tabla).toBe('ventas');
                expect(opciones).toEqual({ operar: opera });
            });
        });
});
