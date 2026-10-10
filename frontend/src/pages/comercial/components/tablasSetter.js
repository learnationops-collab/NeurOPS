/**
 * Revisar del setter (pedido del usuario, 10/10/2026): «una pestaña de revisar donde pueda ver todas
 * sus agendas [...] y las ventas que se van registrando con la fuente de ese setter. Una lista de
 * agendas y ventas como las de los closers y directores, pero solo con sus agendas y sus ventas».
 *
 * Son las MISMAS tablas de `tablasDef.js` —las mismas facetas, filtros rápidos, totales y celdas— y
 * el backend ya las acota a él (`alcance_de`). Lo único que cambia acá es lo que, mirado por el
 * propio setter, es ruido o le falta:
 *
 *   · la columna y la faceta «Setter» (siempre él) se van, y en Agendas entra la palabra clave del
 *     anuncio: es lo que «Mis agendas» le pide completar, y su lista tiene que poder decir cuáles no
 *     la tienen;
 *   · en Ventas se va la «Fuente», que para él es siempre Setting;
 *   · el texto del "i" le habla a él, y una lista vacía del período lo dice amablemente en vez del
 *     «ningún registro entra por este filtro» de cuando un filtro deja la lista vacía.
 *
 * Las claves de tabla siguen siendo las de siempre (`generadas`, `ventas`, `leads`): el drill-down de
 * «Mis datos» escribe esas en la URL (`t`, ver `destinos.js`) y así sigue aterrizando sin traducir
 * nada. Solo las ve así quien mira SUS filas con rol setters; la dirección con el switch en Setters
 * sigue viendo las tablas de siempre (ver `defDeTabla`).
 */
import { TABLAS } from './tablasDef';

/** Cómo se lee en la faceta y en el agrupar una agenda sin palabra clave. */
export const SIN_PALABRA_CLAVE = 'Sin palabra clave';
export const sinPalabraClave = (fila) => !fila.palabra_clave;
const palabraClaveDe = (fila) => fila.palabra_clave || SIN_PALABRA_CLAVE;

const sinClave = (lista, clave) => lista.filter(x => x.key !== clave);

const AGENDAS = {
    ...TABLAS.generadas,
    label: 'Agendas',
    // Mismo conteo que «Generadas» de Mis datos: por la fecha en que se reservó y una por persona
    // (ver `ComercialService.generadas`). Así el número y la lista no pueden dar distinto.
    ayuda: 'Todas tus agendas del período, por la fecha en que se crearon: con o sin palabra clave '
        + 'y en cualquier estado. Un lead que reagendó aparece una vez, con su agenda más reciente. '
        + 'Tocá una fila para abrir el lead.',
    cols: [
        { key: 'fecha', header: 'Reunión', width: '0.9fr' },
        { key: 'cliente', header: 'Lead', width: '1.7fr' },
        { key: 'palabra_clave', header: 'Palabra clave', width: '1fr', min: 96 },
        { key: 'closer', header: 'Closer', width: '0.9fr' },
        { key: 'pre_call', header: 'Pre call', width: '1fr' },
        { key: 'post_call', header: 'Post call', width: '1.4fr' },
        { key: 'ver', header: '', width: '0.4fr' },
    ],
    facetas: [
        ...sinClave(TABLAS.generadas.facetas, 'setter'),
        { key: 'palabra_clave', label: 'Palabra clave', de: palabraClaveDe },
    ],
    chips: [
        TABLAS.generadas.chips[0],
        { key: 'sin_palabra', label: SIN_PALABRA_CLAVE, filtro: sinPalabraClave },
        ...TABLAS.generadas.chips.slice(1),
    ],
    agrupables: [
        ...sinClave(TABLAS.generadas.agrupables, 'setter'),
        { key: 'palabra_clave', label: 'Palabra clave', de: palabraClaveDe },
    ],
    // La bajada del total: «12 agendas · 3 sin palabra clave». Las realizadas, que es la que llevan
    // las demás listas, ya están en la del show up («8 de 10»).
    pistaDelTotal: (lista) => {
        if (!lista.length) return null;
        const faltan = lista.filter(sinPalabraClave).length;
        return faltan ? `${faltan} ${SIN_PALABRA_CLAVE.toLowerCase()}` : 'todas con palabra clave';
    },
    vacio: {
        titulo: 'Todavía no hay agendas en este período',
        texto: 'Las agendas que generes aparecen acá con su estado, tengan o no la palabra clave. '
            + 'Probá con otro período desde la píldora de arriba.',
    },
};

const VENTAS = {
    ...TABLAS.ventas,
    // Lo que la tarjeta «Ingresos por fuente» pone en «Setting · <setter>» (ver
    // `ComercialService.de_la_fuente_del_setter`): la cuota de una venta suya sigue a la agenda del
    // primer pago, la firme el closer que la firme.
    ayuda: 'Los cobros del período que trajo tu fuente: las ventas que originaste y sus cuotas, con el '
        + 'closer que las cerró.',
    facetas: TABLAS.ventas.facetas.filter(f => !['fuente', 'fuente_detalle'].includes(f.key)),
    agrupables: sinClave(TABLAS.ventas.agrupables, 'fuente'),
    vacio: {
        titulo: 'Todavía no hay ventas de tu fuente en este período',
        texto: 'Cuando un lead que agendaste pague, el cobro aparece acá con su monto y el closer que '
            + 'la cerró.',
    },
};

const LEADS = {
    ...TABLAS.leads,
    label: 'Leads',
    ayuda: 'Los leads que te entraron al inbox en el período, con el estado en que está hoy cada '
        + 'conversación.',
    // Fuente (ManyChat) y Setter (vos) son el mismo valor en todas las filas.
    cols: TABLAS.leads.cols.filter(c => !['fuente', 'setter'].includes(c.key)),
    facetas: sinClave(TABLAS.leads.facetas, 'setter'),
    vacio: {
        titulo: 'Todavía no te entraron leads en este período',
        texto: 'Los leads de ManyChat a tu nombre aparecen acá apenas llegan. Probá con otro período '
            + 'desde la píldora de arriba.',
    },
};

export const TABLAS_DEL_SETTER = { generadas: AGENDAS, ventas: VENTAS, leads: LEADS };

/**
 * Las pestañas de Revisar en el espacio del setter, en su orden, con la tabla que abre cada una. El
 * espacio las usa para su barra de pestañas y para traducir la `t` de un drill-down a su pestaña.
 */
export const REVISAR_DEL_SETTER = [
    { key: 'agendas', label: 'Agendas', tabla: 'generadas' },
    { key: 'ventas', label: 'Ventas', tabla: 'ventas' },
    { key: 'leads', label: 'Leads', tabla: 'leads' },
];

/**
 * La definición con la que se dibuja una tabla. La del setter es solo para quien mira SUS filas con
 * rol setters (`propias`: no puede elegir a nadie del equipo, ver `alcance_de`); la dirección mirando
 * a un setter sigue con la de siempre.
 */
export const defDeTabla = (tabla, rol, propias) => (
    (propias && rol === 'setters' && TABLAS_DEL_SETTER[tabla]) || TABLAS[tabla]);
