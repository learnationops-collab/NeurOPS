// Forms › Páginas de gracias: se crean como un formulario, se editan con vista previa real y cada evento
// elige la suya. Borrarla la saca de los eventos.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { almacen } from '../../data/hooks';
import { ui } from '../../ui/estadoUi';
import { buscar } from '../../core/datos';
import { normalGracias } from '../../core/normalizar';
import Forms from './Forms';
import { borrarGracias, crearGracias } from './ListaGracias';

vi.mock('../../data/videos', async (orig) => ({ ...(await orig()), soltarVideo: vi.fn() }));

const envolver = (el) => <div className="thalamus thalamus-app">{el}</div>;
const doc = (id) => buscar(almacen.getState().d, 'gracias', id);

beforeEach(() => { cleanup(); act(() => ui.set({ seccion: 'preguntas', form: null, gracias: null, recurso: 'formularios' })); });

describe('normalGracias', () => {
    it('corrige lo que no vale (igual que el servidor)', () => {
        expect(normalGracias('g', { video: { archivo: '../x', url: 'http://inseguro.com' }, segundos: 999, basura: 1 })).toEqual({
            id: 'g', nombre: 'Sin nombre', video: { archivo: '', nombre: '', url: '' }, plan: { archivo: '', nombre: '', url: '' },
            segundos: 60, casos: true, orden: 0,
        });
    });
});

describe('Páginas de gracias', () => {
    it('se crea desde la pestaña de Forms con los videos de Learnation y se edita', () => {
        render(envolver(<Forms />));
        fireEvent.click(screen.getByRole('button', { name: /Páginas de gracias/ }));
        fireEvent.change(screen.getByLabelText('Nueva página de gracias'), { target: { value: 'Gracias Workshop' } });
        act(() => { fireEvent.click(screen.getByRole('button', { name: /Crear/ })); });

        const id = ui.getState().gracias.id;
        const g = doc(id);
        expect(g.nombre).toBe('Gracias Workshop');
        expect(g.video.url).toMatch(/^https:\/\/www\.loom\.com\/share\//);
        expect(g.casos).toBe(true);

        // La vista previa es la página pública de verdad.
        expect(screen.getByTitle('Vista previa de la página de gracias').getAttribute('src')).toMatch(new RegExp('^/agendas-v2/agenda/gracias/' + id + '\\?previa='));

        // Un link que no se puede mostrar no se guarda; uno de YouTube sí.
        const link = screen.getByLabelText('Link de Video para completar la reserva');
        act(() => { fireEvent.change(link, { target: { value: 'https://ejemplo.com/x.mp4' } }); });
        expect(doc(id).video.url).toMatch(/loom/);
        act(() => { fireEvent.change(link, { target: { value: 'https://youtu.be/MKSw7VcC4-s' } }); });
        expect(doc(id).video.url).toBe('https://youtu.be/MKSw7VcC4-s');

        act(() => { fireEvent.click(screen.getByRole('switch', { name: /casos de éxito/ })); });
        expect(doc(id).casos).toBe(false);
        act(() => { fireEvent.click(screen.getAllByRole('button', { name: 'Más' })[0]); });
        expect(doc(id).segundos).toBe(6);
    });

    it('borrarla la saca de los eventos que la usaban', () => {
        let g, ev;
        act(() => {
            crearGracias('Para borrar');
            g = ui.getState().gracias.id;
            ev = almacen.crear('eventos', { nombre: 'Llamada', slug: 'llamada-g', gracias: g });
        });
        expect(buscar(almacen.getState().d, 'eventos', ev).gracias).toBe(g);
        act(() => { borrarGracias(doc(g)); });
        expect(doc(g)).toBeFalsy();
        expect(buscar(almacen.getState().d, 'eventos', ev).gracias).toBe('');
    });
});
