// El estado de verificación del pago de una venta en la nómina (ADR-W088): se paga igual, marcado.
export const ROTULO_VERIFICACION = { pending: 'Sin comprobante', unverified: 'No cuadra' };

export const rotuloVerificacion = (venta) => ROTULO_VERIFICACION[venta?.verificacion] || null;

/** «3 sin verificar · US$ 120 de comisión» para el tile y el pie de la tabla, o null. */
export const lineaSinVerificar = (datos, dinero) => {
    const s = datos?.sin_verificar;
    if (!s?.ventas) return null;
    return `${s.ventas} sin verificar · ${dinero(s.comision)} de comisión${s.no_cuadran ? ` · ${s.no_cuadran} no cuadran` : ''}`;
};
