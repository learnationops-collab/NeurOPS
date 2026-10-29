import api from '../../../../services/api';

/** La matriz de segmentos de Marketing (ver `app/api/marketing_anuncios.py`): `params` = { desde, hasta, corte, fuentes,
 *  segmento, comparar, comparar_desde, comparar_hasta }. Pide solo lo suyo (no el tablero entero). */
export const pedirSegmentos = (params, config = {}) =>
    api.get('/marketing/anuncios/segmentos', { params, ...config }).then((r) => r.data);

/** La lista detrás de una celda de la matriz: `params` = { desde, hasta, metrica, segmento, fuentes, corte, grupo }. El
 *  `segmento` va siempre (vacío = todos): es lo que le dice al backend que la lista trae la columna de segmento. */
export const pedirRegistrosSegmentos = (params, config = {}) =>
    api.get('/marketing/anuncios/registros', { params: { segmento: '', ...params }, ...config }).then((r) => r.data);
