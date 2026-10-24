import { useEffect, useRef, useState } from 'react';

/**
 * La caja de cualquier tabla ancha o larga: un alto acotado en el que la tabla se desplaza (la
 * cabecera queda pegada arriba y, a los lados, las columnas fijas) y, ENCIMA, una segunda barra de
 * desplazamiento horizontal sincronizada con la de abajo, para moverse de lado sin bajar hasta el final
 * (Kerwin, 23/10/2026; antes solo la tenían las tablas de Marketing).
 *
 * No trae estilos: quien la usa pone `className` en la caja (alto, `overflow: auto`, fondo) y
 * `claseArriba` en la barra de arriba. Las marcas `data-testid` son las que ya usaban los tests de
 * Marketing (`caja-tabla`, `scroll-arriba`).
 */

const useAnchoDelContenido = (caja) => {
    const [medidas, setMedidas] = useState({ contenido: 0, visible: 0 });
    useEffect(() => {
        const nodo = caja.current;
        if (!nodo) return undefined;
        const medir = () => setMedidas((m) => {
            const nuevo = { contenido: nodo.scrollWidth, visible: nodo.clientWidth };
            return m.contenido === nuevo.contenido && m.visible === nuevo.visible ? m : nuevo;
        });
        medir();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observador = new ResizeObserver(medir);
        observador.observe(nodo);
        if (nodo.firstElementChild) observador.observe(nodo.firstElementChild);
        return () => observador.disconnect();
    }, [caja]);
    return medidas;
};

const CajaDesplazable = ({ children, className = '', claseArriba = '' }) => {
    const caja = useRef(null);
    const arriba = useRef(null);
    const { contenido, visible } = useAnchoDelContenido(caja);
    const sobra = contenido > visible + 1;
    // Una barra manda y la otra la sigue; sin cambio de valor no hay evento, así que no se llaman en bucle.
    const seguir = (de, a) => () => {
        if (a.current && a.current.scrollLeft !== de.current.scrollLeft) a.current.scrollLeft = de.current.scrollLeft;
    };

    return (
        <>
            <div className={claseArriba} ref={arriba} hidden={!sobra} onScroll={seguir(arriba, caja)}
                role="presentation" aria-hidden="true" data-testid="scroll-arriba">
                <div style={{ width: contenido }} />
            </div>
            <div className={className} ref={caja} onScroll={seguir(caja, arriba)} data-testid="caja-tabla">
                {children}
            </div>
        </>
    );
};

export default CajaDesplazable;
