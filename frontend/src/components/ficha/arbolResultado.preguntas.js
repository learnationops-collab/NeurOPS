// Catálogo de preguntas del árbol de resultado de la llamada.
//
// De dónde sale cada cosa (para poder auditar que no se perdió ningún campo):
//   · El esqueleto de 6 preguntas y los 5 hitos salen del mockup
//     «Ficha Cliente confirmacion.dc.html» (bloque `agQ`/`agOpts`/`agSteps`).
//   · Las ramas y los campos salen del flujo que HOY vive en
//     `pages/closer/CloserWorkflowPage.jsx` → `renderActionStepContent()`
//     (pasos root/decisor/pres/venta/nocierre/nopres/second/noshow/cancel/
//     reagQ/reagSi/follow/seg + el overlay de referidos) y de
//     `components/modals/DeclararVentaWizard.jsx` (los pasos de la venta).
// Cada pregunta lleva anotado su origen en un comentario `← …`.
//
// Este archivo es SOLO datos: la lógica de recorrido vive en `arbolResultado.js`.

// ← CloserWorkflowPage `root` (2562-2576) + mockup `agAcciones`.
export const RAICES = [
  { valor: 'asistio', label: 'Asistió', sub: 'Se conectó a la llamada', tono: 'success' },
  { valor: 'no_asistio', label: 'No asistió', sub: 'No se presentó', tono: 'error' },
  { valor: 'cancelo', label: 'Canceló', sub: 'Avisó que no venía', tono: 'warning' },
  { valor: 'reagenda', label: 'Reagenda', sub: 'Pidió nueva fecha', tono: 'info' },
];

// ← los 6 motivos fijos del paso `noshow` (2798).
export const MOTIVOS_NO_SHOW = [
  'No contestó el mensaje', 'Bloqueó / desapareció', 'Se arrepintió',
  'Problema técnico / horario', 'Confundió la fecha', 'Otro motivo',
];
// ← los 4 motivos fijos del paso `cancel` (2856).
export const MOTIVOS_CANCELACION = [
  'Sin tiempo / imprevisto', 'Ya no le interesa', 'Problema económico', 'No dio motivo',
];
// ← los 4 motivos fijos del paso `reagQ` (2915).
export const MOTIVOS_REAGENDA = [
  'Imprevisto del lead', 'Sin tiempo suficiente', 'Pidió otro horario', 'No dio motivo',
];
// ← los 4 motivos de cierre del paso `seg` (3237).
export const MOTIVOS_CIERRE_SEGUIMIENTO = [
  'Pidió que no lo contacten', 'Se agotaron los 4 intentos', 'Compró en otro lado', 'Ya no califica',
];

// ← DeclararVentaWizard `PROGRAMS` (49-53), `METHODS` (54), `PAYMENT_TYPES` (57-64).
export const PROGRAMAS = [
  { valor: 'RR', label: 'Residency Roadmap' },
  { valor: 'AL', label: 'Ace Learner' },
  { valor: 'SI', label: 'Specialist Initiative' },
];
export const MEDIOS_PAGO = ['Stripe', 'PayPal', 'Transferencia Bancaria', 'Binance / USDT', 'Hotmart', 'Otro'];
export const TIPOS_PAGO = [
  { valor: 'completo', label: 'Completo (PIF)', sub: 'paga todo hoy', conDeuda: false },
  { valor: 'parcial', label: 'Parcial (primer pago)', sub: 'arranca un plan de cuotas', conDeuda: true },
  { valor: 'Seña', label: 'Seña', sub: 'promesa de pago, sin cronograma todavía', conDeuda: true },
  { valor: 'Cuota', label: 'Cuota', sub: 'cobra una cuota del plan ya armado', conDeuda: true },
  { valor: 'Renovacion', label: 'Renovación', sub: 'ya fue alumno, compra de nuevo', up: 'Renovación' },
  { valor: 'Upsell', label: 'Upsell', sub: 'suma otro programa/mejora', up: 'Upsell' },
];
export const ESTADOS_VENTA = [
  { valor: 'Completada', label: 'Completada', sub: 'todo en orden', tono: 'success' },
  { valor: 'Pendiente', label: 'Pendiente', sub: 'falta algo para cerrarla', tono: 'warning' },
  { valor: 'Cancelada', label: 'Cancelada', sub: 'no va a concretarse', tono: 'error' },
];
// ← paso `seg`: modalidad (3179) y resultado del contacto (3165-3168).
export const MODALIDADES = ['Mensaje', 'Llamada'];
export const RESULTADOS_CONTACTO = [
  { valor: 'no_resp', label: 'No respondió', sub: 'Lo hice, no contestó', tono: 'error' },
  { valor: 'contesto', label: 'Contestó', sub: 'Estamos conversando', tono: 'info' },
  { valor: 'agendo', label: 'Contestó y agendó', sub: 'Vuelve al meet', tono: 'success' },
  { valor: 'cerro', label: 'Cerró la venta', sub: 'Registrar pago', tono: 'success' },
];

const si = { valor: true, label: 'Sí', tono: 'success' };
const no = { valor: false, label: 'No', tono: 'error' };
const texto = (campo, label, extra = {}) => ({ campo, label, tipo: 'texto', ...extra });
const opts = (lista, tono) => lista.map((l) => ({ valor: l, label: l, tono }));

// Destinos comunes: varias ramas terminan en el mismo formulario.
const vaASeguimiento = (r) => [r.nocierre_next, r.nopres_next, r.noshow_next, r.cancel_next]
  .includes('seguimiento') || r.reag_dejo_fecha === false || r.sig_action === 'next';
const vaADescartar = (r) => ['perdido', 'descartar', 'no_lead']
  .some((v) => [r.nocierre_next, r.nopres_next, r.noshow_next, r.cancel_next].includes(v));
const esVenta = (r) => r.cierre === true || r.contacto_result === 'cerro';
// Hubo contacto humano real → corresponde preguntar por referidos (misma regla que hoy:
// `needsRefs` en 3148, y el paso `referralAsked` del wizard de venta).
const huboContacto = (r) => r.res === 'asistio' || ['contesto', 'agendo', 'cerro'].includes(r.contacto_result);

const enLlamada = (r, c) => c.modo !== 'seguimiento';
const enSeguimiento = (r, c) => c.modo === 'seguimiento';

export const PREGUNTAS = [
  // ---------- tronco de la llamada ----------
  { // ← root (2562)
    clave: 'res', hito: 'resultado', campo: 'res', tipo: 'opciones', destacada: true,
    enunciado: '¿Qué pasó con esta llamada?', opciones: RAICES, cuando: enLlamada,
  },
  { // ← seg (3120): ¿Qué pasó con este contacto?
    clave: 'contacto_result', hito: 'resultado', campo: 'contacto_result', tipo: 'opciones',
    enunciado: '¿Qué pasó con este contacto?', opciones: RESULTADOS_CONTACTO, cuando: enSeguimiento,
  },
  { // ← seg: modalidad (≥1) + notas (≥10) + nueva fecha si agendó
    clave: 'contacto_detalle', hito: 'resultado', tipo: 'formulario', enunciado: '¿Cómo fue el contacto?',
    campos: (r) => [
      { campo: 'modalidad', label: 'Modalidad', tipo: 'multiple', opciones: MODALIDADES, requerido: true },
      { campo: 'notes', label: 'Qué le dijiste y qué respondió', tipo: 'parrafo', requerido: true, minimoTexto: 10 },
      ...(r.contacto_result === 'agendo' ? [
        { campo: 'nueva_fecha_agenda', label: 'Nueva fecha', tipo: 'fecha', requerido: true },
        { campo: 'nueva_hora_agenda', label: 'Nueva hora', tipo: 'hora', requerido: true },
      ] : []),
    ],
    cuando: enSeguimiento,
  },
  { // ← decisor (2579): with_decision_maker
    clave: 'decisor', hito: 'resultado', campo: 'with_decision_maker', tipo: 'opciones',
    enunciado: '¿Estuvo el decisor?',
    opciones: [{ ...si, label: 'Sí, con decisor' }, { ...no, label: 'No, sin decisor' }],
    cuando: (r, c) => enLlamada(r, c) && r.res === 'asistio',
  },
  { // ← pres (2600): offer_presented
    clave: 'oferta', hito: 'cierre', campo: 'offer_presented', tipo: 'opciones',
    enunciado: '¿Se presentó la oferta?', opciones: [{ ...si, label: 'Sí, se presentó' }, { ...no, label: 'No se presentó' }],
    cuando: (r, c) => enLlamada(r, c) && r.res === 'asistio',
  },
  { // ← venta (2621)
    clave: 'cierre', hito: 'cierre', campo: 'cierre', tipo: 'opciones',
    enunciado: '¿Se cerró la venta?',
    opciones: [{ ...si, label: 'Sí, cerró', sub: 'Registrar el pago' }, { ...no, label: 'No cerró' }],
    cuando: (r) => r.offer_presented === true,
  },

  // ---------- rama venta ----------
  { // ← mockup `¿Cómo pagó?`; define si queda saldo (hito «Deuda»)
    clave: 'deuda', hito: 'deuda', campo: 'deuda', tipo: 'opciones', enunciado: '¿Cómo pagó?',
    opciones: [
      { valor: false, label: 'Pago completo', sub: 'No queda saldo', tono: 'success' },
      { valor: true, label: 'Queda deuda', sub: 'Hay saldo por cobrar', tono: 'warning' },
    ],
    cuando: esVenta,
  },
  { // ← mockup `¿Hay renovación o upsell?` — en el modelo real es el tipo_pago de la venta
    clave: 'up', hito: 'upsell', campo: 'up', tipo: 'opciones', enunciado: '¿Hay renovación o upsell?',
    opciones: [
      { valor: 'Renovación', label: 'Renovación', sub: 'Ya fue alumno', tono: 'success' },
      { valor: 'Upsell', label: 'Upsell', sub: 'Suma otro programa', tono: 'info' },
      { valor: 'none', label: 'Ninguno', sub: 'Venta nueva', tono: 'idle' },
    ],
    cuando: esVenta,
  },
  { // ← wizard `program`
    clave: 'programa', hito: 'cierre', campo: 'programa', tipo: 'opciones', enunciado: '¿Qué programa compró?',
    opciones: PROGRAMAS.map((p) => ({ ...p, tono: 'info' })), cuando: esVenta,
  },
  { // ← wizard `paymentType`. Se acotan las opciones con lo ya contestado, pero el vocabulario
    // completo de 6 tipos se conserva: sin deuda igual puede ser Renovación o Upsell.
    clave: 'tipo_pago', hito: 'cierre', campo: 'tipo_pago_simple', tipo: 'opciones',
    enunciado: '¿Qué tipo de pago es?',
    opciones: (r) => TIPOS_PAGO.filter((t) => {
      if (r.up === 'Renovación') return t.valor === 'Renovacion';
      if (r.up === 'Upsell') return t.valor === 'Upsell';
      return t.conDeuda === undefined ? false : t.conDeuda === !!r.deuda;
    }).map((t) => ({ ...t, tono: 'info' })),
    cuando: esVenta,
  },
  { // ← wizard name/instagram/email/phone/document/closer + el `setter` de buildSalePayload
    clave: 'venta_cliente', hito: 'cierre', tipo: 'formulario', enunciado: '¿A quién le vendiste?',
    ayuda: 'Lo que ya sabemos viene precargado de la agenda.',
    campos: [
      texto('nombre_cliente', 'Nombre', { requerido: true }),
      texto('instagram', 'Instagram', { requerido: true, prefijo: '@' }),
      texto('mail_cliente', 'Email', { requerido: true, tipo: 'email' }),
      texto('telefono', 'Teléfono', { tipo: 'tel' }),
      texto('documento_identidad', 'Documento de identidad'),
      texto('email_vendedor', 'Closer que vendió (email)', { requerido: true, tipo: 'email' }),
      texto('setter', 'Setter'),
    ],
    cuando: esVenta,
  },
  { // ← wizard `amounts`: precio_total + monto + segundo_pago (comentario que viaja a Sheets)
    clave: 'venta_montos', hito: 'deuda', tipo: 'formulario', enunciado: '¿Cuánta plata entró?',
    campos: (r) => [
      ...(r.tipo_pago_simple === 'completo' ? [] : [{ campo: 'precio_total', label: 'Precio total del programa', tipo: 'monto', requerido: true }]),
      { campo: 'monto', label: 'Cobrado hoy', tipo: 'monto', requerido: true, minimo: 0.01 },
      texto('segundo_pago', 'Comentario / segundo pago'),
    ],
    cuando: esVenta,
  },
  { // ← wizard `method`
    clave: 'medio_pago', hito: 'deuda', campo: 'metodo_pago', tipo: 'opciones',
    enunciado: '¿Por dónde entró la plata?', opciones: opts(MEDIOS_PAGO, 'info'), cuando: esVenta,
  },
  { // ← wizard pickCuota | installmentCount + installmentMode + installmentDay/Dates + cuotaMontos
    clave: 'venta_cuotas', hito: 'deuda', tipo: 'formulario', enunciado: '¿Cómo queda el saldo?',
    ayuda: 'La última cuota absorbe la diferencia para que la suma cierre exacto.',
    campos: [
      { campo: 'selectedCuotaId', label: 'Cuota del plan que se está cobrando', tipo: 'cuota' },
      { campo: 'num_cuotas', label: 'Cantidad de cuotas', tipo: 'entero', minimo: 1 },
      { campo: 'installmentMode', label: 'Fechas', tipo: 'opcion', opciones: ['monthly', 'custom'] },
      { campo: 'dia_de_pago', label: 'Día de pago mensual', tipo: 'entero' },
      { campo: 'cuotaFechas', label: 'Fechas por cuota', tipo: 'mapa' },
      { campo: 'cuotaMontos', label: 'Montos por cuota', tipo: 'mapa' },
    ],
    cuando: (r) => esVenta(r) && r.deuda === true && r.tipo_pago_simple !== 'completo',
  },
  { // ← wizard exam/saleMeta/estado/notas + el `fecha_cobro` que hoy guarda handleRegisterSale
    clave: 'venta_meta', hito: 'cierre', tipo: 'formulario', enunciado: 'Datos de la venta',
    campos: [
      texto('examen_lead', 'Examen que rinde'),
      { campo: 'date', label: 'Fecha de la venta', tipo: 'fecha', requerido: true },
      { campo: 'sold_in_call', label: '¿Cerró en la llamada?', tipo: 'booleano' },
      { campo: 'estado', label: 'Estado de la venta', tipo: 'opcion', opciones: ESTADOS_VENTA.map((e) => e.valor) },
      { campo: 'notas', label: 'Notas u observaciones', tipo: 'parrafo' },
      { campo: 'fecha_cobro', label: 'Próximo seguimiento de cobro', tipo: 'fecha' },
    ],
    cuando: esVenta,
  },
  { // ← wizard `review`: los tres checkboxes de la pantalla de revisión
    clave: 'venta_extras', hito: 'cierre', tipo: 'formulario', enunciado: 'Antes de registrar',
    campos: [
      { campo: 'enviar_webhook', label: 'Avisar por la automatización (n8n)', tipo: 'booleano' },
      { campo: 'dar_acceso_academia', label: 'Dar acceso a la Academia con este email', tipo: 'booleano' },
      { campo: 'settleBalanceWithSale', label: 'Liquidar el saldo anterior con esta venta', tipo: 'booleano' },
    ],
    cuando: esVenta,
  },

  // ---------- ramas sin venta ----------
  { // ← nocierre (2663)
    clave: 'nocierre_next', hito: 'cierre', campo: 'nocierre_next', tipo: 'opciones',
    enunciado: 'Se presentó la oferta pero no se cerró. ¿Siguiente acción?',
    opciones: [
      { valor: 'seguimiento', label: 'Programar seguimiento', tono: 'success' },
      { valor: 'perdido', label: 'Lead perdido / descartado', sub: 'Descartar prospecto', tono: 'error' },
    ],
    cuando: (r) => r.cierre === false,
  },
  { // ← nopres (2694)
    clave: 'nopres_next', hito: 'cierre', campo: 'nopres_next', tipo: 'opciones',
    enunciado: 'No se le presentó la oferta. ¿Siguiente paso?',
    opciones: [
      { valor: 'segunda', label: 'Agendar 2ª llamada', sub: 'Enviar a confirmación', tono: 'info' },
      { valor: 'seguimiento', label: 'Seguimiento', sub: 'Agendar más tarde', tono: 'success' },
      { valor: 'descartar', label: 'Descartar lead', sub: 'No califica', tono: 'error' },
    ],
    cuando: (r) => r.offer_presented === false,
  },
  { // ← second (2725): PATCH start_time + deck(por_confirmar)
    clave: 'segunda_llamada', hito: 'resultado', tipo: 'formulario', enunciado: 'Agendar la 2ª llamada',
    campos: [
      { campo: 'nueva_fecha_agenda', label: 'Nueva fecha', tipo: 'fecha', requerido: true },
      { campo: 'nueva_hora_agenda', label: 'Nueva hora', tipo: 'hora' },
      { campo: 'notes', label: 'Qué falta cubrir / Notas', tipo: 'parrafo' },
    ],
    cuando: (r) => r.nopres_next === 'segunda',
  },

  // ---------- rama no asistió ----------
  { // ← noshow (2797)
    clave: 'noshow_motivo', hito: 'resultado', campo: 'noshow_motivo', tipo: 'opciones',
    enunciado: '¿Por qué no se presentó?', opciones: opts(MOTIVOS_NO_SHOW, 'error'),
    cuando: (r, c) => enLlamada(r, c) && r.res === 'no_asistio',
  },
  {
    clave: 'noshow_detalle', hito: 'resultado', tipo: 'formulario', enunciado: '¿Qué pasó exactamente?',
    campos: [{ campo: 'notes', label: 'Qué pasó exactamente', tipo: 'parrafo' }],
    cuando: (r, c) => enLlamada(r, c) && r.res === 'no_asistio',
  },
  {
    clave: 'noshow_next', hito: 'resultado', campo: 'noshow_next', tipo: 'opciones',
    enunciado: '¿Siguiente paso operativo?',
    opciones: [
      { valor: 'seguimiento', label: 'Programar seguimiento', sub: 'Continuar contacto', tono: 'success' },
      { valor: 'descartar', label: 'Descartar lead', sub: 'Dar por perdido', tono: 'error' },
    ],
    cuando: (r, c) => enLlamada(r, c) && r.res === 'no_asistio',
  },

  // ---------- rama canceló ----------
  { // ← cancel (2855)
    clave: 'cancel_motivo', hito: 'resultado', campo: 'cancel_motivo', tipo: 'opciones',
    enunciado: '¿Cuál fue el motivo de la cancelación?', opciones: opts(MOTIVOS_CANCELACION, 'warning'),
    cuando: (r, c) => enLlamada(r, c) && r.res === 'cancelo',
  },
  {
    clave: 'cancel_detalle', hito: 'resultado', tipo: 'formulario', enunciado: 'Comentario del closer',
    campos: [{ campo: 'notes', label: 'Detalle de lo que dijo', tipo: 'parrafo' }],
    cuando: (r, c) => enLlamada(r, c) && r.res === 'cancelo',
  },
  {
    clave: 'cancel_next', hito: 'resultado', campo: 'cancel_next', tipo: 'opciones',
    enunciado: '¿Siguiente paso operativo?',
    opciones: [
      { valor: 'reagendar', label: 'Reagendar ahora', sub: 'Cambiar la cita', tono: 'info' },
      { valor: 'seguimiento', label: 'Seguimiento', sub: 'Programar contacto', tono: 'success' },
      { valor: 'no_lead', label: 'Marcar No Lead', sub: 'No califica', tono: 'error' },
    ],
    cuando: (r, c) => enLlamada(r, c) && r.res === 'cancelo',
  },

  // ---------- rama reagenda ----------
  { // ← reagQ (2914)
    clave: 'reag_motivo', hito: 'resultado', campo: 'reag_motivo', tipo: 'opciones',
    enunciado: '¿Por qué se reagenda?', opciones: opts(MOTIVOS_REAGENDA, 'info'),
    cuando: (r, c) => (enLlamada(r, c) && r.res === 'reagenda') || r.cancel_next === 'reagendar',
  },
  {
    clave: 'reag_dejo_fecha', hito: 'resultado', campo: 'reag_dejo_fecha', tipo: 'opciones',
    enunciado: '¿Dejó una fecha nueva?',
    ayuda: 'Si no dio fecha no es reagenda: se programa un seguimiento.',
    opciones: [
      { ...si, label: 'Sí, dejó fecha', sub: 'Vuelve a confirmaciones' },
      { ...no, label: 'No dejó fecha', sub: 'Mandar a seguimiento' },
    ],
    cuando: (r, c) => (enLlamada(r, c) && r.res === 'reagenda') || r.cancel_next === 'reagendar',
  },
  { // ← reagSi (2951): fecha Y hora obligatorias
    clave: 'reag_fecha', hito: 'resultado', tipo: 'formulario', enunciado: '¿Para cuándo queda?',
    campos: [
      { campo: 'nueva_fecha_agenda', label: 'Nueva fecha', tipo: 'fecha', requerido: true },
      { campo: 'nueva_hora_agenda', label: 'Nueva hora', tipo: 'hora', requerido: true },
    ],
    cuando: (r) => r.reag_dejo_fecha === true,
  },

  // ---------- cadencia de seguimiento (modo 'seguimiento') ----------
  { // ← seg: ¿Y ahora qué hacemos? (solo si no agendó ni cerró)
    clave: 'sig_action', hito: 'resultado', campo: 'sig_action', tipo: 'opciones',
    enunciado: '¿Y ahora qué hacemos?',
    opciones: (r, c) => {
      const intento = c.intento || 1;
      const dias = [0, 3, 7, 14][Math.min(3, intento)];
      return [
        { valor: 'next', label: `Programar seguimiento ${Math.min(4, intento + 1)}`, sub: `Sugerido para +${dias} días`, tono: 'success' },
        { valor: 'close', label: 'Cerrar seguimiento', sub: 'Lead frío o agotado', tono: 'error' },
      ];
    },
    cuando: (r, c) => enSeguimiento(r, c) && !!r.contacto_result
      && !['agendo', 'cerro'].includes(r.contacto_result),
  },
  {
    clave: 'cierre_motivo', hito: 'resultado', campo: 'cierre_motivo', tipo: 'opciones',
    enunciado: '¿Por qué se cierra el seguimiento?', opciones: opts(MOTIVOS_CIERRE_SEGUIMIENTO, 'error'),
    cuando: (r) => r.sig_action === 'close',
  },

  // ---------- destinos comunes ----------
  { // ← follow (3015): fecha con presets + aviso de WhatsApp + ángulo del seguimiento
    clave: 'seguimiento', hito: 'resultado', tipo: 'formulario', enunciado: '¿Cuándo lo vas a seguir?',
    ayuda: 'Sin fecha va al pool del equipo.',
    campos: [
      { campo: 'fecha_seguimiento', label: 'Fecha del próximo contacto', tipo: 'fecha', presets: ['hoy', 'manana', 'sin_fecha'] },
      { campo: 'followup_reminder_enabled', label: 'Avisarme por WhatsApp', tipo: 'booleano' },
      { campo: 'followup_reminder_time', label: 'Hora del aviso', tipo: 'hora' },
      { campo: 'notes', label: 'Ángulo del seguimiento / Notas', tipo: 'parrafo' },
    ],
    cuando: vaASeguimiento,
  },
  { // ← reasonModal de lost_after_pres / lost_no_pres / lost_no_show / no_lead: motivo OBLIGATORIO
    clave: 'descarte', hito: 'resultado', tipo: 'formulario', enunciado: '¿Por qué se descarta?',
    ayuda: 'El motivo queda en la bitácora del lead.',
    campos: [{ campo: 'motivo_descarte', label: 'Motivo', tipo: 'parrafo', requerido: true, minimoTexto: 3 }],
    cuando: vaADescartar,
  },
  { // ← overlay de referidos (2276-2348) + pasos referral* del wizard de venta
    clave: 'referidos', hito: 'upsell', tipo: 'formulario', enunciado: '¿Le pediste referidos?',
    ayuda: 'Con nombre y contacto entran directo a Confirmaciones.',
    campos: [
      {
        campo: 'refs_ask', label: '¿Le pediste referidos?', tipo: 'opcion', requerido: true,
        opciones: ['si', 'no', 'no_pedido'],
        etiquetas: { si: 'Sí, dejó referidos', no: 'Se lo pedí, no dejó', no_pedido: 'No se lo pedí' },
      },
      { campo: 'refs_rows', label: 'Referidos', tipo: 'filas', columnas: ['nombre', 'contacto'] },
    ],
    validar: (r) => (r.refs_ask === 'si' && !(r.refs_rows || []).some((f) => (f.nombre || '').trim())
      ? ['Cargá al menos un referido con nombre'] : []),
    cuando: huboContacto,
  },
];
