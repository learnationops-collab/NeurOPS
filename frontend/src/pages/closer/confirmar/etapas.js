// Las tres etapas de la confirmación (las de la ficha, 23/10/2026) y la regla para saber en cuál está una
// cita. Las usan el tablero de la página y las vistas nuevas (ADR-W201).

export const ETAPAS_CONFIRMACION = [
    { clave: 'por_contactar', titulo: 'Por contactar', color: 'var(--cl-warning, #f5b84a)' },
    { clave: 'contactado', titulo: 'Contactado', color: 'var(--cl-info, #5aa9ff)' },
    { clave: 'confirmado', titulo: 'Confirmado', color: 'var(--cl-success, #3ecf8e)' },
];

// La misma regla que la pestaña Confirmación de la ficha (`ficha_lead_service._confirmacion`): Confirmado
// solo si `result` lo dice; si no, la etapa guardada, donde vacía es Por contactar y cualquier otra (las
// viejas incluidas) es Contactado.
export const etapaDeConfirmacion = (a) => {
    if ((a.result || '').trim().toLowerCase() === 'confirmado') return 'confirmado';
    const etapa = a.confirmation_stage || 'por_contactar';
    return etapa === 'por_contactar' ? 'por_contactar' : 'contactado';
};

// La etapa a la que lleva el botón de la fila: Por contactar → Contactado → Confirmado.
export const siguienteEtapa = (a) => {
    const e = etapaDeConfirmacion(a);
    return e === 'por_contactar' ? 'contactado' : e === 'contactado' ? 'confirmado' : null;
};
