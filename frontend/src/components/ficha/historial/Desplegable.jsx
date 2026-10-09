import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Un `<select>` con la flecha que `.ln-field` le saca (`appearance:none`).
 *
 * Lo comparten los editores en el sitio del historial —el de una agenda y el de un seguimiento—
 * para que los dos desplegables se vean y se comporten igual, y la fuente de la cabecera, que va
 * a la altura de sus campos (`alto`) y pinta su error como ellos (`invalido`). El resto de las
 * props (un `aria-describedby`) van al `<select>`.
 */
const Desplegable = ({
    id, etiqueta, valor, onCambiar, disabled, alto = 44, invalido = false, children, ...resto
}) => (
    <span className={`ln-field${invalido ? ' ln-field--invalid' : ''}`}
        style={{ height: alto, position: 'relative' }}>
        <select id={id} value={valor} disabled={disabled} aria-label={etiqueta}
            aria-invalid={invalido || undefined} {...resto}
            onChange={(e) => onCambiar(e.target.value)} style={{ paddingRight: 24 }}>
            {children}
        </select>
        <ChevronDown aria-hidden="true" style={{ position: 'absolute', right: 14, pointerEvents: 'none' }} />
    </span>
);

export default Desplegable;
