import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { subirACapa } from '../../../../../components/standard/capa';
import { EST } from './modelo';

/**
 * El estado del pago de una persona: un botón con su punto de color y un menú propio (nada de
 * `<select>` nativo, pedido de Mario) con Pendiente, En tránsito (salió de Mercury a Wise y todavía no
 * llegó a AirTM), Pagado y A revisar. El menú va en la capa superior y sigue al botón al scrollear.
 */
const MenuEstado = ({ persona, onElegir, deshabilitado = false }) => {
    const [abierto, setAbierto] = useState(false);
    const [pop, setPop] = useState(false);
    const boton = useRef(null);
    const menu = useRef(null);
    const [c, color] = [EST[persona.estado] || EST.pendiente, (EST[persona.estado] || EST.pendiente)[1]];

    const ubicar = () => {
        const b = boton.current, m = menu.current;
        if (!b || !m) return;
        const r = b.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
        if (r.bottom < 0 || r.top > window.innerHeight) { setAbierto(false); return; }
        const x = Math.min(window.innerWidth - w - 12, Math.max(12, r.right - w));
        let y = r.bottom + 8;
        if (y + h > window.innerHeight - 110) y = Math.max(12, r.top - h - 8);
        m.style.left = `${x}px`;
        m.style.top = `${y}px`;
    };

    useLayoutEffect(() => {
        if (!abierto) return;
        subirACapa(menu.current);
        ubicar();
        menu.current?.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true });
    }, [abierto]);

    useEffect(() => {
        if (!abierto) return undefined;
        const afuera = (e) => {
            if (!menu.current?.contains(e.target) && !boton.current?.contains(e.target)) setAbierto(false);
        };
        document.addEventListener('pointerdown', afuera);
        window.addEventListener('scroll', ubicar, { passive: true, capture: true });
        window.addEventListener('resize', ubicar);
        return () => {
            document.removeEventListener('pointerdown', afuera);
            window.removeEventListener('scroll', ubicar, { capture: true });
            window.removeEventListener('resize', ubicar);
        };
    }, [abierto]);

    const elegir = (v) => {
        setAbierto(false);
        if (v !== persona.estado) {
            onElegir(v);
            setPop(true);
        }
        boton.current?.focus();
    };
    const teclas = (e) => {
        const it = [...menu.current.querySelectorAll('[data-ev]')];
        const i = it.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); it[(i + 1) % it.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); it[(i - 1 + it.length) % it.length].focus(); }
        else if (e.key === 'Escape') { setAbierto(false); boton.current?.focus(); }
    };

    return (
        <>
            <button ref={boton} type="button" className={`estb${pop ? ' pop' : ''}`} aria-haspopup="menu" aria-expanded={abierto}
                aria-label={`Estado de ${persona.n}: ${c[0]}`} style={{ '--sc': color }} disabled={deshabilitado}
                title={deshabilitado ? 'Elegí un mes para marcar pagos' : undefined}
                onAnimationEnd={() => setPop(false)} onClick={() => setAbierto((a) => !a)}>
                <i /><span>{c[0]}</span>
                <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" /></svg>
            </button>
            {abierto && (
                <div ref={menu} className="estm" role="menu" onKeyDown={teclas}>
                    {Object.entries(EST).map(([v, [l, col, d]], i) => (
                        <button key={v} type="button" role="menuitemradio" aria-checked={v === persona.estado} data-ev={v}
                            style={{ '--sc': col, '--d': `${i * 0.035}s` }} onClick={() => elegir(v)}>
                            <i /><span><b>{l}</b><small>{d}</small></span>
                            {v === persona.estado && <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>}
                        </button>
                    ))}
                </div>
            )}
        </>
    );
};

export default MenuEstado;
