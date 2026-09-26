import { diaDe, rotuloToques } from './tablasDef';

/**
 * El mapa "dato del dashboard comercial → lista que lo compone".
 *
 * Todo en un archivo y no repartido por los paneles, por la misma razón por la que las facetas
 * viven en `tablasDef.js`: un destino equivocado es peor que un dato que no se puede pinchar, y la
 * única forma de fijarlo con un test es que el mapa sea un dato.
 *
 * Cada entrada es `{ tabla, filtro, de, aviso? }` (ver `MetricaClicable`). Los valores del filtro
 * son **etiquetas** de faceta, no keys.
 *
 * `aviso` no es un adorno: es para las cifras que NO se pueden cortar con el mismo criterio con el
 * que se calcularon. El "por cobrar" del panel Cash se atribuye por quién tiene HOY la agenda del
 * cliente y la cartera de Clientes por quién VENDIÓ; el ticket promedio divide todo el cash del
 * período por las ventas nuevas. En esos casos la lista es lo más cerca que se puede llegar, y la
 * regla del proyecto es decir en pantalla por qué no cierra.
 */

/** La tabla de agendas de cada rol: el setter ve las que generó, el closer las que atiende. */
export const TABLA_AGENDAS = { closers: 'agendas', setters: 'generadas' };

/** Los dos tipos de pago que abren una venta nueva (etiquetas de `TIPOS_PAGO`). */
export const VENTAS_NUEVAS = ['Pago completo', 'Split Pay'];

/** Agrega el día a un destino, para que un dato de Variabilidad abra la lista de ESE día. */
export const conDia = (destino, iso) => (destino && iso
    ? { ...destino, filtro: { ...destino.filtro, dia: diaDe(iso) },
        de: `${destino.de} · ${diaDe(iso)}` }
    : destino);

/* ============================================================
   CLOSERS
   ============================================================ */

const AVISO_TASA_NUMERADOR = 'La lista muestra el numerador de la tasa. En la tira de totales de '
    + 'arriba esa misma tasa va a dar 100%: el denominador se queda afuera del filtro, que es '
    + 'justamente lo que se pidió ver.';

const AVISO_COBROS = 'La lista son los cobros del período, que es de donde sale el monto. El fee '
    + 'no es una fila: es la diferencia entre el "cash" y el "cash neto" de la tira de totales.';

// El "por cobrar" del panel Cash y la deuda de la tabla Clientes NO son la misma cifra, y es a
// propósito: uno atribuye por quién tiene hoy la agenda del cliente —e incluye saldos de clientes
// que nadie del equipo actual vendió— y el otro por quién firmó la venta. Está documentado en la
// ayuda de la tabla Clientes. Acá se avisa en vez de mezclarlos.
const AVISO_POR_COBRAR = 'Este monto atribuye por quién tiene HOY la agenda del cliente e incluye '
    + 'saldos de clientes que nadie del equipo actual vendió. La cartera de Clientes atribuye por '
    + 'quién VENDIÓ, así que su total de deuda da distinto: las dos cifras son correctas.';

export const DESTINOS_CLOSER = {
    // --- Tiles ---
    show_up: { tabla: 'agendas', filtro: { asistio: 'Sí' }, de: 'Show up',
        aviso: AVISO_TASA_NUMERADOR },
    close_rate: { tabla: 'agendas', filtro: { post_call: 'Venta' }, de: 'Close rate',
        aviso: AVISO_TASA_NUMERADOR },
    cash: { tabla: 'ventas', filtro: {}, de: 'Cash collected' },
    ticket: { tabla: 'ventas', filtro: { tipo_pago: VENTAS_NUEVAS }, de: 'Ticket promedio',
        aviso: 'El ticket divide TODO el cash del período (también cuotas y señas) por las ventas '
            + 'nuevas. La lista muestra solo esas ventas nuevas, así que su "cash" es menor que el '
            + 'numerador de la división.' },

    // --- Panel Cierre: las tres tasas comparten numerador (las agendas que cerraron) ---
    presentacion_rate: { tabla: 'agendas', filtro: { presento: 'Sí' }, de: 'Presentación',
        aviso: AVISO_TASA_NUMERADOR },
    close_llamada: { tabla: 'agendas', filtro: { post_call: 'Venta' }, de: 'Cierre por llamada',
        aviso: AVISO_TASA_NUMERADOR },
    close_presentacion: { tabla: 'agendas', filtro: { post_call: 'Venta' },
        de: 'Cierre por presentación',
        aviso: 'El numerador son TODAS las ventas del período, no solo las que además tienen la '
            + 'oferta marcada como presentada: es la lista que corresponde al número. '
            + AVISO_TASA_NUMERADOR },

    // --- Panel Cash ---
    cash_collected: { tabla: 'ventas', filtro: {}, de: 'Cash collected' },
    fees: { tabla: 'ventas', filtro: {}, de: 'Fees de pasarela', aviso: AVISO_COBROS },
    cash_neto: { tabla: 'ventas', filtro: {}, de: 'Cash neto' },
    ticket_promedio: { tabla: 'ventas', filtro: { tipo_pago: VENTAS_NUEVAS },
        de: 'Ticket promedio',
        aviso: 'El ticket divide TODO el cash del período por las ventas nuevas. La lista muestra '
            + 'solo esas ventas nuevas.' },

    por_cobrar: { tabla: 'clientes', filtro: {}, de: 'Por cobrar · a hoy', aviso: AVISO_POR_COBRAR },
    por_cobrar_vencido: { tabla: 'clientes', filtro: { estado: 'Cuota vencida' }, de: 'Vencido',
        aviso: `${AVISO_POR_COBRAR} Además, el monto cuenta la cuota vencida y la lista muestra el `
            + 'saldo completo de cada cliente que tiene una.' },
    por_cobrar_por_vencer: { tabla: 'clientes', filtro: { estado: 'Cuota por vencer' },
        de: 'Por vencer', aviso: AVISO_POR_COBRAR },
    por_cobrar_sin_plan: { tabla: 'clientes', filtro: { estado: 'Debe, sin plan' },
        de: 'Sin cronograma', aviso: AVISO_POR_COBRAR },

    // --- Panel Señas ---
    // El estado de una seña no es una columna: sale de buscar una venta POSTERIOR del mismo
    // contacto (ver `senas_de` en comercial_analitica.py). El backend lo baja a la fila de la
    // tabla como `sena_estado` y estas etiquetas tienen que ser las mismas que las del panel.
    senas_total: { tabla: 'ventas', filtro: { tipo_pago: 'Depósitos' }, de: 'Señas del período' },
    senas_completo: { tabla: 'ventas', filtro: { tipo_pago: 'Depósitos', sena_estado: 'Pago completo' },
        de: 'Señas que pasaron a pago completo' },
    senas_parcial: { tabla: 'ventas', filtro: { tipo_pago: 'Depósitos', sena_estado: 'Pago parcial' },
        de: 'Señas que pasaron a pago parcial' },
    senas_espera: { tabla: 'ventas', filtro: { tipo_pago: 'Depósitos', sena_estado: 'En espera' },
        de: 'Señas en espera' },
    senas_caida: { tabla: 'ventas', filtro: { tipo_pago: 'Depósitos', sena_estado: 'Caída' },
        de: 'Señas caídas' },
    senas_convirtio: { tabla: 'ventas', filtro: { tipo_pago: 'Depósitos' }, de: 'Conversión de señas',
        aviso: 'La lista son todas las señas del período: el estado de cada una está en su propia '
            + 'columna, porque la conversión no se cobra en la seña sino en la venta posterior.' },
    senas_cobrado: { tabla: 'ventas', filtro: { tipo_pago: 'Depósitos' }, de: 'Cobrado en señas' },
    senas_ticket: { tabla: 'ventas', filtro: { tipo_pago: 'Depósitos' }, de: 'Seña promedio' },
    senas_desbloqueado: { tabla: 'ventas', filtro: { tipo_pago: VENTAS_NUEVAS },
        de: 'Cash desbloqueado por señas',
        aviso: 'La lista son las ventas nuevas del período. El monto cuenta solo las que arrancaron '
            + 'con una seña, y ese cruce (por mail o instagram) no existe como columna de la tabla.' },
};

/* ============================================================
   SETTERS
   ============================================================ */

export const DESTINOS_SETTER = {
    leads: { tabla: 'leads', filtro: {}, de: 'Entrantes' },
    respuesta: { tabla: 'leads', filtro: { respondio: 'Sí' }, de: 'Tasa de respuesta',
        aviso: AVISO_TASA_NUMERADOR },
    // El número cuenta LEADS del período que llegaron a reservar, no las citas del período: son
    // la misma historia contada al revés y dan distinto (45 contra 169). Por eso va a `leads`.
    agendas: { tabla: 'leads', filtro: { estado: 'Agendó' }, de: 'Agendas' },
    cualif_entrantes: { tabla: 'leads', filtro: { cualificado: 'Sí' }, de: 'Cualificados sobre entrantes',
        aviso: AVISO_TASA_NUMERADOR },
    cualif_respuesta: { tabla: 'leads', filtro: { cualificado: 'Sí' }, de: 'Cualificados sobre respuesta',
        aviso: AVISO_TASA_NUMERADOR },
    conv_entrante: { tabla: 'leads', filtro: { estado: 'Agendó' }, de: 'De entrante a cita' },
    conv_respuesta: { tabla: 'leads', filtro: { estado: 'Agendó' }, de: 'De respuesta a cita',
        aviso: AVISO_TASA_NUMERADOR },
    conv_cualificado: { tabla: 'leads', filtro: { estado: 'Agendó' }, de: 'De cualificado a cita',
        aviso: AVISO_TASA_NUMERADOR },
};

/** Un tramo de la tenacidad del seguimiento: los leads que recibieron ese puñado de toques. */
export const destinoToques = (toques) => {
    const n = Number(String(toques).replace('+', ''));
    const rotulo = rotuloToques(n);
    return { tabla: 'leads', filtro: { toques: rotulo }, de: `Leads con ${rotulo}` };
};

/* ============================================================
   EMBUDO
   ============================================================ */

export const PASOS_CLOSER = {
    Agendas: {
        ayuda: 'Llamadas agendadas en el período, sin importar la fuente.',
        destino: { tabla: 'agendas', filtro: {}, de: 'Embudo · Agendas' },
    },
    Confirmadas: {
        ayuda: 'Confirmaron asistencia antes de la llamada.',
        destino: { tabla: 'agendas', filtro: { confirmada: 'Sí' }, de: 'Embudo · Confirmadas' },
    },
    Asistieron: {
        ayuda: 'La llamada ocurrió y el lead estaba del otro lado.',
        destino: { tabla: 'agendas', filtro: { asistio: 'Sí' }, de: 'Embudo · Asistieron' },
    },
    Presentaciones: {
        ayuda: 'Llamadas donde además se llegó a presentar la oferta.',
        destino: { tabla: 'agendas', filtro: { presento: 'Sí' }, de: 'Embudo · Presentaciones' },
    },
    Ventas: {
        ayuda: 'Cierres del período. Cuenta agendas y no cobros: dos cuotas del mismo lead salen '
            + 'de una sola llamada.',
        destino: { tabla: 'agendas', filtro: { post_call: 'Venta' }, de: 'Embudo · Ventas' },
    },
};

export const PASOS_SETTER = {
    Entrantes: {
        ayuda: 'Leads nuevos que entraron al inbox en el período. Es el denominador de todo lo demás.',
        destino: { tabla: 'leads', filtro: {}, de: 'Embudo · Entrantes' },
    },
    Respondieron: {
        ayuda: 'Contestaron al menos un mensaje.',
        destino: { tabla: 'leads', filtro: { respondio: 'Sí' }, de: 'Embudo · Respondieron' },
    },
    Cualificados: {
        ayuda: 'Cumplen el perfil del programa. Ojo: se mide sobre los que respondieron.',
        destino: { tabla: 'leads', filtro: { cualificado: 'Sí' }, de: 'Embudo · Cualificados' },
    },
    Agendaron: {
        ayuda: 'Reservaron horario en el calendario de un closer.',
        // Los LEADS que agendaron, no la tabla de agendas generadas: el paso cuenta leads del
        // período que llegaron a reservar (45), y esa otra tabla son las citas del período
        // mirándolo al revés (169). El clic mostraba 169 filas debajo de un 45.
        destino: { tabla: 'leads', filtro: { estado: 'Agendó' }, de: 'Embudo · Agendaron' },
    },
};

/* ============================================================
   VARIABILIDAD — una barra, una celda o un punto es UN DÍA
   ============================================================ */

/**
 * De qué lista sale cada serie por día, y con qué corte cada sub-serie.
 *
 * Las sub-series las arma el backend a partir de los datos (`_por_categoria`), así que su rótulo
 * ES la etiqueta de la faceta: una sub-serie de tipo de pago se llama "Split Pay" porque eso es
 * lo que devuelve `tipo_pago.label`. Por eso `porSub` alcanza con una clave de faceta y el
 * rótulo se usa tal cual; `todas` es el caso del primer botón, que no corta nada.
 */
const SERIES = {
    closers: {
        cash: { tabla: 'ventas', de: 'Cash cobrado', porSub: 'tipo_pago',
            todas: { Todo: {}, 'Ventas nuevas': { tipo_pago: VENTAS_NUEVAS } } },
        agendas: { tabla: 'agendas', de: 'Agendas' },
        ventas: { tabla: 'ventas', de: 'Ventas', porSub: 'tipo_pago',
            todas: { Todas: { tipo_pago: VENTAS_NUEVAS } } },
        showup: { tabla: 'agendas', de: 'Show up', filtro: { asistio: 'Sí' },
            aviso: AVISO_TASA_NUMERADOR },
        senas: { tabla: 'ventas', de: 'Señas', filtro: { tipo_pago: 'Depósitos' } },
        programas: { tabla: 'ventas', de: 'Programas', porSub: 'programa', todas: { Todos: {} } },
    },
    setters: {
        entrantes: { tabla: 'leads', de: 'Entrantes', porSub: 'setter', todas: { Todos: {} } },
        respuestas: { tabla: 'leads', de: 'Respuestas', filtro: { respondio: 'Sí' } },
        cualificados: { tabla: 'leads', de: 'Cualificados', filtro: { cualificado: 'Sí' } },
        agendas: { tabla: 'generadas', de: 'Agendas generadas' },
        tasa_resp: { tabla: 'leads', de: 'Tasa de respuesta', filtro: { respondio: 'Sí' },
            aviso: AVISO_TASA_NUMERADOR },
    },
};

/**
 * El destino de una serie por día. `sub` es el rótulo de la sub-serie activa, si hay tira.
 *
 * Una sub-serie cuyo rótulo no es una etiqueta de faceta conocida —el "Otros" que el backend
 * agrega cuando quedan cobros sin clasificar— cae en la serie entera y lo dice en el aviso, en
 * vez de mandar a una lista que no es la de esa barra.
 */
export const destinoDeSerie = (rol, key, sub = null) => {
    const def = SERIES[rol]?.[key];
    if (!def) return null;
    const base = { tabla: def.tabla, de: def.de, filtro: def.filtro || {}, aviso: def.aviso };

    if (!sub || !def.porSub) return base;
    if (def.todas?.[sub]) return { ...base, filtro: def.todas[sub], de: `${def.de} · ${sub}` };

    return {
        ...base,
        filtro: { ...base.filtro, [def.porSub]: sub },
        de: `${def.de} · ${sub}`,
    };
};

/** ¿El rótulo de esta sub-serie se puede cortar con una faceta? Si no, no se hace cliqueable. */
export const serieCortable = (rol, key, sub = null) => {
    const def = SERIES[rol]?.[key];
    if (!def) return false;
    if (!sub || !def.porSub) return true;
    // "Otros" / "Sin clasificar" son el resto que el backend junta: no hay etiqueta que los aísle.
    return Boolean(def.todas?.[sub]) || !['Otros', 'Sin clasificar'].includes(sub);
};

/* ============================================================
   COMPARATIVAS — una celda del mapa del equipo
   ============================================================ */

/**
 * Qué lista abre cada métrica rankeable, para una persona concreta.
 *
 * La persona NO se acota con la faceta Closer sino con el selector de miembro (`m` en la query
 * string, que el backend usa para rearmar el alcance): así la tira de totales y los contadores de
 * faceta también quedan acotados, y el número de la celda cierra con lo que se ve abajo.
 */
export const DESTINOS_METRICA = {
    closers: {
        cash: { tabla: 'ventas', filtro: {}, de: 'Cash collected' },
        show_up: { tabla: 'agendas', filtro: { asistio: 'Sí' }, de: 'Show up',
            aviso: AVISO_TASA_NUMERADOR },
        close_rate: { tabla: 'agendas', filtro: { post_call: 'Venta' }, de: 'Close rate',
            aviso: AVISO_TASA_NUMERADOR },
        ticket: { tabla: 'ventas', filtro: { tipo_pago: VENTAS_NUEVAS }, de: 'Ticket promedio' },
        comision: { tabla: 'ventas', filtro: {}, de: 'Comisión',
            aviso: 'La comisión es el 10% del cash neto: no es una columna de la tabla. La lista '
                + 'son los cobros sobre los que se calcula.' },
        senas_conversion: { tabla: 'ventas', filtro: { tipo_pago: 'Depósitos' },
            de: 'Conversión de señas' },
        agendas: { tabla: 'agendas', filtro: {}, de: 'Agendas' },
    },
    setters: {
        leads: { tabla: 'leads', filtro: {}, de: 'Leads' },
        respuesta: { tabla: 'leads', filtro: { respondio: 'Sí' }, de: 'Respuesta',
            aviso: AVISO_TASA_NUMERADOR },
        cualificacion: { tabla: 'leads', filtro: { cualificado: 'Sí' }, de: 'Cualificación',
            aviso: AVISO_TASA_NUMERADOR },
        agendas: { tabla: 'leads', filtro: { estado: 'Agendó' }, de: 'Agendas' },
        conversion: { tabla: 'leads', filtro: { estado: 'Agendó' }, de: 'Conv. final' },
        show_up: { tabla: 'generadas', filtro: { asistio: 'Sí' }, de: 'Show up de sus agendas',
            aviso: AVISO_TASA_NUMERADOR },
        ventas_originadas: { tabla: 'generadas', filtro: { post_call: 'Venta' },
            de: 'Ventas originadas' },
    },
};
