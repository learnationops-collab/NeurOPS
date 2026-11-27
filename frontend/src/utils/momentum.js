// Las Momentum no cuentan en show up ni closing (ADR-W276): por tipo de llamada o por el origen.
export const isMomentum = (row) => row?.tipo_llamada === 'momentum' || row?.llamada === 'momentum'
    || /momentum/i.test(row?.origin || row?.fuente || '');
