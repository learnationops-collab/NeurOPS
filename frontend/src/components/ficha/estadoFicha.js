/**
 * Adaptador delgado entre el JSON de `GET /api/ficha/lead` y el cascarón del modal.
 *
 * NO es la máquina de estados: qué pestaña se abre por defecto lo decide el backend
 * en `app/services/estado_lead.py` y llega en `estado.pestana_por_defecto`. Acá solo
 * se hacen tres cosas que el servidor no puede hacer por nosotros:
 *
 *   1. Traducir claves de pestaña a rótulos y ordenarlas siempre igual.
 *   2. Sacar las pestañas que el rol no puede ver, según el bloque `permisos`.
 *   3. Si la pestaña por defecto que manda el servidor no está entre las visibles,
 *      caer a la primera que sí: un modal que abre en una pestaña que no existe se
 *      ve vacío y parece roto.
 *
 * Todo tolera `null` y claves ausentes: el contrato dice que los campos que faltan
 * vienen en `null`, pero un payload a medio camino (un 500 parcial, un fixture
 * viejo) no puede tumbar el modal.
 */

// El orden del catálogo es el orden del tablist. No se reordena por estado.
export const PESTANAS = [
    { id: 'conf', label: 'Confirmación', permiso: null },
    { id: 'resultado', label: 'Resultado', permiso: 'reportar' },
    { id: 'acciones', label: 'Acciones', permiso: 'cobrar' },
    { id: 'hist', label: 'Historial', permiso: null },
    { id: 'form', label: 'Formulario', permiso: null },
    { id: 'com', label: 'Comunicación', permiso: 'comentar' },
];

const ORDEN = PESTANAS.map(p => p.id);

/** Lista segura: lo que no es array es lista vacía, no un crash aguas abajo. */
const lista = (v) => (Array.isArray(v) ? v : []);

/**
 * Un permiso ausente o `null` NO esconde nada: significa "el servidor no opinó".
 * Solo un `false` explícito saca la pestaña. Al revés escondería media ficha cada
 * vez que el backend olvide una clave.
 */
const vetado = (permisos, clave) => !!permisos && permisos[clave] === false;

export const pestanasVisibles = (ficha) => {
    const estado = ficha?.estado || {};
    const permisos = ficha?.permisos || null;
    const declaradas = lista(estado.pestanas);
    // Sin lista del servidor se muestran todas las que el rol puede ver: es mejor
    // una ficha completa que una ficha vacía.
    const claves = declaradas.length ? declaradas : ORDEN;
    return PESTANAS
        .filter(p => claves.includes(p.id))
        .filter(p => !(p.permiso && vetado(permisos, p.permiso)));
};

export const pestanaPorDefecto = (ficha) => {
    const visibles = pestanasVisibles(ficha);
    if (!visibles.length) return null;
    const pedida = ficha?.estado?.pestana_por_defecto;
    return visibles.some(p => p.id === pedida) ? pedida : visibles[0].id;
};

/** Si el rol no puede tocar nada, el panel se muestra en solo lectura. */
export const puedeEditarFicha = (ficha) => {
    const permisos = ficha?.permisos;
    if (!permisos) return true;
    return ['confirmar', 'reportar', 'cobrar', 'reasignar', 'comentar', 'eliminar']
        .some(k => permisos[k] === true);
};

/** Lo que el cascarón necesita de `estado`, en un solo objeto y sin `undefined`. */
export const leerEstado = (ficha) => ({
    clave: ficha?.estado?.clave ?? null,
    etiqueta: ficha?.estado?.etiqueta ?? null,
    tono: ficha?.estado?.tono ?? 'idle',
    pestanas: pestanasVisibles(ficha),
    porDefecto: pestanaPorDefecto(ficha),
    puedeEditar: puedeEditarFicha(ficha),
});

/** Grupos de un vocabulario agrupado (`como_viene`, `dolores`, motivos…). */
export const grupos = (ficha, clave) => lista(ficha?.vocabulario?.[clave])
    .map(g => ({ titulo: g?.titulo ?? 'Otros', tono: g?.tono ?? 'idle', opciones: lista(g?.opciones) }));

/** Opciones planas de un vocabulario simple (`medios_pago`, `closers`…). */
export const opciones = (ficha, clave) => lista(ficha?.vocabulario?.[clave]);
