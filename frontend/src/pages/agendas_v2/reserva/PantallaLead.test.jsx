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
// El WhatsApp de Bolivia (va primero; con un evento se busca si ya agendó), el correo (opcional) vacío,
// nombre e Instagram vacío.
async function responderContacto(c, tel = '7123 4567') {
    expect(screen.getByRole('heading', { name: '¿A qué WhatsApp te escribimos?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^País:/ }));
    fireEvent.click(screen.getByRole('option', { name: /Bolivia/ }));
    await act(async () => { escribirYEnter(c, tel); });
    escribirYEnter(c, '');
    escribirYEnter(c, 'Ana Gómez');
    escribirYEnter(c, '');
    expect(screen.getByRole('heading', { name: '¿Cuánto podés invertir?' })).toBeInTheDocument();
}
// Hasta el WhatsApp de Bolivia (y la búsqueda del lead que vuelve).
async function dejarWhatsapp(c, tel) {
    fireEvent.click(screen.getByRole('button', { name: /^País:/ }));
    fireEvent.click(screen.getByRole('option', { name: /Bolivia/ }));
    await act(async () => { escribirYEnter(c, tel); });
}
function elegir(texto) {
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(texto) }));
    act(() => { vi.advanceTimersByTime(400); });
}

// Los horarios aparecen recién al elegir un día: el primero con horarios.
const elegirDia = (container) => fireEvent.click(container.querySelector('.rv-dia:not(:disabled)'));

describe('PantallaLead', () => {
    it('una regla con url corta antes del calendario y avisa a dónde va el lead', async () => {
        const conUrl = normalForm('f2', { ...form, reglas: [{ id: 'r1', url: 'https://academy.thelearnation.com/', cond: [{ q: 'q1', ops: ['o1'] }] }] });
        const { container } = render(<PantallaLead fuente={{ form: conUrl }} proveedor={local()} modo="prueba" />);
        await responderContacto(container);
        elegir('Lo necesario');
        expect(screen.getByRole('heading', { name: 'Gracias, Ana.' })).toBeInTheDocument();
        expect(screen.getByText(/academy\.thelearnation\.com/)).toBeInTheDocument();
        expect(container.querySelector('.rv-dia')).toBeNull();
    });

    it('una regla a «No califica» corta antes del calendario con el cierre', async () => {
        const conNo = normalForm('f3', { ...form, reglas: [{ id: 'r1', grupo: '__no', cond: [{ q: 'q1', ops: ['o1'] }] }] });
        const { container } = render(<PantallaLead fuente={{ form: conNo }} proveedor={local()} modo="prueba" />);
        await responderContacto(container);
        elegir('Lo necesario');
        expect(screen.getByRole('heading', { name: 'Gracias por tu sinceridad' })).toBeInTheDocument();
        expect(container.querySelector('.rv-dia')).toBeNull();
    });

    it('el que no califica va a la página de cierre del formulario, si tiene', async () => {
        const conPagina = normalForm('f4', { ...form, fin: { ...form.fin, url: 'https://work.thelearnation.com/agendas-v2/agenda/descalificados' } });
        const { container } = render(<PantallaLead fuente={{ form: conPagina }} proveedor={local()} modo="prueba" />);
        await responderContacto(container);
        elegir('Nada por ahora');
        expect(screen.getByRole('heading', { name: 'Gracias, Ana.' })).toBeInTheDocument();
        expect(screen.getByText(/agendas-v2\/agenda\/descalificados/)).toBeInTheDocument();
    });

    it('avanza con los datos de contacto y una opción hasta el calendario', async () => {
        const { container } = render(<PantallaLead fuente={{ form }} proveedor={local()} modo="prueba" />);
        await responderContacto(container);
        elegir('Lo necesario');
        expect(screen.getByRole('heading', { name: 'Ana, elegí día y horario' })).toBeInTheDocument();
        expect(container.querySelector('.rv-hora')).toBeNull();
        elegirDia(container);
        expect(container.querySelectorAll('.rv-hora').length).toBeGreaterThan(0);
    });

    it('al agendar con correo le avisa que revise la invitación', () => {
        const { container } = render(<PantallaLead fuente={{ form }} proveedor={local()} modo="prueba" />);
        fireEvent.click(screen.getByRole('button', { name: /^País:/ }));
        fireEvent.click(screen.getByRole('option', { name: /Bolivia/ }));
        escribirYEnter(container, '7123 4567');
        escribirYEnter(container, 'ana@correo.com');
        escribirYEnter(container, 'Ana Gómez');
        escribirYEnter(container, '');
        elegir('Lo necesario');
        elegirDia(container);
        fireEvent.click(container.querySelector('.rv-hora'));
        fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
        expect(screen.getByText(/Te mandamos la invitación a/)).toHaveTextContent('ana@correo.com');
    });

    it('valida antes de seguir', () => {
        const { container } = render(<PantallaLead fuente={{ form }} proveedor={local()} modo="prueba" />);
        expect(screen.getByRole('heading', { name: '¿A qué WhatsApp te escribimos?' })).toBeInTheDocument();
        escribirYEnter(container, '12');
        expect(screen.getByRole('alert')).toHaveTextContent('El número parece incompleto.');
        escribirYEnter(container, '7123 4567');
        escribirYEnter(container, 'no-es-un-correo');
        expect(screen.getByRole('alert')).toHaveTextContent('Revisá el correo.');
        escribirYEnter(container, '');
        fireEvent.keyDown(campo(container), { key: 'Enter' });
        expect(screen.getByRole('alert')).toHaveTextContent('Completá este dato.');
        expect(screen.getByRole('heading', { name: '¿Cómo te llamás?' })).toBeInTheDocument();
    });

    it('una opción que descalifica muestra el cierre', async () => {
        const { container } = render(<PantallaLead fuente={{ form }} proveedor={local()} modo="prueba" />);
        await responderContacto(container);
        elegir('Nada por ahora');
        expect(screen.getByRole('heading', { name: 'Gracias por tu sinceridad' })).toBeInTheDocument();
        expect(screen.getByText('No califica')).toBeInTheDocument();
    });

    it('en el link público, confirmar crea la reserva con closer y teléfono internacional', async () => {
        const spy = vi.spyOn(almacen, 'crearReserva');
        const { container } = render(<PantallaLead fuente={{ form, evento }} proveedor={local(p => almacen.crearReserva(p))} modo="publico" origen="ig" />);
        expect(screen.queryByText(/no se agenda nada/)).not.toBeInTheDocument();
        await responderContacto(container);
        elegir('Lo necesario');
        elegirDia(container);
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
        // Sin correo no hay invitación de Calendar: no se la promete.
        expect(screen.queryByText(/Te mandamos la invitación/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Vista del closer/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }));
        expect(screen.getByRole('heading', { name: /^Nos vemos el lunes, Ana\.$/ })).toBeInTheDocument();
    });

    it('al lead que vuelve lo reconoce por el WhatsApp y no le pide de nuevo sus datos', async () => {
        const reservas = [{
            id: 'r0', estado: 'agendada', inicio_ms: Date.UTC(2026, 9, 6, 13), fin_ms: Date.UTC(2026, 9, 6, 14), closer_id: 'ana',
            lead: { nombre: 'Ana Gómez', telefono: '+59171234567', email: 'ana@correo.com', instagram: '' },
        }];
        const { container } = render(<PantallaLead fuente={{ form, evento }} proveedor={proveedorLocal(almacen.getState().d, reservas)} modo="prueba" />);
        await dejarWhatsapp(container, '7123 4567');
        expect(screen.getByRole('heading', { name: 'Detectamos que no es tu primera vez agendando una sesión con nosotros.' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Agendar una nueva/ }));
        // Sin escribir correo, nombre ni Instagram: directo a las preguntas.
        expect(screen.getByRole('heading', { name: '¿Cuánto podés invertir?' })).toBeInTheDocument();
    });

    it('si no aparece por el WhatsApp lo reconoce por el correo', async () => {
        const reservas = [{
            id: 'r0', estado: 'agendada', inicio_ms: Date.UTC(2026, 9, 6, 13), fin_ms: Date.UTC(2026, 9, 6, 14), closer_id: 'ana',
            lead: { nombre: 'Ana Gómez', telefono: '+59171234567', email: 'ana@correo.com', instagram: '' },
        }];
        const { container } = render(<PantallaLead fuente={{ form, evento }} proveedor={proveedorLocal(almacen.getState().d, reservas)} modo="prueba" />);
        await dejarWhatsapp(container, '7999 9999');
        expect(screen.getByRole('heading', { name: '¿Cuál es tu correo?' })).toBeInTheDocument();
        await act(async () => { escribirYEnter(container, 'ANA@correo.com'); });
        expect(screen.getByRole('heading', { name: 'Detectamos que no es tu primera vez agendando una sesión con nosotros.' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Agendar una nueva/ }));
        // Sin confirmar ni volver a escribir nombre y WhatsApp: directo a las preguntas.
        expect(screen.getByRole('heading', { name: '¿Cuánto podés invertir?' })).toBeInTheDocument();
        elegir('Lo necesario');
        expect(screen.getByRole('heading', { name: 'Ana, elegí día y horario' })).toBeInTheDocument();
    });
});

describe('PantallaLead, el lead que vuelve sin todos sus datos', () => {
    it('le precarga el nombre y sigue después del correo', async () => {
        const reservas = [{
            id: 'r0', estado: 'hecha', inicio_ms: Date.UTC(2026, 8, 1, 13), fin_ms: Date.UTC(2026, 8, 1, 14), closer_id: 'ana',
            lead: { nombre: 'Ana Gómez', telefono: '', email: 'ana@correo.com', instagram: '' },
        }];
        const { container } = render(<PantallaLead fuente={{ form, evento }} proveedor={proveedorLocal(almacen.getState().d, reservas)} modo="prueba" />);
        await dejarWhatsapp(container, '7999 9999');
        await act(async () => { escribirYEnter(container, 'ana@correo.com'); });
        expect(screen.queryByRole('heading', { name: /no es tu primera vez/ })).not.toBeInTheDocument();
        expect(container.querySelector('[data-rv="in"]').value).toBe('Ana Gómez');
    });
});

describe('PantallaLead, el lead que ya respondió el formulario', () => {
    // Ya agendó y ya pasó (sin sesión próxima): con sus datos completos y las respuestas a este formulario.
    const previa = (formularioId) => [{
        id: 'r0', estado: 'hecha', inicio_ms: Date.UTC(2026, 8, 1, 13), fin_ms: Date.UTC(2026, 8, 1, 14), closer_id: 'ana', formulario_id: formularioId,
        lead: { nombre: 'Ana Gómez', telefono: '+59171234567', email: 'ana@correo.com', instagram: '' },
        respuestas: [{ pregunta_id: 'q1', tipo: 'opciones', respuesta: 'Lo necesario', opcion_id: 'o1' }],
    }];

    it('confirma que sigue igual y va directo al calendario', async () => {
        const { container } = render(<PantallaLead fuente={{ form, evento }} proveedor={proveedorLocal(almacen.getState().d, previa('f1'))} modo="prueba" />);
        await dejarWhatsapp(container, '7123 4567');
        expect(screen.getByRole('heading', { name: 'Ya respondiste estas preguntas la última vez.' })).toBeInTheDocument();
        expect(screen.queryByText('Lo necesario')).not.toBeInTheDocument(); // sus respuestas no se muestran
        fireEvent.click(screen.getByRole('button', { name: /Sí, sigue igual/ }));
        expect(screen.getByRole('heading', { name: 'Ana, elegí día y horario' })).toBeInTheDocument();
        elegirDia(container);
        expect(container.querySelectorAll('.rv-hora').length).toBeGreaterThan(0);
        // Atrás vuelve a preguntarle si sigue igual; puede responder de nuevo.
        fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
        fireEvent.click(screen.getByRole('button', { name: /responderlas de nuevo/ }));
        expect(screen.getByRole('heading', { name: '¿Cuánto podés invertir?' })).toBeInTheDocument();
    });

    it('si respondió otro formulario (o este cambió) contesta de nuevo', async () => {
        const { container } = render(<PantallaLead fuente={{ form, evento }} proveedor={proveedorLocal(almacen.getState().d, previa('otro'))} modo="prueba" />);
        await dejarWhatsapp(container, '7123 4567');
        expect(screen.getByRole('heading', { name: '¿Cuánto podés invertir?' })).toBeInTheDocument();
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
