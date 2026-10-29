import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEstadoGuardado } from './useEstadoGuardado';

/**
 * `useSearchParams` que además recuerda la última pestaña, período o vista (norma del 28/10/2026, ver
 * `useEstadoGuardado`). La URL manda: un link con `?tab=meta` abre ahí. Solo cuando se entra a la pantalla
 * SIN ninguno de los parámetros que se recuerdan (`claves`), se restauran los de la última vez, en la
 * misma URL, así se puede compartir.
 *
 *     const [params, setParams] = useParamsGuardados('mk_hub', ['tab', 'periodo', 'desde', 'hasta']);
 *
 * Devuelve lo mismo que `useSearchParams` y, de tercero, `restaurando`: true solo durante el primer render
 * si se están restaurando. Ya en ese render devuelve los parámetros restaurados, así no hay un parpadeo
 * con la pestaña de siempre; una pantalla cuyos hijos leen la URL por su cuenta no los pinta mientras
 * `restaurando` (`if (restaurando) return null`, después de todos sus hooks).
 *
 * Con VARIOS hooks en la misma pantalla, cada `setParams` parte de la URL que vio: por eso una pantalla
 * usa UNO solo, con todas las claves de su URL.
 */
export const useParamsGuardados = (clave, claves) => {
    const [params, setParams] = useSearchParams();
    const [guardado, poner] = useEstadoGuardado(clave, {});
    const lista = useRef(claves);
    const sinParams = !lista.current.some((k) => params.has(k));
    const hayGuardado = lista.current.some((k) => guardado[k]);
    // Se decide una sola vez, al entrar: después la URL es la fuente.
    const [restaurando, setRestaurando] = useState(() => sinParams && hayGuardado);

    const restaurados = useMemo(() => {
        const siguiente = new URLSearchParams(params);
        lista.current.forEach((k) => { if (guardado[k]) siguiente.set(k, guardado[k]); });
        return siguiente;
    }, [params, guardado]);

    // No en un efecto de layout: el router se suscribe a la URL después que sus hijos y no vería el cambio.
    const pendiente = useRef(null);
    useEffect(() => {
        if (!restaurando) return;
        pendiente.current = Object.fromEntries(lista.current.map((k) => [k, restaurados.get(k) || '']));
        setRestaurando(false);
        setParams(restaurados, { replace: true });
    }, [restaurando, restaurados, setParams]);

    // Cada cambio en la URL se guarda; la URL sin parámetros guarda «lo de siempre» (vacío).
    useEffect(() => {
        if (restaurando) return;
        const actual = Object.fromEntries(lista.current.map((k) => [k, params.get(k) || '']));
        // Hasta que la URL no refleje lo restaurado no se guarda nada: no se pisa lo de la última vez.
        if (pendiente.current) {
            if (lista.current.some((k) => actual[k] !== pendiente.current[k])) return;
            pendiente.current = null;
        }
        poner((previo) => (lista.current.some((k) => (previo[k] || '') !== actual[k]) ? actual : previo));
    }, [params, restaurando, poner]);

    const poner_ = useCallback((siguiente, opciones) => setParams(siguiente, opciones), [setParams]);
    return [restaurando ? restaurados : params, poner_, restaurando];
};

export default useParamsGuardados;
