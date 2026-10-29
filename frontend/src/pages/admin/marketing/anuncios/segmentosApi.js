import api from '../../../../services/api';

/** El tablero de Marketing con la matriz por segmento (`por_segmento`), que cuesta unos segundos más: solo lo pide su vista. */
export const pedirSegmentos = (desde, hasta, config = {}) =>
    api.get('/marketing/anuncios', { params: { desde, hasta, segmentos: 1 }, ...config }).then((r) => r.data);
