// Panorama de Stats, calculado sobre el listado que el panel ya tiene cargado
// (todas las postulaciones). Lo único que se pide aparte al backend es la matriz
// país por país y el embudo del formulario, que usan respuestas que el listado no
// trae (ver `HiringStats.jsx`).

import { escalaDe, nivelDe, techoIA } from './escalas';
import { APPS, PAISES, appsOn, nivelIdioma, pideNum } from './vista';

export const COLOR_PAIS = { Argentina: 'var(--pais-ar)', Venezuela: 'var(--pais-ve)', Brasil: 'var(--pais-br)' };

/** Finalistas = terminaron el formulario y verificaron el video: sin video la
 * postulación no se revisa, así que mezclarlas con el resto distorsiona todo. */
export const esFinalista = (p) => Boolean(p.completo && p.video_ok);

const contar = (pool, fn, etiquetas) => {
    const c = Object.fromEntries(etiquetas.map((e) => [e, 0]));
    pool.forEach((p) => {
        const e = fn(p);
        if (e != null && c[e] != null) c[e] += 1;
    });
    return etiquetas.map((e) => [e, c[e]]);
};

const TRAMOS_EDAD = [[0, 25, '18–24'], [25, 30, '25–29'], [30, 35, '30–34'], [35, 41, '35–40'], [41, 200, '41+']];
const TRAMOS_PIDE = [[0, 251, '200–250'], [251, 301, '251–300'], [301, 351, '301–350'], [351, 401, '351–400'], [401, 1e9, '+400']];
const tramo = (n, tramos) => {
    if (!n) return null;
    const t = tramos.find(([lo, hi]) => n >= lo && n < hi);
    return t ? t[2] : null;
};

const NIVEL5 = ['Nunca', 'Básico', 'Intermedio', 'Avanzado', 'Experta'];
const IDIOMA = ['No habla', 'Básico', 'Intermedio', 'Avanzado'];
const EXPERIENCIA = ['+5 años', '3 y 5 años', '1 y 2 años', '< 1 año', 'Ninguna'];

const media = (vals) => (vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0);

export const panorama = (pool) => {
    const total = pool.length;
    const edadNum = (p) => Number(String(p.edad || '').replace(/[^\d]/g, '')) || 0;
    const pides = pool.map(pideNum).filter(Boolean);

    const herramientas = APPS.map((a) => [a.id, pool.filter((p) => appsOn(p)[a.id]).length]);

    const porPais = PAISES.map((pais) => {
        const g = pool.filter((p) => p.pais === pais);
        return {
            pais,
            n: g.length,
            score: media(g.map((p) => p.score || 0)),
            ia: media(g.filter((p) => p.ia_avanzado).map((p) => Math.round((techoIA(p.ia_avanzado).n / 4) * 100))),
            ingles: media(g.filter((p) => p.ingles).map((p) => Math.round((nivelIdioma(p.ingles) / 3) * 100))),
            pide: media(g.map(pideNum).filter(Boolean)),
        };
    });

    return {
        total,
        pais: PAISES.map((pais) => [pais, pool.filter((p) => p.pais === pais).length]),
        edad: contar(pool, (p) => tramo(edadNum(p), TRAMOS_EDAD), TRAMOS_EDAD.map((t) => t[2])),
        ia: contar(pool, (p) => (p.ia_nivel ? NIVEL5[nivelDe(p.ia_nivel)] : null), NIVEL5),
        ingles: contar(pool, (p) => (p.ingles ? IDIOMA[nivelIdioma(p.ingles)] : null), IDIOMA),
        idioma2: contar(pool, (p) => (p.idioma2 ? IDIOMA[nivelIdioma(p.idioma2)] : null), IDIOMA),
        pide: contar(pool, (p) => tramo(pideNum(p), TRAMOS_PIDE), TRAMOS_PIDE.map((t) => t[2])),
        pideMedia: media(pides),
        experiencia: contar(pool, (p) => {
            const e = escalaDe('experiencia', p.experiencia);
            return e.ok ? EXPERIENCIA[4 - e.n] : null;
        }, EXPERIENCIA),
        herramientas,
        porPais,
    };
};

/** Los cuatro escalones de arriba: del pool general o de las finalistas. */
export const embudo = (todas, finalistas, segmento) => {
    if (segmento === 'fin') {
        const n = finalistas.length;
        const de = (v) => finalistas.filter((p) => p.veredicto === v).length;
        return {
            titulo: 'Cómo quedaron las finalistas',
            sub: `${n} con video verificado`,
            base: n,
            pasos: [
                ['Finalistas', n, 'var(--info)'],
                ['Seleccionadas', de('seleccionada'), 'var(--success)'],
                ['En reserva', de('en_reserva'), 'var(--focus-blue)'],
                ['En prueba', de('testeo') + de('winner') + de('top_tier'), 'var(--warning)'],
            ],
        };
    }
    const n = todas.length;
    return {
        titulo: 'Embudo de la búsqueda',
        sub: `sobre ${n} postulaciones`,
        base: n,
        pasos: [
            ['Llegaron', n, 'var(--info)'],
            ['Pasaron excluyentes', todas.filter((p) => !(p.auto_ko || p.descartado)).length, 'var(--focus-blue)'],
            ['Con video verificado', todas.filter((p) => p.video_ok).length, 'var(--success)'],
            ['Sin analizar', todas.filter((p) => p.veredicto === 'sin_analizar').length, 'var(--warning)'],
        ],
    };
};

/** El valor más alto de una lista [[etiqueta, n]] (el primero si empatan). */
export const cima = (items) => items.reduce((b, x) => (x[1] > b[1] ? x : b), items[0] || ['—', 0]);
