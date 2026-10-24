/**
 * El ancho mínimo de una lista de columnas y el lugar de las que quedan pegadas al desplazar.
 *
 * Una lista con muchas columnas visibles no entra en la pantalla: en vez de ensanchar la página, la tabla
 * se desplaza adentro de su caja. Para eso las filas necesitan un ancho mínimo, que sale de sumar el
 * mínimo de cada columna (el primer valor en px de su `width`) más los huecos y el relleno de
 * `.tabla-fila` (comercial.css: `gap: var(--s3)` = 12px y `padding: 0 var(--s4)` = 16px a cada lado).
 *
 * `pegada: true` en una columna la deja fija a la izquierda mientras se desplaza el resto. Solo vale para
 * las primeras columnas y con `width` en px: el desplazamiento de cada una es la suma de las anteriores.
 */
const RELLENO = 16;
const HUECO = 12;
const MINIMO_POR_DEFECTO = 0; // `minmax(0,…)` o `fr` sin px: la columna se achica sin límite, como antes

const minimoDe = (width) => {
    const m = /(\d+(?:\.\d+)?)px/.exec(width || '');
    return m ? Number(m[1]) : MINIMO_POR_DEFECTO;
};

export const anchoMinimo = (columnas) => (
    columnas.reduce((suma, c) => suma + minimoDe(c.width), 0)
    + HUECO * Math.max(columnas.length - 1, 0) + 2 * RELLENO
);

/** `{ [key]: left }` de las columnas pegadas, en orden: cada una arranca donde termina la anterior. */
export const izquierdaDePegadas = (columnas) => {
    const lugares = {};
    let left = RELLENO;
    columnas.forEach((c) => {
        if (!c.pegada) return;
        lugares[c.key] = left;
        left += minimoDe(c.width) + HUECO;
    });
    return lugares;
};
