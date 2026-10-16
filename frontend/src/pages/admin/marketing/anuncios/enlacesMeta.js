/**
 * Ir de verdad al Administrador de anuncios de Meta (Kerwin, 16/10/2026: «el que dice ir a Meta Ads
 * tiene que llevar a Meta»). El token de la app es de solo lectura (`ads_read`): lo que se cambia —un
 * nombre, pausar, el presupuesto— se cambia allá, en otra pestaña.
 *
 * El enlace abre la lista del nivel pedido con esa campaña, conjunto o anuncio ya elegido
 * (`selected_*_ids`, como queda la URL cuando se tilda una fila allá): desde ahí se edita con un clic.
 * La cuenta publicitaria (`act=`) la manda el backend (`meta.cuentas`), no se escribe acá.
 */

const BASE = 'https://adsmanager.facebook.com/adsmanager/manage';
const RUTAS = { campana: 'campaigns', conjunto: 'adsets', anuncio: 'ads' };
const PARAMETROS = [
    ['campanas', 'selected_campaign_ids'],
    ['conjuntos', 'selected_adset_ids'],
    ['anuncios', 'selected_ad_ids'],
];

/** `ids`: { campanas: [...], conjuntos: [...], anuncios: [...] } (los que haya). Sin cuenta, null. */
export const enlaceAdministrador = (cuenta, nivel = 'campana', ids = {}) => {
    if (!cuenta) return null;
    const partes = [`act=${encodeURIComponent(String(cuenta).replace(/^act_/, ''))}`];
    PARAMETROS.forEach(([clave, parametro]) => {
        const lista = [...new Set([].concat(ids[clave] || []).filter(Boolean).map(String))];
        if (lista.length) partes.push(`${parametro}=${lista.map(encodeURIComponent).join(',')}`);
    });
    return `${BASE}/${RUTAS[nivel] || RUTAS.campana}?${partes.join('&')}`;
};
