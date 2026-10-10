import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../services/api', () => ({ default: api }));
const imp = vi.hoisted(() => ({ simularA: vi.fn(() => new Promise(() => {})), simularEnPestanaNueva: vi.fn(() => Promise.resolve()) }));
vi.mock('../../utils/impersonation', () => imp);

import SimularEnPortal from './SimularEnPortal';
import { abrirSimulacion, puedeSimular } from '../../sesion/simulacion';
import { registrarPortal } from '../../sesion/portalBus';

const EQUIPO = [
    { id: 21, username: 'Jean Carlo', role: 'closer', roles: ['closer'], can_view_finance: false, mascota: null },
    { id: 31, username: 'Paula', role: 'setter', roles: ['setter'], can_view_finance: false, mascota: null },
    { id: 40, username: 'Marlon', role: 'director_comercial', roles: ['director_comercial', 'closer'], can_view_finance: false, mascota: null },
];
const montar = async () => {
    api.get.mockResolvedValue({ data: { equipo: EQUIPO } });
    await act(async () => { render(<SimularEnPortal />); });
};
const filas = () => screen.getAllByRole('listitem').map((li) => li.querySelector('b').textContent);

describe('Simular a alguien, en el Portal', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('una sola lista con todo el equipo que se puede simular', async () => {
        await montar();
        expect(api.get).toHaveBeenCalledWith('/auth/impersonate/equipo');
        expect(filas()).toEqual(['Jean Carlo', 'Paula', 'Marlon']);
        expect(screen.getByText('Dirección comercial · Closer')).toBeTruthy();
    });

    it('se filtra por rol y se busca por nombre, sin importar tildes ni mayúsculas', async () => {
        await montar();
        const roles = screen.getByRole('group', { name: 'Filtrar por rol' });
        expect(within(roles).getAllByRole('button').map((b) => b.textContent)).toEqual(['Todos', 'Closer', 'Setter', 'Dirección comercial']);
        fireEvent.click(within(roles).getByRole('button', { name: 'Closer' }));
        expect(filas()).toEqual(['Jean Carlo', 'Marlon']);
        fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por nombre' }), { target: { value: 'JEAN' } });
        expect(filas()).toEqual(['Jean Carlo']);
        fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por nombre' }), { target: { value: 'nadie' } });
        expect(screen.getByText('Nadie coincide con la búsqueda.')).toBeTruthy();
    });

    it('tocar a alguien lo simula en esta pestaña; con un solo rol, directo', async () => {
        await montar();
        fireEvent.click(screen.getByRole('button', { name: 'Simular a Jean Carlo' }));
        expect(imp.simularA).toHaveBeenCalledWith(21, null, null);
        expect(screen.getByRole('button', { name: 'Simular a Paula' }).disabled).toBe(true);
    });

    it('el botón de la esquina simula en una pestaña nueva', async () => {
        await montar();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Simular a Paula en una pestaña nueva' })); });
        expect(imp.simularEnPestanaNueva).toHaveBeenCalledWith(31, null, null);
    });

    it('a quien tiene varios roles se le pregunta con cuál, en la pantalla del Portal', async () => {
        await montar();
        fireEvent.click(screen.getByRole('button', { name: 'Simular a Marlon' }));
        const dialogo = screen.getByRole('dialog', { name: 'Simular a Marlon' });
        await act(async () => { fireEvent.click(within(dialogo).getByRole('button', { name: /Closer/ })); });
        expect(imp.simularA).toHaveBeenCalledWith(40, null, 'closer');
    });

    it('si no se puede cargar el equipo lo dice', async () => {
        api.get.mockRejectedValue(new Error('x'));
        await act(async () => { render(<SimularEnPortal />); });
        expect(screen.getByRole('alert').textContent).toBe('No se pudo cargar el equipo.');
    });
});

describe('quién puede simular', () => {
    it('admin, operador y dirección comercial, con cualquiera de sus roles o detrás de una simulación', () => {
        expect(['admin', 'operator', 'director_comercial'].every((role) => puedeSimular({ role }))).toBe(true);
        expect(['closer', 'setter', 'triage', 'hiring', 'director_marketing'].some((role) => puedeSimular({ role }))).toBe(false);
        expect(puedeSimular({ role: 'closer', roles: ['operator', 'closer'] })).toBe(true);
        expect(puedeSimular({ role: 'closer', is_impersonating: true, original_user_role: 'director_comercial' })).toBe(true);
        expect(puedeSimular({ role: 'closer', is_impersonating: true, original_user_role: 'closer', roles: [] })).toBe(false);
        expect(puedeSimular(null)).toBe(false);
    });

    it('abrirSimulacion abre el Portal en el paso de simular', () => {
        const abrir = vi.fn();
        const quitar = registrarPortal(abrir);
        abrirSimulacion();
        expect(abrir).toHaveBeenCalledWith('simular');
        quitar();
    });
});
