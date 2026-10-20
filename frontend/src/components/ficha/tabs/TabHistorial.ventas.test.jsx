import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabHistorial from './TabHistorial';
import { fichaPrecall } from '../__fixtures__/ficha';

// Ventas, pagos y suscripciones (20/10/2026): cada pago es de una venta. La fila dice de cuál (si
// el cliente tiene más de una), «Agregar pago» deja elegirla o dejarla «Automática», y corregir un
// pago lo puede mover a otra venta del mismo programa.

const ALTA = { id: 11, program_code: 'RR', kind: 'new', sold_at: '2026-03-01T00:00:00' };
const RENOVACION = { id: 12, program_code: 'RR', kind: 'renewal', sold_at: '2026-08-01T00:00:00' };
const DE_AL = { id: 13, program_code: 'AL', kind: 'new', sold_at: '2026-05-01T00:00:00' };

const CUOTA = {
    id: 903, fecha: '2026-09-15T00:00:00', medio: 'Stripe', monto: 300, tipo: 'cuota',
    tipo_pago: 'RR - Cuota', programa_code: 'RR', sale_id: 12,
};

const VOCABULARIO = {
    ...fichaPrecall.vocabulario,
    medios_pago_venta: [{ clave: 'Stripe', label: 'Stripe' }],
    programas: [{ clave: 'RR', label: 'Residency Roadmap' }, { clave: 'AL', label: 'Ace Learners' }],
    tipos_pago_venta: [{ clave: 'cuota', label: 'Cuota' }, { clave: 'parcial', label: 'Parcial' }],
};

const conVentas = (ventas, pagos = [CUOTA]) => ({
    ...fichaPrecall,
    vocabulario: VOCABULARIO,
    cobro: { ...fichaPrecall.cobro, pagos, ventas, programa_code: 'RR', pagado: 300 },
});

const abrir = async (usuario, f, onAccion = vi.fn().mockResolvedValue({})) => {
    render(<TabHistorial ficha={f} onAccion={onAccion} />);
    await usuario.click(screen.getByRole('button', { name: /^Pagos/ }));
    return onAccion;
};

describe('las ventas en la sección Pagos', () => {
    it('con más de una venta, la fila dice de cuál es el pago', async () => {
        const usuario = userEvent.setup();
        await abrir(usuario, conVentas([ALTA, RENOVACION]));

        expect(screen.getByText('Residency Roadmap · Stripe · venta Renovación · 1 ago 2026')).toBeInTheDocument();
    });

    it('con una sola venta no lo repite, y sin ventas no aparece el campo', async () => {
        const usuario = userEvent.setup();
        await abrir(usuario, conVentas([], [{ ...CUOTA, sale_id: null }]));

        expect(screen.getByText('Residency Roadmap · Stripe')).toBeInTheDocument();
        await usuario.click(screen.getByRole('button', { name: 'Agregar pago' }));
        expect(screen.queryByLabelText('Venta del pago')).not.toBeInTheDocument();
    });

    it('«Agregar pago» arranca en Automática, lista las ventas del programa y manda la elegida', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrir(usuario, conVentas([ALTA, RENOVACION, DE_AL]));
        await usuario.click(screen.getByRole('button', { name: 'Agregar pago' }));
        const formulario = screen.getByRole('group', { name: 'Agregar un pago' });
        const venta = within(formulario).getByLabelText('Venta del pago');

        expect(venta).toHaveValue('');
        expect([...venta.options].map(o => o.textContent)).toEqual([
            'Automática · por el tipo y la fecha',
            'Residency Roadmap · Alta · 1 mar 2026',
            'Residency Roadmap · Renovación · 1 ago 2026',
        ]);
        await usuario.selectOptions(venta, '11');
        await usuario.type(within(formulario).getByLabelText('Monto'), '250');
        await usuario.click(within(formulario).getByRole('button', { name: 'Agregar pago' }));

        expect(onAccion).toHaveBeenCalledWith('agregar_pago', expect.objectContaining({ sale_id: 11, monto: 250 }));
    });

    it('en Automática no manda venta', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrir(usuario, conVentas([ALTA]));
        await usuario.click(screen.getByRole('button', { name: 'Agregar pago' }));
        const formulario = screen.getByRole('group', { name: 'Agregar un pago' });
        await usuario.type(within(formulario).getByLabelText('Monto'), '250');
        await usuario.click(within(formulario).getByRole('button', { name: 'Agregar pago' }));

        expect(onAccion.mock.calls[0][1]).not.toHaveProperty('sale_id');
    });

    it('corregir un pago lo mueve a otra venta con un pedido que lleva solo eso', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrir(usuario, conVentas([ALTA, RENOVACION]));
        await usuario.click(screen.getByRole('button', { name: /Corregir el pago de \$300/ }));
        const editor = screen.getByRole('group', { name: /Corregir el pago/ });
        const venta = within(editor).getByLabelText('Venta del pago');

        expect(venta).toHaveValue('12');
        await usuario.selectOptions(venta, '11');
        await usuario.click(within(editor).getByRole('button', { name: 'Guardar cambios' }));

        expect(onAccion).toHaveBeenCalledWith('corregir_pago', { pago_id: 903, sale_id: 11 });
    });

    it('si se cambia el programa, la venta de otro programa vuelve a Automática y no viaja', async () => {
        const usuario = userEvent.setup();
        const onAccion = await abrir(usuario, conVentas([ALTA, RENOVACION]));
        await usuario.click(screen.getByRole('button', { name: /Corregir el pago de \$300/ }));
        const editor = screen.getByRole('group', { name: /Corregir el pago/ });
        await usuario.selectOptions(within(editor).getByLabelText('Programa del pago'), 'AL');

        expect(within(editor).getByLabelText('Venta del pago')).toHaveValue('');
        await usuario.click(within(editor).getByRole('button', { name: 'Guardar cambios' }));
        expect(onAccion).toHaveBeenCalledWith('corregir_pago', { pago_id: 903, programa_code: 'AL' });
    });
});
