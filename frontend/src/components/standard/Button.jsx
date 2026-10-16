// Botones estándar. Dibujan con las clases de thalamus.css (btn, ibtn, link-btn), así que hoy solo se ven
// bien dentro de una raíz `.thalamus` (Thalamus, Inbox). El ícono es un nodo: <Icono n="plus" /> o uno de
// lucide. Todo lo demás (onClick, disabled, data-nav, autoFocus, ref…) pasa directo al <button>.

import { forwardRef } from 'react';
import clsx from 'clsx';

const VARIANT = {
    primary: 'btn--cta',        // la acción principal de la pantalla
    secondary: 'btn--linea',    // el resto de las acciones
    ghost: null,                // sin borde ni fondo
    danger: 'btn--peligro',     // abre una confirmación de borrado
    dangerSolid: 'btn--borrar', // confirma el borrado
};

export const Button = forwardRef(function Button({ variant = 'secondary', size = 'sm', icon, type = 'button', className, children, ...rest }, ref) {
    return (
        <button ref={ref} type={type} className={clsx('btn', VARIANT[variant], size === 'sm' && 'btn--sm', className)} {...rest}>
            {icon}{children}
        </button>
    );
});

// Botón de solo ícono. `label` es obligatorio: es lo que lee un lector de pantalla.
export const IconButton = forwardRef(function IconButton({ icon, label, size = 'md', danger = false, pressed, type = 'button', className, ...rest }, ref) {
    return (
        <button ref={ref} type={type} aria-label={label} aria-pressed={pressed}
            className={clsx('ibtn', size !== 'md' && 'ibtn--' + size, danger && 'ibtn--peligro', className)} {...rest}>
            {icon}
        </button>
    );
});

// Acción con aspecto de link, dentro de un texto o debajo de una lista («+ Opción»).
export const LinkButton = forwardRef(function LinkButton({ icon, subtle = false, type = 'button', className, children, ...rest }, ref) {
    return (
        <button ref={ref} type={type} className={clsx('link-btn', subtle && 'link-btn--sutil', className)} {...rest}>
            {icon}{children}
        </button>
    );
});
