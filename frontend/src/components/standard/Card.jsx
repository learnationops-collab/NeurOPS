// Tarjeta y su aura (las nubes de color difusas del fondo). La tarjeta no sabe qué muestra: el
// contenido y los colores del aura los pone la pantalla.

import clsx from 'clsx';
import './standard.css';

export const BRAND_AURA = ['var(--brand-secondary)', 'var(--brand-primary)', 'var(--brand-secondary-light)', 'var(--brand-navy)'];

// Hasta 4 colores. `size`: card (tarjeta) o hero (una sección entera); `soft` la deja más tenue.
export function Aura({ colors = BRAND_AURA, size, soft = false, className }) {
    const style = {};
    colors.forEach((c, i) => { style['--h' + (i + 1)] = c; });
    return <span className={clsx('ui-aura', size && 'ui-aura--' + size, soft && 'ui-aura--soft', className)} aria-hidden="true" style={style}><i /><i /><i /><i /></span>;
}

// `aura`: los colores del fondo (sin aura, una tarjeta lisa). `soft` la deja más tenue.
export function Card({ as: Tag = 'div', aura, soft = false, className, children, ...rest }) {
    return (
        <Tag className={clsx('ui-card', className)} {...rest}>
            {aura && <Aura colors={aura} size="card" soft={soft} />}
            {children}
        </Tag>
    );
}
