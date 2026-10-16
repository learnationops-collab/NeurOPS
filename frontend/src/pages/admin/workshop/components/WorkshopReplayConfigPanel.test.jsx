import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../services/api', () => ({ default: { put: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import api from '../../../../services/api';
import WorkshopReplayConfigPanel from './WorkshopReplayConfigPanel';

// Como las devuelve la API: hora local, sin zona.
const enHoras = (h) => {
    const d = new Date(Date.now() + h * 3600000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
};

const PASADO = { id: 15, date: '2026-10-12', name: 'WEBINAR 12 DE OCTUBRE', inicio_at: '2026-10-12T23:00:00' };
const FUTURO = { id: 16, date: '2099-11-02', name: 'WEBINAR 2 DE NOVIEMBRE', inicio_at: '2099-11-02T23:00:00' };

describe('Workshop › Landing grabación › grabación y publicación separadas', () => {
    beforeEach(() => api.put.mockReset().mockResolvedValue({ data: {} }));

    it('arranca en el último taller que ya pasó y guardar la grabación no la publica', async () => {
        render(<WorkshopReplayConfigPanel events={[FUTURO, PASADO]} />);

        expect(screen.getByRole('combobox', { name: /Taller/ })).toHaveValue('15');
        expect(screen.getByText('No publicada')).toBeInTheDocument();
        // Sin grabación guardada no se puede publicar.
        expect(screen.getByRole('button', { name: /Publicar ahora/ })).toBeDisabled();

        await userEvent.click(screen.getByLabelText(/Link o ID del video de Loom/));
        await userEvent.paste('https://www.loom.com/share/abc123def?sid=1');
        await userEvent.click(screen.getByRole('button', { name: 'Guardar grabación' }));

        expect(api.put).toHaveBeenCalledWith('workshop/events/15', { replay_loom_id: 'abc123def' });
    });

    it('publicar pone desde y vence; con una publicada, «Dejar de publicar» la cierra ya', async () => {
        const { rerender } = render(<WorkshopReplayConfigPanel events={[{ ...PASADO, replay_loom_id: 'abc123def' }]} />);

        expect(screen.getByRole('link', { name: /Ver grabación/ })).toHaveAttribute('href', 'https://www.loom.com/share/abc123def');
        await userEvent.click(screen.getByRole('button', { name: /Publicar ahora \(48 h\)/ }));
        const cuerpo = api.put.mock.calls[0][1];
        expect(cuerpo.replay_loom_id).toBe('abc123def');
        expect(cuerpo.replay_activo_desde).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
        expect(cuerpo.replay_vence_hasta).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

        api.put.mockClear();
        rerender(<WorkshopReplayConfigPanel events={[{ ...PASADO, replay_loom_id: 'abc123def',
            replay_activo_desde: enHoras(-1), replay_vence_hasta: enHoras(47) }]} />);
        expect(screen.getByText('Publicada')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Dejar de publicar' }));
        expect(Object.keys(api.put.mock.calls[0][1])).toEqual(['replay_vence_hasta']);
    });
});
