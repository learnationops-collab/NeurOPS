import { useCallback, useState } from 'react';

/**
 * El ancho que la persona le dio a las columnas `redimensionable` de una lista, recordado por persona y
 * navegador (`localStorage`, como las columnas elegidas): `{ [key]: px }`. Una columna sin ancho elegido usa
 * el de su definición. Arrastrar el borde del encabezado (o las flechas con el foco en él) lo cambia y
 * doble toque lo devuelve al de la definición.
 */
export const ANCHO_MINIMO = 120;
export const ANCHO_MAXIMO = 640;

const leer = (clave) => {
    try {
        const crudo = window.localStorage.getItem(clave);
        const valor = crudo ? JSON.parse(crudo) : null;
        return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {};
    } catch {
        return {};
    }
};

const escribir = (clave, valor) => {
    try {
        window.localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
        // Sin almacenamiento el ancho no se recuerda; la lista sigue andando.
    }
};

export const useAnchosColumnas = (claveGuardado) => {
    const clave = claveGuardado ? `${claveGuardado}_anchos` : null;
    const [anchos, setAnchos] = useState(() => (clave ? leer(clave) : {}));

    const fijar = useCallback((key, px) => setAnchos((previos) => {
        const siguiente = { ...previos };
        if (px == null) delete siguiente[key];
        else siguiente[key] = Math.min(Math.max(Math.round(px), ANCHO_MINIMO), ANCHO_MAXIMO);
        if (clave) escribir(clave, siguiente);
        return siguiente;
    }), [clave]);

    return { anchos, fijar };
};

export default useAnchosColumnas;
