// Esqueletos de carga: la forma de lo que va a llegar, con un brillo que la recorre, en vez de un
// círculo girando. Cada bloque de una pantalla muestra SU esqueleto hasta que llega SU dato.
//
// Piezas: SkeletonBlock (rectángulo), SkeletonText (renglones), SkeletonCircle (avatar).
// Composiciones: SkeletonKpi, SkeletonRow, SkeletonPanel, SkeletonChart.
// Envoltorio accesible: Skeleton (role="status" + texto para el lector). Entrada del dato: Reveal.
//
// Las medidas imitan al contenido real: un esqueleto que mide distinto que lo que reemplaza hace
// saltar todo lo de abajo al llegar los datos, y eso es peor que un spinner.

import { Children, useCallback, useRef, useState } from 'react';
import clsx from 'clsx';
import './standard.css';

const STEP_MS = 60;
const MAX_STEP = 24;

/** El retraso de entrada del elemento número `i` de una tanda, con tope (el 40 no espera 2,4 s). */
export const skeletonDelay = (i, step = STEP_MS) => Math.min(Math.max(i, 0), MAX_STEP) * step;

// Lo que tarda en terminar de entrar el último de una tanda: el tope, la entrada (.34 s) y un margen.
const ENTRY_WINDOW_MS = skeletonDelay(MAX_STEP) + 340 + 260;

/**
 * La ventana en la que las filas reales entran escalonadas al reemplazar a un esqueleto: `open()`
 * al terminar la carga, y lo que se monte después (una fila que vuelve con el buscador) entra sin
 * esperar. `open` es estable. Devuelve `[entering, open]`.
 */
export function useEntryWindow() {
    const [entering, setEntering] = useState(false);
    const timer = useRef(null);
    const open = useCallback(() => {
        setEntering(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setEntering(false), ENTRY_WINDOW_MS);
    }, []);
    return [entering, open];
}

const px = (v) => (typeof v === 'number' ? `${v}px` : v);

/** Envoltorio de un esqueleto: lo anuncia como «cargando»; los huesos de adentro son decorativos. */
export function Skeleton({ label = 'Cargando…', as: Tag = 'div', className, children, ...rest }) {
    return (
        <Tag role="status" aria-busy="true" aria-label={label} className={clsx('ui-skel', className)} {...rest}>
            <span className="ui-skel__sr">{label}</span>
            {children}
        </Tag>
    );
}

/** El hueso: un rectángulo con el brillo. `step` es su lugar en la ola (ver skeletonDelay). */
export function SkeletonBlock({ width, height = 14, radius, step = 0, className, style }) {
    return (
        <span aria-hidden="true" className={clsx('ui-skel-bone', className)}
            style={{ width: px(width), height: px(height), borderRadius: px(radius), '--ui-skel-delay': `${skeletonDelay(step)}ms`, ...style }} />
    );
}

export function SkeletonCircle({ size = 38, step = 0, className, style }) {
    return <SkeletonBlock width={size} height={size} radius="50%" step={step} className={clsx('ui-skel-bone--round', className)} style={style} />;
}

/**
 * Renglones de texto. Cada renglón ocupa el alto de la LÍNEA real (`lineHeight`, la letra por el
 * interlineado) con el hueso más bajo centrado adentro: así mide lo mismo que el texto.
 */
export function SkeletonText({ lines = 1, width = '100%', lastWidth = '62%', height = 10, lineHeight, step = 0, className, style }) {
    return (
        <span aria-hidden="true" className={clsx('ui-skel-text', className)} style={style}>
            {Array.from({ length: lines }, (_, i) => (
                <span key={i} className="ui-skel-line" style={{ height: px(lineHeight ?? height) }}>
                    <SkeletonBlock height={height} width={lines > 1 && i === lines - 1 ? lastWidth : width} step={step + i} />
                </span>
            ))}
        </span>
    );
}

/**
 * Un KPI: rótulo, cifra y detalle. `className` es la clase de la tarjeta REAL (por defecto la de
 * `Kpi`), así el esqueleto hereda su padding, su gap y su borde y mide lo mismo.
 */
export function SkeletonKpi({ className = 'ui-kpi', valueHeight = 38, valueWidth = '58%', lineHeight = 16, detail = true, step = 0, style }) {
    return (
        <div aria-hidden="true" className={className} style={style}>
            <SkeletonText width="44%" lineHeight={lineHeight} step={step} />
            <SkeletonBlock width={valueWidth} height={valueHeight} radius={10} step={step + 1} />
            {detail && <SkeletonText width="66%" lineHeight={lineHeight} step={step + 2} />}
        </div>
    );
}

/**
 * Una fila de lista o tabla. `cells` son los anchos de los huesos, uno por columna; `columns` es la
 * grilla de la fila real (por defecto, columnas iguales). `avatar` suma un círculo adelante.
 */
export function SkeletonRow({ cells = ['42%', '70%', '50%', '36%'], columns, avatar = false, height = 44, step = 0, className, style }) {
    const template = columns || `${avatar ? 'auto ' : ''}repeat(${cells.length}, minmax(0, 1fr))`;
    return (
        <div aria-hidden="true" className={clsx('ui-skel-row', className)} style={{ gridTemplateColumns: template, minHeight: px(height), ...style }}>
            {avatar && <SkeletonCircle size={28} step={step} />}
            {cells.map((w, i) => <SkeletonBlock key={i} width={w} height={10} step={step + i} />)}
        </div>
    );
}

/**
 * Un panel con su título y renglones (o lo que vaya en `children`). `className` es la del panel
 * real; `rows` filas de `rowHeight`.
 */
export function SkeletonPanel({ className = 'ui-panel', title = true, titleWidth = 160, rows = 5, rowHeight = 26, step = 0, children, style }) {
    return (
        <div aria-hidden="true" className={className} style={style}>
            {title && <SkeletonText width={titleWidth} height={14} lineHeight={28} step={step} className="ui-skel-title" />}
            {Children.count(children) ? children : (
                <div className="ui-skel-stack">
                    {Array.from({ length: rows }, (_, i) => <SkeletonBlock key={i} height={rowHeight} step={step + i + 1} />)}
                </div>
            )}
        </div>
    );
}

// Alturas fijas (no al azar): el esqueleto se ve igual en cada carga y en los tests.
const BARS = [46, 62, 38, 74, 58, 86, 52, 68, 44, 80, 60, 72, 50, 90, 64, 56];

/** Un gráfico: título y el área del gráfico, en barras (`variant="bars"`) o un bloque (`"area"`). */
export function SkeletonChart({ className = 'ui-panel', height = 220, bars = 12, variant = 'bars', title = true, step = 0, style }) {
    return (
        <SkeletonPanel className={className} title={title} step={step} style={style}>
            {variant === 'area' ? <SkeletonBlock height={height} step={step + 1} /> : (
                <div className="ui-skel-bars" style={{ height: px(height) }}>
                    {Array.from({ length: bars }, (_, i) => (
                        <SkeletonBlock key={i} height={`${BARS[i % BARS.length]}%`} radius={6} step={step + 1 + i} />
                    ))}
                </div>
            )}
        </SkeletonPanel>
    );
}

/**
 * Muestra `skeleton` hasta que `ready`, y después `children` con una entrada corta (sube 6 px y
 * aparece; nada si el sistema pide menos movimiento). `delay` en ms escalona varios bloques. Si el
 * envoltorio estorba en la grilla de la pantalla, poné la clase `ui-reveal` en el elemento propio.
 */
export function Reveal({ ready, skeleton = null, as: Tag = 'div', delay = 0, className, style, children, ...rest }) {
    if (!ready) return skeleton;
    return (
        <Tag className={clsx('ui-reveal', className)} style={{ '--ui-reveal-delay': `${delay}ms`, ...style }} {...rest}>
            {children}
        </Tag>
    );
}
