import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Revisar from './Revisar';

/**
 * Clientes y Ventas filtradas y ordenadas por lo que el alumno hace en la Academia.
 *
 * El pedido (30/09/2026): "ordenar por ejecuciones o cosas que hayan hecho, tiempo de estudio" para
 * sacar la lista de los que están cumpliendo con sus actividades. Todo pasa por el mismo camino de
 * Revisar: la faceta y el atajo filtran con `aplicarFiltros`, el orden va después, y la tira de
 * totales cuenta sobre lo mismo que se ve.
 */

const ESTADOS = { activo: 'Activo', inactivo: 'Inactivo', sin_acceso: 'Sin acceso', sin_datos: 'Sin datos todavía' };
const academia = (key, extra = {}) => ({
    estado: { key, label: ESTADOS[key], tone: key === 'activo' ? 'success' : 'idle' },
    horas: null, progreso: null, lecciones: null, lecciones_total: null, ejecuciones: null, racha: null,
    ultima_actividad: null, sincronizado: null, intentado: null, error: null, ...extra,
});
const cliente = (id, bloque) => ({
    tipo: 'cliente', id, client_id: id, cliente: `Alumno ${id}`, closer: 'Nerina', programa: 'ACE',
    fecha: '2026-09-10', pagado: 100, deuda: 0, cobros: 1, cuota_monto: null, cuota_fecha: null,
    cuota_vencida: false, estado: { key: 'al_dia', label: 'Al día', tone: 'success' }, academia: bloque,
});
const HOY = '2026-09-30T12:00:00Z';
const FILAS = [
    cliente(1, academia('inactivo', { horas: 3, ejecuciones: 4, racha: 0, lecciones: 2, lecciones_total: 12,
        sincronizado: HOY })),
    cliente(2, academia('activo', { horas: 40, ejecuciones: 67, racha: 5, lecciones: 11, lecciones_total: 12,
        progreso: 31.5, ultima_actividad: HOY, sincronizado: HOY })),
    cliente(3, academia('sin_acceso', { intentado: HOY })),
    cliente(4, academia('activo', { horas: 12, ejecuciones: 9, racha: 1, ultima_actividad: HOY,
        sincronizado: '2026-09-29T12:00:00Z' })),
];

const props = (extra = {}) => ({
    tabla: 'clientes', setTabla: () => {}, datos: { filas: FILAS }, cargando: false, rol: 'closers',
    basis: 'meet', setBasis: () => {}, alcance: 'Todo el equipo', onAbrirFila: () => {},
    filtroInicial: null, onOlvidarFiltro: () => {}, puedeElegirEquipo: true, ...extra,
});

const nombres = () => screen.getAllByRole('button', { name: /^Abrir / })
    .map(b => b.getAttribute('aria-label').replace('Abrir ', ''));
const pasarAAcademia = () => fireEvent.click(screen.getByRole('button', { name: /Academia$/, pressed: false }));
const tira = (container) => container.querySelector('.tot-tira').textContent;

describe('Revisar · la Academia en Clientes', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-09-30T15:00:00Z'));
    });
    afterEach(() => { vi.useRealTimers(); });

    it('las columnas de la Academia muestran cada métrica y de cuándo es el dato', () => {
        render(<Revisar {...props()} />);
        pasarAAcademia();

        const fila = screen.getByRole('button', { name: 'Abrir Alumno 2' });
        expect(within(fila).getByText('Activo')).toBeInTheDocument();
        expect(within(fila).getByText('40 h')).toBeInTheDocument();
        expect(within(fila).getByText('11/12')).toBeInTheDocument();
        expect(within(fila).getByText('67')).toBeInTheDocument();
        expect(within(fila).getByText('5 días')).toBeInTheDocument();
        expect(within(fila).getByText('hace 3 h')).toBeInTheDocument();
        // La línea de frescura cuenta la tabla entera: cuántos tienen datos y el más viejo.
        expect(screen.getByText(/de 4 clientes con datos de la Academia/)).toBeInTheDocument();
        expect(screen.getByText(/el dato más viejo es de hace 1 día/)).toBeInTheDocument();
    });

    it('la faceta "Actividad en la Academia" filtra, y la tira de totales cierra con lo filtrado', () => {
        const { container } = render(<Revisar {...props()} />);
        expect(tira(container)).toMatch(/2activos en la Academia · de 3 con cuenta/);

        fireEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));
        fireEvent.click(screen.getByRole('checkbox', { name: /^Activo/ }));

        expect(nombres()).toEqual(['Alumno 2', 'Alumno 4']);
        expect(tira(container)).toMatch(/2clientes/);
        expect(tira(container)).toMatch(/2activos en la Academia · de 2 con cuenta/);
    });

    it('el atajo "Activos en la Academia" filtra y pasa a sus columnas', () => {
        render(<Revisar {...props()} />);

        fireEvent.click(screen.getByRole('button', { name: /^Todos/ }));
        fireEvent.click(screen.getByRole('menuitemradio', { name: /^Activos en la Academia/ }));

        expect(nombres()).toEqual(['Alumno 2', 'Alumno 4']);
        expect(screen.getByRole('button', { name: /Academia$/, pressed: true })).toBeInTheDocument();
    });

    it('ordenar por ejecuciones pone primero al que más entregó y deja al final al que no tiene cuenta', () => {
        render(<Revisar {...props()} />);
        pasarAAcademia();

        fireEvent.click(screen.getByRole('button', { name: /^Ordenar por Ejecuciones entregadas/ }));
        expect(nombres()).toEqual(['Alumno 2', 'Alumno 4', 'Alumno 1', 'Alumno 3']);

        fireEvent.click(screen.getByRole('button', { name: /^Ordenar por Ejecuciones entregadas/ }));
        expect(nombres()).toEqual(['Alumno 1', 'Alumno 4', 'Alumno 2', 'Alumno 3']);
    });

    it('ordenar por horas desde el menú muestra las columnas de la Academia', () => {
        render(<Revisar {...props()} />);

        fireEvent.click(screen.getByRole('button', { name: /^Ordenar$/ }));
        fireEvent.click(screen.getByRole('menuitemradio', { name: /^Horas de estudio/ }));

        expect(nombres()).toEqual(['Alumno 2', 'Alumno 4', 'Alumno 1', 'Alumno 3']);
        expect(screen.getByRole('button', { name: /Academia$/, pressed: true })).toBeInTheDocument();
    });

    it('cada métrica explica qué es', () => {
        render(<Revisar {...props()} />);
        pasarAAcademia();

        expect(screen.getByRole('note', { name: /^Ejecuciones entregadas: Ejecuciones \(los ejercicios/ }))
            .toBeInTheDocument();
        expect(screen.getByRole('note', { name: /^Última actividad en la Academia: Activo: le vimos/ }))
            .toBeInTheDocument();
    });
});

describe('Revisar · la Academia en Ventas', () => {
    const venta = (id, clientId, bloque) => ({
        tipo: 'venta', id, client_id: clientId, cliente: `Venta ${id}`, closer: 'Nerina', programa: 'ACE',
        fecha: '2026-09-10T10:00:00', tipo_pago: { key: 'completo', label: 'Pago completo', tone: 'success' },
        metodo: 'Stripe', monto: 100, monto_neto: 95, es_venta: true, academia: bloque,
    });

    it('un alumno con dos cobros cuenta una vez, y la venta sin cliente no suma ni ofrece opción', () => {
        const activo = academia('activo', { sincronizado: HOY, ultima_actividad: HOY });
        const filas = [venta(1, 7, activo), venta(2, 7, activo), venta(3, null, null)];
        const { container } = render(<Revisar {...props({ tabla: 'ventas', datos: { filas } })} />);

        expect(tira(container)).toMatch(/1activos en la Academia · de 1 con cuenta/);

        fireEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));
        const opciones = screen.getAllByRole('checkbox').map(c => c.textContent);
        expect(opciones.some(o => o.startsWith('Activo'))).toBe(true);
        expect(opciones.some(o => o.startsWith('Sin datos'))).toBe(false);
    });
});
