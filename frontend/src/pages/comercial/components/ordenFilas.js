/**
 * Ordenar las filas de Revisar por una columna.
 *
 * Funciones puras, sin React: el orden es lo último que se le aplica a la lista, DESPUÉS del filtro,
 * así que no cambia ni el "mostrando X de Y", ni los contadores de las facetas, ni la tira de
 * totales —que se calculan sobre el mismo conjunto de filas, en cualquier orden—. Tampoco pide nada
 * al backend: las filas ya están todas acá.
 *
 * Cada columna ordenable trae en `tablasDef.js` un `orden(fila)` que devuelve el valor a comparar
 * (un número, un texto, una marca de tiempo) o null si la fila no tiene el dato.
 *
 * ## Las filas sin dato van al final, en las dos direcciones
 *
 * Ordenar por horas de estudio de mayor a menor es buscar a los que más estudian; de menor a mayor,
 * a los que menos. En ninguno de los dos casos sirve empezar por los clientes sin cuenta en la
 * Academia, que no tienen horas: arriba quedarían decenas de "—" antes del primer dato.
 *
 * ## Estable
 *
 * Dos filas con el mismo valor conservan el orden en que venían del backend (lo vencido primero, lo
 * más reciente primero), que es un criterio en sí mismo y no hay por qué perderlo.
 */

const sinDato = (v) => v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));

const comparar = (a, b) => (typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' }));

export const ordenarFilas = (filas, de, dir = 'desc') => {
    if (!de || !filas) return filas;
    const signo = dir === 'asc' ? 1 : -1;
    return filas
        .map((fila, i) => ({ fila, i, v: de(fila) }))
        .sort((a, b) => {
            const faltaA = sinDato(a.v);
            const faltaB = sinDato(b.v);
            if (faltaA || faltaB) return faltaA === faltaB ? a.i - b.i : (faltaA ? 1 : -1);
            return comparar(a.v, b.v) * signo || a.i - b.i;
        })
        .map(x => x.fila);
};

/**
 * Qué orden queda al tocar el encabezado de una columna: primero de mayor a menor (lo que se busca
 * casi siempre: quién estudia más, quién debe más), después de menor a mayor, y al tercer toque se
 * vuelve al orden de la tabla.
 */
export const siguienteOrden = (actual, key) => {
    if (!actual || actual.key !== key) return { key, dir: 'desc' };
    return actual.dir === 'desc' ? { key, dir: 'asc' } : null;
};

/** Las columnas por las que se puede ordenar, sin repetir. */
export const columnasOrdenables = (def) => {
    const vistas = new Set();
    return [...(def?.cols || [])].filter(c => {
        if (!c.orden || vistas.has(c.key)) return false;
        vistas.add(c.key);
        return true;
    });
};
