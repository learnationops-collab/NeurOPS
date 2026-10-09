import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Finanzas from './Finanzas';

/**
 * Finanzas del dashboard comercial (08/10/2026).
 *
 * - La nómina guarda solo el campo que cambió: antes mandaba la fila entera y congelaba la comisión
 *   del momento (tildar «pagado» o tocar el sueldo la guardaba, y cambiar los % en Payroll después
 *   ya no se reflejaba). Una comisión escrita a mano queda marcada «manual» y se vuelve a la
 *   calculada desde la marca.
 * - Con un período que no es justo un mes, los libros mensuales se ven sumados y no se editan.
 */

const api = vi.hoisted(() => ({
    getNomina: vi.fn(),
    getNominas: vi.fn(),
    guardarNomina: vi.fn(),
    getSaldos: vi.fn(),
    getAnuncios: vi.fn(),
    getResumen: vi.fn(),
    getAhorros: vi.fn(),
    getGastosSoftware: vi.fn(),
    crearGasto: vi.fn(),
    getProcedencia: vi.fn(() => new Promise(() => {})),
}));
vi.mock('./finanzasApi', () => api);

const SEPTIEMBRE = { desde: '2026-09-01', hasta: '2026-09-30', mes: '2026-09' };
// Del 16/09 al 15/10: la mitad de septiembre y 15 de los 31 días de octubre.
const CORTADO = { desde: '2026-09-16', hasta: '2026-10-15', mes: null };

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

/** El texto de cada celda de la fila de la tabla que empieza con `nombre`. */
const celdas = (nombre) => [...screen.getAllByText(nombre).map(n => n.closest('.fz-fila')).find(Boolean).children]
    .map(c => c.textContent);

// Las cifras cuentan hasta su valor (`Cifra`): lo que cambia se espera con `waitFor`.
const cifra = (rotulo) => screen.getByText(rotulo, { selector: '.t-eyebrow' }).closest('.kpi').querySelector('.kpi-n').textContent;

const montarNomina = async (nomina) => {
    api.getNomina.mockResolvedValue({ nomina, integrantes: INTEGRANTES });
    render(<Finanzas tab="nomina" periodo={SEPTIEMBRE} />);
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

    it('arriba van el total, lo pagado y lo que falta pagar, y siguen a los tildes', async () => {
        await montarNomina([KERWIN, ELIAS]);
        await waitFor(() => expect(cifra('Total del mes')).toBe('$1,080.00'));
        await waitFor(() => expect(cifra('Por pagar')).toBe('$1,080.00'));
        expect(cifra('Pagado')).toBe('$0.00');

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Marcar como pagado a Kerwin' })); });

        await waitFor(() => expect(cifra('Pagado')).toBe('$1,000.00'));
        await waitFor(() => expect(cifra('Por pagar')).toBe('$80.00'));
        // Uno pagado y uno por pagar.
        expect(screen.getAllByText('1 de 2 integrantes', { selector: '.kpi-sub' })).toHaveLength(2);
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

describe('Finanzas · un período que no es un mes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('la nómina se suma por integrante, el mes cortado proporcional a sus días, y no se edita', async () => {
        api.getNominas.mockResolvedValue({
            nominas: [
                [{ ...KERWIN, is_paid: true }, ELIAS],
                [{ ...KERWIN, month: '2026-10' }, { ...ELIAS, month: '2026-10', commissions: 62 }],
            ],
            integrantes: INTEGRANTES,
        });
        render(<Finanzas tab="nomina" periodo={CORTADO} />);
        await screen.findByText('Kerwin');

        expect(api.getNominas).toHaveBeenCalledWith(['2026-09', '2026-10']);
        // Kerwin: 1000 × 15/30 + 1000 × 15/31; Elias: 80 × 15/30 + 62 × 15/31. Medio, el del último mes.
        expect(celdas('Kerwin')).toEqual(['KerwinOperaciones', '$983.87', '$0.00', '$0.00', '$983.87', 'AirTM', 'Parcial']);
        expect(celdas('Elias')).toEqual(['EliasSetter', '$0.00', '$70.00', '$0.00', '$70.00', 'Mercury', 'Pendiente']);
        await waitFor(() => expect(cifra('Total del período')).toBe('$1,053.87'));
        await waitFor(() => expect(cifra('Pagado')).toBe('$500.00'));   // el septiembre tildado de Kerwin
        await waitFor(() => expect(cifra('Por pagar')).toBe('$553.87'));
        expect(screen.getByText('Parcial').title).toBe('Pagado en 1 de 2 meses');

        expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
        expect(screen.queryByRole('button', { name: /Marcar como pagado/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /Nuevo integrante/ })).toBeNull();
        expect(screen.getByText('Se edita por mes: elegí un mes en el período')).toBeTruthy();
    });

    it('los saldos y los anuncios se piden por el rango y se ven sin campos', async () => {
        api.getSaldos.mockResolvedValue({ balances: [
            { payment_method: 'Mercury', actual_amount: 800, expected_amount: 500, id: null },
            { payment_method: 'AirTM', actual_amount: 0, expected_amount: 983.87, id: null },
        ] });
        const { unmount } = render(<Finanzas tab="medios" periodo={CORTADO} />);
        await screen.findByText('Mercury');

        expect(api.getSaldos).toHaveBeenCalledWith(CORTADO);
        expect(screen.queryByRole('spinbutton', { name: 'Saldo actual de Mercury' })).toBeNull();
        expect(celdas('Mercury')).toEqual(['Mercury', '$800.00', '$500.00', '+$300.00']);
        expect(screen.getByText('Se edita por mes: elegí un mes en el período')).toBeTruthy();
        unmount();

        api.getAnuncios.mockResolvedValue({ budget: 300, spent: 60 });
        render(<Finanzas tab="anuncios" periodo={CORTADO} />);
        await screen.findByText('Presupuesto (A)');
        expect(api.getAnuncios).toHaveBeenCalledWith(CORTADO);
        expect(screen.queryByRole('spinbutton', { name: 'Presupuesto de anuncios' })).toBeNull();
        expect(screen.getByText('Se edita por mes: elegí un mes en el período')).toBeTruthy();
    });

    it('con justo un mes los saldos se editan, como siempre', async () => {
        api.getSaldos.mockResolvedValue({ balances: [
            { payment_method: 'Mercury', actual_amount: 1000, expected_amount: 500, id: 3 },
        ] });
        render(<Finanzas tab="medios" periodo={SEPTIEMBRE} />);

        expect(await screen.findByRole('spinbutton', { name: 'Saldo actual de Mercury' })).toBeTruthy();
        expect(screen.queryByText('Se edita por mes: elegí un mes en el período')).toBeNull();
    });

    it('en el resumen los ahorros se ven pero no se editan', async () => {
        api.getResumen.mockResolvedValue({
            kpis: { total_income: 500, total_expenses: 350, profit: 150, balance: 150, balance_neto: 150, savings: 0 },
            expenses_breakdown: { software: 50, anuncios: 300, sueldos: 0 }, income_breakdown: [],
        });
        api.getAhorros.mockResolvedValue({ savings: 0 });
        render(<Finanzas tab="resumen" periodo={CORTADO} />);
        await screen.findByText('Balance del período');

        expect(api.getResumen).toHaveBeenCalledWith(CORTADO);
        expect(api.getAhorros).toHaveBeenCalledWith(CORTADO);
        expect(screen.queryByRole('spinbutton', { name: 'Ahorros del mes' })).toBeNull();
        expect(screen.getByText('Se edita por mes: elegí un mes en el período')).toBeTruthy();
        expect(screen.getByText('No hubo ingresos en este período.')).toBeTruthy();
    });

    it('el software se pide por el período, y el gasto nuevo arranca dentro de él', async () => {
        const enero = { desde: '2025-01-01', hasta: '2025-01-31', mes: '2025-01' };
        api.getGastosSoftware.mockResolvedValue([]);
        render(<Finanzas tab="software" periodo={enero} />);
        await screen.findByText('No hay gastos de software en este período.');

        expect(api.getGastosSoftware).toHaveBeenCalledWith(enero);
        // Hoy cae después de enero de 2025: arranca en la última punta del período.
        expect(screen.getByLabelText('Fecha de pago').value).toBe('2025-01-31');
    });

    it('un período de más de 24 meses no pide nada y lo dice', () => {
        render(<Finanzas tab="resumen" periodo={{ desde: '2024-01-01', hasta: '2026-01-01', mes: null }} />);

        expect(screen.getByText('El período no puede pasar de 24 meses: elegí uno más corto.')).toBeTruthy();
        expect(api.getResumen).not.toHaveBeenCalled();
    });
});
