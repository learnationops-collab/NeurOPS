// Lo propio del reporte de la Momentum de la Academia (ADR-W129) y los campos del plan de cuotas, que
// comparten la venta con saldo y la Momentum que sigue con plan. Solo datos, como las preguntas.

import { cantidadCuotas, cronogramaEnTexto, MAXIMO_CUOTAS } from './arbolResultado.venta';

// Las respuestas de la Momentum (ADR-W129). «Con plan» solo si todavía no tiene cuotas por cobrar.
export function opcionesMomentum(c = {}) {
  const sena = c.momentum === 'sena';
  const sinPlan = !(c.cuotas || []).some((q) => q.estado !== 'pagado');
  return [
    { valor: 'pago', label: sena ? 'Sí, pagó' : 'Sí, hace el upsell', sub: 'Registrar el pago', tono: 'success' },
    ...(sena && sinPlan ? [{ valor: 'plan', label: 'Sí, con plan de pago', sub: 'Hoy no paga: armá cómo paga lo que debe', tono: 'success' }] : []),
    { valor: 'pensando', label: 'Lo está pensando', sub: 'Objeción y seguimiento', tono: 'warning' },
    { valor: 'no', label: sena ? 'No sigue' : 'No por ahora', sub: sena ? 'Se da de baja en la Academia' : 'Queda registrado', tono: 'error' },
  ];
}

// Cuántas cuotas y cuándo, con el cronograma a la vista: la venta con saldo y el plan de la Momentum.
export function camposDelPlan(r) {
  return [
    {
      campo: 'num_cuotas', label: 'Cantidad de cuotas', tipo: 'contador', requerido: true,
      minimo: 1, maximo: MAXIMO_CUOTAS, atajos: [2, 3, 4, 6],
      resumir: (v, x) => `${cantidadCuotas(x)} ${cantidadCuotas(x) === 1 ? 'cuota' : 'cuotas'}`,
    },
    {
      campo: 'installmentMode', label: 'Fechas', tipo: 'opcion', requerido: true, opciones: ['monthly', 'custom'],
      etiquetas: { monthly: 'Mismo día cada mes', custom: 'Fechas a mano' },
    },
    ...(r.installmentMode === 'monthly' ? [{
      campo: 'dia_de_pago', label: 'Día de pago', tipo: 'dia_mes', requerido: true, resumir: (v) => `El ${v} de cada mes`,
    }] : []),
    { campo: 'cuotaMontos', label: 'Cronograma', tipo: 'cronograma', resumir: (v, x, c) => cronogramaEnTexto(x, c) },
  ];
}

/**
 * Lo que completa cada respuesta de la Momentum: decisor y oferta van en sí, y el cierre lleva al camino de
 * siempre (pagó → la venta; pensando o no → «No cerró» con su objeción). Con plan no hay venta hoy.
 */
export function valoresMomentum(valor, c = {}) {
  const base = { sigue: valor, with_decision_maker: true, offer_presented: true, nocierre_next: undefined };
  if (valor === 'pago') return { ...base, cierre: true };
  if (valor === 'plan') return { ...base, cierre: undefined, ...(c.programaCliente ? { programa: c.programaCliente } : {}) };
  if (valor === 'pensando') return { ...base, cierre: false, nocierre_next: 'seguimiento' };
  return { ...base, cierre: false };
}

/** Las respuestas que propone la nota de Gemini (`GET /ficha/<id>/momentum/nota`), listas para mezclar. */
export function camposDeLaNota(nota = {}) {
  const campos = {};
  if (nota.objecion && ['pensando', 'no'].includes(nota.sigue)) campos.objecion = nota.objecion;
  if (nota.num_cuotas) campos.num_cuotas = String(nota.num_cuotas);
  if (nota.dia_de_pago) Object.assign(campos, { installmentMode: 'monthly', dia_de_pago: String(nota.dia_de_pago) });
  if (nota.monto_hoy && nota.sigue === 'pago') campos.monto = String(nota.monto_hoy);
  return campos;
}
