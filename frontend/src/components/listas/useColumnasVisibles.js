import { useCallback, useMemo, useState } from 'react';

/**
 * Qué columnas de una lista se ven, recordado por persona y navegador (`localStorage`), como el modo
 * lista/tarjetas de `useModoVista`: es una comodidad de lectura, no un dato del negocio.
 *
 * Se guardan las columnas OCULTAS y no las visibles: una columna nueva que se agregue a la
 * definición aparece sola, en vez de quedar escondida para todos los que ya habían elegido.
 *
 * Las columnas `fija` no se pueden ocultar (el nombre de la fila, por ejemplo). Las `oculta` arrancan
 * escondidas hasta que alguien las pide.
 */

const leer = (clave) => {
    try {
        const crudo = window.localStorage.getItem(clave);
        const valor = crudo ? JSON.parse(crudo) : null;
        return Array.isArray(valor) ? valor.filter((k) => typeof k === 'string') : null;
    } catch {
        return null;
    }
};

const escribir = (clave, valor) => {
    try {
        window.localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
        // Sin almacenamiento la elección no se recuerda; la lista sigue andando.
    }
};

export const ocultasPorDefecto = (columnas) => columnas.filter((c) => c.oculta && !c.fija).map((c) => c.key);

export const useColumnasVisibles = (clave, columnas) => {
    const [ocultas, setOcultasCrudo] = useState(() => (clave && leer(clave)) || ocultasPorDefecto(columnas));

    const setOcultas = useCallback((siguiente) => {
        setOcultasCrudo(siguiente);
        if (clave) escribir(clave, siguiente);
    }, [clave]);

    const visibles = useMemo(
        () => columnas.filter((c) => c.fija || !ocultas.includes(c.key)),
        [columnas, ocultas],
    );

    const alternar = useCallback((key) => {
        const col = columnas.find((c) => c.key === key);
        if (!col || col.fija) return;
        const estaOculta = ocultas.includes(key);
        // Al menos una columna que no sea fija queda a la vista: una tabla sin datos no dice nada.
        if (!estaOculta && visibles.filter((c) => !c.fija).length <= 1) return;
        setOcultas(estaOculta ? ocultas.filter((k) => k !== key) : [...ocultas, key]);
    }, [columnas, ocultas, visibles, setOcultas]);

    const restablecer = useCallback(() => setOcultas(ocultasPorDefecto(columnas)), [columnas, setOcultas]);

    return { visibles, ocultas, alternar, restablecer };
};

export default useColumnasVisibles;
