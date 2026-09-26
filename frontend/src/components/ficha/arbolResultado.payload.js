// Traducción de las respuestas del árbol al payload que espera el backend.
//
// Es el archivo que garantiza el «no se pierde nada»: acá se reproduce, campo por campo, lo que
// hoy viaja desde `CloserWorkflowPage.jsx`:
//   · `buildSalePayload()` (1601-1638) → bloque `venta`
//   · los `POST /closer/deck/<id>` encadenados en `handleRegisterSale` (1640-1804) → bloques
//     `acceso_academia`, `seguimiento_cobro`, `agenda`, `cuota_cobrada`, `plan_cuotas`, `liquidar`
//   · los `POST /closer/deck/<id>` de `follow` (3087-3099) y de `saveSeguimientoReport`
//     (2048-2162) → bloque `deck`
//   · los `POST /closer/appointments/<id>/process` de `handleConfirmReason` → bloque `process`
//   · los `PATCH /closer/appointments/<id>` de `second`/`reagSi`/`agendo` → bloque `reagenda`
//   · `POST /closer/deck/referrals/manual` (2057) → bloque `referidos`
// `respuestas` va crudo al final: si mañana aparece un campo nuevo, el backend lo tiene igual.

import { repartirCuotas } from './acciones/planCuotas';

const num = (v) => (v === '' || v === undefined || v === null ? undefined : parseFloat(v));
const sinArroba = (v) => (v ? String(v).replace(/@/g, '').trim() : '');
const sinMas = (v) => (v ? String(v).replace(/\+/g, '').trim() : '');

/**
 * `YYYY-MM-DD` + `HH:MM` locales → ISO UTC. Equivale a `localInputsToUtcIso` de
 * CloserWorkflowPage: las partes se leen como locales a propósito, porque `new Date('YYYY-MM-DD')`
 * las lee como medianoche UTC y en América eso es el día anterior.
 */
export function fechaHoraAIso(fecha, hora = '12:00') {
  if (!fecha) return null;
  const [y, m, d] = String(fecha).split('-').map(Number);
  const [hh, mm] = String(hora || '12:00').split(':').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0).toISOString();
}

/** `marca_temporal` de la venta: la fecha elegida con la hora actual, en `es-ES` local. */
function marcaTemporal(fecha, ahora) {
  const [y, m, d] = String(fecha || '').split('-').map(Number);
  const base = y && m && d
    ? new Date(y, m - 1, d, ahora.getHours(), ahora.getMinutes(), ahora.getSeconds())
    : ahora;
  return base.toLocaleString('es-ES');
}

/**
 * La nota que se guarda como `closer_notes`, con el prefijo de modalidad y el sufijo de referidos.
 * Se reproduce tal cual está hoy en `saveSeguimientoReport` (2070-2087) porque es el texto que el
 * equipo lee en la bitácora.
 */
export function notaFinal(r = {}) {
  const prefijo = (r.modalidad || []).length ? `[Modalidad: ${r.modalidad.join(', ')}] ` : '';
  let refs = '';
  if (r.refs_ask === 'si') {
    const filas = r.refs_rows || [];
    const conContacto = filas.filter((f) => f.nombre?.trim() && f.contacto?.trim());
    const sinContacto = filas.filter((f) => f.nombre?.trim() && !f.contacto?.trim());
    const partes = [];
    if (conContacto.length) partes.push(`${conContacto.length} referido(s) con datos → agenda creada`);
    if (sinContacto.length) partes.push(`Referido(s) sin datos: ${sinContacto.map((f) => f.nombre.trim()).join(', ')}`);
    if (partes.length) refs = ` | Referidos: ${partes.join('; ')}`;
  } else if (r.refs_ask === 'no') {
    refs = ' | Se pidieron referidos, no dejó.';
  } else if (r.refs_ask === 'no_pedido') {
    refs = ' | No se pidieron referidos.';
  }
  const cierre = r.sig_action === 'close' && r.cierre_motivo ? ` | Motivo de cierre: ${r.cierre_motivo}` : '';
  return `${prefijo}${r.notes || ''}${cierre}${refs}`.trim();
}

const bloqueReferidos = (r) => ({
  // `no_pedido` es el `null` de hoy (`refs_ask: null` = «no se lo pedí»), explícito para no
  // confundir «no se preguntó» con «se preguntó y no dejó».
  pedido: r.refs_ask ?? null,
  filas: (r.refs_rows || []).filter((f) => (f.nombre || '').trim()),
  // Mismas claves que usa hoy el wizard de venta, para no perder ninguna de las dos grafías.
  referralAsked: r.refs_ask === 'si' ? 'got' : r.refs_ask === 'no' ? 'asked' : 'no',
  referralCount: (r.refs_rows || []).filter((f) => (f.nombre || '').trim()).length,
});

// Motivo de la rama recorrida: cada rama lo guarda en su propio campo.
const motivoDeRama = (r) => r.noshow_motivo || r.cancel_motivo || r.reag_motivo || null;

// Tipo y subestado del seguimiento, tal como los arma hoy cada rama antes de llegar a `follow`.
function seguimientoDeRama(r) {
  if (r.nocierre_next === 'seguimiento') {
    return {
      tipo: 'tomada',
      sub: r.with_decision_maker ? 'Decisión pendiente · con decisor' : 'Sin decisor · oferta presentada',
    };
  }
  if (r.nopres_next === 'seguimiento') return { tipo: 'tomada', sub: 'Falta agendar 2ª llamada' };
  if (r.noshow_next === 'seguimiento') return { tipo: 'no_tomada', sub: `No show: ${r.noshow_motivo || 'Sin especificar'}` };
  if (r.cancel_next === 'seguimiento') return { tipo: 'no_tomada', sub: `Cancelación: ${r.cancel_motivo || 'Sin especificar'}` };
  if (r.reag_dejo_fecha === false) return { tipo: 'no_tomada', sub: 'Reprogramó sin fecha' };
  return null;
}

// `process` = las acciones que hoy pasan por `POST /closer/appointments/<id>/process`.
function bloqueProcess(r) {
  const descarte = { perdido: 'Lead Perdido', descartar: 'Lead Perdido', no_lead: 'No Lead' };
  const elegido = [r.nocierre_next, r.nopres_next, r.noshow_next, r.cancel_next]
    .find((v) => v && descarte[v]);
  if (!elegido) return null;
  return {
    status: descarte[elegido],
    role: 'closer',
    note: r.motivo_descarte || motivoDeRama(r) || null,
    with_decision_maker: r.with_decision_maker ?? null,
    offer_presented: r.offer_presented ?? null,
  };
}

// `reagenda` = los `PATCH /closer/appointments/<id>` con `start_time` nuevo.
function bloqueReagenda(r) {
  const iso = fechaHoraAIso(r.nueva_fecha_agenda, r.nueva_hora_agenda);
  if (!iso) return null;
  const modo = r.nopres_next === 'segunda' ? 'segunda_llamada'
    : r.contacto_result === 'agendo' ? 'seguimiento_agendo' : 'reagenda';
  return { start_time: iso, modo };
}

/** El `POST /closer/deck/<appt>` que corresponde al camino recorrido. */
function bloqueDeck(r, contexto) {
  const notas = notaFinal(r) || 'Reporte de llamada';
  const base = {
    closer_notes: notas,
    with_decision_maker: r.with_decision_maker ?? null,
    offer_presented: r.offer_presented ?? null,
  };
  // Segunda llamada o reagenda con fecha: vuelve a confirmaciones.
  if (r.nopres_next === 'segunda' || r.reag_dejo_fecha === true) {
    return { ...base, confirm_status: 'por_confirmar', result: 'Pendiente' };
  }
  // Cadencia de seguimiento: el lead contestó y dejó fecha nueva.
  if (r.contacto_result === 'agendo') {
    return {
      ...base, confirm_status: 'por_confirmar', result: 'Pendiente', contact_result: r.contacto_result,
      seguimiento_realizado: true, fecha_seguimiento: null,
    };
  }
  // Cadencia de seguimiento: se cierra.
  if (r.sig_action === 'close') {
    return { ...base, contact_result: r.contacto_result, seguimiento_realizado: true, fecha_seguimiento: null };
  }
  // Cadencia de seguimiento: sigue vivo, se incrementa el intento.
  if (r.sig_action === 'next') {
    return {
      ...base,
      contact_result: r.contacto_result,
      seguimiento_realizado: false,
      seguimiento_intento: Math.min(4, (contexto.intento || 1) + 1),
      fecha_seguimiento: r.fecha_seguimiento || null,
      seguimiento_tipo: contexto.seguimientoTipo || (r.contacto_result === 'contesto' ? 'tomada' : 'no_tomada'),
      followup_reminder_enabled: !!r.followup_reminder_enabled,
      followup_reminder_time: r.followup_reminder_time || null,
    };
  }
  // Primer seguimiento programado desde el reporte de la llamada.
  const seg = seguimientoDeRama(r);
  if (seg) {
    return {
      ...base,
      result: seg.tipo === 'tomada' ? 'Show up' : 'No Show',
      fecha_seguimiento: r.fecha_seguimiento || null,
      seguimiento_tipo: seg.tipo,
      seguimiento_sub: seg.sub,
      seguimiento_intento: 1,
      seguimiento_realizado: false,
      followup_reminder_enabled: !!r.followup_reminder_enabled,
      followup_reminder_time: r.followup_reminder_time || null,
    };
  }
  // Descarte: el estado lo pone `process`, el deck solo deja la nota.
  if (bloqueProcess(r)) return base;
  // No asistió / canceló sin siguiente paso elegido: se reporta el resultado crudo.
  if (r.res === 'no_asistio') return { ...base, result: 'No Show' };
  if (r.res === 'cancelo') return { ...base, result: 'Cancelado' };
  if (r.res === 'asistio') return { ...base, result: 'Show up' };
  return base;
}

/** El bloque `venta`: exactamente lo que hoy arma `buildSalePayload()`. */
function bloqueVenta(r, contexto) {
  const ahora = contexto.ahora || new Date();
  return {
    email_vendedor: r.email_vendedor || '',
    nombre_cliente: r.nombre_cliente || '',
    telefono: sinMas(r.telefono),
    mail_cliente: r.mail_cliente || '',
    tipo_pago: `${r.programa} - ${r.tipo_pago_simple}`,
    monto: num(r.monto) ?? 0,
    precio_total: num(r.precio_total),
    segundo_pago: r.segundo_pago || '',
    metodo_pago: r.metodo_pago || '',
    examen: `${r.examen_lead || ''}${r.notas ? ` | ${r.notas}` : ''}`,
    instagram: sinArroba(r.instagram),
    estado: r.estado || 'Completada',
    setter: r.setter || '',
    documento_identidad: r.documento_identidad || '',
    appointment_id: contexto.appointmentId ?? undefined,
    marca_temporal: marcaTemporal(r.date, ahora),
    enviar_webhook: r.enviar_webhook !== false,
    enviar_mensaje: r.enviar_webhook !== false,
    sold_in_call: r.sold_in_call !== false,
  };
}

/**
 * El plan de cuotas a crear. Se replica el criterio de hoy: «cobrado hoy» incluye todo lo que el
 * cliente ya había pagado antes (si no, el saldo se recalcula sobre el total completo y se le
 * cobra de más), y el plan solo se crea si el total supera lo cobrado.
 */
function bloquePlan(r, contexto) {
  if (r.tipo_pago_simple === 'completo') return null;
  const total = num(r.precio_total);
  if (!total) return null;
  const pagadoAntes = contexto.estadoPagos?.total_paid || 0;
  const cobradoHoy = pagadoAntes + (num(r.monto) || 0);
  if (total <= cobradoHoy) return null;
  const cantidad = Math.max(1, Math.trunc(Number(r.num_cuotas) || 1));
  return {
    total,
    cobrado_hoy: cobradoHoy,
    num_cuotas: cantidad,
    fechas: Array.from({ length: cantidad }, (_, i) => r.cuotaFechas?.[i + 1] || null),
    montos: repartirCuotas(cantidad, Math.max(0, total - cobradoHoy), r.cuotaMontos),
    programa_code: r.programa,
  };
}

function payloadVenta(r, contexto) {
  const esCuota = (r.tipo_pago_simple || '').toLowerCase() === 'cuota';
  const saldoPrevio = contexto.estadoPagos?.balance_remaining || 0;
  const esRenovacionOUpsell = ['Renovacion', 'Upsell'].includes(r.tipo_pago_simple);
  return {
    venta: bloqueVenta(r, contexto),
    // Renovación/Upsell con saldo: primero una Cuota que lo liquida, y solo si eso funciona
    // se registra la venta principal (mismo orden que hoy, handleRegisterSale 1650-1659).
    liquidar_saldo: esRenovacionOUpsell && !!r.settleBalanceWithSale && saldoPrevio > 0
      ? { monto: saldoPrevio, tipo_pago: `${r.programa} - Cuota`, comentario: 'Liquidación de saldo previo a Renovación/Upsell' }
      : null,
    acceso_academia: r.dar_acceso_academia
      ? { programa_code: r.programa, tipo_venta: (r.tipo_pago_simple || '').toLowerCase(), email: r.mail_cliente }
      : null,
    seguimiento_cobro: r.fecha_cobro ? {
      fecha_seguimiento_cobro: r.fecha_cobro,
      fecha_seguimiento: r.fecha_cobro,
      seguimiento_tipo: 'cerrada',
      seguimiento_sub: 'Seguimiento de cobro',
      seguimiento_intento: 1,
      seguimiento_realizado: false,
    } : null,
    agenda: { with_decision_maker: r.with_decision_maker ?? null, offer_presented: r.offer_presented ?? null },
    // Cuota de un plan que ya existía: se marca pagada en vez de recrear el cronograma (eso
    // borraba el historial de cuotas ya cobradas).
    cuota_cobrada: esCuota && r.selectedCuotaId
      ? { cuota_id: r.selectedCuotaId, estado: 'pagado', monto: num(r.monto) ?? 0 }
      : null,
    plan_cuotas: esCuota && r.selectedCuotaId ? null : bloquePlan(r, contexto),
    // La venta llegada desde la cadencia de seguimiento cierra primero el seguimiento.
    deck: r.contacto_result === 'cerro'
      ? { closer_notes: notaFinal(r), seguimiento_realizado: true, fecha_seguimiento: null, contact_result: 'cerro' }
      : null,
    referidos: bloqueReferidos(r),
    respuestas: r,
  };
}

/**
 * El payload final. Devuelve `{accion, datos}`: `accion` es el nombre que la pestaña le pasa a
 * `onAccion` (`venta` o `reportar_resultado`) y `datos` el cuerpo.
 */
export function construirPayload(respuestas = {}, contexto = {}) {
  const r = respuestas;
  const esVenta = r.cierre === true || r.contacto_result === 'cerro';
  if (esVenta) return { accion: 'venta', datos: payloadVenta(r, contexto) };
  return {
    accion: 'reportar_resultado',
    datos: {
      resultado: r.res ?? null,
      contacto_result: r.contacto_result ?? null,
      motivo: motivoDeRama(r),
      motivo_descarte: r.motivo_descarte || null,
      deck: bloqueDeck(r, contexto),
      process: bloqueProcess(r),
      reagenda: bloqueReagenda(r),
      referidos: bloqueReferidos(r),
      respuestas: r,
    },
  };
}
