import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Abrir/cerrar un panel flotante anclado a su disparador.
 *
 * Existe porque los tres desplegables de la ficha (opciones, fecha, closer) tienen
 * que cerrarse igual: con Escape y con un clic afuera. Sin esto, abrir el de fechas
 * dejaba el de opciones abierto detrás y el panel terminaba con dos capas encima.
 *
 * Escape se escucha en fase de captura y detiene la propagación: el modal también
 * escucha Escape para cerrarse, y cerrar un desplegable no tiene que cerrar la ficha.
 */
const usarPopover = () => {
    const [abierto, setAbierto] = useState(false);
    const caja = useRef(null);

    const cerrar = useCallback(() => setAbierto(false), []);
    const alternar = useCallback(() => setAbierto(a => !a), []);

    useEffect(() => {
        if (!abierto) return undefined;
        const afuera = (e) => {
            if (caja.current && !caja.current.contains(e.target)) setAbierto(false);
        };
        const escape = (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            setAbierto(false);
        };
        document.addEventListener('mousedown', afuera);
        document.addEventListener('keydown', escape, true);
        return () => {
            document.removeEventListener('mousedown', afuera);
            document.removeEventListener('keydown', escape, true);
        };
    }, [abierto]);

    return { abierto, setAbierto, alternar, cerrar, caja };
};

export default usarPopover;
