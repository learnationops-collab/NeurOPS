/**
 * Las fuentes que se le pueden poner a una agenda, sin nada de React.
 *
 * Las ofrecen dos editores —la fila de una agenda en el historial y la cabecera de la ficha
 * (09/10/2026)— y tienen que ofrecer lo mismo: el catálogo de `vocabulario.fuentes`, en grupos, y
 * la fuente actual aunque esté fuera de él.
 */

/** Las opciones de la fuente, con la actual agregada si es un valor histórico fuera del catálogo. */
export const gruposDeFuente = (grupos, actual) => {
    const conocidas = new Set(grupos.flatMap(g => (g.opciones || []).map(o => o.clave)));
    if (!actual || conocidas.has(actual)) return grupos;
    // Una fuente vieja se sigue mostrando como está; lo que no se puede es ELEGIR una fuera del
    // catálogo (mismo criterio que el backend). El aviso va en el título del grupo y no en la
    // opción: el desplegable cerrado muestra el texto de la opción elegida, y en la columna de la
    // cabecera «Venta histórica sin agenda (fuera del catálogo)» quedaba siempre cortado.
    return [{ titulo: 'Fuera del catálogo', opciones: [{ clave: actual, label: actual }] }, ...grupos];
};

export const etiquetaDeFuente = (grupos, clave) => grupos
    .flatMap(g => g.opciones || [])
    .find(o => o.clave === clave)?.label || clave;
