// El árbol de reporte de la llamada, como función pura: sin React, sin `useState`, sin HTTP.
//
// Dado el objeto de respuestas devuelve la pregunta actual, sus opciones, los hitos del stepper
// y qué falta para poder avanzar. El componente (`tabs/TabResultado.jsx`) solo guarda el objeto
// de respuestas y pinta lo que este módulo dice.
//
// El inventario de preguntas y de dónde salió cada rama está en `arbolResultado.preguntas.js`.

import { PREGUNTAS } from './arbolResultado.preguntas';
import { esVenta, esCompleto, quedaSaldo } from './arbolResultado.venta';

export * from './arbolResultado.preguntas';
export * from './arbolResultado.venta';
export { construirPayload, notaFinal, fechaHoraAIso } from './arbolResultado.payload';

// Clave interna donde se anotan los pasos de formulario ya confirmados. Los pasos de opciones no
// la necesitan: se consideran contestados cuando su campo tiene valor.
const PASOS = '_pasos';
// Lo que tenía una pregunta de opciones antes de que «Corregir» la reabriera: si se vuelve a
// elegir lo mismo, el resto del camino sigue valiendo y no hay que contestarlo de nuevo.
const ANTES = '_antes';

export const estadoInicial = () => ({ [PASOS]: [] });
export const reiniciar = () => estadoInicial();

const indiceDe = (clave) => PREGUNTAS.findIndex((q) => q.clave === clave);
const resolver = (valor, r, c) => (typeof valor === 'function' ? valor(r, c) : valor);

/** Opciones y campos de una pregunta, ya resueltos (pueden ser funciones de las respuestas). */
export function normalizar(pregunta, respuestas, contexto = {}) {
  if (!pregunta) return null;
  return {
    ...pregunta,
    opciones: resolver(pregunta.opciones, respuestas, contexto) || [],
    campos: resolver(pregunta.campos, respuestas, contexto) || [],
    enunciado: resolver(pregunta.enunciado, respuestas, contexto),
    ayuda: resolver(pregunta.ayuda, respuestas, contexto) || null,
  };
}

const contestada = (q, r) => (q.tipo === 'formulario'
  ? (r[PASOS] || []).includes(q.clave)
  : r[q.campo] !== undefined && r[q.campo] !== null);

const aplicable = (q, r, c) => (typeof q.cuando === 'function' ? !!q.cuando(r, c) : true);

/** Las preguntas que el camino recorrido vuelve aplicables, en orden. */
export function caminoActivo(respuestas = {}, contexto = {}) {
  return PREGUNTAS.filter((q) => aplicable(q, respuestas, contexto));
}

/** La pregunta que toca contestar, o `null` si el árbol está completo. */
export function preguntaActual(respuestas = {}, contexto = {}) {
  const pendiente = caminoActivo(respuestas, contexto).find((q) => !contestada(q, respuestas));
  return normalizar(pendiente, respuestas, contexto);
}

/** ¿Ya se eligió la primera opción? Antes de eso se muestran las 4 tarjetas grandes. */
export const arrancado = (respuestas = {}) => respuestas.res !== undefined
  || respuestas.contacto_result !== undefined || respuestas.venta_directa === true;

/**
 * Entra directo a la venta, sin reportar la llamada: una renovación, un upsell, una cuota o una
 * venta cerrada por fuera. Es lo que hacía «Registrar venta / pago» del historial del cliente, que
 * abría el wizard aparte; acá es la misma rama de venta del árbol, dentro de la ficha.
 */
export const ventaDirecta = (respuestas = {}) => ({ ...respuestas, venta_directa: true });

/** El árbol está completo cuando arrancó y no queda ninguna pregunta aplicable sin contestar. */
export const completo = (respuestas = {}, contexto = {}) => arrancado(respuestas)
  && preguntaActual(respuestas, contexto) === null;

// --- validación ---------------------------------------------------------------------------

const vacio = (v) => v === undefined || v === null || v === ''
  || (Array.isArray(v) && v.length === 0);

function faltaDelCampo(campo, respuestas) {
  const valor = respuestas[campo.campo];
  if (campo.minimoTexto) {
    const largo = String(valor || '').trim().length;
    if (largo < campo.minimoTexto) {
      return campo.falta
        || `${campo.label} (mínimo ${campo.minimoTexto} caracteres, llevás ${largo})`;
    }
    return null;
  }
  if (campo.tipo === 'monto') {
    const n = parseFloat(valor);
    const minimo = campo.minimo ?? 0;
    if (Number.isNaN(n) || n < minimo) return campo.falta || `Cargá ${campo.label}`;
    return null;
  }
  if (vacio(valor)) return campo.falta || `Completá ${campo.label}`;
  return null;
}

/**
 * Qué falta para poder confirmar el paso actual, en palabras. La lista es la fuente de verdad:
 * `puedeAvanzar` se deriva de ella y no al revés, para que el closer nunca vea un botón gris sin
 * saber por qué (misma decisión que el `faltantes[]` de CloserWorkflowPage 3134-3145).
 */
export function faltantes(respuestas = {}, contexto = {}) {
  const q = preguntaActual(respuestas, contexto);
  if (!q) return [];
  if (q.tipo !== 'formulario') return ['Elegí una de las opciones'];
  const lista = q.campos
    .filter((campo) => campo.requerido)
    .map((campo) => faltaDelCampo(campo, respuestas))
    .filter(Boolean);
  const extra = typeof q.validar === 'function' ? q.validar(respuestas, contexto) || [] : [];
  return [...lista, ...extra];
}

export const puedeAvanzar = (respuestas = {}, contexto = {}) => faltantes(respuestas, contexto).length === 0;

// --- transiciones ------------------------------------------------------------------------

/**
 * Contesta un paso: mezcla los valores y lo marca como hecho.
 *
 * Una pregunta de opciones que CAMBIA de respuesta borra lo que quedaba aguas abajo, antes de
 * mezclar: la rama vieja no puede quedar colgada (cambiar «Asistió» por «Canceló» dejaba el
 * decisor puesto). Si la respuesta es la misma que tenía —el closer tocó «Corregir» y eligió lo
 * mismo— o el paso es un formulario, el resto del camino sigue valiendo: es el «Guardar y volver»
 * del wizard de venta, que corregía un dato sin obligar a rehacer los veinte pasos que siguen.
 * Lo que un dato corregido vuelve aplicable (más saldo → cronograma) se pregunta igual, porque
 * `preguntaActual` busca el primer paso aplicable sin contestar.
 */
export function responder(respuestas = {}, clave, valores = {}) {
  const idx = indiceDe(clave);
  if (idx < 0) return respuestas;
  const q = PREGUNTAS[idx];
  const { [ANTES]: antes = {}, ...limpio } = respuestas;
  const previo = q.tipo === 'formulario' ? undefined
    : (Object.prototype.hasOwnProperty.call(antes, q.campo) ? antes[q.campo] : respuestas[q.campo]);
  const cambiaLaRama = q.tipo !== 'formulario' && previo !== undefined && previo !== null
    && previo !== valores[q.campo];

  let pasos = respuestas[PASOS] || [];
  if (cambiaLaRama) {
    pasos = pasos.filter((p) => {
      const i = indiceDe(p);
      return i >= 0 && i <= idx;
    });
    PREGUNTAS.slice(idx + 1).forEach((siguiente) => {
      // Solo se limpian los campos de las preguntas de opciones: son de una sola pregunta cada
      // una. Los campos de formulario se comparten a propósito entre pasos (hoy `notes` es el
      // mismo textarea en «qué pasó» y en «ángulo del seguimiento»).
      if (siguiente.tipo !== 'formulario') delete limpio[siguiente.campo];
    });
  }
  const restantes = Object.fromEntries(Object.entries(antes).filter(([k]) => k !== q.campo));
  return {
    ...limpio,
    ...valores,
    ...(Object.keys(restantes).length && !cambiaLaRama ? { [ANTES]: restantes } : {}),
    [PASOS]: [...new Set([...pasos, clave])],
  };
}

/** Edición de campos sin confirmar el paso (lo que se tipea mientras el formulario está abierto). */
export const actualizar = (respuestas = {}, parche = {}) => ({ ...respuestas, ...parche });

/** Vuelve atrás: desmarca el paso y deja la pregunta lista para contestarse de nuevo. */
export function volverA(respuestas = {}, clave) {
  const idx = indiceDe(clave);
  if (idx < 0) return respuestas;
  const q = PREGUNTAS[idx];
  const limpio = { ...respuestas, [PASOS]: (respuestas[PASOS] || []).filter((p) => p !== clave) };
  if (q.tipo !== 'formulario') {
    // Se recuerda lo que tenía para saber, al contestar, si el closer cambió de rama o no.
    if (respuestas[q.campo] !== undefined) {
      limpio[ANTES] = { ...(respuestas[ANTES] || {}), [q.campo]: respuestas[q.campo] };
    }
    delete limpio[q.campo];
  }
  return limpio;
}

// --- hitos del stepper -------------------------------------------------------------------

const ETIQUETA_RES = {
  asistio: 'Asistió', no_asistio: 'No asistió', cancelo: 'Canceló', reagenda: 'Reagenda',
};

/**
 * Los 5 hitos del mockup con su subtítulo en vivo. `estado` ∈ hecho | alerta | pendiente, el
 * contrato de `<StepperFicha>`: alcanzado va en verde, alcanzado-pero-malo en ámbar, el resto gris.
 */
export function hitos(respuestas = {}, contexto = {}) {
  const r = respuestas;
  const conDecisor = r.with_decision_maker === undefined || r.with_decision_maker === null
    ? '' : (r.with_decision_maker ? ' · con decisor' : ' · sin decisor');
  const cerro = r.cierre === undefined || r.cierre === null
    ? (r.contacto_result === 'cerro' || r.venta_directa === true ? true : null) : r.cierre;

  // La deuda y el upsell no se preguntan aparte: salen del tipo de pago (Renovación y Upsell son
  // su propio hito) y de los montos. Se sabe si queda deuda cuando es un pago completo o cuando
  // ya se cargaron el precio y lo cobrado.
  const tipo = esVenta(r) ? r.tipo_pago_simple : undefined;
  const deudaSabida = !!tipo && (esCompleto(r) || (r[PASOS] || []).includes('venta_montos'));
  const deuda = deudaSabida ? quedaSaldo(r, contexto) : null;
  const up = !tipo ? null : ({ Renovacion: 'Renovación', Upsell: 'Upsell' }[tipo] || 'none');

  // En la cadencia de seguimiento la llamada ya se reportó: el hito «Resultado» muestra en qué
  // intento va, no «Sin reportar».
  const enCadencia = contexto.modo === 'seguimiento' || !!r.contacto_result;
  const subResultado = () => {
    if (r.venta_directa === true) return 'Venta directa';
    if (enCadencia) return `Seguimiento ${contexto.intento || 1} de 4`;
    if (!r.res) return 'Sin reportar';
    return `${ETIQUETA_RES[r.res] || r.res}${conDecisor}`;
  };
  const subCierre = () => {
    if (cerro === null) return r.offer_presented === false ? 'Sin oferta' : 'Pendiente';
    return cerro ? 'Venta cerrada' : 'No cerró';
  };
  const subUpsell = () => {
    if (up === null) return 'Renovación o upsell';
    return up === 'none' ? 'Ninguno' : up;
  };

  const definicion = [
    { clave: 'confirmado', label: 'Confirmado', sub: 'Agenda confirmada', alcanzado: true, malo: false },
    { clave: 'resultado', label: 'Resultado', sub: subResultado(), alcanzado: arrancado(r) || enCadencia, malo: (!!r.res && r.res !== 'asistio') || contexto.seguimientoTipo === 'no_tomada' },
    // «Sin oferta» cuenta como hito alcanzado-pero-malo: es un desenlace definitivo de la
    // llamada, no un paso que todavía falte dar (el mockup lo dejaba en gris).
    { clave: 'cierre', label: 'Cierre', sub: subCierre(), alcanzado: cerro !== null || r.offer_presented === false, malo: cerro === false || r.offer_presented === false },
    { clave: 'deuda', label: 'Deuda', sub: deuda === null ? 'Pendiente' : (deuda ? 'Con deuda' : 'Sin deuda'), alcanzado: deuda !== null, malo: deuda === true },
    { clave: 'upsell', label: 'Upsell', sub: subUpsell(), alcanzado: !!up && up !== 'none', malo: false },
  ];

  return definicion.map((h) => ({
    clave: h.clave,
    label: h.label,
    sub: h.sub,
    estado: h.alcanzado ? (h.malo ? 'alerta' : 'hecho') : 'pendiente',
  }));
}

// --- resumen para la pantalla de revisión ------------------------------------------------

const etiquetaOpcion = (q, valor) => {
  const encontrada = (q.opciones || []).find((o) => o.valor === valor);
  return encontrada ? encontrada.label : String(valor);
};

/**
 * Todo lo recolectado, en filas `rótulo / valor`, para que el closer lo revise antes de guardar.
 * Solo se listan los pasos efectivamente contestados: el resumen es la prueba de que nada quedó
 * a medias.
 */
export function resumen(respuestas = {}, contexto = {}) {
  const filas = [];
  caminoActivo(respuestas, contexto).forEach((cruda) => {
    if (!contestada(cruda, respuestas)) return;
    const q = normalizar(cruda, respuestas, contexto);
    if (q.tipo !== 'formulario') {
      filas.push({ clave: q.clave, label: q.enunciado, valor: etiquetaOpcion(q, respuestas[q.campo]) });
      return;
    }
    q.campos.forEach((campo) => {
      const crudo = respuestas[campo.campo];
      // `resumir` es para lo que en crudo no se lee (un id de cuota, un mapa de montos): el
      // campo dice cómo contarse. Puede devolver null para no ocupar una fila.
      if (campo.enResumen === false || (vacio(crudo) && !campo.resumir)) return;
      let valor;
      if (campo.resumir) valor = campo.resumir(crudo, respuestas, contexto);
      else if (campo.etiquetas && campo.etiquetas[String(crudo)]) valor = campo.etiquetas[String(crudo)];
      else valor = formatoValor(crudo);
      if (valor === null || valor === undefined || valor === '') return;
      filas.push({ clave: `${q.clave}.${campo.campo}`, paso: q.clave, label: campo.label, valor });
    });
  });
  return filas;
}

function formatoValor(valor) {
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (Array.isArray(valor)) {
    return valor.map((v) => (typeof v === 'object' && v !== null
      ? Object.values(v).filter(Boolean).join(' · ') : String(v))).filter(Boolean).join(', ');
  }
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).map(([k, v]) => `${k}: ${v}`).join(' · ');
  }
  return String(valor);
}

/** ¿Quedó deuda? Decide si al guardar el modal ofrece seguir en la pestaña «Acciones». */
export const quedaDeuda = (respuestas = {}, contexto = {}) => esVenta(respuestas)
  && !esCompleto(respuestas) && quedaSaldo(respuestas, contexto);

// Desde dónde cuenta el progreso de la venta: la primera pregunta de su rama.
const PRIMERA_DE_LA_VENTA = 'venta_nombre';

/**
 * «Paso 3 de 17» de la venta, como el contador del wizard. El total cambia mientras se contesta
 * (si queda saldo aparece el cronograma): se cuenta el camino que HOY es aplicable.
 */
export function progresoVenta(respuestas = {}, contexto = {}) {
  if (!esVenta(respuestas)) return null;
  const camino = caminoActivo(respuestas, contexto);
  const desde = camino.findIndex((q) => q.clave === PRIMERA_DE_LA_VENTA);
  if (desde < 0) return null;
  const tramo = camino.slice(desde);
  const actual = preguntaActual(respuestas, contexto);
  if (!actual) return { paso: tramo.length, total: tramo.length, listo: true };
  const paso = tramo.findIndex((q) => q.clave === actual.clave);
  if (paso < 0) return null;
  return { paso: paso + 1, total: tramo.length, listo: false };
}
