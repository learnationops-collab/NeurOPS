import { describe, it, expect } from 'vitest';
import {
  estadoInicial, reiniciar, responder, actualizar, volverA, preguntaActual, faltantes,
  puedeAvanzar, completo, arrancado, hitos, resumen, esVenta, quedaDeuda, construirPayload,
  notaFinal, fechaHoraAIso, TIPOS_PAGO, RAICES,
} from './arbolResultado';

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

const CLIENTE = {
  nombre_cliente: 'Kevin Álvarez', instagram: '@kevin', mail_cliente: 'kevin@mail.com',
  telefono: '+54 9 11 5555', documento_identidad: '30111222', email_vendedor: 'jean@neuro.com',
  setter: 'Elías',
};
const META = { examen_lead: 'USMLE Step 1', date: '2026-09-25', sold_in_call: true, estado: 'Completada', notas: 'cerró rápido' };

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

describe('camino: venta al contado', () => {
  const guion = {
    res: { res: 'asistio' },
    decisor: { with_decision_maker: true },
    oferta: { offer_presented: true },
    cierre: { cierre: true },
    deuda: { deuda: false },
    up: { up: 'none' },
    programa: { programa: 'RR' },
    tipo_pago: { tipo_pago_simple: 'completo' },
    venta_cliente: CLIENTE,
    venta_montos: { monto: '2000' },
    medio_pago: { metodo_pago: 'Stripe' },
    venta_meta: META,
    venta_extras: { enviar_webhook: true, dar_acceso_academia: true },
    referidos: { refs_ask: 'no' },
  };

  it('recorre exactamente los pasos esperados', () => {
    expect(clavesRecorridas(guion)).toEqual([
      'res', 'decisor', 'oferta', 'cierre', 'deuda', 'up', 'programa', 'tipo_pago',
      'venta_cliente', 'venta_montos', 'medio_pago', 'venta_meta', 'venta_extras', 'referidos',
    ]);
  });

  it('no pasa por el paso de cuotas porque no quedó deuda', () => {
    expect(clavesRecorridas(guion)).not.toContain('venta_cuotas');
  });

  it('queda completo y es venta sin deuda', () => {
    const r = recorrer(guion);
    expect(completo(r)).toBe(true);
    expect(esVenta(r)).toBe(true);
    expect(quedaDeuda(r)).toBe(false);
  });

  it('los hitos quedan en verde hasta Deuda', () => {
    const h = hitos(recorrer(guion));
    expect(h.map((x) => x.estado)).toEqual(['hecho', 'hecho', 'hecho', 'hecho', 'pendiente']);
    expect(h[1].sub).toBe('Asistió · con decisor');
    expect(h[2].sub).toBe('Venta cerrada');
    expect(h[3].sub).toBe('Sin deuda');
    expect(h[4].sub).toBe('Ninguno');
  });

  it('el payload lleva todos los campos que hoy manda buildSalePayload', () => {
    const r = recorrer(guion);
    const { accion, datos } = construirPayload(r, {
      appointmentId: 77, ahora: new Date(2026, 8, 26, 10, 30, 0), estadoPagos: { total_paid: 0, balance_remaining: 0 },
    });
    expect(accion).toBe('venta');
    expect(datos.venta).toMatchObject({
      email_vendedor: 'jean@neuro.com',
      nombre_cliente: 'Kevin Álvarez',
      telefono: '54 9 11 5555',
      mail_cliente: 'kevin@mail.com',
      tipo_pago: 'RR - completo',
      monto: 2000,
      metodo_pago: 'Stripe',
      examen: 'USMLE Step 1 | cerró rápido',
      instagram: 'kevin',
      estado: 'Completada',
      setter: 'Elías',
      documento_identidad: '30111222',
      appointment_id: 77,
      enviar_webhook: true,
      enviar_mensaje: true,
      sold_in_call: true,
    });
    expect(datos.venta.precio_total).toBeUndefined();
    expect(datos.venta.marca_temporal).toContain('26');
    expect(datos.agenda).toEqual({ with_decision_maker: true, offer_presented: true });
    expect(datos.acceso_academia).toEqual({ programa_code: 'RR', tipo_venta: 'completo', email: 'kevin@mail.com' });
    expect(datos.plan_cuotas).toBeNull();
    expect(datos.cuota_cobrada).toBeNull();
    expect(datos.liquidar_saldo).toBeNull();
    expect(datos.seguimiento_cobro).toBeNull();
    expect(datos.referidos).toMatchObject({ pedido: 'no', referralAsked: 'asked', referralCount: 0 });
    expect(datos.respuestas.res).toBe('asistio');
  });
});

describe('camino: venta parcial con plan de cuotas', () => {
  const guion = {
    res: { res: 'asistio' },
    decisor: { with_decision_maker: false },
    oferta: { offer_presented: true },
    cierre: { cierre: true },
    deuda: { deuda: true },
    up: { up: 'none' },
    programa: { programa: 'AL' },
    tipo_pago: { tipo_pago_simple: 'parcial' },
    venta_cliente: CLIENTE,
    venta_montos: { precio_total: '2000', monto: '500', segundo_pago: 'resto en 3 cuotas' },
    medio_pago: { metodo_pago: 'Transferencia Bancaria' },
    venta_cuotas: { num_cuotas: 3, installmentMode: 'monthly', cuotaFechas: { 1: '2026-10-25', 2: '2026-11-25', 3: '2026-12-25' } },
    venta_meta: { ...META, fecha_cobro: '2026-10-20' },
    venta_extras: { enviar_webhook: false },
    referidos: { refs_ask: 'si', refs_rows: [{ nombre: 'Ana', contacto: '@ana' }, { nombre: 'Beto', contacto: '' }] },
  };

  it('pasa por el paso de cuotas', () => {
    expect(clavesRecorridas(guion)).toContain('venta_cuotas');
  });

  it('el hito de deuda queda en ámbar', () => {
    const h = hitos(recorrer(guion));
    expect(h[3]).toMatchObject({ label: 'Deuda', sub: 'Con deuda', estado: 'alerta' });
    expect(h[1].sub).toBe('Asistió · sin decisor');
    expect(quedaDeuda(recorrer(guion))).toBe(true);
  });

  it('el plan reparte el saldo y la última cuota absorbe la diferencia', () => {
    const { datos } = construirPayload(recorrer(guion), {
      appointmentId: 5, estadoPagos: { total_paid: 100, balance_remaining: 1400 },
    });
    // cobrado_hoy = lo que ya había pagado antes (100) + lo de hoy (500)
    expect(datos.plan_cuotas).toMatchObject({
      total: 2000, cobrado_hoy: 600, num_cuotas: 3, programa_code: 'AL',
      fechas: ['2026-10-25', '2026-11-25', '2026-12-25'],
    });
    expect(datos.plan_cuotas.montos.reduce((a, b) => a + b, 0)).toBeCloseTo(1400, 2);
  });

  it('la fecha de cobro viaja como seguimiento de cobro y el webhook queda apagado', () => {
    const { datos } = construirPayload(recorrer(guion), { appointmentId: 5 });
    expect(datos.seguimiento_cobro).toEqual({
      fecha_seguimiento_cobro: '2026-10-20', fecha_seguimiento: '2026-10-20',
      seguimiento_tipo: 'cerrada', seguimiento_sub: 'Seguimiento de cobro',
      seguimiento_intento: 1, seguimiento_realizado: false,
    });
    expect(datos.venta.enviar_webhook).toBe(false);
    expect(datos.venta.enviar_mensaje).toBe(false);
  });

  it('los referidos con y sin contacto quedan anotados en la nota', () => {
    const r = recorrer(guion);
    expect(notaFinal(r)).toContain('1 referido(s) con datos → agenda creada');
    expect(notaFinal(r)).toContain('Referido(s) sin datos: Beto');
    const { datos } = construirPayload(r, {});
    expect(datos.referidos.filas).toHaveLength(2);
    expect(datos.referidos.referralAsked).toBe('got');
  });
});

describe('venta: renovación y upsell', () => {
  const base = {
    res: { res: 'asistio' }, decisor: { with_decision_maker: true }, oferta: { offer_presented: true },
    cierre: { cierre: true }, deuda: { deuda: false }, programa: { programa: 'SI' },
    venta_cliente: CLIENTE, venta_montos: { precio_total: '900', monto: '900' },
    medio_pago: { metodo_pago: 'PayPal' }, venta_meta: META,
    venta_extras: { settleBalanceWithSale: true }, referidos: { refs_ask: 'no_pedido' },
  };

  it('elegir Renovación deja Renovacion como único tipo de pago posible', () => {
    let r = estadoInicial();
    r = responder(r, 'res', { res: 'asistio' });
    r = responder(r, 'decisor', { with_decision_maker: true });
    r = responder(r, 'oferta', { offer_presented: true });
    r = responder(r, 'cierre', { cierre: true });
    r = responder(r, 'deuda', { deuda: false });
    r = responder(r, 'up', { up: 'Renovación' });
    r = responder(r, 'programa', { programa: 'SI' });
    expect(preguntaActual(r).opciones.map((o) => o.valor)).toEqual(['Renovacion']);
  });

  it('con saldo previo y el checkbox prendido se liquida el saldo antes de la venta', () => {
    const r = recorrer({ ...base, up: { up: 'Upsell' }, tipo_pago: { tipo_pago_simple: 'Upsell' } });
    const { datos } = construirPayload(r, { estadoPagos: { total_paid: 500, balance_remaining: 750 } });
    expect(datos.liquidar_saldo).toEqual({
      monto: 750, tipo_pago: 'SI - Cuota', comentario: 'Liquidación de saldo previo a Renovación/Upsell',
    });
    expect(hitos(r)[4]).toMatchObject({ sub: 'Upsell', estado: 'hecho' });
  });

  it('sin saldo previo no se liquida nada', () => {
    const r = recorrer({ ...base, up: { up: 'Renovación' }, tipo_pago: { tipo_pago_simple: 'Renovacion' } });
    const { datos } = construirPayload(r, { estadoPagos: { total_paid: 0, balance_remaining: 0 } });
    expect(datos.liquidar_saldo).toBeNull();
  });

  it('el vocabulario completo de 6 tipos de pago sigue existiendo', () => {
    expect(TIPOS_PAGO.map((t) => t.valor)).toEqual(['completo', 'parcial', 'Seña', 'Cuota', 'Renovacion', 'Upsell']);
  });
});

describe('venta: cobro de una cuota ya existente', () => {
  it('marca la cuota pagada en vez de recrear el plan', () => {
    const r = recorrer({
      res: { res: 'asistio' }, decisor: { with_decision_maker: true }, oferta: { offer_presented: true },
      cierre: { cierre: true }, deuda: { deuda: true }, up: { up: 'none' }, programa: { programa: 'RR' },
      tipo_pago: { tipo_pago_simple: 'Cuota' }, venta_cliente: CLIENTE,
      venta_montos: { precio_total: '2000', monto: '500' }, medio_pago: { metodo_pago: 'Stripe' },
      venta_cuotas: { selectedCuotaId: 42 }, venta_meta: META, venta_extras: {},
      referidos: { refs_ask: 'no' },
    });
    const { datos } = construirPayload(r, { estadoPagos: { total_paid: 1000 } });
    expect(datos.cuota_cobrada).toEqual({ cuota_id: 42, estado: 'pagado', monto: 500 });
    expect(datos.plan_cuotas).toBeNull();
  });
});

describe('camino: asistió, oferta presentada, no cerró', () => {
  const seguimiento = {
    res: { res: 'asistio' }, decisor: { with_decision_maker: true }, oferta: { offer_presented: true },
    cierre: { cierre: false }, nocierre_next: { nocierre_next: 'seguimiento' },
    seguimiento: { fecha_seguimiento: '2026-09-30', followup_reminder_enabled: true, followup_reminder_time: '09:00', notes: 'vuelve el lunes' },
    referidos: { refs_ask: 'no' },
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
    r = responder(r, 'referidos', { refs_ask: 'no' });
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
    r = responder(r, 'referidos', { refs_ask: 'no_pedido' });
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
      referidos: { refs_ask: 'no' },
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
    expect(claves).not.toContain('referidos');
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
    expect(construirPayload(r, {}).datos.process).toMatchObject({ status: 'Lead Perdido', note: 'no show reiterado' });
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
    r = responder(r, 'referidos', { refs_ask: 'no' });
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
    expect(preguntaActual(r, ctx).clave).toBe('referidos');
    r = responder(r, 'referidos', { refs_ask: 'si', refs_rows: [{ nombre: 'Lu', contacto: '+5491122' }] });
    const { datos } = construirPayload(r, ctx);
    expect(datos.reagenda).toMatchObject({ modo: 'seguimiento_agendo' });
    expect(datos.deck).toMatchObject({ confirm_status: 'por_confirmar', seguimiento_realizado: true, fecha_seguimiento: null });
  });

  it('«cerró la venta» entra a la rama de venta y cierra antes el seguimiento', () => {
    let r = responder(estadoInicial(), 'contacto_result', { contacto_result: 'cerro' });
    r = responder(r, 'contacto_detalle', { modalidad: ['Llamada'], notes: 'me pasó el comprobante del pago' });
    expect(preguntaActual(r, ctx).clave).toBe('deuda');
    expect(esVenta(r)).toBe(true);
    r = responder(r, 'deuda', { deuda: false });
    r = responder(r, 'up', { up: 'none' });
    r = responder(r, 'programa', { programa: 'RR' });
    r = responder(r, 'tipo_pago', { tipo_pago_simple: 'completo' });
    r = responder(r, 'venta_cliente', CLIENTE);
    r = responder(r, 'venta_montos', { monto: '2000' });
    r = responder(r, 'medio_pago', { metodo_pago: 'Stripe' });
    r = responder(r, 'venta_meta', META);
    r = responder(r, 'venta_extras', {});
    r = responder(r, 'referidos', { refs_ask: 'no' });
    expect(completo(r, ctx)).toBe(true);
    const { accion, datos } = construirPayload(r, ctx);
    expect(accion).toBe('venta');
    expect(datos.deck).toMatchObject({ seguimiento_realizado: true, fecha_seguimiento: null, contact_result: 'cerro' });
    expect(hitos(r, ctx)[1].sub).toBe('Seguimiento 2 de 4');
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

describe('referidos', () => {
  it('se piden cuando hubo contacto real y validan al menos un nombre', () => {
    let r = recorrer({
      res: { res: 'asistio' }, decisor: { with_decision_maker: true }, oferta: { offer_presented: false },
      nopres_next: { nopres_next: 'seguimiento' }, seguimiento: { fecha_seguimiento: '2026-10-01' },
      referidos: {},
    });
    // El guión deja `referidos` sin contestar los campos: el paso queda confirmado pero
    // `validar` del paso ya se probó abajo.
    expect(r).toBeTruthy();

    r = estadoInicial();
    r = responder(r, 'res', { res: 'asistio' });
    r = responder(r, 'decisor', { with_decision_maker: true });
    r = responder(r, 'oferta', { offer_presented: false });
    r = responder(r, 'nopres_next', { nopres_next: 'seguimiento' });
    r = responder(r, 'seguimiento', { fecha_seguimiento: '2026-10-01' });
    expect(preguntaActual(r).clave).toBe('referidos');
    expect(faltantes(r)).toEqual(['Completá ¿Le pediste referidos?']);
    r = actualizar(r, { refs_ask: 'si', refs_rows: [{ nombre: '', contacto: '' }] });
    expect(faltantes(r)).toEqual(['Cargá al menos un referido con nombre']);
    r = actualizar(r, { refs_rows: [{ nombre: 'Ana', contacto: '@ana' }] });
    expect(puedeAvanzar(r)).toBe(true);
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
