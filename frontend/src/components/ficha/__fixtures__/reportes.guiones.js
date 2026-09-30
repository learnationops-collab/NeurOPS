// Los caminos del reporte SIN venta de la pestaña «Resultado», fijados como contrato con el backend.
//
// Cada guion son las respuestas en el orden en que el closer las da. `reportes.json` es lo que
// `construirPayload` arma con ellos: el backend lo usa como el pedido que manda la ficha
// (tests/api/test_ficha_reporte_arbol.py) y el front comprueba que el árbol lo sigue armando igual
// (arbolResultado.contrato.test.js). La venta se registraba sola en cada lado y ninguno de los dos
// se enteraba de que el otro hablaba otro idioma: con un archivo en común, el que cambie rompe.
//
// Para regenerarlo después de un cambio a propósito en el árbol:
//   cd frontend && npx vite-node scripts/generar-contrato-reportes.mjs

import { estadoInicial, responder, preguntaActual, completo, construirPayload } from '../arbolResultado';

const LLAMADA = {};
const CADENCIA = (intento, seguimientoTipo) => ({ modo: 'seguimiento', intento, seguimientoTipo });
const COBRO = (intento) => ({ modo: 'cobro', intento, seguimientoTipo: 'cerrada' });

export const GUIONES = {
  asistio_sin_cierre_seguimiento: {
    contexto: LLAMADA,
    pasos: [
      ['res', { res: 'asistio' }], ['decisor', { with_decision_maker: true }],
      ['oferta', { offer_presented: true }], ['cierre', { cierre: false }],
      ['nocierre_next', { nocierre_next: 'seguimiento' }],
      ['seguimiento', {
        fecha_seguimiento: '2026-10-06', followup_reminder_enabled: true,
        followup_reminder_time: '09:30', notes: 'Lo habla con la pareja; vuelvo con el caso de Ana.',
      }],
      ['refs_ask', { refs_ask: 'si' }],
      ['refs_filas', { refs_rows: [{ nombre: 'Beto Ruiz', contacto: '@beto.ruiz' }, { nombre: 'Caro', contacto: '' }] }],
    ],
  },
  asistio_sin_cierre_perdido: {
    contexto: LLAMADA,
    pasos: [
      ['res', { res: 'asistio' }], ['decisor', { with_decision_maker: true }],
      ['oferta', { offer_presented: true }], ['cierre', { cierre: false }],
      ['nocierre_next', { nocierre_next: 'perdido' }],
      ['descarte', { motivo_descarte: 'Objeción de precio insalvable' }],
      ['refs_ask', { refs_ask: 'no' }],
    ],
  },
  asistio_sin_oferta_segunda_llamada: {
    contexto: LLAMADA,
    pasos: [
      ['res', { res: 'asistio' }], ['decisor', { with_decision_maker: false }],
      ['oferta', { offer_presented: false }], ['nopres_next', { nopres_next: 'segunda' }],
      ['segunda_llamada', { nueva_fecha_agenda: '2026-10-08', nueva_hora_agenda: '19:30', notes: 'Faltó el decisor' }],
      ['refs_ask', { refs_ask: 'no_pedido' }],
    ],
  },
  asistio_sin_oferta_descartar: {
    contexto: LLAMADA,
    pasos: [
      ['res', { res: 'asistio' }], ['decisor', { with_decision_maker: false }],
      ['oferta', { offer_presented: false }], ['nopres_next', { nopres_next: 'descartar' }],
      ['descarte', { motivo_descarte: 'No califica: no rinde este año' }],
      ['refs_ask', { refs_ask: 'no_pedido' }],
    ],
  },
  no_asistio_seguimiento: {
    contexto: LLAMADA,
    pasos: [
      ['res', { res: 'no_asistio' }], ['noshow_motivo', { noshow_motivo: 'Confundió la fecha' }],
      ['noshow_detalle', { notes: 'Pensó que era mañana' }], ['noshow_next', { noshow_next: 'seguimiento' }],
      ['seguimiento', { fecha_seguimiento: '2026-10-02' }],
    ],
  },
  no_asistio_descartar: {
    contexto: LLAMADA,
    pasos: [
      ['res', { res: 'no_asistio' }], ['noshow_motivo', { noshow_motivo: 'Bloqueó / desapareció' }],
      ['noshow_detalle', { notes: 'Me bloqueó en WhatsApp' }], ['noshow_next', { noshow_next: 'descartar' }],
      ['descarte', { motivo_descarte: 'No responde hace dos semanas' }],
    ],
  },
  cancelo_reagendar_con_fecha: {
    contexto: LLAMADA,
    pasos: [
      ['res', { res: 'cancelo' }], ['cancel_motivo', { cancel_motivo: 'Sin tiempo / imprevisto' }],
      ['cancel_detalle', { notes: 'Tuvo guardia' }], ['cancel_next', { cancel_next: 'reagendar' }],
      ['reag_motivo', { reag_motivo: 'Pidió otro horario' }], ['reag_dejo_fecha', { reag_dejo_fecha: true }],
      ['reag_fecha', { nueva_fecha_agenda: '2026-10-05', nueva_hora_agenda: '20:00' }],
    ],
  },
  cancelo_seguimiento: {
    contexto: LLAMADA,
    pasos: [
      ['res', { res: 'cancelo' }], ['cancel_motivo', { cancel_motivo: 'Problema económico' }],
      ['cancel_detalle', { notes: 'Cobra a fin de mes' }], ['cancel_next', { cancel_next: 'seguimiento' }],
      ['seguimiento', { fecha_seguimiento: '2026-10-03', notes: 'Le escribo el 3 con la propuesta en cuotas' }],
    ],
  },
  cancelo_no_lead: {
    contexto: LLAMADA,
    pasos: [
      ['res', { res: 'cancelo' }], ['cancel_motivo', { cancel_motivo: 'Ya no le interesa' }],
      ['cancel_detalle', {}], ['cancel_next', { cancel_next: 'no_lead' }],
      ['descarte', { motivo_descarte: 'No rinde examen, no califica' }],
    ],
  },
  reagenda_con_fecha: {
    contexto: LLAMADA,
    pasos: [
      ['res', { res: 'reagenda' }], ['reag_motivo', { reag_motivo: 'Imprevisto del lead' }],
      ['reag_dejo_fecha', { reag_dejo_fecha: true }],
      ['reag_fecha', { nueva_fecha_agenda: '2026-10-07', nueva_hora_agenda: '17:15' }],
    ],
  },
  reagenda_sin_fecha: {
    contexto: LLAMADA,
    pasos: [
      ['res', { res: 'reagenda' }], ['reag_motivo', { reag_motivo: 'No dio motivo' }],
      ['reag_dejo_fecha', { reag_dejo_fecha: false }],
      ['seguimiento', { fecha_seguimiento: '2026-10-01', notes: 'Le pido fecha nueva' }],
    ],
  },
  cadencia_no_respondio: {
    contexto: CADENCIA(2, 'no_tomada'),
    pasos: [
      ['contacto_result', { contacto_result: 'no_resp' }],
      ['contacto_detalle', { modalidad: ['Mensaje', 'Llamada'], notes: 'Visto sin respuesta, dos llamadas' }],
      ['sig_action', { sig_action: 'next', fecha_seguimiento: '2026-10-06' }],
      ['seguimiento', {}],
    ],
  },
  cadencia_se_cierra: {
    contexto: CADENCIA(4, 'tomada'),
    pasos: [
      ['contacto_result', { contacto_result: 'contesto' }],
      ['contacto_detalle', { modalidad: ['Llamada'], notes: 'Me pidió que no lo contacte más' }],
      ['sig_action', { sig_action: 'close' }],
      ['cierre_motivo', { cierre_motivo: 'Pidió que no lo contacten' }],
      ['refs_ask', { refs_ask: 'no' }],
    ],
  },
  cadencia_contesto_y_agendo: {
    contexto: CADENCIA(1, 'tomada'),
    pasos: [
      ['contacto_result', { contacto_result: 'agendo' }],
      ['contacto_detalle', {
        modalidad: ['Mensaje'], notes: 'Aceptó volver al meet el jueves',
        nueva_fecha_agenda: '2026-10-09', nueva_hora_agenda: '18:00',
      }],
      ['refs_ask', { refs_ask: 'si' }],
      ['refs_filas', { refs_rows: [{ nombre: 'Lu Pérez', contacto: '+5491122334455' }] }],
    ],
  },
  // El seguimiento de cobro de un cliente (el `segventa` del mazo de main).
  cobro_no_respondio: {
    contexto: COBRO(1),
    pasos: [
      ['contacto_result', { contacto_result: 'no_resp' }],
      ['contacto_detalle', { notes: 'Le recordé la cuota de octubre, visto sin respuesta' }],
      ['cobro_fecha', {
        fecha_seguimiento: '2026-10-02', followup_reminder_enabled: true, followup_reminder_time: '10:00',
      }],
    ],
  },
  cobro_conversando: {
    contexto: COBRO(2),
    pasos: [
      ['contacto_result', { contacto_result: 'contesto' }],
      ['contacto_detalle', { notes: 'Cobra el viernes y transfiere el lunes a primera hora' }],
      ['cobro_fecha', { fecha_seguimiento: '2026-10-06', followup_reminder_enabled: false }],
      ['refs_ask', { refs_ask: 'no_pedido' }],
    ],
  },
  cobro_no_va_a_pagar: {
    contexto: COBRO(3),
    pasos: [
      ['contacto_result', { contacto_result: 'no_paga' }],
      ['contacto_detalle', { notes: 'Dice que no va a seguir y que no paga el resto' }],
    ],
  },
};

/** Recorre un guion como lo haría el closer y devuelve lo que la pestaña mandaría. */
export function recorrerGuion({ contexto, pasos }) {
  let r = estadoInicial();
  pasos.forEach(([clave, valores]) => {
    const toca = preguntaActual(r, contexto)?.clave;
    if (toca !== clave) throw new Error(`el árbol pide «${toca}» y el guion contesta «${clave}»`);
    r = responder(r, clave, valores);
  });
  if (!completo(r, contexto)) throw new Error(`el guion no llega al final: falta «${preguntaActual(r, contexto)?.clave}»`);
  return construirPayload(r, contexto);
}

/** Todos los guiones, recorridos: el contenido de `reportes.json`. */
export const generarReportes = () => Object.fromEntries(
  Object.entries(GUIONES).map(([nombre, guion]) => [nombre, recorrerGuion(guion)]),
);
