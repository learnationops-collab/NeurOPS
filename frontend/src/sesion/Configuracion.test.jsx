import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Configuracion, { pestanasDe } from './Configuracion';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

const CLOSER = { role: 'closer', username: 'jc' };
const integraciones = () => fireEvent.click(screen.getByRole('tab', { name: /Integraciones/ }));

describe('Configuración', () => {
    beforeEach(() => { api.get.mockReset(); api.put.mockReset(); api.delete.mockReset(); });

    it('tiene las pestañas de lo que decide el closer', () => {
        api.get.mockResolvedValue({ data: {} });
        render(<Configuracion user={CLOSER} />);
        expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Datos', 'Disponibilidad', 'Integraciones', 'Mis eventos', 'Apariencia']);
    });

    it('cada rol ve las pestañas que le tocan', () => {
        const de = (rol) => pestanasDe(rol).map(p => p.id);
        expect(de('setter')).toEqual(['datos', 'apariencia']);
        expect(de('operator')).toEqual(['datos', 'apariencia']);
        expect(de('director_comercial')).toEqual(['datos', 'disponibilidad', 'integraciones', 'apariencia']);
        expect(de('admin')).toEqual(['datos', 'disponibilidad', 'integraciones', 'equipo', 'apariencia']);
    });

    it('sin Google Calendar conectado ofrece conectarlo y explica por qué', async () => {
        api.get.mockResolvedValue({ data: { connected: false } });
        render(<Configuracion user={CLOSER} />);
        integraciones();
        expect(await screen.findByRole('button', { name: /Conectar con Google/i })).toBeTruthy();
        expect(screen.getByText(/sin él, el sistema de agendas no te ofrece/i)).toBeTruthy();
        expect(api.get).toHaveBeenCalledWith('/google/calendars');
    });

    it('conectado muestra el estado y el calendario de destino', async () => {
        const calendar = { connected: true, selected_calendar: 'primary', calendars: [{ id: 'primary', summary: 'Ana', primary: true }] };
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/google/calendars' ? calendar : {} }));
        render(<Configuracion user={CLOSER} />);
        integraciones();
        expect(await screen.findByText(/Conectado/)).toBeTruthy();
        expect(screen.getByText('Ana (principal)')).toBeTruthy();  // el calendario de destino
    });

    it('en Mis eventos crea un evento propio sin formulario y lo puede pasar a uno', async () => {
        api.get.mockResolvedValue({ data: { eventos: [], formularios: [{ id: 'fo', nombre: 'Calificación' }] } });
        api.put.mockImplementation((url, cuerpo) => Promise.resolve({ data: { evento: {
            id: url.split('/').pop(), nombre: cuerpo.nombre || 'Seguimiento', duracion: 45, formulario: cuerpo.formulario || '', activo: true, link: '/agenda/ana-seguimiento',
        } } }));
        render(<Configuracion user={CLOSER} />);
        fireEvent.click(screen.getByRole('tab', { name: /Mis eventos/ }));
        expect(await screen.findByText('Todavía no creaste eventos propios.')).toBeTruthy();
        fireEvent.change(screen.getByLabelText('Nuevo evento'), { target: { value: 'Seguimiento' } });
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Crear' })); });
        expect(api.put).toHaveBeenCalledWith(expect.stringMatching(/^\/auth\/me\/eventos\/e/), { nombre: 'Seguimiento', duracion: 45, formulario: '' });
        expect(screen.getByDisplayValue('Seguimiento')).toBeTruthy();
        expect(screen.getByText(/\/agendas-v2\/agenda\/ana-seguimiento$/)).toBeTruthy();
        expect(screen.getByText('Sin formulario (solo contacto)')).toBeTruthy();
    });

    it('toma el modo de la hoja que la contiene: texto claro es hoja oscura aunque la app esté en claro', () => {
        api.get.mockResolvedValue({ data: {} });
        const modo = (color) => {
            const hoja = document.createElement('div');
            hoja.className = 'bg-surface';
            hoja.style.color = color;
            document.body.appendChild(hoja);
            const { container, unmount } = render(<Configuracion user={CLOSER} />, { container: hoja });
            const tema = container.querySelector('.cu-hoja').dataset.theme;
            unmount();
            hoja.remove();
            return tema;
        };
        expect(modo('rgb(255, 255, 255)')).toBe('dark');  // glass: hoja navy con texto blanco
        expect(modo('rgb(15, 23, 42)')).toBe('light');
    });

    it('fuera de una hoja sigue el modo de la app', () => {
        api.get.mockResolvedValue({ data: {} });
        const { container } = render(<Configuracion user={CLOSER} />);
        expect(container.querySelector('.cu-hoja').dataset.theme).toBe('light');
    });

    it('en Apariencia se elige el fondo del Portal y del login, y queda en este navegador', () => {
        api.get.mockResolvedValue({ data: {} });
        localStorage.clear();
        render(<Configuracion user={CLOSER} tabInicial="apariencia" />);
        const fondos = screen.getByRole('radiogroup', { name: 'Fondo del Portal' });
        const opciones = () => Array.from(fondos.querySelectorAll('[role="radio"]'));
        expect(opciones().map(o => o.getAttribute('aria-label'))).toEqual(['Simple', 'Humo', 'Partículas', 'Aurora']);
        expect(opciones()[0].getAttribute('aria-checked')).toBe('true');
        fireEvent.click(opciones()[1]);
        expect(localStorage.getItem('ln-fondo-entrada')).toBe('humo');
        expect(opciones()[1].getAttribute('aria-checked')).toBe('true');
    });
});
