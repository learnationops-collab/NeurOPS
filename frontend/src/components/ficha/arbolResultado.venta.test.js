import { describe, it, expect } from 'vitest';
import {
  estadoInicial, responder, actualizar, volverA, preguntaActual, faltantes, puedeAvanzar,
  completo, hitos, resumen, esVenta, quedaDeuda, construirPayload, notaFinal, progresoVenta,
  saldoVenta, fechasCuotas, arrancado, ventaDirecta, anterior, elegida, TIPOS_PAGO,
} from './arbolResultado';

// La rama de la venta del árbol de «Resultado»: el wizard «Declarar venta» del mazo, una pregunta
// por pantalla, dentro de la ficha.

// Recorre el árbol contestando en orden lo que indica `guion` (clave → valores). Falla si el
// árbol pide una pregunta que el guión no previó: así un cambio de ramas rompe el test en vez de
// pasar silenciosamente.
function recorrer(guion, contexto = {}, inicial = INICIAL()) {
  let r = inicial;
  for (let paso = 0; paso < 60; paso += 1) {
    const q = preguntaActual(r, contexto);
    if (!q) return r;
    expect(guion, `el guión no contesta «${q.clave}»`).toHaveProperty(q.clave);
    r = responder(r, q.clave, guion[q.clave]);
  }
  throw new Error('el árbol no terminó en 60 pasos');
}

function claves(guion, contexto = {}) {
  let r = INICIAL();
  const vistas = [];
  for (let paso = 0; paso < 60; paso += 1) {
    const q = preguntaActual(r, contexto);
    if (!q) return vistas;
    vistas.push(q.clave);
    r = responder(r, q.clave, guion[q.clave] || {});
  }
  throw new Error('el árbol no terminó en 60 pasos');
}

// Lo que la pestaña precarga de la ficha (`precargar` en TabResultado).
const INICIAL = () => ({
  ...estadoInicial(), email_vendedor: 'jean@neuro.com', setter: 'Elías', sold_in_call: true,
  enviar_webhook: true, date: '2026-09-25', num_cuotas: 1, dia_de_pago: 10, refs_rows: [],
});

const LLAMADA = {
  res: { res: 'asistio' }, decisor: { with_decision_maker: true },
  oferta: { offer_presented: true }, cierre: { cierre: true },
};
// Cada dato del comprador en su pantalla, como en el wizard.
const COMPRADOR = {
  venta_nombre: { nombre_cliente: 'Kevin Álvarez' },
  venta_instagram: { instagram: '@kevin' },
  venta_email: { mail_cliente: 'kevin@mail.com' },
  venta_telefono: { telefono: '+54 9 11 5555' },
  venta_documento: { documento_identidad: '30111222' },
};
const DATOS_DE_LA_VENTA = {
  venta_examen: { examen_lead: 'USMLE Step 1' },
  venta_fecha: { date: '2026-09-25', sold_in_call: true },
  venta_estado: { estado: 'Completada' },
  venta_notas: { notas: 'cerró rápido' },
};

describe('camino: venta al contado', () => {
  const guion = {
    ...LLAMADA, ...COMPRADOR,
    programa: { programa: 'RR' },
    tipo_pago: { tipo_pago_simple: 'completo' },
    venta_montos: { monto: '2000' },
    medio_pago: { metodo_pago: 'Stripe' },
    ...DATOS_DE_LA_VENTA,
    refs_ask: { refs_ask: 'no' },
    venta_academia: { dar_acceso_academia: true },
  };

  it('pregunta cada dato del comprador en su propia pantalla, en el orden del wizard', () => {
    expect(claves(guion)).toEqual([
      'res', 'decisor', 'oferta', 'cierre',
      'venta_nombre', 'venta_instagram', 'venta_email', 'venta_telefono', 'venta_documento',
      'programa', 'tipo_pago', 'venta_montos', 'medio_pago',
      'venta_examen', 'venta_fecha', 'venta_estado', 'venta_notas',
      'refs_ask', 'venta_academia',
    ]);
  });

  it('no pasa por el cronograma porque no queda saldo', () => {
    expect(claves(guion).filter((c) => c.includes('cuota'))).toEqual([]);
  });

  it('queda completo y es venta sin deuda', () => {
    const r = recorrer(guion);
    expect(completo(r)).toBe(true);
    expect(esVenta(r)).toBe(true);
    expect(quedaDeuda(r)).toBe(false);
  });

  it('los hitos quedan en verde hasta Deuda, y el upsell dice «Ninguno»', () => {
    const h = hitos(recorrer(guion));
    expect(h.map((x) => x.estado)).toEqual(['hecho', 'hecho', 'hecho', 'hecho', 'pendiente']);
    expect(h[1].sub).toBe('Asistió · con decisor');
    expect(h[2].sub).toBe('Venta cerrada');
    expect(h[3].sub).toBe('Sin deuda');
    expect(h[4].sub).toBe('Ninguno');
  });

  it('el payload va a `registrar_venta` con todos los campos que manda buildSalePayload', () => {
    const r = recorrer(guion);
    const { accion, datos } = construirPayload(r, { appointmentId: 77, ahora: new Date(2026, 8, 26, 10, 30, 0) });
    // `registrar_venta` es la que existe en `fichaApi.RUTAS`; `venta` fallaba antes de salir.
    expect(accion).toBe('registrar_venta');
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
    expect(datos.venta.marca_temporal).toContain('25');
    expect(datos.agenda).toEqual({ with_decision_maker: true, offer_presented: true });
    expect(datos.acceso_academia).toEqual({ programa_code: 'RR', tipo_venta: 'completo', email: 'kevin@mail.com' });
    expect(datos.plan_cuotas).toBeNull();
    expect(datos.cuota_cobrada).toBeNull();
    expect(datos.liquidar_saldo).toBeNull();
    expect(datos.seguimiento_cobro).toBeNull();
    expect(datos.referidos).toMatchObject({ pedido: 'no', referralAsked: 'asked', referralCount: 0 });
    expect(datos.respuestas.res).toBe('asistio');
  });

  it('en un pago completo el precio de lista no viaja: el precio ES lo cobrado', () => {
    // La pestaña precarga el precio del programa; mandarlo con un PIF con descuento dejaba al
    // cliente debiendo la diferencia (`post_to_sheets` guarda ese precio como su total).
    const r = recorrer(guion, {}, { ...INICIAL(), precio_total: '1500' });
    expect(construirPayload(r, {}).datos.venta.precio_total).toBeUndefined();
  });

  it('decir que no al acceso a la Academia no lo pide', () => {
    const r = recorrer({ ...guion, venta_academia: { dar_acceso_academia: false } });
    expect(construirPayload(r, {}).datos.acceso_academia).toBeNull();
  });

  it('el avance cuenta los pasos de la venta, del nombre a la Academia', () => {
    let r = INICIAL();
    ['res', 'decisor', 'oferta', 'cierre'].forEach((clave) => { r = responder(r, clave, guion[clave]); });
    expect(progresoVenta(r)).toEqual({ paso: 1, total: 15, listo: false });
    r = responder(r, 'venta_nombre', guion.venta_nombre);
    expect(progresoVenta(r)).toMatchObject({ paso: 2 });
    expect(progresoVenta(recorrer(guion))).toEqual({ paso: 15, total: 15, listo: true });
    expect(progresoVenta(responder(INICIAL(), 'res', { res: 'no_asistio' }))).toBeNull();
  });
});

describe('camino: venta parcial con plan de cuotas', () => {
  const guion = {
    ...LLAMADA,
    decisor: { with_decision_maker: false },
    ...COMPRADOR,
    programa: { programa: 'AL' },
    tipo_pago: { tipo_pago_simple: 'parcial' },
    venta_montos: { precio_total: '2000', monto: '500', segundo_pago: 'resto en 3 cuotas' },
    medio_pago: { metodo_pago: 'Transferencia Bancaria' },
    transferido_a: { transferido_a: 'jean_carlo' },
    venta_num_cuotas: { num_cuotas: 3 },
    venta_modo_cuotas: { installmentMode: 'custom' },
    venta_fechas_cuotas: { cuotaFechas: { 1: '2026-10-25', 2: '2026-11-25', 3: '2026-12-25' } },
    ...DATOS_DE_LA_VENTA,
    venta_notas: { notas: 'cerró rápido', fecha_cobro: '2026-10-20' },
    refs_ask: { refs_ask: 'si' },
    refs_filas: { refs_rows: [{ nombre: 'Ana', contacto: '@ana' }, { nombre: 'Beto', contacto: '' }] },
    venta_academia: { dar_acceso_academia: false },
  };

  it('pasa por a quién se le hizo la transferencia, cuántas cuotas, si es mensual y las fechas', () => {
    const vistas = claves(guion);
    expect(vistas.slice(vistas.indexOf('medio_pago'), vistas.indexOf('venta_examen'))).toEqual([
      'medio_pago', 'transferido_a', 'venta_num_cuotas', 'venta_modo_cuotas', 'venta_fechas_cuotas',
    ]);
  });

  it('a quién se le hizo la transferencia sale del vocabulario y dice a quién se le descuenta', () => {
    let r = INICIAL();
    Object.entries(guion).slice(0, Object.keys(guion).indexOf('transferido_a')).forEach(([clave, valores]) => {
      r = responder(r, clave, valores);
    });
    const contexto = { transferidoA: [
      { clave: 'pedro', label: 'Pedro', descuenta: true }, { clave: 'jean_carlo', label: 'Jean Carlo', descuenta: true },
      { clave: 'otro', label: 'Otro', descuenta: false },
    ] };
    const q = preguntaActual(r, contexto);
    expect(q.enunciado).toBe('¿A quién se le hizo la transferencia?');
    expect(q.opciones.map((o) => [o.valor, o.label, o.sub])).toEqual([
      ['pedro', 'Pedro', 'Se le descuenta en Payroll'],
      ['jean_carlo', 'Jean Carlo', 'Se le descuenta en Payroll'],
      ['otro', 'Otro', 'Solo se anota en Finanzas'],
    ]);
    // Es obligatoria: sin contestarla el árbol no está completo.
    expect(completo(r, contexto)).toBe(false);
  });

  it('a quién se le hizo la transferencia viaja en la venta', () => {
    const { datos } = construirPayload(recorrer(guion), { appointmentId: 5 });
    expect(datos.venta).toMatchObject({ metodo_pago: 'Transferencia Bancaria', transferido_a: 'jean_carlo' });
  });

  it('si el medio se corrige a otro, a quién ya no viaja ni se pregunta', () => {
    const r = actualizar(recorrer(guion), { metodo_pago: 'Stripe' });
    expect(claves({ ...guion, medio_pago: { metodo_pago: 'Stripe' } })).not.toContain('transferido_a');
    expect(construirPayload(r, { appointmentId: 5 }).datos.venta.transferido_a).toBeNull();
  });

  it('el hito de deuda queda en ámbar recién cuando se cargaron los montos', () => {
    let r = INICIAL();
    ['res', 'decisor', 'oferta', 'cierre', ...Object.keys(COMPRADOR), 'programa', 'tipo_pago']
      .forEach((clave) => { r = responder(r, clave, guion[clave]); });
    expect(hitos(r)[3]).toMatchObject({ sub: 'Pendiente', estado: 'pendiente' });
    const h = hitos(recorrer(guion));
    expect(h[3]).toMatchObject({ label: 'Deuda', sub: 'Con deuda', estado: 'alerta' });
    expect(h[1].sub).toBe('Asistió · sin decisor');
    expect(quedaDeuda(recorrer(guion))).toBe(true);
  });

  it('el saldo descuenta lo que el cliente ya había pagado del programa', () => {
    const r = recorrer(guion);
    expect(saldoVenta(r, {})).toBe(1500);
    expect(saldoVenta(r, { estadoVenta: { total_paid: 100 } })).toBe(1400);
  });

  it('el plan reparte el saldo con las fechas elegidas y la última cuota absorbe la diferencia', () => {
    const { datos } = construirPayload(recorrer(guion), {
      appointmentId: 5, estadoVenta: { total_paid: 100, balance_remaining: 1400 },
    });
    // cobrado_hoy = lo que ya había pagado antes (100) + lo de hoy (500)
    expect(datos.plan_cuotas).toMatchObject({
      total: 2000, cobrado_hoy: 600, num_cuotas: 3, programa_code: 'AL',
      fechas: ['2026-10-25', '2026-11-25', '2026-12-25'],
    });
    expect(datos.plan_cuotas.montos.reduce((a, b) => a + b, 0)).toBeCloseTo(1400, 2);
    expect(datos.venta.precio_total).toBe(2000);
  });

  it('la fecha de cobro viaja como seguimiento de cobro', () => {
    const { datos } = construirPayload(recorrer(guion), { appointmentId: 5 });
    expect(datos.seguimiento_cobro).toEqual({
      fecha_seguimiento_cobro: '2026-10-20', fecha_seguimiento: '2026-10-20',
      seguimiento_tipo: 'cerrada', seguimiento_sub: 'Seguimiento de cobro',
      seguimiento_intento: 1, seguimiento_realizado: false,
    });
  });

  it('los referidos con y sin contacto quedan anotados y viajan para crearse', () => {
    const r = recorrer(guion);
    expect(notaFinal(r)).toContain('1 referido(s) con datos → agenda creada');
    expect(notaFinal(r)).toContain('Referido(s) sin datos: Beto');
    const { datos } = construirPayload(r, {});
    expect(datos.referidos.filas).toHaveLength(2);
    expect(datos.referidos.referralAsked).toBe('got');
  });

  describe('plan mensual', () => {
    const mensual = {
      ...guion,
      venta_modo_cuotas: { installmentMode: 'monthly' },
      venta_dia_pago: { dia_de_pago: 15 },
    };
    delete mensual.venta_fechas_cuotas;

    it('pregunta el día de pago en vez de las fechas', () => {
      expect(claves(mensual)).toContain('venta_dia_pago');
      expect(claves(mensual)).not.toContain('venta_fechas_cuotas');
    });

    it('las fechas viajan calculadas con el día elegido, no vacías', () => {
      // Antes viajaban `null` y el backend las calculaba desde hoy, sin el día de pago.
      const { datos } = construirPayload(recorrer(mensual), { ahora: new Date(2026, 8, 26) });
      expect(datos.plan_cuotas.fechas).toEqual(['2026-10-15', '2026-11-15', '2026-12-15']);
    });

    it('un día que el mes no tiene cae en el último del mes', () => {
      const r = { ...recorrer(mensual), dia_de_pago: 31 };
      expect(fechasCuotas(r, new Date(2026, 8, 26))).toEqual(['2026-10-31', '2026-11-30', '2026-12-31']);
    });

    it('la revisión cuenta el cronograma en una línea', () => {
      const filas = resumen(recorrer(mensual), {});
      expect(filas.find((f) => f.label === 'Día de pago').valor).toBe('El 15 de cada mes');
      expect(filas.find((f) => f.label === 'Cronograma').valor).toMatch(/^15 \w{3} \$500 · 15 \w{3} \$500 · 15 \w{3} \$500$/);
      expect(filas.find((f) => f.label === 'Cantidad de cuotas').valor).toBe('3 cuotas');
      expect(filas.find((f) => f.label === 'Cobrado hoy').valor).toBe('$500');
    });
  });
});

describe('venta: tipos de pago, renovación y upsell', () => {
  const hastaElTipo = (contexto = {}) => {
    let r = INICIAL();
    Object.entries({ ...LLAMADA, ...COMPRADOR, programa: { programa: 'SI' } })
      .forEach(([clave, valores]) => { r = responder(r, clave, valores); });
    expect(preguntaActual(r, contexto).clave).toBe('tipo_pago');
    return r;
  };

  it('ofrece siempre los 6 tipos: el historial avisa, no esconde', () => {
    const r = hastaElTipo({ estadoVenta: { sales_count: 0, allowed_types: { parcial: { ok: false, reason: 'Ya tiene un Parcial' } } } });
    const opciones = preguntaActual(r, { estadoVenta: { allowed_types: { parcial: { ok: false, reason: 'Ya tiene un Parcial' } } } }).opciones;
    expect(opciones.map((o) => o.valor)).toEqual(TIPOS_PAGO.map((t) => t.valor));
    expect(opciones.find((o) => o.valor === 'parcial').aviso).toBe('Ya tiene un Parcial');
    expect(opciones.find((o) => o.valor === 'Cuota').aviso).toBeNull();
  });

  it('con saldo viejo, una renovación pregunta si se liquida junto con la venta', () => {
    const contexto = { estadoVenta: { sales_count: 0, balance_remaining: 750, can_settle_balance_with_installment: true } };
    let r = responder(hastaElTipo(contexto), 'tipo_pago', { tipo_pago_simple: 'Renovacion' });
    const q = preguntaActual(r, contexto);
    expect(q.clave).toBe('liquidar');
    expect(q.enunciado).toBe('Todavía debe $750 del programa. ¿Lo liquidás junto con esta venta?');
    r = responder(r, 'liquidar', { settleBalanceWithSale: true });
    expect(hitos(r, contexto)[4]).toMatchObject({ sub: 'Renovación', estado: 'hecho' });
    expect(construirPayload(r, contexto).datos.liquidar_saldo).toEqual({
      monto: 750, tipo_pago: 'SI - Cuota', comentario: 'Liquidación de saldo previo a Renovación/Upsell',
    });
  });

  it('sin saldo viejo no se pregunta ni se liquida nada', () => {
    const contexto = { estadoVenta: { sales_count: 0, balance_remaining: 0, can_settle_balance_with_installment: false } };
    const r = responder(hastaElTipo(contexto), 'tipo_pago', { tipo_pago_simple: 'Upsell' });
    expect(preguntaActual(r, contexto).clave).toBe('venta_montos');
    expect(construirPayload(r, contexto).datos.liquidar_saldo).toBeNull();
  });
});

describe('venta: cómo viene pagando el cliente', () => {
  const hastaElPrograma = () => {
    let r = INICIAL();
    Object.entries({ ...LLAMADA, ...COMPRADOR, programa: { programa: 'RR' } })
      .forEach(([clave, valores]) => { r = responder(r, clave, valores); });
    return r;
  };

  it('mientras carga el estado del programa, espera en «Así viene este cliente»', () => {
    const r = hastaElPrograma();
    expect(preguntaActual(r, { cargandoVenta: true }).clave).toBe('venta_estado_cliente');
    expect(puedeAvanzar(r, { cargandoVenta: true })).toBe(false);
  });

  it('un cliente sin pagos en el programa no ve el resumen', () => {
    expect(preguntaActual(hastaElPrograma(), { estadoVenta: { sales_count: 0 } }).clave).toBe('tipo_pago');
  });

  it('un cliente que ya pagó ve el resumen antes de elegir cómo paga', () => {
    const contexto = { estadoVenta: { sales_count: 2, total_paid: 500, balance_remaining: 1000 } };
    const r = hastaElPrograma();
    expect(preguntaActual(r, contexto).clave).toBe('venta_estado_cliente');
    expect(puedeAvanzar(r, contexto)).toBe(true);
    expect(preguntaActual(responder(r, 'venta_estado_cliente', {}), contexto).clave).toBe('tipo_pago');
  });
});

describe('venta: cobro de una cuota del plan ya armado', () => {
  const contexto = {
    estadoVenta: { sales_count: 1, total_paid: 1000 },
    cuotas: [
      { id: 41, numero_cuota: 1, monto: 500, fecha_vencimiento: '2026-09-10', estado: 'pagado', programa_code: 'RR' },
      { id: 42, numero_cuota: 2, monto: 500, fecha_vencimiento: '2026-10-10', estado: 'pendiente', programa_code: 'RR' },
      { id: 90, numero_cuota: 1, monto: 300, fecha_vencimiento: '2026-10-10', estado: 'pendiente', programa_code: 'AL' },
    ],
  };
  const guion = {
    ...LLAMADA, ...COMPRADOR,
    programa: { programa: 'RR' },
    venta_estado_cliente: {},
    tipo_pago: { tipo_pago_simple: 'Cuota' },
    venta_montos: { precio_total: '2000', monto: '500' },
    medio_pago: { metodo_pago: 'Stripe' },
    venta_cuota: { selectedCuotaId: 42 },
    ...DATOS_DE_LA_VENTA,
    refs_ask: { refs_ask: 'no' },
    venta_academia: { dar_acceso_academia: false },
  };

  it('elige cuál cuota se paga en vez de armar un cronograma nuevo', () => {
    const vistas = claves(guion, contexto);
    expect(vistas).toContain('venta_cuota');
    expect(vistas).not.toContain('venta_num_cuotas');
  });

  it('exige elegir la cuota', () => {
    let r = INICIAL();
    const vistas = claves(guion, contexto);
    vistas.slice(0, vistas.indexOf('venta_cuota')).forEach((clave) => { r = responder(r, clave, guion[clave]); });
    expect(faltantes(r, contexto)).toEqual(['Elegí la cuota que se paga']);
  });

  it('marca la cuota pagada y no recrea el plan', () => {
    const { datos } = construirPayload(recorrer(guion, contexto), contexto);
    expect(datos.cuota_cobrada).toEqual({ cuota_id: 42, estado: 'pagado', monto: 500 });
    expect(datos.plan_cuotas).toBeNull();
    expect(datos.venta.tipo_pago).toBe('RR - Cuota');
  });

  it('la revisión nombra la cuota elegida', () => {
    const fila = resumen(recorrer(guion, contexto), contexto).find((f) => f.label === 'Cuota que se paga');
    expect(fila.valor).toBe('Cuota 2 · vence 10 oct · $500');
  });

  it('pagar la última cuota también pregunta cuál es y la marca pagada', () => {
    // El wizard solo la preguntaba si quedaba saldo: la última quedaba pendiente con la deuda en 0.
    const ultima = { ...guion, venta_montos: { precio_total: '1500', monto: '500' } };
    const r = recorrer(ultima, contexto);
    expect(saldoVenta(r, contexto)).toBe(0);
    expect(claves(ultima, contexto)).toContain('venta_cuota');
    expect(construirPayload(r, contexto).datos.cuota_cobrada).toEqual({ cuota_id: 42, estado: 'pagado', monto: 500 });
  });
});

describe('venta: a quién se le atribuye', () => {
  const contexto = {
    closers: [{ id: 3, nombre: 'Ana', pista: 'Libre' }, { id: 12, nombre: 'Jean Carlo', pista: '2 llamadas hoy' }],
    closerAgenda: { id: 12, nombre: 'Jean Carlo', email: 'jean@neuro.com' },
  };

  it('se elige de la lista de closers, con el de la agenda primero', () => {
    let r = INICIAL();
    Object.entries({ ...LLAMADA, ...COMPRADOR }).forEach(([clave, valores]) => { r = responder(r, clave, valores); });
    const q = preguntaActual(r, contexto);
    expect(q.clave).toBe('venta_closer');
    expect(q.opciones.map((o) => [o.valor, o.sub])).toEqual([[12, 'Closer de esta agenda'], [3, 'Libre']]);
    r = responder(r, 'venta_closer', { vendedor_id: 3 });
    expect(construirPayload(r, contexto).datos.venta.vendedor_id).toBe(3);
  });

  it('sin lista de closers no se pregunta y la venta queda para el de la agenda', () => {
    let r = INICIAL();
    Object.entries({ ...LLAMADA, ...COMPRADOR }).forEach(([clave, valores]) => { r = responder(r, clave, valores); });
    expect(preguntaActual(r, {}).clave).toBe('programa');
    expect(construirPayload(r, {}).datos.venta.vendedor_id).toBeUndefined();
  });
});

describe('venta: corregir desde la revisión', () => {
  const guion = {
    ...LLAMADA, ...COMPRADOR,
    programa: { programa: 'RR' },
    tipo_pago: { tipo_pago_simple: 'completo' },
    venta_montos: { monto: '2000' },
    medio_pago: { metodo_pago: 'Stripe' },
    ...DATOS_DE_LA_VENTA,
    refs_ask: { refs_ask: 'no_pedido' },
    venta_academia: { dar_acceso_academia: true },
  };

  it('corregir el email vuelve a la revisión sin rehacer los veinte pasos que siguen', () => {
    let r = volverA(recorrer(guion), 'venta_email');
    expect(preguntaActual(r).clave).toBe('venta_email');
    r = actualizar(r, { mail_cliente: 'kevin.bien@mail.com' });
    r = responder(r, 'venta_email', {});
    expect(completo(r)).toBe(true);
    expect(construirPayload(r, {}).datos.acceso_academia.email).toBe('kevin.bien@mail.com');
  });

  it('pasar de completo a parcial pide lo que ese cambio vuelve necesario', () => {
    let r = volverA(recorrer(guion), 'tipo_pago');
    r = responder(r, 'tipo_pago', { tipo_pago_simple: 'parcial' });
    expect(preguntaActual(r).clave).toBe('venta_montos');
    expect(faltantes(r)).toEqual(['Cargá Precio total']);
  });
});

describe('venta: «Anterior»', () => {
  const guion = {
    ...LLAMADA, ...COMPRADOR,
    programa: { programa: 'RR' },
    tipo_pago: { tipo_pago_simple: 'parcial' },
    venta_montos: { precio_total: '3000', monto: '1000' },
    medio_pago: { metodo_pago: 'Stripe' },
    venta_num_cuotas: { num_cuotas: 2 },
    venta_modo_cuotas: { installmentMode: 'custom' },
    venta_fechas_cuotas: { cuotaFechas: { 1: '2026-10-25', 2: '2026-11-25' } },
    ...DATOS_DE_LA_VENTA,
    refs_ask: { refs_ask: 'no_pedido' },
    venta_academia: { dar_acceso_academia: true },
  };
  const igual = (r) => {
    const q = preguntaActual(r);
    return responder(r, q.clave, q.tipo === 'formulario' ? {} : { [q.campo]: elegida(r, q.campo) });
  };

  it('se puede volver pregunta por pregunta hasta el principio y rehacerlo igual', () => {
    const lleno = recorrer(guion);
    const pasos = progresoVenta(lleno).total;
    let r = lleno;
    for (let i = 0; i < pasos; i += 1) r = anterior(r);
    expect(preguntaActual(r).clave).toBe('venta_nombre');
    expect(r.nombre_cliente).toBe('Kevin Álvarez');
    for (let i = 0; i < pasos; i += 1) r = igual(r);
    expect(completo(r)).toBe(true);
    expect(construirPayload(r, {})).toEqual(construirPayload(lleno, {}));
  });

  it('volver al tipo de pago y cambiarlo deja de pedir el cronograma', () => {
    let r = recorrer(guion);
    while (preguntaActual(r)?.clave !== 'tipo_pago') r = anterior(r);
    expect(elegida(r, 'tipo_pago_simple')).toBe('parcial');
    r = responder(r, 'tipo_pago', { tipo_pago_simple: 'completo' });
    expect(claves({ ...guion, tipo_pago: { tipo_pago_simple: 'completo' }, venta_montos: { monto: '3000' } }))
      .not.toContain('venta_num_cuotas');
    expect(preguntaActual(r).clave).toBe('venta_montos');
  });
});

describe('venta directa: la que no sale de reportar esta llamada', () => {
  // Una renovación, un upsell, la cuota de un plan o una venta cerrada por WhatsApp. Era
  // «Registrar venta / pago» del historial del cliente, que abría el wizard en otro modal.
  const renovacion = {
    ...COMPRADOR,
    programa: { programa: 'RR' },
    tipo_pago: { tipo_pago_simple: 'Renovacion' },
    venta_montos: { precio_total: '1500', monto: '1500' },
    medio_pago: { metodo_pago: 'Stripe' },
    ...DATOS_DE_LA_VENTA,
    venta_fecha: { date: '2026-09-25', sold_in_call: false },
    refs_ask: { refs_ask: 'no_pedido' },
    venta_academia: { dar_acceso_academia: true },
  };

  it('entra derecho a los datos del comprador, sin las preguntas de la llamada', () => {
    const r = ventaDirecta(INICIAL());
    expect(arrancado(r)).toBe(true);
    expect(esVenta(r)).toBe(true);
    expect(preguntaActual(r).clave).toBe('venta_nombre');
    expect(progresoVenta(r)).toEqual({ paso: 1, total: 15, listo: false });
  });

  it('recorre el mismo wizard que la venta de la llamada, con referidos y Academia', () => {
    let r = ventaDirecta(INICIAL());
    const vistas = [];
    for (let i = 0; i < 30 && preguntaActual(r); i += 1) {
      const q = preguntaActual(r);
      vistas.push(q.clave);
      r = responder(r, q.clave, renovacion[q.clave]);
    }
    expect(vistas).toEqual([
      'venta_nombre', 'venta_instagram', 'venta_email', 'venta_telefono', 'venta_documento',
      'programa', 'tipo_pago', 'venta_montos', 'medio_pago',
      'venta_examen', 'venta_fecha', 'venta_estado', 'venta_notas', 'refs_ask', 'venta_academia',
    ]);
    expect(completo(r)).toBe(true);
  });

  it('se registra como venta, sin tocar el decisor ni la oferta de la agenda', () => {
    let r = ventaDirecta(INICIAL());
    for (let i = 0; i < 30 && preguntaActual(r); i += 1) {
      r = responder(r, preguntaActual(r).clave, renovacion[preguntaActual(r).clave]);
    }
    const { accion, datos } = construirPayload(r, { appointmentId: 88 });
    expect(accion).toBe('registrar_venta');
    expect(datos.venta).toMatchObject({ tipo_pago: 'RR - Renovacion', monto: 1500, sold_in_call: false });
    // `null` es «no se preguntó»: el backend no pisa lo que la agenda ya tenía.
    expect(datos.agenda).toEqual({ with_decision_maker: null, offer_presented: null });
    expect(datos.deck).toBeNull();
    expect(datos.acceso_academia).toMatchObject({ programa_code: 'RR', tipo_venta: 'renovacion' });
  });

  it('el stepper dice que es una venta directa, cerrada, y la renovación en el upsell', () => {
    let r = ventaDirecta(INICIAL());
    r = responder(r, 'venta_nombre', {});
    const h = hitos(r);
    expect(h[1]).toMatchObject({ sub: 'Venta directa', estado: 'hecho' });
    expect(h[2]).toMatchObject({ sub: 'Venta cerrada', estado: 'hecho' });
    const completa = responder(responder(r, 'programa', { programa: 'RR' }), 'tipo_pago', { tipo_pago_simple: 'Renovacion' });
    expect(hitos(completa)[4]).toMatchObject({ sub: 'Renovación', estado: 'hecho' });
  });

  it('también desde una ficha en cadencia de seguimiento, sin pasar por «¿qué pasó con el contacto?»', () => {
    const ctx = { modo: 'seguimiento', intento: 2 };
    expect(preguntaActual(ventaDirecta(INICIAL()), ctx).clave).toBe('venta_nombre');
  });

  it('«Anterior» desde la primera pregunta vuelve a las cuatro tarjetas de la llamada', () => {
    const r = anterior(ventaDirecta(INICIAL()));
    expect(arrancado(r)).toBe(false);
    expect(r.venta_directa).toBeUndefined();
    const ctx = { modo: 'seguimiento', intento: 2 };
    expect(preguntaActual(anterior(ventaDirecta(INICIAL()), ctx), ctx).clave).toBe('contacto_result');
  });
});
