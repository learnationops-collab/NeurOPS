import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Un `<select>` con la flecha que `.ln-field` le saca (`appearance:none`).
 *
 * Lo comparten los editores en el sitio del historial —el de una agenda y el de un seguimiento—
 * para que los dos desplegables se vean y se comporten igual.
 */
const Desplegable = ({ id, etiqueta, valor, onCambiar, disabled, children }) => (
    <span className="ln-field" style={{ height: 44, position: 'relative' }}>
        <select id={id} value={valor} disabled={disabled} aria-label={etiqueta}
            onChange={(e) => onCambiar(e.target.value)} style={{ paddingRight: 24 }}>
            {children}
        </select>
        <ChevronDown aria-hidden="true" style={{ position: 'absolute', right: 14, pointerEvents: 'none' }} />
    </span>
);

export default Desplegable;
