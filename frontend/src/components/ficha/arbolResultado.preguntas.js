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
  esVenta, esCompleto, esRenovacionOUpsell, saldoPrevio, saldoVenta, quedaSaldo,
  cobraCuotaExistente, armaPlan, cantidadCuotas, cronogramaEnTexto, fechaCorta, MAXIMO_CUOTAS,
} from './arbolResultado.venta';

// Cómo se cuenta en la revisión lo que en crudo no se lee.
const enPlata = (v) => (v === '' || v === undefined || v === null ? null : moneda(v));
const cuotaElegida = (v, r, c) => {
  const q = (c.cuotas || []).find((x) => x.id === v);
  return q ? `Cuota ${q.numero_cuota} · vence ${fechaCorta(q.fecha_vencimiento)} · ${moneda(q.monto)}` : null;
};

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
  { valor: 'no_paga', label: 'No va a pagar', sub: 'Sale de la cola de cobros', tono: 'error' },
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

// El resumen «Así viene este cliente» se muestra mientras carga el estado del programa (con su
// esqueleto) y después solo si el cliente ya tiene pagos en ese programa, como en el wizard.
const muestraEstadoCliente = (r, c = {}) => esVenta(r) && !!r.programa
  && (!!c.cargandoVenta || (Number(c.estadoVenta?.sales_count) || 0) > 0);

// Tres formas de entrar al árbol: la llamada (las cuatro tarjetas), la cadencia de seguimiento de
// un lead que no compró (`seguimiento`) y el seguimiento de cobro de un cliente (`cobro`). La venta
// directa no reporta ni la llamada ni el contacto: entra derecho a los datos de la venta.
const CADENCIAS = ['seguimiento', 'cobro'];
const enLlamada = (r, c) => !CADENCIAS.includes(c.modo) && r.venta_directa !== true;
const enCadencia = (r, c) => CADENCIAS.includes(c.modo) && r.venta_directa !== true;
const enSeguimiento = (r, c) => c.modo === 'seguimiento' && r.venta_directa !== true;
const enCobro = (r, c) => c.modo === 'cobro' && r.venta_directa !== true;

export const PREGUNTAS = [
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

  // ---------- rama venta ----------
  // El wizard «Declarar venta» (DeclararVentaWizard), una pregunta por pantalla y en su orden:
  // primero se confirma cada dato del comprador —el de la agenda viene precargado y se revisa,
  // no se da por bueno—, después qué compró y cómo paga, el cronograma si queda saldo, los datos
  // de la venta, los referidos y el acceso a la Academia.
  { // ← wizard `name`
    clave: 'venta_nombre', hito: 'cierre', tipo: 'formulario', enunciado: '¿Quién compró?',
    ayuda: 'Vino de la agenda. Confirmá que esté bien escrito.',
    campos: [texto('nombre_cliente', 'Nombre y apellido', { requerido: true, precargado: true })],
    cuando: esVenta,
  },
  { // ← wizard `instagram`
    clave: 'venta_instagram', hito: 'cierre', tipo: 'formulario', enunciado: '¿Su Instagram?',
    ayuda: 'Sin arroba. Se usa para el seguimiento por DM.',
    campos: [texto('instagram', 'Instagram', { requerido: true, prefijo: '@', precargado: true })],
    cuando: esVenta,
  },
  { // ← wizard `email`
    clave: 'venta_email', hito: 'cierre', tipo: 'formulario', enunciado: '¿Su email?',
    ayuda: 'Acá le llega el acceso al programa.',
    campos: [texto('mail_cliente', 'Email', { requerido: true, tipo: 'email', precargado: true })],
    cuando: esVenta,
  },
  { // ← wizard `phone`
    clave: 'venta_telefono', hito: 'cierre', tipo: 'formulario', enunciado: '¿Su teléfono?',
    ayuda: 'Con código de país, para WhatsApp.',
    campos: [texto('telefono', 'Teléfono', { tipo: 'tel', precargado: true })],
    cuando: esVenta,
  },
  { // ← wizard `document`
    clave: 'venta_documento', hito: 'cierre', tipo: 'formulario', enunciado: '¿Su documento de identidad?',
    ayuda: 'DNI, NIE o pasaporte. Es el único dato que no trae la agenda.',
    campos: [texto('documento_identidad', 'Documento de identidad', { precargado: true })],
    cuando: esVenta,
  },
  { // ← wizard `closer`: la comisión va a quien se elija acá. Con una sola opción no hay nada
    // que elegir: la venta va al closer de la agenda.
    clave: 'venta_closer', hito: 'cierre', campo: 'vendedor_id', tipo: 'opciones',
    enunciado: '¿A quién se le atribuye la venta?', ayuda: 'La comisión va a este closer.',
    opciones: (r, c) => closersDeLaVenta(c),
    cuando: (r, c) => esVenta(r) && closersDeLaVenta(c).length > 1,
  },
  { // ← wizard `program`
    clave: 'programa', hito: 'cierre', campo: 'programa', tipo: 'opciones', enunciado: '¿Qué programa compró?',
    opciones: PROGRAMAS.map((p) => ({ ...p, tono: 'info' })), cuando: esVenta,
  },
  { // ← wizard `clientSummary`: solo si ya tiene pagos en ese programa
    clave: 'venta_estado_cliente', hito: 'cierre', tipo: 'formulario', enunciado: 'Así viene este cliente',
    ayuda: 'Ya tiene pagos registrados en este programa: el resto de la venta se ajusta solo.',
    campos: [{ campo: 'estado_cliente', label: 'Estado de pagos', tipo: 'estado_cliente', enResumen: false }],
    validar: (r, c) => (c.cargandoVenta ? ['Esperá a que cargue cómo viene pagando'] : []),
    cuando: muestraEstadoCliente,
  },
  { // ← wizard `paymentType`. `allowed_types` AVISA, no esconde ni bloquea: si el historial del
    // cliente está mal cargado, el closer tiene que poder declarar la venta real igual (caso real
    // de Emilia Collantes, ver `fetchSaleClientState` en CloserWorkflowPage).
    clave: 'tipo_pago', hito: 'deuda', campo: 'tipo_pago_simple', tipo: 'opciones', enunciado: '¿Cómo paga?',
    opciones: (r, c) => TIPOS_PAGO.map((t) => {
      const regla = c.estadoVenta?.allowed_types?.[t.clave];
      return { ...t, tono: 'info', aviso: regla && regla.ok === false ? regla.reason : null };
    }),
    cuando: esVenta,
  },
  { // ← el checkbox «Liquidar el saldo pendiente» del paso `paymentType`, como pregunta propia
    clave: 'liquidar', hito: 'deuda', campo: 'settleBalanceWithSale', tipo: 'opciones',
    enunciado: (r, c) => `Todavía debe ${moneda(saldoPrevio(c))} del programa. ¿Lo liquidás junto con esta venta?`,
    ayuda: 'Se registra primero una Cuota por ese saldo y, si sale bien, la venta nueva.',
    opciones: [
      { valor: true, label: 'Sí, liquidarlo', sub: 'Cuota por el saldo + la venta nueva', tono: 'success' },
      { valor: false, label: 'No, solo la venta nueva', sub: 'El saldo sigue pendiente', tono: 'idle' },
    ],
    cuando: (r, c) => esVenta(r) && esRenovacionOUpsell(r)
      && !!c.estadoVenta?.can_settle_balance_with_installment && saldoPrevio(c) > 0.009,
  },
  { // ← wizard `amounts` (precio total + cobrado hoy) y, en un pago completo, el monto del paso
    // `method`. El comentario del cobro viaja a Sheets como `segundo_pago`.
    clave: 'venta_montos', hito: 'deuda', tipo: 'formulario',
    enunciado: (r) => (esCompleto(r) ? '¿Cuánto cobraste?' : 'Precio total y cuánto cobrás hoy'),
    ayuda: (r) => (esCompleto(r) ? null : 'El saldo se calcula solo.'),
    campos: (r) => [
      ...(esCompleto(r) ? [] : [{
        campo: 'precio_total', label: 'Precio total', tipo: 'monto', requerido: true, minimo: 0.01, resumir: enPlata,
      }]),
      {
        campo: 'monto', label: esCompleto(r) ? 'Monto cobrado' : 'Cobrado hoy', tipo: 'monto',
        requerido: true, minimo: 0.01, resumir: enPlata,
      },
      texto('segundo_pago', 'Comentario del cobro (opcional)'),
    ],
    cuando: esVenta,
  },
  { // ← wizard `method`
    clave: 'medio_pago', hito: 'deuda', campo: 'metodo_pago', tipo: 'opciones',
    enunciado: '¿Por dónde entró la plata?', opciones: opts(MEDIOS_PAGO, 'info'), cuando: esVenta,
  },
  { // ← wizard `pickCuota`
    clave: 'venta_cuota', hito: 'deuda', tipo: 'formulario', enunciado: '¿Cuál cuota se está pagando?',
    ayuda: 'Elegí cualquier pendiente: podés adelantar una futura o pagar una vencida.',
    campos: [{
      campo: 'selectedCuotaId', label: 'Cuota que se paga', tipo: 'cuota', requerido: true,
      falta: 'Elegí la cuota que se paga', resumir: cuotaElegida,
    }],
    cuando: (r, c) => esVenta(r) && !esCompleto(r) && quedaSaldo(r, c) && cobraCuotaExistente(r, c),
  },
  { // ← wizard `installmentCount`
    clave: 'venta_num_cuotas', hito: 'deuda', tipo: 'formulario',
    enunciado: (r, c) => `Te deben ${moneda(saldoVenta(r, c))}. ¿En cuántas cuotas?`,
    ayuda: 'Después definís cuándo se cobran.',
    campos: [{
      campo: 'num_cuotas', label: 'Cantidad de cuotas', tipo: 'contador', requerido: true,
      minimo: 1, maximo: MAXIMO_CUOTAS, atajos: [2, 3, 4, 6],
      resumir: (v, r) => `${cantidadCuotas(r)} ${cantidadCuotas(r) === 1 ? 'cuota' : 'cuotas'}`,
    }],
    cuando: armaPlan,
  },
  { // ← wizard `installmentMode`
    clave: 'venta_modo_cuotas', hito: 'deuda', campo: 'installmentMode', tipo: 'opciones',
    enunciado: '¿El pago es mensual?', ayuda: 'Si es mensual solo elegís el día y el resto se calcula solo.',
    opciones: [
      { valor: 'monthly', label: 'Sí, todos los meses el mismo día', sub: 'Elegís un día y listo', tono: 'info' },
      { valor: 'custom', label: 'No, fechas distintas', sub: 'Cargás cada fecha a mano', tono: 'info' },
    ],
    cuando: armaPlan,
  },
  { // ← wizard `installmentDay`
    clave: 'venta_dia_pago', hito: 'deuda', tipo: 'formulario', enunciado: '¿Qué día de cada mes paga?',
    ayuda: 'Si el mes no tiene ese día, se cobra el último. Podés ajustar el monto de cada cuota abajo.',
    campos: [
      { campo: 'dia_de_pago', label: 'Día de pago', tipo: 'dia_mes', requerido: true, resumir: (v) => `El ${v} de cada mes` },
      { campo: 'cuotaMontos', label: 'Cronograma', tipo: 'cronograma', resumir: (v, r, c) => cronogramaEnTexto(r, c) },
    ],
    cuando: (r, c) => armaPlan(r, c) && r.installmentMode === 'monthly',
  },
  { // ← wizard `installmentDates`
    clave: 'venta_fechas_cuotas', hito: 'deuda', tipo: 'formulario', enunciado: '¿Cuándo cobrás cada cuota?',
    ayuda: 'Estas fechas son las que te van a aparecer en seguimientos. La última cuota se ajusta sola para que la suma cierre.',
    campos: [{ campo: 'cuotaFechas', label: 'Cronograma', tipo: 'cronograma', resumir: (v, r, c) => cronogramaEnTexto(r, c) }],
    cuando: (r, c) => armaPlan(r, c) && r.installmentMode === 'custom',
  },
  { // ← wizard `exam`
    clave: 'venta_examen', hito: 'cierre', tipo: 'formulario', enunciado: '¿Qué examen rinde?',
    ayuda: 'Define el grupo y el contenido que recibe.',
    campos: [texto('examen_lead', 'Examen', { precargado: true })],
    cuando: esVenta,
  },
  { // ← wizard `saleMeta`
    clave: 'venta_fecha', hito: 'cierre', tipo: 'formulario', enunciado: '¿Cuándo se cerró?',
    ayuda: 'Y si la firma fue dentro de la llamada.',
    campos: [
      // Sin piso: una venta de ayer que se reporta hoy tiene que poder fecharse ayer.
      {
        campo: 'date', label: 'Fecha de la venta', tipo: 'fecha', requerido: true, sinMinimo: true,
        presets: [{ label: 'Hoy', dias: 0 }, { label: 'Ayer', dias: -1 }],
      },
      {
        campo: 'sold_in_call', label: '¿Cerró en la llamada?', tipo: 'opcion', opciones: [true, false],
        etiquetas: { true: 'Sí, en el Meet', false: 'No, fuera de la llamada' },
      },
    ],
    cuando: esVenta,
  },
  { // ← wizard `estado`
    clave: 'venta_estado', hito: 'cierre', campo: 'estado', tipo: 'opciones', enunciado: '¿Estado de la venta?',
    opciones: ESTADOS_VENTA, cuando: esVenta,
  },
  { // ← wizard `notas` + el `fecha_cobro` que guardaba `handleRegisterSale` como seguimiento de cobro
    clave: 'venta_notas', hito: 'cierre', tipo: 'formulario', enunciado: 'Notas u observaciones',
    ayuda: 'Opcional: objeciones, detalles del cierre, lo que sirva después.',
    campos: (r, c) => [
      { campo: 'notas', label: 'Notas', tipo: 'parrafo' },
      ...(quedaSaldo(r, c) ? [{
        campo: 'fecha_cobro', label: 'Próximo seguimiento de cobro (opcional)', tipo: 'fecha',
        presets: [{ label: 'En 1 semana', dias: 7 }, { label: 'En 1 mes', meses: 1 }],
      }] : []),
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
      { campo: 'followup_reminder_enabled', label: 'Avisarme por WhatsApp', tipo: 'booleano' },
      { campo: 'followup_reminder_time', label: 'Hora del aviso', tipo: 'hora' },
    ],
    cuando: (r, c) => enCobro(r, c) && ['no_resp', 'contesto'].includes(r.contacto_result),
  },

  // ---------- destinos comunes ----------
  { // ← follow (3015): fecha con presets + aviso de WhatsApp + ángulo del seguimiento
    clave: 'seguimiento', hito: 'resultado', tipo: 'formulario', enunciado: '¿Cuándo lo vas a seguir?',
    ayuda: 'Sin fecha va al pool del equipo.',
    campos: [
      // `SelectorFecha` pide los atajos como `{label, dias}`: con los textos sueltos que había
      // ('hoy', 'manana') dibujaba botones sin nada escrito. «Sin fecha» es dejarlo vacío.
      {
        campo: 'fecha_seguimiento', label: 'Fecha del próximo contacto', tipo: 'fecha',
        presets: [{ label: 'Hoy', dias: 0 }, { label: 'Mañana', dias: 1 }, { label: 'En 1 semana', dias: 7 }],
      },
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
  { // ← overlay de referidos (2276-2348) + paso `referralAsked` del wizard de venta
    clave: 'refs_ask', hito: 'upsell', campo: 'refs_ask', tipo: 'opciones', enunciado: '¿Le pediste un referido?',
    ayuda: (r) => (esVenta(r) ? 'El mejor momento para pedirlo ya pasó. Contá qué salió.' : null),
    opciones: [
      { valor: 'si', label: 'Sí le pedí y me dio', sub: 'Cargamos los contactos', tono: 'success' },
      { valor: 'no', label: 'Sí le pedí, no me dio', sub: 'Queda registrado igual', tono: 'warning' },
      { valor: 'no_pedido', label: 'No le pedí', sub: 'La próxima', tono: 'idle' },
    ],
    cuando: huboContacto,
  },
  { // ← pasos `referralCount` + `referralContacts` del wizard: una fila por referido
    clave: 'refs_filas', hito: 'upsell', tipo: 'formulario', enunciado: 'Nombre y contacto de cada referido',
    ayuda: 'Con nombre y contacto entran directo a Confirmaciones como una llamada nueva.',
    campos: [{ campo: 'refs_rows', label: 'Referidos', tipo: 'filas', columnas: ['nombre', 'contacto'] }],
    validar: (r) => (!(r.refs_rows || []).some((f) => (f.nombre || '').trim())
      ? ['Cargá al menos un referido con nombre'] : []),
    cuando: (r, c) => huboContacto(r, c) && r.refs_ask === 'si',
  },
  { // ← el checkbox «Dar acceso a la Academia» de la revisión del wizard, como pregunta propia:
    // es una decisión que no se puede tomar por omisión (apagado por defecto en el wizard).
    clave: 'venta_academia', hito: 'upsell', campo: 'dar_acceso_academia', tipo: 'opciones',
    enunciado: '¿Le das acceso a la Academia?',
    ayuda: (r) => `Con el email ${r.mail_cliente || '(sin email)'}. Sí, si esta venta arranca o renueva su acceso real al programa; no hace falta en una venta de prueba o en la Cuota de alguien que ya entra.`,
    opciones: (r) => [
      { valor: true, label: 'Sí, darle acceso', sub: `Crea o renueva su usuario con ${r.mail_cliente || 'su email'}`, tono: 'success' },
      { valor: false, label: 'No por ahora', sub: 'Se le puede dar después', tono: 'idle' },
    ],
    cuando: esVenta,
  },
];
