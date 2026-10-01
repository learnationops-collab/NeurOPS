import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardComercial from './DashboardComercial';
import { getTabla } from './comercialApi';

/**
 * Con qué fecha se pide cada tabla de Revisar si nadie tocó el toggle "Fecha meet / F. creación".
 *
 * Las agendas generadas de un setter se cuentan por cuándo se RESERVARON (decisión del 01/10/2026,
 * ver `ComercialService.generadas`): la lista tiene que abrir igual, o el número de Analizar y la
 * lista no cierran. Las agendas del closer siguen por la reunión, que es como se cuenta su número.
 */

vi.mock('./comercialApi', () => ({
    getContexto: vi.fn(() => Promise.resolve({
        puede_elegir_equipo: true, puede_reportar: true, rol: 'closers', miembro_id: null,
        yo: { id: 99, rol: 'director_comercial', nombre: 'Director' },
        miembros: [], miembros_por_rol: { closers: [], setters: [] }, estados: [],
        periodos: [{ key: 'mes', label: 'Este mes' }],
        comparaciones: [{ key: 'prev', label: 'Período anterior' }],
    })),
    getResumen: vi.fn(() => Promise.resolve({})),
    getComparativas: vi.fn(() => Promise.resolve({})),
    getVariabilidad: vi.fn(() => Promise.resolve({})),
    getTabla: vi.fn(() => Promise.resolve({ filas: [] })),
    corregirAgenda: vi.fn(),
    marcarAgendaDuplicada: vi.fn(),
    eliminarAgenda: vi.fn(),
    sincronizarAcademia: vi.fn(() => Promise.resolve({ mensaje: 'ok', corte: null })),
}));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 99, role: 'director_comercial', is_impersonating: false } }),
}));

const montar = (url) => render(
    <MemoryRouter initialEntries={[url]}>
        <DashboardComercial />
    </MemoryRouter>,
);

const ultimoPedido = async () => {
    await waitFor(() => expect(getTabla).toHaveBeenCalled());
    const [, tabla, basis] = getTabla.mock.calls.at(-1);
    return { tabla, basis };
};

describe('DashboardComercial · la fecha con la que abre cada tabla', () => {
    beforeEach(() => getTabla.mockClear());

    it('"Agendas generadas" abre por fecha de creación', async () => {
        montar('/x?s=revisar&rol=setters&t=generadas');
        expect(await ultimoPedido()).toEqual({ tabla: 'generadas', basis: 'creacion' });
    });

    it('las agendas del closer siguen abriendo por la fecha de la reunión', async () => {
        montar('/x?s=revisar&rol=closers&t=agendas');
        expect(await ultimoPedido()).toEqual({ tabla: 'agendas', basis: 'meet' });
    });
});
