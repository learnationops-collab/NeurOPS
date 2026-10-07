import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ElegirRolAlSimular, { rolesDePersona, tieneVariosRoles } from './ElegirRolAlSimular';

/**
 * Simular a alguien con varios roles pregunta con cuál (la pantalla de elección del login). Antes
 * entraba siempre con el principal: simular a Mario desde la pestaña «Hiring» caía en su operador.
 */

const mario = { username: 'mario_bueller', role: 'operator', roles: ['operator', 'admin', 'closer', 'hiring'] };

describe('rolesDePersona / tieneVariosRoles', () => {
    it('usa los roles de la cuenta, y si no vienen, el principal', () => {
        expect(rolesDePersona(mario)).toEqual(['operator', 'admin', 'closer', 'hiring']);
        expect(rolesDePersona({ role: 'closer' })).toEqual(['closer']);
        expect(rolesDePersona({ role: 'closer', roles: [] })).toEqual(['closer']);
    });

    it('solo pregunta si hay más de uno', () => {
        expect(tieneVariosRoles(mario)).toBe(true);
        expect(tieneVariosRoles({ role: 'closer', roles: ['closer'] })).toBe(false);
        expect(tieneVariosRoles({ role: 'closer' })).toBe(false);
    });
});

describe('ElegirRolAlSimular', () => {
    it('muestra una tarjeta por cada rol de la persona', () => {
        render(<ElegirRolAlSimular persona={mario} onElegir={vi.fn()} onCancelar={vi.fn()} />);

        const nombres = screen.getAllByRole('button').map((b) => b.textContent);
        expect(nombres.some((t) => t.includes('Operador'))).toBe(true);
        expect(nombres.some((t) => t.includes('Administrador'))).toBe(true);
        expect(nombres.some((t) => t.includes('Closer'))).toBe(true);
        expect(nombres.some((t) => t.includes('Hiring'))).toBe(true);
        expect(screen.getByText(/Vas a simular a mario_bueller/)).toBeTruthy();
    });

    it('elegir una tarjeta simula con ese rol', async () => {
        const onElegir = vi.fn(() => Promise.resolve());
        render(<ElegirRolAlSimular persona={mario} onElegir={onElegir} onCancelar={vi.fn()} />);

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Hiring/ })); });

        expect(onElegir).toHaveBeenCalledWith('hiring');
    });

    it('si la simulación falla, muestra el motivo y deja elegir otra vez', async () => {
        const onElegir = vi.fn(() => Promise.reject({ response: { data: { message: 'Forbidden' } } }));
        render(<ElegirRolAlSimular persona={mario} onElegir={onElegir} onCancelar={vi.fn()} />);

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Closer/ })); });

        expect(screen.getByRole('alert').textContent).toBe('Forbidden');
        expect(screen.getByRole('button', { name: /Closer/ }).disabled).toBe(false);
    });

    it('Cancelar y Escape vuelven sin simular', () => {
        const onCancelar = vi.fn();
        const onElegir = vi.fn();
        render(<ElegirRolAlSimular persona={mario} onElegir={onElegir} onCancelar={onCancelar} />);

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        fireEvent.keyDown(window, { key: 'Escape' });

        expect(onCancelar).toHaveBeenCalledTimes(2);
        expect(onElegir).not.toHaveBeenCalled();
    });
});
