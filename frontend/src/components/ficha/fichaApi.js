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
    reasignar_closer: (appt, p) => api.patch(`/ficha/${appt}/closer`, p),

    // Post-venta / cobro. Un pago es una escritura de venta: el único camino real
    // de una venta y de una cuota cobrada es el mismo (`SheetsService.post_to_sheets`).
    guardar_plan: (appt, p) => api.put(`/ficha/${appt}/plan-cuotas`, p),
    guardar_total: (appt, p) => api.patch(`/ficha/${appt}/total`, p),
    guardar_programa: (appt, p) => api.patch(`/ficha/${appt}/programa`, p),
    registrar_pago: (appt, p) => api.post(`/ficha/${appt}/venta`, p),
    registrar_seguimiento: (appt, p) => api.post(`/ficha/${appt}/seguimiento`, p),
    dar_de_baja: (appt, p) => api.post(`/ficha/${appt}/baja`, p),

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

export default { obtenerFicha, ejecutarAccion, ejecutarConsulta, ACCIONES, mensajeDeError };
