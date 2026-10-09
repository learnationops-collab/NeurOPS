import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VentasDePersona from './VentasDePersona';
import { GRUPOS } from './Payroll';

/**
 * Las ventas de una persona de Payroll (08/10/2026), abiertas desde su tile sin salir de /finanzas:
 * cada fila con su concepto, su % y su comisión, quién está atribuido, la casilla de la nómina y el
 * cambio de setter o closer, que se confirma ahí mismo.
 */

const api = vi.hoisted(() => ({
    marcarExclusion: vi.fn(), getPersonasAtribuibles: vi.fn(), cambiarAtribucion: vi.fn(),
}));
vi.mock('./finanzasApi', () => api);

const quien = (id) => GRUPOS.flatMap(g => g.personas).find(p => p.id === id);

const venta = (id, extra = {}) => ({
    id, date: `2026-09-${String(id).padStart(2, '0')}`, nombre_cliente: `Cliente ${id}`, tipo_pago: 'RR - Completo',
    monto_neto: 1000, porcentaje: 10, comision: 100, setter: 'Elias', closer: 'Jean Carlo',
    is_excluded_from_payroll: false, ...extra,
});

const datosDe = (ventas, extra = {}) => ({
    sales: ventas, porcentaje_comision: 10,
    comision_total: ventas.filter(v => !v.is_excluded_from_payroll).reduce((t, v) => t + v.comision, 0),
    total_recaudado_neto: ventas.filter(v => !v.is_excluded_from_payroll).reduce((t, v) => t + v.monto_neto, 0),
    total_ventas: ventas.filter(v => !v.is_excluded_from_payroll).length, ...extra,
});

const PERSONAS = {
    setters: [{ id: 21, nombre: 'Elias', activo: true }, { id: 22, nombre: 'Paula', activo: true }],
    closers: [{ id: 11, nombre: 'Facundo', activo: true }, { id: 4, nombre: 'Jean Carlo', activo: true },
        { id: 13, nombre: 'Nerina', activo: false }],
};

const montar = (persona, datos, onCambio = vi.fn(), onVolver = vi.fn()) => render(
    <div className="dc-shell">
        <VentasDePersona persona={quien(persona)} datos={datos} desde="2026-09-01" hasta="2026-09-30"
            onVolver={onVolver} onCambio={onCambio} />
    </div>,
);

const fila = (cliente) => screen.getByText(cliente).closest('.fz-fila');

describe('VentasDePersona', () => {
    beforeEach(() => {
        api.marcarExclusion.mockReset().mockResolvedValue({});
        api.getPersonasAtribuibles.mockReset().mockResolvedValue(PERSONAS);
        api.cambiarAtribucion.mockReset().mockResolvedValue({});
    });

    it('lo que recibió por transferencia va arriba en rojo y aparte, con lo que queda por pagarle', () => {
        montar('jeancarlo', datosDe([venta(3)], {
            sueldo_base: 0, transferencias_recibidas: 150, a_pagar: -50,
            transferencias: [{ id: 9, date: '2026-09-09T00:00:00', nombre_cliente: 'Ana Gomez', tipo_pago: 'RR - Seña',
                metodo_pago: 'Transferencia Bancaria', monto: 150 }],
        }));

        // En la cifra de la comisión, como en su tile.
        expect(screen.getByText(/^descuentos /, { selector: '.kpi-sub .fz-persona-descuento' }).textContent)
            .toBe('descuentos -$150.00 · debe devolver $50.00');
        const panel = screen.getByText('Descuentos · transferencias recibidas', { selector: '.t-h3, h2, h3, p, span' }).closest('.panel');
        expect([...within(panel).getByText('Ana Gomez').closest('.fz-fila').children].map(c => c.textContent))
            .toEqual(['09/09', 'Ana GomezRR - Seña', 'Transferencia Bancaria', '-$150.00']);
        expect(within(panel).getByText(/Descuentos · debe devolver \$50\.00/)).toBeTruthy();
    });

    it('sin transferencias recibidas no hay nada aparte', () => {
        montar('jeancarlo', datosDe([venta(3)]));

        expect(screen.queryByText('Descuentos · transferencias recibidas')).toBeNull();
        expect(document.querySelector('.fz-persona-descuento')).toBeNull();
    });

    it('cada fila trae fecha, cliente, concepto, setter y closer, neto, % y comisión; el pie suma lo que suma', () => {
        montar('jeancarlo', datosDe([venta(3), venta(5, { comision: 50, monto_neto: 500, setter: 'Paula' }),
            venta(7, { is_excluded_from_payroll: true })]));

        const celdas = (cliente) => [...fila(cliente).children].map(c => c.textContent);
        // De la más nueva a la más vieja, como «Excluir ventas».
        expect(screen.getAllByText(/^Cliente \d$/).map(n => n.textContent)).toEqual(['Cliente 7', 'Cliente 5', 'Cliente 3']);
        expect(celdas('Cliente 5').slice(1, 9)).toEqual(
            ['05/09', 'Cliente 5RR - Completo', 'Propia', 'Paula', 'Jean Carlo', '$500.00', '10%', '$50.00']);
        // La excluida se ve, tachada, y no suma: el pie dice lo mismo que el tile.
        expect(fila('Cliente 7').className).toContain('fz-excluida');
        const pie = screen.getByText(/ventas suman/).closest('.fz-fila');
        expect(pie.textContent).toBe('2 ventas suman · 1 excluida$1,500.00$150.00');
        expect(screen.getByRole('button', { name: /Volver a Payroll/ })).toBeTruthy();
    });

    it('en Marlon el concepto es su partida, y Fulfillment no tiene atribución que editar', () => {
        const { unmount } = montar('marlon', datosDe([venta(1, { concepto: 'propia' }), venta(2, { concepto: 'director', porcentaje: 5, comision: 50 })],
            { porcentaje_comision: null, desglose: { propia: { porcentaje: 10, comision_total: 100 }, director: { porcentaje: 5, comision_total: 50 } } }));
        expect(fila('Cliente 1').children[3].textContent).toBe('Propia');
        expect(fila('Cliente 2').children[3].textContent).toBe('Director');
        expect(screen.getByText('propias · director')).toBeTruthy();
        unmount();

        montar('andy', datosDe([venta(1, { fuente: 'renovacion', porcentaje: 2, comision: 20 })], { porcentaje_comision: null }));
        expect(fila('Cliente 1').children[3].textContent).toBe('Renovación');
        expect(screen.queryByRole('button', { name: /Cambiar la atribución/ })).toBeNull();
        expect(screen.getByRole('button', { name: 'Sacar de la nómina la venta de Cliente 1' })).toBeTruthy();
    });

    it('el buscador filtra por cliente, programa, setter o closer, sin tildes, y el pie suma lo que coincide', () => {
        montar('jeancarlo', datosDe([
            venta(1, { nombre_cliente: 'Ana Pérez' }),
            venta(2, { nombre_cliente: 'Bruno Díaz', tipo_pago: 'AL - Cuota', setter: 'Paula', comision: 30, monto_neto: 300 }),
            venta(3, { nombre_cliente: 'Carla Paz', setter: 'Paula', is_excluded_from_payroll: true }),
        ]));
        const buscar = screen.getByRole('searchbox', { name: 'Buscar en las ventas de Jean Carlo' });
        const clientes = () => screen.queryAllByText(/^(Ana|Bruno|Carla) /).map(n => n.textContent);

        fireEvent.change(buscar, { target: { value: 'perez' } });
        expect(clientes()).toEqual(['Ana Pérez']);

        // Por setter: la excluida aparece, tachada, pero el pie solo suma la que suma.
        fireEvent.change(buscar, { target: { value: 'PAULA' } });
        expect(clientes()).toEqual(['Carla Paz', 'Bruno Díaz']);
        expect(screen.getByText(/coinciden/).closest('.fz-fila').textContent).toBe('2 de 3 coinciden · 1 suma$300.00$30.00');

        fireEvent.change(buscar, { target: { value: 'al - cuota' } });
        expect(clientes()).toEqual(['Bruno Díaz']);

        fireEvent.change(buscar, { target: { value: 'zzz' } });
        expect(clientes()).toEqual([]);
        expect(screen.getByText('Ninguna venta coincide con «zzz».')).toBeTruthy();

        // Vacío otra vez: todas, y el pie vuelve a los totales del tile.
        fireEvent.change(buscar, { target: { value: '' } });
        expect(clientes()).toHaveLength(3);
        expect(screen.getByText(/ventas suman/).closest('.fz-fila').textContent).toBe('2 ventas suman · 1 excluida$1,300.00$130.00');
    });

    it('sin ventas no hay buscador', () => {
        montar('elias', datosDe([]));
        expect(screen.queryByRole('searchbox')).toBeNull();
        expect(screen.getByText('Sin ventas que le paguen comisión en este período.')).toBeTruthy();
    });

    it('la casilla saca la venta de la nómina o la vuelve a sumar, con el valor explícito, y recalcula', async () => {
        const onCambio = vi.fn();
        montar('elias', datosDe([venta(1), venta(2, { is_excluded_from_payroll: true })]), onCambio);

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sacar de la nómina la venta de Cliente 1' })); });
        expect(api.marcarExclusion).toHaveBeenCalledWith(1, true);
        expect(fila('Cliente 1').className).toContain('fz-excluida');
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Volver a sumar la venta de Cliente 2' })); });
        expect(api.marcarExclusion).toHaveBeenLastCalledWith(2, false);
        expect(onCambio).toHaveBeenCalledTimes(2);
    });

    it('si guardar la casilla falla, la fila vuelve a como estaba', async () => {
        api.marcarExclusion.mockRejectedValue(new Error('500'));
        const onCambio = vi.fn();
        montar('elias', datosDe([venta(1)]), onCambio);

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sacar de la nómina la venta de Cliente 1' })); });
        expect(fila('Cliente 1').className).not.toContain('fz-excluida');
        expect(onCambio).not.toHaveBeenCalled();
    });

    it('cambiar la atribución se abre debajo de la fila, avisa, y guarda recién al confirmar, con el período', async () => {
        const onCambio = vi.fn();
        montar('jeancarlo', datosDe([venta(1), venta(2)]), onCambio);

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cambiar la atribución de la venta de Cliente 1' })); });
        const editor = screen.getByRole('group', { name: 'Atribución de la venta de Cliente 1' });
        await waitFor(() => expect(within(editor).getByText(/Cambia también las métricas comerciales/)).toBeTruthy());
        expect(api.getPersonasAtribuibles).toHaveBeenCalledTimes(1);
        // Arranca en lo que tiene la venta, y sin cambios no hay nada que confirmar.
        expect(within(editor).getByRole('combobox', { name: 'Setter' }).value).toBe('21');
        expect(within(editor).getByRole('combobox', { name: 'Closer' }).value).toBe('4');
        const confirmar = within(editor).getByRole('button', { name: 'Cambiar atribución' });
        expect(confirmar).toBeDisabled();
        expect(within(editor).getByRole('option', { name: 'Nerina (inactiva)' })).toBeTruthy();

        fireEvent.change(within(editor).getByRole('combobox', { name: 'Closer' }), { target: { value: '11' } });
        expect(api.cambiarAtribucion).not.toHaveBeenCalled();
        await act(async () => { fireEvent.click(confirmar); });

        expect(api.cambiarAtribucion).toHaveBeenCalledWith(1, { closer_id: 11, desde: '2026-09-01', hasta: '2026-09-30' });
        expect(onCambio).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('group', { name: 'Atribución de la venta de Cliente 1' })).toBeNull();
    });

    it('«Cancelar» cierra sin guardar, y un nombre que no está entre las personas se ve como el actual', async () => {
        montar('elias', datosDe([venta(1, { setter: 'workshop' })]));

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cambiar la atribución de la venta de Cliente 1' })); });
        const editor = screen.getByRole('group', { name: 'Atribución de la venta de Cliente 1' });
        await waitFor(() => expect(within(editor).getByRole('combobox', { name: 'Setter' })).not.toBeDisabled());
        const setter = within(editor).getByRole('combobox', { name: 'Setter' });
        expect(setter.value).toBe('');
        expect(within(setter).getByRole('option', { name: 'workshop' })).toBeDisabled();

        fireEvent.change(setter, { target: { value: '22' } });
        expect(within(editor).getByRole('button', { name: 'Cambiar atribución' })).not.toBeDisabled();
        await act(async () => { fireEvent.click(within(editor).getByRole('button', { name: 'Cancelar' })); });
        expect(screen.queryByRole('group', { name: 'Atribución de la venta de Cliente 1' })).toBeNull();
        expect(api.cambiarAtribucion).not.toHaveBeenCalled();
    });

    it('si el cambio falla, el editor queda abierto con lo elegido', async () => {
        api.cambiarAtribucion.mockRejectedValue({ response: { data: { error: 'La persona elegida no es setter.' } } });
        const onCambio = vi.fn();
        montar('elias', datosDe([venta(1)]), onCambio);

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cambiar la atribución de la venta de Cliente 1' })); });
        const editor = screen.getByRole('group', { name: 'Atribución de la venta de Cliente 1' });
        await waitFor(() => expect(within(editor).getByRole('combobox', { name: 'Setter' })).not.toBeDisabled());
        fireEvent.change(within(editor).getByRole('combobox', { name: 'Setter' }), { target: { value: '22' } });
        await act(async () => { fireEvent.click(within(editor).getByRole('button', { name: 'Cambiar atribución' })); });

        expect(api.cambiarAtribucion).toHaveBeenCalledWith(1, { setter_id: 22, desde: '2026-09-01', hasta: '2026-09-30' });
        expect(onCambio).not.toHaveBeenCalled();
        expect(within(editor).getByRole('combobox', { name: 'Setter' }).value).toBe('22');
    });
});
