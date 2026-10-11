// El setter en Thalamus (10/10/2026): mira todo y no cambia nada. El servidor lo dice (`solo_lectura`)
// y lo hace cumplir; acá se prueba que la pantalla no ofrezca lo que se configura y que, si algo se
// escapa, el almacén no lo mande.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { useRef } from 'react';
import { crearAlmacen } from './data/almacen';
import { almacen } from './data/hooks';
import { ui } from './ui/estadoUi';
import { bloquear, useSoloLectura } from './ui/soloLectura';
import ListaEventos from './secciones/eventos/ListaEventos';
import ListaForms from './secciones/forms/ListaForms';

const COLS = { funnels: [], formularios: [], personas: [], grupos: [], eventos: [], roles: [] };

describe('almacén en solo lectura', () => {
    const adaptador = () => ({
        tipo: 'api',
        cargar: vi.fn(async () => ({ cols: { ...COLS, funnels: [{ id: 'f1', nombre: 'Setting' }] }, perfil: null, integ: null, reservas: [], lectura: true })),
        guardar: vi.fn(async () => ({})), borrar: vi.fn(async () => ({})), guardarPerfil: vi.fn(async () => ({})), guardarInteg: vi.fn(async () => ({})),
        alCambiar: () => () => {},
    });

    it('no cambia nada ni manda nada, y avisa por qué', async () => {
        const ad = adaptador(), avisar = vi.fn();
        const alm = crearAlmacen(ad, { avisar });
        await alm.iniciar();
        const antes = alm.getState().d;

        expect(alm.getState().lectura).toBe(true);
        expect(alm.crear('eventos', { nombre: 'Nuevo' })).toBeNull();
        alm.editar('funnels', 'f1', { nombre: 'Otro' }, true);
        alm.borrar('funnels', 'f1');
        await alm.guardarPerfil({ nombre: 'Seba' });
        await alm.guardarInteg({});

        expect(alm.getState().d).toBe(antes);
        expect(alm.deshacer()).toBe(false);
        expect(ad.guardar).not.toHaveBeenCalled();
        expect(ad.borrar).not.toHaveBeenCalled();
        expect(ad.guardarPerfil).not.toHaveBeenCalled();
        expect(ad.guardarInteg).not.toHaveBeenCalled();
        expect(avisar).toHaveBeenCalledWith('Solo lectura: lo configura la dirección comercial.', 'error');
    });

    it('sin la marca del servidor, la dirección guarda como siempre', async () => {
        const ad = adaptador();
        ad.cargar.mockResolvedValueOnce({ cols: { ...COLS, funnels: [{ id: 'f1', nombre: 'Setting' }] }, perfil: null, integ: null, reservas: [] });
        const alm = crearAlmacen(ad, { avisar: vi.fn() });
        await alm.iniciar();

        alm.editar('funnels', 'f1', { nombre: 'Otro' }, true);

        expect(alm.getState().lectura).toBe(false);
        expect(ad.guardar).toHaveBeenCalledTimes(1);
    });
});

describe('bloqueo de la pantalla', () => {
    beforeEach(cleanup);

    it('deshabilita lo que configura y deja la navegación y la pantalla del lead', () => {
        const raiz = document.createElement('div');
        raiz.innerHTML = '<button id="borrar">Eliminar</button><button id="ir" data-nav="">Abrir</button><input id="nombre">'
            + '<div class="reserva"><button id="lead">Siguiente</button><input id="mail"></div>';

        bloquear(raiz);

        const q = (id) => raiz.querySelector('#' + id);
        expect([q('borrar').disabled, q('nombre').disabled]).toEqual([true, true]);
        expect([q('ir').disabled, q('lead').disabled, q('mail').disabled]).toEqual([false, false, false]);
    });

    it('lo que aparece después también nace bloqueado', async () => {
        function Raiz() {
            const ref = useRef(null);
            useSoloLectura(ref, true);
            return <div ref={ref} data-testid="raiz" />;
        }
        render(<Raiz />);
        const nuevo = document.createElement('button');
        nuevo.textContent = 'Duplicar';

        await act(async () => { screen.getByTestId('raiz').appendChild(nuevo); });

        expect(nuevo.disabled).toBe(true);
    });
});

describe('Thalamus en solo lectura', () => {
    const envolver = (el) => <div className="thalamus thalamus-app thalamus-app--lectura">{el}</div>;
    let original;

    beforeAll(async () => {
        original = almacen.adaptador.cargar;
        almacen.adaptador.cargar = async () => ({
            cols: {
                ...COLS,
                formularios: [{ id: 'fo1', nombre: 'Calificación', preguntas: [], reglas: [] }],
                funnels: [{ id: 'f1', nombre: 'Setting', slug: 'setting', tipo: 'setting', setting: true, activo: true }],
                eventos: [{ id: 'e1', nombre: 'Llamada', slug: 'llamada', funnel: 'f1', formulario: 'fo1' }],
            },
            perfil: null, integ: null, reservas: [], lectura: true,
        });
        // Los setters del funnel: el servidor marca con `yo` al de la sesión.
        almacen.adaptador.usuarios = vi.fn(async () => [{ id: 7, nombre: 'Ana', yo: true }, { id: 8, nombre: 'Beto', yo: false }]);
        await act(async () => { await almacen.recargar(); });
    });
    afterAll(() => { almacen.adaptador.cargar = original; });
    beforeEach(() => { cleanup(); act(() => ui.set({ funnel: null, ev: null, form: null, evAgrupar: 'funnel' })); });

    it('Eventos no ofrece crear ni editar funnels, y el setter ve solo su link', async () => {
        render(envolver(<ListaEventos />));

        expect(screen.queryByRole('button', { name: /Nuevo funnel/ })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Editar funnel Setting' })).toBeNull();
        expect(document.querySelector('form.ev-nuevo').hidden).toBe(true);
        const links = await screen.findByText('Tu link');
        const caja = links.closest('.ls');
        expect(await within(caja).findByRole('button', { name: 'Copiar link de Ana' })).toBeTruthy();
        expect(within(caja).queryByRole('button', { name: 'Copiar link de Beto' })).toBeNull();
        // Abrir y probar siguen: son navegación.
        expect(screen.getByRole('button', { name: 'Probar Llamada' }).hasAttribute('data-nav')).toBe(true);
    });

    it('Forms se abre para ver: sin crear, duplicar ni eliminar', () => {
        render(envolver(<ListaForms />));

        expect(screen.queryByText('Nuevo formulario')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Duplicar Calificación' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Eliminar Calificación' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Ver' })).toBeTruthy();
    });
});
