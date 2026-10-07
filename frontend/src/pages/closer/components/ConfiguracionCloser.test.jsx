import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConfiguracionCloser from './ConfiguracionCloser';
import api from '../../../services/api';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

const integraciones = () => fireEvent.click(screen.getByRole('tab', { name: /Integraciones/ }));

describe('Configuración del closer', () => {
    beforeEach(() => { api.get.mockReset(); api.put.mockReset(); api.delete.mockReset(); });

    it('tiene las pestañas de lo que decide el closer', () => {
        api.get.mockResolvedValue({ data: {} });
        render(<ConfiguracionCloser />);
        expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Datos', 'Disponibilidad', 'Integraciones', 'Mis eventos']);
    });

    it('sin Google Calendar conectado ofrece conectarlo y explica por qué', async () => {
        api.get.mockResolvedValue({ data: { connected: false } });
        render(<ConfiguracionCloser />);
        integraciones();
        expect(await screen.findByRole('button', { name: /Conectar con Google/i })).toBeTruthy();
        expect(screen.getByText(/sin él, el sistema de agendas no te ofrece/i)).toBeTruthy();
        expect(api.get).toHaveBeenCalledWith('/google/calendars');
    });

    it('conectado muestra el estado y el calendario de destino', async () => {
        const calendar = { connected: true, selected_calendar: 'primary', calendars: [{ id: 'primary', summary: 'Ana', primary: true }] };
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/google/calendars' ? calendar : {} }));
        render(<ConfiguracionCloser />);
        integraciones();
        expect(await screen.findByText(/Conectado/)).toBeTruthy();
        expect(screen.getByText('Ana (principal)')).toBeTruthy();  // el calendario de destino
    });

    it('en Mis eventos crea un evento propio sin formulario y lo puede pasar a uno', async () => {
        api.get.mockResolvedValue({ data: { eventos: [], formularios: [{ id: 'fo', nombre: 'Calificación' }] } });
        api.put.mockImplementation((url, cuerpo) => Promise.resolve({ data: { evento: {
            id: url.split('/').pop(), nombre: cuerpo.nombre || 'Seguimiento', duracion: 45, formulario: cuerpo.formulario || '', activo: true, link: '/agenda/ana-seguimiento',
        } } }));
        render(<ConfiguracionCloser />);
        fireEvent.click(screen.getByRole('tab', { name: /Mis eventos/ }));
        expect(await screen.findByText('Todavía no creaste eventos propios.')).toBeTruthy();
        fireEvent.change(screen.getByLabelText('Nuevo evento'), { target: { value: 'Seguimiento' } });
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Crear' })); });
        expect(api.put).toHaveBeenCalledWith(expect.stringMatching(/^\/auth\/me\/eventos\/e/), { nombre: 'Seguimiento', duracion: 45, formulario: '' });
        expect(screen.getByDisplayValue('Seguimiento')).toBeTruthy();
        expect(screen.getByText(/\/agendas-v2\/agenda\/ana-seguimiento$/)).toBeTruthy();
        expect(screen.getByText('Sin formulario (solo contacto)')).toBeTruthy();
    });
});
