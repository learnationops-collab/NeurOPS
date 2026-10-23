import { useEffect, useRef } from 'react';

/* Las piezas de la matriz de cierres que comparten sus tarjetas: la tasa que sube y el riel con
 * tramos apilados. Viven aparte de `MatrizCierres` para que `CierresReales` las use sin un import
 * circular; `MatrizCierres` re-exporta `Pct`, que el panel Estados importa desde allí. */

/** Lo que muestra `Pct` al final: la tasa con su `%`, o el conteo pelado si el sufijo es vacío. */
const textoDe = (valor, sufijo) => (valor === null || valor === undefined ? '—' : `${valor}${sufijo}`);

const quieto = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * La tasa grande sube de 0 a su valor (0,8 s, la misma curva que las barras).
 *
 * El conteo se escribe en el nodo desde el efecto y no por estado —como `Cifra` en el dashboard
 * comercial—: son unos cincuenta cuadros por cifra y no vale re-renderizar la tarjeta por cada uno.
 * El render ya deja el valor final, así que sin animación (movimiento reducido, pestaña oculta,
 * tests) se lee el número correcto desde el primer momento.
 *
 * Se exporta porque el panel Estados (`RepartoEstados`) cuenta sus porcentajes con la misma pieza.
 * Un `valor` en texto conserva sus decimales: "30.0" sube y termina en "30.0%", no en "30%".
 * `sufijo` vacío la vuelve un conteo: la tira de «No cerradas» sube su cantidad con la misma curva.
 */
export const Pct = ({ valor, className, sufijo = '%' }) => {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        const fin = Number(valor);
        if (!el || valor === null || valor === undefined || !Number.isFinite(fin) || quieto()) {
            return undefined;
        }
        const dec = (String(valor).split('.')[1] || '').length;
        let id = 0;
        let t0 = 0;
        const paso = (t) => {
            if (!t0) t0 = t;
            const k = Math.min((t - t0) / 800, 1);
            el.textContent = `${(fin * (1 - (1 - k) ** 3)).toFixed(dec)}${sufijo}`;
            if (k < 1) id = requestAnimationFrame(paso);
            else el.textContent = textoDe(valor, sufijo);
        };
        id = requestAnimationFrame(paso);
        // Solo se corta el conteo: si el valor cambió, React ya escribió el nuevo antes de esta
        // limpieza, y reponer acá el texto de este efecto dejaría el número viejo.
        return () => cancelAnimationFrame(id);
    }, [valor, sufijo]);
    return <b ref={ref} className={className}>{textoDe(valor, sufijo)}</b>;
};

export const acotar = (x) => Math.max(0, Math.min(100, Number(x) || 0));

/**
 * Riel con uno o más tramos apilados. Cada tramo crece desde 0 al montar (keyframes, sin JS: así
 * crece aunque el primer cuadro llegue tarde) y, si el dato cambia, se desliza a su ancho nuevo.
 * `demora` escalona: la barra rosa de las señas arranca después de la azul de las ventas, de
 * arriba hacia abajo, como se lee la tarjeta.
 */
export const Riel = ({ tramos, className }) => (
    <span className={`mc-riel${className ? ` ${className}` : ''}`} aria-hidden="true">
        {tramos.map(t => (
            <i key={t.tono} className={`mc-tramo mc-tramo--${t.tono}`}
                style={{ '--ancho': `${acotar(t.ancho)}%`, '--demora': `${t.demora || 0}ms` }} />
        ))}
    </span>
);

/** Un conteo: los enteros sin decimales, un promedio diario con uno solo. */
export const n = (valor) => {
    const x = Number(valor) || 0;
    return Number.isInteger(x) ? String(x) : x.toFixed(1);
};

export const plural = (valor, uno, varios) => `${n(valor)} ${Number(valor) === 1 ? uno : varios}`;

/** "12 de 84": el numerador resaltado, el resto apagado. */
export const Fraccion = ({ num, den }) => (
    <small className="mc-frac"><b>{n(num)}</b> de {n(den)}</small>
);
