import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ElegirRolAlSimular, { hayQueElegir, rolesDePersona, tieneVariosRoles } from './ElegirRolAlSimular';

/**
 * Simular a alguien con varios roles pregunta con cuál (la pantalla de elección de develop). Antes
 * entraba siempre con el principal: simular a Mario caía siempre en su operador. Quien ve finanzas
 * tiene además la tarjeta «Finances» (08/10/2026), como en el login.
 */

const mario = { username: 'mario_bueller', role: 'operator', roles: ['operator', 'admin', 'closer', 'hiring'] };
const tarjetas = () => screen.getAllByRole('button').map((b) => b.querySelector('b')?.textContent).filter(Boolean);

describe('rolesDePersona / tieneVariosRoles / hayQueElegir', () => {
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

    it('con un solo rol pregunta igual si ve finanzas: su pantalla o Finances', () => {
        expect(hayQueElegir(mario)).toBe(true);
        expect(hayQueElegir({ role: 'director_comercial', roles: ['director_comercial'], can_view_finance: true })).toBe(true);
        expect(hayQueElegir({ role: 'director_comercial', roles: ['director_comercial'], can_view_finance: false })).toBe(false);
        expect(hayQueElegir({ role: 'closer', roles: ['closer'], can_view_finance: true })).toBe(false);
    });
});

describe('ElegirRolAlSimular', () => {
    it('muestra una tarjeta por cada rol de la persona, en orden', () => {
        render(<ElegirRolAlSimular persona={mario} onElegir={vi.fn()} onCancelar={vi.fn()} />);

        expect(tarjetas()).toEqual(['Operador', 'Administrador', 'Closer', 'Hiring']);
        expect(screen.getByText(/Vas a simular a mario_bueller/)).toBeTruthy();
    });

    it('elegir una tarjeta simula con ese rol', async () => {
        const onElegir = vi.fn(() => Promise.resolve());
        render(<ElegirRolAlSimular persona={mario} onElegir={onElegir} onCancelar={vi.fn()} />);

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Hiring/ })); });

        expect(onElegir).toHaveBeenCalledWith('hiring', null);
    });

    it('con «ver finanzas» suma la tarjeta Finances: simula como admin y va a /finanzas', async () => {
        const onElegir = vi.fn(() => Promise.resolve());
        render(<ElegirRolAlSimular persona={{ ...mario, can_view_finance: true }} onElegir={onElegir} onCancelar={vi.fn()} />);

        expect(tarjetas()).toEqual(['Operador', 'Administrador', 'Closer', 'Hiring', 'Finances']);

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Finances/ })); });
        expect(onElegir).toHaveBeenCalledWith('admin', '/finanzas');
    });

    it('sin el permiso, o sin un rol que lo use, no hay tarjeta Finances', () => {
        const { unmount } = render(<ElegirRolAlSimular persona={mario} onElegir={vi.fn()} onCancelar={vi.fn()} />);
        expect(screen.queryByRole('button', { name: /Finances/ })).toBeNull();
        unmount();

        render(<ElegirRolAlSimular persona={{ username: 'ana', roles: ['closer', 'setter'], can_view_finance: true }}
            onElegir={vi.fn()} onCancelar={vi.fn()} />);
        expect(screen.queryByRole('button', { name: /Finances/ })).toBeNull();
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
