// Pruebas de humo de Stats, el modal del funnel, el menú del perfil y Crear rápido.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { almacen } from '../../data/hooks';
import { ui } from '../../ui/estadoUi';
import Stats from '../stats/Stats';
import ModalFunnel, { leerPaquete } from '../eventos/ModalFunnel';
import CrearRapido from './CrearRapido';

const envolver = (el) => <div className="thalamus thalamus-app">{el}</div>;

beforeAll(() => {
    act(() => {
        const rol = almacen.crear('roles', { nombre: 'Closer', atiende: true, accesos: ['team.ver', 'events.ver', 'stats.ver'], orden: 1 });
        almacen.crear('roles', { nombre: 'CEO', accesos: [], orden: 2 });
        const hor = { 1: [['09:00', '18:00']] };
        almacen.crear('personas', { nombre: 'Ana Closer', rol, horario: hor, orden: 1 });
        const fu = almacen.crear('funnels', { nombre: 'Webinar', slug: 'webinar', orden: 1 });
        const fo = almacen.crear('formularios', { nombre: 'Form A', preguntas: [{ tipo: 'opciones', titulo: '¿Cuánto invertís?', opciones: [{ texto: 'Poco', puntos: 2 }, { texto: 'Mucho', puntos: 10 }] }] });
        almacen.crear('eventos', { nombre: 'Llamada', slug: 'llamada', funnel: fu, formulario: fo, orden: 1 });
    });
});
beforeEach(() => { cleanup(); act(() => ui.set({ sim: null, menu: null, funnel: null, crear: false, seccion: 'estadisticas' })); });

describe('Stats', () => {
    it('muestra KPIs y gráficos con datos de ejemplo', () => {
        render(envolver(<Stats />));
        expect(screen.getByText('Datos de ejemplo')).toBeTruthy();
        expect(screen.getByText('Agendas por día')).toBeTruthy();
        expect(screen.getByText('Por closer')).toBeTruthy();
        expect(screen.getByText('No califican')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: '7 días' }));
        expect(ui.getState().est.dias).toBe(7);
    });
});

describe('Modal del funnel', () => {
    it('crea un funnel con slug único y su tipo, y pasa a editarlo', () => {
        act(() => ui.set({ funnel: {} }));
        render(envolver(<ModalFunnel estado={{}} />));
        fireEvent.change(document.getElementById('fm-nombre'), { target: { value: 'Webinar' } });
        fireEvent.click(screen.getByRole('radio', { name: /^VSL/ }));
        fireEvent.submit(document.getElementById('fm-nombre').closest('form'));
        const nuevo = almacen.getState().d.funnels.find(f => f.slug === 'webinar-2');
        expect(nuevo.tipo).toBe('vsl');
        expect(ui.getState().funnel).toEqual({ id: nuevo.id });
    });

    it('edita el tipo de un funnel; en setting muestra los links de setters', () => {
        const fu = almacen.getState().d.funnels.find(f => f.slug === 'webinar');
        render(envolver(<ModalFunnel estado={{ id: fu.id }} />));
        fireEvent.click(screen.getByRole('radio', { name: /^Setting/ }));
        const f = almacen.getState().d.funnels.find(x => x.id === fu.id);
        expect(f.tipo).toBe('setting');
        expect(f.setting).toBe(true);
        // Setting: los links son los de cada setter. La IA queda plegada aparte.
        expect(screen.getByRole('heading', { name: 'Links de setters' })).toBeTruthy();
        expect(document.querySelector('details.fm-ia').open).toBe(false);
    });

    it('lee el JSON de la IA aunque venga dentro de un bloque con texto', () => {
        expect(leerPaquete('Listo:\n```json\n{"a": 1}\n```\nSaludos').paquete).toEqual({ a: 1 });
        expect(leerPaquete('no es json').error).toMatch(/No es un JSON válido/);
    });
});

describe('Crear rápido', () => {
    it('la tecla 6 abre el modal de nuevo funnel', () => {
        act(() => ui.set({ crear: true }));
        render(envolver(<CrearRapido />));
        fireEvent.keyDown(document, { key: '6' });
        expect(ui.getState().crear).toBe(false);
        expect(ui.getState().funnel).toEqual({});
    });
});
