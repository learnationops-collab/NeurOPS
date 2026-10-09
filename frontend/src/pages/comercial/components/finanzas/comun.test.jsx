import { beforeEach, describe, expect, it } from 'vitest';
import { guardarPeriodo, leerPeriodoGuardado, mesActual, mesExacto, mesesDelRango, periodoDe } from './comun';

/**
 * El período de Finanzas (08/10/2026): un mes o un rango personalizado. Las vistas reciben
 * {desde, hasta, mes}, con `mes` solo si es justo un mes calendario; la nómina de varios meses se
 * prorratea con la misma regla que el backend (`meses_del_rango` en finance.py).
 */

describe('el período de Finanzas', () => {
    beforeEach(() => {
        try { localStorage.clear(); } catch { /* sin almacenamiento */ }
    });

    it('un rango del 1 al último día es ese mes; cualquier otro, no', () => {
        expect(mesExacto('2026-02-01', '2026-02-28')).toBe('2026-02');
        expect(mesExacto('2028-02-01', '2028-02-29')).toBe('2028-02');
        expect(mesExacto('2026-02-01', '2026-02-27')).toBeNull();
        expect(mesExacto('2026-09-01', '2026-10-31')).toBeNull();

        expect(periodoDe({ tipo: 'mes', mes: '2026-09' })).toEqual({ desde: '2026-09-01', hasta: '2026-09-30', mes: '2026-09' });
        expect(periodoDe({ tipo: 'custom', desde: '2026-09-01', hasta: '2026-09-30' }).mes).toBe('2026-09');
        expect(periodoDe({ tipo: 'custom', desde: '2026-09-16', hasta: '2026-10-15' }))
            .toEqual({ desde: '2026-09-16', hasta: '2026-10-15', mes: null });
    });

    it('cada mes del rango cuenta entero o por la parte de sus días', () => {
        expect(mesesDelRango('2026-09-16', '2026-10-15')).toEqual([
            { mes: '2026-09', parte: 0.5 }, { mes: '2026-10', parte: 15 / 31 }]);
        expect(mesesDelRango('2026-12-31', '2027-02-14')).toEqual([
            { mes: '2026-12', parte: 1 / 31 }, { mes: '2027-01', parte: 1 }, { mes: '2027-02', parte: 0.5 }]);
    });

    it('sigue leyendo el mes de la clave vieja, y un rango guardado manda mientras exista', () => {
        expect(leerPeriodoGuardado()).toEqual({ tipo: 'mes', mes: mesActual() });

        localStorage.setItem('finanzas.mes', '2026-08');
        expect(leerPeriodoGuardado()).toEqual({ tipo: 'mes', mes: '2026-08' });

        guardarPeriodo({ tipo: 'custom', desde: '2026-07-16', hasta: '2026-08-31' });
        expect(leerPeriodoGuardado()).toEqual({ tipo: 'custom', desde: '2026-07-16', hasta: '2026-08-31' });

        guardarPeriodo({ tipo: 'mes', mes: '2026-09' });
        expect(leerPeriodoGuardado()).toEqual({ tipo: 'mes', mes: '2026-09' });
        expect(localStorage.getItem('finanzas.periodo')).toBeNull();
    });

    it('un rango guardado roto no rompe: vale el mes guardado', () => {
        localStorage.setItem('finanzas.mes', '2026-08');
        localStorage.setItem('finanzas.periodo', '{"desde":"2026-07-16"');
        expect(leerPeriodoGuardado()).toEqual({ tipo: 'mes', mes: '2026-08' });

        localStorage.setItem('finanzas.periodo', JSON.stringify({ desde: '2026-07-16', hasta: 'mañana' }));
        expect(leerPeriodoGuardado()).toEqual({ tipo: 'mes', mes: '2026-08' });
    });
});
