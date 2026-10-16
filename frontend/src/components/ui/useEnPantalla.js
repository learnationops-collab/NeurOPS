import { useCallback, useLayoutEffect, useState } from 'react';

/**
 * Que un menú o panel flotante (`.menu`, `.config-panel`) quede entero dentro de la pantalla.
 *
 * Devuelve una ref de callback para poner en el flotante: lo corre de costado lo justo para que no
 * se salga ni por la izquierda ni por la derecha (con el margen de 16px de la página), y si no
 * entra de alto, lo topa al alto que queda y le da scroll adentro.
 *
 * Vuelve a medir cada vez que cambia de tamaño el flotante o aquello de lo que cuelga (la píldora
 * cambia de texto al elegir: «Todos los talleres» pasa a «26/09 – 12/10» y el menú, anclado a su
 * borde, se mueve sin cambiar de tamaño) y cuando cambia la ventana. Antes cada menú medía una sola vez, al abrirse: el de los talleres del Resumen se
 * ensanchaba al elegir «Período» (aparecen las dos fechas) y quedaba cortado por la izquierda
 * (Kerwin, 16/10/2026: «un menú abre hacia afuera de la pantalla»).
 *
 * El corrimiento va en la propiedad `translate` y no en `transform`: los paneles que entran con
 * framer-motion animan `transform` y se pisarían.
 */

export const MARGEN = 16;
const ALTO_MINIMO = 160;

/** Dónde caería el flotante SIN corrimiento: su lugar de diseño (`offsetLeft` dentro de su ancla),
 *  que no cambia con `translate` ni con una transición a medio camino. Con `getBoundingClientRect`
 *  tras borrar el corrimiento, la transición global (1e-05s) devolvía todavía la posición vieja y el
 *  menú quedaba 12px afuera. Sin ancla medible (jsdom), la caja tal cual. */
const cajaSinCorrer = (nodo) => {
    const ancla = nodo.offsetParent;
    if (!ancla) return nodo.getBoundingClientRect();
    const base = ancla.getBoundingClientRect();
    const left = base.left + nodo.offsetLeft - ancla.scrollLeft;
    const top = base.top + nodo.offsetTop - ancla.scrollTop;
    return { left, top, width: nodo.offsetWidth, right: left + nodo.offsetWidth };
};

export const ajustarAPantalla = (nodo) => {
    const caja = cajaSinCorrer(nodo);
    const ancho = document.documentElement.clientWidth;
    const borde = ancho - MARGEN;
    let corrimiento = 0;
    if (caja.width > ancho - 2 * MARGEN || caja.left < MARGEN) corrimiento = MARGEN - caja.left;
    else if (caja.right > borde) corrimiento = borde - caja.right;
    const nuevo = corrimiento ? `${Math.round(corrimiento)}px 0` : '';
    if (nodo.style.translate !== nuevo) nodo.style.translate = nuevo;

    // El alto disponible depende de dónde arranca, no de su alto: fijarlo no vuelve a disparar el
    // observador en un bucle.
    const alto = window.innerHeight - MARGEN - Math.max(caja.top, 0);
    nodo.style.maxHeight = `${Math.max(ALTO_MINIMO, Math.floor(alto))}px`;
    nodo.style.overflowY = 'auto';
};

/** `propia` es la ref que el componente ya usaba para ese nodo (el clic afuera, por ejemplo): la
 *  ref devuelta la completa también, y es estable (una nueva en cada render volvería a medir sin fin). */
export const useEnPantalla = (propia = null) => {
    const [nodo, setNodo] = useState(null);
    const ref = useCallback((el) => {
        if (propia) propia.current = el;
        setNodo(el);
    }, [propia]);

    // De layout: se corrige antes de pintar, sin un cuadro con el menú afuera.
    useLayoutEffect(() => {
        if (!nodo) return undefined;
        const ajustar = () => ajustarAPantalla(nodo);
        ajustar();
        const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ajustar) : null;
        observador?.observe(nodo);
        if (nodo.parentElement) observador?.observe(nodo.parentElement);
        window.addEventListener('resize', ajustar);
        return () => {
            observador?.disconnect();
            window.removeEventListener('resize', ajustar);
        };
    }, [nodo]);

    return ref;
};

export default useEnPantalla;
