import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Globo de ayuda que envuelve a cualquier elemento.
 *
 * Existe porque el gráfico de embudo de beui.dev lo importa desde `@/components/motion/tooltip`.
 * El repo ya tiene `components/ui/InfoTooltip.jsx`, pero ese ES el disparador (un ícono "?");
 * este envuelve al hijo que le pasen, que es lo que el gráfico necesita para poner el globo
 * sobre cada banda.
 *
 * Se renderiza con portal a `document.body` y posición fija, por el mismo motivo que
 * `InfoTooltip`: dentro del dashboard hay contenedores con `backdrop-filter`, que crean su
 * propio contexto de apilamiento y dejarían el globo por debajo del contenido siguiente por más
 * z-index que se le ponga.
 */
const Tooltip = ({ content, children, wrapperClassName, className }) => {
    const [abierto, setAbierto] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const disparador = useRef(null);
    const globo = useRef(null);

    // Se mide después de pintar el globo: recién ahí se sabe su tamaño real para poder
    // acomodarlo sin que se salga de la ventana.
    useLayoutEffect(() => {
        if (!abierto || !disparador.current) return;
        const d = disparador.current.getBoundingClientRect();
        const g = globo.current?.getBoundingClientRect();
        const ancho = g?.width || 240;
        const alto = g?.height || 80;
        const margen = 12;

        let left = d.left + d.width / 2 - ancho / 2;
        left = Math.max(margen, Math.min(left, window.innerWidth - ancho - margen));

        // Arriba del elemento salvo que no quepa; ahí va abajo.
        let top = d.top - alto - 10;
        if (top < margen) top = d.bottom + 10;

        setPos({ top, left });
    }, [abierto, content]);

    useEffect(() => {
        if (!abierto) return undefined;
        const cerrar = () => setAbierto(false);
        window.addEventListener('scroll', cerrar, true);
        window.addEventListener('resize', cerrar);
        return () => {
            window.removeEventListener('scroll', cerrar, true);
            window.removeEventListener('resize', cerrar);
        };
    }, [abierto]);

    return (
        <span
            ref={disparador}
            className={wrapperClassName}
            onMouseEnter={() => setAbierto(true)}
            onMouseLeave={() => setAbierto(false)}
            onFocus={() => setAbierto(true)}
            onBlur={() => setAbierto(false)}
        >
            {children}
            {abierto && content && createPortal(
                <span
                    ref={globo}
                    role="tooltip"
                    className={className}
                    style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 200 }}
                >
                    {content}
                </span>,
                document.body,
            )}
        </span>
    );
};

export default Tooltip;
export { Tooltip };
