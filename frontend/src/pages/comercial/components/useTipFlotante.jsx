import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ubicar } from './Tip';

/**
 * La burbuja del «i» (`Tip`) para cosas que no son un ícono: una barra o una píldora de un SVG.
 * Una sola burbuja por componente, que se ancla al elemento que está bajo el mouse o el foco.
 *
 *   const { de, capa } = useTipFlotante();
 *   <g {...de('Texto corto', 'Título opcional', { sobre: '.numero' })}>…</g>
 *   {capa}
 *
 * Es la misma burbuja y la misma medición (`ubicar`: entra en pantalla, abajo o arriba), así que se
 * ve igual que el resto del tablero. Reemplaza al `<title>` nativo, que tarda ~1 s, no tiene estilo
 * ni abre con el dedo.
 *
 * Con el dedo el toque alterna la burbuja; `tactil: false` lo deja para lo que ya hace algo al
 * tocarse (una etapa con lista): ahí manda su clic y la burbuja abre solo con hover o foco.
 */
export const useTipFlotante = () => {
    const [tip, setTip] = useState(null);
    const [pos, setPos] = useState(null);
    const burbuja = useRef(null);

    const cerrar = useCallback(() => { setTip(null); setPos(null); }, []);

    // Igual que `Tip`: se mide antes del primer pintado, para que no parpadee arriba a la izquierda.
    useLayoutEffect(() => {
        if (!tip) return undefined;
        const medir = () => {
            if (tip.ancla?.isConnected && burbuja.current) setPos(ubicar(tip.ancla, burbuja.current));
        };
        medir();
        window.addEventListener('scroll', medir, true);
        window.addEventListener('resize', medir);
        return () => {
            window.removeEventListener('scroll', medir, true);
            window.removeEventListener('resize', medir);
        };
    }, [tip]);

    useEffect(() => {
        if (!tip) return undefined;
        const escape = (e) => { if (e.key === 'Escape') cerrar(); };
        document.addEventListener('keydown', escape);
        return () => document.removeEventListener('keydown', escape);
    }, [tip, cerrar]);

    const de = useCallback((texto, titulo, { tactil = true, sobre = null } = {}) => {
        if (!texto) return {};
        // `sobre`: el hijo al que se pega la burbuja (el número, no todo el grupo con su rótulo).
        const anclaDe = (e) => (sobre && e.currentTarget.querySelector(sobre)) || e.currentTarget;
        const abrir = (e) => setTip({ ancla: anclaDe(e), texto, titulo });
        return {
            onMouseEnter: abrir, onMouseLeave: cerrar, onFocus: abrir, onBlur: cerrar,
            onPointerDown: tactil ? (e) => {
                if (e.pointerType === 'mouse') return;
                if (tip?.ancla === anclaDe(e)) cerrar(); else abrir(e);
            } : undefined,
        };
    }, [cerrar, tip]);

    const capa = tip && createPortal(
        <div className="dc-shell tip-capa">
            {/* El texto ya viaja en el `aria-label` de cada pieza: no se lee dos veces. */}
            <span ref={burbuja} aria-hidden="true"
                className={`tip-burbuja${pos && pos.arriba ? ' tip-burbuja--arriba' : ''}`}
                style={pos
                    ? { top: pos.top, left: pos.left, maxHeight: pos.alto, overflowY: 'auto',
                        '--flecha': `${pos.flecha}px`, '--flecha-visible': pos.conFlecha ? 1 : 0 }
                    : { top: 0, left: 0, visibility: 'hidden' }}>
                {tip.titulo && <b>{tip.titulo}</b>}
                {tip.texto}
            </span>
        </div>,
        document.body,
    );

    return { de, capa };
};
