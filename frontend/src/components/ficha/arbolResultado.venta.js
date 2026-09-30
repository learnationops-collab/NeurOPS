// La aritmética de la venta que declara el árbol de «Resultado»: saldo, cuotas y fechas.
//
// Sin React ni HTTP. Lo usan tres lugares que tienen que decir el MISMO número: las preguntas
// (qué paso toca: si queda saldo hay cronograma), la pestaña (el saldo que ve el closer mientras
// tipea) y el payload (el plan que se crea). Es la cuenta de `DeclararVentaWizard` (`balance`,
// `monthlyDates`, `cuotaAmounts`), que es el wizard de venta que este árbol reemplaza.
//
// `contexto.estadoVenta` es lo que devuelve `GET /ficha/<id>/estado-venta?programa=XX` para el
// programa elegido: cuánto pagó ya el cliente de ESE programa y qué tipos de pago siguen la
// secuencia. Sin él (todavía cargando, o la consulta falló) se cuenta como cliente nuevo.

import { moneda, repartirCuotas, round2, sumarMeses } from './acciones/planCuotas';

// Tres puertas a la venta: cerró en la llamada, cerró en la cadencia de seguimiento, o la venta
// directa (`venta_directa`): una renovación, un upsell, una cuota o una venta cerrada por fuera,
// que no sale de reportar ESTA llamada. Es lo que era «Registrar venta / pago» del historial.
export const esVenta = (r = {}) => r.cierre === true || ['cerro', 'pago'].includes(r.contacto_result)
  || r.venta_directa === true;

export const esCompleto = (r = {}) => r.tipo_pago_simple === 'completo';
export const esCuota = (r = {}) => (r.tipo_pago_simple || '').toLowerCase() === 'cuota';
export const esRenovacionOUpsell = (r = {}) => ['Renovacion', 'Upsell'].includes(r.tipo_pago_simple);

/** Lo que el cliente ya pagó de este programa ANTES de esta venta. */
export const pagadoAntes = (c = {}) => Number(c.estadoVenta?.total_paid) || 0;

/** El saldo viejo del programa, el que se puede liquidar junto con una renovación o un upsell. */
export const saldoPrevio = (c = {}) => Number(c.estadoVenta?.balance_remaining) || 0;

/**
 * Lo que queda debiendo después de esta venta: el precio total menos lo que ya había pagado y lo
 * que paga hoy. «Cobrado hoy» solo no alcanza: una Seña previa se volvería a cobrar en las cuotas.
 */
export function saldoVenta(r = {}, c = {}) {
  if (esCompleto(r)) return 0;
  const total = parseFloat(r.precio_total) || 0;
  return Math.max(0, round2(total - pagadoAntes(c) - (parseFloat(r.monto) || 0)));
}

export const quedaSaldo = (r = {}, c = {}) => saldoVenta(r, c) > 0.009;

/** Las cuotas del plan que YA existe para este programa y todavía no se cobraron. */
export const cuotasPendientes = (r = {}, c = {}) => (c.cuotas || []).filter((q) => q.estado !== 'pagado'
  && (!q.programa_code || !r.programa || q.programa_code === r.programa));

/** Una Cuota de un plan ya armado se cobra eligiendo cuál: no se rehace el cronograma. */
export const cobraCuotaExistente = (r = {}, c = {}) => esCuota(r) && cuotasPendientes(r, c).length > 0;

/** Si al registrar la venta se crea un plan de cuotas nuevo (y por eso se pregunta cómo). */
export const armaPlan = (r = {}, c = {}) => esVenta(r) && !esCompleto(r) && quedaSaldo(r, c)
  && !cobraCuotaExistente(r, c);

export const MAXIMO_CUOTAS = 12;
export const cantidadCuotas = (r = {}) => Math.max(1, Math.min(MAXIMO_CUOTAS, Math.trunc(Number(r.num_cuotas) || 1)));

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Las fechas de cobro del plan nuevo. Mensual: el mismo día de cada mes desde el mes que viene, y
 * si el mes no tiene ese día, el último (lo mismo que `InstallmentService._add_months`). A mano:
 * las que eligió el closer, y la que no tocó cae un mes después de la anterior.
 */
export function fechasCuotas(r = {}, hoy = new Date()) {
  const n = cantidadCuotas(r);
  if (r.installmentMode === 'custom') {
    return Array.from({ length: n }, (_, i) => r.cuotaFechas?.[i + 1] || sumarMeses(iso(hoy), i + 1));
  }
  const dia = Math.max(1, Math.min(31, Math.trunc(Number(r.dia_de_pago) || 10)));
  const base = `${iso(hoy).slice(0, 8)}${String(dia).padStart(2, '0')}`;
  return Array.from({ length: n }, (_, i) => sumarMeses(base, i + 1));
}

/** Los montos del plan nuevo: los tocados a mano se respetan y la última absorbe la diferencia. */
export const montosCuotas = (r = {}, c = {}) => repartirCuotas(cantidadCuotas(r), saldoVenta(r, c), r.cuotaMontos);

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** '2026-10-10' → '10 oct'. */
export function fechaCorta(valor) {
  const [, m, d] = String(valor || '').split('-').map(Number);
  return m && d ? `${d} ${MESES[m - 1]}` : String(valor || '');
}

/** El cronograma en una línea, para la revisión: «10 oct $500 · 10 nov $500». */
export const cronogramaEnTexto = (r = {}, c = {}) => {
  const montos = montosCuotas(r, c);
  return fechasCuotas(r).map((f, i) => `${fechaCorta(f)} ${moneda(montos[i])}`).join(' · ');
};
