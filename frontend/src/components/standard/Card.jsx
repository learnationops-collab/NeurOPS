// Tarjeta y su aura (las nubes de color difusas del fondo). La tarjeta no sabe qué muestra: el
// contenido y los colores del aura los pone la pantalla.

import clsx from 'clsx';

export const BRAND_AURA = ['var(--brand-secondary)', 'var(--brand-primary)', 'var(--brand-secondary-light)', 'var(--brand-navy)'];

// Hasta 4 colores. `className` elige el tamaño de las nubes (humo--tarjeta, humo--hero…).
export function Aura({ colors = BRAND_AURA, className }) {
    const style = {};
    colors.forEach((c, i) => { style['--h' + (i + 1)] = c; });
    return <span className={clsx('humo', className)} aria-hidden="true" style={style}><i /><i /><i /><i /></span>;
}

// `aura`: los colores del fondo (sin aura, una tarjeta lisa). `soft` la deja más tenue.
export function Card({ as: Tag = 'div', aura, soft = false, className, children, ...rest }) {
    return (
        <Tag className={clsx('tarjeta caja', className)} {...rest}>
            {aura && <Aura colors={aura} className={clsx('humo--tarjeta', soft && 'humo--suave')} />}
            {children}
        </Tag>
    );
}
