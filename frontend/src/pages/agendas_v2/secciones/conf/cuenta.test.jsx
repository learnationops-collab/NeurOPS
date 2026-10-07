// Las tarjetas de la cuenta (Configuración de Agendamiento y del closer): mismos endpoints de NeurOPS.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../../services/api';
import { TarjetaCalendar, TarjetaDisponibilidad, TarjetaWhatsapp } from './cuenta';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));

const envolver = (el) => <div className="thalamus">{el}</div>;

describe('Cuenta', () => {
    beforeEach(() => { api.get.mockReset(); api.put.mockReset(); api.post.mockReset(); });

    it('Calendar: desde Agendamiento pide volver ahí al conectar', async () => {
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/google/calendars' ? { connected: false } : { auth_url: '' } }));
        render(envolver(<TarjetaCalendar volver="agendamiento" />));
        const conectar = await screen.findByRole('button', { name: /Conectar con Google/ });
        await act(async () => { fireEvent.click(conectar); });
        expect(api.get).toHaveBeenCalledWith('/google/login', { params: { volver: 'agendamiento' } });
    });

    it('Calendar: se eligen los calendarios donde revisar conflictos', async () => {
        const cal = { connected: true, selected_calendar: 'primary', calendars: [{ id: 'primary', summary: 'Ana', primary: true, escribe: true }],
            todos: [{ id: 'primary', summary: 'Ana', primary: true, escribe: true }, { id: 'facu', summary: 'Facultad', escribe: false }], conflicto: ['primary'] };
        api.get.mockResolvedValue({ data: cal });
        api.post.mockImplementation((url, cuerpo) => Promise.resolve({ data: { conflicto: cuerpo.conflicto } }));
        render(envolver(<TarjetaCalendar />));
        const facu = await screen.findByRole('switch', { name: 'Revisar conflictos en Facultad' });
        expect(facu).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByRole('switch', { name: 'Revisar conflictos en Ana' })).toHaveAttribute('aria-checked', 'true');
        await act(async () => { fireEvent.click(facu); });
        expect(api.post).toHaveBeenCalledWith('/google/calendars', { conflicto: ['primary', 'facu'] });
        expect(facu).toHaveAttribute('aria-checked', 'true');
    });

    it('WhatsApp: guarda, manda la prueba y confirma', async () => {
        api.get.mockResolvedValue({ data: { numero: '', confirmado: false } });
        api.put.mockResolvedValue({ data: { numero: '5491122334455', confirmado: false } });
        api.post.mockImplementation((url) => Promise.resolve({ data: url.endsWith('confirmar') ? { numero: '5491122334455', confirmado: true } : {} }));
        render(envolver(<TarjetaWhatsapp />));
        fireEvent.change(await screen.findByLabelText(/Tu número/), { target: { value: '5491122334455' } });
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Mandarme una prueba/ })); });
        expect(api.post).toHaveBeenCalledWith('/auth/me/whatsapp/prueba');
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Sí, me llegó/ })); });
        expect(screen.getByText('Confirmado')).toBeTruthy();
    });

    it('Disponibilidad: el editor de Team, y se guarda con el botón', async () => {
        const datos = { en_team: true, horario: { 0: [], 1: [['09:00', '13:00']], 2: [], 3: [], 4: [], 5: [], 6: [] }, tz: 'America/Argentina/Buenos_Aires', zonas: [], horas: [] };
        api.get.mockResolvedValue({ data: datos });
        api.put.mockImplementation((url, cuerpo) => Promise.resolve({ data: { ...datos, ...cuerpo } }));
        render(envolver(<TarjetaDisponibilidad />));
        expect(await screen.findByRole('button', { name: /Quitar 09:00–13:00, lunes/i })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Guardar disponibilidad' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: /Agregar horario el martes/i }));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Guardar disponibilidad' })); });
        const [url, cuerpo] = api.put.mock.calls[0];
        expect(url).toBe('/auth/me/disponibilidad');
        expect(cuerpo.horario[2]).toEqual([['09:00', '18:00']]);
        expect(screen.getByRole('status')).toHaveTextContent('quedó guardada');
    });
});
