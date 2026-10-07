// Pantalla del lead: avanzar por el formulario, cortar al que no califica y agendar en el link público.

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalEvento, normalForm } from '../core/normalizar';
import { almacen } from '../data/hooks';
import PaginaPublica from './PaginaPublica';
import PantallaLead from './PantallaLead';
import { proveedorLocal } from './proveedores';

// Lunes 5 de octubre de 2026, 08:00 en La Paz (UTC-4).
const LUNES = Date.UTC(2026, 9, 5, 12, 0);
const LV9a12 = { 1: [['09:00', '12:00']], 2: [['09:00', '12:00']], 3: [['09:00', '12:00']], 4: [['09:00', '12:00']], 5: [['09:00', '12:00']] };

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

beforeAll(async () => {
    localStorage.setItem('thalamus-personas', JSON.stringify([{ id: 'ana', nombre: 'Ana Pérez', rol: 'closer', tz: 'America/La_Paz', horario: LV9a12 }]));
    await almacen.iniciar();
});
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(LUNES);
});
afterEach(() => { vi.useRealTimers(); });

// Proveedor local con los datos del almacén; crear: dónde se agenda (solo el link público).
const local = (crear = null) => proveedorLocal(almacen.getState().d, almacen.getState().reservas, crear);

const campo = (c) => c.querySelector('[data-rv="in"]');
function escribirYEnter(c, v) {
    const el = campo(c);
    fireEvent.change(el, { target: { value: v } });
    fireEvent.keyDown(el, { key: 'Enter' });
}
// El correo (opcional, va primero) vacío, nombre, WhatsApp de Bolivia e Instagram vacío.
function responderContacto(c) {
    escribirYEnter(c, '');
    escribirYEnter(c, 'Ana Gómez');
    expect(screen.getByRole('heading', { name: 'Ana, ¿a qué WhatsApp te escribimos?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^País:/ }));
    fireEvent.click(screen.getByRole('option', { name: /Bolivia/ }));
    escribirYEnter(c, '7123 4567');
    escribirYEnter(c, '');
    expect(screen.getByRole('heading', { name: '¿Cuánto podés invertir?' })).toBeInTheDocument();
}
function elegir(texto) {
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(texto) }));
    act(() => { vi.advanceTimersByTime(400); });
}

describe('PantallaLead', () => {
    it('avanza con los datos de contacto y una opción hasta el calendario', () => {
        const { container } = render(<PantallaLead fuente={{ form }} proveedor={local()} modo="prueba" />);
        responderContacto(container);
        elegir('Lo necesario');
        expect(screen.getByRole('heading', { name: 'Ana, elegí día y horario' })).toBeInTheDocument();
        expect(container.querySelectorAll('.rv-hora').length).toBeGreaterThan(0);
    });

    it('valida antes de seguir', () => {
        const { container } = render(<PantallaLead fuente={{ form }} proveedor={local()} modo="prueba" />);
        expect(screen.getByRole('heading', { name: '¿Cuál es tu correo?' })).toBeInTheDocument();
        escribirYEnter(container, 'no-es-un-correo');
        expect(screen.getByRole('alert')).toHaveTextContent('Revisá el correo.');
        escribirYEnter(container, '');
        fireEvent.keyDown(campo(container), { key: 'Enter' });
        expect(screen.getByRole('alert')).toHaveTextContent('Completá este dato.');
        expect(screen.getByRole('heading', { name: '¿Cómo te llamás?' })).toBeInTheDocument();
    });

    it('una opción que descalifica muestra el cierre', () => {
        const { container } = render(<PantallaLead fuente={{ form }} proveedor={local()} modo="prueba" />);
        responderContacto(container);
        elegir('Nada por ahora');
        expect(screen.getByRole('heading', { name: 'Gracias por tu sinceridad' })).toBeInTheDocument();
        expect(screen.getByText('No califica')).toBeInTheDocument();
    });

    it('en el link público, confirmar crea la reserva con closer y teléfono internacional', async () => {
        const spy = vi.spyOn(almacen, 'crearReserva');
        const { container } = render(<PantallaLead fuente={{ form, evento }} proveedor={local(p => almacen.crearReserva(p))} modo="publico" origen="ig" />);
        expect(screen.queryByText(/no se agenda nada/)).not.toBeInTheDocument();
        responderContacto(container);
        elegir('Lo necesario');
        fireEvent.click(container.querySelector('.rv-hora'));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Confirmar/ })); });
        expect(spy).toHaveBeenCalledTimes(1);
        const payload = spy.mock.calls[0][0];
        expect(payload.closer_id).toBe('ana');
        expect(payload.lead.telefono).toBe('+59171234567');
        expect(payload.origen).toBe('ig');
        expect(payload.inicio).toBe(new Date(Date.UTC(2026, 9, 5, 13)).toISOString());
        expect(screen.getByRole('heading', { name: 'Listo, Ana. Tu sesión quedó agendada.' })).toBeInTheDocument();
        expect(screen.getByText('Ana Pérez')).toBeInTheDocument(); // su consultor
        expect(screen.queryByText(/Vista del closer/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Es correcto/ }));
        expect(screen.getByRole('heading', { name: /^Nos vemos el lunes, Ana\.$/ })).toBeInTheDocument();
    });

    it('al lead que vuelve lo reconoce por el correo y no le pide de nuevo sus datos', async () => {
        const reservas = [{
            id: 'r0', estado: 'agendada', inicio_ms: Date.UTC(2026, 9, 6, 13), fin_ms: Date.UTC(2026, 9, 6, 14), closer_id: 'ana',
            lead: { nombre: 'Ana Gómez', telefono: '+59171234567', email: 'ana@correo.com', instagram: '' },
        }];
        const { container } = render(<PantallaLead fuente={{ form, evento }} proveedor={proveedorLocal(almacen.getState().d, reservas)} modo="prueba" />);
        await act(async () => { escribirYEnter(container, 'ANA@correo.com'); });
        expect(screen.getByRole('heading', { name: 'Detectamos que no es tu primera vez agendando una sesión con nosotros.' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Agendar una nueva/ }));
        expect(screen.getByRole('heading', { name: '¿Son correctos tus datos?' })).toBeInTheDocument();
        expect(screen.getByText('+59 ••• 567')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Sí, son correctos/ }));
        // Sin volver a escribir nombre ni WhatsApp: directo a las preguntas.
        expect(screen.getByRole('heading', { name: '¿Cuánto podés invertir?' })).toBeInTheDocument();
        elegir('Lo necesario');
        expect(screen.getByRole('heading', { name: 'Ana, elegí día y horario' })).toBeInTheDocument();
    });
});

describe('PaginaPublica', () => {
    it('un link que no existe muestra el aviso', async () => {
        vi.useRealTimers();
        render(
            <MemoryRouter initialEntries={['/agenda/nada/no-existe']}>
                <Routes><Route path="/agenda/:funnel/:evento" element={<PaginaPublica />} /></Routes>
            </MemoryRouter>,
        );
        expect(await screen.findByRole('heading', { name: 'Este link no está disponible' })).toBeInTheDocument();
    });
});
