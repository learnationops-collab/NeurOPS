import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DashboardComercial from './DashboardComercial';
import { getResumen, getTabla } from './comercialApi';

/**
 * «Ingresos por fuente» en «Analizar · mis datos» del closer (09/10/2026): la tarjeta llega en el
 * MISMO resumen que el resto de Analizar, sin un pedido aparte ni un parámetro propio. El closer no
 * manda a quién mirar —el backend lo acota a él pida lo que pida (`alcance_de`, y lo prueba
 * `tests/api/test_comercial_fuentes.py`)—: acá se comprueba que vea la tarjeta con lo que llega.
 */

const FUENTES = {
    base: 'bruto', total: 2500, cantidad: 2, previo: null, delta: null,
    procedencias: [
        { key: 'workshop', label: 'Workshop', tone: 'cat-4', monto: 1000, cantidad: 1, pct: 40, previo: null,
            delta: null, detalle: [{ key: 'vivo', label: 'En vivo', monto: 1000, cantidad: 1, pct: 40 }] },
        { key: 'setting', label: 'Setting', tone: 'cat-2', monto: 0, cantidad: 0, pct: 0, previo: null,
            delta: null, detalle: [] },
        { key: 'vsl', label: 'VSL', tone: 'cat-1', monto: 1500, cantidad: 1, pct: 60, previo: null,
            delta: null, detalle: [] },
        { key: 'fulfillment', label: 'Fulfillment', tone: 'cat-3', monto: 0, cantidad: 0, pct: 0, previo: null,
            delta: null, detalle: [] },
        { key: 'sin_procedencia', label: 'Sin procedencia', tone: 'idle', monto: 0, cantidad: 0, pct: 0,
            previo: null, delta: null, detalle: [] },
    ],
};

const RESUMEN = {
    rol: 'closers', deltas: {}, previo: null, por_cobrar: null, fuentes: FUENTES,
    miembro: { id: 21, nombre: 'Marlon' },
    dates: { start: '2026-10-01', end: '2026-10-31', compare_start: null, compare_end: null },
    actual: {
        agendas: 0, realizadas: 0, asistieron: 0, show_up: null, cerradas: 0, close_rate: null,
        presentaciones: 0, cierres: null, estados: [], cash: 2500, cash_neto: 2432.5, ventas: 2,
        ticket: 1250, comision: 243.25, cash_por_dia: [], mejor_dia: null, programas: [], funnel: [],
        payment_types: [{ key: 'completo', label: 'Pago completo', tone: 'success', ventas: 2, cash: 2500 }],
        senas: { total: 0, completo: 0, parcial: 0, espera: 0, caida: 0, conversion: null, cobrado: 0,
            ticket: null, desbloqueado: 0 },
    },
};

// Los dos cobros de Marlon en la tabla Ventas, cada uno con la fuente que le pone el backend: la
// misma con la que los cuenta la tarjeta de arriba.
const venta = (id, cliente, monto, procedencia, detalle) => ({
    tipo: 'venta', id, client_id: null, cliente, closer: 'Marlon', programa: 'ACE', fecha: '2026-10-03T10:00:00',
    tipo_pago: { key: 'completo', label: 'Pago completo', tone: 'success' }, tipo_pago_raw: 'ACE - Completo',
    metodo: 'Zelle', monto, monto_neto: monto, es_venta: true, sena_estado: null, academia: null,
    procedencia, procedencia_detalle: detalle,
});
const VENTAS = {
    tabla: 'ventas', rol: 'closers', totales: {},
    dates: { start: '2026-10-01', end: '2026-10-31', compare_start: null, compare_end: null },
    filas: [
        venta(1, 'Ana Workshop', 1000, { key: 'workshop', label: 'Workshop', tone: 'cat-4' }, { key: 'vivo', label: 'En vivo' }),
        venta(2, 'Fede VSL', 1500, { key: 'vsl', label: 'VSL', tone: 'cat-1' }, null),
    ],
};

vi.mock('./comercialApi', () => ({
    getContexto: vi.fn(() => Promise.resolve({
        puede_elegir_equipo: false, puede_reportar: false, puede_comparar: true, rol: 'closers',
        miembro_id: 21, yo: { id: 21, rol: 'closer', nombre: 'Marlon' }, miembros: [], estados: [],
        periodos: [{ key: 'mes', label: 'Este mes' }],
        comparaciones: [{ key: 'none', label: 'Sin comparar' }],
    })),
    getResumen: vi.fn(() => Promise.resolve(RESUMEN)),
    getComparativas: vi.fn(() => Promise.resolve({})),
    getVariabilidad: vi.fn(() => Promise.resolve({})),
    getTabla: vi.fn((_filtros, tabla) => Promise.resolve(tabla === 'ventas' ? VENTAS : { filas: [] })),
    corregirAgenda: vi.fn(),
    marcarAgendaDuplicada: vi.fn(),
    eliminarAgenda: vi.fn(),
    sincronizarAcademia: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 21, role: 'closer', is_impersonating: false }, logout: vi.fn() }),
}));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: {} })) } }));

describe('DashboardComercial · Ingresos por fuente en «Mis datos» del closer', () => {
    it('el closer ve la tarjeta con lo suyo, del mismo resumen y sin pedir a nadie', async () => {
        render(
            <MemoryRouter initialEntries={['/closer/mis-datos?p=mes&vs=none']}>
                <DashboardComercial />
            </MemoryRouter>,
        );

        const tarjeta = await waitFor(() => {
            const el = document.getElementById('p-fuentes');
            expect(el).not.toBeNull();
            return el;
        });
        expect(screen.getByText('Analizar · mis datos')).toBeTruthy();
        expect(within(tarjeta).getByText('Ingresos por fuente')).toBeTruthy();
        expect(within(tarjeta).getByText('Workshop')).toBeTruthy();
        expect(within(tarjeta).getByText('$2,500')).toBeTruthy();

        // Un solo pedido, el del resumen, como closer y sin persona: la persona la pone el backend.
        expect(getResumen).toHaveBeenCalled();
        expect(getResumen.mock.calls.at(-1)[0]).toMatchObject({ rol: 'closers', miembroId: null });
    });

    it('tocar el monto de una fuente abre Revisar › Ventas con esa fuente y su cash', async () => {
        render(
            <MemoryRouter initialEntries={['/closer/mis-datos?p=mes&vs=none']}>
                <DashboardComercial />
            </MemoryRouter>,
        );
        const tarjeta = await waitFor(() => {
            const el = document.getElementById('p-fuentes');
            expect(el).not.toBeNull();
            return el;
        });

        fireEvent.click(within(tarjeta).getByRole('button', { name: 'Ver en la lista: 1 cobro de Workshop, $1,000' }));

        // Revisar, en Ventas, con la etiqueta de la fuente y solo sus cobros.
        const quitar = await screen.findByRole('button', { name: 'Quitar Fuente: Workshop' });
        expect(quitar).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Ventas' })).toHaveAttribute('aria-selected', 'true');
        expect(getTabla.mock.calls.at(-1)[1]).toBe('ventas');
        // Mismo período y misma persona: el pedido de la tabla lleva el filtro del header de antes.
        expect(getTabla.mock.calls.at(-1)[0]).toMatchObject({ period: 'mes', rol: 'closers', miembroId: null });
        expect(screen.getAllByRole('button', { name: /^Abrir / })).toHaveLength(1);
        expect(screen.getByText('Ana Workshop')).toBeInTheDocument();
        expect(screen.queryByText('Fede VSL')).toBeNull();
        // La tira dice el monto de la fila de la tarjeta.
        await waitFor(() => expect(document.querySelector('.tot-tira [data-total="cash"] b').textContent)
            .toBe('$1,000'));
    });
});
