import { describe, it, expect } from 'vitest';
import {
  estadoInicial, reiniciar, responder, actualizar, volverA, preguntaActual, faltantes,
  puedeAvanzar, completo, arrancado, hitos, resumen, esVenta, construirPayload,
  notaFinal, fechaHoraAIso, anterior, preguntaAnterior, elegida, RAICES,
} from './arbolResultado';

// La rama de la venta tiene su propio archivo: `arbolResultado.venta.test.js`.

// Recorre el árbol contestando en orden lo que indica `guion` (clave → valores). Falla si el
// árbol pide una pregunta que el guión no previó: así un cambio de ramas rompe el test en vez de
// pasar silenciosamente.
function recorrer(guion, contexto = {}, inicial = estadoInicial()) {
  let r = inicial;
  for (let paso = 0; paso < 40; paso += 1) {
    const q = preguntaActual(r, contexto);
    if (!q) return r;
    expect(guion, `el guión no contesta «${q.clave}»`).toHaveProperty(q.clave);
    r = responder(r, q.clave, guion[q.clave]);
  }
  throw new Error('el árbol no terminó en 40 pasos');
}

const clavesRecorridas = (guion, contexto = {}) => {
  let r = estadoInicial();
  const claves = [];
  for (let paso = 0; paso < 40; paso += 1) {
    const q = preguntaActual(r, contexto);
    if (!q) return claves;
    claves.push(q.clave);
    r = responder(r, q.clave, guion[q.clave] || {});
  }
  throw new Error('el árbol no terminó en 40 pasos');
};

describe('estado inicial', () => {
  it('arranca con la pregunta raíz y las 4 tarjetas', () => {
    const r = estadoInicial();
    expect(arrancado(r)).toBe(false);
    expect(completo(r)).toBe(false);
    const q = preguntaActual(r);
    expect(q.clave).toBe('res');
    expect(q.destacada).toBe(true);
    expect(q.opciones.map((o) => o.valor)).toEqual(['asistio', 'no_asistio', 'cancelo', 'reagenda']);
    expect(q.opciones).toHaveLength(RAICES.length);
  });

  it('los hitos arrancan con solo «Confirmado» hecho', () => {
    const h = hitos(estadoInicial());
    expect(h.map((x) => x.label)).toEqual(['Confirmado', 'Resultado', 'Cierre', 'Deuda', 'Upsell']);
    expect(h.map((x) => x.estado)).toEqual(['hecho', 'pendiente', 'pendiente', 'pendiente', 'pendiente']);
    expect(h[0].sub).toBe('Agenda confirmada');
    expect(h[1].sub).toBe('Sin reportar');
    expect(h[2].sub).toBe('Pendiente');
    expect(h[3].sub).toBe('Pendiente');
    expect(h[4].sub).toBe('Renovación o upsell');
  });

  it('en la pregunta raíz hay que elegir una opción para avanzar', () => {
    expect(faltantes(estadoInicial())).toEqual(['Elegí una de las opciones']);
    expect(puedeAvanzar(estadoInicial())).toBe(false);
  });
});

describe('camino: asistió, oferta presentada, no cerró', () => {
  const seguimiento = {
    res: { res: 'asistio' }, decisor: { with_decision_maker: true }, oferta: { offer_presented: true },
    cierre: { cierre: false }, nocierre_next: { nocierre_next: 'seguimiento' },
    seguimiento: { fecha_seguimiento: '2026-09-30', followup_reminder_enabled: true, followup_reminder_time: '09:00', notes: 'vuelve el lunes' },
    refs_ask: { refs_ask: 'no' },
  };

  it('el hito de cierre queda en ámbar con «No cerró»', () => {
    const h = hitos(recorrer(seguimiento));
    expect(h[2]).toMatchObject({ sub: 'No cerró', estado: 'alerta' });
    expect(h[3].estado).toBe('pendiente');
    expect(esVenta(recorrer(seguimiento))).toBe(false);
  });

  it('el deck reproduce el seguimiento «tomada» con su subestado', () => {
    const { accion, datos } = construirPayload(recorrer(seguimiento), {});
    expect(accion).toBe('reportar_resultado');
    expect(datos.deck).toMatchObject({
      result: 'Show up', seguimiento_tipo: 'tomada', seguimiento_sub: 'Decisión pendiente · con decisor',
      seguimiento_intento: 1, seguimiento_realizado: false, fecha_seguimiento: '2026-09-30',
      followup_reminder_enabled: true, followup_reminder_time: '09:00',
      with_decision_maker: true, offer_presented: true,
    });
    expect(datos.process).toBeNull();
  });

  it('sin decisor el subestado cambia', () => {
    const r = recorrer({ ...seguimiento, decisor: { with_decision_maker: false } });
    expect(construirPayload(r, {}).datos.deck.seguimiento_sub).toBe('Sin decisor · oferta presentada');
  });

  it('descartar exige el motivo y manda Lead Perdido', () => {
    let r = estadoInicial();
    r = responder(r, 'res', { res: 'asistio' });
    r = responder(r, 'decisor', { with_decision_maker: true });
    r = responder(r, 'oferta', { offer_presented: true });
    r = responder(r, 'cierre', { cierre: false });
    r = responder(r, 'nocierre_next', { nocierre_next: 'perdido' });
    expect(preguntaActual(r).clave).toBe('descarte');
    expect(faltantes(r)).toEqual(['Motivo (mínimo 3 caracteres, llevás 0)']);
    r = actualizar(r, { motivo_descarte: 'no' });
    expect(faltantes(r)).toEqual(['Motivo (mínimo 3 caracteres, llevás 2)']);
    r = actualizar(r, { motivo_descarte: 'objeción de precio insalvable' });
    expect(puedeAvanzar(r)).toBe(true);
    r = responder(r, 'descarte', {});
    r = responder(r, 'refs_ask', { refs_ask: 'no' });
    const { datos } = construirPayload(r, {});
    expect(datos.process).toMatchObject({ status: 'Lead Perdido', role: 'closer', note: 'objeción de precio insalvable' });
  });
});

describe('camino: asistió sin presentación de oferta', () => {
  it('«2ª llamada» exige fecha y arma el reagenda + vuelta a confirmaciones', () => {
    let r = estadoInicial();
    r = responder(r, 'res', { res: 'asistio' });
    r = responder(r, 'decisor', { with_decision_maker: false });
    r = responder(r, 'oferta', { offer_presented: false });
    expect(preguntaActual(r).clave).toBe('nopres_next');
    expect(preguntaActual(r).opciones.map((o) => o.valor)).toEqual(['segunda', 'seguimiento', 'descartar']);
    r = responder(r, 'nopres_next', { nopres_next: 'segunda' });
    expect(preguntaActual(r).clave).toBe('segunda_llamada');
    expect(faltantes(r)).toEqual(['Completá Nueva fecha']);
    r = actualizar(r, { nueva_fecha_agenda: '2026-10-02', nueva_hora_agenda: '18:30', notes: 'faltó el decisor' });
    r = responder(r, 'segunda_llamada', {});
    r = responder(r, 'refs_ask', { refs_ask: 'no_pedido' });
    expect(completo(r)).toBe(true);
    const { datos } = construirPayload(r, {});
    expect(datos.reagenda).toEqual({ start_time: fechaHoraAIso('2026-10-02', '18:30'), modo: 'segunda_llamada' });
    expect(datos.deck).toMatchObject({ confirm_status: 'por_confirmar', result: 'Pendiente' });
    expect(datos.deck.closer_notes).toContain('faltó el decisor');
    expect(hitos(r)[2]).toMatchObject({ sub: 'Sin oferta', estado: 'alerta' });
  });

  it('«Seguimiento» sin oferta usa el subestado de la 2ª llamada pendiente', () => {
    const r = recorrer({
      res: { res: 'asistio' }, decisor: { with_decision_maker: false }, oferta: { offer_presented: false },
      nopres_next: { nopres_next: 'seguimiento' }, seguimiento: { fecha_seguimiento: '2026-10-01', notes: 'le escribo' },
      refs_ask: { refs_ask: 'no' },
    });
    expect(construirPayload(r, {}).datos.deck).toMatchObject({
      seguimiento_tipo: 'tomada', seguimiento_sub: 'Falta agendar 2ª llamada', result: 'Show up',
    });
  });
});

describe('camino: no asistió', () => {
  const guion = {
    res: { res: 'no_asistio' },
    noshow_motivo: { noshow_motivo: 'No contestó el mensaje' },
    noshow_detalle: { notes: 'le escribí 3 veces, visto sin respuesta' },
    noshow_next: { noshow_next: 'seguimiento' },
    seguimiento: { fecha_seguimiento: '2026-09-27', notes: 'recupero con el caso de Ana' },
  };

  it('pide los 6 motivos y NO pregunta por referidos (no hubo contacto)', () => {
    const claves = clavesRecorridas(guion);
    expect(claves).toEqual(['res', 'noshow_motivo', 'noshow_detalle', 'noshow_next', 'seguimiento']);
    expect(claves).not.toContain('refs_ask');
    let r = responder(estadoInicial(), 'res', { res: 'no_asistio' });
    expect(preguntaActual(r).opciones).toHaveLength(6);
    expect(preguntaActual(r).opciones[0].label).toBe('No contestó el mensaje');
  });

  it('el hito de resultado queda en ámbar', () => {
    const h = hitos(recorrer(guion));
    expect(h[1]).toMatchObject({ sub: 'No asistió', estado: 'alerta' });
  });

  it('el deck queda como seguimiento de recuperación con el motivo en el subestado', () => {
    const { datos } = construirPayload(recorrer(guion), {});
    expect(datos.deck).toMatchObject({
      result: 'No Show', seguimiento_tipo: 'no_tomada', seguimiento_sub: 'No show: No contestó el mensaje',
    });
    expect(datos.motivo).toBe('No contestó el mensaje');
  });

  it('descartar por no show manda Lead Perdido', () => {
    const r = recorrer({
      ...guion, noshow_next: { noshow_next: 'descartar' }, descarte: { motivo_descarte: 'no show reiterado' },
    });
    // Como en el mazo: el motivo elegido va delante del comentario libre.
    expect(construirPayload(r, {}).datos.process).toMatchObject({
      status: 'Lead Perdido', note: 'No contestó el mensaje. no show reiterado',
    });
  });
});

describe('camino: canceló', () => {
  it('ofrece los 4 motivos y los 3 siguientes pasos', () => {
    let r = responder(estadoInicial(), 'res', { res: 'cancelo' });
    expect(preguntaActual(r).opciones.map((o) => o.label)).toEqual([
      'Sin tiempo / imprevisto', 'Ya no le interesa', 'Problema económico', 'No dio motivo']);
    r = responder(r, 'cancel_motivo', { cancel_motivo: 'Problema económico' });
    r = responder(r, 'cancel_detalle', { notes: 'dijo que no le entra ahora' });
    expect(preguntaActual(r).opciones.map((o) => o.valor)).toEqual(['reagendar', 'seguimiento', 'no_lead']);
  });

  it('«reagendar ahora» entra a la rama de reagenda con fecha y hora obligatorias', () => {
    let r = recorrer({
      res: { res: 'cancelo' }, cancel_motivo: { cancel_motivo: 'Sin tiempo / imprevisto' },
      cancel_detalle: { notes: 'tuvo guardia' }, cancel_next: { cancel_next: 'reagendar' },
      reag_motivo: { reag_motivo: 'Pidió otro horario' }, reag_dejo_fecha: { reag_dejo_fecha: true },
      reag_fecha: { nueva_fecha_agenda: '2026-10-05', nueva_hora_agenda: '20:00' },
    });
    expect(completo(r)).toBe(true);
    const { datos } = construirPayload(r, {});
    expect(datos.reagenda).toMatchObject({ modo: 'reagenda' });
    expect(datos.deck).toMatchObject({ confirm_status: 'por_confirmar', result: 'Pendiente' });

    // sin la hora no se puede confirmar
    r = estadoInicial();
    r = responder(r, 'res', { res: 'cancelo' });
    r = responder(r, 'cancel_motivo', { cancel_motivo: 'No dio motivo' });
    r = responder(r, 'cancel_detalle', {});
    r = responder(r, 'cancel_next', { cancel_next: 'reagendar' });
    r = responder(r, 'reag_motivo', { reag_motivo: 'No dio motivo' });
    r = responder(r, 'reag_dejo_fecha', { reag_dejo_fecha: true });
    r = actualizar(r, { nueva_fecha_agenda: '2026-10-05' });
    expect(faltantes(r)).toEqual(['Completá Nueva hora']);
  });

  it('«No Lead» manda el status No Lead', () => {
    const r = recorrer({
      res: { res: 'cancelo' }, cancel_motivo: { cancel_motivo: 'Ya no le interesa' },
      cancel_detalle: {}, cancel_next: { cancel_next: 'no_lead' },
      descarte: { motivo_descarte: 'no califica, no rinde examen' },
    });
    expect(construirPayload(r, {}).datos.process).toMatchObject({ status: 'No Lead' });
  });
});

describe('camino: reagenda', () => {
  it('sin fecha nueva no es reagenda: va a seguimiento', () => {
    const r = recorrer({
      res: { res: 'reagenda' }, reag_motivo: { reag_motivo: 'Imprevisto del lead' },
      reag_dejo_fecha: { reag_dejo_fecha: false },
      seguimiento: { fecha_seguimiento: '2026-09-29', notes: 'le pido fecha' },
    });
    const { datos } = construirPayload(r, {});
    expect(datos.deck).toMatchObject({ seguimiento_tipo: 'no_tomada', seguimiento_sub: 'Reprogramó sin fecha', result: 'No Show' });
    expect(datos.reagenda).toBeNull();
    expect(hitos(r)[1]).toMatchObject({ sub: 'Reagenda', estado: 'alerta' });
  });
});

describe('cadencia de seguimiento (modo seguimiento)', () => {
  const ctx = { modo: 'seguimiento', intento: 2 };

  it('arranca preguntando qué pasó con el contacto, no qué pasó con la llamada', () => {
    expect(preguntaActual(estadoInicial(), ctx).clave).toBe('contacto_result');
  });

  it('el hito de resultado dice en qué intento va, no «Sin reportar»', () => {
    const h = hitos(estadoInicial(), ctx);
    expect(h[1]).toMatchObject({ sub: 'Seguimiento 2 de 4', estado: 'hecho' });
    // un seguimiento de recuperación arranca de un desenlace malo: va en ámbar
    expect(hitos(estadoInicial(), { ...ctx, seguimientoTipo: 'no_tomada' })[1].estado).toBe('alerta');
  });

  it('exige modalidad y una nota de al menos 10 caracteres', () => {
    let r = responder(estadoInicial(), 'contacto_result', { contacto_result: 'no_resp' });
    expect(preguntaActual(r, ctx).clave).toBe('contacto_detalle');
    expect(faltantes(r, ctx)).toEqual([
      'Completá Modalidad',
      'Qué le dijiste y qué respondió (mínimo 10 caracteres, llevás 0)',
    ]);
    r = actualizar(r, { modalidad: ['Mensaje'], notes: 'corto' });
    expect(faltantes(r, ctx)).toEqual(['Qué le dijiste y qué respondió (mínimo 10 caracteres, llevás 5)']);
    r = actualizar(r, { notes: 'le mandé el caso de Ana y no contestó' });
    expect(puedeAvanzar(r, ctx)).toBe(true);
  });

  it('la cadencia sugiere +7 días en el intento 2 e incrementa el intento', () => {
    let r = responder(estadoInicial(), 'contacto_result', { contacto_result: 'no_resp' });
    r = responder(r, 'contacto_detalle', { modalidad: ['Mensaje', 'Llamada'], notes: 'sigue sin contestar nada' });
    const q = preguntaActual(r, ctx);
    expect(q.clave).toBe('sig_action');
    expect(q.opciones[0].label).toBe('Programar seguimiento 3');
    expect(q.opciones[0].sub).toBe('Sugerido para +7 días');
    r = responder(r, 'sig_action', { sig_action: 'next', fecha_seguimiento: '2026-10-03' });
    r = responder(r, 'seguimiento', {});
    expect(completo(r, ctx)).toBe(true);
    const { datos } = construirPayload(r, ctx);
    expect(datos.deck).toMatchObject({
      seguimiento_intento: 3, seguimiento_realizado: false, contact_result: 'no_resp',
      fecha_seguimiento: '2026-10-03', seguimiento_tipo: 'no_tomada',
    });
    expect(datos.deck.closer_notes).toContain('[Modalidad: Mensaje, Llamada]');
  });

  it('cerrar el seguimiento exige uno de los 4 motivos y deja la nota con el motivo', () => {
    let r = responder(estadoInicial(), 'contacto_result', { contacto_result: 'contesto' });
    r = responder(r, 'contacto_detalle', { modalidad: ['Llamada'], notes: 'me dijo que no lo contacte más' });
    r = responder(r, 'sig_action', { sig_action: 'close' });
    const q = preguntaActual(r, ctx);
    expect(q.clave).toBe('cierre_motivo');
    expect(q.opciones.map((o) => o.label)).toEqual([
      'Pidió que no lo contacten', 'Se agotaron los 4 intentos', 'Compró en otro lado', 'Ya no califica']);
    r = responder(r, 'cierre_motivo', { cierre_motivo: 'Pidió que no lo contacten' });
    r = responder(r, 'refs_ask', { refs_ask: 'no' });
    expect(completo(r, ctx)).toBe(true);
    const { datos } = construirPayload(r, ctx);
    expect(datos.deck).toMatchObject({ seguimiento_realizado: true, fecha_seguimiento: null });
    expect(datos.deck.closer_notes).toContain('Motivo de cierre: Pidió que no lo contacten');
  });

  it('«contestó y agendó» pide fecha y hora y devuelve el lead a confirmaciones', () => {
    let r = responder(estadoInicial(), 'contacto_result', { contacto_result: 'agendo' });
    expect(faltantes(r, ctx)).toContain('Completá Nueva fecha');
    r = responder(r, 'contacto_detalle', {
      modalidad: ['Mensaje'], notes: 'aceptó volver al meet el jueves',
      nueva_fecha_agenda: '2026-10-08', nueva_hora_agenda: '19:00',
    });
    expect(preguntaActual(r, ctx).clave).toBe('refs_ask');
    r = responder(r, 'refs_ask', { refs_ask: 'si' });
    expect(preguntaActual(r, ctx).clave).toBe('refs_filas');
    r = responder(r, 'refs_filas', { refs_rows: [{ nombre: 'Lu', contacto: '+5491122' }] });
    expect(completo(r, ctx)).toBe(true);
    const { datos } = construirPayload(r, ctx);
    expect(datos.referidos.filas).toEqual([{ nombre: 'Lu', contacto: '+5491122' }]);
    expect(datos.reagenda).toMatchObject({ modo: 'seguimiento_agendo' });
    expect(datos.deck).toMatchObject({ confirm_status: 'por_confirmar', seguimiento_realizado: true, fecha_seguimiento: null });
  });

  it('«cerró la venta» entra a la rama de venta (el recorrido entero está en su propio archivo)', () => {
    let r = responder(estadoInicial(), 'contacto_result', { contacto_result: 'cerro' });
    r = responder(r, 'contacto_detalle', { modalidad: ['Llamada'], notes: 'me pasó el comprobante del pago' });
    expect(preguntaActual(r, ctx).clave).toBe('venta_nombre');
    expect(esVenta(r)).toBe(true);
  });

  it('el paso «¿y ahora qué hacemos?» no aparece si agendó o cerró', () => {
    let r = responder(estadoInicial(), 'contacto_result', { contacto_result: 'cerro' });
    r = responder(r, 'contacto_detalle', { modalidad: ['Llamada'], notes: 'pagó por transferencia hoy' });
    let vistas = [];
    for (let i = 0; i < 20 && preguntaActual(r, ctx); i += 1) {
      vistas.push(preguntaActual(r, ctx).clave);
      r = responder(r, preguntaActual(r, ctx).clave, {});
      if (vistas.length > 15) break;
    }
    expect(vistas).not.toContain('sig_action');
  });
});

describe('seguimiento de cobro (modo cobro)', () => {
  // El `segventa` del mazo de main: un cliente que ya compró y debe.
  const ctx = { modo: 'cobro', intento: 1, seguimientoTipo: 'cerrada' };

  it('arranca preguntando qué pasó con el cobro, con las cuatro salidas del mazo', () => {
    const q = preguntaActual(estadoInicial(), ctx);
    expect(q.clave).toBe('contacto_result');
    expect(q.enunciado).toBe('¿Qué pasó con el cobro?');
    expect(q.opciones.map((o) => o.label)).toEqual(['No respondió', 'Estamos conversando', 'Pagó', 'No va a pagar']);
    expect(anterior(estadoInicial(), ctx)).toBeNull();
    expect(hitos(estadoInicial(), ctx)[1].sub).toBe('Seguimiento de cobro');
  });

  it('si no respondió pide qué sucedió y la fecha del próximo intento, sin modalidad', () => {
    let r = responder(estadoInicial(), 'contacto_result', { contacto_result: 'no_resp' });
    expect(preguntaActual(r, ctx).clave).toBe('contacto_detalle');
    expect(faltantes(r, ctx)).toEqual(['Qué sucedió exactamente (mínimo 10 caracteres, llevás 0)']);
    r = responder(r, 'contacto_detalle', { notes: 'le recordé la cuota, no contestó' });
    expect(preguntaActual(r, ctx).clave).toBe('cobro_fecha');
    expect(faltantes(r, ctx)).toEqual(['Elegí la fecha del próximo intento de cobro']);
    r = responder(r, 'cobro_fecha', { fecha_seguimiento: '2026-10-02', followup_reminder_enabled: true, followup_reminder_time: '09:00' });
    expect(completo(r, ctx)).toBe(true);
    const { accion, datos } = construirPayload(r, ctx);
    expect(accion).toBe('reportar_resultado');
    expect(datos.deck).toMatchObject({
      contact_result: 'no_resp', seguimiento_realizado: false, seguimiento_intento: 2,
      fecha_seguimiento: '2026-10-02', fecha_seguimiento_cobro: '2026-10-02', seguimiento_tipo: 'cerrada',
      followup_reminder_enabled: true, followup_reminder_time: '09:00',
    });
  });

  it('si siguen conversando también pide los referidos', () => {
    const r = recorrer({
      contacto_result: { contacto_result: 'contesto' },
      contacto_detalle: { notes: 'transfiere el lunes a primera hora' },
      cobro_fecha: { fecha_seguimiento: '2026-10-06' },
      refs_ask: { refs_ask: 'no' },
    }, ctx);
    expect(completo(r, ctx)).toBe(true);
    expect(construirPayload(r, ctx).datos.deck.closer_notes).toContain('Se pidieron referidos, no dejó.');
  });

  it('«No va a pagar» cierra el seguimiento con su motivo y sin fecha', () => {
    const r = recorrer({
      contacto_result: { contacto_result: 'no_paga' },
      contacto_detalle: { notes: 'no sigue y no paga el resto' },
    }, ctx);
    expect(construirPayload(r, ctx).datos.deck).toMatchObject({
      contact_result: 'no_paga', seguimiento_realizado: true, fecha_seguimiento: null,
      closer_notes: 'no sigue y no paga el resto | Motivo de cierre: No va a pagar',
    });
  });

  it('«Pagó» sigue a la venta y el guardado cierra el seguimiento', () => {
    let r = responder(estadoInicial(), 'contacto_result', { contacto_result: 'pago' });
    r = responder(r, 'contacto_detalle', { notes: 'me mandó el comprobante de la cuota' });
    expect(esVenta(r)).toBe(true);
    expect(preguntaActual(r, ctx).clave).toBe('venta_nombre');
    expect(hitos(r, ctx)[2].sub).toBe('Venta cerrada');
    const { accion, datos } = construirPayload(r, ctx);
    expect(accion).toBe('registrar_venta');
    expect(datos.deck).toMatchObject({ contact_result: 'pago', seguimiento_realizado: true, fecha_seguimiento: null });
  });

  it('la cadencia de un lead que no compró no se entera del cobro', () => {
    const q = preguntaActual(estadoInicial(), { modo: 'seguimiento', intento: 2 });
    expect(q.opciones.map((o) => o.valor)).toEqual(['no_resp', 'contesto', 'agendo', 'cerro']);
  });
});

describe('referidos', () => {
  it('se piden cuando hubo contacto real y validan al menos un nombre', () => {
    let r = estadoInicial();
    r = responder(r, 'res', { res: 'asistio' });
    r = responder(r, 'decisor', { with_decision_maker: true });
    r = responder(r, 'oferta', { offer_presented: false });
    r = responder(r, 'nopres_next', { nopres_next: 'seguimiento' });
    r = responder(r, 'seguimiento', { fecha_seguimiento: '2026-10-01' });
    // Una pregunta por pantalla, como en el wizard: primero si los pidió, después quiénes.
    expect(preguntaActual(r).clave).toBe('refs_ask');
    expect(preguntaActual(r).opciones.map((o) => o.valor)).toEqual(['si', 'no', 'no_pedido']);
    expect(faltantes(r)).toEqual(['Elegí una de las opciones']);
    r = responder(r, 'refs_ask', { refs_ask: 'si', refs_rows: [{ nombre: '', contacto: '' }] });
    expect(preguntaActual(r).clave).toBe('refs_filas');
    expect(faltantes(r)).toEqual(['Cargá al menos un referido con nombre']);
    r = actualizar(r, { refs_rows: [{ nombre: 'Ana', contacto: '@ana' }] });
    expect(puedeAvanzar(r)).toBe(true);
  });

  it('si no dejó referidos no se pide la lista', () => {
    const r = recorrer({
      res: { res: 'asistio' }, decisor: { with_decision_maker: true }, oferta: { offer_presented: false },
      nopres_next: { nopres_next: 'seguimiento' }, seguimiento: { fecha_seguimiento: '2026-10-01' },
      refs_ask: { refs_ask: 'no' },
    });
    expect(completo(r)).toBe(true);
    expect(construirPayload(r, {}).datos.referidos).toMatchObject({ pedido: 'no', filas: [] });
  });

  it('«no se lo pedí» deja su propia nota', () => {
    expect(notaFinal({ refs_ask: 'no_pedido', notes: 'x' })).toContain('No se pidieron referidos.');
    expect(notaFinal({ refs_ask: 'no', notes: 'x' })).toContain('Se pidieron referidos, no dejó.');
  });
});

describe('reiniciar, volver y limpieza de ramas', () => {
  it('reiniciar vuelve al estado inicial', () => {
    const r = recorrer({
      res: { res: 'reagenda' }, reag_motivo: { reag_motivo: 'No dio motivo' },
      reag_dejo_fecha: { reag_dejo_fecha: false }, seguimiento: { fecha_seguimiento: '2026-10-01' },
    });
    expect(completo(r)).toBe(true);
    const limpio = reiniciar();
    expect(arrancado(limpio)).toBe(false);
    expect(preguntaActual(limpio).clave).toBe('res');
    expect(hitos(limpio)[1].sub).toBe('Sin reportar');
  });

  it('cambiar la respuesta raíz borra las respuestas de la rama vieja', () => {
    let r = estadoInicial();
    r = responder(r, 'res', { res: 'asistio' });
    r = responder(r, 'decisor', { with_decision_maker: true });
    r = responder(r, 'oferta', { offer_presented: true });
    r = responder(r, 'cierre', { cierre: true });
    expect(r.with_decision_maker).toBe(true);
    r = responder(r, 'res', { res: 'cancelo' });
    expect(r.with_decision_maker).toBeUndefined();
    expect(r.offer_presented).toBeUndefined();
    expect(r.cierre).toBeUndefined();
    expect(preguntaActual(r).clave).toBe('cancel_motivo');
    expect(hitos(r)[2].sub).toBe('Pendiente');
  });

  it('contestar un motivo no borra el motivo de otra rama que ya estaba puesto', () => {
    let r = responder(estadoInicial(), 'res', { res: 'no_asistio' });
    r = responder(r, 'noshow_motivo', { noshow_motivo: 'Se arrepintió' });
    r = responder(r, 'noshow_detalle', { notes: 'avisó por WhatsApp' });
    expect(r.noshow_motivo).toBe('Se arrepintió');
  });

  it('volverA desmarca el paso y lo vuelve a pedir', () => {
    let r = responder(estadoInicial(), 'res', { res: 'no_asistio' });
    r = responder(r, 'noshow_motivo', { noshow_motivo: 'Otro motivo' });
    expect(preguntaActual(r).clave).toBe('noshow_detalle');
    r = volverA(r, 'noshow_motivo');
    expect(preguntaActual(r).clave).toBe('noshow_motivo');
    expect(r.noshow_motivo).toBeUndefined();
  });

  describe('«Corregir» desde la revisión', () => {
    // Es el «Guardar y volver» del wizard de venta: corregir un dato no obliga a rehacer todo lo
    // que viene después, salvo que la corrección cambie de rama.
    const guion = {
      res: { res: 'reagenda' }, reag_motivo: { reag_motivo: 'Imprevisto del lead' },
      reag_dejo_fecha: { reag_dejo_fecha: false },
      seguimiento: { fecha_seguimiento: '2026-09-29', notes: 'le pido fecha' },
    };

    it('un formulario corregido vuelve derecho a la revisión', () => {
      let r = volverA(recorrer(guion), 'seguimiento');
      expect(preguntaActual(r).clave).toBe('seguimiento');
      r = responder(r, 'seguimiento', { notes: 'le pido fecha para el jueves' });
      expect(completo(r)).toBe(true);
      expect(r.notes).toBe('le pido fecha para el jueves');
    });

    it('volver a elegir lo mismo en una pregunta de opciones conserva lo que seguía', () => {
      let r = volverA(recorrer(guion), 'reag_motivo');
      expect(preguntaActual(r).clave).toBe('reag_motivo');
      r = responder(r, 'reag_motivo', { reag_motivo: 'Imprevisto del lead' });
      expect(completo(r)).toBe(true);
      expect(r.reag_dejo_fecha).toBe(false);
    });

    it('elegir otra cosa sí borra la rama vieja y sigue desde ahí', () => {
      let r = volverA(recorrer(guion), 'reag_dejo_fecha');
      r = responder(r, 'reag_dejo_fecha', { reag_dejo_fecha: true });
      expect(preguntaActual(r).clave).toBe('reag_fecha');
      expect(completo(r)).toBe(false);
    });
  });

  describe('«Anterior»', () => {
    const guion = {
      res: { res: 'reagenda' }, reag_motivo: { reag_motivo: 'Imprevisto del lead' },
      reag_dejo_fecha: { reag_dejo_fecha: false },
      seguimiento: { fecha_seguimiento: '2026-09-29', notes: 'le pido fecha' },
    };
    // Contesta la pregunta que toca con lo mismo que tenía: la opción que había elegido o el
    // formulario como quedó.
    const igual = (r, ctx = {}) => {
      const q = preguntaActual(r, ctx);
      return responder(r, q.clave, q.tipo === 'formulario' ? {} : { [q.campo]: elegida(r, q.campo) });
    };

    it('reabre la pregunta de antes con la opción que se había elegido marcada', () => {
      let r = responder(estadoInicial(), 'res', { res: 'reagenda' });
      r = responder(r, 'reag_motivo', { reag_motivo: 'Imprevisto del lead' });
      expect(preguntaAnterior(r).clave).toBe('reag_motivo');
      r = anterior(r);
      expect(preguntaActual(r).clave).toBe('reag_motivo');
      expect(elegida(r, 'reag_motivo')).toBe('Imprevisto del lead');
    });

    it('desde la revisión vuelve a la última pregunta, sin perder lo que se escribió', () => {
      const r = anterior(recorrer(guion));
      expect(preguntaActual(r).clave).toBe('seguimiento');
      expect(r.notes).toBe('le pido fecha');
    });

    it('volver varios pasos y contestar lo mismo lleva de nuevo a la revisión en los mismos pasos', () => {
      let r = recorrer(guion);
      for (let i = 0; i < 3; i += 1) r = anterior(r);
      expect(preguntaActual(r).clave).toBe('reag_motivo');
      for (let i = 0; i < 3; i += 1) r = igual(r);
      expect(completo(r)).toBe(true);
      expect(r).toMatchObject({ reag_motivo: 'Imprevisto del lead', reag_dejo_fecha: false, fecha_seguimiento: '2026-09-29' });
    });

    it('elegir otra cosa al volver sigue por la rama nueva', () => {
      let r = anterior(anterior(recorrer(guion)));
      expect(preguntaActual(r).clave).toBe('reag_dejo_fecha');
      r = responder(r, 'reag_dejo_fecha', { reag_dejo_fecha: true });
      expect(preguntaActual(r).clave).toBe('reag_fecha');
    });

    it('desde la segunda pregunta vuelve a las cuatro tarjetas, y de ahí no hay adónde volver', () => {
      let r = responder(estadoInicial(), 'res', { res: 'asistio' });
      r = anterior(r);
      expect(arrancado(r)).toBe(false);
      expect(elegida(r, 'res')).toBe('asistio');
      expect(anterior(r)).toBeNull();
      expect(anterior(estadoInicial())).toBeNull();
    });

    it('en la cadencia de seguimiento la primera pregunta es el tope', () => {
      const ctx = { modo: 'seguimiento', intento: 2 };
      expect(anterior(estadoInicial(), ctx)).toBeNull();
      const r = anterior(responder(estadoInicial(), 'contacto_result', { contacto_result: 'no_resp' }), ctx);
      expect(preguntaActual(r, ctx).clave).toBe('contacto_result');
      expect(anterior(r, ctx)).toBeNull();
    });
  });
});

describe('resumen de revisión', () => {
  it('lista cada respuesta contestada con su rótulo', () => {
    const r = recorrer({
      res: { res: 'no_asistio' }, noshow_motivo: { noshow_motivo: 'Confundió la fecha' },
      noshow_detalle: { notes: 'pensó que era mañana' }, noshow_next: { noshow_next: 'seguimiento' },
      seguimiento: { fecha_seguimiento: '2026-09-28', followup_reminder_enabled: true, notes: 'le reagendo' },
    });
    const filas = resumen(r);
    const etiquetas = filas.map((f) => f.label);
    expect(etiquetas).toContain('¿Qué pasó con esta llamada?');
    expect(etiquetas).toContain('¿Por qué no se presentó?');
    expect(etiquetas).toContain('Fecha del próximo contacto');
    expect(filas.find((f) => f.label === '¿Qué pasó con esta llamada?').valor).toBe('No asistió');
    expect(filas.find((f) => f.label === 'Avisarme por WhatsApp').valor).toBe('Sí');
    // los campos vacíos no ensucian la revisión
    expect(etiquetas).not.toContain('Hora del aviso');
  });
});

describe('fechaHoraAIso', () => {
  it('interpreta la fecha y la hora como locales', () => {
    const iso = fechaHoraAIso('2026-10-05', '20:00');
    const d = new Date(iso);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(5);
    expect(d.getHours()).toBe(20);
  });

  it('sin hora usa el mediodía y sin fecha devuelve null', () => {
    expect(new Date(fechaHoraAIso('2026-10-05')).getHours()).toBe(12);
    expect(fechaHoraAIso('')).toBeNull();
  });
});
