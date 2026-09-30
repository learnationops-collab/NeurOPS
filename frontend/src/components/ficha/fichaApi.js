import api from '../../services/api';

/**
 * Todas las llamadas HTTP de la ficha, en un solo lugar.
 *
 * Las pestañas NUNCA llaman `fetch`/`axios`: reciben `onAccion(nombre, payload)` y
 * el cascarón lo resuelve acá. Así hay un único sitio donde está escrito qué ruta
 * corresponde a cada acción, y agregar una acción no obliga a tocar cuatro pestañas.
 *
 * El blueprint `/api/ficha` lo está escribiendo otro agente: las rutas de abajo son
 * las de §12 de la especificación, ni una inventada. Si el endpoint todavía no
 * existe, cada llamada falla con 404 y el modal lo muestra como error — que es
 * exactamente lo que tiene que pasar.
 */

/** Lectura. Al menos uno de los dos ids; `client_id` sin agenda la resuelve el servidor. */
export const obtenerFicha = ({ appointmentId = null, clientId = null, signal } = {}) => {
    const params = {};
    if (appointmentId != null) params.appointment_id = appointmentId;
    if (clientId != null) params.client_id = clientId;
    return api.get('/ficha/lead', { params, signal }).then(r => r.data);
};

/**
 * Mapa acción → petición. La clave es el nombre que usan las pestañas; el valor
 * recibe `(appt, payload)`.
 *
 * Las tres acciones de confirmación comparten ruta porque comparten la lógica del
 * `POST /closer/deck/<id>` que hay detrás: son parches parciales del mismo bloque.
 */
const RUTAS = {
    // Confirmación — PATCH parcial del bloque `confirmacion`.
    etapa_confirmacion: (appt, p) => api.patch(`/ficha/${appt}/confirmacion`, p),
    como_viene: (appt, p) => api.patch(`/ficha/${appt}/confirmacion`, p),
    dolores: (appt, p) => api.patch(`/ficha/${appt}/confirmacion`, p),
    nota_llamada: (appt, p) => api.patch(`/ficha/${appt}/confirmacion`, p),
    recordatorio_previo: (appt, p) => api.patch(`/ficha/${appt}/confirmacion`, p),
    cerrar_confirmacion: (appt, p) => api.patch(`/ficha/${appt}/confirmacion`, { cerrada: true, ...p }),

    // Resultado de la llamada y venta.
    reportar_resultado: (appt, p) => api.post(`/ficha/${appt}/resultado`, p),
    registrar_venta: (appt, p) => api.post(`/ficha/${appt}/venta`, p),

    // Agenda.
    reprogramar: (appt, p) => api.post(`/ficha/${appt}/reprogramar`, p),
    // Cancelar no es descartar: la cita no se hace pero el lead sigue en el embudo.
    cancelar: (appt, p) => api.post(`/ficha/${appt}/cancelar`, p),
    descartar: (appt, p) => api.post(`/ficha/${appt}/descartar`, p),
    eliminar: (appt) => api.delete(`/ficha/${appt}`),
    // La misma puerta que `eliminar`, apuntada a una agenda del historial y no al lead entero:
    // la ficha sigue abierta en la agenda que le quede al cliente (ver FichaLeadModal).
    eliminar_agenda: (appt) => api.delete(`/ficha/${appt}`),
    reasignar_closer: (appt, p) => api.patch(`/ficha/${appt}/closer`, p),
    // Los datos del cliente (nombre, teléfono, correo, instagram) y el examen de la agenda,
    // corregidos en el lugar desde la cabecera. Viaja solo lo que cambió.
    editar_datos: (appt, p) => api.patch(`/ficha/${appt}/datos`, p),
    // Las dos del historial. `estado_agenda` corrige el pre/post call de CUALQUIER agenda del
    // cliente, no solo la que la ficha tiene abierta: el id viaja en la URL (ver `onAccion`).
    estado_agenda: (appt, p) => api.patch(`/ficha/${appt}/estado`, p),
    crear_agenda: (appt, p) => api.post(`/ficha/${appt}/agenda`, p),
    // La fecha (instante UTC), la fuente y/o el closer de CUALQUIER agenda del cliente; solo
    // viaja lo que cambió.
    editar_agenda: (appt, p) => api.patch(`/ficha/${appt}/agenda`, p),
    // El seguimiento de CUALQUIER agenda del cliente: un seguimiento vive en su agenda, así que el
    // id que viaja es el de esa agenda. Agendar (`PUT`) lo crea o reemplaza el que tenga; corregir
    // (`PATCH`) cambia su estado (`realizado`), su día, su tipo y/o su nota. No son el `POST` de
    // `registrar_seguimiento`, el seguimiento de cobro de Acciones.
    agendar_seguimiento: (appt, p) => api.put(`/ficha/${appt}/seguimiento`, p),
    corregir_seguimiento: (appt, p) => api.patch(`/ficha/${appt}/seguimiento`, p),
    borrar_seguimiento: (appt) => api.delete(`/ficha/${appt}/seguimiento`),
    // El plan entero del cliente; lo cobrado en Pagos no se toca.
    borrar_plan: (appt) => api.delete(`/ficha/${appt}/plan-cuotas`),
    crear_evento: (appt, p) => api.post(`/ficha/${appt}/evento`, { detalle: p.detalle }),
    // El id del evento va en la URL: `editar_evento` y `borrar_evento` lo sacan del payload.
    editar_evento: (appt, p) => api.patch(`/ficha/${appt}/evento/${p.evento_id}`, { detalle: p.detalle }),
    borrar_evento: (appt, p) => api.delete(`/ficha/${appt}/evento/${p.evento_id}`),

    // Post-venta / cobro. Un pago es una escritura de venta: el único camino real
    // de una venta y de una cuota cobrada es el mismo (`SheetsService.post_to_sheets`).
    guardar_plan: (appt, p) => api.put(`/ficha/${appt}/plan-cuotas`, p),
    guardar_total: (appt, p) => api.patch(`/ficha/${appt}/total`, p),
    guardar_programa: (appt, p) => api.patch(`/ficha/${appt}/programa`, p),
    registrar_pago: (appt, p) => api.post(`/ficha/${appt}/venta`, p),
    // La corrección a mano de un pago desde el historial: NO es `registrar_pago`, que declara una
    // venta y dispara todo lo que una venta implica. Estas corrigen el registro y nada más. El id
    // del pago va en la URL y no viaja en el cuerpo.
    agregar_pago: (appt, p) => api.post(`/ficha/${appt}/pago`, p),
    corregir_pago: (appt, { pago_id: pagoId, ...cambios }) => api.patch(`/ficha/${appt}/pago/${pagoId}`, cambios),
    borrar_pago: (appt, p) => api.delete(`/ficha/${appt}/pago/${p.pago_id}`),
    registrar_seguimiento: (appt, p) => api.post(`/ficha/${appt}/seguimiento`, p),
    dar_de_baja: (appt, p) => api.post(`/ficha/${appt}/baja`, p),
    // Deshace la baja: el cliente vuelve a deber y a las listas de cobro. No lleva cuerpo.
    revertir_baja: (appt) => api.post(`/ficha/${appt}/revertir-baja`, {}),
    // El acceso a la Academia, desde Fulfillment: dar o renovar hasta `vence` (+ `email` si
    // todavía no es alumno), y quitar (vence hoy; pide `confirmo: true`). Ver `ficha_academia.py`.
    acceso_academia: (appt, p) => api.post(`/ficha/${appt}/academia/acceso`, p),
    quitar_acceso_academia: (appt, p) => api.post(`/ficha/${appt}/academia/quitar`, p),

    // Comunicación.
    enviar_nota: (appt, p) => api.post(`/ficha/${appt}/nota`, p),
};

/**
 * Mapa consulta → petición: lo mismo que `RUTAS` pero para LEER.
 *
 * Existe aparte porque una lectura no puede pasar por `onAccion`: el cascarón recarga la ficha
 * entera y deja un aviso después de cada acción, que es lo correcto para una escritura y absurdo
 * para traer datos. Las pestañas siguen sin llamar `axios`: reciben `onConsultar`.
 */
const CONSULTAS = {
    // Cómo le va al alumno en la Academia. No viaja en `GET /ficha/lead` porque es una llamada a
    // otro sistema: si fallara, se caería la ficha entera en vez de una pestaña.
    fulfillment: (appt) => api.get(`/ficha/${appt}/fulfillment`),
    // Cómo viene pagando el cliente el programa que se le está vendiendo (`{params: {programa}}`):
    // lo que ya pagó, lo que debe y qué tipos de pago siguen la secuencia. Depende del programa
    // que se elige en medio de la venta, por eso no viaja en la ficha.
    estado_venta: (appt, config) => api.get(`/ficha/${appt}/estado-venta`, config),
};

export const ACCIONES = Object.keys(RUTAS);

/**
 * Ejecuta una acción. Lanza si el nombre no está en el mapa: un typo en una pestaña
 * tiene que explotar en desarrollo, no quedar en un `no-op` silencioso que parece
 * un backend caído.
 */
export const ejecutarAccion = (nombre, appointmentId, payload = {}) => {
    const fn = RUTAS[nombre];
    if (!fn) throw new Error(`Acción de ficha desconocida: ${nombre}`);
    if (appointmentId == null) throw new Error(`La acción "${nombre}" necesita una agenda`);
    return Promise.resolve(fn(appointmentId, payload)).then(r => r?.data ?? null);
};

/** Ejecuta una consulta. Mismo trato que `ejecutarAccion` con un nombre desconocido. */
export const ejecutarConsulta = (nombre, appointmentId, config = {}) => {
    const fn = CONSULTAS[nombre];
    if (!fn) throw new Error(`Consulta de ficha desconocida: ${nombre}`);
    if (appointmentId == null) throw new Error(`La consulta "${nombre}" necesita una agenda`);
    return Promise.resolve(fn(appointmentId, config)).then(r => r?.data ?? null);
};

/** Mensaje de error legible: el `detail` del backend gana sobre el texto de axios. */
export const mensajeDeError = (err) => err?.response?.data?.message
    || err?.response?.data?.error
    || err?.message
    || 'No se pudo completar la acción';

/**
 * La agenda en la que declarar una venta de este cliente: la suya más reciente o, si no tiene
 * ninguna, una que se crea para la venta. Es la entrada de «Declarar venta» del dock, que antes
 * era una página aparte (`/closer/sales/new`). Devuelve `{appointment_id, creada}`.
 */
export const agendaParaVender = (clientId) => api
    .post(`/ficha/cliente/${clientId}/agenda-de-venta`).then(r => r.data);

/**
 * Lo mismo para alguien que el buscador no encontró: lo crea (o, si ya estaba con ese email,
 * Instagram o teléfono, usa el suyo) y da su agenda de venta.
 * Devuelve `{appointment_id, client_id, nombre, nuevo}`.
 */
export const clienteNuevoParaVender = (datos) => api
    .post('/ficha/cliente-nuevo/agenda-de-venta', datos).then(r => r.data);

export default {
    obtenerFicha, ejecutarAccion, ejecutarConsulta, agendaParaVender, clienteNuevoParaVender,
    ACCIONES, mensajeDeError,
};
