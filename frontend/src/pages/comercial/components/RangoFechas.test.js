import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esFecha, mesEnCurso, rangoAnterior, rangoDe, textoRango } from './RangoFechas';

/** Las cuentas del rango personalizado: todas sobre días de calendario local, nunca en UTC. */

beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
afterEach(() => vi.useRealTimers());

describe('RangoFechas · cuentas', () => {
    it('el mes en curso termina HOY en el reloj de quien mira, también a las 23:30', () => {
        // Con `toISOString()`, en cualquier zona al oeste de Greenwich esto ya era "mañana".
        vi.setSystemTime(new Date(2026, 8, 30, 23, 30));
        expect(mesEnCurso()).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
    });

    it('la comparación arranca con los mismos días, justo antes', () => {
        expect(rangoAnterior({ desde: '2026-09-08', hasta: '2026-09-14' }))
            .toEqual({ desde: '2026-09-01', hasta: '2026-09-07' });
        expect(rangoAnterior({ desde: '2026-03-01', hasta: '2026-03-01' }))
            .toEqual({ desde: '2026-02-28', hasta: '2026-02-28' });
    });

    it('la píldora dice el rango corto, un solo día como un día, y el año solo si no es este', () => {
        vi.setSystemTime(new Date(2026, 8, 17, 12, 0));
        expect(textoRango({ desde: '2026-09-12', hasta: '2026-09-18' })).toBe('12/09 – 18/09');
        expect(textoRango({ desde: '2026-09-10', hasta: '2026-09-10' })).toBe('10/09');
        expect(textoRango({ desde: '2025-12-28', hasta: '2026-01-03' })).toBe('28/12/25 – 03/01/26');
    });

    it('un año a medio tipear o un día que no existe no son fechas', () => {
        expect(['2026-09-08', '2028-02-29'].map(esFecha)).toEqual([true, true]);
        expect(['0002-09-08', '0202-09-08', '2026-02-31', '2026-9-8', '', null].map(esFecha))
            .toEqual([false, false, false, false, false, false]);
    });

    it('el rango se ordena, y sin una de las dos puntas no hay rango', () => {
        expect(rangoDe('2026-09-14', '2026-09-08')).toEqual({ desde: '2026-09-08', hasta: '2026-09-14' });
        expect(rangoDe('2026-09-08', null)).toBeNull();
    });
});
