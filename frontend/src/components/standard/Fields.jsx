// Campos estándar: Input (campo suelto), InputGroup (campo con ícono o prefijo adelante y, a veces, un
// botón pegado: «Nuevo evento… [Crear]») y FieldError (el mensaje de error debajo de un campo).

import { forwardRef } from 'react';
import clsx from 'clsx';
import './standard.css';

// variant: number (número corto y centrado) · date. `invalid` lo marca en rojo. `as="textarea"` para texto largo.
export const Input = forwardRef(function Input({ as: Tag = 'input', variant, invalid = false, className, ...rest }, ref) {
    return <Tag ref={ref} className={clsx('ui-input', variant && 'ui-input--' + variant, invalid && 'is-invalid', className)} {...rest} />;
});

// El input va como hijo, sin clase: el grupo lo dibuja. `prefix`: ícono o texto fijo adelante.
// Con `as="form"`, Enter envía y el botón de tipo submit queda pegado a la derecha.
export function InputGroup({ as: Tag = 'div', prefix, invalid = false, className, children, ...rest }) {
    return (
        <Tag className={clsx('ui-entry', invalid && 'is-invalid', className)} {...rest}>
            {prefix != null && prefix !== false && <span className="ui-entry__prefix">{prefix}</span>}
            {children}
        </Tag>
    );
}

// Mensaje de error de un campo. role="alert" lo anuncia apenas aparece (para una aclaración, role="note").
export function FieldError({ as: Tag = 'p', icon = true, className, children, ...rest }) {
    return (
        <Tag className={clsx('ui-field-error', className)} role="alert" {...rest}>
            {icon && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                    width={14} height={14} aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
            )}
            {children}
        </Tag>
    );
}
