// Pantalla del lead con el proveedor de la API: los horarios llegan después, un "ocupado" vuelve a
// pedirlos y el que no califica se registra una vez sin horario.

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../services/api';
import { normalEvento, normalForm } from '../core/normalizar';
import PantallaLead from './PantallaLead';
import { proveedorApi } from './proveedores';

vi.mock('../../../services/api', () => ({
    default: { get: vi.fn(), put: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

// Lunes 5 de octubre de 2026, 08:00 en La Paz (UTC-4).
const LUNES = Date.UTC(2026, 9, 5, 12, 0);
const H9 = Date.UTC(2026, 9, 5, 13), H10 = Date.UTC(2026, 9, 5, 14), H11 = Date.UTC(2026, 9, 5, 15);

const form = normalForm('f1', {
    nombre: 'Diagnóstico',
    contacto: { nombre: true, telefono: true, email: false, instagram: false },
    preguntas: [{
        id: 'q1', tipo: 'opciones', titulo: '¿Cuánto podés invertir?', peso: 1,
        opciones: [{ id: 'o1', texto: 'Lo necesario', puntos: 10 }, { id: 'o2', texto: 'Nada por ahora', descalifica: true }],
    }],
});
const evento = normalEvento('e1', {
    nombre: 'Llamada de diagnóstico', slug: 'diagnostico', formulario: 'f1', duracion: 45,
    antel: { n: 0, u: 'h' }, paso: { n: 60, u: 'min' }, reservas: { modo: 'dias', n: 14 },
});

// Promesa que el test resuelve cuando quiere (para ver el "Buscando horarios…").
function diferida() {
    let resolver, rechazar;
    const promesa = new Promise((res, rej) => { resolver = res; rechazar = rej; });
    return { promesa, resolver, rechazar };
}
const errHttp = (status, data = {}) => Object.assign(new Error('HTTP ' + status), { response: { status, data } });

const esHorarios = (url) => url === '/agendas-v2/publico/eventos/e1/horarios';
const llamadasA = (pred) => api.post.mock.calls.filter(c => pred(c[0]));

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(LUNES);
});
afterEach(() => { vi.useRealTimers(); });

const campo = (c) => c.querySelector('[data-rv="in"]');
function escribirYEnter(c, v) {
    const el = campo(c);
    fireEvent.change(el, { target: { value: v } });
    fireEvent.keyDown(el, { key: 'Enter' });
}
function responderContacto(c) {
    escribirYEnter(c, 'Ana Gómez');
    fireEvent.click(screen.getByRole('button', { name: /^País:/ }));
    fireEvent.click(screen.getByRole('option', { name: /Bolivia/ }));
    escribirYEnter(c, '7123 4567');
    escribirYEnter(c, '');
    escribirYEnter(c, '');
}
function elegir(texto) {
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(texto) }));
    act(() => { vi.advanceTimersByTime(400); });
}

describe('PantallaLead con la API', () => {
    it('muestra "Buscando horarios…" hasta que llegan, y un ocupado avisa y los vuelve a pedir', async () => {
        const primera = diferida(), segunda = diferida();
        let nHorarios = 0;
        api.post.mockImplementation((url) => {
            if (esHorarios(url)) return (++nHorarios === 1 ? primera : segunda).promesa;
            if (url === '/agendas-v2/publico/reservas') return Promise.reject(errHttp(409, { code: 'ocupado' }));
            return Promise.reject(errHttp(404));
        });
        const { container } = render(<PantallaLead fuente={{ form, evento }} proveedor={proveedorApi()} modo="publico" origen="ig" />);
        responderContacto(container);
        elegir('Lo necesario');

        expect(screen.getByRole('heading', { name: 'Ana, elegí día y horario' })).toBeInTheDocument();
        expect(screen.getByText('Buscando horarios…')).toBeInTheDocument();
        expect(container.querySelector('.rv-hora')).toBeNull();
        const [url, cuerpo] = llamadasA(esHorarios)[0];
        expect(url).toBe('/agendas-v2/publico/eventos/e1/horarios');
        expect(cuerpo).toMatchObject({ resp: { q1: 'o1', 'c-nombre': 'Ana Gómez' } });
        expect(typeof cuerpo.tz).toBe('string');

        await act(async () => { primera.resolver({ data: { slots: [H10, H9] } }); });
        expect(screen.queryByText('Buscando horarios…')).not.toBeInTheDocument();
        expect([...container.querySelectorAll('.rv-hora')].map(b => Number(b.dataset.t))).toEqual([H9, H10]);

        fireEvent.click(container.querySelector('.rv-hora'));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Confirmar/ })); });
        const reservas = llamadasA(u => u === '/agendas-v2/publico/reservas');
        expect(reservas).toHaveLength(1);
        expect(reservas[0][1]).toMatchObject({ evento_id: 'e1', pais: 'BO', inicio: new Date(H9).toISOString(), origen: 'ig' });
        expect(screen.getByRole('alert')).toHaveTextContent('Ese horario se acaba de ocupar. Elegí otro.');

        // Pide los horarios de nuevo; mientras tanto siguen los anteriores (sin pantalla en blanco).
        expect(llamadasA(esHorarios)).toHaveLength(2);
        expect(container.querySelectorAll('.rv-hora').length).toBe(2);
        await act(async () => { segunda.resolver({ data: { slots: [H10, H11] } }); });
        expect([...container.querySelectorAll('.rv-hora')].map(b => Number(b.dataset.t))).toEqual([H10, H11]);
    });

    it('agenda con éxito y un 429 se explica con calma', async () => {
        let intento = 0;
        api.post.mockImplementation((url) => {
            if (esHorarios(url)) return Promise.resolve({ data: { slots: [H9] } });
            if (++intento === 1) return Promise.reject(errHttp(429));
            return Promise.resolve({ data: { reserva: { id: 'r1', inicio: new Date(H9).toISOString(), duracion: 45 } } });
        });
        const { container } = render(<PantallaLead fuente={{ form, evento }} proveedor={proveedorApi()} modo="publico" />);
        responderContacto(container);
        await act(async () => { elegir('Lo necesario'); });
        fireEvent.click(container.querySelector('.rv-hora'));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Confirmar/ })); });
        expect(screen.getByRole('alert')).toHaveTextContent('Demasiados intentos, probá en un minuto.');
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Confirmar/ })); });
        expect(screen.getByRole('heading', { name: 'Listo, Ana. Tu llamada quedó agendada.' })).toBeInTheDocument();
    });

    it('el que no califica se registra una vez, sin horario', async () => {
        api.post.mockResolvedValue({ data: { descalificada: true } });
        const { container } = render(<PantallaLead fuente={{ form, evento }} proveedor={proveedorApi()} modo="publico" />);
        responderContacto(container);
        await act(async () => { elegir('Nada por ahora'); });
        expect(screen.getByRole('heading', { name: 'Gracias por tu sinceridad' })).toBeInTheDocument();
        expect(api.post).toHaveBeenCalledTimes(1);
        expect(api.post.mock.calls[0][0]).toBe('/agendas-v2/publico/reservas');
        expect(api.post.mock.calls[0][1]).toMatchObject({ evento_id: 'e1', inicio: null, resp: { q1: 'o2' } });
    });
});
