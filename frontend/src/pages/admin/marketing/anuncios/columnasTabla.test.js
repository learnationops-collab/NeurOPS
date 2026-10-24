import { describe, expect, it } from 'vitest';
import {
    ANCHO, ANCHO_MAX, ANCHO_MIN, COLUMNAS_TABLA, OCULTAS_INICIALES, ORDEN_EMBUDO, PRESETS, acotar, anchoDe,
    columnasDelCsv, columnasEnOrden, mismaVista, moverColumna, piezasDeLaTabla, soltarColumna,
} from './columnasTabla';
import { COLUMNAS } from './metricas';

const claves = (piezas) => piezas.map((p) => p.key);

describe('piezasDeLaTabla', () => {
    it('sin elección, cada métrica es su columna, en el orden de siempre', () => {
        expect(claves(piezasDeLaTabla([], []))).toEqual(COLUMNAS_TABLA.map((c) => c.key));
        expect(COLUMNAS_TABLA.map((c) => c.key)).toEqual(expect.arrayContaining(COLUMNAS.map((c) => c.key)));
    });

    it('las ocultas no se ven', () => {
        const piezas = piezasDeLaTabla(['cpl', 'roas'], []);
        expect(claves(piezas)).not.toContain('cpl');
        expect(claves(piezas)).not.toContain('roas');
        expect(piezas).toHaveLength(COLUMNAS_TABLA.length - 2);
    });

    it('un grupo juntado va donde estaba su primera columna, con sus columnas visibles', () => {
        const piezas = piezasDeLaTabla(['descalificados'], ['leads']);
        expect(piezas[0].key).toBe('grupo:leads');
        expect(piezas[0].cols.map((c) => c.key)).toEqual(['entrantes', 'calificados', 'en_conversacion', 'sin_respuesta']);
        expect(claves(piezas)).not.toContain('calificados');
        expect(claves(piezas)).toContain('gasto');
    });

    it('con todos juntos quedan tres columnas', () => {
        expect(claves(piezasDeLaTabla(OCULTAS_INICIALES, ['leads', 'costos', 'resultados'])))
            .toEqual(['grupo:leads', 'grupo:costos', 'grupo:resultados']);
    });

    it('un grupo sin columnas visibles no aparece', () => {
        const piezas = piezasDeLaTabla(['agendas', 'ventas', 'cobrado', 'roas'], ['resultados']);
        expect(claves(piezas)).not.toContain('grupo:resultados');
    });
});

describe('anchos', () => {
    it('el elegido manda; si no, el de su tipo', () => {
        expect(anchoDe('cpl', { cpl: 150 })).toBe(150);
        expect(anchoDe('cpl', {})).toBe(ANCHO.num);
        expect(anchoDe('grupo:leads', {})).toBe(ANCHO.grupo);
        expect(anchoDe('nombre', {})).toBe(ANCHO.nombre);
    });

    it('se acota entre el mínimo y el máximo', () => {
        expect(acotar(10)).toBe(ANCHO_MIN);
        expect(acotar(5000)).toBe(ANCHO_MAX);
        expect(acotar(120.4)).toBe(120);
    });
});

describe('columnasDelCsv', () => {
    it('trae el nombre, la agrupación del nivel y cada porcentaje aparte', () => {
        const anuncios = columnasDelCsv('anuncios', 'Palabra clave').map((c) => c.key);
        expect(anuncios.slice(0, 3)).toEqual(['nombre', 'campana', 'conjunto']);
        expect(anuncios).toContain('pct_calificados');
        expect(columnasDelCsv('campanas', 'Campaña').map((c) => c.key)).not.toContain('campana');
        expect(columnasDelCsv('conjuntos', 'Conjunto').map((c) => c.key)).not.toContain('conjunto');
    });
});

describe('orden, vistas y % de calificación', () => {
    it('el % de calificación es una columna más, después del costo por calificado, oculta de entrada', () => {
        const claves = COLUMNAS_TABLA.map((c) => c.key);
        expect(claves.indexOf('pct_calificados')).toBe(claves.indexOf('cpl_calificado') + 1);
        expect(OCULTAS_INICIALES).toEqual(['pct_calificados']);
    });

    it('el orden elegido manda y las columnas que no están en la lista van al final', () => {
        const piezas = piezasDeLaTabla([], [], ['roas', 'gasto']);
        expect(claves(piezas).slice(0, 2)).toEqual(['roas', 'gasto']);
        expect(claves(piezas)).toHaveLength(COLUMNAS_TABLA.length);
        expect(columnasEnOrden(['no_existe', 'cpl']).map((c) => c.key)[0]).toBe('cpl');
    });

    it('un grupo juntado lleva sus columnas en el orden elegido', () => {
        const piezas = piezasDeLaTabla([], ['costos'], ['roas', 'cpl_calificado', 'gasto']);
        expect(piezas.find((p) => p.key === 'grupo:costos').cols.map((c) => c.key).slice(0, 2)).toEqual(['cpl_calificado', 'gasto']);
    });

    it('mover sube o baja una columna y se queda en los bordes', () => {
        const base = COLUMNAS_TABLA.map((c) => c.key);
        expect(moverColumna([], 'gasto', -1).indexOf('gasto')).toBe(base.indexOf('gasto') - 1);
        expect(moverColumna([], 'gasto', 1).indexOf('gasto')).toBe(base.indexOf('gasto') + 1);
        expect(moverColumna([], base[0], -1)).toEqual(base);
        expect(moverColumna([], 'desconocida', 1)).toEqual(base);
    });

    it('soltar una columna sobre otra la deja en su lugar', () => {
        expect(soltarColumna([], 'roas', 'entrantes')[0]).toBe('roas');
        const hacia = soltarColumna([], 'entrantes', 'roas');
        expect(hacia[hacia.length - 1]).toBe('entrantes');
        expect(soltarColumna([], 'roas', 'roas')).toEqual(COLUMNAS_TABLA.map((c) => c.key));
    });

    it('la vista «Embudo y costos» sigue el orden pedido por Kerwin, sin entrantes ni descalificados', () => {
        const embudo = PRESETS.find((p) => p.id === 'embudo');
        const visibles = piezasDeLaTabla(embudo.ocultas, embudo.juntados, embudo.orden).map((p) => p.key);
        expect(visibles).toEqual(ORDEN_EMBUDO);
        expect(ORDEN_EMBUDO.slice(0, 4)).toEqual(['calificados', 'en_conversacion', 'sin_respuesta', 'gasto']);
    });

    it('dos vistas son la misma si muestran lo mismo en el mismo orden', () => {
        const todas = PRESETS[0];
        expect(mismaVista(todas, { ocultas: [...OCULTAS_INICIALES], juntados: [], orden: COLUMNAS_TABLA.map((c) => c.key) })).toBe(true);
        expect(mismaVista(todas, PRESETS[1])).toBe(false);
        expect(mismaVista(todas, { ...todas, orden: ['roas'] })).toBe(false);
    });
});
