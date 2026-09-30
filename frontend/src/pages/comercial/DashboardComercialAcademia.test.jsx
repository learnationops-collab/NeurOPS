import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import toast from 'react-hot-toast';
import DashboardComercial from './DashboardComercial';
import { getContexto, getTabla, sincronizarAcademia } from './comercialApi';

/**
 * "Actualizar datos de la Academia": el botón es de la dirección, corre UN lote y recarga la tabla.
 *
 * Cada lote gasta del límite que la Academia comparte con todo el equipo (y la ruta le responde 403
 * al resto), así que un closer no tiene que ver el botón. El mensaje lo arma el backend.
 */

vi.mock('./comercialApi', () => ({
    getContexto: vi.fn(),
    getResumen: vi.fn(() => Promise.resolve({})),
    getComparativas: vi.fn(() => Promise.resolve({})),
    getVariabilidad: vi.fn(() => Promise.resolve({})),
    getTabla: vi.fn(),
    corregirAgenda: vi.fn(),
    marcarAgendaDuplicada: vi.fn(),
    eliminarAgenda: vi.fn(),
    sincronizarAcademia: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 1, role: 'director_comercial', is_impersonating: false } }),
}));
vi.mock('react-hot-toast', () => {
    const t = vi.fn();
    t.success = vi.fn();
    t.error = vi.fn();
    return { default: t };
});

const contexto = (direccion) => ({
    puede_elegir_equipo: direccion, puede_reportar: direccion, rol: 'closers',
    yo: direccion ? { id: 1, rol: 'director_comercial', nombre: 'Mario' } : { id: 9, rol: 'closer', nombre: 'Nerina' },
    miembros: [], estados: {}, periodos: [{ key: 'mes', label: 'Este mes' }],
    comparaciones: [{ key: 'prev', label: 'Período anterior' }],
});
const FILA = {
    tipo: 'cliente', id: 1, client_id: 1, cliente: 'Alumno 1', closer: 'Nerina', programa: 'ACE',
    fecha: '2026-09-10', pagado: 100, deuda: 0, cobros: 1, cuota_monto: null, cuota_fecha: null,
    cuota_vencida: false, estado: { key: 'al_dia', label: 'Al día', tone: 'success' },
    academia: { estado: { key: 'sin_datos', label: 'Sin datos', tone: 'idle' } },
};

const montar = () => render(
    <MemoryRouter initialEntries={['/x?s=revisar&t=clientes']}>
        <DashboardComercial />
    </MemoryRouter>,
);
// Margen para el montaje: el primer test del archivo monta el dashboard entero por primera vez, y
// con la suite completa corriendo en paralelo eso pasaba el segundo por defecto de `findByRole`
// (falló 3 de ~8 corridas completas; solo tarda ~600ms).
const aAcademia = async () => fireEvent.click(
    await screen.findByRole('button', { name: /Academia$/, pressed: false }, { timeout: 5000 }));

describe('DashboardComercial · actualizar datos de la Academia', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.clearAllMocks();
        getTabla.mockResolvedValue({ tabla: 'clientes', rol: 'closers', filas: [FILA] });
    });

    it('la dirección corre un lote, ve el mensaje del backend y la tabla se recarga', async () => {
        getContexto.mockResolvedValue(contexto(true));
        sincronizarAcademia.mockResolvedValue({ corte: 'presupuesto', mensaje: 'Se actualizaron 8 clientes.' });
        montar();
        await aAcademia();
        const pedidasAntes = getTabla.mock.calls.length;

        fireEvent.click(screen.getByRole('button', { name: 'Actualizar datos de la Academia' }));

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Se actualizaron 8 clientes.'));
        expect(sincronizarAcademia).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(getTabla.mock.calls.length).toBe(pedidasAntes + 1));
    });

    it('un corte por token inválido se avisa como error', async () => {
        getContexto.mockResolvedValue(contexto(true));
        sincronizarAcademia.mockResolvedValue({ corte: '401', mensaje: 'La Academia rechazó el token (401).' });
        montar();
        await aAcademia();

        fireEvent.click(screen.getByRole('button', { name: 'Actualizar datos de la Academia' }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('La Academia rechazó el token (401).'));
    });

    it('un closer ve las columnas de la Academia pero no el botón', async () => {
        getContexto.mockResolvedValue(contexto(false));
        montar();
        await aAcademia();

        expect(screen.getByText(/clientes? con datos de la Academia/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Actualizar datos de la Academia/ })).toBeNull();
    });
});
