import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisponibilidadCloser from './DisponibilidadCloser';
import api from '../../../services/api';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));

const DATOS = {
    en_team: false,
    horario: { 0: [], 1: [['09:00', '13:00']], 2: [], 3: [], 4: [], 5: [], 6: [] },
    tz: 'America/Argentina/Buenos_Aires',
    zonas: [{ tz: 'America/La_Paz', n: 'Bolivia' }, { tz: 'America/Argentina/Buenos_Aires', n: 'Argentina' }],
    horas: ['09:00', '13:00', '14:00', '18:00'],
};

describe('Disponibilidad del closer', () => {
    beforeEach(() => { api.get.mockReset(); api.put.mockReset(); });

    it('muestra su horario y su zona, y guarda lo que cambia', async () => {
        api.get.mockResolvedValue({ data: DATOS });
        api.put.mockImplementation((url, cuerpo) => Promise.resolve({ data: { ...DATOS, ...cuerpo, en_team: true } }));
        render(<DisponibilidadCloser />);

        expect(await screen.findByRole('checkbox', { name: 'Trabajo el lunes' })).toBeChecked();
        expect(screen.getByDisplayValue('Argentina')).toBeTruthy();  // la zona adivinada por su WhatsApp
        expect(screen.getByRole('button', { name: 'Guardar disponibilidad' })).toBeDisabled();

        fireEvent.click(screen.getByRole('checkbox', { name: 'Trabajo el martes' }));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Guardar disponibilidad' })); });
        const [url, cuerpo] = api.put.mock.calls[0];
        expect(url).toBe('/auth/me/disponibilidad');
        expect(cuerpo.tz).toBe('America/Argentina/Buenos_Aires');
        expect(cuerpo.horario[1]).toEqual([['09:00', '13:00']]);
        expect(cuerpo.horario[2]).toEqual([['09:00', '18:00']]);
        expect(screen.getByRole('status')).toHaveTextContent('quedó guardada');
    });
});
