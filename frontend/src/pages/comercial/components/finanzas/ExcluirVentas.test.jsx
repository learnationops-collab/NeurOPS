import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Payroll from './Payroll';

/**
 * «Excluir ventas» de Payroll (08/10/2026): la casilla que saca una venta de la nómina volvió, en
 * un modal con UNA lista de ventas (sacarla la saca para todos los que cobran sobre ella).
 */

const api = vi.hoisted(() => ({ getPayroll: vi.fn(), marcarExclusion: vi.fn() }));
vi.mock('./finanzasApi', () => api);

const venta = (id, nombre, comision, excluida = false) => ({
    id, nombre_cliente: nombre, date: `2026-09-${String(id).padStart(2, '0')}`, tipo_pago: 'Ace Learners - Completo',
    monto_neto: 1000, is_excluded_from_payroll: excluida, comision,
});
const persona = (ventas) => ({
    sales: ventas, total_recaudado_neto: 0, porcentaje_comision: 10,
    comision_total: ventas.filter(v => !v.is_excluded_from_payroll).reduce((t, v) => t + v.comision, 0),
    total_ventas: ventas.filter(v => !v.is_excluded_from_payroll).length,
});
const vacia = persona([]);

const nomina = (excluidaAna = false) => ({
    elias: persona([venta(1, 'Ana', 80, excluidaAna)]), paula: vacia,
    jeancarlo: persona([venta(1, 'Ana', 100, excluidaAna), venta(2, 'Beto', 100, true)]), facundo: vacia,
    marlon: persona([venta(1, 'Ana', 50, excluidaAna)]),
    andy: vacia, dari: vacia, santi: vacia, belu: vacia, pedro: vacia,
    totales: { cash_neto: 2000, cash_bruto: 2000, ventas: 2 },
});

const montar = () => render(
    <Payroll desde="2026-09-01" hasta="2026-09-30" grupos={['setting', 'closing', 'fulfillment']}
        onVer={() => {}} tasasAbiertas={false} onCerrarTasas={() => {}}
        excluirAbierto onCerrarExcluir={() => {}} />,
);

describe('Payroll · Excluir ventas', () => {
    beforeEach(() => {
        api.getPayroll.mockReset().mockResolvedValue(nomina());
        api.marcarExclusion.mockReset().mockResolvedValue({});
    });

    it('lista cada venta una vez, con quiénes cobran y cuánto suma entre todos', async () => {
        montar();
        const modal = await screen.findByRole('dialog', { name: 'Excluir ventas de la nómina' });

        const ana = within(modal).getByText('Ana').closest('.fz-fila');
        expect(within(ana).getByText('Elias, Jean Carlo, Marlon')).toBeTruthy();
        expect(within(ana).getByText('$230.00')).toBeTruthy();
        expect(within(modal).getAllByText('Ana')).toHaveLength(1);
        // Beto ya estaba afuera: se ve tachado y su casilla apagada.
        expect(within(modal).getByText('Beto').closest('.fz-fila').className).toContain('fz-excluida');
        expect(within(modal).getByRole('button', { name: 'Volver a sumar la venta de Beto' }))
            .toHaveAttribute('aria-pressed', 'false');
    });

    it('destildar una venta la guarda en el momento y recalcula la nómina', async () => {
        montar();
        const modal = await screen.findByRole('dialog', { name: 'Excluir ventas de la nómina' });
        api.getPayroll.mockResolvedValue(nomina(true));

        await act(async () => {
            fireEvent.click(within(modal).getByRole('button', { name: 'Sacar de la nómina la venta de Ana' }));
        });

        expect(api.marcarExclusion).toHaveBeenCalledWith(1, true);
        expect(api.getPayroll).toHaveBeenCalledTimes(2);
        expect(within(modal).getByRole('button', { name: 'Volver a sumar la venta de Ana' })).toBeTruthy();
    });

    it('si no se pudo guardar, la casilla vuelve a como estaba', async () => {
        api.marcarExclusion.mockRejectedValue(new Error('500'));
        montar();
        const modal = await screen.findByRole('dialog', { name: 'Excluir ventas de la nómina' });

        await act(async () => {
            fireEvent.click(within(modal).getByRole('button', { name: 'Sacar de la nómina la venta de Ana' }));
        });

        expect(within(modal).getByRole('button', { name: 'Sacar de la nómina la venta de Ana' }))
            .toHaveAttribute('aria-pressed', 'true');
    });

    it('«Excluidas» deja solo las que no suman', async () => {
        montar();
        const modal = await screen.findByRole('dialog', { name: 'Excluir ventas de la nómina' });

        await act(async () => { fireEvent.click(within(modal).getByRole('tab', { name: /Excluidas · 1/ })); });

        expect(within(modal).queryByText('Ana')).toBeNull();
        expect(within(modal).getByText('Beto')).toBeTruthy();
    });
});
