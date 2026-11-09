import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

/**
 * La comparación de una cifra con el período comparado, en una línea (09/11/2026, pedido de Mario: «2 ventas
 * versus tantas el período anterior», en cada número). El período se nombra una vez, en la cabecera del panel;
 * acá van el valor de antes y el cambio relativo. `mejorBaja`: si bajar es bueno (no cerradas, CAC).
 */
export const cambioRelativo = (actual, previo) => {
    if (actual == null || previo == null || actual === previo) return null;
    if (!previo) return { nuevo: true, sube: actual > 0 };
    return { rel: Math.round(Math.abs((actual - previo) / previo) * 100), sube: actual > previo };
};

/** El chip del cambio: flecha y %, verde si mejoró y rojo si empeoró. */
export const Delta = ({ actual, previo, mejorBaja = false }) => {
    const c = cambioRelativo(actual, previo);
    if (!c) return <small className="vsp-d vsp-d--igual num">=</small>;
    const bueno = c.sube !== mejorBaja;
    const Icono = c.sube ? ArrowUpRight : ArrowDownRight;
    return (
        <small className={`vsp-d vsp-d--${bueno ? 'bien' : 'mal'} num`}>
            <Icono size={12} strokeWidth={2.6} aria-hidden="true" />
            {c.nuevo ? 'nuevo' : `${c.rel}%`}
        </small>
    );
};

/** «antes 4 ↘ 50%»: el valor de antes y el chip. `texto` es cómo se escribe el de antes («19%», «4/21»). */
const VsPrevio = ({ actual, previo, texto, detalle, mejorBaja = false, vs, className = '' }) => {
    if (previo == null) return null;
    return (
        <span className={`vsp ${className}`} title={`${vs || 'Período comparado'}: ${texto}${detalle ? ` (${detalle})` : ''}`}>
            <small className="vsp-rot">antes</small>
            <b className="vsp-n num">{texto}</b>
            <Delta actual={actual} previo={previo} mejorBaja={mejorBaja} />
        </span>
    );
};

export default VsPrevio;
