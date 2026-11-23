// Cualquier número clickeable del reporte: abre su detalle (DetalleNumero) con su `clave`.
import { createContext, useContext } from 'react';
import clsx from 'clsx';

export const DetalleCtx = createContext(() => {});
export const useAbrirDetalle = () => useContext(DetalleCtx);

// dato: { clave, l, v, f, mano, corr, ctx, fecha }. Sin clave queda quieto.
export default function Exp({ as: Tag = 'div', dato, className, children, ...rest }) {
    const abrir = useAbrirDetalle();
    if (!dato?.clave) return <Tag className={className} {...rest}>{children}</Tag>;
    const ir = (e) => {
        // Un campo o botón de adentro (corregir una celda) no abre el detalle.
        const control = e.target.closest('input,textarea,select,button');
        if (control && control !== e.currentTarget && e.currentTarget.contains(control)) return;
        abrir(dato);
    };
    return (
        <Tag className={clsx('rp-exp', className)} data-exp="" tabIndex={0} role="button" aria-label={`Ver detalle de ${dato.l}`}
            onClick={ir}
            onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrir(dato); } }}
            {...rest}>
            {children}
        </Tag>
    );
}
