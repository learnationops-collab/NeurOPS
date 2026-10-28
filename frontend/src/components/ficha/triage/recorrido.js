// El recorrido del reporte de triage, una pregunta por pantalla, como `arbolResultado.js` del closer.
// Funciones puras: la pestaña guarda las respuestas (`r`) y los pasos ya dados, y esto dice qué
// pantalla toca, qué falta para seguir, los hitos de la columna de progreso, la revisión y el
// pedido a `reportar_triage` (app/services/triage_service.py).
//
// Tres modos: «llamada» (el reporte), «venta» (Registrar el low ticket, sin reporte previo) y
// «actualizar» (el low ticket de un descalificado ya reportado: el seguimiento que después cerró).

import { datetimeLocalToUtcIso } from '../../../utils/datetime';

export const MINIMO_NOTA = 20;
export const PRECIO_LOW_TICKET = '100';

export const RAICES = [
  { valor: 'asistio', label: 'Asistió', color: '#2EE6C8' },
  { valor: 'no_asistio', label: 'No asistió', color: '#FF3FA4' },
  { valor: 'cancelo', label: 'Canceló', color: '#FFB547' },
  { valor: 'reagenda', label: 'Reagenda', color: '#7D8BFF' },
];
export const CALIFICACION = [
  { valor: 'calificado', label: 'Califica', sub: 'Puede invertir +500 USD: pasa a closing' },
  { valor: 'descalificado', label: 'No califica', sub: 'Menos de 500 USD: va al low ticket' },
];
export const LOW_TICKET = [
  { valor: 'cerrado', label: 'Cerró', sub: 'Pagó el low ticket' },
  { valor: 'no_cerrado', label: 'No cerró', sub: 'Se lo presenté y dijo que no' },
  { valor: 'seguimiento', label: 'Seguimiento', sub: 'Lo piensa, quedamos en hablar' },
  { valor: 'descartado', label: 'Perdido', sub: 'No hay nada que hacer' },
  { valor: 'no_pitch', label: 'No se lo presenté', sub: 'No llegué a ofrecerlo' },
];
const ASISTENCIA = { asistio: 'asistio', no_asistio: 'no_show', cancelo: 'cancelo', reagenda: 'reagenda' };

const etiqueta = (lista, valor) => lista.find((o) => o.valor === valor)?.label || '';
export const esTransferencia = (medio) => /transferencia/i.test(medio || '');
const largo = (texto) => (texto || '').trim().length >= MINIMO_NOTA;

export const inicial = (modo = 'llamada') => ({ modo, monto: PRECIO_LOW_TICKET });

export const califica = (r) => r.res === 'asistio' && r.cal === 'calificado';
export const descalifica = (r) => r.res === 'asistio' && r.cal === 'descalificado';
export const vende = (r) => r.modo === 'venta' || ((descalifica(r) || r.modo === 'actualizar') && r.lt === 'cerrado');

// La venta en una pantalla: cuánto, por dónde y a quién si fue transferencia (ADR-W013, como el pago del closer).
const pasosDeVenta = () => ['venta'];
const pasosDelLowTicket = (r) => [
  'lt',
  ...(r.lt === 'cerrado' ? pasosDeVenta(r) : []),
  ...(r.lt === 'seguimiento' ? ['fecha_seg'] : []),
];

/** Las pantallas del camino que marcan las respuestas, en orden, terminando en la revisión. */
export function secuencia(r) {
  if (r.modo === 'venta') return [...pasosDeVenta(r), 'revision'];
  if (r.modo === 'actualizar') return [...pasosDelLowTicket(r), 'revision'];
  const s = ['raices'];
  if (r.res === 'asistio') {
    s.push('cal');
    if (califica(r)) s.push('closer', 'horario', 'nota_closer');
    if (descalifica(r)) s.push(...pasosDelLowTicket(r), 'por_que');
  } else if (r.res === 'reagenda') {
    s.push('reagenda', 'nota');
  } else if (r.res) {
    s.push('nota');
  }
  s.push('revision');
  return s;
}

export const actual = (r, hechos) => secuencia(r).find((p) => !hechos.includes(p));

/** Los pasos dados que siguen valiendo antes de `paso` (al cambiar una respuesta, lo de después se vuelve a preguntar). */
export const hastaAntesDe = (r, hechos, paso) => {
  const s = secuencia(r);
  return hechos.filter((h) => s.includes(h) && s.indexOf(h) < s.indexOf(paso));
};

/** Lo que falta para «Continuar» en una pantalla de campos. */
export function faltan(paso, r) {
  const f = [];
  if (paso === 'horario' && !r.cuando) f.push('Día y hora');
  if (paso === 'nota_closer' && !largo(r.notaCloser)) f.push('Nota para el closer');
  if (paso === 'venta' && !(Number(r.monto) > 0)) f.push('Monto');
  if (paso === 'venta' && !r.medio) f.push('Medio de pago');
  if (paso === 'venta' && esTransferencia(r.medio) && !r.transferidoA) f.push('A quién se lo transfirió');
  if (paso === 'fecha_seg' && !r.fechaSeg) f.push('Fecha');
  if (paso === 'reagenda' && !r.nueva) f.push('Fecha nueva');
  if (paso === 'por_que' && !largo(r.nota)) f.push('Por qué no califica');
  return f;
}

/** Los hitos de la columna de progreso (`StepperFicha` vertical), según el camino. */
export function hitos(r, hechos, guardado) {
  const dado = (p) => guardado || hechos.includes(p);
  const est = (alcanzado, malo = false) => (alcanzado ? (malo ? 'alerta' : 'hecho') : 'pendiente');
  const lt = [{ key: 'lt', label: 'Low ticket', estado: est(!!r.lt && dado('lt'), r.lt !== 'cerrado') }];
  if (r.lt === 'cerrado') lt.push({ key: 'venta', label: 'Venta', estado: est(dado('venta')) });
  let lista;
  if (r.modo === 'venta') {
    lista = [{ key: 'venta', label: 'Pago', estado: est(dado('venta')) }];
  } else if (r.modo === 'actualizar') {
    lista = lt;
  } else {
    lista = [
      { key: 'conf', label: 'Confirmado', estado: 'hecho' },
      { key: 'res', label: 'Resultado', estado: est(!!r.res, r.res !== 'asistio') },
    ];
    if (!r.res || r.res === 'asistio') {
      lista.push({ key: 'cal', label: 'Calificación', estado: est(!!r.cal && dado('cal'), r.cal === 'descalificado') });
    }
    if (califica(r)) {
      lista.push({ key: 'closer', label: 'Closer', estado: est(dado('closer')) },
        { key: 'horario', label: 'Horario', estado: est(dado('horario')) },
        { key: 'nota_closer', label: 'Nota al closer', estado: est(dado('nota_closer')) });
    } else if (descalifica(r)) {
      lista.push(...lt, { key: 'por_que', label: 'Por qué', estado: est(dado('por_que')) });
    } else if (r.res === 'reagenda') {
      lista.push({ key: 'reagenda', label: 'Fecha nueva', estado: est(dado('reagenda')) });
    } else if (!r.res || r.res === 'asistio') {
      lista.push({ key: 'sig', label: 'Siguiente paso', estado: 'pendiente' });
    }
  }
  return [...lista, { key: 'revision', label: 'Revisión', estado: est(guardado) }];
}

/** Las filas de la revisión: rótulo, valor y la pantalla que lo corrige. */
export function filas(r, { closers = [], medios = [], personas = [], legible = (v) => v } = {}) {
  const f = [];
  const fila = (label, valor, paso) => f.push({ label, valor: valor || '—', paso });
  if (r.modo === 'llamada') {
    fila('Asistencia', etiqueta(RAICES, r.res), 'raices');
    if (r.res === 'asistio') fila('Calificación', etiqueta(CALIFICACION, r.cal), 'cal');
    if (califica(r)) {
      fila('Pasa a', closers.find((c) => String(c.id) === String(r.closerId))?.nombre, 'closer');
      fila('Llamada con el closer', legible(r.cuando, r.tz), 'horario');
      fila('Nota para el closer', r.notaCloser, 'nota_closer');
    }
    if (r.res === 'reagenda') fila('Fecha nueva', legible(r.nueva), 'reagenda');
  }
  if (descalifica(r) || r.modo === 'actualizar') fila('Low ticket', etiqueta(LOW_TICKET, r.lt), 'lt');
  if (vende(r)) {
    fila('Monto', `${r.monto} USD`, 'venta');
    fila('Medio de pago', medios.find((m) => m.clave === r.medio)?.label || r.medio, 'venta');
    if (esTransferencia(r.medio)) fila('Transferido a', personas.find((p) => p.clave === r.transferidoA)?.label, 'venta');
  }
  if (r.lt === 'seguimiento' && r.modo !== 'venta') fila('Seguimiento', r.fechaSeg, 'fecha_seg');
  if (descalifica(r)) fila('Por qué no califica', r.nota, 'por_que');
  if (r.modo === 'llamada' && r.res && r.res !== 'asistio' && r.nota) fila('Nota', r.nota, 'nota');
  return f;
}

const venta = (r) => ({
  monto: Number(r.monto), metodo_pago: r.medio,
  ...(esTransferencia(r.medio) ? { transferido_a: r.transferidoA } : {}),
});

/** El pedido a `reportar_triage`. Sin `asistencia` solo cambia el low ticket (modos venta y actualizar). */
export function payload(r) {
  if (r.modo === 'venta') return { low_ticket: 'cerrado', venta: venta(r) };
  if (r.modo === 'actualizar') {
    return { low_ticket: r.lt, fecha_seguimiento: r.fechaSeg, ...(r.lt === 'cerrado' ? { venta: venta(r) } : {}) };
  }
  if (r.res === 'reagenda') {
    return { asistencia: 'reagenda', fecha: datetimeLocalToUtcIso(r.nueva), nota: (r.nota || '').trim() };
  }
  return {
    asistencia: ASISTENCIA[r.res],
    nota: (r.nota || '').trim(),
    ...(r.res === 'asistio' ? { calificacion: r.cal } : {}),
    ...(califica(r) ? { closer_id: Number(r.closerId), fecha: r.cuando, nota_para_closer: r.notaCloser.trim() } : {}),
    ...(descalifica(r) ? { low_ticket: r.lt, fecha_seguimiento: r.fechaSeg } : {}),
    ...(descalifica(r) && r.lt === 'cerrado' ? { venta: venta(r) } : {}),
  };
}

/** El texto del botón de guardar en la revisión. */
export const textoGuardar = (r) => (califica(r) ? 'Guardar y agendar con el closer'
  : vende(r) ? 'Guardar y registrar la venta' : 'Guardar');
