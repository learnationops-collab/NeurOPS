// A quién del equipo se le hizo un pago por transferencia (pedido de Kerwin, 09/10/2026).
//
// Las opciones (Pedro, Jean Carlo, Otro) NO se escriben acá: llegan en el vocabulario de la ficha
// (`vocabulario.transferido_a`, de `transferencias_service.TRANSFERIDO_A` en el backend), cada una
// con `descuenta`: si se le descuenta a esa persona en Payroll. Acá vive solo la regla de qué medio
// es transferencia, la misma que `transferencias_service.es_transferencia`: 'Transferencia',
// 'Transferencia Bancaria' y sus variantes escritas a mano.

export const PREGUNTA_TRANSFERENCIA = '¿A quién se le hizo la transferencia?';

export const FALTA_TRANSFERENCIA = 'Elegí a quién se le hizo la transferencia';

/** Si el medio de pago es una transferencia. */
export const esTransferencia = (medio) => String(medio || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes('transfer');

/** 'jean_carlo' → 'Jean Carlo', con la lista del vocabulario; la clave si no está. */
export const nombreDeTransferido = (opciones = [], clave) => opciones.find(o => o.clave === clave)?.label
    || clave;

/** Lo que dice la fila de un pago por transferencia: «Transferido a Jean Carlo» o «Sin marcar». */
export const leyendaTransferencia = (opciones, clave) => (clave
    ? `Transferido a ${nombreDeTransferido(opciones, clave)}` : 'Sin marcar a quién');

/** Cómo se explica cada opción: a Pedro y a Jean Carlo se les descuenta; «Otro», no. */
export const efectoDeTransferido = (opcion) => (opcion?.descuenta
    ? 'Se le descuenta en Payroll' : 'Solo se anota en Finanzas');
