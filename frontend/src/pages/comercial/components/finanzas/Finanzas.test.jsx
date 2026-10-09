import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Finanzas from './Finanzas';

/**
 * Finanzas del dashboard comercial (08/10/2026). La nómina guarda solo el campo que cambió: antes
 * mandaba la fila entera y congelaba la comisión del momento (tildar «pagado» o tocar el sueldo la
 * guardaba, y cambiar los % en Payroll después ya no se reflejaba). Una comisión escrita a mano
 * queda marcada «manual» y se vuelve a la calculada desde la marca.
 */

const api = vi.hoisted(() => ({
    getNomina: vi.fn(),
    guardarNomina: vi.fn(),
}));
vi.mock('./finanzasApi', () => api);

const fila = (campos) => ({
    id: null, month: '2026-09', base_salary: 0, commissions: 0, bonuses: 0, payment_method: 'Mercury',
    is_paid: false, paid_at: null, created_at: null, ...campos,
});
const KERWIN = fila({ member_id: 1, member_name: 'Kerwin', base_salary: 1000, payment_method: 'AirTM' });
const ELIAS = fila({ member_id: 2, member_name: 'Elias', commissions: 80, commissions_auto: 80, commissions_manual: false });
const INTEGRANTES = [
    { id: 1, name: 'Kerwin', role: 'Operaciones', salary_type: 'fijo' },
    { id: 2, name: 'Elias', role: 'Setter', salary_type: 'variable' },
];

const montarNomina = async (nomina) => {
    api.getNomina.mockResolvedValue({ nomina, integrantes: INTEGRANTES });
    render(<Finanzas tab="nomina" mes="2026-09" />);
    await screen.findByText('Kerwin');
};

describe('Finanzas · Nómina', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.guardarNomina.mockImplementation(async (cambio) => ({ ...[KERWIN, ELIAS].find(f => f.member_id === cambio.member_id), ...cambio }));
    });

    it('tildar «pagado» o tocar el sueldo manda solo ese campo, no la comisión del momento', async () => {
        await montarNomina([KERWIN, ELIAS]);

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Marcar como pagado a Kerwin' })); });
        expect(api.guardarNomina).toHaveBeenLastCalledWith({ member_id: 1, month: '2026-09', is_paid: true });

        const sueldo = screen.getByRole('spinbutton', { name: 'Sueldo base de Elias' });
        await act(async () => {
            fireEvent.change(sueldo, { target: { value: '150' } });
            fireEvent.blur(sueldo);
        });
        expect(api.guardarNomina).toHaveBeenLastCalledWith({ member_id: 2, month: '2026-09', base_salary: 150 });
    });

    it('una comisión a mano queda marcada «manual», y la marca vuelve a la calculada', async () => {
        await montarNomina([KERWIN, ELIAS]);
        expect(screen.queryByRole('button', { name: /Volver a la comisión calculada/ })).toBeNull();

        api.guardarNomina.mockResolvedValueOnce({ ...ELIAS, commissions: 120, commissions_manual: true });
        const comision = screen.getByRole('spinbutton', { name: 'Comisión de Elias' });
        await act(async () => {
            fireEvent.change(comision, { target: { value: '120' } });
            fireEvent.blur(comision);
        });
        expect(api.guardarNomina).toHaveBeenLastCalledWith({ member_id: 2, month: '2026-09', commissions: 120 });

        const marca = screen.getByRole('button', { name: 'Volver a la comisión calculada de Elias ($80.00)' });
        expect(marca.textContent).toBe('manual');
        expect(marca.title).toMatch('La calculada es $80.00');

        api.guardarNomina.mockResolvedValueOnce({ ...ELIAS, commissions: 80, commissions_manual: false });
        await act(async () => { fireEvent.click(marca); });
        expect(api.guardarNomina).toHaveBeenLastCalledWith({ member_id: 2, month: '2026-09', commissions_manual: false });
        expect(screen.queryByRole('button', { name: /Volver a la comisión calculada/ })).toBeNull();
        expect(screen.getByRole('spinbutton', { name: 'Comisión de Elias' }).value).toBe('80');
    });

    it('sin los campos nuevos (backend viejo) no hay marca y todo sigue andando', async () => {
        const vieja = { ...ELIAS };
        delete vieja.commissions_auto;
        delete vieja.commissions_manual;
        await montarNomina([KERWIN, vieja]);

        expect(screen.getByRole('spinbutton', { name: 'Comisión de Elias' }).value).toBe('80');
        expect(screen.queryByRole('button', { name: /Volver a la comisión calculada/ })).toBeNull();
    });
});
