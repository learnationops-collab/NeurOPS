import { fmtInt, fmtPct } from './modelo';

/**
 * Movimiento del reporte: se pregunta en cada animación (quien activa "reducir movimiento" con la
 * pantalla abierta deja de verlas sin recargar). Sin `matchMedia` —los tests— cuenta como
 * reducido: el número final se lee desde el primer momento, sin esperar cuadros.
 */
export const reducido = () => typeof window === 'undefined'
    || typeof window.matchMedia !== 'function'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Lleva el texto de `el` hasta `destino` contando desde lo que mostraba (el `tween` del diseño).
 * Escribe en el nodo y no por estado: son decenas de cifras a la vez mientras se arrastra una celda.
 * Durante el conteo un porcentaje va sin decimales y el último cuadro deja el formato final.
 */
export function contar(el, destino, tipo) {
    if (!el) return;
    const fmt = tipo === 'pct' ? fmtPct : fmtInt;
    cancelAnimationFrame(el._rdRaf);
    if (destino === null || destino === undefined) {
        el._rdV = null;
        el.textContent = '—';
        return;
    }
    const desde = el._rdV ?? 0;
    el._rdV = destino;
    if (reducido() || desde === destino) {
        el.textContent = fmt(destino);
        return;
    }
    const t0 = performance.now();
    const dur = 640;
    const paso = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const v = desde + (destino - desde) * (1 - (1 - p) ** 3);
        el.textContent = p < 1 ? (tipo === 'pct' ? `${Math.round(v)}%` : fmtInt(v)) : fmt(destino);
        if (p < 1) el._rdRaf = requestAnimationFrame(paso);
    };
    el._rdRaf = requestAnimationFrame(paso);
}

/** Reinicia una animación CSS de una clase (el "bump" del número, la "llegada" a una celda). */
export function reanimar(el, clase) {
    if (!el || reducido()) return;
    el.classList.remove(clase);
    // Forzar el reflow es lo que hace que la misma clase vuelva a arrancar la animación.
    // eslint-disable-next-line no-unused-expressions
    el.offsetWidth;
    el.classList.add(clase);
}
