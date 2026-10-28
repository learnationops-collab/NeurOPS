// Catálogo de preguntas del árbol de resultado de la llamada.
//
// De dónde sale cada cosa (para poder auditar que no se perdió ningún campo):
//   · El esqueleto de 6 preguntas y los 5 hitos salen del mockup
//     «Ficha Cliente confirmacion.dc.html» (bloque `agQ`/`agOpts`/`agSteps`).
//   · Las ramas y los campos salen del flujo que HOY vive en
//     `pages/closer/CloserWorkflowPage.jsx` → `renderActionStepContent()`
//     (pasos root/decisor/pres/venta/nocierre/nopres/second/noshow/cancel/
//     reagQ/reagSi/follow/seg + el overlay de referidos) y de
//     `components/modals/DeclararVentaWizard.jsx` (los pasos de la venta). Ese wizard se borró
//     cuando la ficha pasó a ser el único lugar donde se declara una venta: está en el
//     historial de git, y las referencias `← wizard …` de abajo apuntan a él.
// Cada pregunta lleva anotado su origen en un comentario `← …`.
//
// Este archivo es SOLO datos: la lógica de recorrido vive en `arbolResultado.js` y la cuenta de la
// venta (saldo, cuotas) en `arbolResultado.venta.js`.

import { moneda } from './acciones/planCuotas';
import {
  esVenta, esNueva, esPago, esCompleto, esRenovacionOUpsell, pagadoAntes, saldoPrevio, saldoVenta, quedaSaldo,
  cuotasPendientes, armaPlan, cantidadCuotas, cronogramaEnTexto, fechaCorta, MAXIMO_CUOTAS,
} from './arbolResultado.venta';
import { PREGUNTA_TRANSFERENCIA, efectoDeTransferido, esTransferencia } from './transferencia';

// Cómo se cuenta en la revisión lo que en crudo no se lee.
const enPlata = (v) => (v === '' || v === undefined || v === null ? null : moneda(v));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  { valor: 'RR', label: 'Residency Roadmap', sub: 'RR' },
  { valor: 'AL', label: 'Ace Learner', sub: 'AL' },
  { valor: 'SI', label: 'Specialist Initiative', sub: 'SI' },
  { valor: 'LT', label: 'Low Ticket', sub: 'LT · 100 USD por mes' },
];
export const MEDIOS_PAGO = ['Stripe', 'PayPal', 'Transferencia Bancaria', 'Binance / USDT', 'Hotmart', 'Otro'];
// `clave` es como los nombra `allowed_types` del backend (todo en minúscula); `valor` es la grafía
// que viaja en `tipo_pago` («RR - Seña»), la misma de siempre.
export const TIPOS_PAGO = [
  { valor: 'completo', clave: 'completo', label: 'Completo (PIF)', sub: 'Paga todo hoy' },
  { valor: 'parcial', clave: 'parcial', label: 'Parcial (primer pago)', sub: 'Arranca un plan de cuotas' },
  { valor: 'Seña', clave: 'seña', label: 'Seña', sub: 'Promesa de pago, sin cronograma todavía' },
  { valor: 'Cuota', clave: 'cuota', label: 'Cuota', sub: 'Cobra una cuota del plan ya armado' },
  { valor: 'Renovacion', clave: 'renovacion', label: 'Renovación', sub: 'Ya fue alumno, compra de nuevo' },
  { valor: 'Upsell', clave: 'upsell', label: 'Upsell', sub: 'Suma otro programa o una mejora' },
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
// ← paso `segventa` (seguimiento de un cliente que ya compró): «¿Qué pasó con el cobro?». Van en
// el mismo campo que el resultado del contacto porque son lo mismo —lo que pasó al contactarlo—
// y el backend lo guarda en el mismo lugar (`contact_result`).
export const RESULTADOS_COBRO = [
  { valor: 'no_resp', label: 'No respondió', sub: 'Lo intenté, no contestó', tono: 'error' },
  { valor: 'contesto', label: 'Estamos conversando', sub: 'Quedamos en seguir hablando', tono: 'info' },
  { valor: 'pago', label: 'Pagó', sub: 'Registrar el cobro', tono: 'success' },
  // Da de baja al cliente (`deck_escritura_service._baja_si_no_va_a_pagar`): se dice ACÁ, antes
  // de elegirla, porque le pone la deuda en 0 y lo saca de todas las listas de cobro.
  { valor: 'no_paga', label: 'No va a pagar', sub: 'Se da de baja: deja de deber', tono: 'error' },
];

// Pedido de Mario (23/10/2026): el motivo por el que no se cerró es obligatorio y va a una base
// para analizarlo (`motivos_no_cierre` en el backend). Por ahora es texto libre: las categorías se
// arman cuando haya suficientes respuestas para saber cuáles son.
export const MOTIVO_MINIMO = 10;

// El mínimo de la objeción de un «No cerró»: el mismo `MINIMO` de `objeciones_service` en el
// backend, que la rechaza si no llega.
export const OBJECION_MINIMA = 10;

const si = { valor: true, label: 'Sí', tono: 'success' };
const no = { valor: false, label: 'No', tono: 'error' };
const texto = (campo, label, extra = {}) => ({ campo, label, tipo: 'texto', ...extra });
const opts = (lista, tono) => lista.map((l) => ({ valor: l, label: l, tono }));

// Destinos comunes: varias ramas terminan en el mismo formulario.
const vaASeguimiento = (r) => [r.nocierre_next, r.nopres_next, r.noshow_next, r.cancel_next]
  .includes('seguimiento') || r.reag_dejo_fecha === false || r.sig_action === 'next';
const vaADescartar = (r) => ['perdido', 'descartar', 'no_lead']
  .some((v) => [r.nocierre_next, r.nopres_next, r.noshow_next, r.cancel_next].includes(v));
// Hubo contacto humano real → corresponde preguntar por referidos (misma regla que hoy:
// `needsRefs` en 3148, y el paso `referralAsked` del wizard de venta).
const huboContacto = (r) => r.res === 'asistio'
  || ['contesto', 'agendo', 'cerro', 'pago'].includes(r.contacto_result) || r.venta_directa === true;

// Los closers a los que se le puede atribuir la venta: los de la ficha, con el de la agenda
// primero (es a quien le toca casi siempre). Si la ficha no trae la lista queda solo el de la
// agenda, y con uno solo la pregunta no se hace.
function closersDeLaVenta(c = {}) {
  const deLaAgenda = c.closerAgenda?.id ? c.closerAgenda : null;
  const lista = (c.closers || []).filter((x) => x && x.id);
  if (deLaAgenda && !lista.some((x) => x.id === deLaAgenda.id)) lista.push(deLaAgenda);
  return lista
    .map((x) => ({
      valor: x.id,
      label: x.nombre || 'Sin nombre',
      sub: deLaAgenda && x.id === deLaAgenda.id ? 'Closer de esta agenda' : (x.pista || null),
      tono: 'info',
    }))
    .sort((a, b) => (b.sub === 'Closer de esta agenda') - (a.sub === 'Closer de esta agenda'));
}

// Por dónde entró la plata y, si fue transferencia, a la cuenta de quién del equipo (Kerwin,
// 09/10/2026: a Pedro y a Jean Carlo se les descuenta en Payroll, a «Otro» no). Lo comparten la
// venta nueva y el pago, y el low ticket del triage.
export function camposDelMedio(r = {}, c = {}) {
  const cuentas = c.transferidoA || [];
  return [
    { campo: 'metodo_pago', label: 'Por dónde entró la plata', tipo: 'opcion', requerido: true, opciones: MEDIOS_PAGO },
    ...(esTransferencia(r.metodo_pago) ? [{
      campo: 'transferido_a', label: PREGUNTA_TRANSFERENCIA, tipo: 'opcion', requerido: true,
      opciones: cuentas.map((o) => o.clave),
      etiquetas: Object.fromEntries(cuentas.map((o) => [o.clave, `${o.label} · ${efectoDeTransferido(o)}`])),
      resumir: (v) => cuentas.find((o) => o.clave === v)?.label || v || null,
    }] : []),
  ];
}

// Tres formas de entrar al árbol: la llamada (las cuatro tarjetas), la cadencia de seguimiento de
// un lead que no compró (`seguimiento`) y el seguimiento de cobro de un cliente (`cobro`). La venta
// directa no reporta ni la llamada ni el contacto: entra derecho a los datos de la venta.
const CADENCIAS = ['seguimiento', 'cobro'];
const enLlamada = (r, c) => !CADENCIAS.includes(c.modo) && r.venta_directa !== true;
const enCadencia = (r, c) => CADENCIAS.includes(c.modo) && r.venta_directa !== true;
const enSeguimiento = (r, c) => c.modo === 'seguimiento' && r.venta_directa !== true;
const enCobro = (r, c) => c.modo === 'cobro' && r.venta_directa !== true;

export const PREGUNTAS = [
  { // Los detalles de una venta o un pago (ADR-W013). Es FIJA: arranca contestada (`estadoInicial`) y
    // se corrige en la revisión, sin ser pantalla. Va primera para que cambiar de rama no la borre.
    clave: 'venta_detalles', hito: 'cierre', tipo: 'formulario', fija: true, enunciado: 'Detalles',
    campos: (r, c) => [
      // Sin piso: una venta de ayer que se reporta hoy tiene que poder fecharse ayer.
      {
        campo: 'date', label: 'Fecha', tipo: 'fecha', requerido: true, sinMinimo: true,
        presets: [{ label: 'Hoy', dias: 0 }, { label: 'Ayer', dias: -1 }],
      },
      {
        campo: 'sold_in_call', label: '¿Cerró en la llamada?', tipo: 'opcion', opciones: [true, false],
        etiquetas: { true: 'Sí, en el Meet', false: 'No, fuera de la llamada' },
      },
      {
        campo: 'estado', label: 'Estado', tipo: 'opcion', opciones: ESTADOS_VENTA.map((e) => e.valor),
        etiquetas: Object.fromEntries(ESTADOS_VENTA.map((e) => [e.valor, e.label])),
      },
      ...(quedaSaldo(r, c) ? [{
        campo: 'fecha_cobro', label: 'Próximo seguimiento de cobro', tipo: 'fecha',
        presets: [{ label: 'En 1 semana', dias: 7 }, { label: 'En 1 mes', meses: 1 }],
      }] : []),
      { campo: 'notas', label: 'Notas', tipo: 'parrafo' },
    ],
    cuando: esVenta,
  },
  // ---------- tronco de la llamada ----------
  { // ← root (2562)
    clave: 'res', hito: 'resultado', campo: 'res', tipo: 'opciones', destacada: true,
    enunciado: '¿Qué pasó con esta llamada?', opciones: RAICES, cuando: enLlamada,
  },
  { // ← seg (3120): ¿Qué pasó con este contacto? · segventa (3405): ¿Qué pasó con el cobro?
    clave: 'contacto_result', hito: 'resultado', campo: 'contacto_result', tipo: 'opciones',
    enunciado: (r, c) => (c.modo === 'cobro' ? '¿Qué pasó con el cobro?' : '¿Qué pasó con este contacto?'),
    ayuda: (r, c) => (c.modo === 'cobro' ? 'Ya compró: el foco es cobrar lo que debe.' : null),
    opciones: (r, c) => (c.modo === 'cobro' ? RESULTADOS_COBRO : RESULTADOS_CONTACTO),
    cuando: enCadencia,
  },
  { // ← seg: modalidad (≥1) + notas (≥10) + nueva fecha si agendó · segventa: solo qué sucedió
    clave: 'contacto_detalle', hito: 'resultado', tipo: 'formulario',
    enunciado: (r, c) => (c.modo === 'cobro' ? '¿Qué sucedió exactamente?' : '¿Cómo fue el contacto?'),
    campos: (r, c) => (c.modo === 'cobro' ? [
      { campo: 'notes', label: 'Qué sucedió exactamente', tipo: 'parrafo', requerido: true, minimoTexto: 10 },
    ] : [
      { campo: 'modalidad', label: 'Modalidad', tipo: 'multiple', opciones: MODALIDADES, requerido: true },
      { campo: 'notes', label: 'Qué le dijiste y qué respondió', tipo: 'parrafo', requerido: true, minimoTexto: 10 },
      ...(r.contacto_result === 'agendo' ? [
        { campo: 'nueva_fecha_agenda', label: 'Nueva fecha', tipo: 'fecha', requerido: true },
        { campo: 'nueva_hora_agenda', label: 'Nueva hora', tipo: 'hora', requerido: true },
      ] : []),
    ]),
    cuando: enCadencia,
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
  { // Pedido de Kerwin (09/10/2026): un «No cerró» dice por qué, siempre. Queda como la objeción
    // de esta llamada y como nota en Comunicación (`objeciones_service` en el backend, que también
    // la exige: sin ella el reporte no se guarda).
    clave: 'objecion', hito: 'cierre', tipo: 'formulario',
    enunciado: '¿Por qué no cerró? ¿Cuál es la objeción?',
    ayuda: 'Lo que dijo, con sus palabras si podés. Queda en Comunicación y en la base de no cerradas.',
    campos: [{
      campo: 'objecion', label: 'Objeción', tipo: 'parrafo', requerido: true, minimoTexto: OBJECION_MINIMA,
    }],
    cuando: (r) => r.cierre === false,
  },
  { // Sin oferta presentada también se dice por qué no se cerró: casi siempre falta el decisor, pero
    // se pregunta igual para que la base no lo dé por supuesto.
    clave: 'motivo_sin_oferta', hito: 'cierre', tipo: 'formulario',
    enunciado: '¿Por qué no se cerró?',
    ayuda: 'Contá por qué no se presentó la oferta, por qué no hubo ni una seña, o qué faltó para que terminara mejor.',
    campos: [{
      campo: 'motivo_sin_oferta', label: 'Motivo', tipo: 'parrafo', requerido: true, minimoTexto: MOTIVO_MINIMO,
    }],
    cuando: (r) => r.offer_presented === false,
  },

  // ---------- rama venta ----------
  // ADR-W013: la venta nueva y el pago de algo que ya compró son dos caminos. La venta nueva son
  // 6 pantallas (datos, programa, cómo paga, la plata, el plan si queda saldo, referidos); el pago,
  // 2 (qué paga y cuánto). La fecha, «en la llamada», el estado y las notas no son pantalla: son
  // `venta_detalles`, que arranca contestada y se edita en la revisión.
  { // Venta directa: lo primero es decir qué se registra.
    clave: 'que_registra', hito: 'cierre', campo: 'registro', tipo: 'opciones',
    enunciado: '¿Qué estás registrando?',
    opciones: (r, c) => [
      { valor: 'venta', label: 'Una venta nueva', sub: 'Compra un programa, lo renueva o suma otro', tono: 'success' },
      {
        valor: 'pago', label: 'Un pago de algo que ya compró', tono: 'info',
        sub: c.programaCliente ? `Una cuota o parte del saldo de ${c.programaCliente}` : 'Una cuota o parte de lo que debe',
      },
    ],
    cuando: (r) => r.venta_directa === true,
  },
  { // Lo que trae la agenda, de un vistazo. El correo va primero y destacado: con él se crea o
    // renueva la suscripción de la Academia. Sin documento ni examen (ADR-W013).
    clave: 'venta_datos', hito: 'cierre', tipo: 'formulario', enunciado: 'Confirmá sus datos',
    ayuda: 'Vienen de la agenda. Corregí solo lo que esté mal.',
    campos: (r, c) => [
      {
        campo: 'mail_cliente', label: 'Correo del acceso', tipo: 'email', requerido: true, precargado: true,
        destacado: 'Con este correo se crea o renueva su suscripción en la Academia. Revisalo letra por letra.',
      },
      { campo: 'dar_acceso_academia', label: 'Darle acceso a la Academia al registrar la venta', tipo: 'booleano', etiquetas: { true: 'Sí', false: 'No por ahora' } },
      ...(r.dar_acceso_academia ? [{
        campo: 'acceso_hasta', label: 'Acceso hasta (vacío: 7 días si es seña, 4 meses si no)', tipo: 'fecha',
        presets: [{ label: '4 meses', meses: 4 }, { label: '6 meses', meses: 6 }, { label: '1 año', meses: 12 }],
      }] : []),
      texto('nombre_cliente', 'Nombre y apellido', { requerido: true, precargado: true }),
      texto('instagram', 'Instagram', { prefijo: '@', precargado: true }),
      texto('telefono', 'Teléfono (WhatsApp)', { tipo: 'tel', precargado: true }),
      // La comisión va a quien se elija; con un solo closer no hay nada que elegir.
      ...(closersDeLaVenta(c).length > 1 ? [{
        campo: 'vendedor_id', label: 'La comisión va a', tipo: 'opcion', requerido: true,
        opciones: closersDeLaVenta(c).map((x) => x.valor),
        etiquetas: Object.fromEntries(closersDeLaVenta(c).map((x) => [x.valor, x.label])),
        resumir: (v) => closersDeLaVenta(c).find((x) => x.valor === v)?.label || null,
      }] : []),
    ],
    validar: (r) => (r.mail_cliente && !EMAIL.test(String(r.mail_cliente).trim()) ? ['El correo no parece válido'] : []),
    cuando: esNueva,
  },
  { // ← wizard `program`. En un pago solo si no se sabe qué programa tiene.
    clave: 'programa', hito: 'cierre', campo: 'programa', tipo: 'opciones', enunciado: '¿Qué programa compró?',
    opciones: PROGRAMAS.map((p) => ({ ...p, tono: 'info' })),
    cuando: (r) => esNueva(r) || (esPago(r) && !r.programa),
  },
  { // ← wizard `paymentType`, sin Cuota: cobrar una cuota es el camino del pago. `allowed_types`
    // AVISA, no esconde ni bloquea: si el historial del cliente está mal cargado, el closer tiene
    // que poder declarar la venta real igual (caso de Emilia Collantes).
    clave: 'tipo_pago', hito: 'deuda', campo: 'tipo_pago_simple', tipo: 'opciones', enunciado: '¿Cómo paga?',
    ayuda: (r, c) => {
      if (c.cargandoVenta) return 'Revisando si ya compró este programa…';
      return pagadoAntes(c) > 0 ? `Ya pagó ${moneda(pagadoAntes(c))} de este programa: se descuenta solo.` : null;
    },
    opciones: (r, c) => TIPOS_PAGO.filter((t) => t.clave !== 'cuota').map((t) => {
      const regla = c.estadoVenta?.allowed_types?.[t.clave];
      return { ...t, tono: 'info', aviso: regla && regla.ok === false ? regla.reason : null };
    }),
    cuando: esNueva,
  },
  { // ← el checkbox «Liquidar el saldo pendiente» del paso `paymentType`, como pregunta propia
    clave: 'liquidar', hito: 'deuda', campo: 'settleBalanceWithSale', tipo: 'opciones',
    enunciado: (r, c) => `Todavía debe ${moneda(saldoPrevio(c))} del programa. ¿Lo liquidás junto con esta venta?`,
    ayuda: 'Se registra primero una Cuota por ese saldo y, si sale bien, la venta nueva.',
    opciones: [
      { valor: true, label: 'Sí, liquidarlo', sub: 'Cuota por el saldo + la venta nueva', tono: 'success' },
      { valor: false, label: 'No, solo la venta nueva', sub: 'El saldo sigue pendiente', tono: 'idle' },
    ],
    cuando: (r, c) => esNueva(r) && esRenovacionOUpsell(r)
      && !!c.estadoVenta?.can_settle_balance_with_installment && saldoPrevio(c) > 0.009,
  },
  { // La plata en una pantalla: cuánto, cuánto hoy, por dónde y, si fue transferencia, a quién.
    clave: 'venta_montos', hito: 'deuda', tipo: 'formulario',
    enunciado: (r) => (esCompleto(r) ? '¿Cuánto cobraste y por dónde?' : '¿Cuánto vale y cuánto cobraste hoy?'),
    ayuda: (r) => (esCompleto(r) ? null : 'El saldo se calcula solo.'),
    campos: (r, c) => [
      // Cuánto dura la renovación: la elige el closer (Santiago, 26/10/2026). Va a la suscripción.
      ...(r.tipo_pago_simple === 'Renovacion' ? [{
        campo: 'meses_renovacion', label: 'Renueva por', tipo: 'opcion', requerido: true, opciones: [1, 4],
        etiquetas: { 1: '1 mes', 4: '4 meses' },
      }] : []),
      ...(esCompleto(r) ? [] : [{
        campo: 'precio_total', label: 'Precio total', tipo: 'monto', requerido: true, minimo: 0.01, resumir: enPlata,
      }]),
      {
        campo: 'monto', label: esCompleto(r) ? 'Monto cobrado' : 'Cobrado hoy', tipo: 'monto',
        requerido: true, minimo: 0.01, resumir: enPlata,
      },
      ...camposDelMedio(r, c),
    ],
    cuando: esNueva,
  },
  { // Solo si queda saldo: cuántas cuotas y cuándo, con el cronograma a la vista.
    clave: 'venta_plan', hito: 'deuda', tipo: 'formulario',
    enunciado: (r, c) => `Te deben ${moneda(saldoVenta(r, c))}. ¿Cómo lo paga?`,
    ayuda: 'Si el mes no tiene ese día, se cobra el último. La última cuota se ajusta sola para que la suma cierre.',
    campos: (r) => [
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
    ],
    cuando: armaPlan,
  },
  { // Pago · 1: la cuota que paga (se puede adelantar una futura o pagar una vencida) o un pago
    // suelto del saldo. Pagar la ÚLTIMA cuota sin elegirla dejaba la cuota pendiente con la deuda
    // en cero: por eso se elige siempre.
    clave: 'pago_que', hito: 'deuda', campo: 'pago_de', tipo: 'opciones', enunciado: '¿Qué está pagando?',
    ayuda: (r, c) => (saldoPrevio(c) > 0.009 ? `${r.programa || ''} · le falta ${moneda(saldoPrevio(c))}`.trim() : null),
    opciones: (r, c) => [
      ...cuotasPendientes(r, c).map((q) => ({
        valor: q.id, label: `Cuota ${q.numero_cuota} · ${moneda(q.monto)}`, cuota: q,
        sub: `${q.estado === 'vencido' ? 'Vencida' : 'Vence'} el ${fechaCorta(q.fecha_vencimiento)}`,
        tono: q.estado === 'vencido' ? 'error' : 'info',
      })),
      { valor: 'saldo', label: 'Un pago suelto del saldo', sub: 'Sin cuota: baja lo que debe', tono: 'idle' },
    ],
    cuando: esPago,
  },
  { // Pago · 2: cuánto y por dónde.
    clave: 'pago_monto', hito: 'deuda', tipo: 'formulario', enunciado: '¿Cuánto pagó y por dónde?',
    campos: (r, c) => [
      { campo: 'monto', label: 'Monto', tipo: 'monto', requerido: true, minimo: 0.01, resumir: enPlata },
      ...camposDelMedio(r, c),
    ],
    cuando: esPago,
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
      { campo: 'notes', label: 'Qué falta cubrir / Notas (opcional)', tipo: 'parrafo' },
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
  { // ← segventa: «¿Cuándo es el siguiente seguimiento de cobro?» + aviso por WhatsApp. Si no
    // pagó ni dijo que no va a pagar, el cobro sigue: la fecha es obligatoria, como en el mazo.
    clave: 'cobro_fecha', hito: 'resultado', tipo: 'formulario',
    enunciado: '¿Cuándo es el siguiente seguimiento de cobro?',
    ayuda: 'Puede ser hoy mismo si quedaste en volver a escribirle más tarde.',
    campos: [
      {
        campo: 'fecha_seguimiento', label: 'Fecha del próximo intento de cobro', tipo: 'fecha', requerido: true,
        falta: 'Elegí la fecha del próximo intento de cobro',
        presets: [{ label: 'Hoy', dias: 0 }, { label: 'Mañana', dias: 1 }, { label: 'En 3 días', dias: 3 }, { label: 'En 1 semana', dias: 7 }],
      },
      // La hora va dentro de la celda del aviso (`junto`): suelta en otra columna quedaba lejos
      // de la casilla que la prende (Mario, 26/10/2026).
      { campo: 'followup_reminder_enabled', label: 'Avisarme por WhatsApp', tipo: 'booleano' },
      { campo: 'followup_reminder_time', label: 'Hora del aviso', tipo: 'hora', junto: 'followup_reminder_enabled' },
    ],
    cuando: (r, c) => enCobro(r, c) && ['no_resp', 'contesto'].includes(r.contacto_result),
  },

  // ---------- destinos comunes ----------
  { // ← follow (3015): fecha con presets + aviso de WhatsApp + ángulo del seguimiento
    // `vista: 'seguimiento'`: se dibuja con `PasoSeguimiento` (Snap / Flow, Mario 26/10/2026). Los
    // campos siguen acá porque la revisión y el resumen los leen.
    clave: 'seguimiento', hito: 'resultado', tipo: 'formulario', vista: 'seguimiento', enunciado: '¿Cuándo lo vas a seguir?',
    ayuda: 'Sin fecha va al pool del equipo.',
    campos: [
      // `SelectorFecha` pide los atajos como `{label, dias}`: con los textos sueltos que había
      // ('hoy', 'manana') dibujaba botones sin nada escrito. «Sin fecha» es dejarlo vacío.
      {
        campo: 'fecha_seguimiento', label: 'Fecha del próximo contacto', tipo: 'fecha',
        presets: [{ label: 'Hoy', dias: 0 }, { label: 'Mañana', dias: 1 }, { label: 'En 1 semana', dias: 7 }],
      },
      // La hora va dentro de la celda del aviso (`junto`): suelta en otra columna quedaba lejos
      // de la casilla que la prende (Mario, 26/10/2026).
      { campo: 'followup_reminder_enabled', label: 'Avisarme por WhatsApp', tipo: 'booleano' },
      { campo: 'followup_reminder_time', label: 'Hora del aviso', tipo: 'hora', junto: 'followup_reminder_enabled' },
      { campo: 'notes', label: 'Ángulo del seguimiento / Notas (opcional)', tipo: 'parrafo' },
    ],
    cuando: vaASeguimiento,
  },
  { // ← reasonModal de lost_after_pres / lost_no_pres / lost_no_show / no_lead: motivo OBLIGATORIO
    clave: 'descarte', hito: 'resultado', tipo: 'formulario', enunciado: '¿Por qué se descarta?',
    ayuda: 'El motivo queda en la bitácora del lead.',
    campos: [{ campo: 'motivo_descarte', label: 'Motivo', tipo: 'parrafo', requerido: true, minimoTexto: 3 }],
    cuando: vaADescartar,
  },
  { // ← overlay de referidos (2276-2348) + paso `referralAsked` del wizard de venta
    clave: 'refs_ask', hito: 'upsell', campo: 'refs_ask', tipo: 'opciones', enunciado: '¿Le pediste un referido?',
    ayuda: (r) => (esVenta(r) ? 'El mejor momento para pedirlo ya pasó. Contá qué salió.' : null),
    opciones: [
      { valor: 'si', label: 'Sí le pedí y me dio', sub: 'Cargamos los contactos', tono: 'success' },
      { valor: 'no', label: 'Sí le pedí, no me dio', sub: 'Queda registrado igual', tono: 'warning' },
      { valor: 'no_pedido', label: 'No le pedí', sub: 'La próxima', tono: 'idle' },
    ],
    cuando: (r, c) => huboContacto(r, c) && !esPago(r),
  },
  { // ← pasos `referralCount` + `referralContacts` del wizard: una fila por referido
    clave: 'refs_filas', hito: 'upsell', tipo: 'formulario', enunciado: 'Nombre y contacto de cada referido',
    ayuda: 'Con nombre y contacto entran directo a Confirmaciones como una llamada nueva.',
    campos: [{ campo: 'refs_rows', label: 'Referidos', tipo: 'filas', columnas: ['nombre', 'contacto'] }],
    validar: (r) => (!(r.refs_rows || []).some((f) => (f.nombre || '').trim())
      ? ['Cargá al menos un referido con nombre'] : []),
    cuando: (r, c) => huboContacto(r, c) && !esPago(r) && r.refs_ask === 'si',
  },
];
