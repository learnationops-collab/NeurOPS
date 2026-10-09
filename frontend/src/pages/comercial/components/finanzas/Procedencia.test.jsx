import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Finanzas from './Finanzas';
import Procedencia, { rangoDelMes } from './Procedencia';

/**
 * Ingresos por procedencia (Finanzas › Resumen, 08/10/2026): los cinco baldes con su monto, sus
 * pagos y su %, el detalle de cada uno debajo (el de setting, por setter) y el total. Qué pago va
 * en qué balde lo decide el backend: acá se comprueba que se dibuje lo que llega.
 */

const api = vi.hoisted(() => ({ getProcedencia: vi.fn(), getResumen: vi.fn(), getAhorros: vi.fn() }));
vi.mock('./finanzasApi', () => api);
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const balde = (key, label, tone, monto, cantidad, pctTotal, detalle = []) => ({
    key, label, tone, monto, cantidad, pct: pctTotal, detalle,
});
const sub = (key, label, monto, cantidad, pctTotal) => ({ key, label, monto, cantidad, pct: pctTotal });

const SEPTIEMBRE = {
    desde: '2026-09-01', hasta: '2026-09-30', total: 15270.71, cantidad: 45,
    procedencias: [
        balde('workshop', 'Workshop', 'cat-4', 5680.63, 13, 37.2,
            [sub('vivo', 'En vivo', 4248.13, 11, 27.8), sub('grabacion', 'Grabación', 1432.5, 2, 9.4)]),
        balde('setting', 'Setting', 'cat-2', 5779.21, 24, 37.8, [
            sub('elias', 'Elias', 4889.08, 19, 32.0), sub('paula', 'Paula', 818.5, 4, 5.4),
            sub('ivan', 'Ivan', 71.63, 1, 0.5)]),
        balde('vsl', 'VSL', 'cat-1', 1623.5, 2, 10.6),
        balde('fulfillment', 'Fulfillment', 'cat-3', 969.75, 2, 6.4,
            [sub('renovacion', 'Renovaciones', 969.75, 2, 6.4)]),
        balde('sin_procedencia', 'Sin procedencia', 'idle', 1217.62, 4, 8.0,
            [sub('sin_agenda', 'Sin agenda', 1217.62, 4, 8.0)]),
    ],
};

/** El texto de una celda sin la «i» de su `Tip`. */
const texto = (el) => {
    const copia = el.cloneNode(true);
    copia.querySelectorAll('.tip').forEach(t => t.remove());
    return copia.textContent.trim();
};

/** Espera a que lleguen los datos y a que las barras arranquen a crecer (`Barra` las suelta en el
 *  cuadro siguiente al montar): sin esto el cuadro cae fuera de `act` y React lo avisa. */
const cargado = async () => {
    await screen.findByText('Workshop');
    await act(() => new Promise((listo) => { requestAnimationFrame(() => listo()); }));
};

/** Las celdas de la fila que contiene `rotulo` (el de un balde o el de un detalle). */
const fila = (rotulo) => [...screen.getByText(rotulo).closest('.fz-fila').children].map(texto);

describe('Procedencia', () => {
    beforeEach(() => {
        api.getProcedencia.mockReset();
    });

    it('pide el período que recibe y muestra cada balde con sus pagos, su neto y su %', async () => {
        api.getProcedencia.mockResolvedValue(SEPTIEMBRE);
        render(<Procedencia desde="2026-09-01" hasta="2026-09-30" />);
        await cargado();

        expect(api.getProcedencia).toHaveBeenCalledWith('2026-09-01', '2026-09-30');
        expect(fila('Workshop')).toEqual(['Workshop', '', '13', '$5,680.63', '37.2%']);
        expect(fila('Setting')).toEqual(['Setting', '', '24', '$5,779.21', '37.8%']);
        expect(fila('VSL')).toEqual(['VSL', '', '2', '$1,623.50', '10.6%']);
        expect(fila('Total')).toEqual(['Total', '', '45', '$15,270.71', '100%']);
    });

    it('el detalle va debajo de su balde: el vivo y la grabación, y cada setter', async () => {
        api.getProcedencia.mockResolvedValue(SEPTIEMBRE);
        const { container } = render(<Procedencia desde="2026-09-01" hasta="2026-09-30" />);
        await cargado();

        const rotulos = [...container.querySelectorAll('.pr-fila, .pr-sub')]
            .map(f => texto(f.firstChild));
        expect(rotulos).toEqual(['Workshop', 'En vivo', 'Grabación', 'Setting', 'Elias', 'Paula', 'Ivan', 'VSL',
            'Fulfillment', 'Renovaciones', 'Sin procedencia', 'Sin agenda']);
        expect(fila('Elias')).toEqual(['Elias', '', '19', '$4,889.08', '32.0%']);
        expect(fila('Grabación')).toEqual(['Grabación', '', '2', '$1,432.50', '9.4%']);
    });

    it('las barras miden contra el total y entran de a una', async () => {
        api.getProcedencia.mockResolvedValue({
            ...SEPTIEMBRE, total: 1000, procedencias: [
                balde('workshop', 'Workshop', 'cat-4', 250, 1, 25, [sub('vivo', 'En vivo', 250, 1, 25)]),
                balde('setting', 'Setting', 'cat-2', 750, 3, 75),
                balde('vsl', 'VSL', 'cat-1', 0, 0, 0),
            ],
        });
        const { container } = render(<Procedencia desde="2026-09-01" hasta="2026-09-30" />);
        await cargado();

        await vi.waitFor(() => expect([...container.querySelectorAll('.riel > i')].map(i => i.style.width))
            .toEqual(['25%', '25%', '75%', '0%']));
        expect([...container.querySelectorAll('.pr-fila, .pr-sub')].map(f => f.style.getPropertyValue('--i')))
            .toEqual(['0', '1', '2', '3']);
        // El balde sin pagos queda apagado, sin esconderse.
        expect(screen.getByText('VSL').closest('.fz-fila').dataset.vacio).toBe('1');
    });

    it('un período sin ingresos lo dice en vez de dibujar ceros', async () => {
        api.getProcedencia.mockResolvedValue({
            ...SEPTIEMBRE, total: 0, cantidad: 0,
            procedencias: SEPTIEMBRE.procedencias.map(p => ({ ...p, monto: 0, cantidad: 0, pct: null, detalle: [] })),
        });
        render(<Procedencia desde="2026-01-01" hasta="2026-01-31" />);

        expect(await screen.findByText('No hubo ingresos en este período.')).toBeTruthy();
        expect(screen.queryByText('Workshop')).toBeNull();
    });

    it('vuelve a pedir cuando cambia el período', async () => {
        api.getProcedencia.mockResolvedValue(SEPTIEMBRE);
        const { rerender } = render(<Procedencia desde="2026-09-01" hasta="2026-09-30" />);
        await cargado();

        rerender(<Procedencia desde="2026-08-01" hasta="2026-08-31" />);
        await cargado();

        expect(api.getProcedencia).toHaveBeenLastCalledWith('2026-08-01', '2026-08-31');
        expect(api.getProcedencia).toHaveBeenCalledTimes(2);
    });

    it('si falla lo avisa en el panel', async () => {
        api.getProcedencia.mockRejectedValue(new Error('500'));
        render(<Procedencia desde="2026-09-01" hasta="2026-09-30" />);

        expect(await screen.findByText('No se pudo cargar la procedencia de los ingresos.')).toBeTruthy();
    });
});

describe('Finanzas › Resumen', () => {
    it('trae el panel con el mes que se mira', async () => {
        api.getResumen.mockResolvedValue({
            kpis: { total_income: 15270.71, total_expenses: 0, profit: 15270.71, balance_neto: 15270.71 },
            expenses_breakdown: { sueldos: 0, anuncios: 0, software: 0 }, income_breakdown: [],
        });
        api.getAhorros.mockResolvedValue({ savings: 0 });
        api.getProcedencia.mockResolvedValue(SEPTIEMBRE);
        render(<Finanzas tab="resumen" mes="2026-02" />);
        await cargado();

        expect(api.getProcedencia).toHaveBeenCalledWith('2026-02-01', '2026-02-28');
        expect(screen.getByRole('heading', { name: 'Ingresos por procedencia' })).toBeTruthy();
    });
});

describe('rangoDelMes', () => {
    it.each([
        ['2026-09', { desde: '2026-09-01', hasta: '2026-09-30' }],
        ['2026-10', { desde: '2026-10-01', hasta: '2026-10-31' }],
        ['2028-02', { desde: '2028-02-01', hasta: '2028-02-29' }],
        ['2026-12', { desde: '2026-12-01', hasta: '2026-12-31' }],
    ])('%s', (mes, rango) => {
        expect(rangoDelMes(mes)).toEqual(rango);
    });
});
