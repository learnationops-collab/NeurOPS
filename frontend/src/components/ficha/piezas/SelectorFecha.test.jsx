import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SelectorFecha, { construirMes } from './SelectorFecha';

// Miércoles 23 de septiembre de 2026. Con el reloj fijo, "días pasados" y "hoy"
// dejan de depender del día en que corran los tests.
const HOY = new Date(2026, 8, 23, 10, 0, 0);

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); vi.setSystemTime(HOY); });
afterEach(() => { vi.useRealTimers(); });

const dia = (n) => new Date(2026, 8, n);

describe('construirMes', () => {
    it('arranca la semana en lunes', () => {
        // El 1 de septiembre de 2026 es martes: le corresponde exactamente 1 hueco.
        const celdas = construirMes(new Date(2026, 8, 1), { sel: null, minimo: null, hoy: dia(23) });
        const huecos = celdas.filter(c => c.hueco);
        expect(huecos).toHaveLength(1);
        expect(celdas[huecos.length].n).toBe(1);
    });

    it('marca como pasado todo lo anterior al mínimo, y hoy no lo es', () => {
        const celdas = construirMes(new Date(2026, 8, 1), { sel: null, minimo: dia(23), hoy: dia(23) });
        const porDia = (n) => celdas.find(c => c.n === n);
        expect(porDia(22).pasado).toBe(true);
        expect(porDia(23).pasado).toBe(false);
        expect(porDia(23).hoy).toBe(true);
        expect(porDia(24).pasado).toBe(false);
    });

    it('cubre el mes entero', () => {
        const celdas = construirMes(new Date(2026, 8, 1), { sel: null, minimo: null, hoy: dia(23) });
        expect(celdas.filter(c => !c.hueco)).toHaveLength(30);
    });
});

describe('SelectorFecha', () => {
    it('deshabilita los días pasados y deja elegir los futuros', async () => {
        const usuario = userEvent.setup();
        const onChange = vi.fn();
        render(<SelectorFecha valor={null} onChange={onChange} etiqueta="Nueva fecha" />);
        await usuario.click(screen.getByRole('button', { name: 'Nueva fecha' }));
        const panel = screen.getByRole('dialog', { name: 'Nueva fecha' });

        // Se busca por `data-dia` y no por el rótulo: el nombre accesible depende del
        // formato de fecha del ICU de Node y no es el contrato de este componente.
        expect(panel.querySelector('[data-dia="2026-09-22"]')).toBeDisabled();
        const futuro = panel.querySelector('[data-dia="2026-09-28"]');
        expect(futuro).not.toBeDisabled();

        await usuario.click(futuro);
        expect(onChange).toHaveBeenCalledWith('2026-09-28', expect.any(Date));
        // Elegir cierra el panel: quedarse abierto tapa el campo de al lado.
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('pone las iniciales de los días con el lunes primero', async () => {
        const usuario = userEvent.setup();
        render(<SelectorFecha valor={null} onChange={vi.fn()} etiqueta="Nueva fecha" />);
        await usuario.click(screen.getByRole('button', { name: 'Nueva fecha' }));
        const panel = screen.getByRole('dialog');
        const iniciales = [...panel.querySelectorAll('.fi-cal-sem')].map(e => e.textContent);
        expect(iniciales).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
    });

    it('los presets salen de hoy y quedan elegidos', async () => {
        const usuario = userEvent.setup();
        const onChange = vi.fn();
        render(<SelectorFecha valor={null} onChange={onChange} etiqueta="Contactar el" />);
        await usuario.click(screen.getByRole('button', { name: 'Contactar el' }));
        await usuario.click(screen.getByRole('option', { name: /En 1 semana/ }));
        expect(onChange).toHaveBeenCalledWith('2026-09-30', expect.any(Date));
    });

    it('con `minimo` en null se puede elegir una fecha pasada', async () => {
        const usuario = userEvent.setup();
        const onChange = vi.fn();
        render(<SelectorFecha valor={null} onChange={onChange} minimo={null} etiqueta="Fecha del pago" />);
        await usuario.click(screen.getByRole('button', { name: 'Fecha del pago' }));
        const anterior = screen.getByRole('dialog').querySelector('[data-dia="2026-09-20"]');
        expect(anterior).not.toBeDisabled();
        await usuario.click(anterior);
        expect(onChange).toHaveBeenCalledWith('2026-09-20', expect.any(Date));
    });

    it('muestra la distancia en palabras, no solo la fecha', () => {
        render(<SelectorFecha valor="2026-09-24" onChange={vi.fn()} etiqueta="Nueva fecha" />);
        expect(screen.getByRole('button', { name: 'Nueva fecha' })).toHaveTextContent('mañana');
    });
});
