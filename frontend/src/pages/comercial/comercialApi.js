import api from '../../services/api';

/**
 * Llamadas del dashboard comercial.
 *
 * El alcance (de quién son los datos) lo decide SIEMPRE el backend a partir de la sesión: acá se
 * mandan `rol` y `miembro_id` como una preferencia, y para un closer o un setter simplemente se
 * ignoran. Por eso "Mis datos" no es una pantalla aparte — es este mismo módulo.
 */

/** Parámetros del header que comparten casi todos los endpoints. */
export const filtrosQuery = ({ period, compare, miembroId, rol, desde, hasta, vsDesde, vsHasta }) => {
    const params = { period, compare, rol };
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

export const getContexto = () => api.get('/comercial/contexto').then(r => r.data);

export const getResumen = (filtros) =>
    api.get('/comercial/resumen', { params: filtrosQuery(filtros) }).then(r => r.data);

export const getComparativas = (filtros) =>
    api.get('/comercial/comparativas', { params: filtrosQuery(filtros) }).then(r => r.data);

export const getTabla = (filtros, tabla, basis) =>
    api.get('/comercial/tabla', { params: { ...filtrosQuery(filtros), tabla, basis } }).then(r => r.data);

/** Corrige el pre call o el post call de una agenda. Devuelve el valor anterior, por si hay que
 *  deshacerlo desde la interfaz. */
export const corregirAgenda = (id, campo, valor) =>
    api.patch(`/comercial/agendas/${id}`, { campo, valor }).then(r => r.data);

export const getReporteHoy = (fecha) =>
    api.get('/comercial/reporte/hoy', { params: fecha ? { fecha } : {} }).then(r => r.data);

export const guardarReporte = (datos) => api.post('/comercial/reporte', datos).then(r => r.data);

export const getReportes = (miembroId) =>
    api.get('/comercial/reportes', { params: miembroId ? { miembro_id: miembroId } : {} })
        .then(r => r.data);
