// Available con datos: el «N agendas» cuenta también lo de fuera del horario (14/10/2026: mostraba 16 cuando
// eran más de 20), cada tarjeta dice el closer y el lead sin pasar el mouse, el Filtro completo de Closing
// filtra con la ficha de cada agenda y la vista de un día pone un carril por closer.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { almacen } from '../../data/hooks';
import { ui } from '../../ui/estadoUi';
import Available from './Available';

const LUNES = Date.UTC(2026, 9, 12, 12);          // lunes 12/10/2026, mediodía UTC
const H = (dia, h, m = 0) => Date.UTC(2026, 9, 12 + dia, h, m);

const PERSONAS = [
    { id: 'a', nombre: 'Jean Carlo', rol: 'closer', color: 'azul', tz: 'UTC', horario: { 1: [['09:00', '13:00']], 2: [['09:00', '13:00']] } },
    { id: 'b', nombre: 'Beto', rol: 'closer', color: 'verde', tz: 'UTC', horario: {} },
];
const reserva = (id, closer, inicio, lead) => ({ id, closer_id: closer, estado: 'agendada', inicio_ms: inicio, fin_ms: inicio + 45 * 60000, lead: { nombre: lead } });
const RESERVAS = [
    reserva('1', 'a', H(0, 10), 'Lucía Pérez'),
    reserva('2', 'a', H(0, 16), 'Marta Gómez'),     // fuera de su horario
    reserva('3', 'b', H(1, 11), 'Pablo Ruiz'),      // Beto no tiene horario
];
const ficha = (fuente) => ({ fuente, setter: 'paula', pre_call: { key: 'confirmada', label: 'Confirmada' }, post_call: { key: 'pendiente', label: 'Pendiente' }, asistio: false });

beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(LUNES);
    const ad = almacen.adaptador;
    ad.cargar = async () => ({ cols: { personas: PERSONAS }, perfil: null, integ: null, reservas: RESERVAS, zona: 'UTC' });
    ad.ocupacion = async () => ({});
    ad.fichas = async () => ({ 1: ficha('Instagram'), 2: ficha('Taller'), 3: ficha('Taller') });
    await almacen.iniciar();
});
afterAll(() => { cleanup(); vi.useRealTimers(); });

const agendado = () => screen.getByText('Agendado').closest('.av-kpi');
const mostrar = async () => { render(<Available />); await act(async () => {}); };

describe('Available', () => {
    it('cuenta todas las agendas de la semana, con el closer y el lead en cada tarjeta', async () => {
        await mostrar();
        expect(agendado().textContent).toMatch(/3 agendas/);
        expect(screen.getAllByText('Lucía Pérez').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Marta Gómez').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Pablo Ruiz').length).toBeGreaterThan(0);
        const tarjeta = screen.getAllByText('Lucía Pérez')[0].closest('.av-card');
        expect(within(tarjeta).getByText('Jean Carlo')).toBeTruthy();
    });

    it('el Filtro completo filtra con la ficha de Closing y dice cuántas se ven', async () => {
        await mostrar();
        fireEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));
        const panel = screen.getByRole('dialog', { name: 'Filtro completo' });
        expect(within(panel).getByText('Fuente')).toBeTruthy();
        fireEvent.click(within(panel).getByRole('checkbox', { name: /Instagram/ }));
        expect(agendado().textContent).toMatch(/1 de 3 agendas/);
        expect(screen.queryAllByText('Marta Gómez')).toHaveLength(0);
        fireEvent.click(screen.getByRole('button', { name: 'Quitar Fuente: Instagram' }));
        expect(agendado().textContent).toMatch(/3 agendas/);
    });

    it('la vista de un día pone un carril por closer y cuenta las de ese día', async () => {
        await mostrar();
        fireEvent.click(screen.getByRole('button', { name: 'Día' }));
        expect(ui.getState().team.vista).toBe('dia');
        expect(document.querySelector('.av-rango').textContent).toMatch(/^Lunes/);
        expect(agendado().textContent).toMatch(/2 agendas/);
        expect(document.querySelectorAll('.av-carril-n')).toHaveLength(2);
        fireEvent.click(screen.getByRole('button', { name: 'Día siguiente' }));
        expect(agendado().textContent).toMatch(/1 agenda\b/);
        expect(screen.getAllByText('Pablo Ruiz').length).toBeGreaterThan(0);
    });
});
