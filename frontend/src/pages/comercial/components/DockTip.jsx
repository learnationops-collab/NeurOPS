import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * El tooltip del dock (Mario, 26/11/2026: como el de Stats del Inbox, con nombre y una línea que dice qué es).
 * Un solo globo para todo el dock: cualquier botón con `data-dock-tip="Nombre|Qué es"` lo muestra arriba de él,
 * centrado (abajo si arriba no entra). Va en un portal con `dc-shell tip-capa` porque las islas del dock tienen
 * `backdrop-filter` y recortarían un `fixed` de adentro. Reemplaza al `title` nativo, que se cortaba («esperan tu…»).
 */
const AIRE = 10;
const MARGEN = 8;

export default function DockTip() {
    const [tip, setTip] = useState(null);
    const globo = useRef(null);
    useEffect(() => {
        const sobre = (e) => {
            const ancla = e.target.closest?.('[data-dock-tip]');
            if (!ancla) { setTip(null); return; }
            const [nombre, detalle] = ancla.getAttribute('data-dock-tip').split('|');
            setTip((t) => (t?.ancla === ancla ? t : { ancla, nombre, detalle, pos: null }));
        };
        const fuera = () => setTip(null);
        document.addEventListener('mouseover', sobre);
        document.addEventListener('pointerdown', fuera);
        window.addEventListener('scroll', fuera, true);
        return () => {
            document.removeEventListener('mouseover', sobre);
            document.removeEventListener('pointerdown', fuera);
            window.removeEventListener('scroll', fuera, true);
        };
    }, []);
    useLayoutEffect(() => {
        if (!tip || tip.pos || !globo.current) return;
        const a = tip.ancla.getBoundingClientRect();
        const { width: w, height: h } = globo.current.getBoundingClientRect();
        const arriba = a.top - AIRE - h >= MARGEN;
        const left = Math.min(Math.max(a.left + a.width / 2 - w / 2, MARGEN), window.innerWidth - w - MARGEN);
        setTip({ ...tip, pos: { left, top: arriba ? a.top - AIRE - h : a.bottom + AIRE, arriba } });
    }, [tip]);
    if (!tip) return null;
    return createPortal(
        <div className="dc-shell tip-capa">
            <div ref={globo} key={tip.nombre} role="tooltip" className={`dock-tip${tip.pos && !tip.pos.arriba ? ' dock-tip--abajo' : ''}`}
                style={tip.pos ? { left: tip.pos.left, top: tip.pos.top } : { visibility: 'hidden', left: 0, top: 0 }}>
                <b>{tip.nombre}</b>
                {tip.detalle && <span>{tip.detalle}</span>}
            </div>
        </div>,
        document.body,
    );
}
