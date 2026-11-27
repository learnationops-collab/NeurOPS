// El texto del «?» de Mi sueldo: cómo se calcula, según el rol (reglas de nomina_service.py).
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const nombreMes = (mes) => `${MESES[Number(mes.slice(5)) - 1]} ${mes.slice(0, 4)}`;
export const mesCorto = (mes) => CORTOS[Number(mes.slice(5)) - 1];

/** 'YYYY-MM' más `n` meses. */
export function sumarMes(mes, n) {
    const d = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5)) - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const pctDe = (mes, k) => {
    const c = mes.conceptos.find(x => (k ? x.k === k : x.porcentaje != null));
    return c?.porcentaje != null ? `el ${c.porcentaje}%` : 'tu %';
};

export function reglas(rol, mes) {
    const propias = rol === 'Director comercial'
        ? [`Tus ventas cobran ${pctDe(mes, 'propia')} como closer, de cualquier tipo.`,
            `Las de los otros closers te pagan ${pctDe(mes, 'director')} como director, sin contar renovaciones.`,
            'Cada pago te paga de una sola manera: como closer si lo cerraste vos, como director si lo cerró otro.']
        : rol === 'Closer'
            ? [`Cobrás ${pctDe(mes)} de cada pago donde figurás como vendedor: primer pago, cuotas, renovaciones y upsells.`]
            : [`Cobrás ${pctDe(mes)} de cada pago de un cliente cuya agenda salió de vos (o, sin agenda, donde figurás como setter de la venta).`];
    return [...propias,
        'El % es sobre el neto: lo que entró después de la comisión de Stripe o Hotmart. Una transferencia no paga comisión.',
        'Cada pago usa el % del mes en que entró. Uno sin comprobante se paga igual y queda marcado; uno sacado de la nómina se ve tachado y no suma.',
        mes.estado === 'curso' ? 'El mes está en curso: suma lo cobrado hasta hoy y puede cambiar.'
            : 'Es lo que se liquidó ese mes. Si algo no te cierra, avisale a Marlon.'];
}
