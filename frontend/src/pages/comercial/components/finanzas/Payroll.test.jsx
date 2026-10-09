import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Payroll, { FiltroGrupos, FiltroPersonas, GRUPOS } from './Payroll';

/**
 * Payroll (08/10/2026): los tiles de cada persona, el cash del período arriba, el filtro por grupos
 * y el de personas, y el clic que lleva a sus ventas en Revisar. La lista de ventas que tenía abajo
 * se sacó a pedido. Las cifras cuentan hasta su valor (`Cifra`): lo que cambia se espera con `waitFor`.
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
    jeancarlo: persona(100, [venta(1)]), facundo: persona(0), nerina: persona(0), gabriel: persona(0),
    marlon: { ...persona(20, [venta(1)]), porcentaje_comision: null, desglose: {
        director: { porcentaje: 5, total_recaudado_neto: 160, comision_total: 8, total_ventas: 1 },
        propia: { porcentaje: 10, total_recaudado_neto: 120, comision_total: 12, total_ventas: 1 },
    } },
    andy: { ...persona(30, [venta(3)]), porcentaje_comision: null, sueldo_base: 600 },
    dari: persona(0), santi: persona(0), belu: persona(0), pedro: persona(0),
    totales: { cash_neto: 2300, cash_bruto: 2400, ventas: 3 },
};

const ConFiltro = ({ onVerVentas = () => {} }) => {
    const [grupos, setGrupos] = useState(GRUPOS.map(g => g.id));
    const [personas, setPersonas] = useState([]);
    return (
        <>
            <FiltroGrupos visibles={grupos} onCambiar={setGrupos} personas={personas} onCambiarPersonas={setPersonas} />
            <FiltroPersonas grupos={grupos} elegidas={personas} onCambiar={setPersonas} />
            <Payroll desde="2026-09-01" hasta="2026-09-30" grupos={grupos} personas={personas}
                onVerVentas={onVerVentas} tasasAbiertas={false} onCerrarTasas={() => {}} />
        </>
    );
};

const cifra = (rotulo) => screen.getByText(rotulo).closest('.kpi').querySelector('.kpi-n');

describe('Payroll', () => {
    beforeEach(() => {
        api.getPayroll.mockResolvedValue(NOMINA);
        try { localStorage.clear(); } catch { /* sin almacenamiento */ }
    });

    it('muestra el cash del período y el sueldo base, las comisiones y el total de los grupos que se ven', async () => {
        render(<ConFiltro />);
        await screen.findByText('Elias');

        expect(cifra('Cash del período').textContent).toBe('$2,300.00');
        expect(cifra('Sueldo base').textContent).toBe('$600.00');   // el de Andy
        expect(cifra('Comisiones').textContent).toBe('$230.00');   // 80 + 100 + 20 + 30
        expect(cifra('Total').textContent).toBe('$830.00');
        expect(cifra('Peso sobre el cash').textContent).toBe('36.1%');   // total ÷ cash
        // El tile de quien tiene sueldo fijo lo dice abajo; la cifra grande es la comisión.
        expect(screen.getByText('Andy').closest('.kpi').querySelector('.kpi-sub').textContent)
            .toBe('1 ingresos · neto $300.00 · base $600.00');
    });

    it('el tile de Marlon suma sus ventas propias y su parte de director, y dice cuánto es cada una', async () => {
        render(<ConFiltro />);
        const tile = (await screen.findByText('Marlon')).closest('.kpi');

        // Un renglón por partida, con su %: arriba, al lado del chip, no entraban.
        expect([...tile.querySelectorAll('.kpi-sub > span')].map(s => s.textContent))
            .toEqual(['propias 10% · $12.00', 'director 5% · $8.00']);
        await waitFor(() => expect(tile.querySelector('.kpi-n').textContent).toBe('$20.00'));
    });

    it('apagar un grupo lo saca de la pantalla y de la suma, y siempre queda al menos uno', async () => {
        render(<ConFiltro />);
        await screen.findByText('Elias');
        const filtro = screen.getByRole('group', { name: 'Grupos de la nómina' });

        await act(async () => { fireEvent.click(within(filtro).getByRole('button', { name: /Fulfillment/ })); });
        expect(screen.queryByText('Andy')).toBeNull();
        await waitFor(() => expect(cifra('Comisiones').textContent).toBe('$200.00'));
        await waitFor(() => expect(cifra('Sueldo base').textContent).toBe('$0.00'));
        await waitFor(() => expect(cifra('Total').textContent).toBe('$200.00'));

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

    it('el desplegable de personas deja ver una o varias, y la suma es la de ellas', async () => {
        render(<ConFiltro />);
        await screen.findByText('Elias');

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Todas las personas/ })); });
        const menu = screen.getByRole('menu', { name: 'Personas de la nómina' });
        await act(async () => { fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Elias' })); });
        await act(async () => { fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Marlon' })); });

        expect(screen.getByRole('button', { name: /Elias y Marlon/ })).toBeTruthy();
        expect(screen.queryByTitle('Ver en Revisar las ventas de Jean Carlo')).toBeNull();
        expect(screen.queryByTitle('Ver en Revisar las ventas de Andy')).toBeNull();
        await waitFor(() => expect(cifra('Comisiones').textContent).toBe('$100.00'));   // 80 + 20
        expect(screen.getByText('A pagar a Elias y Marlon')).toBeTruthy();
        expect(JSON.parse(localStorage.getItem('payroll.personas'))).toEqual(['elias', 'marlon']);

        await act(async () => { fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Todas las personas' })); });
        expect(screen.getByTitle('Ver en Revisar las ventas de Jean Carlo')).toBeTruthy();
        await waitFor(() => expect(cifra('Comisiones').textContent).toBe('$230.00'));
    });

    it('tocar un grupo vuelve a todas las personas: prender Fulfillment no esconde Setting ni Closing', async () => {
        render(<ConFiltro />);
        await screen.findByText('Elias');
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Todas las personas/ })); });
        const menu = screen.getByRole('menu', { name: 'Personas de la nómina' });
        for (const nombre of ['Andy', 'Dari']) {
            await act(async () => { fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: nombre })); });
        }
        await act(async () => { fireEvent.mouseDown(document.body); });
        expect(screen.queryByTitle('Ver en Revisar las ventas de Elias')).toBeNull();

        const filtro = screen.getByRole('group', { name: 'Grupos de la nómina' });
        await act(async () => { fireEvent.click(within(filtro).getByRole('button', { name: /Fulfillment/ })); });
        await act(async () => { fireEvent.click(within(filtro).getByRole('button', { name: /Fulfillment/ })); });

        // Antes Andy y Dari volvían a filtrar y quedaban solas en pantalla.
        expect(screen.getByRole('button', { name: /Todas las personas/ })).toBeTruthy();
        expect(screen.getByTitle('Ver en Revisar las ventas de Elias')).toBeTruthy();
        expect(screen.getByTitle('Ver en Revisar las ventas de Jean Carlo')).toBeTruthy();
        expect(screen.getByText('Andy')).toBeTruthy();
        expect(JSON.parse(localStorage.getItem('payroll.personas'))).toEqual([]);
        await waitFor(() => expect(cifra('Comisiones').textContent).toBe('$230.00'));
    });

    it('el título de cada grupo elige o quita a todo el grupo, y queda a medias con algunas', async () => {
        render(<ConFiltro />);
        await screen.findByText('Elias');
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Todas las personas/ })); });
        const menu = screen.getByRole('menu', { name: 'Personas de la nómina' });
        const titulo = (nombre) => within(within(menu).getByRole('group', { name: nombre }))
            .getAllByRole('menuitemcheckbox')[0];

        await act(async () => { fireEvent.click(titulo('Setting')); });
        expect(titulo('Setting').getAttribute('aria-checked')).toBe('true');
        expect(JSON.parse(localStorage.getItem('payroll.personas'))).toEqual(['elias', 'paula']);
        expect(screen.queryByTitle('Ver en Revisar las ventas de Jean Carlo')).toBeNull();
        await waitFor(() => expect(cifra('Comisiones').textContent).toBe('$80.00'));

        // Una sola de Closing: el título queda a medias; tocarlo suma a las que faltan.
        await act(async () => { fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Facundo' })); });
        expect(titulo('Closing').getAttribute('aria-checked')).toBe('mixed');
        await act(async () => { fireEvent.click(titulo('Closing')); });
        expect(titulo('Closing').getAttribute('aria-checked')).toBe('true');
        expect(screen.getByTitle('Ver en Revisar las ventas de Jean Carlo')).toBeTruthy();

        // Tocarlo entero lo quita, y Setting sigue elegido.
        await act(async () => { fireEvent.click(titulo('Closing')); });
        expect(titulo('Closing').getAttribute('aria-checked')).toBe('false');
        expect(JSON.parse(localStorage.getItem('payroll.personas'))).toEqual(['elias', 'paula']);
    });

    it('solo ofrece personas de los grupos prendidos, y las de un grupo apagado no cuentan', async () => {
        render(<ConFiltro />);
        await screen.findByText('Elias');
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Todas las personas/ })); });
        await act(async () => {
            fireEvent.click(within(screen.getByRole('menu', { name: 'Personas de la nómina' }))
                .getByRole('menuitemcheckbox', { name: 'Andy' }));
        });
        await waitFor(() => expect(cifra('Comisiones').textContent).toBe('$30.00'));
        // Un clic afuera cierra el menú.
        await act(async () => { fireEvent.mouseDown(document.body); });
        expect(screen.queryByRole('menu', { name: 'Personas de la nómina' })).toBeNull();

        const filtro = screen.getByRole('group', { name: 'Grupos de la nómina' });
        await act(async () => { fireEvent.click(within(filtro).getByRole('button', { name: /Fulfillment/ })); });

        // Apagar el grupo de Andy vuelve a todas: se ven las de los grupos prendidos.
        expect(screen.getByRole('button', { name: /Todas las personas/ })).toBeTruthy();
        await waitFor(() => expect(cifra('Comisiones').textContent).toBe('$200.00'));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Todas las personas/ })); });
        expect(within(screen.getByRole('menu', { name: 'Personas de la nómina' }))
            .queryByRole('menuitemcheckbox', { name: 'Andy' })).toBeNull();
    });
});
