import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { esFresco, guardarCache, leerCache } from '../../services/cacheDeVistas';

/**
 * Los pedidos del tablero comercial, por clave ('contexto', 'resumen', 'tabla'…).
 *
 * Solo la respuesta del ÚLTIMO pedido de cada clave llega a la pantalla: cambiar de filtro dispara
 * uno nuevo sin cancelar el anterior, y no vuelven en orden (90 días tarda más que un día). Si la
 * vieja llegaba después, pisaba los números con los de un período que ya no estaba elegido.
 *
 * `fallas[clave]` queda en true si el último pedido de esa clave falló, para que su bloque ofrezca
 * reintentar en vez de quedarse en el esqueleto para siempre. Se apaga al volver a pedir.
 */
export default function usePedidos() {
    const pedidos = useRef({});
    const [fallas, setFallas] = useState({});

    const pedir = useCallback((clave, promesa, poner, mensaje) => {
        const n = (pedidos.current[clave] || 0) + 1;
        pedidos.current[clave] = n;
        const vigente = () => pedidos.current[clave] === n;
        // Reintentar vuelve al esqueleto mientras espera: el aviso de la falla ya no es la verdad.
        setFallas(f => (f[clave] ? { ...f, [clave]: false } : f));
        return promesa
            .then((datos) => { if (vigente()) poner(datos); })
            .catch(() => {
                if (!vigente()) return;
                setFallas(f => ({ ...f, [clave]: true }));
                if (mensaje) toast.error(mensaje);
            });
    }, []);

    /**
     * Igual que `pedir`, pero recordando la respuesta (ver `cacheDeVistas`): ir y volver entre
     * secciones o pestañas no vuelve a pedir lo que ya se cargó.
     * - Fresco: se muestra lo recordado y no se pide nada.
     * - Viejo: se muestra lo recordado y se actualiza en silencio (sin esqueleto ni aviso).
     * - `forzar` (reintentar, o tras guardar algo): pide siempre.
     * `fabrica` devuelve la promesa; así no se manda el pedido cuando alcanza lo recordado.
     */
    const pedirCacheado = useCallback((clave, claveCache, fabrica, poner, mensaje, { forzar = false } = {}) => {
        const guardado = forzar ? null : leerCache(claveCache);
        const recuerdo = (datos) => guardarCache(claveCache, datos);
        if (!guardado) return pedir(clave, fabrica(), (d) => { recuerdo(d); poner(d); }, mensaje);
        // Lo recordado reemplaza a cualquier pedido de esta clave que siga en vuelo (otro filtro).
        pedidos.current[clave] = (pedidos.current[clave] || 0) + 1;
        setFallas(f => (f[clave] ? { ...f, [clave]: false } : f));
        poner(guardado.datos);
        if (esFresco(guardado)) return Promise.resolve();
        const n = pedidos.current[clave];
        return fabrica()
            .then((d) => { recuerdo(d); if (pedidos.current[clave] === n) poner(d); })
            .catch(() => { /* en silencio: lo recordado sigue a la vista */ });
    }, [pedir]);

    return { pedir, pedirCacheado, fallas };
}
