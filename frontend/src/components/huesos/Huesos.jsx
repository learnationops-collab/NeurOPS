import React from 'react';
import './huesos.css';

/**
 * El esqueleto de carga: la forma de lo que va a aparecer, en vez de un círculo girando.
 *
 * Un spinner no dice nada —ni cuánto falta ni qué viene— y encima obliga a que el contenido real
 * entre desplazando todo lo que había debajo. El hueso ocupa exactamente el lugar del dato que
 * está viniendo, así que al llegar los datos no hay salto: ése es el punto, y por eso un hueso
 * que NO coincide con lo que carga es peor que el spinner.
 *
 * `paso` es el lugar del hueso en la fila de entrada. Está topeado (`TOPE_ESCALON`) porque el
 * escalonado acumulado no puede crecer sin límite: una tabla de 40 huesos a 45 ms cada uno
 * tardaría casi dos segundos en terminar de dibujarse, más de lo que tarda el fetch.
 */

const PASO_MS = 45;
const TOPE_ESCALON = 12;

/** El retraso de entrada del elemento número `i`, ya topeado. Lo usan también las filas reales. */
export const escalonDe = (i, paso = PASO_MS) => Math.min(Math.max(i, 0), TOPE_ESCALON) * paso;

export const Hueso = ({ alto = 14, ancho, radio, paso = 0, style, className }) => (
    <span className={`hueso${className ? ` ${className}` : ''}`} aria-hidden="true"
        style={{ height: alto, width: ancho, borderRadius: radio, '--d': `${escalonDe(paso)}ms`, ...style }} />
);

/**
 * El envoltorio de un esqueleto. Lleva el `role="status"` con el rótulo, que es lo único que el
 * spinner hacía bien: sin él, un lector de pantalla no se entera de que la pantalla está
 * cargando —los huesos son decorativos y van todos con `aria-hidden`—.
 */
export const Esqueleto = ({ rotulo = 'Cargando…', children, className, style }) => (
    <div role="status" aria-busy="true" aria-label={rotulo} className={className} style={style}>
        {children}
    </div>
);

export default Hueso;
