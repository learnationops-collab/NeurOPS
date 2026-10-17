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

const TALLER = { id: 15, date: '2026-10-12', name: 'WEBINAR 12 DE OCTUBRE', inicio_at: '2026-10-12T23:00:00' };

describe('Workshop › Talleres › Grabación: guardar y publicar son dos cosas', () => {
    beforeEach(() => api.put.mockReset().mockResolvedValue({ data: {} }));

    it('guardar la grabación no la publica, y sin guardarla no se puede publicar', async () => {
        render(<WorkshopReplayConfigPanel evento={TALLER} />);

        expect(screen.getByText('Sin Loom')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Publicar ahora/ })).toBeDisabled();

        await userEvent.click(screen.getByLabelText(/Link o ID del video de Loom/));
        await userEvent.paste('https://www.loom.com/share/abc123def?sid=1');
        await userEvent.click(screen.getByRole('button', { name: 'Guardar grabación' }));

        expect(api.put).toHaveBeenCalledWith('workshop/events/15', { replay_loom_id: 'abc123def' });
    });

    it('publicar pone desde y vence; con una publicada, «Dejar de publicar» la cierra ya', async () => {
        const { rerender } = render(<WorkshopReplayConfigPanel evento={{ ...TALLER, replay_loom_id: 'abc123def' }} />);

        expect(screen.getByText('Sin publicar')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Ver grabación/ })).toHaveAttribute('href', 'https://www.loom.com/share/abc123def');
        await userEvent.click(screen.getByRole('button', { name: /Publicar ahora \(48 h\)/ }));
        const cuerpo = api.put.mock.calls[0][1];
        expect(cuerpo.replay_loom_id).toBe('abc123def');
        expect(cuerpo.replay_activo_desde).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
        expect(cuerpo.replay_vence_hasta).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

        api.put.mockClear();
        rerender(<WorkshopReplayConfigPanel evento={{ ...TALLER, replay_loom_id: 'abc123def',
            replay_activo_desde: enHoras(-1), replay_vence_hasta: enHoras(47) }} />);
        expect(screen.getByText('Publicada')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Dejar de publicar' }));
        expect(Object.keys(api.put.mock.calls[0][1])).toEqual(['replay_vence_hasta']);
    });

    it('muestra la grabación de Drive aparte del Loom, o avisa que no está', () => {
        const { rerender } = render(<WorkshopReplayConfigPanel evento={TALLER} />);
        expect(screen.getByText('Sin la grabación de Drive.')).toBeInTheDocument();

        rerender(<WorkshopReplayConfigPanel evento={{ ...TALLER, grabacion_url: 'https://drive.google.com/file/d/1Abc/view' }} />);
        expect(screen.getByRole('link', { name: /Ver grabación en Drive/ }))
            .toHaveAttribute('href', 'https://drive.google.com/file/d/1Abc/view');
    });
});
