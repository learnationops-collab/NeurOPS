import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Payroll from './Payroll';

/**
 * El detalle de ventas del PDF de Payroll (08/10/2026): una tabla por persona que se ve, con los
 * mismos filtros que los tiles. Se arma solo al imprimir (`beforeprint`) y se va con `afterprint`.
 */

const api = vi.hoisted(() => ({ getPayroll: vi.fn() }));
vi.mock('./finanzasApi', () => api);

const venta = (id, nombre, comision, extra = {}) => ({
    id, nombre_cliente: nombre, date: `2026-09-${String(id).padStart(2, '0')}`, tipo_pago: 'Ace Learners - Completo',
    metodo_pago: 'Stripe', monto_neto: 1000, porcentaje: 8, comision, is_excluded_from_payroll: false, ...extra,
});
const persona = (ventas, pct = 8) => ({
    sales: ventas, porcentaje_comision: pct, total_recaudado_neto: 0,
    comision_total: ventas.filter(v => !v.is_excluded_from_payroll).reduce((t, v) => t + v.comision, 0),
    total_ventas: ventas.filter(v => !v.is_excluded_from_payroll).length,
});
const vacia = persona([]);

const NOMINA = {
    elias: persona([venta(3, 'Cami', 80), venta(1, 'Ana', 80), venta(2, 'Beto', 80, { is_excluded_from_payroll: true })]),
    paula: vacia,
    jeancarlo: persona([venta(1, 'Ana', 100)], 10), facundo: vacia,
    marlon: {
        ...persona([venta(5, 'Eva', 100, { concepto: 'propia', porcentaje: 10 }),
            venta(1, 'Ana', 50, { concepto: 'director', porcentaje: 5 })], null),
        desglose: { director: { porcentaje: 5, comision_total: 50 }, propia: { porcentaje: 10, comision_total: 100 } },
    },
    andy: { ...persona([venta(4, 'Dora', 30, { fuente: 'renovacion', porcentaje: 3 })], null), sueldo_base: 600 },
    dari: vacia, santi: vacia, belu: vacia, pedro: vacia,
    totales: { cash_neto: 4000, cash_bruto: 4000, ventas: 4 },
};

const montar = (props) => render(
    <Payroll desde="2026-09-01" hasta="2026-09-30" onVer={() => {}} tasasAbiertas={false}
        onCerrarTasas={() => {}} grupos={['setting', 'closing', 'fulfillment']} {...props} />,
);

const detalle = async () => {
    await screen.findByText('Elias');
    await act(async () => { window.dispatchEvent(new Event('beforeprint')); });
    return document.querySelector('.fz-detalle');
};
const tabla = (cont, nombre) => within(cont).getByRole('region', { name: `Ventas de ${nombre}` });

describe('Payroll · detalle de ventas del PDF', () => {
    beforeEach(() => api.getPayroll.mockResolvedValue(NOMINA));

    it('lista las ventas de cada persona por fecha, con las excluidas tachadas y el total del tile', async () => {
        montar();
        const elias = tabla(await detalle(), 'Elias');

        const filas = within(elias).getAllByRole('row').slice(1, -1);
        expect(filas.map(f => within(f).getAllByRole('cell')[1].textContent)).toEqual(['Ana', 'Beto', 'Cami']);
        expect(filas[1].className).toContain('fz-excluida');
        expect(within(filas[1]).getByText('Excluida')).toBeTruthy();
        const pie = within(elias).getAllByRole('row').at(-1);
        expect(pie.textContent).toContain('2 ventas suman · 1 excluida');
        expect(pie.textContent).toContain('$160.00');
    });

    it('Fulfillment lleva la fuente de cada venta; quien no tiene ventas lo dice', async () => {
        montar();
        const cont = await detalle();
        expect(within(tabla(cont, 'Andy')).getByText('Renovación')).toBeTruthy();
        // El sueldo fijo del período va en el encabezado: la tabla es solo de comisiones.
        expect(within(tabla(cont, 'Andy')).getByRole('heading').textContent).toContain('sueldo base $600.00');
        expect(within(tabla(cont, 'Elias')).getByRole('heading').textContent).not.toContain('sueldo base');
        expect(within(tabla(cont, 'Paula')).getByText(/Sin ventas/)).toBeTruthy();
    });

    it('las ventas de Marlon dicen si son propias o de director, cada una con su %', async () => {
        montar();
        const marlon = tabla(await detalle(), 'Marlon');

        expect(within(marlon).getByRole('heading').textContent).toContain('propia 10% · director 5%');
        expect(within(marlon).getByRole('columnheader', { name: 'Concepto' })).toBeTruthy();
        const filas = within(marlon).getAllByRole('row').slice(1, -1);
        expect(filas.map(f => within(f).getAllByRole('cell')[4].textContent)).toEqual(['Director', 'Propia']);
        expect(within(marlon).getAllByRole('row').at(-1).textContent).toContain('$150.00');
    });

    it('sigue a los filtros: solo los grupos prendidos y las personas elegidas', async () => {
        montar({ grupos: ['setting', 'closing'], personas: ['elias', 'andy'] });
        const cont = await detalle();
        const nombres = within(cont).getAllByRole('region').map(r => r.getAttribute('aria-label'));
        // Andy está elegida pero Fulfillment está apagado.
        expect(nombres).toEqual(['Ventas de Elias']);
    });

    it('no está en la página hasta que se imprime, y se va al terminar', async () => {
        montar();
        await screen.findByText('Elias');
        expect(document.querySelector('.fz-detalle')).toBeNull();

        await act(async () => { window.dispatchEvent(new Event('beforeprint')); });
        expect(document.querySelector('.fz-detalle')).not.toBeNull();
        await act(async () => { window.dispatchEvent(new Event('afterprint')); });
        expect(document.querySelector('.fz-detalle')).toBeNull();
    });
});
