// Por qué un lead que asistió al triage no pasó a closing (ADR-W151). Las claves son las de
// `app/services/triage_motivos.py`; `corto` es el rótulo de los chips y de la tarjeta del tablero.
// `pideTexto`: sin contar cuál fue, ese motivo no dice nada.

export const MOTIVOS = [
  { valor: 'sin_dinero', label: 'No tenía dinero', corto: 'No tenía dinero', sub: 'No llega a los 500 USD',
    pregunta: '¿Querés agregar algo?', pideTexto: false },
  { valor: 'sin_horario', label: 'No encontramos horario', corto: 'No encontramos horario',
    sub: 'No hubo espacio para agendar con el closer', pregunta: '¿Querés agregar algo?', pideTexto: false },
  { valor: 'objecion', label: 'Puso una objeción y no la resolví', corto: 'Objeción sin resolver', sub: 'Contá cuál fue',
    pregunta: '¿Cuál fue la objeción?', falta: 'Cuál fue la objeción', pideTexto: true },
  { valor: 'otro', label: 'Otro motivo', corto: 'Otro motivo', sub: 'Contá cuál',
    pregunta: '¿Cuál fue el motivo?', falta: 'Cuál fue el motivo', pideTexto: true },
];
// La descalificada reportada antes de que se pidiera el motivo.
export const SIN_MOTIVO = { valor: 'sin_dato', corto: 'Sin motivo' };

export const motivoDe = (valor) => MOTIVOS.find((m) => m.valor === valor) || null;
/** La clave con la que cuenta una descalificada: su motivo o «sin dato». */
export const claveDeMotivo = (lead) => (motivoDe(lead?.motivo) ? lead.motivo : SIN_MOTIVO.valor);
export const cortoDeMotivo = (valor) => motivoDe(valor)?.corto || SIN_MOTIVO.corto;
