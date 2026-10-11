/**
 * El tooltip de los dos estados de agenda que hay que explicar, para las pantallas que muestran el
 * `closer_result` CRUDO (el mazo del closer, su auditoría, el tablero de triage).
 *
 * Las demás —Revisar, la ficha, Mis agendas del setter— no usan esto: el chip les llega del backend
 * con su `ayuda` (`AYUDA_ESTADO` en `app/services/closer_agendas_service.py`). Estas oraciones son
 * una copia de aquellas, y `tests/contracts/test_ayuda_estados_agenda.py` las compara.
 *
 * «Archivada sin reporte» existe desde el 10/10/2026: antes el barrido de los 30 días dejaba esas
 * agendas como «Lead Perdido», el mismo estado con el que un closer descarta un lead.
 */
export const AYUDA_ESTADO = {
    lead_perdido: 'El closer lo descartó.',
    archivada_sin_reporte: 'Nadie la reportó en 30 días; el sistema la archivó.',
};

// Los valores crudos de `closer_result` con los que llegan, en minúscula.
const POR_RESULTADO = {
    'lead perdido': AYUDA_ESTADO.lead_perdido,
    perdido: AYUDA_ESTADO.lead_perdido,
    'archivada sin reporte': AYUDA_ESTADO.archivada_sin_reporte,
};

/** El tooltip de un `closer_result` crudo, o `undefined` (así `title` no se dibuja). */
export const ayudaDeResultado = (closerResult) =>
    POR_RESULTADO[String(closerResult || '').trim().toLowerCase()];
