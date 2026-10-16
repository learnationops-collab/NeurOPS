import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import TallerEnVivo from './TallerEnVivo';

const lunes = { id: 16, name: 'WEBINAR 19 DE OCTUBRE 2026', date: '2026-10-19', inicio_at: '2026-10-19T20:00:00Z' };

describe('Workshop › rótulo del próximo taller', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('cuenta hacia atrás cada segundo y a cero dice «En vivo»', () => {
        vi.setSystemTime(new Date('2026-10-19T19:59:58Z'));
        render(<TallerEnVivo eventos={[lunes]} onIrAProximos={() => {}} />);

        expect(screen.getByRole('timer')).toHaveTextContent('Próximo taller en00:00:02');
        act(() => { vi.advanceTimersByTime(1000); });
        expect(screen.getByRole('timer')).toHaveTextContent('00:00:01');
        act(() => { vi.advanceTimersByTime(1000); });
        expect(screen.getByRole('status')).toHaveTextContent('En vivo');
    });

    it('sigue «En vivo» hasta las 2 horas y después no queda nada que contar', () => {
        vi.setSystemTime(new Date('2026-10-19T21:59:59Z'));
        render(<TallerEnVivo eventos={[lunes]} onIrAProximos={() => {}} />);

        expect(screen.getByRole('status')).toHaveTextContent('En vivo');
        act(() => { vi.advanceTimersByTime(1000); });
        expect(screen.getByRole('button', { name: /Sin taller programado/ })).toBeInTheDocument();
    });

    it('sin taller programado lleva a «Próximos»', () => {
        vi.setSystemTime(new Date('2026-10-25T00:00:00Z'));
        const ir = vi.fn();
        render(<TallerEnVivo eventos={[lunes]} onIrAProximos={ir} />);

        act(() => { screen.getByRole('button', { name: /Sin taller programado/ }).click(); });
        expect(ir).toHaveBeenCalled();
    });
});
