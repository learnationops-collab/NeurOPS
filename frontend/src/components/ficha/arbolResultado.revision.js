// La revisión de la venta, como función pura: lo que el closer ve antes de «Registrar la venta».
//
// Toma las filas planas de `resumen` y las ordena en secciones que se escanean de un vistazo
// (llamada, cliente, programa, pago, fechas, notas), saca de las respuestas los números grandes
// (total, cobrado hoy, saldo) y revisa que los datos tengan sentido: campos vacíos que conviene
// llenar, cuotas que no suman, fechas raras. No cambia el contrato JSON de la venta: solo lee las
// mismas respuestas que `construirPayload` y no escribe nada.
//
// Cada fila y cada aviso traen `paso`: la clave de la pregunta a la que lleva «Editar». Al
// confirmarla, el árbol vuelve solo a la revisión (ver `responder`: el resto del camino sigue
// contestado).

import { moneda, round2 } from './acciones/planCuotas';
import { PREGUNTAS, PROGRAMAS, TIPOS_PAGO } from './arbolResultado.preguntas';
import {
  esVenta, esCompleto, armaPlan, saldoVenta, pagadoAntes, montosCuotas, fechasCuotas,
  cantidadCuotas,
} from './arbolResultado.venta';

// Qué sección ocupa cada pregunta. Lo que no figura cae en «Otros datos».
const SECCION_DE = {
  res: 'llamada', contacto_result: 'llamada', contacto_detalle: 'llamada', decisor: 'llamada',
  oferta: 'llamada', cierre: 'llamada',
  venta_nombre: 'cliente', venta_instagram: 'cliente', venta_email: 'cliente',
  venta_telefono: 'cliente', venta_documento: 'cliente', venta_closer: 'cliente',
  venta_examen: 'cliente',
  programa: 'programa', venta_estado_cliente: 'programa',
  tipo_pago: 'pago', liquidar: 'pago', venta_montos: 'pago', medio_pago: 'pago',
  venta_cuota: 'pago', venta_num_cuotas: 'pago', venta_modo_cuotas: 'pago',
  venta_dia_pago: 'pago', venta_fechas_cuotas: 'pago',
  venta_fecha: 'fechas', venta_estado: 'fechas',
  venta_notas: 'notas',
  refs_ask: 'despues', refs_filas: 'despues', venta_academia: 'despues',
};

export const SECCIONES_VENTA = [
  { id: 'cliente', titulo: 'Cliente' },
  { id: 'programa', titulo: 'Programa' },
  { id: 'pago', titulo: 'Forma de pago' },
  { id: 'fechas', titulo: 'Fechas y estado' },
  { id: 'notas', titulo: 'Notas' },
  { id: 'despues', titulo: 'Después de la venta' },
  { id: 'llamada', titulo: 'La llamada' },
  { id: 'otros', titulo: 'Otros datos' },
];

// Datos opcionales que, si quedaron vacíos, se muestran igual como «Sin cargar» con su botón
// para completarlos: que falten es una decisión del closer, no un olvido del resumen.
const OPCIONALES = [
  { paso: 'venta_telefono', campo: 'telefono', label: 'Teléfono' },
  { paso: 'venta_documento', campo: 'documento_identidad', label: 'Documento de identidad' },
  { paso: 'venta_examen', campo: 'examen_lead', label: 'Examen' },
  { paso: 'venta_notas', campo: 'notas', label: 'Notas' },
];

const vacio = (v) => v === undefined || v === null || String(v).trim() === '';
const hayPaso = (r, clave) => (r._pasos || []).includes(clave);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const pasoDeLaFila = (fila) => fila.paso || fila.clave;

/** Los avisos de datos faltantes o inconsistentes de la venta. `nivel`: error | aviso. */
export function avisosVenta(r = {}, c = {}, hoy = new Date()) {
  const avisos = [];
  const agregar = (id, nivel, texto, paso) => avisos.push({ id, nivel, texto, paso });
  const hoyIso = iso(hoy);

  if (!vacio(r.mail_cliente) && !EMAIL.test(String(r.mail_cliente).trim())) {
    agregar('email', 'error', 'El email no parece válido: ahí le llega el acceso al programa.', 'venta_email');
  }
  if (hayPaso(r, 'venta_telefono') && vacio(r.telefono)) {
    agregar('telefono', 'aviso', 'Sin teléfono: no se le podrá escribir por WhatsApp.', 'venta_telefono');
  }
  if (hayPaso(r, 'venta_documento') && vacio(r.documento_identidad)) {
    agregar('documento', 'aviso', 'Sin documento de identidad.', 'venta_documento');
  }
  if (hayPaso(r, 'venta_examen') && vacio(r.examen_lead)) {
    agregar('examen', 'aviso', 'Sin examen: define el grupo y el contenido que recibe.', 'venta_examen');
  }

  const total = parseFloat(r.precio_total) || 0;
  const cobrado = parseFloat(r.monto) || 0;
  if (!esCompleto(r) && total > 0 && cobrado > total + 0.009) {
    agregar('cobrado-mayor', 'error',
      `Cobrado hoy (${moneda(cobrado)}) es mayor que el precio total (${moneda(total)}).`, 'venta_montos');
  }
  if (!esCompleto(r) && total > 0 && pagadoAntes(c) + cobrado > total + 0.009) {
    agregar('pagado-mayor', 'aviso',
      `Con lo que ya pagó antes (${moneda(pagadoAntes(c))}) se supera el precio total.`, 'venta_montos');
  }

  if (r.date) {
    if (r.date > hoyIso) {
      agregar('fecha-futura', 'error', 'La fecha de la venta es futura.', 'venta_fecha');
    } else {
      const dias = Math.round((new Date(`${hoyIso}T00:00:00`) - new Date(`${r.date}T00:00:00`)) / 86400000);
      if (dias > 7) agregar('fecha-vieja', 'aviso', `La venta está fechada hace ${dias} días. ¿Es correcto?`, 'venta_fecha');
    }
  }

  if (armaPlan(r, c)) {
    const saldo = saldoVenta(r, c);
    const montos = montosCuotas(r, c);
    const pasoPlan = r.installmentMode === 'custom' ? 'venta_fechas_cuotas' : 'venta_dia_pago';
    const mala = montos.findIndex((m) => !(m > 0));
    if (mala >= 0) {
      agregar('cuota-cero', 'error', `La cuota ${mala + 1} quedó sin monto: los montos cargados pasan el saldo.`, pasoPlan);
    }
    const suma = round2(montos.reduce((a, b) => a + b, 0));
    if (Math.abs(suma - saldo) > 0.009) {
      agregar('cuotas-suma', 'error',
        `Las cuotas suman ${moneda(suma)} y el saldo es ${moneda(saldo)}.`, pasoPlan);
    }
    const fechas = fechasCuotas(r, hoy);
    if (fechas.some((f, i) => (i > 0 && f <= fechas[i - 1]))) {
      agregar('fechas-orden', 'aviso', 'Las fechas de las cuotas no van en orden.', pasoPlan);
    }
    if (r.installmentMode === 'custom' && fechas.some((f) => f <= hoyIso)) {
      agregar('fechas-pasadas', 'aviso', 'Hay cuotas con fecha de hoy o ya pasada.', pasoPlan);
    }
  }
  return avisos;
}

/**
 * Lo que pinta la revisión de una venta.
 *
 * `secciones` solo trae las que tienen filas, en el orden de `SECCIONES_VENTA`; cada fila es
 * `{ clave, paso, label, valor, vacia }` (`vacia`: dato opcional sin cargar). `numeros` son las
 * cifras destacadas. Las preguntas que no son de venta (la llamada) van en su sección aparte.
 */
export function revisionVenta(respuestas = {}, contexto = {}, filasResumen = [], hoy = new Date()) {
  const r = respuestas;
  const venta = esVenta(r);
  const porSeccion = {};
  const meter = (fila) => {
    const id = SECCION_DE[pasoDeLaFila(fila)] || 'otros';
    (porSeccion[id] = porSeccion[id] || []).push(fila);
  };
  filasResumen.forEach((f) => meter({ ...f, paso: pasoDeLaFila(f), vacia: false }));

  OPCIONALES.forEach((o) => {
    if (!hayPaso(r, o.paso) || !vacio(r[o.campo])) return;
    const ya = (porSeccion[SECCION_DE[o.paso]] || []).some((f) => f.paso === o.paso);
    if (!ya) meter({ clave: `${o.paso}.${o.campo}`, paso: o.paso, label: o.label, valor: 'Sin cargar', vacia: true });
  });

  const secciones = SECCIONES_VENTA
    .map((s) => ({ ...s, filas: porSeccion[s.id] || [] }))
    .filter((s) => s.filas.length > 0);

  const completo = esCompleto(r);
  const cobrado = parseFloat(r.monto) || 0;
  const total = completo ? cobrado : (parseFloat(r.precio_total) || 0);
  const tipo = TIPOS_PAGO.find((t) => t.valor === r.tipo_pago_simple);
  const programa = PROGRAMAS.find((p) => p.valor === r.programa);
  const saldo = venta ? saldoVenta(r, contexto) : 0;
  return {
    venta,
    secciones,
    avisos: venta ? avisosVenta(r, contexto, hoy) : [],
    numeros: {
      total,
      cobrado,
      saldo,
      antes: pagadoAntes(contexto),
      programa: programa ? programa.label : (r.programa || ''),
      tipoPago: tipo ? tipo.label : (r.tipo_pago_simple || ''),
      cuotas: armaPlan(r, contexto) ? cantidadCuotas(r) : 0,
    },
  };
}

// Las claves de pregunta que existen: sirve a los tests para no dejar un paso sin sección.
export const CLAVES_CON_SECCION = Object.keys(SECCION_DE).filter((k) => PREGUNTAS.some((q) => q.clave === k));
