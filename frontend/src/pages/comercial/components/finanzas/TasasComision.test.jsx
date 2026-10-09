import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TasasComision from './TasasComision';

/**
 * Los % de comisión de la nómina (08/10/2026). Marlon está dos veces: en Closing, el % de sus
 * ventas propias, y en Director, el de las ventas de los otros closers. Nerina y Gabriel, en Closing.
 */

const api = vi.hoisted(() => ({ getTasas: vi.fn(), guardarTasas: vi.fn() }));
vi.mock('./finanzasApi', () => api);

const fulfillment = { AL: [0, 0, 0, 0], RR: [0, 0, 0, 0], SI: [0, 0, 0, 0] };
const DATOS = {
    mes: '2026-10', vigente_desde: null, historial: [],
    tasas: {
        setters: { elias: 8, paula: 8 },
        closers: { jeancarlo: 10, facundo: 10, nerina: 10, gabriel: 10, marlon: 10 },
        director: { marlon: 5 },
        fulfillment: { andy: fulfillment },
    },
    personas: {
        setters: [{ clave: 'elias', nombre: 'Elias' }, { clave: 'paula', nombre: 'Paula' }],
        closers: [{ clave: 'jeancarlo', nombre: 'Jean Carlo' }, { clave: 'facundo', nombre: 'Facundo' },
            { clave: 'nerina', nombre: 'Nerina' }, { clave: 'gabriel', nombre: 'Gabriel' },
            { clave: 'marlon', nombre: 'Marlon' }],
        director: [{ clave: 'marlon', nombre: 'Marlon' }],
        fulfillment: [{ clave: 'andy', nombre: 'Andy' }],
    },
};

describe('TasasComision', () => {
    beforeEach(() => {
        api.getTasas.mockResolvedValue(DATOS);
        api.guardarTasas.mockResolvedValue({});
    });

    it('Marlon tiene su % de closer y su % de director, y se guardan por separado', async () => {
        const onGuardado = vi.fn();
        render(<TasasComision onCerrar={() => {}} onGuardado={onGuardado} />);

        const propio = await screen.findByLabelText('Porcentaje de Marlon');
        const director = screen.getByLabelText('Porcentaje de Marlon · director');
        expect([propio.value, director.value]).toEqual(['10', '5']);
        expect(screen.getByLabelText('Porcentaje de Nerina').value).toBe('10');
        expect(screen.getByLabelText('Porcentaje de Gabriel').value).toBe('10');

        fireEvent.change(propio, { target: { value: '12' } });
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Guardar desde/ })); });

        const [, tasas] = api.guardarTasas.mock.calls[0];
        expect([tasas.closers.marlon, tasas.director.marlon]).toEqual(['12', 5]);
        expect(onGuardado).toHaveBeenCalled();
    });
});
