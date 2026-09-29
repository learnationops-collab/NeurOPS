import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * El ícono "i" del tablero comercial: la explicación de lo que se está mirando.
 *
 * Antes la burbuja era `position:absolute` dentro del `.tip` y abría sola por CSS
 * (`:hover` / `:focus-within`). Así no sabía nada de la ventana, y eso se veía a diario:
 *
 *   · **Se cortaba contra el borde.** El tooltip de la tabla Clientes vive al final de la barra
 *     de herramientas, pegado a la derecha: abría hacia la derecha y de cada renglón se leía la
 *     mitad. Una clase `tip--der` puesta a mano (lo que había) no alcanza, porque el lado que
 *     entra depende de dónde cae el ancla EN ESE MOMENTO: el ancho de la ventana, el scroll
 *     horizontal de la barra, cuántos chips de faceta hay puestos. Hay que medir.
 *   · **Quedaba debajo de otras cosas.** Subirle el `z-index` no arreglaba nada: `.dock` y
 *     `.modal` tienen `overflow` propio más `isolation:isolate`, y `.tabs` tiene
 *     `overflow-x:auto`. A un hijo recortado por el `overflow` de un ancestro no lo salva ningún
 *     `z-index`, y un `isolation:isolate` encierra el apilamiento de todo el subárbol.
 *
 * Así que la burbuja se dibuja en un portal colgado de `<body>` —fuera de todo contenedor que la
 * pueda recortar— y se ubica midiendo: primero el lado que ENTRA (abajo si hay lugar, arriba si
 * no; alineada al borde izquierdo del ancla si entra, al derecho si no) y después se la clava
 * dentro del viewport con un margen. Es el mismo camino que ya hace `MetricTip` en el dashboard
 * del closer, por la misma razón; `usePopover` no sirve acá porque solo resuelve abrir y cerrar,
 * no mide nada.
 *
 * Al nodo del portal se le pone la clase `dc-shell` por el mismo motivo que al velo del modal
 * (ver el comentario del `.scrim` en `comercial.css`): fuera del tablero no tendría ni tokens ni
 * estilo.
 *
 * Sacar la burbuja del `.tip` obliga a abrir por JS: el CSS del ancla ya no puede alcanzar un
 * nodo que vive en otra rama del árbol. De paso se gana el click, que es lo único que funciona en
 * touch, donde no hay hover.
 */

const MARGEN = 12; // aire mínimo contra el borde de la ventana
const SALTO = 10;  // separación entre el ancla y la burbuja: es donde entra la flecha

/** Dónde poner la burbuja para que entre entera. Devuelve coordenadas de viewport (`fixed`). */
const ubicar = (ancla, burbuja) => {
    const a = ancla.getBoundingClientRect();
    const { width: w, height: h } = burbuja.getBoundingClientRect();
    const { innerWidth: vw, innerHeight: vh } = window;

    // Abajo por defecto (es donde la vista espera el tooltip de un "i"); arriba solo si abajo no
    // cabe Y arriba sí: dar vuelta una burbuja que tampoco entra arriba no gana nada.
    const arriba = a.bottom + SALTO + h > vh - MARGEN && a.top - SALTO - h >= MARGEN;

    // Los -10 / +10 replican el encuadre viejo (`left:-10px`): la burbuja sobresale un poco del
    // ícono para que la flecha no nazca justo sobre la esquina redondeada.
    const izquierda = a.left - 10;
    const derecha = a.right + 10 - w;
    const left = Math.min(
        Math.max(izquierda + w <= vw - MARGEN ? izquierda : derecha, MARGEN),
        Math.max(MARGEN, vw - MARGEN - w),
    );

    // La flecha apunta al centro del ANCLA, no al borde de la burbuja: cuando la burbuja se corre
    // para entrar en pantalla, el ícono puede quedar en cualquier punto de su ancho.
    const centro = a.left + a.width / 2 - left;

    return {
        arriba,
        left,
        top: arriba ? a.top - SALTO - h : a.bottom + SALTO,
        flecha: Math.min(Math.max(centro, 14), Math.max(14, w - 14)),
    };
};

const Tip = ({ texto, titulo }) => {
    const [abierto, setAbierto] = useState(false);
    const [pos, setPos] = useState(null);
    const ancla = useRef(null);
    const burbuja = useRef(null);

    const recalcular = useCallback(() => {
        if (ancla.current && burbuja.current) setPos(ubicar(ancla.current, burbuja.current));
    }, []);

    // Cerrar también borra la posición: la medición vieja es de otro scroll y otro tamaño de
    // ventana, y si se reusara la burbuja aparecería un instante en el lugar equivocado.
    const abrir = useCallback(() => setAbierto(true), []);
    const cerrar = useCallback(() => { setAbierto(false); setPos(null); }, []);

    // `useLayoutEffect` y no `useEffect`: la burbuja se monta sin coordenadas (invisible), se mide
    // y se ubica ANTES del primer pintado. Con `useEffect` se alcanza a ver el parpadeo arriba a
    // la izquierda, que es donde el navegador la deja mientras no tiene medidas.
    useLayoutEffect(() => {
        if (!abierto) return undefined;
        recalcular();
        // Scroll en fase de captura: el ancla puede estar dentro de un contenedor que scrollea por
        // su cuenta (`.tabs`, `.dock`, `.modal`) y esos eventos no burbujean hasta `window`. Se
        // reubica en vez de cerrar, para no perder la explicación a mitad de leerla.
        window.addEventListener('scroll', recalcular, true);
        window.addEventListener('resize', recalcular);
        return () => {
            window.removeEventListener('scroll', recalcular, true);
            window.removeEventListener('resize', recalcular);
        };
    }, [abierto, recalcular]);

    // Escape cierra: una burbuja abierta tapa contenido y con el teclado no hay "sacar el mouse de
    // encima". No se detiene la propagación —un tooltip no es un diálogo—, pero mientras está
    // abierto es lo primero que el Escape tiene que resolver.
    useEffect(() => {
        if (!abierto) return undefined;
        const escape = (e) => { if (e.key === 'Escape') cerrar(); };
        document.addEventListener('keydown', escape);
        return () => document.removeEventListener('keydown', escape);
    }, [abierto, cerrar]);

    if (!texto) return null;
    const etiqueta = `${titulo ? `${titulo}: ` : ''}${texto}`;

    return (
        <>
            <span ref={ancla} className="tip" tabIndex={0} role="note" aria-label={etiqueta}
                onMouseEnter={abrir} onMouseLeave={cerrar}
                onFocus={abrir} onBlur={cerrar}
                onClick={abierto ? cerrar : abrir}>
                <span className="tip-dot" aria-hidden="true">i</span>
            </span>
            {abierto && createPortal(
                <div className="dc-shell tip-capa">
                    {/* `aria-hidden` porque el texto ya viaja en el `aria-label` del ancla: sin
                        esto un lector de pantalla lo lee dos veces. */}
                    <span ref={burbuja} aria-hidden="true"
                        className={`tip-burbuja${pos && pos.arriba ? ' tip-burbuja--arriba' : ''}`}
                        style={pos
                            ? { top: pos.top, left: pos.left, '--flecha': `${pos.flecha}px` }
                            : { top: 0, left: 0, visibility: 'hidden' }}>
                        {titulo && <b>{titulo}</b>}
                        {texto}
                    </span>
                </div>,
                document.body,
            )}
        </>
    );
};

export default Tip;
