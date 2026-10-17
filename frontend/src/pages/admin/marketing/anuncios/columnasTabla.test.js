import { describe, expect, it } from 'vitest';
import { ANCHO, ANCHO_MAX, ANCHO_MIN, acotar, anchoDe, columnasDelCsv, piezasDeLaTabla } from './columnasTabla';
import { COLUMNAS } from './metricas';

const claves = (piezas) => piezas.map((p) => p.key);

describe('piezasDeLaTabla', () => {
    it('sin elección, cada métrica es su columna, en el orden de siempre', () => {
        expect(claves(piezasDeLaTabla([], []))).toEqual(COLUMNAS.map((c) => c.key));
    });

    it('las ocultas no se ven', () => {
        const piezas = piezasDeLaTabla(['cpl', 'roas'], []);
        expect(claves(piezas)).not.toContain('cpl');
        expect(claves(piezas)).not.toContain('roas');
        expect(piezas).toHaveLength(COLUMNAS.length - 2);
    });

    it('un grupo juntado va donde estaba su primera columna, con sus columnas visibles', () => {
        const piezas = piezasDeLaTabla(['descalificados'], ['leads']);
        expect(piezas[0].key).toBe('grupo:leads');
        expect(piezas[0].cols.map((c) => c.key)).toEqual(['entrantes', 'calificados', 'en_conversacion', 'sin_respuesta']);
        expect(claves(piezas)).not.toContain('calificados');
        expect(claves(piezas)).toContain('gasto');
    });

    it('con todos juntos quedan tres columnas', () => {
        expect(claves(piezasDeLaTabla([], ['leads', 'costos', 'resultados'])))
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
