import React, { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import { IconButton, LinkButton } from '../../standard';

/**
 * El comprobante del pago que se está registrando (ADR-W088). Es opcional: sin archivo, el pago queda
 * «Sin comprobante» y se sube después desde el historial. Con archivo, se sube apenas se guarda la
 * venta y Learnito lo lee.
 */
const ACEPTA = 'image/*,application/pdf,text/csv,.csv,.txt';

const ComprobanteDeVenta = ({ archivo, onCambiar, disabled = false }) => {
    const input = useRef(null);
    return (
        <div className="fi-campo" style={{ display: 'grid', gap: 4 }}>
            <span className="t-rotulo">Comprobante del pago</span>
            <input ref={input} type="file" accept={ACEPTA} hidden
                onChange={(e) => { onCambiar(e.target.files?.[0] || null); e.target.value = ''; }} />
            {archivo ? (
                <span className="fila" style={{ gap: 'var(--s2)', alignItems: 'center' }}>
                    <Paperclip size={14} aria-hidden="true" />
                    <span className="t-sm trunc" style={{ maxWidth: 260 }}>{archivo.name}</span>
                    <IconButton size="xs" icon={<X />} label="Quitar el comprobante" disabled={disabled}
                        onClick={() => onCambiar(null)} />
                </span>
            ) : (
                <LinkButton icon={<Paperclip />} disabled={disabled} onClick={() => input.current?.click()}>
                    Adjuntar captura, PDF o CSV
                </LinkButton>
            )}
            <small className="t-cap mut">
                Learnito lo lee y verifica el pago. Si no lo tenés ahora, subilo después desde Pagos en el historial.
            </small>
        </div>
    );
};

export default ComprobanteDeVenta;
