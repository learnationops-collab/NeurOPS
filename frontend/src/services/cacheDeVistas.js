import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Recuerdo en memoria de lo que ya se pidió, para que ir y volver entre pestañas o vistas no vuelva
 * a cargar todo (Kerwin, 19/10/2026). Vive mientras no se recargue la página.
 *
 * - Fresco (menos de VIGENCIA_MS): se muestra y no se pide nada.
 * - Viejo: se muestra igual y se actualiza en silencio, sin esqueleto.
 * - «Recargar» (`version` > 0 que cambia) siempre pide.
 * Se vacía al cambiar de usuario o de rol (AuthContext).
 */

export const VIGENCIA_MS = 5 * 60 * 1000;
const almacen = new Map();

export const leerCache = (clave) => almacen.get(clave);
export const guardarCache = (clave, datos) => { almacen.set(clave, { datos, t: Date.now() }); };
export const limpiarCache = () => almacen.clear();
/** Lo que empieza con `prefijo` (ej. tras guardar algo que cambia esa vista). */
export const olvidarCache = (prefijo) => {
    [...almacen.keys()].forEach((k) => { if (k.startsWith(prefijo)) almacen.delete(k); });
};

export const esFresco = (r) => Boolean(r) && Date.now() - r.t < VIGENCIA_MS;

/**
 * `pedir(signal)` devuelve una promesa con los datos. `clave` null = no pedir todavía.
 * Devuelve `{ datos, error, cargando, setDatos }`; `setDatos` también actualiza el recuerdo.
 */
export function useDatosCacheados(clave, pedir, { version = 0, onError } = {}) {
    const [estado, setEstado] = useState(() => ({ clave, datos: clave ? leerCache(clave)?.datos ?? null : null, error: null }));
    const [cargando, setCargando] = useState(false);
    const pedirRef = useRef(pedir);
    const onErrorRef = useRef(onError);
    // Antes que el efecto del pedido: siempre usa la última función.
    useEffect(() => { pedirRef.current = pedir; onErrorRef.current = onError; });
    const versionVista = useRef(version);

    useEffect(() => {
        if (!clave) return undefined;
        const forzar = version !== versionVista.current;
        versionVista.current = version;
        const guardado = leerCache(clave);
        if (!forzar && esFresco(guardado)) return undefined;
        const control = new AbortController();
        // La actualización de algo viejo va en silencio: sin atenuar ni esqueleto.
        setCargando(forzar || !guardado);
        Promise.resolve(pedirRef.current(control.signal))
            .then((d) => {
                if (control.signal.aborted) return;
                guardarCache(clave, d);
                setEstado({ clave, datos: d, error: null });
            })
            .catch((e) => {
                if (e?.name === 'CanceledError' || control.signal.aborted) return;
                setEstado((prev) => ({ clave, datos: prev.clave === clave ? prev.datos : guardado?.datos ?? null, error: e }));
                onErrorRef.current?.(e);
            })
            .finally(() => { if (!control.signal.aborted) setCargando(false); });
        return () => { control.abort(); setCargando(false); };
    }, [clave, version]);

    // Otra clave (otro período) que todavía no llegó: se ve lo recordado de esa clave o el esqueleto.
    const vigente = estado.clave === clave;
    const datos = vigente ? estado.datos : (clave ? leerCache(clave)?.datos ?? null : null);

    const setDatos = useCallback((cambio) => setEstado((prev) => {
        const antes = prev.clave === clave ? prev.datos : leerCache(clave)?.datos ?? null;
        const actual = typeof cambio === 'function' ? cambio(antes) : cambio;
        if (clave) guardarCache(clave, actual);
        return { clave, datos: actual, error: null };
    }), [clave]);

    return { datos, error: vigente ? estado.error : null, cargando, setDatos };
}
