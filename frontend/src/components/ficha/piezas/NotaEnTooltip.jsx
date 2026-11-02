import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import NotaFormateada from './NotaFormateada';

/**
 * Su contenido (`children`, el título) abre, al pasar el ratón o con foco, una ventana con la nota
 * leída con formato (`NotaFormateada`). Se dibuja dentro del `.dc-shell` más cercano y con
 * `position: fixed` para que el panel con scroll de la ficha no la recorte; se queda abierta
 * mientras el ratón está sobre ella, para poder leer una nota larga con su propio scroll.
 */
const ANCHO = 640;
const MARGEN = 12;

export default function NotaEnTooltip({ texto, children }) {
    const disparador = useRef(null);
    const cierre = useRef(null);
    const [pos, setPos] = useState(null);

    const abrir = useCallback(() => {
        clearTimeout(cierre.current);
        const caja = disparador.current?.getBoundingClientRect();
        if (!caja) return;
        const ancho = Math.min(ANCHO, window.innerWidth - MARGEN * 2);
        const arriba = caja.bottom + 8;
        setPos({
            left: Math.max(MARGEN, Math.min(caja.left, window.innerWidth - ancho - MARGEN)),
            top: arriba, width: ancho, maxHeight: Math.max(160, window.innerHeight - arriba - MARGEN),
        });
    }, []);
    const cerrar = useCallback(() => {
        clearTimeout(cierre.current);
        cierre.current = setTimeout(() => setPos(null), 150);
    }, []);
    useEffect(() => () => clearTimeout(cierre.current), []);
    useEffect(() => {
        if (!pos) return undefined;
        const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setPos(null); } };
        document.addEventListener('keydown', esc, true);
        return () => document.removeEventListener('keydown', esc, true);
    }, [pos]);

    const raiz = disparador.current?.closest('.dc-shell') || document.body;
    return (
        <div ref={disparador} className="nota-tip-disp" tabIndex={0}
            onMouseEnter={abrir} onMouseLeave={cerrar} onFocus={abrir} onBlur={cerrar}>
            {children}
            {pos && createPortal(
                <div className="nota-tip" role="tooltip" style={pos} onMouseEnter={abrir} onMouseLeave={cerrar}>
                    <NotaFormateada texto={texto} />
                </div>, raiz)}
        </div>
    );
}
