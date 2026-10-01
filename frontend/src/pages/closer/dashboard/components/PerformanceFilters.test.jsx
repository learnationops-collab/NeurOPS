import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PerformanceFilters from './PerformanceFilters';

/** El rango libre arranca en el mes en curso, contado en el reloj de quien mira. */

afterEach(() => vi.useRealTimers());

describe('PerformanceFilters · arranque del rango libre', () => {
    it('a las 23:30 del último día del mes, el rango termina ese día y no el siguiente', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 8, 30, 23, 30));
        const setCustomRange = vi.fn();
        render(<PerformanceFilters closers={[]} closerId="all" setCloserId={() => {}} period="mes"
            setPeriod={() => {}} compare="prev" setCompare={() => {}} showClosersFilter={false}
            customRange={{ start: '', end: '' }} setCustomRange={setCustomRange}
            compareRange={{ start: '', end: '' }} setCompareRange={() => {}} />);

        fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));

        expect(setCustomRange).toHaveBeenCalledWith({ start: '2026-09-01', end: '2026-09-30' });
    });
});
