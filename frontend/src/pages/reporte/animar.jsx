// Movimiento del reporte: números que cuentan, barras y anillos que se llenan al verse. Todo quieto
// con prefers-reduced-motion.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { partes } from './formato';

export const sinMovimiento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// `true` dos cuadros después de que `activo` pasa a true: así las barras arrancan en 0 y transicionan.
export function useListo(activo = true) {
    const [listo, setListo] = useState(false);
    useEffect(() => {
        if (!activo) return undefined;
        if (sinMovimiento()) { setListo(true); return undefined; }
        let b;
        const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setListo(true)); });
        return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
    }, [activo]);
    return listo;
}

// Se vuelve true la primera vez que el elemento entra en pantalla.
export function useAlVerse(ref) {
    const [visto, setVisto] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el || visto) return undefined;
        if (typeof IntersectionObserver === 'undefined') { setVisto(true); return undefined; }
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisto(true); obs.disconnect(); } }, { threshold: 0.15 });
        obs.observe(el);
        return () => obs.disconnect();
    }, [ref, visto]);
    return visto;
}

// Contexto: si el bloque ya se puede llenar (barras, anillos). Fuera de un proveedor, lleno.
export const AnimCtx = createContext(true);
export const useLleno = () => useContext(AnimCtx);

// Valor que cuenta desde 0 la primera vez que aparece; después cambia directo.
export function useCuenta(v, delay = 0) {
    const [actual, setActual] = useState(() => (sinMovimiento() || v == null ? v : 0));
    const animado = useRef(false);
    useEffect(() => {
        if (v == null || animado.current || sinMovimiento()) { setActual(v); return undefined; }
        animado.current = true;
        let id;
        const t0 = performance.now() + 150 + delay, dur = 1000;
        const tick = (t) => {
            const p = Math.min(1, Math.max(0, (t - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
            setActual(v * e);
            id = p < 1 ? requestAnimationFrame(tick) : null;
        };
        id = requestAnimationFrame(tick);
        // Cortada a mitad de camino (StrictMode o un valor nuevo): la próxima vuelve a contar.
        return () => { if (id) { cancelAnimationFrame(id); animado.current = false; } };
    }, [v, delay]);
    return v == null ? null : actual ?? 0;
}

// Número formateado que cuenta. null → «—».
export function Cuenta({ v, f = 'n', delay = 0 }) {
    const actual = useCuenta(v, delay);
    if (v == null) return <span className="rp-vacio">—</span>;
    const p = partes(actual, f);
    return <span>{p.txt}{p.suf && <small>{p.suf}</small>}{p.post}</span>;
}
