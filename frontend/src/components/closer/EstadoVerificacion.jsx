import Badge from '../ui/Badge';

// El estado del comprobante de un pago o de una venta (ADR-W088), en las pantallas viejas del closer.
const ESTADOS = {
    verified: { variant: 'success', texto: 'Verificado' },
    pending: { variant: 'warning', texto: 'Sin comprobante' },
    unverified: { variant: 'rose', texto: 'No cuadra' },
};

const EstadoVerificacion = ({ estado, className = '' }) => {
    const e = ESTADOS[estado];
    if (!e) return null;
    return (
        <Badge variant={e.variant} className={`text-[9px] block w-fit mt-1 ${className}`}
            title={estado === 'verified' ? undefined : 'Subí el comprobante desde la ficha del cliente, sección Pagos.'}>
            {e.texto}
        </Badge>
    );
};

export default EstadoVerificacion;
