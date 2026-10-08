import React, { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Payroll, { FiltroGrupos, GRUPOS } from './Payroll';

/**
 * Payroll (08/10/2026): los tiles de cada persona, el cash del período arriba, el filtro por grupos
 * y el clic que lleva a sus ventas en Revisar. La lista de ventas que tenía abajo se sacó a pedido.
 */

const api = vi.hoisted(() => ({ getPayroll: vi.fn() }));
vi.mock('./finanzasApi', () => api);

const persona = (comision, ventas = []) => ({
    sales: ventas, total_recaudado_neto: comision * 10, porcentaje_comision: 10, comision_total: comision,
    total_ventas: ventas.filter(v => !v.is_excluded_from_payroll).length,
});
const venta = (id, excluida = false) => ({ id, is_excluded_from_payroll: excluida });

const NOMINA = {
    elias: persona(80, [venta(1), venta(2, true)]), paula: persona(0),
    jeancarlo: persona(100, [venta(1)]), facundo: persona(0), marlon: persona(20, [venta(1)]),
    andy: { ...persona(30, [venta(3)]), porcentaje_comision: null },
    dari: persona(0), santi: persona(0), belu: persona(0), pedro: persona(0),
    totales: { cash_neto: 2300, cash_bruto: 2400, ventas: 3 },
};

const ConFiltro = ({ onVerVentas = () => {} }) => {
    const [grupos, setGrupos] = useState(GRUPOS.map(g => g.id));
    return (
        <>
            <FiltroGrupos visibles={grupos} onCambiar={setGrupos} />
            <Payroll desde="2026-09-01" hasta="2026-09-30" grupos={grupos} onVerVentas={onVerVentas}
                tasasAbiertas={false} onCerrarTasas={() => {}} />
        </>
    );
};

const cifra = (rotulo) => screen.getByText(rotulo).closest('.kpi').querySelector('.kpi-n');

describe('Payroll', () => {
    beforeEach(() => {
        api.getPayroll.mockResolvedValue(NOMINA);
        try { localStorage.clear(); } catch { /* sin almacenamiento */ }
    });

    it('muestra el cash del período y la suma de las comisiones de los grupos que se ven', async () => {
        render(<ConFiltro />);
        await screen.findByText('Elias');

        expect(cifra('Cash del período').textContent).toBe('$2,300.00');
        expect(cifra('Comisiones').textContent).toBe('$230.00');   // 80 + 100 + 20 + 30
        expect(cifra('Peso sobre el cash').textContent).toBe('10.0%');
    });

    it('apagar un grupo lo saca de la pantalla y de la suma, y siempre queda al menos uno', async () => {
        render(<ConFiltro />);
        await screen.findByText('Elias');
        const filtro = screen.getByRole('group', { name: 'Grupos de la nómina' });

        await act(async () => { fireEvent.click(within(filtro).getByRole('button', { name: /Fulfillment/ })); });
        expect(screen.queryByText('Andy')).toBeNull();
        expect(cifra('Comisiones').textContent).toBe('$200.00');

        await act(async () => { fireEvent.click(within(filtro).getByRole('button', { name: /Setting/ })); });
        expect(within(filtro).getByRole('button', { name: /Closing/ })).toBeDisabled();
        expect(JSON.parse(localStorage.getItem('payroll.grupos'))).toEqual(['closing']);
    });

    it('tocar un tile lleva a sus ventas en Revisar: solo las que suman, en el período de Payroll', async () => {
        const onVerVentas = vi.fn();
        render(<ConFiltro onVerVentas={onVerVentas} />);
        await screen.findByText('Elias', {}, { timeout: 3000 });

        await act(async () => { fireEvent.click(screen.getByTitle('Ver en Revisar las ventas de Elias')); });

        expect(onVerVentas).toHaveBeenCalledWith({
            ids: [1], rotulo: 'Comisión de Elias', desde: '2026-09-01', hasta: '2026-09-30',
        });
        // Sin ventas en el período no hay a dónde ir.
        expect(screen.getByText('Paula').closest('button')).toBeDisabled();
    });
});
