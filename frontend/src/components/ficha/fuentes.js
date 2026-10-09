/**
 * Las fuentes que se le pueden poner a una agenda, sin nada de React.
 *
 * Las ofrecen dos editores —la fila de una agenda en el historial y la cabecera de la ficha
 * (09/10/2026)— y tienen que ofrecer lo mismo: el catálogo de `vocabulario.fuentes`, en grupos, y
 * la fuente actual aunque esté fuera de él.
 */

/**
 * Las opciones de la fuente, con la actual agregada si no está en la lista: un valor histórico o
 * una de las que la ficha ya no ofrece (la grabación del workshop, el setting sin setter,
 * «Desconocido»; 09/10/2026). `etiqueta` es cómo se lee la actual (`fuente_label` del backend):
 * sin ella, «Workshop · grabación» aparecía como `workshop_landing`.
 */
export const gruposDeFuente = (grupos, actual, etiqueta = null) => {
    const conocidas = new Set(grupos.flatMap(g => (g.opciones || []).map(o => o.clave)));
    if (!actual || conocidas.has(actual)) return grupos;
    // Una fuente vieja se sigue mostrando como está; lo que no se puede es ELEGIR una fuera del
    // catálogo (mismo criterio que el backend). El aviso va en el título del grupo y no en la
    // opción: el desplegable cerrado muestra el texto de la opción elegida, y en la columna de la
    // cabecera «Venta histórica sin agenda (fuera del catálogo)» quedaba siempre cortado.
    return [{ titulo: 'Fuera del catálogo', opciones: [{ clave: actual, label: etiqueta || actual }] },
        ...grupos];
};

export const etiquetaDeFuente = (grupos, clave) => grupos
    .flatMap(g => g.opciones || [])
    .find(o => o.clave === clave)?.label || clave;
