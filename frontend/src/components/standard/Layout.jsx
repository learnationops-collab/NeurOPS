// Contenedores y grillas: Panel (bloque de una pantalla), Grid (cómo se acomodan varios) y Kpi
// (número grande con su rótulo).

import { forwardRef } from 'react';
import clsx from 'clsx';
import { Aura } from './Card';
import './standard.css';

// size: md · sm. `aura` le pone fondo de color (y `soft` lo deja tenue), como a Card.
export function Panel({ as: Tag = 'div', size = 'md', aura, soft = false, className, children, ...rest }) {
    return (
        <Tag className={clsx('ui-panel', size === 'sm' && 'ui-panel--sm', aura && 'ui-panel--aura', className)} {...rest}>
            {aura && <Aura colors={aura} size="card" soft={soft} />}
            {children}
        </Tag>
    );
}

// variant: list (uno debajo del otro) · cards (tarjetas que se acomodan solas, desde 330px) · charts
// (gráficos, desde 380px) · kpis (4 columnas, 2 y 1 según el ancho) · column (bloques apilados).
export const Grid = forwardRef(function Grid({ as: Tag = 'div', variant = 'list', className, children, ...rest }, ref) {
    return <Tag ref={ref} className={clsx('ui-grid', 'ui-grid--' + variant, className)} {...rest}>{children}</Tag>;
});

// Número grande con su rótulo arriba y el detalle abajo (comparación, aclaración en <small>).
// `onSelect` lo vuelve un botón que abre los registros que lo componen (`useVerRegistros`).
export function Kpi({ label, value, aura, className, onSelect, selectLabel = 'Ver registros', children }) {
    const botonera = onSelect ? {
        role: 'button', tabIndex: 0, onClick: onSelect, 'aria-label': `${label}: ${value}. ${selectLabel}`,
        onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } },
    } : null;
    return (
        <div className={clsx('ui-kpi', onSelect && 'ui-kpi--select', className)} {...botonera}>
            {aura && <Aura colors={aura} />}
            <span className="ui-kpi__label">{label}</span>
            <span className="ui-kpi__value">{value}</span>
            {children != null && <div className="ui-kpi__detail">{children}</div>}
            {onSelect && <span className="ui-kpi__ver" aria-hidden="true">{selectLabel} ›</span>}
        </div>
    );
}
