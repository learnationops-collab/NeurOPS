import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Payroll, { FiltroGrupos, FiltroPersonas, GRUPOS } from './Payroll';

/**
 * Payroll (08/10/2026): los tiles de cada persona, el cash del período arriba, el filtro por grupos
 * y el de personas, y el clic que abre sus ventas ahí mismo (`VentasDePersona`), sin ir a Revisar de
 * la dirección comercial. Las cifras cuentan hasta su valor (`Cifra`): lo que cambia se espera con
 * `waitFor`.
 */

const api = vi.hoisted(() => ({
    getPayroll: vi.fn(), marcarExclusion: vi.fn(), getPersonasAtribuibles: vi.fn(), cambiarAtribucion: vi.fn(),
}));
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

// `ver` lo maneja el tablero (va en la URL): acá alcanza con un estado.
const ConFiltro = ({ onVer = () => {} }) => {
    const [grupos, setGrupos] = useState(GRUPOS.map(g => g.id));
    const [personas, setPersonas] = useState([]);
    const [ver, setVer] = useState(null);
    return (
        <>
            <FiltroGrupos visibles={grupos} onCambiar={setGrupos} personas={personas} onCambiarPersonas={setPersonas} />
            <FiltroPersonas grupos={grupos} elegidas={personas} onCambiar={setPersonas} />
            <Payroll desde="2026-09-01" hasta="2026-09-30" grupos={grupos} personas={personas}
                ver={ver} onVer={(id) => { onVer(id); setVer(id); }} tasasAbiertas={false} onCerrarTasas={() => {}} />
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

    it('tocar un tile abre sus ventas ahí mismo, en lugar de los tiles, y «Volver» los trae de vuelta', async () => {
        const onVer = vi.fn();
        render(<ConFiltro onVer={onVer} />);
        await screen.findByText('Elias', {}, { timeout: 3000 });

        await act(async () => { fireEvent.click(screen.getByTitle('Ver las ventas de Elias')); });

        expect(onVer).toHaveBeenCalledWith('elias');
        expect(screen.getByRole('heading', { name: 'Elias' })).toBeTruthy();
        expect(screen.queryByTitle('Ver las ventas de Jean Carlo')).toBeNull();
        expect(screen.queryByText('Cash del período')).toBeNull();
        // Las dos: la que suma y la excluida (tachada, para poder volver a sumarla).
        expect(screen.getAllByRole('button', { name: /la venta de/ })).toHaveLength(4);   // casilla y lápiz

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Volver a Payroll/ })); });
        expect(onVer).toHaveBeenLastCalledWith(null);
        expect(screen.getByTitle('Ver las ventas de Jean Carlo')).toBeTruthy();
        // Sin ventas en el período no hay nada que abrir.
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
        expect(screen.queryByTitle('Ver las ventas de Jean Carlo')).toBeNull();
        expect(screen.queryByTitle('Ver las ventas de Andy')).toBeNull();
        await waitFor(() => expect(cifra('Comisiones').textContent).toBe('$100.00'));   // 80 + 20
        expect(screen.getByText('A pagar a Elias y Marlon')).toBeTruthy();
        expect(JSON.parse(localStorage.getItem('payroll.personas'))).toEqual(['elias', 'marlon']);

        await act(async () => { fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Todas las personas' })); });
        expect(screen.getByTitle('Ver las ventas de Jean Carlo')).toBeTruthy();
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
        expect(screen.queryByTitle('Ver las ventas de Elias')).toBeNull();

        const filtro = screen.getByRole('group', { name: 'Grupos de la nómina' });
        await act(async () => { fireEvent.click(within(filtro).getByRole('button', { name: /Fulfillment/ })); });
        await act(async () => { fireEvent.click(within(filtro).getByRole('button', { name: /Fulfillment/ })); });

        // Antes Andy y Dari volvían a filtrar y quedaban solas en pantalla.
        expect(screen.getByRole('button', { name: /Todas las personas/ })).toBeTruthy();
        expect(screen.getByTitle('Ver las ventas de Elias')).toBeTruthy();
        expect(screen.getByTitle('Ver las ventas de Jean Carlo')).toBeTruthy();
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
        expect(screen.queryByTitle('Ver las ventas de Jean Carlo')).toBeNull();
        await waitFor(() => expect(cifra('Comisiones').textContent).toBe('$80.00'));

        // Una sola de Closing: el título queda a medias; tocarlo suma a las que faltan.
        await act(async () => { fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Facundo' })); });
        expect(titulo('Closing').getAttribute('aria-checked')).toBe('mixed');
        await act(async () => { fireEvent.click(titulo('Closing')); });
        expect(titulo('Closing').getAttribute('aria-checked')).toBe('true');
        expect(screen.getByTitle('Ver las ventas de Jean Carlo')).toBeTruthy();

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

/**
 * Las ventas de una persona, abiertas desde su tile: lo que suman cierra con el número del tile, y
 * cada cambio (sacar una venta, volver a sumarla, cambiar su atribución) recalcula Payroll entero.
 */
describe('Payroll · las ventas de una persona', () => {
    const fila = (id, comision, excluida = false) => ({
        id, date: `2026-09-${String(id).padStart(2, '0')}`, nombre_cliente: `Cliente ${id}`, tipo_pago: 'RR - Completo',
        monto_neto: comision * 10, porcentaje: 10, comision, setter: 'Elias', closer: 'Jean Carlo',
        is_excluded_from_payroll: excluida,
    });
    const deVentas = (ventas) => {
        const suman = ventas.filter(v => !v.is_excluded_from_payroll);
        return { sales: ventas, porcentaje_comision: 10, total_ventas: suman.length,
            comision_total: suman.reduce((t, v) => t + v.comision, 0),
            total_recaudado_neto: suman.reduce((t, v) => t + v.monto_neto, 0) };
    };
    // Jean Carlo: dos que suman ($100 + $40.50) y una ya excluida.
    const nomina = (excluida4 = false) => ({
        ...NOMINA, jeancarlo: deVentas([fila(4, 100, excluida4), fila(5, 40.5), fila(6, 16, true)]),
    });
    const PERSONAS = { setters: [{ id: 21, nombre: 'Elias', activo: true }],
        closers: [{ id: 4, nombre: 'Jean Carlo', activo: true }, { id: 11, nombre: 'Facundo', activo: true }] };

    beforeEach(() => {
        api.getPayroll.mockReset().mockResolvedValue(nomina());
        api.marcarExclusion.mockReset().mockResolvedValue({});
        api.getPersonasAtribuibles.mockReset().mockResolvedValue(PERSONAS);
        api.cambiarAtribucion.mockReset().mockResolvedValue({});
        try { localStorage.clear(); } catch { /* sin almacenamiento */ }
    });

    // Abre la lista desde el tile, después de que su cifra terminó de contar (`Cifra`): devuelve el
    // número que mostraba.
    const abrir = async (nombre, cifraDelTile = '$140.50') => {
        render(<ConFiltro />);
        const tile = (await screen.findByTitle(`Ver las ventas de ${nombre}`));
        await waitFor(() => expect(tile.querySelector('.kpi-n').textContent).toBe(cifraDelTile), { timeout: 3000 });
        const delTile = tile.querySelector('.kpi-n').textContent;
        await act(async () => { fireEvent.click(tile); });
        return delTile;
    };
    const pie = () => screen.getByText(/ventas? suma/).closest('.fz-fila');
    // «Comisión» es también el título de una columna: la cifra es la del tile de arriba.
    const kpi = (rotulo) => screen.getAllByText(rotulo).map(n => n.closest('.kpi')).find(Boolean).querySelector('.kpi-n');

    it('lo que suma la lista cierra con el número del tile: las excluidas se ven y no cuentan', async () => {
        const delTile = await abrir('Jean Carlo');

        const suman = screen.getAllByRole('button', { name: /^Sacar de la nómina la venta de/ })
            .map(b => Number(b.closest('.fz-fila').children[8].textContent.replace(/[$,]/g, '')));
        expect(suman.reduce((t, n) => t + n, 0)).toBe(140.5);
        expect(pie().lastElementChild.textContent).toBe(delTile);
        expect(pie().textContent).toMatch(/^2 ventas suman · 1 excluida/);
        expect(screen.getByText('Cliente 6').closest('.fz-fila').className).toContain('fz-excluida');
        await waitFor(() => expect(kpi('Comisión').textContent).toBe(delTile));
    });

    it('sacar una venta la guarda, recalcula Payroll y al volver el tile y los KPIs ya cambiaron', async () => {
        await abrir('Jean Carlo');
        api.getPayroll.mockResolvedValue(nomina(true));

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sacar de la nómina la venta de Cliente 4' })); });

        expect(api.marcarExclusion).toHaveBeenCalledWith(4, true);
        expect(api.getPayroll).toHaveBeenCalledTimes(2);
        await waitFor(() => expect(pie().lastElementChild.textContent).toBe('$40.50'));
        await waitFor(() => expect(kpi('Comisión').textContent).toBe('$40.50'));

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Volver a Payroll/ })); });
        const tile = screen.getByTitle('Ver las ventas de Jean Carlo');
        await waitFor(() => expect(tile.querySelector('.kpi-n').textContent).toBe('$40.50'));
        await waitFor(() => expect(cifra('Comisiones').textContent).toBe('$170.50'));   // 80 + 40.50 + 20 + 30
    });

    it('cambiar el closer llama al endpoint de atribución con el período de Payroll y recalcula', async () => {
        await abrir('Jean Carlo');

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cambiar la atribución de la venta de Cliente 5' })); });
        const editor = screen.getByRole('group', { name: 'Atribución de la venta de Cliente 5' });
        await waitFor(() => expect(within(editor).getByRole('combobox', { name: 'Closer' }).value).toBe('4'));
        fireEvent.change(within(editor).getByRole('combobox', { name: 'Closer' }), { target: { value: '11' } });
        await act(async () => { fireEvent.click(within(editor).getByRole('button', { name: 'Cambiar atribución' })); });

        expect(api.cambiarAtribucion).toHaveBeenCalledWith(5, { closer_id: 11, desde: '2026-09-01', hasta: '2026-09-30' });
        expect(api.getPayroll).toHaveBeenCalledTimes(2);
    });
});
