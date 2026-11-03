// El motivo obligatorio de «Reagendado», «No Show» y «Cancelado» (ADR-W066). Espejo de
// `app/services/motivo_estado_service.py`: el backend es quien rechaza, esto solo evita el viaje y
// deja el botón de guardar apagado hasta que el texto alcanza.

export const MINIMO_MOTIVO = 10;

const CLAVES = {
  'no show': 'no_show', no_show: 'no_show', noshow: 'no_show', no_asistio: 'no_show', 'no asistió': 'no_show',
  cancelado: 'cancelado', cancelada: 'cancelado', cancelo: 'cancelado', 'canceló': 'cancelado',
  reagendado: 'reagendado', reagendada: 'reagendado', reagendo: 'reagendado', 'reagendó': 'reagendado',
  reagenda: 'reagendado', reprogramado: 'reagendado', reprogramada: 'reagendado',
};

const PREGUNTAS = {
  no_show: '¿Por qué no asistió?',
  cancelado: '¿Por qué se canceló?',
  reagendado: '¿Por qué se reagenda?',
};

/** La clave del estado si es uno de los tres que piden motivo («No Show», «Cancelada», «reagenda»…), o null. */
export const claveDeMotivo = (estado) => CLAVES[String(estado ?? '').trim().replace(/\s+/g, ' ').toLowerCase()] || null;

/** «¿Por qué se canceló?» y compañía, o null si el estado no pide motivo. */
export const preguntaDeMotivo = (estado) => PREGUNTAS[claveDeMotivo(estado)] || null;

/** ¿Este estado pide motivo? */
export const pideMotivo = (estado) => claveDeMotivo(estado) !== null;

/** Cuántos caracteres cuenta el motivo (sin los espacios de los costados). */
export const largoDeMotivo = (texto) => String(texto ?? '').trim().length;

/** ¿El texto alcanza como motivo? */
export const motivoAlcanza = (texto) => largoDeMotivo(texto) >= MINIMO_MOTIVO;

/** Lo que falta para que alcance, en palabras («Faltan 4 caracteres»), o null si ya alcanza. */
export function faltaDeMotivo(texto) {
  const n = largoDeMotivo(texto);
  if (n >= MINIMO_MOTIVO) return null;
  if (n === 0) return `Escribí el motivo (al menos ${MINIMO_MOTIVO} caracteres).`;
  const faltan = MINIMO_MOTIVO - n;
  return `Faltan ${faltan} ${faltan === 1 ? 'carácter' : 'caracteres'}.`;
}
