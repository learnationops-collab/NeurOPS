import { useCallback, useLayoutEffect, useState } from 'react';
import { subirACapa } from '../standard/capa';

/**
 * Que un menú o panel flotante (`.menu`, `.config-panel`, la lista de un desplegable) quede ENCIMA
 * de todo y entero dentro de la pantalla.
 *
 * Encima de todo: lo sube a la capa superior del navegador (`subirACapa`). Un `z-index` no alcanza:
 * compite solo dentro del contexto de apilamiento de su padre, y cualquier ancestro con `transform`,
 * `opacity`, `filter` o una entrada animada lo atrapa ahí (el menú de la pastilla del Resumen de
 * Workshop quedaba DEBAJO de las tarjetas KPI, que se leían a través de sus opciones).
 *
 * En la capa superior el flotante es `fixed` contra la ventana, así que se ubica donde lo ponía su
 * CSS: antes de subirlo se mide su lugar de diseño respecto de su ancla (el `offsetParent`: la
 * pastilla o el botón con su `position:relative`) y de qué borde cuelga (`right:0` o `left:0`). Desde
 * ahí lo sigue al hacer scroll y lo corre de costado lo justo para que no se salga (margen de 16px);
 * si no entra de alto debajo, abre hacia arriba o se topa al alto que queda y scrollea adentro.
 *
 * Vuelve a medir cada vez que cambia de tamaño el flotante o aquello de lo que cuelga (la píldora
 * cambia de texto al elegir: «Todos los talleres» pasa a «26/09 – 12/10») y cuando cambia la ventana
 * (Kerwin, 16/10/2026: «un menú abre hacia afuera de la pantalla»).
 *
 * Sin capa superior (navegador viejo, jsdom) queda donde lo pone su CSS y el corrimiento va en la
 * propiedad `translate` (no en `transform`: los paneles que entran con framer-motion lo animan).
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

/**
 * El lugar de diseño del flotante, medido ANTES de subirlo (después ya es `fixed`): su ancla, cuánto
 * baja desde ella, de qué borde cuelga y su tope de alto propio (`max-height` del CSS). Solo flota lo
 * que es `absolute`: un panel que en el teléfono pasa a su fila (`position:static`) se queda ahí.
 */
export const medirDiseno = (nodo) => {
    const ancla = nodo.offsetParent;
    if (!ancla || getComputedStyle(nodo).position !== 'absolute') return null;
    const ancho = nodo.offsetWidth;
    const izquierda = nodo.offsetLeft;
    const derecha = ancla.clientWidth - izquierda - ancho;
    const tope = parseFloat(getComputedStyle(nodo).maxHeight);
    return {
        ancla,
        ancho,
        top: nodo.offsetTop,
        der: Math.abs(derecha) < Math.abs(izquierda),
        lado: Math.abs(derecha) < Math.abs(izquierda) ? derecha : izquierda,
        tope: Number.isFinite(tope) ? tope : Infinity,
    };
};

const fijar = (nodo, prop, valor) => { if (nodo.style[prop] !== valor) nodo.style[prop] = valor; };

/** Ubica en la ventana un flotante que ya está en la capa superior, a partir de su lugar de diseño. */
export const ubicarEnCapa = (nodo, diseno) => {
    const { ancla } = diseno;
    const base = ancla.getBoundingClientRect();
    const x0 = base.left + ancla.clientLeft - ancla.scrollLeft;
    const y0 = base.top + ancla.clientTop - ancla.scrollTop;
    const pantalla = document.documentElement.clientWidth;
    const alto = window.innerHeight;
    const ancho = nodo.offsetWidth;

    let left = diseno.der ? x0 + ancla.clientWidth - diseno.lado - ancho : x0 + diseno.lado;
    left = ancho > pantalla - 2 * MARGEN ? MARGEN : Math.min(Math.max(left, MARGEN), pantalla - MARGEN - ancho);

    // Abajo, como lo dibuja su CSS; arriba solo si debajo no entra y arriba hay más lugar.
    let top = y0 + diseno.top;
    const necesita = Math.min(nodo.scrollHeight, diseno.tope, ALTO_MINIMO * 2);
    const abajo = alto - MARGEN - Math.max(top, 0);
    const separacion = Math.max(0, diseno.top - ancla.offsetHeight);
    const arriba = base.top - separacion - MARGEN;
    let disponible = abajo;
    if (abajo < necesita && arriba > abajo) {
        disponible = arriba;
        top = base.top - separacion - Math.min(nodo.scrollHeight, diseno.tope, arriba);
    }

    fijar(nodo, 'position', 'fixed');
    fijar(nodo, 'top', `${Math.round(top)}px`);
    fijar(nodo, 'left', `${Math.round(left)}px`);
    fijar(nodo, 'right', 'auto');
    fijar(nodo, 'bottom', 'auto');
    fijar(nodo, 'translate', '');
    fijar(nodo, 'maxHeight', `${Math.max(Math.min(ALTO_MINIMO, diseno.tope), Math.min(diseno.tope, Math.floor(disponible)))}px`);
    fijar(nodo, 'overflowY', 'auto');
};

/** El lugar de diseño de cada nodo ya subido: una vez `fixed` no se puede volver a medir (el efecto
 *  corre dos veces en desarrollo, con StrictMode). */
const disenos = new WeakMap();

/** Lo sube a la capa superior y lo deja en su lugar de diseño. Si su ancho dependía del ancla (un
 *  `width:100%` o `left:0;right:0`), en la capa pasaría a medirse contra la ventana: se fija el que tenía. */
const subir = (nodo) => {
    if (disenos.has(nodo)) return disenos.get(nodo);
    const diseno = medirDiseno(nodo);
    if (!diseno || !subirACapa(nodo)) return null;
    nodo.style.position = 'fixed';
    nodo.style.right = 'auto';
    // `offsetTop` ya incluye su margen (un `mt-2`): contarlo dos veces lo bajaría de más.
    nodo.style.margin = '0';
    if (Math.abs(nodo.offsetWidth - diseno.ancho) > 1) nodo.style.width = `${diseno.ancho}px`;
    disenos.set(nodo, diseno);
    return diseno;
};

/** `propia` es la ref que el componente ya usaba para ese nodo (el clic afuera, por ejemplo): la
 *  ref devuelta la completa también, y es estable (una nueva en cada render volvería a medir sin fin). */
export const useEnPantalla = (propia = null) => {
    const [nodo, setNodo] = useState(null);
    const ref = useCallback((el) => {
        if (propia) propia.current = el;
        setNodo(el);
    }, [propia]);

    // De layout: se ubica antes de pintar, sin un cuadro con el menú afuera o debajo de algo.
    useLayoutEffect(() => {
        if (!nodo) return undefined;
        const diseno = subir(nodo);
        const ajustar = diseno ? () => ubicarEnCapa(nodo, diseno) : () => ajustarAPantalla(nodo);
        ajustar();
        const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ajustar) : null;
        observador?.observe(nodo);
        if (nodo.parentElement) observador?.observe(nodo.parentElement);
        if (diseno && diseno.ancla !== nodo.parentElement) observador?.observe(diseno.ancla);
        window.addEventListener('resize', ajustar);
        // `fixed` en la capa: al scrollear la página (o el panel que lo contiene) sigue a su ancla.
        if (diseno) window.addEventListener('scroll', ajustar, true);
        return () => {
            observador?.disconnect();
            window.removeEventListener('resize', ajustar);
            window.removeEventListener('scroll', ajustar, true);
        };
    }, [nodo]);

    return ref;
};

export default useEnPantalla;
