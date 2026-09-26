import { useCallback, useEffect, useState } from 'react';

/**
 * El control de dos posiciones lista / tarjetas, que recuerda la elección.
 *
 * Sigue el patrón que ya usaba `closer/leads/LeagsPage.jsx` con la clave `closer_view_mode`: la
 * preferencia va a `localStorage`, es por persona y por navegador, y no se sincroniza con nada. Es
 * exactamente el tipo de dato que corresponde ahí — una comodidad de lectura, no un estado del
 * negocio.
 *
 * Hay tres implementaciones sueltas de esto en el repo (el panel de workshop, la bandeja de leads
 * del closer y el dashboard de anuncios) y ninguna compartida. Esta es la compartida.
 *
 * ## Por qué cada acceso va en try/catch
 *
 * `localStorage` tira excepción —no devuelve null— en una ventana privada con las cookies
 * bloqueadas y cuando el sitio tiene el almacenamiento deshabilitado. Un throw en el primer render
 * se lleva puesta la lista entera, así que la preferencia se lee y se escribe siempre a prueba de
 * fallos: sin almacenamiento, el control sigue funcionando y solo se olvida al recargar.
 *
 * ## El valor guardado puede ser basura
 *
 * Otra versión de la app pudo haber escrito otra cosa en esa clave. Un valor que no está entre los
 * modos válidos se ignora y se usa el inicial, en vez de renderizar un modo que no existe.
 */

export const MODOS = ['lista', 'tarjetas'];

export const CLAVE_POR_DEFECTO = 'comercial_view_mode';

const leer = (clave) => {
    try {
        return window.localStorage.getItem(clave);
    } catch {
        return null;
    }
};

const escribir = (clave, valor) => {
    try {
        window.localStorage.setItem(clave, valor);
    } catch {
        // Sin almacenamiento la elección no se recuerda; la lista tiene que seguir andando.
    }
};

export const useModoVista = (clave = CLAVE_POR_DEFECTO, inicial = 'lista') => {
    const porDefecto = MODOS.includes(inicial) ? inicial : 'lista';

    // La lectura va en el inicializador perezoso y no en un efecto: leída después, el primer render
    // pinta la lista y el segundo salta a tarjetas, y ese salto se ve.
    const [modo, setModoCrudo] = useState(() => {
        const guardado = leer(clave);
        return MODOS.includes(guardado) ? guardado : porDefecto;
    });

    // Cambiar de clave (otra tabla, otra pantalla) vuelve a leer la preferencia de esa clave.
    useEffect(() => {
        const guardado = leer(clave);
        setModoCrudo(MODOS.includes(guardado) ? guardado : porDefecto);
    }, [clave, porDefecto]);

    const setModo = useCallback((siguiente) => {
        if (!MODOS.includes(siguiente)) return;
        setModoCrudo(siguiente);
        escribir(clave, siguiente);
    }, [clave]);

    const alternar = useCallback(() => {
        setModo(modo === 'lista' ? 'tarjetas' : 'lista');
    }, [modo, setModo]);

    return { modo, setModo, alternar, esLista: modo === 'lista', esTarjetas: modo === 'tarjetas' };
};

export default useModoVista;
