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
  esVenta, esPago, esCompleto, armaPlan, saldoVenta, saldoPrevio, pagadoAntes, montosCuotas, fechasCuotas,
  cantidadCuotas,
} from './arbolResultado.venta';

// Qué sección ocupa cada pregunta. Lo que no figura cae en «Otros datos».
const SECCION_DE = {
  res: 'llamada', contacto_result: 'llamada', contacto_detalle: 'llamada', decisor: 'llamada',
  oferta: 'llamada', cierre: 'llamada', que_registra: 'llamada',
  venta_datos: 'cliente',
  programa: 'programa',
  tipo_pago: 'pago', liquidar: 'pago', venta_montos: 'pago', venta_plan: 'pago', pago_que: 'pago', pago_monto: 'pago',
  venta_detalles: 'detalles',
  refs_ask: 'despues', refs_filas: 'despues',
};

export const SECCIONES_VENTA = [
  { id: 'cliente', titulo: 'Cliente' },
  { id: 'programa', titulo: 'Programa' },
  { id: 'pago', titulo: 'La plata' },
  { id: 'detalles', titulo: 'Detalles' },
  { id: 'despues', titulo: 'Después de la venta' },
  { id: 'llamada', titulo: 'La llamada' },
  { id: 'otros', titulo: 'Otros datos' },
];

// Datos opcionales que, si quedaron vacíos, se muestran igual como «Sin cargar» con su botón
// para completarlos: que falten es una decisión del closer, no un olvido del resumen.
const OPCIONALES = [
  { paso: 'venta_datos', campo: 'telefono', label: 'Teléfono (WhatsApp)' },
  { paso: 'venta_datos', campo: 'instagram', label: 'Instagram' },
  { paso: 'venta_detalles', campo: 'notas', label: 'Notas' },
];

const vacio = (v) => v === undefined || v === null || String(v).trim() === '';
const hayPaso = (r, clave) => (r._pasos || []).includes(clave);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const pasoDeLaFila = (fila) => fila.paso || fila.clave;

// Lo que el closer escribe en Instagram cuando no lo tiene: no es un usuario (pendientes del 27/10).
const IG_DE_RELLENO = /^(no|no tengo|no tiene|no usa|no uso|ninguno|ninguna|sin instagram|na|n\/a|x|-+|\.+)$/i;
const soloLetras = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

/** El Instagram de la venta no es de relleno ni el nombre (o el correo) de un closer. */
function avisoInstagram(r, c) {
  const ig = String(r.instagram || '').trim().replace(/^@+/, '');
  if (!ig) return null;
  if (IG_DE_RELLENO.test(ig) || /\s/.test(ig)) {
    return 'El Instagram no parece un usuario: si no tiene, dejalo vacío.';
  }
  const plano = soloLetras(ig);
  const closers = [...(c.closers || []), c.closerAgenda].filter(Boolean)
    .map((x) => (typeof x === 'string' ? x : x.nombre || x.username || ''));
  const delVendedor = String(r.email_vendedor || '').split('@')[0];
  if ([...closers, delVendedor].some((n) => soloLetras(n) && soloLetras(n) === plano)) {
    return 'El Instagram es el nombre de un closer: va el del cliente.';
  }
  return null;
}

/** Los avisos de datos faltantes o inconsistentes de la venta. `nivel`: error | aviso. */
export function avisosVenta(r = {}, c = {}, hoy = new Date()) {
  const avisos = [];
  const agregar = (id, nivel, texto, paso) => avisos.push({ id, nivel, texto, paso });
  const hoyIso = iso(hoy);

  if (r.date) {
    if (r.date > hoyIso) {
      agregar('fecha-futura', 'error', 'La fecha es futura: cambiala en «Detalles».', 'venta_detalles');
    } else {
      const dias = Math.round((new Date(`${hoyIso}T00:00:00`) - new Date(`${r.date}T00:00:00`)) / 86400000);
      if (dias > 7) agregar('fecha-vieja', 'aviso', `Está fechada hace ${dias} días. ¿Es correcto?`, 'venta_detalles');
    }
  }
  // Un pago no pide los datos del cliente ni arma un plan: solo puede pasarse de lo que debía.
  if (esPago(r)) {
    const cobradoPago = parseFloat(r.monto) || 0;
    if (saldoPrevio(c) > 0.009 && cobradoPago > saldoPrevio(c) + 0.009) {
      agregar('pago-mayor', 'aviso', `Paga ${moneda(cobradoPago)} y debía ${moneda(saldoPrevio(c))}.`, 'pago_monto');
    }
    return avisos;
  }

  if (!vacio(r.mail_cliente) && !EMAIL.test(String(r.mail_cliente).trim())) {
    agregar('email', 'error', 'El correo no parece válido: con él se crea su acceso a la Academia.', 'venta_datos');
  }
  const ig = avisoInstagram(r, c);
  // Frena: con un Instagram que no es del cliente la venta no se registra (pendientes del 27/10).
  if (ig) avisos.push({ id: 'instagram', nivel: 'error', texto: ig, paso: 'venta_datos', frena: true });
  if (hayPaso(r, 'venta_datos') && vacio(r.telefono)) {
    agregar('telefono', 'aviso', 'Sin teléfono: no se le podrá escribir por WhatsApp.', 'venta_datos');
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

  if (armaPlan(r, c)) {
    const saldo = saldoVenta(r, c);
    const montos = montosCuotas(r, c);
    const pasoPlan = 'venta_plan';
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

  const pago = esPago(r);
  const cobrado = parseFloat(r.monto) || 0;
  const total = esCompleto(r) || pago ? cobrado : (parseFloat(r.precio_total) || 0);
  const cuota = pago ? (contexto.cuotas || []).find((q) => q.id === r.selectedCuotaId) : null;
  const tipo = pago
    ? { label: cuota ? `Cuota ${cuota.numero_cuota}` : 'Pago del saldo' }
    : TIPOS_PAGO.find((t) => t.valor === r.tipo_pago_simple);
  const programa = PROGRAMAS.find((p) => p.valor === r.programa);
  const saldo = venta ? saldoVenta(r, contexto) : 0;
  return {
    venta,
    pago,
    secciones,
    avisos: venta ? avisosVenta(r, contexto, hoy) : [],
    numeros: {
      total,
      cobrado,
      saldo,
      antes: pago ? 0 : pagadoAntes(contexto),
      programa: programa ? programa.label : (r.programa || ''),
      tipoPago: tipo ? tipo.label : (r.tipo_pago_simple || ''),
      cuotas: armaPlan(r, contexto) ? cantidadCuotas(r) : 0,
    },
  };
}

// Las claves de pregunta que existen: sirve a los tests para no dejar un paso sin sección.
export const CLAVES_CON_SECCION = Object.keys(SECCION_DE).filter((k) => PREGUNTAS.some((q) => q.clave === k));
