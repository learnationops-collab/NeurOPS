/**
 * Cómo se arman las columnas de la tabla de Rendimiento (pedido de Kerwin, 17/10/2026: «que las columnas
 * se puedan modificar de ancho, que se puedan seleccionar qué columnas quiero ver, y una vista agrupada
 * para ver datos semejantes en una misma columna, solo si yo quiero»).
 *
 * Funciones puras sobre `COLUMNAS` (metricas.js): qué se ve, qué se junta y el ancho de cada una. La
 * elección vive en el navegador de quien mira (`useVistaDeColumnas`): es una comodidad de lectura.
 */
import { COLUMNAS } from './metricas';

/** «% de calificación» como columna propia (Kerwin, 23/10/2026): la cuenta ya viene en cada fila
 *  (`pct_calificados`); queda oculta de entrada porque bajo «Calificados» ya se ve en chico. */
export const PCT_CALIFICACION = {
    key: 'pct_calificados', label: '% de calificación', formato: 'pct',
    ayuda: 'Calificados ÷ leads entrantes.',
};
export const OCULTAS_INICIALES = [PCT_CALIFICACION.key];

/** Todas las columnas que se pueden elegir, en el orden de siempre (el % va después del costo por calificado). */
export const COLUMNAS_TABLA = (() => {
    const lugar = COLUMNAS.findIndex((c) => c.key === 'cpl_calificado');
    if (lugar < 0) return [...COLUMNAS, PCT_CALIFICACION];
    return [...COLUMNAS.slice(0, lugar + 1), PCT_CALIFICACION, ...COLUMNAS.slice(lugar + 1)];
})();

/** Las columnas semejantes, que se pueden juntar en una sola. `corto` es el rótulo dentro de la celda. */
export const GRUPOS = [
    { key: 'leads', label: 'Leads', cols: ['entrantes', 'calificados', 'descalificados', 'en_conversacion', 'sin_respuesta'] },
    { key: 'costos', label: 'Inversión y costos', cols: ['gasto', 'cpl', 'cpl_calificado', 'costo_agenda', 'costo_venta'] },
    { key: 'resultados', label: 'Resultados', cols: ['agendas', 'ventas', 'cobrado', 'roas'] },
];

export const CORTO = {
    entrantes: 'Entrantes', calificados: 'Calificados', descalificados: 'Descalif.', en_conversacion: 'En conv.',
    sin_respuesta: 'Sin resp.', gasto: 'Gastado', cpl: 'Por lead', cpl_calificado: 'Por calif.',
    costo_agenda: 'Por agenda', costo_venta: 'Por venta', agendas: 'Agendas', ventas: 'Ventas',
    cobrado: 'Cobrado', roas: 'ROAS', pct_calificados: '% calif.',
};

const grupoDe = Object.fromEntries(GRUPOS.flatMap((g) => g.cols.map((k) => [k, g])));

/** Anchos por defecto en px. Una columna juntada es más ancha: lleva rótulo y número por renglón. */
export const ANCHO = { sel: 44, nombre: 260, num: 124, grupo: 196, acc: 52 };
export const ANCHO_MIN = 64;
export const ANCHO_MAX = 640;
export const acotar = (px) => Math.round(Math.min(ANCHO_MAX, Math.max(ANCHO_MIN, px)));

/** Las columnas en el orden elegido (`orden`: claves). Las que no están en la lista (una columna nueva,
 *  una lista vieja) van al final, en el orden de siempre. */
export const columnasEnOrden = (orden = []) => {
    const porKey = new Map(COLUMNAS_TABLA.map((c) => [c.key, c]));
    const primeras = [...new Set(orden)].filter((k) => porKey.has(k)).map((k) => porKey.get(k));
    return [...primeras, ...COLUMNAS_TABLA.filter((c) => !primeras.includes(c))];
};

/** `orden` con `key` movida `delta` lugares (negativo: antes). Devuelve la lista completa de claves. */
export const moverColumna = (orden, key, delta) => {
    const claves = columnasEnOrden(orden).map((c) => c.key);
    const desde = claves.indexOf(key);
    const hasta = Math.min(claves.length - 1, Math.max(0, desde + delta));
    if (desde < 0 || desde === hasta) return claves;
    claves.splice(hasta, 0, ...claves.splice(desde, 1));
    return claves;
};

/** `key` puesta en el lugar de `destino` (arrastrar y soltar). */
export const soltarColumna = (orden, key, destino) => {
    const claves = columnasEnOrden(orden).map((c) => c.key);
    const desde = claves.indexOf(key);
    const hasta = claves.indexOf(destino);
    if (desde < 0 || hasta < 0 || desde === hasta) return claves;
    claves.splice(hasta, 0, ...claves.splice(desde, 1));
    return claves;
};

/**
 * Lo que se dibuja entre el nombre y las acciones, en el orden elegido (por defecto el de `COLUMNAS`):
 * `[{ key, tipo: 'col', col }]` o `[{ key: 'grupo:leads', tipo: 'grupo', grupo, cols }]`. Un grupo
 * juntado va donde estaría su primera columna visible y lleva solo sus columnas visibles; sin ninguna
 * visible no aparece.
 */
export const piezasDeLaTabla = (ocultas, juntados, orden = []) => {
    const fuera = new Set(ocultas);
    const juntos = new Set(juntados);
    const puestos = new Set();
    const piezas = [];
    const ordenadas = columnasEnOrden(orden);
    ordenadas.forEach((col) => {
        if (fuera.has(col.key)) return;
        const grupo = grupoDe[col.key];
        if (!grupo || !juntos.has(grupo.key)) {
            piezas.push({ key: col.key, tipo: 'col', col });
            return;
        }
        if (puestos.has(grupo.key)) return;
        puestos.add(grupo.key);
        const cols = ordenadas.filter((c) => grupo.cols.includes(c.key) && !fuera.has(c.key));
        piezas.push({ key: `grupo:${grupo.key}`, tipo: 'grupo', grupo, cols });
    });
    return piezas;
};

/** Vistas hechas, para elegir de un toque. `ocultas`/`orden` son lo mismo que guarda `useVistaDeColumnas`. */
export const ORDEN_EMBUDO = ['calificados', 'en_conversacion', 'sin_respuesta', 'gasto', 'cpl', 'cpl_calificado',
    'pct_calificados', 'agendas', 'costo_agenda', 'ventas', 'costo_venta', 'cobrado', 'roas'];
export const PRESETS = [
    { id: 'todas', nombre: 'Todas', ocultas: OCULTAS_INICIALES, juntados: [], orden: [] },
    { id: 'embudo', nombre: 'Embudo y costos', ocultas: ['entrantes', 'descalificados'], juntados: [], orden: ORDEN_EMBUDO },
];

const mismoConjunto = (a, b) => a.length === b.length && a.every((k) => b.includes(k));
/** ¿Dos vistas muestran las mismas columnas, juntas y en el mismo orden? */
export const mismaVista = (a, b) => mismoConjunto(a.ocultas, b.ocultas) && mismoConjunto(a.juntados, b.juntados)
    && columnasEnOrden(a.orden).map((c) => c.key).join() === columnasEnOrden(b.orden).map((c) => c.key).join();

/** El ancho de una pieza: el elegido o el de su tipo. */
export const anchoDe = (key, anchos) => anchos[key]
    ?? (key === 'sel' || key === 'nombre' || key === 'acc' ? ANCHO[key] : key.startsWith('grupo:') ? ANCHO.grupo : ANCHO.num);

/** Las columnas del CSV: el nombre, su campaña y conjunto, y cada métrica con su porcentaje aparte. */
export const columnasDelCsv = (nivel, nombreDelNivel) => [
    { key: 'nombre', header: nombreDelNivel },
    ...(nivel !== 'campanas' ? [{ key: 'campana', header: 'Campaña' }] : []),
    ...(nivel === 'anuncios' ? [{ key: 'conjunto', header: 'Conjunto' }] : []),
    ...COLUMNAS.flatMap((c) => [
        { key: c.key, header: c.label },
        ...(c.pct ? [{ key: c.pct, header: `% ${c.label.toLowerCase()}` }] : []),
    ]),
];
