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
 * `paso` es el lugar del hueso en la fila de entrada. El mismo escalón lo usan las filas y las
 * tarjetas reales cuando llegan los datos, así que el esqueleto y la lista entran con el mismo
 * ritmo.
 *
 * El ritmo es deliberadamente perceptible. Con 45 ms y tope en 12, las doce primeras filas
 * entraban en medio segundo y el resto de golpe: técnicamente escalonado, pero a simple vista
 * era un bloque apareciendo. El pedido fue "que cargue uno por uno, aunque sea más lento". Con
 * 60 ms y tope en 24, lo que entra en pantalla a la vez (unas quince filas) aparece de a una,
 * y la primera fila sigue estando a la vista en 60 ms: se ve el movimiento sin esperar el dato.
 *
 * El tope sigue haciendo falta. Sin él, la fila 40 de una página entraría 2,4 s tarde y la 500
 * medio minuto después. Con 24, todo lo que está por debajo del borde de la ventana termina de
 * entrar en menos de un segundo y medio, antes de que nadie llegue a scrollear hasta ahí.
 */

const PASO_MS = 60;
const TOPE_ESCALON = 24;

/** El retraso de entrada del elemento número `i`, ya topeado. Lo usan también las filas reales. */
export const escalonDe = (i, paso = PASO_MS) => Math.min(Math.max(i, 0), TOPE_ESCALON) * paso;

export const Hueso = ({ alto = 14, ancho, radio, paso = 0, style, className }) => (
    <span className={`hueso${className ? ` ${className}` : ''}`} aria-hidden="true"
        style={{ height: alto, width: ancho, borderRadius: radio, '--d': `${escalonDe(paso)}ms`, ...style }} />
);

/**
 * El renglón de un texto, con su hueso centrado adentro.
 *
 * Un texto real ocupa el alto de su LÍNEA (la letra por el interlineado: 16 px de letra son 24 de
 * renglón), y el hueso que lo reemplaza es más bajo que eso para que se lea como texto. La
 * diferencia no puede ir en márgenes: el hueso es un bloque, y los márgenes verticales de dos
 * bloques hermanos colapsan —queda el mayor, no la suma—, así que el esqueleto salía más corto
 * que lo que reemplazaba y todo lo de abajo saltaba al llegar los datos (4,75 px por fila en
 * Seguimientos, 8,5 por tarjeta en el kanban). Una caja del alto exacto del renglón no depende de
 * con quién esté al lado.
 *
 * En columna para que un hueso sin `ancho` ocupe todo el renglón, como el bloque que era.
 */
export const Renglon = ({ alto, children, style }) => (
    <div aria-hidden="true"
        style={{ height: alto, display: 'flex', flexDirection: 'column', justifyContent: 'center', ...style }}>
        {children}
    </div>
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
