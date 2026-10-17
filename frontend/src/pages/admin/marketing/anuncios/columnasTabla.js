/**
 * Cómo se arman las columnas de la tabla de Rendimiento (pedido de Kerwin, 17/10/2026: «que las columnas
 * se puedan modificar de ancho, que se puedan seleccionar qué columnas quiero ver, y una vista agrupada
 * para ver datos semejantes en una misma columna, solo si yo quiero»).
 *
 * Funciones puras sobre `COLUMNAS` (metricas.js): qué se ve, qué se junta y el ancho de cada una. La
 * elección vive en el navegador de quien mira (`useVistaDeColumnas`): es una comodidad de lectura.
 */
import { COLUMNAS } from './metricas';

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
    cobrado: 'Cobrado', roas: 'ROAS',
};

const grupoDe = Object.fromEntries(GRUPOS.flatMap((g) => g.cols.map((k) => [k, g])));

/** Anchos por defecto en px. Una columna juntada es más ancha: lleva rótulo y número por renglón. */
export const ANCHO = { sel: 44, nombre: 260, num: 124, grupo: 196, acc: 52 };
export const ANCHO_MIN = 64;
export const ANCHO_MAX = 640;
export const acotar = (px) => Math.round(Math.min(ANCHO_MAX, Math.max(ANCHO_MIN, px)));

/**
 * Lo que se dibuja entre el nombre y las acciones, en el orden de `COLUMNAS`:
 * `[{ key, tipo: 'col', col }]` o `[{ key: 'grupo:leads', tipo: 'grupo', grupo, cols }]`. Un grupo
 * juntado va donde estaría su primera columna visible y lleva solo sus columnas visibles; sin ninguna
 * visible no aparece.
 */
export const piezasDeLaTabla = (ocultas, juntados) => {
    const fuera = new Set(ocultas);
    const juntos = new Set(juntados);
    const puestos = new Set();
    const piezas = [];
    COLUMNAS.forEach((col) => {
        if (fuera.has(col.key)) return;
        const grupo = grupoDe[col.key];
        if (!grupo || !juntos.has(grupo.key)) {
            piezas.push({ key: col.key, tipo: 'col', col });
            return;
        }
        if (puestos.has(grupo.key)) return;
        puestos.add(grupo.key);
        const cols = COLUMNAS.filter((c) => grupo.cols.includes(c.key) && !fuera.has(c.key));
        piezas.push({ key: `grupo:${grupo.key}`, tipo: 'grupo', grupo, cols });
    });
    return piezas;
};

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
