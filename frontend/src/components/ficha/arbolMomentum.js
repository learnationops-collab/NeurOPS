// El reporte corto de una Momentum de la Academia, como función pura (sin React ni HTTP).
//
// Una Momentum (agenda con origen «Momentum») no se reporta con el árbol de una llamada de venta: el
// closer contesta ¿Asistió? → si asistió, ¿Continúa? → el motivo. La de seña y la del cierre preguntan
// lo mismo con otras palabras. El backend lo valida igual (app/services/ficha_momentum_service.py) y se
// lo avisa a la Academia con `motivo` (app/services/momentum_academia.py).

import { fechaHoraAIso } from './arbolResultado.payload';

export const ASISTENCIA_MOMENTUM = [
  { valor: 'asistio', label: 'Asistió', sub: 'Se conectó a la sesión', tono: 'success' },
  { valor: 'no_asistio', label: 'No asistió', sub: 'No se presentó', tono: 'error' },
  { valor: 'cancelo', label: 'Canceló', sub: 'Avisó que no venía', tono: 'warning' },
  { valor: 'reagenda', label: 'Reagenda', sub: 'Pidió otra fecha', tono: 'info' },
];

const CONTINUA = {
  sena: [
    { valor: 'pago', label: 'Pagó, sigue', tono: 'success' },
    { valor: 'pensando', label: 'Lo está pensando', tono: 'warning' },
    { valor: 'no_sigue', label: 'No sigue', tono: 'error' },
  ],
  cierre: [
    { valor: 'pago', label: 'Hizo upsell', tono: 'success' },
    { valor: 'pensando', label: 'Lo está pensando', tono: 'warning' },
    { valor: 'no_sigue', label: 'No por ahora', tono: 'error' },
  ],
};

/** Las opciones de «¿Continúa?» según la Momentum: la de seña o la del cierre (sin dato, la de seña). */
export const opcionesContinua = (tipo) => CONTINUA[tipo === 'cierre' ? 'cierre' : 'sena'];

/** ¿El motivo es obligatorio? Si no asistió, canceló, lo está pensando o no sigue. */
export const motivoRequerido = (r = {}) => ['no_asistio', 'cancelo'].includes(r.asistencia)
  || (r.asistencia === 'asistio' && ['pensando', 'no_sigue'].includes(r.resultado));

/** Las preguntas que tocan con lo contestado: asistencia, después continúa o fecha, y el motivo. */
export function pasosMomentum(r = {}) {
  if (!r.asistencia) return ['asistencia'];
  const pasos = ['asistencia'];
  if (r.asistencia === 'asistio') pasos.push('continua');
  if (r.asistencia === 'reagenda') pasos.push('fecha');
  pasos.push('motivo');
  return pasos;
}

/** Qué falta para poder guardar, en palabras. Vacío: se puede guardar. */
export function faltantesMomentum(r = {}) {
  const falta = [];
  if (!r.asistencia) return ['Elegí si asistió'];
  if (r.asistencia === 'asistio' && !r.resultado) falta.push('Elegí si continúa');
  if (r.asistencia === 'reagenda' && !fechaHoraAIso(r.fecha, r.hora)) falta.push('Elegí la nueva fecha');
  if (motivoRequerido(r) && !String(r.motivo || '').trim()) falta.push('Escribí el motivo');
  return falta;
}

/** Elige la asistencia: cambiarla borra lo que dependía de la anterior (no el motivo, que se tipeó). */
export function elegirAsistencia(r = {}, asistencia) {
  if (r.asistencia === asistencia) return r;
  const { resultado: _r, fecha: _f, hora: _h, ...resto } = r;
  return { ...resto, asistencia };
}

/** El pedido de `POST /ficha/<id>/resultado`: `{accion, datos}` como `construirPayload`. */
export function payloadMomentum(r = {}) {
  const motivo = String(r.motivo || '').trim();
  return {
    accion: 'reportar_resultado',
    datos: {
      momentum: {
        asistencia: r.asistencia,
        resultado: r.asistencia === 'asistio' ? r.resultado : null,
        inicio: r.asistencia === 'reagenda' ? fechaHoraAIso(r.fecha, r.hora) : null,
        motivo: motivo || null,
      },
      respuestas: r,
    },
  };
}
