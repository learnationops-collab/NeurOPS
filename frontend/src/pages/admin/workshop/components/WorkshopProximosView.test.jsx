import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../services/api', () => ({ default: { post: vi.fn() } }));
vi.mock('react-hot-toast', () => {
    const toast = vi.fn();
    toast.success = vi.fn();
    toast.error = vi.fn();
    return { default: toast };
});

import api from '../../../../services/api';
import WorkshopProximosView from './WorkshopProximosView';

const MEET = 'https://meet.google.com/fne-suag-bbr';
const GRUPO = 'https://chat.whatsapp.com/LGAwcWMUa725XRJnp3z2qN';

const EVENTOS = [
    { id: 1, date: '2026-10-12', name: 'WEBINAR 12 DE OCTUBRE 2026', inicio_at: '2026-10-12T20:00:00Z', meet_url: MEET, whatsapp_url: GRUPO },
    { id: 2, date: '2026-10-19', name: 'WEBINAR 19 DE OCTUBRE 2026', inicio_at: '2026-10-19T20:00:00Z', meet_url: null, whatsapp_url: GRUPO },
    { id: 3, date: '2026-10-30', name: 'SIN HORA', inicio_at: null },
];

describe('Workshop › Próximos', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-15T15:00:00Z'));
        api.post.mockReset();
    });
    afterEach(() => vi.useRealTimers());

    it('muestra el taller que está en la landing y los que vienen, sin el que ya pasó', () => {
        render(<WorkshopProximosView events={EVENTOS} onEdit={vi.fn()} onDelete={vi.fn()} onProgramado={vi.fn()} />);

        expect(screen.getByText('En la landing ahora')).toBeInTheDocument();
        const filas = screen.getAllByRole('row').slice(1);
        expect(filas.map((f) => within(f).getAllByRole('cell')[0].textContent))
            .toEqual(['WEBINAR 19 DE OCTUBRE 2026', 'SIN HORA']);
        expect(screen.getByText('Sin hora: no sale en las landings')).toBeInTheDocument();
        // Sin Meet propio: la landing usa el del anterior.
        expect(within(filas[0]).getByText('El del anterior')).toBeInTheDocument();
    });

    it('editar abre el taller elegido', async () => {
        const onEdit = vi.fn();
        render(<WorkshopProximosView events={EVENTOS} onEdit={onEdit} onDelete={vi.fn()} onProgramado={vi.fn()} />);
        await userEvent.click(screen.getByRole('button', { name: 'Editar WEBINAR 19 DE OCTUBRE 2026' }));
        expect(onEdit).toHaveBeenCalledWith(EVENTOS[1]);
    });

    it('programar propone la semana siguiente al último con sus links y manda la zona del navegador', async () => {
        api.post.mockResolvedValue({ data: { creados: [{}, {}], existentes: [] } });
        const onProgramado = vi.fn();
        render(<WorkshopProximosView events={EVENTOS} onEdit={vi.fn()} onDelete={vi.fn()} onProgramado={onProgramado} />);

        await userEvent.click(screen.getByRole('button', { name: /Programar semanas/ }));
        const dialogo = screen.getByRole('dialog', { name: 'Programar talleres' });
        const semanas = within(dialogo).getByRole('spinbutton');
        await userEvent.clear(semanas);
        await userEvent.type(semanas, '2');
        expect(within(dialogo).getAllByRole('listitem')).toHaveLength(2);

        await userEvent.click(within(dialogo).getByRole('button', { name: /^Programar$/ }));

        expect(api.post).toHaveBeenCalledTimes(1);
        const [url, body] = api.post.mock.calls[0];
        expect(url).toBe('workshop/events/programar');
        expect(new Date(body.inicio_local).toISOString()).toBe('2026-10-26T20:00:00.000Z');
        expect(body).toMatchObject({ semanas: 2, meet_url: MEET, whatsapp_url: GRUPO });
        expect(typeof body.zona).toBe('string');
        expect(onProgramado).toHaveBeenCalled();
    });
});
