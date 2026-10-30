import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Una cifra (un %, un ROAS, un costo) que se muestra SOLA, con su cuenta en un tooltip (Kerwin, 28/10/2026):
 * «163 de 2.448 leads». Cada parte de la cuenta es un botón que abre la lista que la suma, y la cifra misma abre la
 * del numerador. Sin `cuenta` es solo la cifra, que abre la lista de `metrica` si la tiene.
 *
 * `cuenta`: `{ a, b }` con numerador y denominador, cada uno `{ t: texto, m: lista que lo suma, titulo }`. Una parte
 * sin `m` (un número que no tiene lista) se ve en el tooltip pero no se toca.
 * `onVer(metrica, titulo)`: la pantalla abre esa lista (`useVerRegistros`); sin ella la cifra queda quieta.
 * `metrica` / `titulo`: la lista de una cifra sin cuenta. `lado="der"`: el tooltip se alinea al borde derecho de la
 * cifra (también lo hace solo si no entra a la derecha).
 * `color` + `rotulo` (Kerwin, 29/10/2026): una cifra de una fuente con color propio (Setting rosa, Workshop azul) va en ese
 * color y NO escribe el nombre al lado; el nombre (`rotulo`) aparece solo como título del tooltip.
 *
 * El tooltip se dibuja fuera de su lugar (en el `.dc-shell`, o en `body`) y `fixed`: una tabla que scrollea, una
 * tarjeta con `overflow:hidden` o con vidrio no lo recortan ni lo corren.
 */
const ANCHO_TIP = 320;
const MARGEN = 16;
const DEMORA_CIERRE = 140;

const destino = () => document.querySelector('.dc-shell') || document.body;

const CifraConCuenta = ({ children, cuenta = null, metrica = null, titulo = null, onVer = null, lado = 'izq', className = '', color = null, rotulo = null }) => {
    const id = useId();
    const raiz = useRef(null);
    const cierre = useRef(null);
    const [pos, setPos] = useState(null);
    const lista = onVer ? (cuenta?.a?.m || metrica) : null;

    const abrirTip = useCallback(() => {
        clearTimeout(cierre.current);
        const r = raiz.current?.getBoundingClientRect();
        if (!r) return;
        const der = lado === 'der' || r.left + ANCHO_TIP > window.innerWidth - MARGEN;
        const arriba = r.top > 110;
        setPos({
            ...(der ? { right: Math.max(MARGEN, window.innerWidth - r.right) } : { left: Math.max(MARGEN, r.left) }),
            ...(arriba ? { bottom: window.innerHeight - r.top + 8 } : { top: r.bottom + 8 }),
        });
    }, [lado]);
    const cerrarTip = useCallback(() => {
        clearTimeout(cierre.current);
        cierre.current = setTimeout(() => setPos(null), DEMORA_CIERRE);
    }, []);
    useEffect(() => () => clearTimeout(cierre.current), []);
    // Un tooltip abierto no sigue a su cifra si se scrollea o cambia la ventana: se cierra.
    useEffect(() => {
        if (!pos) return undefined;
        const cerrar = () => setPos(null);
        window.addEventListener('scroll', cerrar, true);
        window.addEventListener('resize', cerrar);
        return () => { window.removeEventListener('scroll', cerrar, true); window.removeEventListener('resize', cerrar); };
    }, [pos]);

    const tituloDe = (m, t) => t || (m === metrica && titulo) || m;
    const abrir = (m, t) => { setPos(null); if (onVer && m) onVer(m, tituloDe(m, t)); };
    const hayTip = Boolean(cuenta || rotulo);
    const estilo = color ? { '--ui-cifra-c': color } : undefined;
    const clase = `ui-cifra${color ? ' ui-cifra--color' : ''} ${className}`;
    if (!lista && !hayTip) return <span className={`${clase} ui-cifra--quieta`} style={estilo}>{children}</span>;

    const parte = (p) => (onVer && p.m
        ? <button type="button" onClick={() => abrir(p.m, p.titulo)}>{p.t}</button>
        : <b>{p.t}</b>);
    const eventos = hayTip ? {
        onMouseEnter: abrirTip, onMouseLeave: cerrarTip, onFocus: abrirTip,
        onBlur: (ev) => { if (!ev.currentTarget.contains(ev.relatedTarget)) cerrarTip(); },
    } : {};
    return (
        <span ref={raiz} className={clase} style={estilo} {...eventos}>
            {lista ? (
                <button type="button" className="ui-cifra__valor" onClick={() => abrir(lista, cuenta?.a?.titulo)}
                    aria-describedby={hayTip && pos ? id : undefined}
                    aria-label={`${rotulo ? `${rotulo} ` : ''}${typeof children === 'string' ? `${children}: ` : ''}ver la lista de ${String(tituloDe(lista, cuenta?.a?.titulo)).toLowerCase()}`}>
                    {children}
                </button>
            ) : <span className="ui-cifra__valor ui-cifra__valor--quieta" tabIndex={0} aria-describedby={hayTip && pos ? id : undefined}>{children}</span>}
            {hayTip && pos && createPortal(
                <span id={id} className="ui-cifra__cuenta" role="tooltip" style={pos}
                    onMouseEnter={() => clearTimeout(cierre.current)} onMouseLeave={cerrarTip}>
                    {rotulo && <em className="ui-cifra__rotulo" style={color ? { '--ui-cifra-c': color } : undefined}>{rotulo}</em>}
                    {cuenta && <>{parte(cuenta.a)}<span> de </span>{parte(cuenta.b)}</>}
                    {lista && cuenta && <small>Tocá una cifra para ver su lista</small>}
                </span>,
                destino(),
            )}
        </span>
    );
};

export default CifraConCuenta;
