import api from '../../../../services/api';

/** La API de la tabla de anuncios (ver `app/api/marketing_anuncios.py`). */

export const pedirTablero = (desde, hasta, config = {}) =>
    api.get('/marketing/anuncios', { params: { desde, hasta }, ...config }).then((r) => r.data);

export const pedirAnunciosDeMeta = (desde, hasta, config = {}) =>
    api.get('/marketing/anuncios/meta', { params: { desde, hasta }, ...config }).then((r) => r.data);

/** `cuerpo`: { clave: 'APLICAR' } · { clave: null } (ninguna) · { automatico: true }. */
export const asignarClaveDeMeta = (metaAdId, cuerpo) =>
    api.put(`/marketing/anuncios/meta/${metaAdId}`, cuerpo).then((r) => r.data);

export const sincronizarMeta = (dias) =>
    api.post('/marketing/anuncios/meta/sincronizar', { dias }).then((r) => r.data);

/** Campaña y conjunto elegidos a mano; con `campana` null vuelve a la automática (Meta). */
export const agruparPalabraClave = (clave, campana, conjunto) =>
    api.post('/marketing/anuncios/agrupar', { clave, campana, conjunto }).then((r) => r.data);

export const archivarPalabraClave = (clave, archivado) =>
    api.post('/marketing/anuncios/archivar', { clave, archivado }).then((r) => r.data);

/** El mensaje de un error de la API, para un toast. */
export const mensajeDeError = (error, porDefecto) =>
    error?.response?.data?.error || error?.response?.data?.message || porDefecto;
