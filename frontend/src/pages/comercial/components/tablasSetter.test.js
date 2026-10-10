import { describe, expect, it } from 'vitest';
import { TABLAS, TABLAS_POR_ROL } from './tablasDef';
import { REVISAR_DEL_SETTER, SIN_PALABRA_CLAVE, TABLAS_DEL_SETTER, defDeTabla } from './tablasSetter';
import {
    DESTINOS_METRICA, DESTINOS_SETTER, PASOS_SETTER, destinoDeSerie, destinoToques,
} from './destinos';

/**
 * Las tablas del Revisar del setter son las de siempre con otras columnas: lo que se cuida acá es
 * que sigan siendo las mismas para el drill-down (cada número de "Mis datos" aterriza con TODAS sus
 * condiciones) y que la dirección no las vea.
 */

const facetasDe = (def) => def.facetas.map(f => f.key);

describe('tablas del Revisar del setter', () => {
    it('solo las ve quien mira sus propias filas con rol setters', () => {
        expect(defDeTabla('generadas', 'setters', true)).toBe(TABLAS_DEL_SETTER.generadas);
        expect(defDeTabla('ventas', 'setters', true)).toBe(TABLAS_DEL_SETTER.ventas);
        // La dirección con el switch en Setters, y un closer, siguen con las de siempre.
        expect(defDeTabla('generadas', 'setters', false)).toBe(TABLAS.generadas);
        expect(defDeTabla('agendas', 'closers', true)).toBe(TABLAS.agendas);
        expect(defDeTabla('ventas', 'closers', true)).toBe(TABLAS.ventas);
        expect(TABLAS_POR_ROL.setters).toEqual(['leads', 'generadas']);
    });

    it('cada pestaña abre una tabla que existe, con la clave de siempre', () => {
        expect(REVISAR_DEL_SETTER.map(p => [p.key, p.tabla]))
            .toEqual([['agendas', 'generadas'], ['ventas', 'ventas'], ['leads', 'leads']]);
        REVISAR_DEL_SETTER.forEach(p => expect(TABLAS[p.tabla]).toBeDefined());
    });

    it('todo número del setter aterriza con todas sus condiciones en la tabla que él ve', () => {
        // Una faceta que la tabla no tiene no falla: se ignora en silencio y la lista muestra el
        // período entero debajo de un número que no es (ver destinos.test.js).
        const destinos = [
            ...Object.entries(DESTINOS_SETTER).map(([k, d]) => [`DESTINOS_SETTER.${k}`, d]),
            ...Object.entries(PASOS_SETTER).map(([k, p]) => [`PASOS_SETTER.${k}`, p.destino]),
            ...Object.entries(DESTINOS_METRICA.setters).map(([k, d]) => [`DESTINOS_METRICA.setters.${k}`, d]),
            ['destinoToques()', destinoToques('4+')],
            ...['entrantes', 'respuestas', 'cualificados', 'agendas', 'tasa_resp']
                .map(k => [`destinoDeSerie(setters, ${k})`, destinoDeSerie('setters', k)]),
        ].filter(([, d]) => d);

        const perdidas = destinos.flatMap(([donde, d]) => {
            const def = TABLAS_DEL_SETTER[d.tabla];
            if (!def) return [`${donde} -> ${d.tabla} no es una tabla del Revisar del setter`];
            return Object.keys(d.filtro || {}).filter(k => !k.startsWith('__'))
                .filter(k => !facetasDe(def).includes(k))
                .map(k => `${donde}: la tabla ${d.tabla} del setter no tiene la faceta "${k}"`);
        });

        expect(destinos.length).toBeGreaterThan(15);
        expect(perdidas).toEqual([]);
    });

    it('Agendas: sin la columna de sí mismo y con la palabra clave, filtrable y agrupable', () => {
        const def = TABLAS_DEL_SETTER.generadas;
        expect(def.cols.map(c => c.key)).not.toContain('setter');
        expect(def.cols.map(c => c.key)).toContain('palabra_clave');
        expect(facetasDe(def)).toEqual([...facetasDe(TABLAS.generadas).filter(k => k !== 'setter'), 'palabra_clave']);

        const palabra = def.facetas.find(f => f.key === 'palabra_clave');
        expect(palabra.de({ palabra_clave: 'AULA' })).toBe('AULA');
        expect(palabra.de({ palabra_clave: '' })).toBe(SIN_PALABRA_CLAVE);

        const sinPalabra = def.chips.find(c => c.key === 'sin_palabra');
        expect([{ palabra_clave: '' }, { palabra_clave: 'AULA' }].filter(f => sinPalabra.filtro(f)))
            .toEqual([{ palabra_clave: '' }]);
        // El de por defecto sigue siendo «Vigentes».
        expect(def.chips[0]).toBe(TABLAS.generadas.chips[0]);
    });

    it('la bajada del total dice cuántas no tienen palabra clave', () => {
        const pista = TABLAS_DEL_SETTER.generadas.pistaDelTotal;
        expect(pista([{ palabra_clave: '' }, { palabra_clave: 'A' }, { palabra_clave: '' }])).toBe('2 sin palabra clave');
        expect(pista([{ palabra_clave: 'A' }])).toBe('todas con palabra clave');
        expect(pista([])).toBeNull();
    });

    it('cada tabla tiene su estado vacío y no muestra la columna que para él es siempre lo mismo', () => {
        Object.values(TABLAS_DEL_SETTER).forEach(def => {
            expect(def.vacio.titulo).toBeTruthy();
            expect(def.vacio.texto).toBeTruthy();
        });
        expect(TABLAS_DEL_SETTER.leads.cols.map(c => c.key)).not.toEqual(expect.arrayContaining(['setter']));
        expect(facetasDe(TABLAS_DEL_SETTER.ventas)).not.toContain('fuente');
        // Lo demás de Ventas es lo de los closers: mismas columnas, monto incluido.
        expect(TABLAS_DEL_SETTER.ventas.cols).toBe(TABLAS.ventas.cols);
    });
});
