import { useEffect, useRef } from 'react';

/**
 * Ir de verdad al Administrador de anuncios de Meta (Kerwin, 16/10/2026: «el que dice ir a Meta Ads
 * tiene que llevar a Meta»). El token de la app es de solo lectura (`ads_read`): lo que se cambia —un
 * nombre, pausar, el presupuesto— se cambia allá, en otra pestaña, y al volver la pantalla trae lo
 * nuevo sola (`useVueltaDeMeta`).
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

// La última vez que alguien abrió Meta desde la pantalla (en esta pestaña del navegador).
let idaAMeta = 0;
export const marcarIdaAMeta = () => { idaAMeta = Date.now(); };

/** Al volver a la pestaña (o a la ventana) después de haber abierto Meta, llama a `alVolver`, con un
 * mínimo de `minutos` entre una vez y la siguiente. */
export const useVueltaDeMeta = (alVolver, { activo = true, minutos = 1 } = {}) => {
    const callback = useRef(alVolver);
    useEffect(() => { callback.current = alVolver; }, [alVolver]);
    const ultima = useRef(0);

    useEffect(() => {
        if (!activo) return undefined;
        const revisar = () => {
            if (document.visibilityState === 'hidden') return;
            if (!idaAMeta || idaAMeta <= ultima.current) return;
            if (Date.now() - ultima.current < minutos * 60000) return;
            ultima.current = Date.now();
            callback.current();
        };
        document.addEventListener('visibilitychange', revisar);
        window.addEventListener('focus', revisar);
        return () => {
            document.removeEventListener('visibilitychange', revisar);
            window.removeEventListener('focus', revisar);
        };
    }, [activo, minutos]);
};
