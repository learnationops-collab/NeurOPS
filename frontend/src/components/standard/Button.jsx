// Botones estándar (estilos en standard.css). El ícono es un nodo: <Icono n="plus" /> o uno de lucide. Todo lo demás (onClick, disabled, data-nav, autoFocus, ref…) pasa directo al <button>.

import { forwardRef } from 'react';
import clsx from 'clsx';
import './standard.css';

const VARIANT = {
    primary: 'ui-btn--primary',          // la acción principal de la pantalla
    secondary: 'ui-btn--secondary',      // el resto de las acciones
    ghost: null,                         // sin borde ni fondo
    danger: 'ui-btn--danger',            // abre una confirmación de borrado
    dangerSolid: 'ui-btn--danger-solid', // confirma el borrado
};

export const Button = forwardRef(function Button({ variant = 'secondary', size = 'sm', icon, type = 'button', className, children, ...rest }, ref) {
    return (
        <button ref={ref} type={type} className={clsx('ui-btn', VARIANT[variant], size === 'sm' && 'ui-btn--sm', className)} {...rest}>
            {icon}{children}
        </button>
    );
});

// Botón de solo ícono. `label` es obligatorio: es lo que lee un lector de pantalla.
export const IconButton = forwardRef(function IconButton({ icon, label, size = 'md', danger = false, pressed, type = 'button', className, ...rest }, ref) {
    return (
        <button ref={ref} type={type} aria-label={label} aria-pressed={pressed}
            className={clsx('ui-ibtn', size !== 'md' && 'ui-ibtn--' + size, danger && 'ui-ibtn--danger', className)} {...rest}>
            {icon}
        </button>
    );
});

// Acción con aspecto de link, dentro de un texto o debajo de una lista («+ Opción»).
export const LinkButton = forwardRef(function LinkButton({ icon, subtle = false, type = 'button', className, children, ...rest }, ref) {
    return (
        <button ref={ref} type={type} className={clsx('ui-link', subtle && 'ui-link--subtle', className)} {...rest}>
            {icon}{children}
        </button>
    );
});
