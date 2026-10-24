/**
 * Comparar los anuncios de un taller contra los anteriores: qué subió y qué bajó. Sin React, se
 * prueba solo (comparacion.test.js).
 *
 * Cada número vale por su sentido: en un costo, bajar es bueno (`-1`); en alcance y respuesta,
 * subir lo es (`1`); el gasto no es ni bueno ni malo (`0`), solo cambia.
 */

export const SENTIDO = {
    gasto: 0, impresiones: 1, clics: 1, ctr: 1, cpc: -1, cpm: -1,
    visitas: 1, clics_whatsapp: 1, costo_whatsapp: -1,
};

/** Contra qué se compara: el taller anterior o el promedio de los 2 o 3 anteriores. */
export const BASES = [
    { key: 'ninguna', label: 'Sin comparar', n: 0 },
    { key: 'anterior', label: 'Taller anterior', n: 1 },
    { key: 'prom2', label: 'Prom. 2 anteriores', n: 2 },
    { key: 'prom3', label: 'Prom. 3 anteriores', n: 3 },
];

/** `datos` de un taller con anuncios que gastaron (los demás no sirven de base). */
export const tieneAnuncios = (datos) => !!datos?.anuncios_workshop && !!datos?.campanas?.length;

/**
 * Los totales base: el promedio de cada número entre los `n` talleres anteriores que tienen
 * anuncios. Un número que ese taller no tiene (CPC sin clics) no cuenta para ese promedio.
 * `{ totales, cuantos }`, o `null` si ninguno sirve.
 */
export const baseDe = (anteriores, n) => {
    const validos = anteriores.slice(0, n).filter(tieneAnuncios);
    if (!validos.length) return null;
    const totales = {};
    Object.keys(SENTIDO).forEach((clave) => {
        const valores = validos.map((d) => d.totales?.[clave]).filter((v) => v != null);
        totales[clave] = valores.length ? valores.reduce((a, b) => a + Number(b), 0) / valores.length : null;
    });
    return { totales, cuantos: validos.length };
};

/** Cambio de `actual` contra `base`: `{ pct, dir }` con `dir` -1, 0 o 1. Sin base no hay cambio. */
export const variacion = (actual, base) => {
    if (actual == null || base == null || Number(base) === 0) return null;
    const pct = ((Number(actual) - Number(base)) / Math.abs(Number(base))) * 100;
    return { pct, dir: Math.abs(pct) < 0.05 ? 0 : pct > 0 ? 1 : -1 };
};

/** `success` si el cambio es para mejor, `error` si es para peor, `muted` si no se juzga. */
export const tonoDe = (clave, dir) => {
    const sentido = SENTIDO[clave] ?? 0;
    if (!sentido || !dir) return 'muted';
    return dir * sentido > 0 ? 'success' : 'error';
};

/** `+12,3%` / `-4,0%` / `0%`. */
export const variacionTexto = (pct) => {
    if (Math.abs(pct) < 0.05) return '0%';
    const abs = Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)).toString() : Math.abs(pct).toFixed(1).replace('.', ',');
    return `${pct > 0 ? '+' : '−'}${abs}%`;
};
