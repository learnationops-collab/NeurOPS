// Cómo se lee cada bloque de Fulfillment (ADR-W016), sin JSX: la suscripción contra la Academia, el ritmo del
// recorrido, el próximo paso de un objetivo y el Pulso. Las cuentas de la Academia llegan hechas; acá solo se elige
// qué decir y en qué tono.

import { diaLegible } from '../../piezas';

const DIA = 86400000;
const dia = (iso) => Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`);

/** Días de `a` a `b` (textos 'AAAA-MM-DD' o ISO); negativo si `b` es antes. */
export const diasEntre = (a, b) => Math.round((dia(b) - dia(a)) / DIA);

export const POR_VENCER = 15;

/** Vigente, por vencer o vencida, con cuántos días le quedan y qué parte del total. */
export const estadoSuscripcion = (s, hoy) => {
  const quedan = diasEntre(hoy, s.expires_at);
  const total = Math.max(1, diasEntre(s.starts_at || hoy, s.expires_at));
  const parte = Math.max(0, Math.min(1, quedan / total));
  if (!s.vigente || quedan < 0) return { etiqueta: 'Vencida', tono: 'error', quedan: Math.max(0, quedan), parte: 0 };
  if (quedan <= POR_VENCER) return { etiqueta: 'Por vencer', tono: 'warning', quedan, parte };
  return { etiqueta: 'Vigente', tono: 'success', quedan, parte };
};

const QUE_ABRE = { alta: 'La abrió', renovacion: 'La renovó', conversion: 'La convirtió', extension: 'La extendió',
  prorroga: 'La prorrogó', correccion: 'La corrigió', quitado: 'Le quitó el acceso' };

/** «La abrió: venta RR parcial (4 meses) · La extendió: pago de la cuota 1», con los dos últimos cambios. */
export const origen = (s) => (s.events || []).slice(-2)
  .map((e) => `${QUE_ABRE[e.kind] || e.kind}${e.reason ? `: ${e.reason}` : ''}`).join(' · ');

/**
 * Si la Academia tiene la suscripción como Work (`academy_synced_at` es del aviso; esto es lo que la Academia
 * contestó hoy). `reenviar`: la acción que lo arregla.
 */
export const sincronia = (s, datos) => {
  if (datos?.error) return { texto: 'La Academia no respondió: no se sabe si la tiene igual', tono: 'idle' };
  if (!datos?.vinculado) return { texto: 'No tiene cuenta en la Academia', tono: 'warning' };
  const p = datos.producto_pagado;
  if (!p) return { texto: 'La Academia no la tiene', tono: 'error', reenviar: true };
  const suya = String(p.expires_at || '').slice(0, 10);
  if (s.vigente && suya !== s.expires_at) {
    return { texto: `La Academia la tiene hasta el ${suya ? diaLegible(suya) : '—'}`, tono: 'warning', reenviar: true };
  }
  return { texto: 'La Academia la tiene igual', tono: 'success' };
};

/** Día X de 30, con el tono del atraso. */
export const ritmo = (r) => {
  if (!r) return null;
  if (r.en_pausa) return { texto: 'En pausa', tono: 'idle' };
  if (r.total && r.hechas >= r.total) return { texto: 'Recorrido completo', tono: 'success' };
  if (r.atraso_dias > 0) return { texto: `Atrasada ${r.atraso_dias} ${r.atraso_dias === 1 ? 'día' : 'días'}`, tono: 'error' };
  if (r.dias_en_proceso > r.meta_dias) return { texto: 'Fuera de los 30 días', tono: 'warning' };
  return { texto: 'Al ritmo', tono: 'success' };
};

export const PASO = {
  pendiente: { etiqueta: 'Pendiente', tono: 'info' },
  vencido: { etiqueta: 'Vencido', tono: 'error' },
  observacion: { etiqueta: 'En observación', tono: 'brand-secondary' },
};

export const RESPUESTA = {
  yes: { etiqueta: 'Respondió', tono: 'success' },
  no: { etiqueta: 'Sin respuesta', tono: 'error' },
  wait: { etiqueta: 'Esperando respuesta', tono: 'warning' },
};

export const FRANJAS = ['Activo', 'Se enfría', 'Rescate', 'Perdido'];
export const TONO_FRANJA = { Activo: 'success', 'Se enfría': 'warning', Rescate: 'error', Perdido: 'error', 'Sin actividad': 'idle' };

/** «Entró hoy», «Hace 9 días que no entra (19 oct)» o «Nunca tuvo actividad». */
export const ultimaVez = (uso) => {
  if (uso?.dias_sin_actividad == null) return 'Nunca tuvo actividad en la plataforma';
  const d = uso.dias_sin_actividad;
  if (d === 0) return 'Tuvo actividad hoy';
  if (d === 1) return 'Tuvo actividad ayer';
  return `Hace ${d} días que no tiene actividad${uso.ultima_actividad ? ` (${diaLegible(uso.ultima_actividad)})` : ''}`;
};

export const FILTROS_USO = [
  { value: 'todo', label: 'Todo' },
  { value: 'Ingresos', label: 'Ingresos' },
  { value: 'Estudio', label: 'Estudio' },
  { value: 'Entregas', label: 'Entregas' },
  { value: 'Sesiones y clases', label: 'Sesiones' },
];
