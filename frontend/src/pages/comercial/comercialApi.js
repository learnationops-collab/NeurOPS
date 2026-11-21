import api from '../../services/api';

/**
 * Llamadas del dashboard comercial.
 *
 * El alcance (de quién son los datos) lo decide SIEMPRE el backend a partir de la sesión: acá se
 * mandan `rol` y `miembro_id` como una preferencia, y para un closer o un setter simplemente se
 * ignoran. Por eso "Mis datos" no es una pantalla aparte — es este mismo módulo.
 */

/** Parámetros del header que comparten casi todos los endpoints. */
export const filtrosQuery = ({ period, compare, miembroId, rol, desde, hasta, vsDesde, vsHasta, segmento, pais }) => {
    const params = { period, compare, rol };
    if (segmento) params.segmento = segmento;
    if (pais) params.pais = pais;
    if (miembroId) params.miembro_id = miembroId;
    if (period === 'custom') {
        params.start_date = desde;
        params.end_date = hasta;
    }
    if (compare === 'custom') {
        params.compare_start = vsDesde;
        params.compare_end = vsHasta;
    }
    return params;
};

/**
 * GET con los filtros del header o, con el Filtro completo de Analizar puesto (`filtros.ids`, ADR-W190), POST con
 * las agendas que dejó pasar: los paneles y sus listas cuentan solo esas.
 */
const pedirFiltrado = (url, filtros, params, config = {}) => (filtros?.ids
    ? api.post(url, filtros.ids, { params, ...config })
    : api.get(url, { params, ...config })).then(r => r.data);

/** Agendas, show up, ventas y cash del período por país del lead. Siempre todos los países: el filtro `pais` no se manda. */
export const getPaises = (filtros, config = {}) =>
    pedirFiltrado('/comercial/paises', filtros, filtrosQuery({ ...filtros, pais: null }), config);

export const getContexto = () => api.get('/comercial/contexto').then(r => r.data);

/** `ids` (ADR-W190): `{agendas, agendas_previo}` que dejó pasar el Filtro completo; van por POST porque un
 *  período largo no entra en la URL. Sin `ids`, el resumen de siempre. */
export const getResumen = (filtros, ids = null) => (ids
    ? api.post('/comercial/resumen', ids, { params: filtrosQuery(filtros) })
    : api.get('/comercial/resumen', { params: filtrosQuery(filtros) })).then(r => r.data);

export const getComparativas = (filtros) =>
    api.get('/comercial/comparativas', { params: filtrosQuery(filtros) }).then(r => r.data);

/** Close rate real por closer: aparte de `getComparativas` porque pesa más (ver `useCloseReal`). */
export const getComparativasReales = (filtros) =>
    api.get('/comercial/comparativas/reales', { params: filtrosQuery(filtros) }).then(r => r.data);

/** Series por día de Variabilidad. Endpoint aparte: se pide solo al abrir la pestaña. */
export const getVariabilidad = (filtros) =>
    api.get('/comercial/variabilidad', { params: filtrosQuery(filtros) }).then(r => r.data);

/** Simulador: las sumas de las ventanas de la línea base (solo la dirección). Ver `comercial_simulador.py`. */
export const getSimuladorBase = () =>
    api.get('/comercial/simulador/base').then(r => r.data);

/** Proyección del resto del mes con el modelo que menos se equivocó en la prueba hacia atrás. */
export const getSimuladorTendencia = () =>
    api.get('/comercial/simulador/tendencia').then(r => r.data);

/**
 * Las filas de una tabla de Revisar. `operar` (10/10/2026) la pide para operar los registros: en
 * Ventas, el backend suma las no completadas, el estado y la agenda de cada venta. Solo le hace caso
 * a admin y operador (`ROLES_QUE_OPERAN`); a cualquier otro rol le devuelve lo de siempre.
 */
export const getTabla = (filtros, tabla, basis, { operar = false, previo = false } = {}) =>
    api.get('/comercial/tabla', {
        // `previo` (Agendas, ADR-W190): suma `filas_previo`, las del período comparado, para el Filtro de Analizar.
        params: { ...filtrosQuery(filtros), tabla, basis, ...(operar ? { operar: 1 } : {}), ...(previo ? { previo: 1 } : {}) },
    }).then(r => r.data);

/** «No cerradas» del panel Cierre: las agendas con show up sin venta ni seña, cada una con su
 *  objeción. Mismo período y alcance que el resumen; se pide recién al abrir su modal. */
export const getNoCerradas = (filtros) =>
    pedirFiltrado('/comercial/cierres/no-cerradas', filtros, filtrosQuery(filtros));

/** Corrige el pre call o el post call de una agenda. Devuelve el valor anterior, por si hay que
 *  deshacerlo desde la interfaz. «Reagendado», «No Show» y «Cancelado» llevan su `motivo` (ADR-W066). */
export const corregirAgenda = (id, campo, valor, motivo) =>
    api.patch(`/comercial/agendas/${id}`, { campo, valor, ...(motivo ? { motivo } : {}) }).then(r => r.data);

/** Cancela una agenda por ser una copia de otra. Devuelve el id de la que se conserva. */
export const marcarAgendaDuplicada = (id) =>
    api.post(`/comercial/agendas/${id}/duplicada`).then(r => r.data);

/** Corre un lote de fotos de la Academia (ver academy_snapshot_service). Solo la direccion: la ruta
 *  responde 403 al resto. Devuelve el resumen del lote, con `mensaje` listo para mostrar. */
export const sincronizarAcademia = () =>
    api.post('/comercial/academia/sincronizar').then(r => r.data);

/** Borra una agenda. Solo la direccion: la ruta responde 403 al resto (ver comercial.py). */
export const eliminarAgenda = (id) =>
    api.delete(`/comercial/agendas/${id}`).then(r => r.data);

export const getReporteHoy = (fecha) =>
    api.get('/comercial/reporte/hoy', { params: fecha ? { fecha } : {} }).then(r => r.data);

export const guardarReporte = (datos) => api.post('/comercial/reporte', datos).then(r => r.data);

export const getReportes = (miembroId) =>
    api.get('/comercial/reportes', { params: miembroId ? { miembro_id: miembroId } : {} })
        .then(r => r.data);

/** Constancia de carga de los últimos N días: por persona y por día, con su tasa. */
export const getConstancia = (dias, fecha) =>
    api.get('/comercial/reporte/constancia', { params: { dias, ...(fecha ? { fecha } : {}) } })
        .then(r => r.data);

/** Agendas del período por segmento A/B/C/D (el closer, show up y cierre; el setter, sus agendas), cortadas por `corte`
 *  (closer · setter · fuente · origen; sin él, todo junto) y con el VS del header como período comparado. El filtro de
 *  segmento (`filtros.segmento`) lo aplica el backend, también al total. */
/** Segmentos › corte «Respuesta» (ADR-W187): cuánto compra cada opción del formulario de agenda. No sigue el período. */
export const getSegmentosRespuestas = (config = {}) =>
    api.get('/comercial/segmentos/respuestas', config).then(r => r.data);

/** Quiénes eligieron una opción (solo la dirección). */
export const getRespuestasPersonas = (q, op, config = {}) =>
    api.get('/comercial/segmentos/respuestas/personas', { params: { q, op }, ...config }).then(r => r.data);

/** Analizar › Por qué compran y por qué no (ADR-W187): el cruce decide × invierte y las objeciones del período. */
export const getPorQueCompran = (filtros, config = {}) =>
    pedirFiltrado('/comercial/por-que-compran', filtros, filtrosQuery(filtros), config);

export const getSegmentos = (filtros, config = {}, corte = 'closer') =>
    pedirFiltrado('/comercial/segmentos', filtros, { ...filtrosQuery(filtros), corte }, config);

/** La lista detrás de una cifra de `getSegmentos`: `metrica` agendas · realizadas · asistieron · ventas · sin_reporte.
 *  `extra`: { corte, grupo } (la celda de un grupo) y `previo` (la del período comparado). */
export const getSegmentosRegistros = (filtros, metrica, segmento, config = {}, { corte, grupo, previo } = {}) =>
    pedirFiltrado('/comercial/segmentos/registros', filtros, {
        ...filtrosQuery({ ...filtros, segmento: null }), metrica, segmento, ...(corte ? { corte } : {}),
        ...(grupo !== undefined && grupo !== null ? { grupo } : {}), ...(previo ? { previo: 1 } : {}),
    }, config);

/** La lista detrás de una cifra de «Destino de las agendas» o de «Por llamada» (ADR-W144): `que` es un grupo del panel,
 *  un estado o una marca (agendas · base · asistieron · ventas); `llamada`, primera · segunda · momentum (sin ella, todas). */
export const getLlamadasRegistros = (filtros, que, llamada = null, config = {}, { previo } = {}) =>
    pedirFiltrado('/comercial/llamadas/registros', filtros,
        { ...filtrosQuery(filtros), que, ...(llamada ? { llamada } : {}), ...(previo ? { previo: 1 } : {}) }, config);
