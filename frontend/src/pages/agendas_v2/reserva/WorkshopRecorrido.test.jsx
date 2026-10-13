// El link del workshop de punta a punta en la página pública (con la API): cada tipo de lead contesta el
// formulario real del workshop y se mira qué ve y qué le manda al servidor. Es el mismo workshop que
// tests/agendas_v2/test_workshop_e2e.py recorre del lado del servidor.

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../services/api';
import { normalEvento, normalForm } from '../core/normalizar';
import PaginaPublica from './PaginaPublica';

vi.mock('../data/modo', () => ({ MODO_LOCAL: false }));
vi.mock('../../../services/api', () => ({
    default: { get: vi.fn(), put: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

// Lunes 5 de octubre de 2026, 08:00 en La Paz (UTC-4).
const LUNES = Date.UTC(2026, 9, 5, 12, 0);
const H9 = Date.UTC(2026, 9, 5, 13), H10 = Date.UTC(2026, 9, 5, 14);

const form = normalForm('fw', {
    nombre: 'Calificación workshop',
    contacto: { nombre: true, telefono: true, email: true, instagram: true },
    preguntas: [
        {
            id: 'inv', tipo: 'opciones', titulo: '¿Cuánto podés invertir?', peso: 2, opciones: [
                { id: 'mas1000', texto: 'Más de 1000 USD', puntos: 10 }, { id: 'entre', texto: 'Entre 500 y 1000 USD', puntos: 6 },
                { id: 'menos', texto: 'Menos de 500 USD', puntos: 2 }, { id: 'nada', texto: 'Nada por ahora', descalifica: true },
            ],
        },
        {
            id: 'sit', tipo: 'lista', titulo: '¿A qué te dedicás?', peso: 1, opciones: [
                { id: 'emprende', texto: 'Emprendo', puntos: 10 }, { id: 'trabaja', texto: 'Trabajo en relación de dependencia', puntos: 5 },
                { id: 'estudia', texto: 'Estudio', puntos: 2 },
            ],
        },
    ],
    reglas: [
        { id: 'r1', grupo: 'alta', cond: [{ q: 'inv', ops: ['mas1000'] }] },
        { id: 'r2', grupo: 'media', cond: [{ q: 'inv', ops: ['entre'] }, { q: 'sit', ops: ['emprende'] }] },
        { id: 'r3', url: 'https://academy.thelearnation.com/', cond: [{ q: 'inv', ops: ['menos'] }, { q: 'sit', ops: ['estudia'] }] },
        { id: 'r4', grupo: '__no', cond: [{ q: 'inv', ops: ['menos'] }, { q: 'sit', ops: ['trabaja'] }] },
    ],
    resto: 'baja',
    fin: { titulo: 'Gracias por tu sinceridad', texto: 'Te escribimos cuando sea un buen momento.' },
});
const evento = normalEvento('ew', {
    nombre: 'Llamada de diagnóstico', slug: 'llamada', funnel: 'fw', formulario: 'fw', duracion: 45,
    antel: { n: 0, u: 'h' }, paso: { n: 60, u: 'min' }, reservas: { modo: 'dias', n: 14 },
});

const pedidos = (ruta) => api.post.mock.calls.filter(c => c[0] === ruta);
const HORARIOS = '/agendas-v2/publico/eventos/ew/horarios', AVANCE = '/agendas-v2/publico/eventos/ew/avance';
const RESERVAS = '/agendas-v2/publico/reservas', CONOCIDO = '/agendas-v2/publico/eventos/ew/conocido';

// El servidor: nadie es conocido, los horarios de hoy y la reserva con su consultor.
function servidor() {
    api.get.mockResolvedValue({ data: { evento, form, funnel: { nombre: 'Workshop octubre', slug: 'workshop-octubre' } } });
    api.post.mockImplementation((url, cuerpo) => {
        if (url === CONOCIDO) return Promise.resolve({ data: { conocido: false } });
        if (url === AVANCE) return Promise.resolve({ data: null });
        if (url === HORARIOS) return Promise.resolve({ data: { slots: [H9, H10] } });
        if (url === RESERVAS) {
            if (!cuerpo.inicio) return Promise.resolve({ data: { descalificada: true } });
            return Promise.resolve({ data: { reserva: { id: '1', inicio: new Date(cuerpo.inicio).toISOString(), duracion: 45, consultor: { nombre: 'Ana', color: '' } } } });
        }
        return Promise.reject(Object.assign(new Error('404'), { response: { status: 404 } }));
    });
}

async function abrir(origen) {
    const r = render(
        <MemoryRouter initialEntries={['/agenda/workshop-octubre/llamada?o=' + origen]}>
            <Routes><Route path="/agenda/:funnel/:evento" element={<PaginaPublica />} /></Routes>
        </MemoryRouter>,
    );
    await act(async () => { });
    return r.container;
}

// Deja sus datos en el orden en que se los pidan: WhatsApp de Bolivia, correo, nombre e Instagram.
async function dejarDatos(c) {
    for (let i = 0; i < 6 && !screen.queryByRole('heading', { name: '¿Cuánto podés invertir?' }); i++) {
        const el = c.querySelector('[data-rv="in"]');
        expect(el).not.toBeNull();
        let v = 'Lucía Paz';
        if (el.type === 'tel') {
            fireEvent.click(screen.getByRole('button', { name: /^País:/ }));
            fireEvent.click(screen.getByRole('option', { name: /Bolivia/ }));
            v = '7123 4567';
        } else if (el.type === 'email') v = 'lucia@correo.com';
        else if (c.querySelector('.rv-pre')) v = 'luciapaz';
        fireEvent.change(c.querySelector('[data-rv="in"]'), { target: { value: v } });
        await act(async () => { fireEvent.keyDown(c.querySelector('[data-rv="in"]'), { key: 'Enter' }); });
        expect(screen.queryByRole('alert')?.textContent || '').toBe('');
    }
    expect(screen.getByRole('heading', { name: '¿Cuánto podés invertir?' })).toBeInTheDocument();
}
async function elegir(rol, texto) {
    fireEvent.click(screen.getByRole(rol, { name: new RegExp(texto) }));
    await act(async () => { vi.advanceTimersByTime(400); });
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(LUNES);
    api.get.mockReset();
    api.post.mockReset();
    servidor();
});
afterEach(() => { vi.useRealTimers(); });

describe('El link del workshop', () => {
    it('un lead que califica desde la grabación agenda y ve su confirmación', async () => {
        const c = await abrir('grabacion');
        expect(api.get.mock.calls[0][0]).toBe('/agendas-v2/publico/eventos/workshop-octubre/llamada');
        expect(document.title).toBe('Llamada de diagnóstico');
        await dejarDatos(c);
        await elegir('radio', 'Más de 1000 USD');
        await elegir('option', 'Emprendo');

        expect(screen.getByRole('heading', { name: 'Lucía, elegí día y horario' })).toBeInTheDocument();
        const [, pedido] = pedidos(HORARIOS).at(-1);
        expect(pedido.resp).toMatchObject({ inv: 'mas1000', sit: 'emprende', 'c-email': 'lucia@correo.com', 'c-nombre': 'Lucía Paz' });
        fireEvent.click(c.querySelector('.rv-dia:not(:disabled)'));
        fireEvent.click(c.querySelector('.rv-hora'));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Confirmar/ })); });

        const reservas = pedidos(RESERVAS);
        expect(reservas).toHaveLength(1);
        expect(reservas[0][1]).toMatchObject({
            evento_id: 'ew', pais: 'BO', origen: 'grabacion', inicio: new Date(H9).toISOString(),
            resp: { inv: 'mas1000', sit: 'emprende', 'c-telefono': '7123 4567', 'c-instagram': 'luciapaz' },
        });
        expect(screen.getAllByText(/Ana/).length).toBeGreaterThan(0);
        // Cada paso desde que dejó sus datos quedó registrado, con su origen.
        expect(pedidos(AVANCE).length).toBeGreaterThan(0);
        expect(pedidos(AVANCE).every(([, b]) => b.origen === 'grabacion')).toBe(true);
        expect(pedidos(AVANCE).some(([, b]) => b.en_calendario)).toBe(true);
    });

    it('una regla que manda a la Academia no agenda y lo lleva a esa página', async () => {
        const c = await abrir('instagram');
        await dejarDatos(c);
        await elegir('radio', 'Menos de 500 USD');
        await elegir('option', 'Estudio');
        expect(screen.getByRole('heading', { name: 'Gracias, Lucía.' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Continuar/ })).toHaveAttribute('href', 'https://academy.thelearnation.com/');
        expect(pedidos(HORARIOS)).toHaveLength(0);
        // Queda registrado una vez, sin horario.
        expect(pedidos(RESERVAS)).toHaveLength(1);
        expect(pedidos(RESERVAS)[0][1]).toMatchObject({ inicio: null, origen: 'instagram' });
    });

    it('una regla a «No califica» muestra el cierre y no ofrece horarios', async () => {
        const c = await abrir('instagram');
        await dejarDatos(c);
        await elegir('radio', 'Menos de 500 USD');
        await elegir('option', 'Trabajo en relación');
        expect(screen.getByRole('heading', { name: 'Gracias por tu sinceridad' })).toBeInTheDocument();
        expect(screen.getByText('Te escribimos cuando sea un buen momento.')).toBeInTheDocument();
        expect(pedidos(HORARIOS)).toHaveLength(0);
        expect(pedidos(RESERVAS)).toHaveLength(1);
        expect(pedidos(RESERVAS)[0][1]).toMatchObject({ inicio: null, resp: { inv: 'menos', sit: 'trabaja' } });
    });

    it('la respuesta que descalifica corta el formulario ahí mismo', async () => {
        const c = await abrir('instagram');
        await dejarDatos(c);
        await elegir('radio', 'Nada por ahora');
        expect(screen.getByRole('heading', { name: 'Gracias por tu sinceridad' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: '¿A qué te dedicás?' })).not.toBeInTheDocument();
        expect(pedidos(RESERVAS)).toHaveLength(1);
        expect(pedidos(RESERVAS)[0][1]).toMatchObject({ inicio: null, resp: { inv: 'nada' } });
    });

    it('todo lo demás llega al calendario y si el horario se ocupa le avisa', async () => {
        api.post.mockImplementation((url) => {
            if (url === CONOCIDO) return Promise.resolve({ data: { conocido: false } });
            if (url === HORARIOS) return Promise.resolve({ data: { slots: [H9, H10] } });
            if (url === RESERVAS) return Promise.reject(Object.assign(new Error('409'), { response: { status: 409, data: { code: 'ocupado' } } }));
            return Promise.resolve({ data: null });
        });
        const c = await abrir('instagram');
        await dejarDatos(c);
        await elegir('radio', 'Entre 500 y 1000 USD');
        await elegir('option', 'Estudio');
        expect(screen.getByRole('heading', { name: 'Lucía, elegí día y horario' })).toBeInTheDocument();
        fireEvent.click(c.querySelector('.rv-dia:not(:disabled)'));
        fireEvent.click(c.querySelector('.rv-hora'));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Confirmar/ })); });
        expect(screen.getByRole('alert')).toHaveTextContent('Ese horario se acaba de ocupar. Elegí otro.');
    });
});
