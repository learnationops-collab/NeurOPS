import { describe, expect, it } from 'vitest';
import { marcaDelDock, mesCorto, mesSiguiente, mesesConCuenta, nombreDeMes, tituloDeMes } from './meses';

/**
 * «Mis agendas» por mes (11/10/2026): las cuentas que comparten la bandeja y el dock.
 */
const RESUMEN = {
    pendientes: 5, hoy: 0, racha: 0, mes_actual: '2026-10',
    meses: [
        { mes: '2026-10', pendientes: 2, total: 9 },
        { mes: '2026-09', pendientes: 3, total: 60 },
        { mes: '2026-08', pendientes: 0, total: 40 },
        { mes: '2026-07', pendientes: 0, total: 0 },
    ],
};

describe('los nombres de los meses', () => {
    it('en castellano, largo, con mayúscula y corto', () => {
        expect(nombreDeMes('2026-09')).toBe('septiembre');
        expect(tituloDeMes('2026-10')).toBe('Octubre');
        expect(mesCorto('2026-08')).toBe('Ago');
    });
});

describe('mesesConCuenta', () => {
    it('cuenta las pendientes con la lista que se ve y saca los meses sin ninguna agenda', () => {
        const lista = [{ id: 1, mes: '2026-10' }, { id: 2, mes: '2026-09' }];

        expect(mesesConCuenta(RESUMEN, lista)).toEqual([
            { mes: '2026-10', pendientes: 1, total: 9 },
            { mes: '2026-09', pendientes: 1, total: 60 },
            { mes: '2026-08', pendientes: 0, total: 40 },
        ]);
    });

    it('el mes actual queda aunque no tenga agendas: es donde abre la pantalla', () => {
        const resumen = { ...RESUMEN, meses: [{ mes: '2026-10', pendientes: 0, total: 0 }, ...RESUMEN.meses.slice(1)] };

        expect(mesesConCuenta(resumen, [{ id: 1, mes: '2026-09' }]).map(m => m.mes)).toEqual(['2026-10', '2026-09', '2026-08']);
    });

    it('sin meses (un backend anterior) no hay selector', () => {
        expect(mesesConCuenta({ pendientes: 3 }, [{ id: 1 }])).toEqual([]);
    });
});

describe('mesSiguiente', () => {
    const meses = [
        { mes: '2026-10', pendientes: 0, total: 9 },
        { mes: '2026-09', pendientes: 0, total: 60 },
        { mes: '2026-08', pendientes: 4, total: 40 },
        { mes: '2026-07', pendientes: 1, total: 3 },
    ];

    it('el más cercano hacia atrás que todavía tiene pendientes', () => {
        expect(mesSiguiente(meses, '2026-10').mes).toBe('2026-08');
    });

    it('si atrás no queda nada, el más nuevo con pendientes', () => {
        expect(mesSiguiente(meses, '2026-07').mes).toBe('2026-08');
    });

    it('null si no queda ninguna en ningún otro mes', () => {
        expect(mesSiguiente([{ mes: '2026-10', pendientes: 2, total: 2 }], '2026-10')).toBeNull();
    });
});

describe('marcaDelDock', () => {
    it('cuenta las del mes que se trabaja, no la bandeja entera', () => {
        expect(marcaDelDock({ ...RESUMEN, pendientes: 149 }))
            .toEqual({ tipo: 'cuenta', texto: '2', titulo: '2 sin palabra clave en octubre' });
    });

    it('con el mes actual completo, el que sigue', () => {
        const resumen = { ...RESUMEN, meses: [{ mes: '2026-10', pendientes: 0, total: 9 }, ...RESUMEN.meses.slice(1)] };

        expect(marcaDelDock(resumen).titulo).toBe('3 sin palabra clave en septiembre');
    });

    it('el ✓ solo cuando no falta nada en ningún mes', () => {
        expect(marcaDelDock({ pendientes: 0, meses: [] })).toEqual({ texto: '✓', titulo: 'todas con palabra clave' });
        expect(marcaDelDock(null)).toBeNull();
    });

    it('sin meses cuenta el total, como antes', () => {
        expect(marcaDelDock({ pendientes: 120 }).texto).toBe('99+');
    });
});
