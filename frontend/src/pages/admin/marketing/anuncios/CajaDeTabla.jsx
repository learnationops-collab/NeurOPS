import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import './tablaAnuncios.css';

/**
 * El contenedor de las tablas de Marketing: una caja con alto acotado (el encabezado y la columna del
 * nombre quedan fijos al desplazar, ver `.mk-tabla-caja--alta`) y, arriba, una segunda barra de
 * desplazamiento horizontal sincronizada con la de abajo, para no tener que bajar hasta el final
 * (Kerwin, 23/10/2026).
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

export const CajaDeTabla = ({ children, completa = false, className = '' }) => {
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
            <div className="mk-scroll-arriba" ref={arriba} hidden={!sobra} onScroll={seguir(arriba, caja)}
                role="presentation" aria-hidden="true" data-testid="scroll-arriba">
                <div style={{ width: contenido }} />
            </div>
            <div className={`mk-tabla-caja mk-tabla-caja--alta${completa ? ' mk-tabla-caja--completa' : ''} ${className}`.trim()}
                ref={caja} onScroll={seguir(caja, arriba)} data-testid="caja-tabla">
                {children}
            </div>
        </>
    );
};

export const BotonPantallaCompleta = ({ completa, onClick }) => (
    <button type="button" className={`pastilla pastilla--sm${completa ? ' pastilla--on' : ''}`}
        aria-pressed={completa} onClick={onClick}
        title={completa ? 'Volver a la página (Escape)' : 'Ver la tabla a pantalla completa'}>
        {completa ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
        {completa ? 'Salir' : 'Pantalla completa'}
    </button>
);

export default CajaDeTabla;
