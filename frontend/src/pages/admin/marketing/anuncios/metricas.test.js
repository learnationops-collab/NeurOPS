import { describe, expect, it } from 'vitest';
import { agruparFilas, completar, dinero, formatear, ordenar, rangoDePeriodo, serieDe, textoMeta, totalesDe } from './metricas';

const fila = (extra) => ({ entrantes: 0, calificados: 0, descalificados: 0, agendas: 0, ventas: 0, gasto: 0, cobrado: 0, ...extra });

describe('metricas de la tabla de anuncios', () => {
    it('los períodos son días locales, como en Meta', () => {
        const hoy = new Date(2026, 9, 14, 23, 30); // 23:30 del 14/10: en UTC ya es el 15
        expect(rangoDePeriodo('hoy', hoy)).toEqual({ desde: '2026-10-14', hasta: '2026-10-14' });
        expect(rangoDePeriodo('ayer', hoy)).toEqual({ desde: '2026-10-13', hasta: '2026-10-13' });
        expect(rangoDePeriodo('ultimos_7', hoy)).toEqual({ desde: '2026-10-08', hasta: '2026-10-14' });
        expect(rangoDePeriodo('ultimos_30', hoy)).toEqual({ desde: '2026-09-15', hasta: '2026-10-14' });
        expect(rangoDePeriodo('este_mes', hoy)).toEqual({ desde: '2026-10-01', hasta: '2026-10-14' });
        expect(rangoDePeriodo('mes_pasado', hoy)).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
        expect(rangoDePeriodo('personalizado', hoy)).toBeNull();
    });

    it('los totales recalculan porcentajes y costos sobre las filas que se ven', () => {
        const totales = totalesDe([
            fila({ entrantes: 100, calificados: 60, agendas: 10, ventas: 1, gasto: 200, cobrado: 1000 }),
            fila({ entrantes: 50, calificados: 15, agendas: 5, ventas: 1, gasto: 100, cobrado: 500 }),
        ]);
        expect(totales).toMatchObject({
            entrantes: 150, calificados: 75, no_calificados: 75, pct_calificados: 50, pct_no_calificados: 50,
            gasto: 300, cpl: 2, cpl_calificado: 4, costo_agenda: 20, costo_venta: 150, roas: 5,
        });
    });

    it('sin gasto los costos quedan vacíos, no en cero', () => {
        expect(completar(fila({ entrantes: 10, calificados: 5, agendas: 2 }))).toMatchObject({
            cpl: null, cpl_calificado: null, costo_agenda: null, costo_venta: null, roas: null, pct_calificados: 50,
        });
        expect(completar(fila())).toMatchObject({ pct_calificados: null, cpl: null });
    });

    it('los montos chicos llevan centavos y los vacíos un guion', () => {
        expect(dinero(1.149)).toBe('$1.15');
        expect(dinero(2496.4)).toBe('$2,496');
        expect(dinero(null)).toBe('—');
        expect(formatear(2.218, 'veces')).toBe('2.22x');
        expect(formatear(65.9, 'pct')).toBe('65.9%');
        expect(formatear(1536, 'num')).toBe('1,536');
    });

    it('ordenar deja los vacíos al final en las dos direcciones', () => {
        const filas = [fila({ nombre: 'A', cpl: 3 }), fila({ nombre: 'B', cpl: null }), fila({ nombre: 'C', cpl: 1 })];
        expect(ordenar(filas, 'cpl', 'asc').map((f) => f.nombre)).toEqual(['C', 'A', 'B']);
        expect(ordenar(filas, 'cpl', 'desc').map((f) => f.nombre)).toEqual(['A', 'C', 'B']);
        expect(ordenar(filas, 'nombre', 'asc').map((f) => f.nombre)).toEqual(['A', 'B', 'C']);
    });

    it('la serie trae todos los días del período y suma las filas', () => {
        const serie = serieDe([
            { dias: { '2026-10-01': [3, 2, 10.5, 1], '2026-10-03': [1, 0, 0, 0] } },
            { dias: { '2026-10-01': [1, 1, 4.25, 0], '2026-09-30': [9, 9, 9, 9] } },
        ], '2026-10-01', '2026-10-03');
        expect(serie).toEqual([
            { dia: '2026-10-01', entrantes: 4, calificados: 3, gasto: 14.75, agendas: 1 },
            { dia: '2026-10-02', entrantes: 0, calificados: 0, gasto: 0, agendas: 0 },
            { dia: '2026-10-03', entrantes: 1, calificados: 0, gasto: 0, agendas: 0 },
        ]);
    });

    it('agrupa por campaña con los leads en su campaña y el gasto repartido entre las de sus anuncios', () => {
        const filas = [
            fila({ clave: 'APLICAR', campana: 'DM Funnel', conjunto: 'AD 5', agrupacion: 'meta', entrantes: 100,
                calificados: 60, agendas: 10, gasto: 300,
                gasto_por_grupo: [['DM Funnel', 'AD 5', 240], ['DMV', 'H2 | BRD', 60]] }),
            fila({ clave: 'EARN', campana: 'DM Funnel', conjunto: 'AD 8', agrupacion: 'meta', entrantes: 20,
                calificados: 5, gasto: 20, gasto_por_grupo: [['DM Funnel', 'AD 8', 20]] }),
            fila({ clave: 'GUIA PERU', campana: null, conjunto: null, entrantes: 30, calificados: 20, gasto_por_grupo: [] }),
        ];
        const campanas = Object.fromEntries(agruparFilas(filas, 'campanas').map((g) => [g.nombre, g]));
        expect(campanas['DM Funnel']).toMatchObject({ entrantes: 120, calificados: 65, gasto: 260, palabras: 2, conjuntos: 2, cpl: 2.17 });
        // DMV no trae leads (APLICAR es de DM Funnel), pero sí su gasto: así el total de gasto cierra.
        expect(campanas.DMV).toMatchObject({ entrantes: 0, gasto: 60, palabras: 0, cpl: null });
        expect(campanas['Sin campaña']).toMatchObject({ entrantes: 30, gasto: 0 });
        expect(totalesDe(Object.values(campanas)).gasto).toBe(totalesDe(filas).gasto);

        const conjuntos = agruparFilas(filas, 'conjuntos').map((g) => [g.campana, g.nombre, g.entrantes, g.gasto]);
        expect(conjuntos).toEqual(expect.arrayContaining([
            ['DM Funnel', 'AD 5', 100, 240], ['DMV', 'H2 | BRD', 0, 60], ['DM Funnel', 'AD 8', 20, 20],
            [null, 'Sin campaña', 30, 0],
        ]));
    });

    it('el texto de los anuncios de Meta de una fila', () => {
        expect(textoMeta({ anuncios: 7, activos: 1 })).toBe('7 anuncios en Meta · 1 activo');
        expect(textoMeta({ anuncios: 1, activos: 0 })).toBe('1 anuncio en Meta · ninguno activo');
        expect(textoMeta({ anuncios: 0, activos: 0 })).toBeNull();
    });
});
