import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SOURCE_STYLES } from '../metricSources';

/* Tooltip de procedencia para cualquier dato del dashboard.
 *
 * Se renderiza por portal en <body> porque casi todas las tarjetas tienen `overflow-hidden` o
 * scroll propio (la lista de cuotas, la tabla del ranking) y ahí un tooltip absoluto queda
 * recortado. A diferencia de StatTooltip (el de los paneles públicos, con colores slate fijos),
 * este usa los tokens de tema para verse igual en claro y oscuro.
 *
 * Se abre con hover, con foco de teclado y con click — el click es lo que lo hace usable en
 * touch, donde no hay hover.
 */

const TIP_WIDTH = 300;

const MetricTip = ({ title, formula, source = 'derivado', note, warning, children, iconOnly = false, className = '' }) => {
    const [coords, setCoords] = useState(null);
    const [pinned, setPinned] = useState(false);
    const triggerRef = useRef(null);

    const place = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const margin = 12;
        const center = rect.left + rect.width / 2;
        let left = center - TIP_WIDTH / 2;
        left = Math.max(margin, Math.min(left, window.innerWidth - TIP_WIDTH - margin));
        // Arriba por defecto; abajo si no entra (tarjetas de la primera fila).
        const below = rect.top < 260;
        setCoords({
            top: (below ? rect.bottom + 8 : rect.top - 8) + window.scrollY,
            left: left + window.scrollX,
            below,
            arrow: Math.max(14, Math.min(TIP_WIDTH - 14, center - left))
        });
    }, []);

    const close = useCallback(() => { setCoords(null); setPinned(false); }, []);

    useEffect(() => {
        if (!coords) return;
        const onScroll = () => close();
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
            window.removeEventListener('keydown', onKey);
        };
    }, [coords, close]);

    const src = SOURCE_STYLES[source] || SOURCE_STYLES.derivado;

    return (
        <>
            <button
                type="button"
                ref={triggerRef}
                onMouseEnter={place}
                onMouseLeave={() => { if (!pinned) setCoords(null); }}
                onFocus={place}
                onBlur={close}
                onClick={(e) => {
                    e.stopPropagation();
                    if (pinned) { close(); } else { place(); setPinned(true); }
                }}
                aria-label={`De dónde sale: ${title}`}
                className={`text-left cursor-help align-middle ${iconOnly ? 'inline-flex items-center' : 'inline'} ${className}`}
            >
                {iconOnly ? (
                    <span
                        className="inline-grid place-items-center w-3.5 h-3.5 rounded-full border text-[8px] font-black leading-none transition-colors"
                        style={{ borderColor: `${src.color}66`, color: src.color }}
                    >
                        i
                    </span>
                ) : (
                    <span className="underline decoration-dotted underline-offset-4 decoration-[1.5px]" style={{ textDecorationColor: `${src.color}88` }}>
                        {children}
                    </span>
                )}
            </button>

            {coords && createPortal(
                <div
                    role="tooltip"
                    className="fixed z-[99999] rounded-2xl border border-base bg-surface shadow-2xl p-4 text-left animate-in fade-in duration-150"
                    style={{
                        width: TIP_WIDTH,
                        top: coords.top - window.scrollY,
                        left: coords.left - window.scrollX,
                        transform: coords.below ? 'none' : 'translateY(-100%)',
                        pointerEvents: 'none'
                    }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <span
                            className="text-[8.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border"
                            style={{ color: src.color, borderColor: `${src.color}44`, background: `${src.color}14` }}
                        >
                            {src.label}
                        </span>
                    </div>
                    <p className="text-[12px] font-black text-base leading-tight">{title}</p>
                    {formula && (
                        <p className="text-[10.5px] text-muted mt-2 font-mono leading-snug bg-main/60 border border-base rounded-lg px-2 py-1.5">
                            {formula}
                        </p>
                    )}
                    {note && <p className="text-[10.5px] text-muted mt-2 leading-snug">{note}</p>}
                    {warning && (
                        <p className="text-[10.5px] text-amber-400 mt-2 leading-snug font-semibold">⚠️ {warning}</p>
                    )}
                </div>,
                document.body
            )}
        </>
    );
};

export default MetricTip;
