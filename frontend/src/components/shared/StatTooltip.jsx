import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * StatTooltip - Componente premium para mostrar explicaciones y cálculos al pasar el mouse por números o porcentajes.
 * Utiliza React Portals (renderizado en document.body) para garantizar que el tooltip nunca sea recortado por
 * contenedores con 'overflow-hidden' o 'overflow-x-auto', y siempre se muestre al frente (z-index absoluto).
 */
const StatTooltip = ({ label, value, calculation, calcLabel, children }) => {
    const [coords, setCoords] = useState(null);
    const [arrowLeft, setArrowLeft] = useState('50%');
    const triggerRef = useRef(null);

    const handleMouseEnter = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const tooltipWidth = 256; // w-64
        const margin = 16;
        const viewportWidth = window.innerWidth;

        // Centro horizontal del trigger
        const targetCenter = rect.left + rect.width / 2;
        let idealLeft = targetCenter - tooltipWidth / 2;

        // Evitar desbordamiento por la izquierda o derecha
        if (idealLeft < margin) {
            idealLeft = margin;
        } else if (idealLeft + tooltipWidth > viewportWidth - margin) {
            idealLeft = viewportWidth - tooltipWidth - margin;
        }

        // Alinear la flecha con el trigger (reducido por los bordes redondeados)
        const arrowPos = targetCenter - idealLeft;
        const clampedArrowPos = Math.max(12, Math.min(tooltipWidth - 12, arrowPos));

        setCoords({
            top: rect.top + window.scrollY,
            left: idealLeft + window.scrollX
        });
        setArrowLeft(`${clampedArrowPos}px`);
    };

    const handleMouseLeave = () => {
        setCoords(null);
    };

    return (
        <>
            <span
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="relative inline-block cursor-help underline decoration-dotted decoration-indigo-500/50 hover:text-indigo-400 transition-colors"
            >
                {children || value}
            </span>
            {coords && createPortal(
                <span
                    className="absolute bg-slate-950 text-slate-200 text-[10px] font-normal normal-case tracking-normal rounded-xl p-3.5 z-[99999] shadow-2xl border border-slate-800/80 leading-relaxed text-left w-64 animate-in fade-in duration-200"
                    style={{
                        top: `${coords.top - 10}px`,
                        left: `${coords.left}px`,
                        transform: 'translateY(-100%)',
                        pointerEvents: 'none'
                    }}
                >
                    <span className="block font-black text-indigo-400 uppercase tracking-widest text-[9px] mb-1.5">{label}</span>
                    {value !== undefined && value !== null && (
                        <span className="block text-slate-300 text-xs font-black italic tracking-tighter mb-2 border-b border-slate-900 pb-1.5">
                            {value}
                        </span>
                    )}
                    <span className="block text-[9px] text-slate-400 leading-normal">
                        {calcLabel !== null && calcLabel !== false && (
                            <strong className="text-slate-305 font-bold uppercase tracking-wider text-[8px] block mb-0.5">
                                {calcLabel || "Fórmula / Explicación:"}
                            </strong>
                        )}
                        {calculation}
                    </span>
                    <span 
                        className="absolute top-full border-4 border-transparent border-t-slate-950"
                        style={{ left: arrowLeft, transform: 'translateX(-50%)' }}
                    ></span>
                </span>,
                document.body
            )}
        </>
    );
};

export default StatTooltip;
