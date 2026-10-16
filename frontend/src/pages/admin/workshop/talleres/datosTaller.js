import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import { cuerpoDespublicar, cuerpoPublicar } from './formato';

/**
 * Lo que se pide al servidor por taller, con un recuerdo corto: la tarjeta pide sus anuncios al
 * abrir esa vista, y el detalle completo del mismo taller no los vuelve a pedir. Cinco minutos
 * alcanzan (Meta se sincroniza bastante menos seguido) y evitan una tormenta de pedidos al pasar
 * de tarjeta en tarjeta.
 */

const VIGENCIA_MS = 5 * 60 * 1000;
const recuerdo = new Map();

const fresco = (clave) => {
    const r = recuerdo.get(clave);
    return r && Date.now() - r.t < VIGENCIA_MS ? r.datos : null;
};

/** Para los tests (y por si algún día hace falta forzar). */
export const olvidarDatosTaller = () => recuerdo.clear();

const usePedido = (clave, url, activo) => {
    const [estado, setEstado] = useState(() => ({ datos: clave ? fresco(clave) : null, error: null }));

    useEffect(() => {
        if (!activo || !clave) return undefined;
        const ya = fresco(clave);
        if (ya) { setEstado({ datos: ya, error: null }); return undefined; }
        const control = new AbortController();
        setEstado({ datos: null, error: null });
        api.get(url, { signal: control.signal })
            .then((r) => {
                recuerdo.set(clave, { t: Date.now(), datos: r.data });
                setEstado({ datos: r.data, error: null });
            })
            .catch((e) => {
                if (e?.name !== 'CanceledError') setEstado({ datos: null, error: true });
            });
        return () => control.abort();
    }, [clave, url, activo]);

    return estado;
};

/** Los anuncios de Meta del taller (campaña › conjunto › anuncio), ver workshop_meta_service. */
export const useAnunciosTaller = (id, activo = true) =>
    usePedido(id ? `anuncios-${id}` : null, `workshop/events/${id}/anuncios`, activo);

/**
 * El embudo de la landing de la grabación en los días que estuvo publicada la de ESTE taller
 * (del día que se publicó al día que cerró, o a hoy). Por días: la landing mide por fecha.
 * `null` si nunca se publicó.
 */
export const ventanaGrabacion = (evento, hoy = new Date()) => {
    if (!evento?.replay_activo_desde || !evento?.replay_vence_hasta) return null;
    const desde = evento.replay_activo_desde.slice(0, 10);
    const hoyIso = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const vence = evento.replay_vence_hasta.slice(0, 10);
    const hasta = vence < hoyIso ? vence : hoyIso;
    if (desde > hoyIso) return null;
    return { desde, hasta };
};

export const useLandingTaller = (evento, activo = true) => {
    const v = ventanaGrabacion(evento);
    const clave = v ? `landing-${v.desde}-${v.hasta}` : null;
    return usePedido(clave, v ? `/workshop/landing/stats?desde=${v.desde}&hasta=${v.hasta}` : '', activo);
};

/**
 * Publicar / dejar de publicar la grabación de un taller en la landing. Lo usan el interruptor de la
 * tarjeta y el panel de la grabación. `onGuardado` refresca los talleres (el polling de la página).
 */
export const usePublicacion = (evento, onGuardado) => {
    const [guardando, setGuardando] = useState(null); // null | 'publicar' | 'despublicar' | 'otro'

    const guardar = useCallback(async (cuerpo, mensaje, modo = 'otro') => {
        if (!evento) return false;
        setGuardando(modo);
        try {
            await api.put(`workshop/events/${evento.id}`, cuerpo);
            toast.success(mensaje);
            if (onGuardado) await onGuardado();
            return true;
        } catch (err) {
            console.error('Error guardando la grabación del taller:', err);
            toast.error(err.response?.data?.error || 'No se pudo guardar');
            return false;
        } finally {
            setGuardando(null);
        }
    }, [evento, onGuardado]);

    const publicar = useCallback((opciones = {}) => {
        const horas = parseFloat(opciones.horas) || 48;
        return guardar(cuerpoPublicar(evento, { ...opciones, horas }),
            `Grabación publicada en la landing: se cierra en ${horas} horas`, 'publicar');
    }, [evento, guardar]);

    const despublicar = useCallback((estado) => guardar(cuerpoDespublicar(estado),
        'La grabación ya no se publica en la landing', 'despublicar'), [guardar]);

    return { guardar, publicar, despublicar, guardando };
};
