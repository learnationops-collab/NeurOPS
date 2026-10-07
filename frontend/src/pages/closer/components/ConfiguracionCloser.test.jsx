import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConfiguracionCloser from './ConfiguracionCloser';
import api from '../../../services/api';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

describe('Configuración del closer', () => {
    beforeEach(() => { api.get.mockReset(); });

    it('sin Google Calendar conectado ofrece conectarlo y explica por qué', async () => {
        api.get.mockResolvedValue({ data: { connected: false } });
        render(<ConfiguracionCloser />);

        expect(await screen.findByRole('button', { name: /Conectar con Google/i })).toBeTruthy();
        expect(screen.getByText(/sin él, el sistema de agendas no te ofrece/i)).toBeTruthy();
        expect(api.get).toHaveBeenCalledWith('/google/calendars');
    });

    it('conectado muestra el estado y el calendario de destino', async () => {
        const calendar = { connected: true, selected_calendar: 'primary', calendars: [{ id: 'primary', summary: 'Ana', primary: true }] };
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/google/calendars' ? calendar : {} }));
        render(<ConfiguracionCloser />);

        expect(await screen.findByText(/Conectado/)).toBeTruthy();
        expect(screen.getByText('Ana (principal)')).toBeTruthy();  // el calendario de destino
    });
});
