import api from '../../../../services/api';
import { olvidarCache } from '../../../../services/cacheDeVistas';

// Lo que cambia anuncios o claves deja viejo lo recordado de todas las pestañas de Marketing.
const cambia = (r) => { olvidarCache('mk:'); return r.data; };

/** La API de la tabla de anuncios (ver `app/api/marketing_anuncios.py`). */

/** `config.base`: por qué fecha se cuentan las agendas (`alta` | `reunion`, ver `baseDeConteo`). */
export const pedirTablero = (desde, hasta, { base, ...config } = {}) =>
    api.get('/marketing/anuncios', { params: { desde, hasta, ...(base ? { base } : {}) }, ...config }).then((r) => r.data);

export const pedirAnunciosDeMeta = (desde, hasta, config = {}) =>
    api.get('/marketing/anuncios/meta', { params: { desde, hasta }, ...config }).then((r) => r.data);

/** `cuerpo`: { clave: 'APLICAR' } · { clave: null } (ninguna) · { automatico: true }. */
export const asignarClaveDeMeta = (metaAdId, cuerpo) =>
    api.put(`/marketing/anuncios/meta/${metaAdId}`, cuerpo).then(cambia);

/** Un tramo de `dias` que termina en `hasta` (AAAA-MM-DD; sin ella, hoy). Un tramo de 30 días tarda
 * ~30 s con la cuenta real, cerca de los 45 s del cliente: se le da el margen del servidor (120 s). */
export const sincronizarMeta = (dias, hasta) =>
    api.post('/marketing/anuncios/meta/sincronizar', { dias, hasta }, { timeout: 115000 }).then(cambia);

/** Lo que se cambió en el Administrador de anuncios (nombres, estados, campaña, conjunto) y el gasto de
 * los últimos días. Sin `forzar` el servidor no repite si se sincronizó hace unos minutos. */
export const sincronizarEstadoMeta = (forzar = false) =>
    api.post('/marketing/anuncios/meta/estado', { forzar }, { timeout: 60000 })
        .then((r) => (r.data?.omitido ? r.data : cambia(r)));

/** Rendimiento › Workshop: los anuncios de Workshop del período, por campaña › conjunto › anuncio. */
export const pedirWorkshopDelPeriodo = (desde, hasta, config = {}) =>
    api.get('/marketing/anuncios/embudos/workshop', { params: { desde, hasta }, ...config }).then((r) => r.data);

/** `cuerpo`: { embudo: 'setting' | 'workshop' | 'contratacion' | 'otro' } · { automatico: true }. El
 * gasto de los de 'workshop' es la inversión de cada taller. */
export const asignarEmbudoDeMeta = (metaAdId, cuerpo) =>
    api.put(`/marketing/anuncios/meta/${metaAdId}/embudo`, cuerpo).then(cambia);

/** Campaña y conjunto elegidos a mano; con `campana` null vuelve a la automática (Meta). */
export const agruparPalabraClave = (clave, campana, conjunto) =>
    api.post('/marketing/anuncios/agrupar', { clave, campana, conjunto }).then(cambia);

export const archivarPalabraClave = (clave, archivado) =>
    api.post('/marketing/anuncios/archivar', { clave, archivado }).then(cambia);

/** El mensaje de un error de la API, para un toast. */
export const mensajeDeError = (error, porDefecto) =>
    error?.response?.data?.error || error?.response?.data?.message || porDefecto;

/** La lista que suma una cifra de una fuente (`fuente`: setting | workshop | otras; `metrica`: ver
 *  fuentes_registros_service; `config.base`: la fecha por la que se cuentan las agendas). */
export const pedirRegistros = (fuente, metrica, desde, hasta, { base, ...config } = {}) =>
    api.get('/marketing/anuncios/registros', { params: { fuente, metrica, desde, hasta, ...(base ? { base } : {}) }, ...config })
        .then((r) => r.data);
