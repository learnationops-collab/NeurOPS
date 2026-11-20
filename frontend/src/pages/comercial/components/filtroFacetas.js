/**
 * El filtrado de Revisar (búsqueda + facetas) como funciones sueltas: lo usan Revisar y el Filtro completo de
 * Analizar (ADR-W190), así una agenda pasa o no pasa con la MISMA regla en las dos pantallas.
 */

const texto = (fila) => [fila.cliente, fila.ig, fila.email, fila.telefono, fila.closer, fila.setter,
    fila.fuente, fila.programa].filter(Boolean).join(' ').toLowerCase();

/**
 * Revisar y Analizar (20/11/2026, pedido de Kerwin): «Cumple» deja las filas que cumplen todas las condiciones y
 * «No cumple» las demás, así las dos listas suman el total. Reemplaza a Todas / Alguna en esas dos pantallas.
 */
export const MODOS_CUMPLE = { rotulo: 'Mostrar', opciones: [['todas', 'Cumple'], ['no_cumple', 'No cumple']] };

/** El modo guardado, llevado a uno de `MODOS_CUMPLE` (un «alguna» de antes vuelve a «Cumple»). */
export const modoCumple = (modo) => (modo === 'no_cumple' ? 'no_cumple' : 'todas');

/** La etiqueta de la fila de condiciones. */
export const rotuloModo = (modo) => (modo === 'no_cumple' ? 'No cumple:' : 'Cumple:');

/** Si alguna faceta de la tabla tiene al menos un valor puesto. */
export const hayCondiciones = (def, facetas) => def.facetas.some(fa => (facetas[fa.key] || []).length > 0);

/**
 * El texto de una etiqueta de filtro: el valor solo, salvo en las facetas de sí/no. Un «Sí» suelto
 * no dice nada —lo que trae el número de Show up es «Asistió: Sí»—, y desde que no está el aviso
 * grande que nombraba la faceta, la etiqueta es lo único que lo cuenta.
 */
export const rotuloDe = (c) => (c.valor === 'Sí' || c.valor === 'No' ? `${c.faceta}: ${c.valor}` : c.valor);

/**
 * Búsqueda + facetas. El filtro rápido se aplica aparte porque su menú cuenta cuántas filas deja
 * CADA opción sobre este mismo conjunto (el "Con deuda 9" del desplegable).
 */
export const aplicarFiltros = (filas, def, query, facetas, modo) => {
    const q = query.trim().toLowerCase();
    return filas.filter(f => {
        if (q && !texto(f).includes(q)) return false;
        const activas = def.facetas.filter(fa => (facetas[fa.key] || []).length > 0);
        if (activas.length === 0) return true;
        const cumple = activas.map(fa => facetas[fa.key].includes(fa.de(f)));
        if (modo === 'alguna') return cumple.some(Boolean);
        return modo === 'no_cumple' ? !cumple.every(Boolean) : cumple.every(Boolean);
    });
};

/** Las condiciones activas, con el nombre de su faceta, para una fila de etiquetas. */
export const criteriosDe = (def, facetas) => def.facetas.flatMap(fa => (facetas[fa.key] || []).map(
    valor => ({ clave: fa.key, faceta: fa.label, valor })));
