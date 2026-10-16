import api from '../../../../services/api';

/** La API de la tabla de anuncios (ver `app/api/marketing_anuncios.py`). */

export const pedirTablero = (desde, hasta, config = {}) =>
    api.get('/marketing/anuncios', { params: { desde, hasta }, ...config }).then((r) => r.data);

export const pedirAnunciosDeMeta = (desde, hasta, config = {}) =>
    api.get('/marketing/anuncios/meta', { params: { desde, hasta }, ...config }).then((r) => r.data);

/** `cuerpo`: { clave: 'APLICAR' } · { clave: null } (ninguna) · { automatico: true }. */
export const asignarClaveDeMeta = (metaAdId, cuerpo) =>
    api.put(`/marketing/anuncios/meta/${metaAdId}`, cuerpo).then((r) => r.data);

/** Un tramo de `dias` que termina en `hasta` (AAAA-MM-DD; sin ella, hoy). Un tramo de 30 días tarda
 * ~30 s con la cuenta real, cerca de los 45 s del cliente: se le da el margen del servidor (120 s). */
export const sincronizarMeta = (dias, hasta) =>
    api.post('/marketing/anuncios/meta/sincronizar', { dias, hasta }, { timeout: 115000 }).then((r) => r.data);

/** Rendimiento › Workshop: los anuncios de Workshop del período, por campaña › conjunto › anuncio. */
export const pedirWorkshopDelPeriodo = (desde, hasta, config = {}) =>
    api.get('/marketing/anuncios/embudos/workshop', { params: { desde, hasta }, ...config }).then((r) => r.data);

/** `cuerpo`: { embudo: 'setting' | 'workshop' | 'contratacion' | 'otro' } · { automatico: true }. El
 * gasto de los de 'workshop' es la inversión de cada taller. */
export const asignarEmbudoDeMeta = (metaAdId, cuerpo) =>
    api.put(`/marketing/anuncios/meta/${metaAdId}/embudo`, cuerpo).then((r) => r.data);

/** Campaña y conjunto elegidos a mano; con `campana` null vuelve a la automática (Meta). */
export const agruparPalabraClave = (clave, campana, conjunto) =>
    api.post('/marketing/anuncios/agrupar', { clave, campana, conjunto }).then((r) => r.data);

export const archivarPalabraClave = (clave, archivado) =>
    api.post('/marketing/anuncios/archivar', { clave, archivado }).then((r) => r.data);

/** El mensaje de un error de la API, para un toast. */
export const mensajeDeError = (error, porDefecto) =>
    error?.response?.data?.error || error?.response?.data?.message || porDefecto;
