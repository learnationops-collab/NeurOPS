// Pruebas de humo de Stats, Configuración, el menú del perfil y Crear rápido.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { almacen } from '../../data/hooks';
import { ui } from '../../ui/estadoUi';
import Stats from '../stats/Stats';
import Configuracion from './Configuracion';
import MenuYo from './MenuYo';
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
beforeEach(() => { cleanup(); act(() => ui.set({ sim: null, menu: null, conf: null, crear: false, seccion: 'estadisticas' })); });

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

describe('Configuración', () => {
    it('crea un funnel con slug único', () => {
        act(() => ui.set({ conf: { tab: 'funnels' } }));
        render(envolver(<Configuracion />));
        fireEvent.change(document.getElementById('cf-nuevo'), { target: { value: 'Webinar' } });
        fireEvent.submit(document.getElementById('cf-nuevo').closest('form'));
        const slugs = almacen.getState().d.funnels.map(f => f.slug).sort();
        expect(slugs).toEqual(['webinar', 'webinar-2']);
        expect(screen.queryByRole('tab', { name: 'Accesos' })).toBeNull();  // sin permisos propios de Thalamus
    });

    it('«Recibe llamadas» se marca en la fila del rol', () => {
        act(() => ui.set({ conf: { tab: 'roles' } }));
        render(envolver(<Configuracion />));
        const ceo = almacen.getState().d.roles.find(r => r.nombre === 'CEO');
        fireEvent.click(screen.getByRole('switch', { name: 'Recibe llamadas: CEO' }));
        expect(almacen.getState().d.roles.find(r => r.id === ceo.id).atiende).toBe(!ceo.atiende);
    });

    it('roles sugeridos usan los accesos por nombre', () => {
        act(() => ui.set({ conf: { tab: 'roles' } }));
        render(envolver(<Configuracion />));
        fireEvent.click(screen.getByRole('button', { name: 'Setter' }));
        const st = almacen.getState().d.roles.find(r => r.nombre === 'Setter');
        expect(st.accesos).toEqual(['events.ver', 'events.links', 'stats.ver']);
    });

    it('Sumarme a Team crea la persona y la vincula', () => {
        act(() => ui.set({ conf: { tab: 'perfil' } }));
        render(envolver(<Configuracion />));
        fireEvent.click(screen.getByRole('button', { name: /Sumarme a Team/ }));
        const { perfil, d } = almacen.getState();
        const yo = d.personas.find(p => p.id === perfil.persona);
        expect(yo).toBeTruthy();
        expect(d.roles.find(r => r.id === yo.rol).atiende).toBe(true);
        expect(yo.horario[1]).toEqual([['09:00', '18:00']]);
    });
});

describe('Menú del perfil', () => {
    it('no tiene simulador propio: ofrece la simulación oficial de NeurOPS', () => {
        render(envolver(<MenuYo />));
        fireEvent.click(document.getElementById('yo'));
        expect(screen.queryByRole('menuitem', { name: /Simular un rol/ })).toBeNull();
        expect(screen.queryByRole('menuitem', { name: /Simular a una persona/ })).toBeNull();
        fireEvent.click(screen.getByRole('menuitem', { name: /Simular a un closer/ }));
        expect(ui.getState().menu).toBe('closers');
    });
});

describe('Crear rápido', () => {
    it('la tecla 7 abre Configuración en Roles', () => {
        act(() => ui.set({ crear: true }));
        render(envolver(<CrearRapido />));
        fireEvent.keyDown(document, { key: '7' });
        expect(ui.getState().crear).toBe(false);
        expect(ui.getState().conf).toEqual({ tab: 'roles' });
    });
});
