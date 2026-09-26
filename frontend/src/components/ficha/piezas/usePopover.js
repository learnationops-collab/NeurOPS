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
const usePopover = () => {
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
            // Un campo puede reclamar el Escape para sí (el input de "opción nueva" lo
            // usa para cancelar lo que se está escribiendo). Este listener corre en
            // captura sobre `document`, o sea ANTES que el handler de React del campo:
            // sin esta salida, Escape cerraría el desplegable entero en vez de cancelar
            // el campo, y lo escrito se perdería sin que se pueda corregir.
            if (e.target?.closest?.('[data-escape-propio="1"]')) return;
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

export default usePopover;
