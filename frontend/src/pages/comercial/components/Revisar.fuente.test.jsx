import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import Revisar from './Revisar';
import { FACETAS_POR_TABLA, TABLAS } from './tablasDef';

/**
 * Revisar › Ventas por fuente (pedido del usuario, 09/10/2026: «agrega el filtro para fuente en
 * revisar y en agrupar»).
 *
 * La fuente de cada cobro llega del backend en la fila (`procedencia`, con la misma clasificación
 * que la tarjeta «Ingresos por fuente»: lo prueba `tests/api/test_comercial_fuentes.py`). Acá se
 * comprueba que la faceta la ofrezca y filtre con ella, que se pueda agrupar por ella con el
 * subtotal de cada fuente, y que el filtro que manda la tarjeta (la fuente o un renglón de su
 * detalle) deje la lista y la tira de totales con ese número.
 */

const BALDES = {
    workshop: { key: 'workshop', label: 'Workshop', tone: 'cat-4' },
    setting: { key: 'setting', label: 'Setting', tone: 'cat-2' },
    vsl: { key: 'vsl', label: 'VSL', tone: 'cat-1' },
    sin_procedencia: { key: 'sin_procedencia', label: 'Sin procedencia', tone: 'idle' },
};

const venta = (id, monto, balde, detalle = null, extra = {}) => ({
    tipo: 'venta', id, cliente: `Cliente ${id}`, closer: 'Nerina', programa: 'ACE',
    fecha: `2026-09-${String(10 + id).padStart(2, '0')}T10:00:00`,
    tipo_pago: { key: 'completo', label: 'Pago completo', tone: 'success' }, tipo_pago_raw: 'ACE - Completo',
    metodo: 'Zelle', monto, monto_neto: monto, es_venta: true, sena_estado: null,
    procedencia: BALDES[balde], procedencia_detalle: detalle, ...extra,
});

const FILAS = [
    venta(1, 1000, 'workshop', { key: 'vivo', label: 'En vivo' }),
    venta(2, 500, 'workshop', { key: 'grabacion', label: 'Grabación' }),
    venta(3, 2000, 'setting', { key: 'elias', label: 'Elias' }),
    venta(4, 800, 'setting', { key: 'paula', label: 'Paula' }, { closer: 'Marlon' }),
    venta(5, 1500, 'vsl'),
    venta(6, 250, 'sin_procedencia', { key: 'sin_agenda', label: 'Sin agenda' }),
];

const props = (extra = {}) => ({
    tabla: 'ventas', setTabla: () => {}, datos: { filas: FILAS }, cargando: false, rol: 'closers',
    basis: 'meet', setBasis: () => {}, alcance: 'Todo el equipo', onAbrirFila: () => {},
    filtroInicial: null, onOlvidarFiltro: () => {}, puedeElegirEquipo: true, ...extra,
});

const tira = () => document.querySelector('.tot-tira');
const cash = () => tira().querySelector('[data-total="cash"]');
const registros = () => screen.queryAllByRole('button', { name: /^Abrir / });
const mostrando = () => screen.getByText(/^mostrando \d+ de \d+$/).textContent;
const panel = () => screen.getByRole('dialog', { name: 'Filtro completo' });
const columna = (faceta) => within(panel()).getByText(new RegExp(`^${faceta}`)).closest('.config-col');

const agrupar = (dimension) => {
    fireEvent.click(screen.getByRole('button', { name: /^(Sin agrupar|Por )/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: new RegExp(`^${dimension}`) }));
};

describe('Revisar · Ventas por fuente', () => {
    beforeEach(() => { window.localStorage.clear(); });

    it('el Filtro completo tiene la faceta Fuente, con cada fuente y sus cobros', () => {
        render(<Revisar {...props()} />);
        fireEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));

        const opciones = within(columna('Fuente')).getAllByRole('checkbox')
            .map(op => [op.querySelector('.trunc').textContent, op.querySelector('.cuenta').textContent]);
        expect(opciones).toEqual([['Workshop', '2'], ['Setting', '2'], ['VSL', '1'], ['Sin procedencia', '1']]);
        // El detalle no ocupa una columna: el panel no anida opciones; existe para la tarjeta.
        expect(within(panel()).queryByText(/^Detalle de la fuente/)).toBeNull();
        // Nueve columnas (3 × 3 en el panel, ver `.config-grid` en comercial.css).
        expect(panel().querySelectorAll('.config-col')).toHaveLength(9);

        fireEvent.click(within(columna('Fuente')).getByRole('checkbox', { name: /Setting/ }));

        expect(registros()).toHaveLength(2);
        expect(mostrando()).toBe('mostrando 2 de 2');
        expect(cash().querySelector('b').textContent).toBe('$2,800');
        expect(cash().textContent).toMatch(/2 cobros/);
        expect(screen.getByRole('button', { name: 'Quitar Fuente: Setting' })).toBeInTheDocument();
    });

    it('se agrupa por fuente, con el subtotal de cada una', () => {
        render(<Revisar {...props()} />);
        agrupar('Fuente');

        expect(screen.getByRole('button', { name: 'Por fuente' })).toBeInTheDocument();
        const grupos = [...document.querySelectorAll('.grupo-cab')].map(g => [
            g.querySelector('.grupo-nombre').textContent, g.querySelector('.grupo-sub').textContent]);
        expect(grupos).toEqual([
            ['Workshop', '2 registros$1,500'], ['Setting', '2 registros$2,800'],
            ['VSL', '1 registro$1,500'], ['Sin procedencia', '1 registro$250'],
        ]);
    });

    it('el closer en «mis datos» también agrupa por fuente (no por sí mismo)', () => {
        render(<Revisar {...props({ puedeElegirEquipo: false })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Sin agrupar' }));

        const opciones = screen.getAllByRole('menuitemradio').map(o => o.querySelector('.trunc').textContent);
        expect(opciones).toEqual(['Sin agrupar', 'Programa', 'Tipo de pago', 'Fuente', 'Actividad en la Academia']);
    });

    it('el filtro de la tarjeta deja la lista y el cash de esa fuente', () => {
        render(<Revisar {...props({ filtroInicial: { fuente: 'Workshop', __de: 'Ingresos por fuente: Workshop', __t: 1 } })} />);

        expect(registros()).toHaveLength(2);
        expect(cash().querySelector('b').textContent).toBe('$1,500');
        expect(screen.getByRole('button', { name: 'Quitar Fuente: Workshop' })).toBeInTheDocument();
    });

    it('un renglón del detalle de la tarjeta filtra por la faceta oculta, con la fuente adelante', () => {
        render(<Revisar {...props({ filtroInicial: {
            fuente_detalle: 'Setting · Elias', __de: 'Ingresos por fuente: Setting · Elias', __t: 1 } })} />);

        expect(registros()).toHaveLength(1);
        expect(cash().querySelector('b').textContent).toBe('$2,000');
        expect(screen.getByRole('button', { name: 'Quitar Detalle de la fuente: Setting · Elias' }))
            .toHaveTextContent('Setting · Elias');
    });

    it('la tabla Ventas declara la faceta y la dimensión, y una fila vieja sin fuente no rompe', () => {
        expect(FACETAS_POR_TABLA.ventas).toEqual(expect.arrayContaining(['fuente', 'fuente_detalle']));
        expect(TABLAS.ventas.agrupables.map(d => d.key)).toContain('fuente');

        const vieja = { ...FILAS[0], procedencia: undefined, procedencia_detalle: undefined };
        render(<Revisar {...props({ datos: { filas: [vieja, FILAS[2]] } })} />);
        fireEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));
        expect(within(columna('Fuente')).getAllByRole('checkbox')).toHaveLength(1);
    });
});
