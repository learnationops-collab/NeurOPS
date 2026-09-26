// Fichas y payloads de ejemplo de las pestañas «Resultado» y «Acciones».
//
// Sirven para dos cosas: fijar en los tests la forma del JSON que se espera del endpoint
// `/api/ficha/lead` (§11 de la especificación) y documentar, con un caso concreto, qué sale de
// `onAccion` en cada camino. Si el backend cambia una clave, esto se rompe acá y no en producción.

export const fichaAgendaVencida = {
  identidad: {
    client_id: 401,
    appointment_id: 9001,
    nombre: 'Kevin Álvarez',
    email: 'kevin@mail.com',
    telefono: '+54 9 11 5555 7777',
    instagram: '@kevinalvarez',
    examen: 'USMLE Step 1',
    programa: null,
    grupo: 'grupo 2',
    ingreso: null,
    llamada: { iso: '2026-09-25T21:00:00Z', fecha: '25 sep 2026', hora: '18:00' },
    fuente: 'Elias',
    closer: { id: 12, nombre: 'Jean Carlo', email: 'jean@neurocogniciones.com' },
    setter: { id: 7, nombre: 'Elías' },
  },
  estado: {
    clave: 'agenda_vencida_sin_reportar',
    etiqueta: 'Sin reportar',
    tono: 'warning',
    pestanas: ['conf', 'resultado', 'acciones', 'hist', 'form', 'com'],
    pestana_por_defecto: 'resultado',
  },
  resultado: {
    pre_call: { key: 'confirmado', label: 'Confirmado', tone: 'success' },
    post_call: { key: 'pendiente', label: 'Pendiente', tone: 'idle' },
    con_decisor: null,
    oferta_presentada: null,
    reportada: false,
    seguimiento_activo: false,
    seguimiento_intento: 1,
    seguimiento_tipo: null,
    venta: null,
    hitos: [],
  },
  cobro: {
    deuda: 0, pagado: 0, ultimo_pago: null, programa_code: null, programa_nombre: null,
    proxima_cuota: null, etapa: null, cuotas: [], pagos: [],
    estado_pagos: { total_paid: 0, balance_remaining: 0, sales_count: 0 },
  },
  permisos: { confirmar: true, reportar: true, cobrar: true, eliminar: false, reasignar: true, comentar: true },
  vocabulario: { medios_pago: [], canales_seguimiento: [], motivos_baja: [] },
};

// El mismo lead después de una venta parcial: queda deuda y el trabajo pasa a «Acciones».
export const fichaConDeuda = {
  ...fichaAgendaVencida,
  estado: { ...fichaAgendaVencida.estado, clave: 'venta_con_deuda', pestana_por_defecto: 'acciones' },
  resultado: {
    ...fichaAgendaVencida.resultado,
    post_call: { key: 'show_up', label: 'Show up', tone: 'success' },
    con_decisor: true,
    oferta_presentada: true,
    reportada: true,
    venta: { id: 5501, programa: 'AL', tipo_pago: 'AL - parcial', monto: 500, metodo: 'Stripe', fecha: '2026-09-25', estado: 'Completada' },
  },
  cobro: {
    deuda: 1500,
    pagado: 500,
    ultimo_pago: '25 sep',
    programa_code: 'AL',
    programa_nombre: 'Ace Learner',
    proxima_cuota: { numero_cuota: 1, monto: 500, fecha_vencimiento: '2026-10-25', estado: 'pendiente' },
    etapa: { clave: 'cuota_proxima', titulo: 'Cuota por vencer', tono: 'warning' },
    cuotas: [
      { id: 71, numero_cuota: 1, monto: 500, fecha_vencimiento: '2026-10-25', estado: 'pendiente', programa_code: 'AL' },
      { id: 72, numero_cuota: 2, monto: 500, fecha_vencimiento: '2026-11-25', estado: 'pendiente', programa_code: 'AL' },
      { id: 73, numero_cuota: 3, monto: 500, fecha_vencimiento: '2026-12-25', estado: 'pendiente', programa_code: 'AL' },
    ],
    pagos: [{ fecha: '2026-09-25', medio: 'Stripe', monto: 500, tipo: 'first_payment' }],
    estado_pagos: { total_paid: 500, balance_remaining: 1500, sales_count: 1 },
  },
};

// Lead en la cadencia de seguimiento: el árbol arranca por «¿qué pasó con este contacto?».
export const fichaEnSeguimiento = {
  ...fichaAgendaVencida,
  estado: { ...fichaAgendaVencida.estado, clave: 'en_seguimiento' },
  resultado: {
    ...fichaAgendaVencida.resultado,
    post_call: { key: 'no_show', label: 'No Show', tone: 'error' },
    reportada: true,
    seguimiento_activo: true,
    seguimiento_intento: 2,
    seguimiento_tipo: 'no_tomada',
  },
};

// Respuestas del árbol que producen una venta parcial con plan de cuotas (el caso más completo).
export const respuestasVentaParcial = {
  _pasos: ['venta_cliente', 'venta_montos', 'venta_cuotas', 'venta_meta', 'venta_extras', 'referidos'],
  res: 'asistio',
  with_decision_maker: true,
  offer_presented: true,
  cierre: true,
  deuda: true,
  up: 'none',
  programa: 'AL',
  tipo_pago_simple: 'parcial',
  nombre_cliente: 'Kevin Álvarez',
  instagram: '@kevinalvarez',
  mail_cliente: 'kevin@mail.com',
  telefono: '+54 9 11 5555 7777',
  documento_identidad: '30111222',
  email_vendedor: 'jean@neurocogniciones.com',
  setter: 'Elías',
  precio_total: '2000',
  monto: '500',
  segundo_pago: 'resto en 3 cuotas',
  metodo_pago: 'Stripe',
  num_cuotas: 3,
  installmentMode: 'monthly',
  dia_de_pago: 25,
  cuotaFechas: { 1: '2026-10-25', 2: '2026-11-25', 3: '2026-12-25' },
  cuotaMontos: {},
  examen_lead: 'USMLE Step 1',
  date: '2026-09-25',
  sold_in_call: true,
  estado: 'Completada',
  notas: 'quedó con dudas de tiempo, las trabajamos en la llamada',
  fecha_cobro: '2026-10-20',
  enviar_webhook: true,
  dar_acceso_academia: true,
  refs_ask: 'si',
  refs_rows: [{ nombre: 'Ana', contacto: '@anamed' }],
};

// Respuestas del árbol para un no show que se manda a seguimiento (el caso más frecuente).
export const respuestasNoShowSeguimiento = {
  _pasos: ['noshow_detalle', 'seguimiento'],
  res: 'no_asistio',
  noshow_motivo: 'No contestó el mensaje',
  noshow_next: 'seguimiento',
  notes: 'le escribí 3 veces, visto sin respuesta',
  fecha_seguimiento: '2026-09-27',
  followup_reminder_enabled: true,
  followup_reminder_time: '09:00',
};
