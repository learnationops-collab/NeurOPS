/**
 * El contrato de filtros del libro de registros: columnas, facetas y filtros rápidos de cada tabla.
 *
 * Vive fuera de `Revisar.jsx` por dos razones. Una es de tamaño: el componente ya pasaba las 500
 * líneas del repo y esta definición es la mitad que no dibuja nada. La otra es que el mapa
 * "métrica del dashboard → filtro de la lista" se puede testear solo si las facetas son un dato
 * importable sin montar React: el test que evita que un número lleve a una lista equivocada
 * compara contra `FACETAS_POR_TABLA`, y para eso tiene que existir sin JSX de por medio.
 *
 * **Todo el filtrado es del lado del cliente, sobre las filas que `GET /comercial/tabla` devolvió
 * para el período.** Es deliberado: así los contadores de las facetas, el "mostrando X de Y" y la
 * tira de totales cierran sobre exactamente el mismo conjunto de filas.
 *
 * **Los valores que manda una métrica son ETIQUETAS, no keys**, porque se comparan contra lo que
 * devuelve `faceta.de(fila)`.
 */

import { AGRUPABLE_ACADEMIA, CHIP_ACADEMIA, COLS_ACADEMIA, FACETAS_ACADEMIA } from './academia';

/**
 * El estado con el que el panel Estados cuenta cada agenda.
 *
 * "Pendiente" es un solo valor en la tabla pero dos cosas distintas para leer: una llamada que ya
 * pasó y nadie reportó, y una que todavía no ocurrió. El panel las separa, así que la faceta
 * tiene que separarlas igual — si no, clic en "Sin reporte · 62" aterriza en las 71 pendientes.
 * La derivación es la MISMA que hace `estados_de` en el backend, sobre el mismo campo.
 */
export const estadoDeAgenda = (fila) => {
    if (fila.post_call?.key !== 'pendiente') return fila.post_call?.label;
    // Por la HORA, no por el día: una llamada de esta mañana que nadie reportó ya pasó. `ya_paso`
    // falta en filas viejas (tests, caché): ahí se cae a los días de retraso, como antes.
    const yaPaso = fila.ya_paso ?? fila.retraso_dias > 0;
    return yaPaso ? 'Sin reporte' : 'Aún no ocurrió';
};

/**
 * Estados de agenda que el backend ya no manda, con el que los reemplazó.
 *
 * El filtro del drill-down viaja en la URL (`f`) con etiquetas, así que un link guardado, el botón
 * "atrás" o una pestaña abierta de antes pueden traer una que ya no existe. Y una etiqueta que no
 * existe no falla: filtra cero filas y la lista sale vacía, como si no hubiera agendas. «Presentó,
 * no cerró» se muestra como «Seguimiento» desde el 09/10/2026 (pedido del usuario); se reconoce
 * también su key, por si un filtro escrito a mano la trajera.
 */
const ESTADOS_RETIRADOS = new Map([
    ['Presentó, no cerró', 'Seguimiento'],
    ['presento_no_cerro', 'Seguimiento'],
]);

/** Las facetas que filtran por el estado de la agenda (ver `estadoDeAgenda`). */
const FACETAS_DE_ESTADO = ['estado', 'post_call'];

/**
 * Los valores con los que llega una faceta, con los estados retirados ya traducidos y sin repetir:
 * `['Seguimiento', 'Presentó, no cerró']` queda en `['Seguimiento']`. Las demás facetas pasan tal
 * cual.
 */
export const valoresVigentes = (faceta, valores) => (FACETAS_DE_ESTADO.includes(faceta)
    ? [...new Set(valores.map(v => ESTADOS_RETIRADOS.get(v) ?? v))]
    : valores);

/**
 * ¿Esta agenda entra en el listado por defecto?
 *
 * Las descartadas —el lead canceló, o el closer lo marcó como lead perdido o no lead— salen de la
 * lista y se ven en su propio filtro rápido, «Descartadas» (pedido del usuario, 02/10/2026: «que
 * desaparezcan y queden en otro lugar aparte»). Mismo criterio que los dados de baja de Clientes
 * (`entraPorDefecto`): si alguien pide ese estado desde el filtro completo, se lo muestra.
 */
export const agendaEntraPorDefecto = (fila, facetas) => !fila.descartada
    || [...(facetas?.estado || []), ...(facetas?.post_call || [])].includes(fila.post_call?.label);

/**
 * Las etiquetas del vocabulario del backend con las que se corta una tabla, en un solo lugar.
 *
 * El drill-down filtra por ETIQUETA y estas las define el servidor (`ESTADO_CARTERA` en
 * `comercial_service.py`, y el estado derivado de una seña en `comercial_analitica.py`). Cuando
 * una etiqueta cambia allá, un destino que la tenga escrita a mano deja de encontrar filas **sin
 * fallar**: la clave de faceta sigue siendo válida, así que el test de destinos no lo atrapa. La
 * única defensa es no repetirlas.
 *
 * Ya pasó: `sin_plan` pasó de "Debe, sin plan" a "Sin cronograma" y `por_vencer` de "Cuota por
 * vencer" a "Con deuda", con esas etiquetas escritas a mano en cuatro archivos.
 */
export const ESTADO_CARTERA = {
    vencida: 'Cuota vencida',
    por_vencer: 'Con deuda',
    sin_plan: 'Sin cronograma',
    al_dia: 'Al día',
    baja: 'Dado de baja',
};

/**
 * ¿Esta fila de Clientes entra en el listado por defecto?
 *
 * Un cliente dado de baja no debe nada y ya no se le cobra: la tabla lo deja afuera y lo muestra
 * en su propio filtro rápido, «Dados de baja» (pedido del usuario, 30/09/2026: «que desaparezcan
 * de las listas y que se vean en otro filtro»). La fila igual llega del backend, porque lo que
 * pagó es de la cartera.
 *
 * Si alguien pide el estado «Dado de baja» desde el filtro completo, se lo muestra aunque el
 * filtro rápido siga en el de por defecto: pedirlo y recibir una lista vacía sería contradecirlo.
 */
export const entraPorDefecto = (fila, facetas) => !fila.baja
    || (facetas?.estado || []).includes(ESTADO_CARTERA.baja);

/** En qué terminó una seña. El backend manda la CLAVE en `sena_estado`; la lista muestra esto. */
export const SENA_ESTADO = {
    pago_completo: 'Pago completo',
    pago_parcial: 'Pago parcial',
    en_espera: 'En espera',
    caida: 'Caída',
};

/**
 * Las facetas de sí/no de los pasos del embudo.
 *
 * Los pasos intermedios —Confirmadas, Asistieron, Presentaciones del embudo de closers, y
 * Respondieron y Cualificados del de setters— no eran clickeables porque ninguna faceta los
 * aislaba: el corte no es un valor de una columna sino una condición sobre la fila. Cada una
 * repite EXACTAMENTE el criterio con el que el backend cuenta ese paso, así que el clic abre
 * tantas filas como dice el número.
 */
export const SI = 'Sí';
export const NO = 'No';
const siNo = (condicion) => (fila) => (condicion(fila) ? SI : NO);

// Una llamada a la que el lead asistió estaba confirmada, por definición: el mismo criterio de
// `bloque_closers`, que existe porque el embudo es una cadena de subconjuntos.
export const fueConfirmada = siNo((f) => f.pre_call?.key === 'confirmada' || f.asistio);
export const asistio = siNo((f) => f.asistio);
// Presentar requiere haber asistido: sin eso el embudo mostraría más presentaciones que
// asistencias, que es imposible.
export const presento = siNo((f) => f.asistio && f.presento);
export const respondio = siNo((f) => f.respondio);
export const cualificado = siNo((f) => f.cualificado);

/**
 * El día de una fila, en `DD/MM/AAAA`.
 *
 * Con el año, y no `DD/MM` como la columna: un período de 90 días cruza meses de dos años y dos
 * días distintos caerían en la misma etiqueta. Es la faceta con la que un día de Variabilidad
 * abre su propia lista sin tocar el rango de fechas del backend — el día pedido ya está dentro
 * de las filas cargadas, así que recortar el período sería pedir de nuevo lo que ya está.
 */
export const diaDe = (iso) => {
    if (!iso) return null;
    const [a, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
};

/** El rótulo del tramo de tenacidad de un lead. Uno solo para el panel y para la faceta. */
export const rotuloToques = (n) => (n >= 4 ? '4 toques o más' : `${n} ${n === 1 ? 'toque' : 'toques'}`);

const toquesDe = (fila) => (fila.mensajes > 0 ? rotuloToques(fila.mensajes) : null);

/**
 * Las agendas que parecen una copia de otra: {id de la copia -> la hermana que se conserva}.
 *
 * Una misma cita cargada dos veces (visto en producción: Nerina con la lead "Mia Sky",
 * 10/sep/2026, una sincronización procesada dos veces). Una queda con la llamada real y la otra
 * huérfana sin reportar, inflando el total de agendas.
 *
 * Dos condiciones, las MISMAS que valida el backend en `marcar_duplicada` — si divergen, la
 * pantalla ofrece una acción que el backend va a rechazar:
 *
 *   · la copia todavía no tiene resultado (`post_call` pendiente: es el equivalente exacto de
 *     `ESTADOS_SIN_RESULTADO`, porque todos esos estados derivan a "pendiente" acá);
 *   · hay otra cita del mismo cliente a menos de seis horas.
 *
 * Se calcula sobre las filas del período cargado, así que una hermana fuera del período no se
 * detecta — la misma limitación que tenía la pestaña del mazo, y por el mismo motivo.
 */
const VENTANA_DUPLICADO_MS = 6 * 60 * 60 * 1000;

export const duplicadasDe = (filas) => {
    const mapa = {};
    (filas || []).forEach(a => {
        if (a.tipo !== 'agenda' || !a.client_id || a.post_call?.key !== 'pendiente' || !a.fecha) return;
        const tA = new Date(a.fecha).getTime();
        if (!tA) return;
        const hermana = filas.find(b => (
            b.id !== a.id && b.client_id === a.client_id && b.fecha
            && Math.abs(new Date(b.fecha).getTime() - tA) <= VENTANA_DUPLICADO_MS
        ));
        if (hermana) mapa[a.id] = hermana;
    });
    return mapa;
};

/**
 * La fuente que trajo un cobro de Ventas: Workshop, Setting, VSL, Fulfillment o Sin procedencia.
 *
 * La pone el backend en cada fila (`procedencia`, ver `ComercialService._con_fuente`) con la MISMA
 * clasificación que la tarjeta «Ingresos por fuente» de Analizar y que Finanzas › Procedencia: acá
 * no se deduce nada. No es el «Setter» escrito en la venta, que no siempre es el de la agenda que
 * la originó. Una fila sin el dato (un payload viejo) no lista una opción vacía.
 */
export const fuenteDe = (fila) => fila.procedencia?.label ?? null;

/**
 * El renglón del detalle de una fuente («Workshop · En vivo», «Setting · Elias»), tal como se
 * escribe en la faceta oculta `fuente_detalle`. Lo arman igual la faceta y la tarjeta que lleva a
 * ella; con el nombre de la fuente adelante, porque «Sin identificar» u «Otros pagos» solos no dicen
 * de qué fuente son.
 */
export const rotuloDetalleFuente = (fuente, detalle) => `${fuente} · ${detalle}`;

const detalleFuenteDe = (fila) => (fila.procedencia && fila.procedencia_detalle
    ? rotuloDetalleFuente(fila.procedencia.label, fila.procedencia_detalle.label)
    : null);

// Columnas que están en los dos juegos de columnas de su tabla: el de siempre y el de la Academia.
const COL_FECHA_VENTA = { key: 'fecha', header: 'Venta', width: '0.8fr', orden: (f) => f.fecha,
    ordenLabel: 'Fecha de la venta' };
// `min`: el botón de la flecha mide 30px y no se puede cortar.
const COL_VER = { key: 'ver', header: '', width: '0.4fr', min: 32 };

// Definición de cada tabla: columnas, facetas y filtros rápidos. Una sola fuente para las cinco.
//
// El `ayuda` de cada tabla es lo que se lee en el tooltip del "i", y va al MÍNIMO: alcanza con lo
// que hace falta para no malinterpretar la lista. Antes explicaba la decisión entera y el de
// `clientes` eran seis renglones que nadie termina de leer. El porqué largo no se perdió: vive en
// el comentario que hay arriba de cada `ayuda`, donde le sirve a quien toque este archivo.
export const TABLAS = {
    agendas: {
        label: 'Agendas',
        // Se aclara que la fila se abre porque el `div` de la fila no parece clicable (no es un
        // `<button>`) y desde acá se corrigen los estados mal cargados.
        ayuda: 'Las llamadas agendadas del período. Tocá una fila para abrir el lead.',
        cols: [
            { key: 'fecha', header: 'Reunión', width: '0.9fr' },
            { key: 'cliente', header: 'Cliente', width: '1.7fr' },
            { key: 'fuente', header: 'Fuente', width: '1fr' },
            { key: 'closer', header: 'Closer', width: '1fr' },
            { key: 'pre_call', header: 'Pre call', width: '1fr' },
            { key: 'post_call', header: 'Post call', width: '1.4fr' },
            { key: 'ver', header: '', width: '0.4fr' },
        ],
        facetas: [
            { key: 'estado', label: 'Estado', de: estadoDeAgenda },
            { key: 'pre_call', label: 'Pre call', de: (f) => f.pre_call.label },
            { key: 'post_call', label: 'Post call', de: (f) => f.post_call.label },
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
            { key: 'fuente', label: 'Fuente', de: (f) => f.fuente },
            { key: 'confirmada', label: 'Confirmada', de: fueConfirmada },
            { key: 'asistio', label: 'Asistió', de: asistio },
            { key: 'presento', label: 'Presentó', de: presento },
            { key: 'dia', label: 'Día de la reunión', de: (f) => diaDe(f.fecha), oculta: true },
        ],
        chips: [
            // "Vigentes" y no "Todas": el listado por defecto deja afuera a las descartadas.
            { key: 'todas', label: 'Vigentes', filtro: agendaEntraPorDefecto },
            { key: 'asistieron', label: 'Asistieron', filtro: (f) => f.asistio },
            { key: 'pendientes', label: 'Pendientes', filtro: (f) => f.post_call.key === 'pendiente' },
            { key: 'no_show', label: 'No show', filtro: (f) => f.post_call.key === 'no_show' },
            { key: 'descartadas', label: 'Descartadas', filtro: (f) => !!f.descartada },
        ],
        agrupables: [
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
            { key: 'fuente', label: 'Fuente', de: (f) => f.fuente },
            { key: 'estado', label: 'Estado', de: estadoDeAgenda },
        ],
    },
    ventas: {
        label: 'Ventas',
        // Se dice "cobradas" y no "cerradas" a propósito, porque son dos listas distintas y el
        // equipo las confunde. Lo que antes enumeraba el texto (programa, forma de pago, medio de
        // cobro) son las columnas de al lado: describirlas en el tooltip era repetir la pantalla.
        ayuda: 'Las ventas cobradas en el período.',
        // `orden` hace la columna ordenable (ver `ordenFilas.js`); `ordenLabel` es como se nombra en
        // el menú "Ordenar", donde el encabezado corto no alcanza para saber qué se ordena.
        cols: [
            COL_FECHA_VENTA,
            { key: 'cliente', header: 'Cliente', width: '1.9fr' },
            { key: 'programa', header: 'Programa', width: '1.3fr' },
            { key: 'tipo_pago', header: 'Pago', width: '1.1fr' },
            { key: 'monto', header: 'Monto', width: '1fr', orden: (f) => f.monto, ordenLabel: 'Monto' },
            { key: 'closer', header: 'Closer', width: '0.9fr' },
            COL_VER,
        ],
        // Las mismas filas con las columnas de la Academia (ver `academia.js`): el selector
        // "Venta · Academia" de la barra pasa de un juego al otro.
        vistaBase: 'Venta',
        colsAcademia: [
            COL_FECHA_VENTA,
            { key: 'cliente', header: 'Cliente', width: '1.7fr' },
            ...COLS_ACADEMIA,
            COL_VER,
        ],
        facetas: [
            { key: 'programa', label: 'Programa', de: (f) => f.programa },
            { key: 'tipo_pago', label: 'Tipo de pago', de: (f) => f.tipo_pago.label },
            { key: 'metodo', label: 'Método', de: (f) => f.metodo },
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
            // La fuente del cobro, la de «Ingresos por fuente» (ver `fuenteDe`). Su detalle (el vivo
            // o la grabación, cada setter) va aparte y oculto, como el día: el panel no sabe anidar
            // opciones dentro de otra, y existe para que un renglón del detalle de la tarjeta tenga
            // a dónde llevar.
            { key: 'fuente', label: 'Fuente', de: fuenteDe },
            { key: 'fuente_detalle', label: 'Detalle de la fuente', de: detalleFuenteDe, oculta: true },
            // El estado de la seña lo agrega el backend a la fila (`sena_estado`): en qué terminó
            // esa reserva, con la MISMA derivación con la que el panel Señas la cuenta. Viene la
            // clave (`pago_completo`…) y acá se traduce a la etiqueta, que es contra lo que se
            // compara el filtro. `null` en una fila que no es una seña: no lista una opción vacía.
            { key: 'sena_estado', label: 'Estado de la seña',
                de: (f) => (f.sena_estado
                    ? (f.sena_estado.label ?? SENA_ESTADO[f.sena_estado] ?? f.sena_estado)
                    : null) },
            ...FACETAS_ACADEMIA,
            { key: 'dia', label: 'Día del cobro', de: (f) => diaDe(f.fecha), oculta: true },
        ],
        chips: [
            { key: 'todas', label: 'Todas', filtro: () => true },
            { key: 'completo', label: 'Pago completo', filtro: (f) => f.tipo_pago.key === 'completo' },
            { key: 'parcial', label: 'Split Pay', filtro: (f) => f.tipo_pago.key === 'parcial' },
            CHIP_ACADEMIA,
        ],
        agrupables: [
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
            { key: 'programa', label: 'Programa', de: (f) => f.programa },
            { key: 'tipo_pago', label: 'Tipo de pago', de: (f) => f.tipo_pago.label },
            // El subtotal de cada grupo es el monto de esa fuente en la tarjeta: los mismos cobros,
            // en bruto.
            { key: 'fuente', label: 'Fuente', de: fuenteDe },
            AGRUPABLE_ACADEMIA,
        ],
    },
    leads: {
        label: 'Leads entrantes',
        // "Entraron en el período" es el dato que importa: la tabla NO es el inbox de hoy, es
        // quiénes llegaron en esas fechas, con el estado en que está hoy esa conversación.
        ayuda: 'Los leads que entraron al inbox en el período.',
        cols: [
            { key: 'fecha', header: 'Llegó', width: '0.9fr' },
            { key: 'cliente', header: 'Lead', width: '1.9fr' },
            { key: 'fuente', header: 'Fuente', width: '1fr' },
            { key: 'setter', header: 'Setter', width: '0.9fr' },
            { key: 'estado', header: 'Estado', width: '1.1fr' },
            { key: 'mensajes', header: 'Mensajes', width: '0.9fr' },
            { key: 'ver', header: '', width: '0.4fr' },
        ],
        facetas: [
            { key: 'estado', label: 'Estado', de: (f) => f.estado.label },
            { key: 'setter', label: 'Setter', de: (f) => f.setter },
            { key: 'respondio', label: 'Respondió', de: respondio },
            { key: 'cualificado', label: 'Cualificado', de: cualificado },
            { key: 'toques', label: 'Toques', de: toquesDe },
            { key: 'dia', label: 'Día de llegada', de: (f) => diaDe(f.fecha), oculta: true },
        ],
        chips: [
            { key: 'todos', label: 'Todos', filtro: () => true },
            { key: 'agendo', label: 'Agendaron', filtro: (f) => f.agendo },
            { key: 'sin_respuesta', label: 'Sin respuesta', filtro: (f) => !f.respondio },
        ],
        agrupables: [
            { key: 'setter', label: 'Setter', de: (f) => f.setter },
            { key: 'estado', label: 'Estado', de: (f) => f.estado.label },
        ],
    },
    clientes: {
        label: 'Clientes',
        // Las dos cosas que el texto corto tiene que salvar, y por qué:
        //
        //   · **No depende del período.** La cartera es un SALDO a hoy, no un flujo: acotarla al
        //     mes elegido dejaría afuera justamente a los que arrastran deuda de antes, que son
        //     los que hay que ir a cobrar. Es también el motivo de que la tabla tarde: pide todo.
        //   · **Su total no coincide con el "por cobrar" del panel Cash.** Acá la atribución es
        //     por quién VENDIÓ; en Cash, por quién tiene hoy la agenda del cliente — y Cash suma
        //     además saldos de clientes que nadie del equipo actual vendió. Ver los dos números
        //     distintos y pensar que uno está roto era la lectura equivocada más común.
        ayuda: 'Todos los clientes con venta, no solo los del período: la cartera es un saldo a '
            + 'hoy. Su total no coincide con el "por cobrar" de Cash, que atribuye por otra regla.',
        cols: [
            { key: 'cliente', header: 'Cliente', width: '1.7fr' },
            { key: 'programa', header: 'Programa', width: '1.2fr' },
            { key: 'closer', header: 'Closer', width: '1fr' },
            { key: 'pagado', header: 'Pagado', width: '0.8fr', orden: (f) => f.pagado, ordenLabel: 'Pagado' },
            { key: 'deuda', header: 'Debe', width: '0.8fr', orden: (f) => f.deuda, ordenLabel: 'Deuda' },
            { key: 'cuota', header: 'Próxima cuota', width: '1.3fr', orden: (f) => f.cuota_fecha,
                ordenLabel: 'Fecha de la próxima cuota' },
            COL_VER,
        ],
        // Pedido del 30/09/2026: encontrar a los alumnos que están cumpliendo con sus actividades
        // en la Academia. Mismas filas, otras columnas (ver `academia.js`).
        vistaBase: 'Cobro',
        colsAcademia: [
            // Sin `min`: se reparten lo que dejan las columnas de la Academia y cortan con «…» (el
            // nombre entero queda en el `title`). Con 0.8fr un closer de dos palabras no entraba.
            { key: 'cliente', header: 'Cliente', width: '1.6fr' },
            { key: 'closer', header: 'Closer', width: '1.1fr' },
            ...COLS_ACADEMIA,
            COL_VER,
        ],
        facetas: [
            { key: 'estado', label: 'Estado', de: (f) => f.estado.label },
            { key: 'programa', label: 'Programa', de: (f) => f.programa },
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
            ...FACETAS_ACADEMIA,
        ],
        // El filtro rápido recibe también las facetas activas (ver `entraPorDefecto`). "Vigentes"
        // y no "Todos": el listado por defecto deja afuera a los dados de baja. Tampoco "Activos",
        // que en esta misma lista se confundía con «Activos en la Academia» (otra cosa: estudian).
        chips: [
            { key: 'todos', label: 'Vigentes', filtro: entraPorDefecto },
            { key: 'con_deuda', label: 'Con deuda', filtro: (f) => f.deuda > 0.01 },
            { key: 'vencida', label: 'Cuota vencida', filtro: (f) => f.cuota_vencida },
            // Un dado de baja no debe, pero no terminó de pagar: no está al día.
            { key: 'al_dia', label: 'Al día', filtro: (f) => f.deuda <= 0.01 && !f.baja },
            { key: 'bajas', label: 'Dados de baja', filtro: (f) => !!f.baja },
            CHIP_ACADEMIA,
        ],
        agrupables: [
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
            { key: 'programa', label: 'Programa', de: (f) => f.programa },
            { key: 'estado', label: 'Estado', de: (f) => f.estado.label },
            AGRUPABLE_ACADEMIA,
        ],
    },
    generadas: {
        label: 'Agendas generadas',
        // Es la misma llamada que en `agendas`, contada del otro lado: acá el dueño de la fila es
        // el setter que la generó, no el closer que la atendió. Eso es lo único que el texto
        // necesita decir; el closer y el resultado están en sus columnas.
        ayuda: 'Las agendas que generó el equipo de setting, por la fecha en que se crearon. Un '
            + 'lead que reagendó aparece una vez, con su agenda más reciente.',
        cols: [
            { key: 'fecha', header: 'Reunión', width: '0.9fr' },
            { key: 'cliente', header: 'Lead', width: '1.8fr' },
            { key: 'setter', header: 'Setter', width: '0.9fr' },
            { key: 'closer', header: 'Closer', width: '0.9fr' },
            { key: 'pre_call', header: 'Pre call', width: '1fr' },
            { key: 'post_call', header: 'Post call', width: '1.4fr' },
            { key: 'ver', header: '', width: '0.4fr' },
        ],
        facetas: [
            { key: 'estado', label: 'Estado', de: estadoDeAgenda },
            { key: 'setter', label: 'Setter', de: (f) => f.setter },
            { key: 'pre_call', label: 'Pre call', de: (f) => f.pre_call.label },
            { key: 'post_call', label: 'Post call', de: (f) => f.post_call.label },
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
            { key: 'confirmada', label: 'Confirmada', de: fueConfirmada },
            { key: 'asistio', label: 'Asistió', de: asistio },
            { key: 'presento', label: 'Presentó', de: presento },
            // El día en que se RESERVÓ, no el de la reunión: es el eje de la serie "Agendas
            // generadas" de Variabilidad (ver `ComercialService.generadas`), y un día de esa serie
            // tiene que abrir las agendas que suma.
            { key: 'dia', label: 'Día de creación', de: (f) => diaDe(f.creada), oculta: true },
        ],
        chips: [
            // "Vigentes" y no "Todas": el listado por defecto deja afuera a las descartadas.
            { key: 'todas', label: 'Vigentes', filtro: agendaEntraPorDefecto },
            { key: 'asistieron', label: 'Asistieron', filtro: (f) => f.asistio },
            { key: 'pendientes', label: 'Pendientes', filtro: (f) => f.post_call.key === 'pendiente' },
            { key: 'descartadas', label: 'Descartadas', filtro: (f) => !!f.descartada },
        ],
        agrupables: [
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
            { key: 'setter', label: 'Setter', de: (f) => f.setter },
            { key: 'estado', label: 'Estado', de: estadoDeAgenda },
        ],
    },
};

/**
 * La dimensión que un equipo NO puede agruparse a sí mismo.
 *
 * Un closer ve solo sus propias filas (`alcance_de` le fija el alcance a él mismo, pida lo que
 * pida), así que "agrupar por closer" le arma un único grupo con todo adentro: ocupa lugar en el
 * menú y no reparte nada. Lo mismo con un setter y "agrupar por setter".
 *
 * No es al revés: un setter SÍ agrupa por closer —sus agendas generadas se reparten entre varios—
 * y la dirección conserva las dos, porque para ella sí reparten.
 */
export const DIMENSION_PROPIA = { closers: 'closer', setters: 'setter' };

export const TABLAS_POR_ROL = {
    // "Clientes" es la cartera: a quién le vendió y cómo va con los pagos. Es la única de las
    // cinco que NO se acota al período (ver `ComercialService.clientes`), y va tercera porque se
    // consulta cuando hay que cobrar, no cuando se revisa el día.
    closers: ['agendas', 'ventas', 'clientes'],
    setters: ['leads', 'generadas'],
};

/** Las claves de faceta de cada tabla. Es contra esto que se valida todo destino de una métrica. */
export const FACETAS_POR_TABLA = Object.fromEntries(
    Object.entries(TABLAS).map(([tabla, def]) => [tabla, def.facetas.map(f => f.key)]));

/** Las dos tablas de agendas comparten totales, columna de post call y el selector de fecha. */
export const esTablaDeAgendas = (tabla) => tabla === 'agendas' || tabla === 'generadas';

/**
 * ¿Este destino se puede aplicar tal como viene? Devuelve la lista de problemas, vacía si está
 * bien. Lo usan los tests del mapa métrica → filtro; en producción nadie lo llama.
 */
export const revisarDestino = (destino) => {
    const problemas = [];
    if (!destino || typeof destino !== 'object') return ['no es un objeto'];
    const def = TABLAS[destino.tabla];
    if (!def) {
        problemas.push(`tabla desconocida: ${destino.tabla}`);
        return problemas;
    }
    Object.keys(destino.filtro || {}).forEach(clave => {
        if (clave.startsWith('__')) return;
        if (!FACETAS_POR_TABLA[destino.tabla].includes(clave)) {
            problemas.push(`la tabla ${destino.tabla} no tiene la faceta "${clave}"`);
        }
    });
    if (!destino.de) problemas.push('falta `de`: la lista no diría de qué número viene');
    return problemas;
};
