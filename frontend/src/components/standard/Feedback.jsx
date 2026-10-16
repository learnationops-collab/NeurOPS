// Estados de una pantalla y avisos: vacío/cargando, confirmación de borrado y la etiqueta (chip).

import clsx from 'clsx';
import { Button } from './Button';
import { Aura } from './Card';

// Lo que se muestra cuando no hay nada (o todavía está cargando). `title` va arriba del texto,
// `action` debajo y `aura` le pone fondo de color (la versión grande, para una sección vacía).
export function EmptyState({ icon, title, aura, action, className, children }) {
    return (
        <div className={clsx('ui-empty', className)}>
            {aura && <Aura colors={aura} size="hero" />}
            {icon}
            {title && <h2 className="ui-empty__title">{title}</h2>}
            {children && <p className="ui-empty__text">{children}</p>}
            {action}
        </div>
    );
}

// «¿Eliminar X? …» con Cancelar y Eliminar. `detail` sigue a la pregunta; `children` va en un párrafo
// aparte; `extraActions` va entre Cancelar y Eliminar. `article` es para «¿Eliminar a Juan?».
export function ConfirmDelete({ name, article = '', detail, onCancel, onConfirm, confirmLabel = 'Eliminar', icon, extraActions, autoFocusCancel = true, className, style, children }) {
    return (
        <div className={clsx('ui-confirm', className)} style={style} role="alertdialog" aria-label={'Eliminar ' + article + name}>
            <p>¿Eliminar {article}<b>{name}</b>?{detail ? ' ' : ''}{detail}</p>
            {children}
            <div className="ui-confirm__actions">
                <Button autoFocus={autoFocusCancel} onClick={onCancel}>Cancelar</Button>
                {extraActions}
                <Button variant="dangerSolid" icon={icon} onClick={onConfirm}>{confirmLabel}</Button>
            </div>
        </div>
    );
}

// Etiqueta de estado o categoría. `color` tiñe borde y texto; `subtle` es la versión sin mayúsculas;
// `square`, la de solo ícono. Con `as="button"` es un filtro que se prende y se apaga (aria-pressed).
export function Chip({ as: Tag = 'span', color, icon, subtle = false, square = false, className, style, children, ...rest }) {
    return (
        <Tag className={clsx('ui-chip', subtle && 'ui-chip--subtle', square && 'ui-chip--square', className)}
            style={color ? { '--c': color, ...style } : style} {...(Tag === 'button' ? { type: 'button' } : null)} {...rest}>
            {icon}{children}
        </Tag>
    );
}
