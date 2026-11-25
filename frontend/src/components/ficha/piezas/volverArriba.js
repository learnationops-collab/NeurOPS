import { createContext } from 'react';

/**
 * «Volver» de una sub-vista, en la cabecera de la ficha (al lado de cerrar, 25/11/2026). La ficha da
 * `registrar(fn | null)`; la sub-vista abierta registra su volver y lo quita al cerrarse. Sin la ficha
 * alrededor (null), la sub-vista dibuja su «Volver» abajo, como antes.
 */
const VolverArriba = createContext(null);

export default VolverArriba;
