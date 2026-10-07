// Eventos es el eje: cada tarjeta dice lo que le falta y lleva a resolverlo; el funnel es una categoría.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import { almacen } from '../../data/hooks';
import { ui } from '../../ui/estadoUi';
import { configDe, estadoFunnel, pasosAgendamiento } from '../../core/eventos';
import { settersDe } from './comun';
import { buscar } from '../../core/datos';
import ListaEventos from './ListaEventos';

const envolver = (el) => <div className="thalamus thalamus-app">{el}</div>;
let fuListo, fuVacio, evListo, evBorrador;

beforeAll(() => {
    act(() => {
        const ana = almacen.crear('personas', { nombre: 'Ana', rol: 'closer', horario: { 1: [['09:00', '18:00']] } });
        const g = almacen.crear('grupos', { nombre: 'Ultra', miembros: [ana] });
        const fo = almacen.crear('formularios', { nombre: 'Calificación', preguntas: [], reglas: [], resto: g });
        fuListo = almacen.crear('funnels', { nombre: 'Workshop', slug: 'workshop', tipo: 'workshop' });
        fuVacio = almacen.crear('funnels', { nombre: 'VSL', slug: 'vsl', tipo: 'vsl' });
        evListo = almacen.crear('eventos', { nombre: 'Diagnóstico', slug: 'diagnostico', funnel: fuListo, formulario: fo });
        evBorrador = almacen.crear('eventos', { nombre: 'Seguimiento', slug: 'seguimiento', funnel: fuListo, formulario: '' });
        const { d } = almacen.getState();
        almacen.editar('eventos', evListo, { publicado: configDe(buscar(d, 'eventos', evListo), buscar(d, 'formularios', fo)) }, true);
    });
});
beforeEach(() => { cleanup(); act(() => ui.set({ funnel: null, ev: null, seccion: 'eventos' })); });

describe('Eventos', () => {
    it('los pasos van en orden y dicen qué falta', () => {
        const { d } = almacen.getState();
        expect(pasosAgendamiento(d, buscar(d, 'eventos', evListo)).map(p => p.ok)).toEqual([true, true, true, true]);
        const borrador = pasosAgendamiento(d, buscar(d, 'eventos', evBorrador));
        expect(borrador.map(p => p.k)).toEqual(['equipo', 'formulario', 'evento', 'publicado']);
        // Ana tiene horario en la estrategia Ultra: el equipo está; falta el formulario y publicar.
        expect(borrador.filter(p => !p.ok).map(p => p.n)).toEqual(['Sin formulario', 'Borrador']);

        const listo = estadoFunnel(d, buscar(d, 'funnels', fuListo));
        expect(listo.listo).toBe(true);  // con un agendamiento completo ya recibe agendas
        expect(listo.faltas).toEqual(['Falta: formulario, publicar']);
        expect(estadoFunnel(d, buscar(d, 'funnels', fuVacio))).toMatchObject({ listo: false, faltas: ['Sin agendamientos'] });
    });

    it('cada tarjeta muestra solo lo que le falta, agrupada por funnel', () => {
        act(() => ui.set({ evAgrupar: 'funnel' }));
        render(envolver(<ListaEventos />));
        expect(screen.queryByRole('list', { name: 'Lo que le falta a Diagnóstico' })).toBeNull();
        const pend = screen.getByRole('list', { name: 'Lo que le falta a Seguimiento' });
        expect(within(pend).getAllByRole('button').map(b => b.textContent)).toEqual(['Sin formulario', 'Borrador']);
        expect(screen.getByText('Workshop', { selector: '.t-rotulo' })).toBeTruthy();
    });

    it('un funnel sin agendamientos aparece igual, con «Agregar agendamiento»', () => {
        act(() => ui.set({ evAgrupar: 'funnel' }));
        render(envolver(<ListaEventos />));
        expect(screen.getByText('VSL', { selector: '.t-rotulo' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Agregar agendamiento/ }));
        expect(ui.getState().funnel).toEqual({ id: fuVacio });
    });

    it('un evento de un funnel de setting muestra los links de setters', () => {
        act(() => { almacen.editar('funnels', fuListo, { tipo: 'setting', setting: true }, true); });
        render(envolver(<ListaEventos />));
        expect(screen.getAllByText('Links de setters').length).toBe(2);
        act(() => { almacen.editar('funnels', fuListo, { tipo: 'workshop', setting: false }, true); });
    });

    it('un formulario sin segmentación lleva a su segmentación', () => {
        act(() => {
            const fo = almacen.getState().d.formularios[0];
            almacen.editar('eventos', evBorrador, { formulario: fo.id }, true);
            almacen.editar('formularios', fo.id, { resto: '' }, true);
        });
        render(envolver(<ListaEventos />));
        const pasos = screen.getByRole('list', { name: 'Lo que le falta a Seguimiento' });
        fireEvent.click(within(pasos).getByRole('button', { name: /Sin segmentación/ }));
        expect(ui.getState()).toMatchObject({ seccion: 'preguntas', form: { vista: 'ruteo' } });
    });
    it('cada funnel dice si recibe agendas, y uno de setting tiene solo los setters elegidos', () => {
        render(envolver(<ListaEventos />));
        expect(screen.getAllByText('Activo').length).toBeGreaterThan(0);
        const sts = [{ id: 1, nombre: 'juan' }, { id: 2, nombre: 'eva' }];
        expect(settersDe({ setters: [] }, sts)).toEqual(sts);
        expect(settersDe({ setters: [2] }, sts).map(x => x.nombre)).toEqual(['eva']);
        expect(settersDe({ setters: [2] }, null)).toBeNull();
    });
});
