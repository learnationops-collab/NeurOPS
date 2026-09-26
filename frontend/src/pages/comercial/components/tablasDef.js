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
    return fila.retraso_dias > 0 ? 'Sin reporte' : 'Aún no ocurrió';
};

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
};

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

// Definición de cada tabla: columnas, facetas y filtros rápidos. Una sola fuente para las cinco.
export const TABLAS = {
    agendas: {
        label: 'Agendas',
        ayuda: 'Todas las llamadas agendadas del período. Tocá una fila para abrir el recorrido '
            + 'del lead y, si hace falta, corregir su estado.',
        cols: [
            { key: 'fecha', header: 'Reunión', width: '0.9fr' },
            { key: 'cliente', header: 'Cliente', width: '1.8fr' },
            { key: 'fuente', header: 'Fuente', width: '1fr' },
            { key: 'closer', header: 'Closer', width: '0.8fr' },
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
            { key: 'todas', label: 'Todas', filtro: () => true },
            { key: 'asistieron', label: 'Asistieron', filtro: (f) => f.asistio },
            { key: 'pendientes', label: 'Pendientes', filtro: (f) => f.post_call.key === 'pendiente' },
            { key: 'no_show', label: 'No show', filtro: (f) => f.post_call.key === 'no_show' },
        ],
        agrupables: [
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
            { key: 'fuente', label: 'Fuente', de: (f) => f.fuente },
            { key: 'estado', label: 'Estado', de: estadoDeAgenda },
        ],
    },
    ventas: {
        label: 'Ventas',
        ayuda: 'Las ventas cobradas en el período, con su programa, forma de pago y medio de cobro.',
        cols: [
            { key: 'fecha', header: 'Venta', width: '0.8fr' },
            { key: 'cliente', header: 'Cliente', width: '1.9fr' },
            { key: 'programa', header: 'Programa', width: '1.3fr' },
            { key: 'tipo_pago', header: 'Pago', width: '1.1fr' },
            { key: 'monto', header: 'Monto', width: '1fr' },
            { key: 'closer', header: 'Closer', width: '0.9fr' },
            { key: 'ver', header: '', width: '0.4fr' },
        ],
        facetas: [
            { key: 'programa', label: 'Programa', de: (f) => f.programa },
            { key: 'tipo_pago', label: 'Tipo de pago', de: (f) => f.tipo_pago.label },
            { key: 'metodo', label: 'Método', de: (f) => f.metodo },
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
            // El estado de la seña lo agrega el backend a la fila (`sena_estado`): en qué terminó
            // esa reserva, con la MISMA derivación con la que el panel Señas la cuenta. Viene la
            // clave (`pago_completo`…) y acá se traduce a la etiqueta, que es contra lo que se
            // compara el filtro. `null` en una fila que no es una seña: no lista una opción vacía.
            { key: 'sena_estado', label: 'Estado de la seña',
                de: (f) => (f.sena_estado
                    ? (f.sena_estado.label ?? SENA_ESTADO[f.sena_estado] ?? f.sena_estado)
                    : null) },
            { key: 'dia', label: 'Día del cobro', de: (f) => diaDe(f.fecha), oculta: true },
        ],
        chips: [
            { key: 'todas', label: 'Todas', filtro: () => true },
            { key: 'completo', label: 'Pago completo', filtro: (f) => f.tipo_pago.key === 'completo' },
            { key: 'parcial', label: 'Split Pay', filtro: (f) => f.tipo_pago.key === 'parcial' },
        ],
        agrupables: [
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
            { key: 'programa', label: 'Programa', de: (f) => f.programa },
            { key: 'tipo_pago', label: 'Tipo de pago', de: (f) => f.tipo_pago.label },
        ],
    },
    leads: {
        label: 'Leads entrantes',
        ayuda: 'Los leads nuevos que entraron al inbox en el período, con su estado de conversación.',
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
        ayuda: 'Cada cliente que el equipo ya vendió, con lo que pagó, lo que debe y su próxima '
            + 'cuota. NO depende del período: la cartera es un saldo a hoy, no un flujo — acotarla '
            + 'al mes dejaría afuera justamente a los que arrastran deuda de antes. La atribución '
            + 'es por quién VENDIÓ, así que su deuda no es la misma cifra que el "por cobrar" del '
            + 'panel Cash, que cuenta por quién tiene hoy la agenda del cliente — y que además '
            + 'incluye saldos de clientes que nadie del equipo actual vendió.',
        cols: [
            { key: 'cliente', header: 'Cliente', width: '1.7fr' },
            { key: 'programa', header: 'Programa', width: '1.2fr' },
            { key: 'closer', header: 'Vendió', width: '0.8fr' },
            { key: 'pagado', header: 'Pagado', width: '0.8fr' },
            { key: 'deuda', header: 'Debe', width: '0.8fr' },
            { key: 'cuota', header: 'Próxima cuota', width: '1.3fr' },
            { key: 'ver', header: '', width: '0.4fr' },
        ],
        facetas: [
            { key: 'estado', label: 'Estado', de: (f) => f.estado.label },
            { key: 'programa', label: 'Programa', de: (f) => f.programa },
            { key: 'closer', label: 'Vendió', de: (f) => f.closer },
        ],
        chips: [
            { key: 'todos', label: 'Todos', filtro: () => true },
            { key: 'con_deuda', label: 'Con deuda', filtro: (f) => f.deuda > 0.01 },
            { key: 'vencida', label: 'Cuota vencida', filtro: (f) => f.cuota_vencida },
            { key: 'al_dia', label: 'Al día', filtro: (f) => f.deuda <= 0.01 },
        ],
        agrupables: [
            { key: 'closer', label: 'Vendió', de: (f) => f.closer },
            { key: 'programa', label: 'Programa', de: (f) => f.programa },
            { key: 'estado', label: 'Estado', de: (f) => f.estado.label },
        ],
    },
    generadas: {
        label: 'Agendas generadas',
        ayuda: 'Las agendas que generó el equipo de setting, con el closer asignado y cómo '
            + 'terminó la llamada.',
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
            { key: 'dia', label: 'Día de la reunión', de: (f) => diaDe(f.fecha), oculta: true },
        ],
        chips: [
            { key: 'todas', label: 'Todas', filtro: () => true },
            { key: 'asistieron', label: 'Asistieron', filtro: (f) => f.asistio },
            { key: 'pendientes', label: 'Pendientes', filtro: (f) => f.post_call.key === 'pendiente' },
        ],
        agrupables: [
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
            { key: 'setter', label: 'Setter', de: (f) => f.setter },
            { key: 'estado', label: 'Estado', de: estadoDeAgenda },
        ],
    },
};

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
