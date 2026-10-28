import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSession } from '../utils/sessionStore';

/**
 * Norma «cada vista recuerda lo último que usó» (Kerwin, 28/10/2026): filtros, orden, modo, vistas de
 * columnas. Un estado de React que se restaura al volver y se guarda solo.
 *
 * Es una comodidad de lectura, no un dato del negocio: va a `localStorage` y es POR USUARIO (la clave lleva
 * el id de quien tiene la sesión), no por navegador; en una compu compartida o simulando a otra persona,
 * cada cual ve lo suyo. Para lo que vive en la URL (pestaña, período) ver `useParamsGuardados`.
 *
 *     const [filtros, poner, restablecer] = useEstadoGuardado('mk_rendimiento_filtros', INICIAL);
 *     poner({ busqueda: 'guía' });           // mezcla con lo que había
 *     poner((previo) => ({ ...previo }));    // o una función pura: lo guardado se escribe en un efecto
 *
 * Reglas:
 *  - El valor es un objeto plano y serializable (los `Set` pasan a arrays antes de entrar).
 *  - Lo leído se mezcla sobre `inicial`: un campo nuevo del código aparece con su valor de siempre.
 *  - `normalizar(mezclado, inicial, guardado)` (opcional) limpia lo guardado por otra versión.
 *  - `heredar` (opcional): clave vieja por navegador de la que se toma el valor la primera vez.
 *  - Sin almacenamiento (ventana privada) la vista anda igual; solo se olvida al recargar.
 */

export const claveDeUsuario = (clave) => {
    let id = 'anonimo';
    try {
        id = loadSession()?.id ?? 'anonimo';
    } catch {
        // Sin sesión legible se usa la clave sin usuario.
    }
    return `neurops:${id}:${clave}`;
};

const leer = (clave) => {
    try {
        const crudo = window.localStorage.getItem(clave);
        const valor = crudo ? JSON.parse(crudo) : null;
        return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : null;
    } catch {
        return null;
    }
};

const escribir = (clave, valor) => {
    try {
        window.localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
        // Sin almacenamiento no se recuerda; la vista sigue andando.
    }
};

const restaurar = (clave, inicial, { normalizar, heredar }) => {
    const guardado = leer(clave) ?? (heredar ? leer(heredar) : null);
    if (!guardado) return inicial;
    const mezclado = { ...inicial, ...guardado };
    return normalizar ? normalizar(mezclado, inicial, guardado) : mezclado;
};

export const useEstadoGuardado = (clave, inicial, opciones = {}) => {
    const claveFinal = claveDeUsuario(clave);
    const ref = useRef({ inicial, opciones });
    ref.current = { inicial, opciones };
    const [estado, setEstado] = useState(() => restaurar(claveFinal, inicial, opciones));
    // La clave sale de la sesión: si cambia (otra identidad), se vuelve a leer lo de esa persona.
    const claveLeida = useRef(claveFinal);
    useEffect(() => {
        if (claveLeida.current === claveFinal) return;
        claveLeida.current = claveFinal;
        setEstado(restaurar(claveFinal, ref.current.inicial, ref.current.opciones));
    }, [claveFinal]);

    // Se escribe en un efecto y no dentro del updater de setState: React puede correr un updater dos veces.
    const primera = useRef(true);
    useEffect(() => {
        if (primera.current) { primera.current = false; return; }
        escribir(claveFinal, estado);
    }, [estado, claveFinal]);

    const poner = useCallback((cambio) => setEstado((previo) => {
        const nuevo = typeof cambio === 'function' ? cambio(previo) : cambio;
        if (!nuevo || typeof nuevo !== 'object') return previo;
        const mezclado = { ...previo, ...nuevo };
        // Sin cambios no se vuelve a pintar ni a escribir.
        return Object.keys(mezclado).every((k) => Object.is(mezclado[k], previo[k])) ? previo : mezclado;
    }), []);
    const restablecer = useCallback(() => setEstado(ref.current.inicial), []);

    return [estado, poner, restablecer];
};

export default useEstadoGuardado;
