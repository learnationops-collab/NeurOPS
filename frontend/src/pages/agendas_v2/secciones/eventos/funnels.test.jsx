// La sección Funnels: cada funnel dice si recibe agendas o qué le falta, y los agendamientos se crean adentro.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import { almacen } from '../../data/hooks';
import { ui } from '../../ui/estadoUi';
import { configDe, estadoFunnel, pasosAgendamiento } from '../../core/eventos';
import { buscar } from '../../core/datos';
import ListaFunnels from './ListaFunnels';

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

describe('Funnels', () => {
    it('los pasos van en orden y dicen qué falta', () => {
        const { d } = almacen.getState();
        expect(pasosAgendamiento(d, buscar(d, 'eventos', evListo)).map(p => p.ok)).toEqual([true, true, true, true]);
        const borrador = pasosAgendamiento(d, buscar(d, 'eventos', evBorrador));
        expect(borrador.map(p => p.k)).toEqual(['formulario', 'equipo', 'evento', 'publicado']);
        expect(borrador.filter(p => !p.ok).map(p => p.n)).toEqual(['Sin formulario', 'Sin equipo', 'Borrador']);

        const listo = estadoFunnel(d, buscar(d, 'funnels', fuListo));
        expect(listo.listo).toBe(true);  // con un agendamiento completo ya recibe agendas
        expect(listo.faltas).toEqual(['Falta: formulario, equipo, publicar']);
        expect(estadoFunnel(d, buscar(d, 'funnels', fuVacio))).toMatchObject({ listo: false, faltas: ['Sin agendamientos'] });
    });

    it('la tarjeta muestra el estado y crea agendamientos adentro del funnel', () => {
        render(envolver(<ListaFunnels />));
        const vsl = screen.getByRole('article', { name: 'Funnel VSL' });
        expect(within(vsl).getByText('Falta configurar')).toBeTruthy();
        expect(within(screen.getByRole('article', { name: 'Funnel Workshop' })).getByText('Recibe agendas')).toBeTruthy();

        fireEvent.change(within(vsl).getByLabelText('Nuevo agendamiento en VSL'), { target: { value: 'Llamada VSL' } });
        fireEvent.submit(within(vsl).getByLabelText('Nuevo agendamiento en VSL').closest('form'));
        const nuevo = almacen.getState().d.eventos.find(e => e.nombre === 'Llamada VSL');
        expect(nuevo.funnel).toBe(fuVacio);
        expect(ui.getState().ev).toMatchObject({ id: nuevo.id });  // abre el agendamiento para seguir armándolo
    });

    it('un paso de equipo pendiente lleva al ruteo del formulario', () => {
        act(() => {
            const fo = almacen.getState().d.formularios[0];
            almacen.editar('eventos', evBorrador, { formulario: fo.id }, true);
            almacen.editar('formularios', fo.id, { resto: '' }, true);
        });
        render(envolver(<ListaFunnels />));
        const pasos = screen.getByRole('list', { name: 'Pasos de Seguimiento' });
        fireEvent.click(within(pasos).getByRole('button', { name: /Sin equipo/ }));
        expect(ui.getState()).toMatchObject({ seccion: 'preguntas', form: { vista: 'ruteo' } });
    });
});
