// Pestaña «Resultado»: el closer reporta qué pasó con la llamada y, si hubo venta, la declara.
//
// Todo el recorrido lo decide `arbolResultado.js` (función pura). Este componente solo guarda el
// objeto de respuestas y pinta lo que el árbol dice que toca: el stepper de hitos, las 4 tarjetas
// grandes mientras no hay resultado, una pregunta por pantalla, y al final la revisión.
// La escritura va SIEMPRE por `onAccion` y la lectura por `onConsultar`: esta pestaña nunca llama
// fetch/axios.
//
// La venta va dentro de la ficha y no en un modal encima, en dos caminos (ADR-W013): la venta
// nueva (sus datos con el correo del acceso, qué compró, cómo paga, la plata, el plan y los
// referidos) y el pago de algo que ya compró (qué paga y cuánto). Todo se registra en un solo guardado.
//
// Los botones son los de la ficha (`.btn`) y no los `.ln-btn` del design system: dentro de
// `.dc-shell` una clase sola del DS pierde contra `.dc-shell button{background:none;border:0;
// padding:0}` y el botón queda como texto suelto en mayúsculas (ver `PlanCuotasForm`).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Check, CheckCircle2, XCircle, CalendarX, CalendarClock, RotateCcw, AlertTriangle, ArrowLeft, X,
  ArrowRight, History, DollarSign, Pencil, UserCheck, UserX, Eye, EyeOff, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { StepperFicha, TarjetaAccion } from '../acciones/piezas';
import CampoArbol from '../acciones/CampoArbol';
import CronogramaCuotas from '../acciones/CronogramaCuotas';
import { moneda } from '../acciones/planCuotas';
import GrabacionFathom from './GrabacionFathom';
import PasarARecuperacion from './PasarARecuperacion';
import PasoSeguimiento from './PasoSeguimiento';
import { useChequeoVenta } from './useChequeoVenta';
import './resultado.css';
import {
  estadoInicial, responder, actualizar, volverA, preguntaActual, faltantes,
  puedeAvanzar, completo, arrancado, hitos, resumen, esVenta, quedaDeuda, construirPayload,
  progresoVenta, saldoVenta, armaPlan, cuotasPendientes, fechasCuotas, montosCuotas, esCompleto,
  ventaDirecta, anterior, elegida, fechaCorta, RAICES, revisionVenta, normalizar, PREGUNTAS, faltantesDe,
  faltaDelCampo,
} from '../arbolResultado';

// Cascada de entrada: las respuestas no aparecen todas de golpe, entran de arriba a abajo. El
// retardo es corto a proposito (30 ms): el closer reporta llamadas todo el dia y una animacion
// que se note dos veces ya molesta. Con `prefers-reduced-motion` no hay ni desplazamiento ni
// retardo, solo el cambio de opacidad que el navegador ya no anima.
const CASCADA = {
  contenedor: (reducido) => ({
    initial: 'oculto',
    animate: 'visible',
    variants: { visible: { transition: { staggerChildren: reducido ? 0 : 0.03 } } },
  }),
  hijo: (reducido) => ({
    variants: reducido
      ? { oculto: { opacity: 1 }, visible: { opacity: 1 } }
      : { oculto: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } },
    transition: { duration: 0.16, ease: 'easeOut' },
  }),
};

const ICONOS = {
  asistio: CheckCircle2, no_asistio: XCircle, cancelo: CalendarX, reagenda: CalendarClock,
};
// Los colores del aura de Learnation (el mismo conic de Clarity), no el semáforo verde/rojo/ámbar/azul.
const COLORES = {
  asistio: '#2EE6C8', no_asistio: '#FF3FA4', cancelo: '#FFB547', reagenda: '#7D8BFF',
};

const enDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const hoyIso = () => enDias(0);

// Los datos que ya sabemos no se vuelven a pedir: vienen precargados y el closer los confirma.
// Ojo: acá NO se precargan los campos de las preguntas de opciones (programa, medio de pago,
// estado, si es mensual…), porque un campo con valor cuenta como contestado y la pregunta se
// saltearía sin que el closer la haya visto.
// Los correos que inventa NeurOPS cuando un lead llega sin ninguno (`no-email-…@neurops.com`,
// `…@neurops.temp`). No son del cliente: precargados, pasaban como confirmados a la venta y al
// acceso de la Academia, que le daba el usuario a una casilla que no existe.
const esCorreoInventado = (email) => /no[-_]email[-_]|@neurops\.(com|temp)$/i
  .test(String(email || '').trim());

function precargar(ficha) {
  const id = ficha?.identidad || {};
  return {
    ...estadoInicial(),
    nombre_cliente: id.nombre || '',
    instagram: (id.instagram || '').replace(/@/g, ''),
    mail_cliente: esCorreoInventado(id.email) ? '' : (id.email || ''),
    telefono: id.telefono || '',
    // El respaldo cuando no hay lista de closers para elegir: la venta va al closer de la agenda.
    email_vendedor: id.closer?.email || '',
    setter: id.setter?.nombre || '',
    examen_lead: id.examen || '',
    // Lo que casi siempre es igual viene puesto y se cambia en «Detalles» de la revisión.
    sold_in_call: true,
    estado: 'Completada',
    enviar_webhook: true,
    date: hoyIso(),
    dar_acceso_academia: true,
    ...(id.closer?.id ? { vendedor_id: id.closer.id } : {}),
    num_cuotas: 1,
    installmentMode: 'monthly',
    dia_de_pago: 10,
    modalidad: [],
    refs_rows: [],
  };
}

// De dónde salió un dato que viene precargado: de la agenda tal cual, corregido, o cargado a mano.
function origenDe(campo, respuestas, precarga) {
  if (!campo.precargado) return null;
  const antes = String(precarga[campo.campo] ?? '').trim();
  const ahora = String(respuestas[campo.campo] ?? '').trim();
  if (!antes) return 'vos';
  return antes === ahora ? 'agenda' : 'corregido';
}

/**
 * Cómo viene pagando el cliente el programa que se eligió en la venta.
 *
 * Se pide a `GET /ficha/<id>/estado-venta` cada vez que cambia el programa: de eso salen el
 * resumen «Así viene este cliente», los avisos de los tipos de pago y lo ya pagado que descuenta
 * el saldo. Sin `onConsultar`, o si la consulta falla, se usa el estado que ya trae la ficha
 * cuando es del mismo programa, y si no, se sigue como cliente nuevo: no saber cómo viene pagando
 * no puede impedir declarar la venta.
 */
function useEstadoVenta(ficha, programa, onConsultar) {
  const [leido, setLeido] = useState({ programa: null, estado: null });
  useEffect(() => {
    if (!programa || !onConsultar) return undefined;
    let vivo = true;
    Promise.resolve(onConsultar('estado_venta', { params: { programa } }))
      .then((estado) => { if (vivo) setLeido({ programa, estado: estado || null }); })
      .catch(() => { if (vivo) setLeido({ programa, estado: null }); });
    return () => { vivo = false; };
  }, [programa, onConsultar]);

  const delPrograma = leido.programa === programa;
  const deLaFicha = programa && programa === ficha?.cobro?.programa_code ? ficha?.cobro?.estado_pagos || null : null;
  return {
    estado: (delPrograma && leido.estado) || deLaFicha,
    // Hasta que vuelve la consulta del programa elegido, se está cargando: si no, el árbol
    // pasaría un instante por «¿Cómo paga?» y volvería al resumen cuando llega la respuesta.
    cargando: !!programa && !!onConsultar && !delPrograma,
  };
}

export default function TabResultado({
  ficha, onAccion, onConsultar = null, irA, puedeEditar = true, arrancarEnVenta = false,
  seguimientoPedido = null,
}) {
  const reducido = useReducedMotion();
  const precarga = useMemo(() => precargar(ficha), []); // eslint-disable-line react-hooks/exhaustive-deps
  // «Declarar venta» del dock abre la ficha para vender: se entra derecho a la venta directa, sin
  // pasar por las cuatro tarjetas de la llamada («Anterior» vuelve a ellas). «Registrar pago» de
  // Acciones (`'pago'`) entra ya en el camino del pago.
  const [respuestas, setRespuestas] = useState(() => {
    if (arrancarEnVenta === 'pago') {
      return responder(ventaDirecta(precarga), 'que_registra', {
        registro: 'pago', sold_in_call: false, tipo_pago_simple: 'Cuota',
        ...(ficha?.cobro?.programa_code ? { programa: ficha.cobro.programa_code } : {}),
      });
    }
    return arrancarEnVenta ? ventaDirecta(precarga) : precarga;
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  // Lo que quedó guardado. Mientras existe, la pestaña muestra la confirmación y no la revisión:
  // con la revisión a la vista, un segundo clic en «Registrar la venta» la declaraba dos veces.
  const [hecho, setHecho] = useState(null);

  const programa = esVenta(respuestas) ? respuestas.programa : null;
  const venta = useEstadoVenta(ficha, programa, onConsultar);

  const contexto = useMemo(() => {
    const res = ficha?.resultado || {};
    // Qué se reporta: la llamada (las cuatro tarjetas), la cadencia de seguimiento de un lead que
    // no compró, o el seguimiento de cobro de un cliente. El mazo sabe desde qué columna se abrió
    // la ficha (`seguimientoPedido`) y eso gana; si no, lo dice el seguimiento vivo de la agenda.
    const cobro = seguimientoPedido === 'cobro'
      || (!seguimientoPedido && res.seguimiento_activo && res.seguimiento_tipo === 'cerrada');
    return {
      modo: cobro ? 'cobro' : (seguimientoPedido || res.seguimiento_activo ? 'seguimiento' : 'llamada'),
      intento: res.seguimiento_intento || 1,
      seguimientoTipo: res.seguimiento_tipo || null,
      appointmentId: ficha?.identidad?.appointment_id ?? null,
      clientId: ficha?.identidad?.client_id ?? null,
      personUuid: ficha?.identidad?.person_uuid ?? null,
      estadoVenta: venta.estado,
      cargandoVenta: venta.cargando,
      closers: ficha?.vocabulario?.closers || [],
      // A quién se le puede haber hecho una transferencia (Pedro, Jean Carlo, Otro).
      transferidoA: ficha?.vocabulario?.transferido_a || [],
      closerAgenda: ficha?.identidad?.closer || null,
      cuotas: ficha?.cobro?.cuotas || [],
      // El programa que ya compró: es el que paga quien registra un pago.
      programaCliente: ficha?.cobro?.programa_code || null,
    };
  }, [ficha, venta.estado, venta.cargando, seguimientoPedido]);

  // El precio del programa se propone solo, como en el wizard, sin pisar lo que el closer ya
  // escribió. Si cambia de programa, se cambia la propuesta, no un número tipeado a mano. Y si el
  // cliente ya venía pagando, «cobrado hoy» arranca en lo que le falta.
  const sugerido = useRef('');
  useEffect(() => {
    const estado = venta.estado;
    if (!estado) return;
    setRespuestas((prev) => {
      const parche = {};
      const precio = estado.program_price ? String(estado.program_price) : '';
      if (precio && (!prev.precio_total || prev.precio_total === sugerido.current)) parche.precio_total = precio;
      sugerido.current = precio;
      if (estado.total_paid > 0 && estado.balance_remaining > 0 && !prev.monto) {
        parche.monto = String(estado.balance_remaining);
      }
      return Object.keys(parche).length ? actualizar(prev, parche) : prev;
    });
  }, [venta.estado]);

  const pregunta = preguntaActual(respuestas, contexto);
  const listo = completo(respuestas, contexto);
  const pendientes = faltantes(respuestas, contexto);
  const pasos = hitos(respuestas, contexto).map((h) => ({ key: h.clave, label: h.label, sub: h.sub, estado: h.estado }));
  const progreso = progresoVenta(respuestas, contexto);

  const cambiar = useCallback((parche) => setRespuestas((prev) => actualizar(prev, parche)), []);
  const elegir = useCallback((clave, valores) => {
    setError(null);
    setRespuestas((prev) => responder(prev, clave, valores));
  }, []);
  // «Anterior» reabre la pregunta de antes con lo que tenía puesto: si se vuelve a contestar
  // igual, el resto del camino sigue contestado (no hay que rehacer los pasos que venían).
  const volver = anterior(respuestas, contexto) ? () => {
    setError(null);
    setRespuestas((prev) => anterior(prev, contexto) ?? prev);
  } : null;

  // Se anima la ENTRADA de cada pantalla, sin `AnimatePresence`: con salida en `mode="wait"` la
  // pregunta siguiente no monta hasta que termina la anterior, y una pregunta que tarda en
  // aparecer se siente peor que una que entra sola.
  const animar = reducido
    ? {}
    : { initial: { opacity: 0, x: 18 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.18, ease: 'easeOut' } };

  const empezarDeNuevo = () => {
    setError(null);
    setHecho(null);
    sugerido.current = '';
    setRespuestas(precargar(ficha));
  };

  const guardar = async () => {
    const { accion, datos } = construirPayload(respuestas, contexto);
    const fueVenta = esVenta(respuestas);
    const conDeuda = quedaDeuda(respuestas, contexto);
    setGuardando(true);
    setError(null);
    try {
      // `onAccion` ya recarga la ficha y deja el aviso de éxito en el cascarón: recargar acá
      // también era pedir la ficha dos veces por cada guardado.
      const respuesta = await onAccion(accion, datos);
      // La venta se guarda igual aunque el historial de pagos previo tenga una inconsistencia
      // (SheetsService avisa pero no bloquea), y un paso posterior a la venta (el plan, el acceso)
      // puede fallar sin deshacerla. Los dos avisos tienen que llegar al closer: si no, se queda
      // sin saber que hay algo para revisar.
      const avisos = [respuesta?.warning, ...(respuesta?.avisos || [])].filter(Boolean);
      setHecho({
        venta: fueVenta, conDeuda, saldo: fueVenta ? saldoVenta(respuestas, contexto) : 0, avisos,
        seguimiento: cierreDelSeguimiento(respuestas, contexto),
      });
      // Si quedó saldo y no hay nada que leer acá, el trabajo sigue en «Acciones».
      if (conDeuda && !avisos.length) irA?.('acciones');
    } catch (e) {
      setError(e?.response?.data?.message || e?.response?.data?.error || e?.message || 'No se pudo guardar el resultado');
    } finally {
      setGuardando(false);
    }
  };

  if (!puedeEditar || ficha?.permisos?.reportar === false) {
    return (
      <div className="ln-panel ln-panel--sm">
        <StepperFicha pasos={pasos} onPaso={null} />
        <p className="ln-t-body-sm ln-muted" style={{ marginTop: 'var(--space-4)' }}>
          Tu rol puede ver el resultado de esta llamada pero no reportarlo.
        </p>
      </div>
    );
  }

  // El link de la grabación se guarda aparte del reporte (llega cuando Fathom la procesa, muchas
  // veces con la llamada ya reportada) y se pide al final: en la revisión, después de guardar o
  // abajo de las tarjetas, nunca arriba de la pregunta que se está contestando.
  const grabacion = <GrabacionFathom ficha={ficha} onAccion={onAccion} />;

  return (
    <div className="fi-res">
    <aside className="fi-res-hitos" aria-label="Progreso del reporte">
      <small className="fi-res-hitos-tit">Progreso</small>
      <StepperFicha pasos={pasos} onPaso={null} vertical />
    </aside>
    <div className="fi-res-main">
      {error && (
        <div className="ln-alert ln-alert--error" role="alert">
          <span className="ln-alert-ico"><AlertTriangle /></span>
          <span className="ln-alert-body"><span className="ln-alert-title">{error}</span></span>
        </div>
      )}

      {progreso && !hecho && <ProgresoVenta progreso={progreso} reducido={reducido} />}

        {/* Las 4 tarjetas grandes son la entrada al reporte de la LLAMADA. En un seguimiento la
            llamada ya se reportó: ahí se entra derecho por «¿qué pasó con este contacto?» (o «con
            el cobro»), que es la pregunta que el árbol pone primera en esos modos. */}
        {hecho ? (
          <motion.section key="hecho" {...animar} aria-label="Guardado">
            <Hecho hecho={hecho} irA={irA} onAvisoCerrado={() => setHecho((h) => ({ ...h, avisos: [] }))} />
            {grabacion}
          </motion.section>
        ) : !arrancado(respuestas) && contexto.modo === 'llamada' ? (
          <motion.section key="raices" {...animar} aria-label="¿Qué pasó con esta llamada?">
            <h3 className="ln-t-h3">¿Qué pasó con esta llamada?</h3>
            <div className="ln-grid ln-grid-4 fi-raices" style={{ marginTop: 'var(--space-4)' }}>
              {RAICES.map((o) => (
                <TarjetaAccion
                  key={o.valor}
                  tono={o.tono}
                  color={COLORES[o.valor]}
                  icono={ICONOS[o.valor]}
                  label={o.label}
                  onClick={() => elegir('res', { res: o.valor })}
                />
              ))}
            </div>
            {/* La venta que no sale de reportar ESTA llamada (renovación, upsell, cuota, venta por
                fuera) y la llamada que no se tomó: dos botones compactos, sin bloques de texto. */}
            <PasarARecuperacion
              llamadaIso={ficha?.identidad?.llamada?.iso}
              onAccion={onAccion}
              antes={(
                <motion.button
                  type="button"
                  className="fi-otra"
                  data-tip="Registrar una venta|Una venta nueva (renovación, upsell, cerrada por fuera) o el pago de algo que ya compró"
                  whileTap={reducido ? undefined : { scale: 0.97 }}
                  onClick={() => { setError(null); setRespuestas((prev) => ventaDirecta(prev)); }}
                >
                  <DollarSign aria-hidden="true" /> Registrar una venta
                </motion.button>
              )}
            />
            {grabacion}
          </motion.section>
        ) : listo ? (
          <motion.section key="revision" {...animar} aria-label="Revisión del resultado">
            <Revision
              reducido={reducido}
              respuestas={respuestas}
              contexto={contexto}
              guardando={guardando}
              onGuardar={guardar}
              onCambiar={cambiar}
              onElegir={elegir}
              precarga={precarga}
              onVolverA={(clave) => setRespuestas((prev) => volverA(prev, clave))}
              onAnterior={volver}
              onReiniciar={empezarDeNuevo}
              grabacion={grabacion}
            />
          </motion.section>
        ) : (
          <motion.section key={pregunta.clave} {...animar} aria-live="polite">
            {contexto.modo === 'cobro' && pregunta.clave === 'contacto_result' && (
              <ResumenCobro
                cobro={ficha?.cobro}
                onPagoDeCuota={(cuota) => elegir('contacto_result', pagoDeCuota(cuota, ficha))}
              />
            )}
            <Pregunta
              reducido={reducido}
              pregunta={pregunta}
              respuestas={respuestas}
              precarga={precarga}
              contexto={contexto}
              pendientes={pendientes}
              puede={puedeAvanzar(respuestas, contexto)}
              onElegir={elegir}
              onCambiar={cambiar}
              onAnterior={volver}
              onReiniciar={empezarDeNuevo}
              irA={irA}
            />
          </motion.section>
        )}

    </div>
    </div>
  );
}

// --- progreso de la venta -------------------------------------------------------------------

// «Paso 4 de 18», como el contador del wizard: la venta son muchas pantallas y el closer tiene
// que saber cuánto le falta. La barra se estira sola, sin saltar, cuando el total cambia (quedó
// saldo y aparece el cronograma).
function ProgresoVenta({ progreso, reducido }) {
  const pct = Math.round((progreso.listo ? 1 : (progreso.paso - 1) / progreso.total) * 100);
  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      <small className="ln-t-eyebrow" style={{ color: 'var(--text-muted)' }}>
        {progreso.listo ? 'Venta · revisión' : `Venta · paso ${progreso.paso} de ${progreso.total}`}
      </small>
      <div
        role="progressbar"
        aria-label="Avance de la venta"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        style={{ height: 3, borderRadius: 999, background: 'var(--border-subtle)', overflow: 'hidden' }}
      >
        <motion.div
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={reducido ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
          style={{ height: '100%', background: 'var(--brand-secondary)' }}
        />
      </div>
    </div>
  );
}

// --- una pregunta por pantalla -------------------------------------------------------------

const TIPOS_DE_TEXTO = new Set(['texto', 'email', 'tel', 'monto', 'entero']);

// El campo que se pinta dentro de otro (`junto`: la hora del aviso dentro de su casilla).
const parejaDe = (pregunta, campo) => pregunta.campos.find((c) => c.junto === campo.campo) || null;

function Pregunta({
  pregunta, respuestas, precarga, contexto, pendientes, puede, onElegir, onCambiar, onAnterior, irA,
  reducido, onReiniciar = null,
}) {
  if (pregunta.tipo !== 'formulario') {
    const columnas = pregunta.opciones.length > 2 ? 3 : 2;
    const conAviso = pregunta.opciones.some((o) => o.aviso);
    return (
      <>
        <h3 className="ln-t-h3">{pregunta.enunciado}</h3>
        {pregunta.ayuda && <p className="ln-t-body-sm ln-muted">{pregunta.ayuda}</p>}
        <motion.div
          role="group"
          {...CASCADA.contenedor(reducido)}
          style={{
            display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-4)',
            gridTemplateColumns: `repeat(auto-fit, minmax(${columnas === 3 ? 180 : 220}px, 1fr))`,
          }}
        >
          {pregunta.opciones.map((o) => (
            <OpcionGrande
              key={String(o.valor)}
              opcion={o}
              clave={pregunta.clave}
              reducido={reducido}
              activa={elegida(respuestas, pregunta.campo) === o.valor}
              onClick={() => onElegir(pregunta.clave, valoresDeOpcion(pregunta, o, contexto, respuestas))}
            />
          ))}
        </motion.div>
        {/* Avisa, no bloquea: si el historial del cliente está mal cargado, la venta real se
            declara igual y el dato viejo se corrige donde vive, en el historial. */}
        {conAviso && (
          <div className="ln-alert ln-alert--warning" role="note" style={{ marginTop: 'var(--space-4)' }}>
            <span className="ln-alert-ico"><AlertTriangle /></span>
            <span className="ln-alert-body">
              <span className="ln-alert-title">Algunos tipos no siguen el historial de pagos de este cliente</span>
              <span className="ln-alert-desc">
                Podés declararlo igual. Si es un dato viejo mal cargado, corregilo en el historial.
              </span>
            </span>
            {irA && (
              <button type="button" className="btn btn--linea btn--sm" onClick={() => irA('hist')}>
                <History /> Ver historial
              </button>
            )}
          </div>
        )}
        {(onAnterior || onReiniciar) && (
          <div className="fi-botonera" style={{ marginTop: 'var(--space-6)', justifyContent: 'flex-start' }}>
            <BotonesAtras onAnterior={onAnterior} onReiniciar={onReiniciar} reducido={reducido} />
          </div>
        )}
      </>
    );
  }

  const avanzar = () => { if (puede) onElegir(pregunta.clave, {}); };
  if (pregunta.vista === 'seguimiento') {
    return (
      <PasoSeguimiento respuestas={respuestas} onCambiar={onCambiar} onContinuar={avanzar} puede={puede}
        onAnterior={onAnterior} onReiniciar={onReiniciar} reducido={reducido} />
    );
  }
  // Lo que ya cuenta su propio campo (el mínimo de un texto, con su barrita) no se repite abajo.
  const enElCampo = new Set(pregunta.campos.filter((c) => c.minimoTexto)
    .map((c) => faltaDelCampo(c, respuestas)).filter(Boolean));
  const primeroDeTexto = pregunta.campos.find((c) => TIPOS_DE_TEXTO.has(c.tipo || 'texto'));
  const conPareja = pregunta.campos.some((c) => c.junto);

  return (
    <>
      <h3 className="ln-t-h3">{pregunta.enunciado}</h3>
      {pregunta.ayuda && <p className="ln-t-body-sm ln-muted">{pregunta.ayuda}</p>}
      {/* Con un campo `junto` (la hora dentro de su aviso) la grilla es de a dos: lo corto lado a
          lado y el párrafo a todo el ancho, debajo (`.fi-form-par`). */}
      <div
        className={conPareja ? 'fi-form-par' : undefined}
        style={{
          display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-4)',
          ...(conPareja ? {} : {
            gridTemplateColumns: pregunta.campos.length > 3 ? 'repeat(auto-fit, minmax(240px, 1fr))' : '1fr',
          }),
        }}
      >
        {pregunta.campos.map((campo) => {
          if (campo.junto) return null; // lo pinta su pareja
          if (campo.tipo === 'cronograma') {
            return <CronogramaVenta key={campo.campo} respuestas={respuestas} contexto={contexto} onCambiar={onCambiar} />;
          }
          const pieza = (
            <CampoArbol
              key={campo.campo}
              campo={campo}
              respuestas={respuestas}
              onCambio={onCambiar}
              cuotas={campo.tipo === 'cuota' ? cuotasPendientes(respuestas, contexto) : []}
              autoFocus={campo === primeroDeTexto}
              onEnter={TIPOS_DE_TEXTO.has(campo.tipo || 'texto') ? avanzar : null}
              origen={origenDe(campo, respuestas, precarga)}
              pareja={parejaDe(pregunta, campo)}
            />
          );
          // El correo del acceso: con él se crea la suscripción, así que se ve distinto al resto.
          return campo.destacado ? (
            <div key={campo.campo} className="fi-acceso">
              {pieza}
              <small className="ln-t-body-sm">{campo.destacado}</small>
            </div>
          ) : pieza;
        })}
      </div>

      {pregunta.clave === 'venta_montos' && !esCompleto(respuestas) && (
        <SaldoEnVivo saldo={saldoVenta(respuestas, contexto)} reducido={reducido} />
      )}

      <Pendientes lista={pendientes.filter((f) => !enElCampo.has(f))} reducido={reducido} />

      <div className="fi-botonera" style={{ marginTop: 'var(--space-6)' }}>
        <BotonesAtras onAnterior={onAnterior} onReiniciar={onReiniciar} reducido={reducido} />
        <motion.button
          type="button"
          className="btn btn--cta"
          disabled={!puede}
          whileTap={reducido || !puede ? undefined : { scale: 0.97 }}
          onClick={avanzar}
        >
          Continuar <ArrowRight />
        </motion.button>
      </div>
    </>
  );
}

// Lo que falta para seguir, en una línea: un punto que late y cada faltante como un chip que entra
// solo (Mario, 23/10/2026: el bloque grande con título repetía lo que el campo ya decía).
function Pendientes({ lista, reducido }) {
  return (
    <AnimatePresence initial={false}>
      {lista.length > 0 && (
        <motion.div
          className="fi-faltan"
          role="status"
          initial={reducido ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducido ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          <i aria-hidden="true" />
          <span>Falta</span>
          {lista.map((f) => (
            <motion.b key={f} layout={!reducido} initial={reducido ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}>
              {f.replace(/^(Completá|Elegí|Cargá)\s+/i, '')}
            </motion.b>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// A la izquierda de la botonera, como el «Anterior» del wizard de venta: el avance queda a la
// derecha, donde el closer ya tiene la mano. «Empezar de nuevo» va al lado (Mario, 23/10/2026):
// son las dos salidas hacia atrás y se leen juntas.
function BotonesAtras({ onAnterior, onReiniciar, reducido, disabled = false }) {
  if (!onAnterior && !onReiniciar) return null;
  const tap = reducido || disabled ? undefined : { scale: 0.97 };
  return (
    <span className="fi-atras">
      {onAnterior && (
        <motion.button type="button" className="btn btn--linea" disabled={disabled} whileTap={tap} onClick={onAnterior}>
          <ArrowLeft /> Anterior
        </motion.button>
      )}
      {onReiniciar && (
        <motion.button type="button" className="btn btn--linea" disabled={disabled} whileTap={tap} onClick={onReiniciar}>
          <RotateCcw /> Empezar de nuevo
        </motion.button>
      )}
    </span>
  );
}

// Elegir una opción a veces arrastra un valor derivado, para no hacerle una pregunta más al
// closer cuando la respuesta ya se deduce (la fecha sugerida de la cadencia de seguimiento, la
// primera fila vacía de referidos para no arrancar con una lista sin renglones).
function valoresDeOpcion(pregunta, opcion, contexto, respuestas) {
  const base = { [pregunta.campo]: opcion.valor };
  if (pregunta.clave === 'sig_action' && opcion.valor === 'next') {
    base.fecha_seguimiento = enDias([0, 3, 7, 14][Math.min(3, contexto.intento || 1)]);
  }
  // El cobro sigue: como el mazo, el próximo intento se propone a 3 días y con el aviso por
  // WhatsApp prendido. No se pisa lo que el closer ya había puesto.
  if (pregunta.clave === 'contacto_result' && contexto.modo === 'cobro'
    && ['no_resp', 'contesto'].includes(opcion.valor)) {
    if (!respuestas.fecha_seguimiento) base.fecha_seguimiento = enDias(3);
    if (respuestas.followup_reminder_enabled === undefined) base.followup_reminder_enabled = true;
    if (!respuestas.followup_reminder_time) base.followup_reminder_time = '09:00';
  }
  // Un pago (el «Pagó» del cobro o el de la venta directa) es del programa que ya compró, de tipo
  // Cuota, y no se cerró en la llamada.
  if ((pregunta.clave === 'contacto_result' && opcion.valor === 'pago')
    || (pregunta.clave === 'que_registra' && opcion.valor === 'pago')) {
    base.sold_in_call = false;
    base.tipo_pago_simple = 'Cuota';
    if (contexto.programaCliente) base.programa = contexto.programaCliente;
  }
  if (pregunta.clave === 'que_registra' && opcion.valor === 'venta') base.sold_in_call = true;
  // La cuota elegida trae su monto; el pago suelto del saldo se escribe.
  if (pregunta.clave === 'pago_que') {
    base.selectedCuotaId = opcion.cuota ? opcion.cuota.id : null;
    base.monto = opcion.cuota ? String(opcion.cuota.monto ?? '') : '';
  }
  // Un pago completo arranca con el precio del programa como monto cobrado.
  if (pregunta.clave === 'tipo_pago' && opcion.valor === 'completo' && !respuestas.monto
    && contexto.estadoVenta?.program_price) {
    base.monto = String(contexto.estadoVenta.program_price);
  }
  if (pregunta.clave === 'refs_ask' && opcion.valor === 'si' && !(respuestas.refs_rows || []).length) {
    base.refs_rows = [{ nombre: '', contacto: '' }];
  }
  return base;
}

// Íconos de las preguntas de sí/no más frecuentes; el resto de los sí/no lleva pulgar arriba/abajo.
const ICONOS_OPCION = {
  'decisor:true': UserCheck, 'decisor:false': UserX,
  'oferta:true': Eye, 'oferta:false': EyeOff,
};
const iconoDeOpcion = (clave, valor) => ICONOS_OPCION[`${clave}:${valor}`]
  || (valor === true ? ThumbsUp : valor === false ? ThumbsDown : null);

// Las opciones son quietas y neutras (son un formulario: el humo no decora). El humo de
// Learnation aparece apenas al pasar el mouse y entero en la elegida, que es lo vivo
// (`docs/diseno_humo_aura.md`).
function OpcionGrande({ opcion, activa, onClick, reducido, clave }) {
  const Icono = iconoDeOpcion(clave, opcion.valor);
  return (
    <motion.button
      type="button"
      className="fi-op"
      onClick={onClick}
      aria-pressed={activa}
      title={opcion.aviso || undefined}
      {...CASCADA.hijo(reducido)}
      whileHover={reducido ? undefined : { y: -2 }}
      whileTap={reducido ? undefined : { scale: 0.98 }}
      data-aviso={opcion.aviso ? '1' : undefined}
    >
      <span className="fi-humo" aria-hidden="true"><i /><i /><i /></span>
      {Icono && <span className="fi-op-ico"><Icono aria-hidden="true" /></span>}
      <b className="ln-t-body">{opcion.label}</b>
      {opcion.sub && <small className="ln-t-caption ln-muted">{opcion.sub}</small>}
      {opcion.aviso && (
        <small className="ln-t-caption" style={{ color: 'var(--warning)', display: 'flex', gap: 'var(--space-1)' }}>
          <AlertTriangle size={12} aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
          {opcion.aviso}
        </small>
      )}
    </motion.button>
  );
}

// --- seguimiento de cobro ------------------------------------------------------------------

// «Pagó» con la cuota ya elegida: el programa, el tipo Cuota, la cuota y su monto. Esas preguntas
// quedan contestadas (se ven en la revisión y «Anterior» vuelve a ellas); el resto de la venta se
// pregunta igual. Era «Reportar pago» en cada cuota del seguimiento de cobro del mazo.
function pagoDeCuota(cuota, ficha) {
  return {
    contacto_result: 'pago',
    sold_in_call: false,
    programa: cuota.programa_code || ficha?.cobro?.programa_code || undefined,
    tipo_pago_simple: 'Cuota',
    pago_de: cuota.id,
    selectedCuotaId: cuota.id,
    monto: String(cuota.monto ?? ''),
  };
}

const TONO_CUOTA = { pagado: 'var(--success)', vencido: 'var(--error)', pendiente: 'var(--warning)' };
const ESTADO_CUOTA = { pagado: 'Pagada', vencido: 'Vencida', pendiente: 'Pendiente' };

// Lo que el mazo mostraba arriba del seguimiento de un cliente: el programa, lo que debe y el plan
// de cuotas, cada pendiente con su «Pagó esta».
function ResumenCobro({ cobro, onPagoDeCuota }) {
  const deuda = Number(cobro?.deuda) || 0;
  const cuotas = cobro?.cuotas || [];
  return (
    <div className="ln-panel ln-panel--sm" style={{ display: 'grid', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-8)' }}>
        <span style={{ display: 'grid', gap: 'var(--space-1)' }}>
          <small className="ln-t-caption ln-muted">Programa</small>
          <b className="ln-t-body">{cobro?.programa_nombre || 'Sin datos'}</b>
        </span>
        <span style={{ display: 'grid', gap: 'var(--space-1)' }}>
          <small className="ln-t-caption ln-muted">Deuda pendiente</small>
          <b className="ln-t-body ln-mono" style={{ color: deuda > 0.009 ? 'var(--error)' : 'var(--success)' }}>
            {deuda > 0.009 ? moneda(deuda) : 'Al día'}
          </b>
        </span>
      </div>
      {cuotas.length > 0 && (
        <div style={{ display: 'grid', gap: 'var(--space-2)' }} aria-label="Plan de cuotas" role="list">
          <small className="ln-t-eyebrow ln-muted">Plan de cuotas</small>
          {cuotas.map((c) => (
            <div
              key={c.id}
              role="listitem"
              style={{
                display: 'grid', gridTemplateColumns: 'minmax(70px, auto) 1fr auto minmax(96px, auto)',
                gap: 'var(--space-3)', alignItems: 'center',
              }}
            >
              <b className="ln-t-body-sm">{`Cuota ${c.numero_cuota}`}</b>
              <small className="ln-t-caption ln-muted">
                {`vence ${fechaCorta(c.fecha_vencimiento)} · `}
                <span style={{ color: TONO_CUOTA[c.estado] || 'inherit' }}>{ESTADO_CUOTA[c.estado] || c.estado}</span>
              </small>
              <b className="ln-t-body-sm ln-mono">{moneda(c.monto)}</b>
              {c.estado === 'pagado' ? <span /> : (
                <button type="button" className="btn btn--linea btn--sm" onClick={() => onPagoDeCuota(c)}>
                  Pagó esta
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Lo que dice la confirmación de un seguimiento: no es el «Resultado guardado» de una llamada,
// sino qué quedó y para cuándo. `null` en una llamada o en una venta, que tienen su propio texto.
function cierreDelSeguimiento(r, contexto) {
  if (contexto.modo === 'llamada' || esVenta(r)) return null;
  if (r.contacto_result === 'no_paga') {
    return {
      linea: 'Cliente dado de baja',
      detalle: 'Avisó que no va a pagar: ya no debe nada y salió de las listas de cobro. Lo que pagó '
        + 'queda. Si vuelve, la baja se revierte desde Acciones.',
    };
  }
  if (r.contacto_result === 'agendo') {
    return { linea: 'Seguimiento guardado', detalle: 'Vuelve a Confirmaciones con la fecha nueva.' };
  }
  if (r.sig_action === 'close') {
    return { linea: 'Seguimiento cerrado', detalle: `Motivo: ${r.cierre_motivo}.` };
  }
  const que = contexto.modo === 'cobro' ? 'intento de cobro' : 'seguimiento';
  return {
    linea: 'Seguimiento guardado',
    detalle: r.fecha_seguimiento
      ? `El próximo ${que} queda para el ${fechaCorta(r.fecha_seguimiento)}.`
      : `El próximo ${que} queda sin fecha, en el pool del equipo.`,
  };
}

// --- piezas de la venta ---------------------------------------------------------------------

// El saldo se recalcula mientras el closer tipea el precio y lo cobrado, como en el wizard.
function SaldoEnVivo({ saldo, reducido }) {
  return (
    <div className="ln-panel ln-panel--sm" style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <small className="ln-t-eyebrow ln-muted">Saldo a financiar</small>
      <motion.b
        key={saldo}
        className="ln-t-h3 ln-mono"
        initial={reducido ? false : { opacity: 0.4, y: -3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.14 }}
        style={{ color: saldo > 0.009 ? 'var(--warning)' : 'var(--success)' }}
      >
        {saldo > 0.009 ? moneda(saldo) : 'Sin saldo'}
      </motion.b>
    </div>
  );
}

// --- cronograma que se va a crear con la venta ---------------------------------------------

function CronogramaVenta({ respuestas, contexto, onCambiar, soloLectura = false }) {
  const saldo = saldoVenta(respuestas, contexto);
  const montos = montosCuotas(respuestas, contexto);
  const filas = fechasCuotas(respuestas).map((fecha, i) => ({ fecha, monto: montos[i] }));
  const mensual = respuestas.installmentMode !== 'custom';

  const escribir = (nuevas) => {
    const cuotaMontos = {};
    const cuotaFechas = {};
    nuevas.forEach((f, i) => {
      if (i < nuevas.length - 1) cuotaMontos[i + 1] = f.monto;
      cuotaFechas[i + 1] = f.fecha;
    });
    // En el plan mensual las fechas salen del día de pago: guardarlas las congelaría aunque
    // después se cambie el día.
    onCambiar(mensual ? { cuotaMontos } : { cuotaMontos, cuotaFechas });
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      <small className="ln-t-eyebrow ln-muted">Saldo a financiar · {moneda(saldo)}</small>
      <CronogramaCuotas
        total={saldo}
        filas={filas}
        soloLectura={soloLectura}
        fechasFijas={mensual}
        onCambiar={escribir}
        onRepartir={() => onCambiar({ cuotaMontos: {} })}
      />
    </div>
  );
}

// --- pantalla de revisión -----------------------------------------------------------------

function Revision({
  respuestas, contexto, guardando, onGuardar, onCambiar, onElegir, precarga, onVolverA, onAnterior,
  reducido, grabacion = null, onReiniciar = null,
}) {
  const venta = esVenta(respuestas);
  // La fila que se está editando acá mismo, sin salir de la revisión. Solo una a la vez.
  const [editando, setEditando] = useState(null);
  const rev = revisionVenta(respuestas, contexto, resumen(respuestas, contexto));
  // El correo o el Instagram de otra ficha (formulario anterior reusado): lo dice el servidor.
  const deOtraFicha = useChequeoVenta(venta, {
    clientId: contexto.clientId, nombre: respuestas.nombre_cliente, email: respuestas.mail_cliente, instagram: respuestas.instagram,
  });
  const todos = [...rev.avisos, ...deOtraFicha];
  const saldo = rev.numeros.saldo;
  const errores = todos.filter((a) => a.nivel === 'error');
  const avisos = todos.filter((a) => a.nivel !== 'error');
  // Datos del cliente que son de otro (o de relleno): la venta no se registra hasta corregirlos.
  const frena = venta && errores.some((a) => a.frena);
  // La llamada sin venta no tiene secciones que armar: es una sola lista de lo contestado.
  const secciones = venta ? rev.secciones : [{
    id: 'resumen', titulo: 'Lo que reportaste', filas: rev.secciones.flatMap((s) => s.filas),
  }];
  return (
    <div className="fi-rev">
      <header className="fi-rev-cab">
        <h3 className="ln-t-h3">
          {rev.pago ? 'Revisá el pago antes de registrarlo'
            : venta ? 'Revisá la venta antes de registrarla' : 'Revisá el resultado antes de guardarlo'}
        </h3>
        <p className="ln-t-body-sm ln-muted">
          Tocá «Editar» en cualquier dato para corregirlo ahí mismo.
        </p>
      </header>

      {venta && <CifrasVenta numeros={rev.numeros} respuestas={respuestas} pago={rev.pago} reducido={reducido} />}

      {errores.length > 0 && (
        <AvisosRevision
          nivel="error"
          titulo={errores.length === 1 ? 'Hay un dato que parece incorrecto' : `Hay ${errores.length} datos que parecen incorrectos`}
          avisos={errores}
          onEditar={onVolverA}
        />
      )}
      {avisos.length > 0 && (
        <AvisosRevision
          nivel="warning"
          titulo={avisos.length === 1 ? 'Un dato para mirar' : `${avisos.length} datos para mirar`}
          avisos={avisos}
          onEditar={onVolverA}
        />
      )}

      {secciones.map((seccion) => (
        <motion.section
          key={seccion.id}
          className="fi-rev-sec"
          aria-label={seccion.titulo}
          {...CASCADA.contenedor(reducido)}
        >
          <small className="fi-rev-sec-tit">{seccion.titulo}</small>
          <div className="fi-rev-filas">
            {seccion.filas.map((fila) => {
              const paso = fila.paso || fila.clave;
              const preg = PREGUNTAS.find((q) => q.clave === paso);
              // Se abre por el paso, no por la clave de la fila: al vaciar un campo la fila pasa a
              // «Completar» y cambia de clave, y el editor se cerraba a mitad de escribir.
              const unica = seccion.filas.filter((f) => (f.paso || f.clave) === paso).length === 1;
              const abierta = editando === paso;
              const pregunta = preg ? normalizar(preg, respuestas, contexto) : null;
              // Los pasos con cronograma o el estado del cliente no caben en una fila: esos
              // siguen llevando a su pantalla.
              const enLinea = pregunta && !(pregunta.campos || []).some((c) => c.tipo === 'cronograma');
              // Las fichas van de a varias por fila; un texto largo (el motivo, una nota) o la
              // que se está editando ocupan el ancho entero.
              const ancha = abierta || (typeof fila.valor === 'string' && fila.valor.length > 40);
              return (
                <motion.div
                  key={unica ? paso : fila.clave}
                  className={`fi-rev-fila${fila.vacia ? ' fi-rev-fila--vacia' : ''}${abierta ? ' fi-rev-fila--abierta' : ''}${ancha ? ' fi-rev-fila--ancha' : ''}`}
                  {...CASCADA.hijo(reducido)}
                >
                  <span className="fi-rev-rotulo">{fila.label}</span>
                  <span className="fi-rev-valor">{fila.valor}</span>
                  <button
                    type="button"
                    className="fi-rev-editar"
                    aria-expanded={enLinea ? abierta : undefined}
                    aria-label={`${abierta ? 'Cerrar' : (fila.vacia ? 'Completar' : 'Editar')}: ${fila.label}`}
                    onClick={() => (enLinea ? setEditando(abierta ? null : paso) : onVolverA(paso))}
                  >
                    {abierta
                      ? <><X size={12} aria-hidden="true" /> Cerrar</>
                      : <><Pencil size={12} aria-hidden="true" /> {fila.vacia ? 'Completar' : 'Editar'}</>}
                  </button>
                  {abierta && enLinea && (
                    <EditorEnLinea
                      pregunta={pregunta}
                      respuestas={respuestas}
                      contexto={contexto}
                      precarga={precarga}
                      reducido={reducido}
                      onElegir={(clave, valores) => { setEditando(null); onElegir(clave, valores); }}
                      onGuardar={(parche) => { onCambiar(parche); setEditando(null); }}
                      onCerrar={() => setEditando(null)}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      ))}

      {venta && armaPlan(respuestas, contexto) && (
        <section className="fi-rev-sec" aria-label="Cronograma de cuotas">
          <small className="fi-rev-sec-tit">Cronograma de cuotas</small>
          <CronogramaVenta respuestas={respuestas} contexto={contexto} onCambiar={onCambiar} soloLectura />
        </section>
      )}

      {venta && saldo > 0.009 && (
        <div className="ln-alert ln-alert--warning" role="status">
          <span className="ln-alert-ico"><AlertTriangle /></span>
          <span className="ln-alert-body">
            <span className="ln-alert-title">{`Queda saldo por cobrar: ${moneda(saldo)}`}</span>
            <span className="ln-alert-desc">Al guardar se abre la pestaña «Acciones» para seguir el cobro.</span>
          </span>
        </div>
      )}

      {/* El único dato que no se pregunta: prendido por defecto para no perder avisos por
          omisión, como en el wizard. Apagarlo es para una venta de prueba o si ya avisó él. */}
      {venta && (
        <label className="ln-choice" style={{ display: 'block' }}>
          <input
            type="checkbox"
            className="ln-choice-input"
            checked={respuestas.enviar_webhook !== false}
            onChange={(e) => onCambiar({ enviar_webhook: e.target.checked })}
          />
          <span className="ln-choice-label">
            <span className="ln-check" aria-hidden="true"><Check /></span>
            <span className="ln-choice-text">
              Avisar por la automatización (n8n)
              <span className="ln-choice-hint">
                Dispara los mensajes automáticos al cliente y las notificaciones del equipo. Apagalo
                solo si ya avisaste vos o si es una venta de prueba.
              </span>
            </span>
          </span>
        </label>
      )}

      {grabacion}

      {/* El widget de bugs flota abajo a la derecha: `.fi-botonera` le deja su margen libre. */}
      <div className="fi-botonera fi-rev-pie">
        <BotonesAtras onAnterior={onAnterior} onReiniciar={onReiniciar} reducido={reducido} disabled={guardando} />
        <motion.button
          type="button"
          className="btn btn--cta"
          disabled={guardando || frena}
          whileTap={reducido || guardando || frena ? undefined : { scale: 0.97 }}
          onClick={onGuardar}
        >
          {guardando ? <span className="ln-spinner" /> : <CheckCircle2 />}
          {frena ? 'Corregí los datos del cliente'
            : venta ? `Registrar ${rev.pago ? 'el pago' : 'la venta'}${todos.length ? ' de todos modos' : ''}` : 'Guardar el resultado'}
        </motion.button>
      </div>
    </div>
  );
}

// El editor de una fila de la revisión: las mismas opciones o campos de la pregunta, pero ahí
// mismo, sin cambiar de pantalla. Un campo de formulario se guarda al escribirlo; una opción se
// aplica al elegirla (y si cambia la rama del reporte, el árbol sigue con lo que falte).
function EditorEnLinea({ pregunta, respuestas, contexto, precarga, reducido, onElegir, onGuardar, onCerrar }) {
  // Los campos se editan en un borrador y se aplican con «Guardar cambio». Si cada tecla fuera a
  // las respuestas, vaciar un dato obligatorio dejaría el reporte incompleto y el modal volvería
  // a la pregunta, que es justo lo que este editor evita.
  const [borrador, setBorrador] = useState({});
  const vista = { ...respuestas, ...borrador };
  const primero = pregunta.campos.find((c) => TIPOS_DE_TEXTO.has(c.tipo || 'texto'));
  const falta = pregunta.tipo === 'formulario' ? faltantesDe(pregunta, vista, contexto) : [];
  const cambio = Object.keys(borrador).length > 0;
  const guardar = () => { if (!falta.length && cambio) onGuardar(borrador); else if (!cambio) onCerrar(); };
  return (
    <div className="fi-rev-editor">
      {pregunta.tipo !== 'formulario' ? (
        <div role="group" aria-label={pregunta.enunciado} className="fi-rev-opciones">
          {pregunta.opciones.map((o) => {
            const activa = elegida(respuestas, pregunta.campo) === o.valor;
            return (
              <button
                key={String(o.valor)}
                type="button"
                className={`fi-rev-opcion${activa ? ' fi-rev-opcion--activa' : ''}`}
                aria-pressed={activa}
                onClick={() => (activa
                  ? onCerrar()
                  : onElegir(pregunta.clave, valoresDeOpcion(pregunta, o, contexto, respuestas)))}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="fi-rev-campos">
            {pregunta.campos.filter((campo) => !campo.junto).map((campo) => (
              <CampoArbol
                key={campo.campo}
                campo={campo}
                respuestas={vista}
                onCambio={(parche) => setBorrador((b) => ({ ...b, ...parche }))}
                cuotas={campo.tipo === 'cuota' ? cuotasPendientes(respuestas, contexto) : []}
                autoFocus={campo === primero}
                onEnter={TIPOS_DE_TEXTO.has(campo.tipo || 'texto') ? guardar : null}
                origen={origenDe(campo, vista, precarga)}
                pareja={parejaDe(pregunta, campo)}
              />
            ))}
          </div>
          {cambio && falta.length > 0 && (
            <p className="ln-t-body-sm fi-rev-falta" role="status">{falta.join(' · ')}</p>
          )}
          <div className="fi-rev-editor-pie">
            <button type="button" className="btn btn--linea btn--sm" onClick={onCerrar}>Cancelar</button>
            <button type="button" className="btn btn--cta btn--sm" disabled={!cambio || falta.length > 0}
              onClick={guardar}>
              <Check size={14} aria-hidden="true" /> Guardar cambio
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Lo primero que se lee: cuánto se vendió, cuánto entró hoy y cuánto queda. Tres cifras en una
// sola fila (en celular, una debajo de otra): nunca dos arriba y una suelta abajo.
function CifrasVenta({ numeros, respuestas, pago, reducido }) {
  const { total, cobrado, saldo, antes, programa, tipoPago } = numeros;
  const debe = saldo > 0.009;
  return (
    <motion.section
      className="fi-rev-hero"
      aria-label="Total de la venta"
      initial={reducido ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="fi-rev-total">
        <small className="fi-rev-sec-tit">{pago ? 'Pago' : 'Total de la venta'}</small>
        <b className="fi-rev-monto ln-mono">{moneda(total)}</b>
        <small className="ln-t-body-sm ln-muted">
          {[programa, tipoPago].filter(Boolean).join(' · ') || 'Programa sin elegir'}
          {antes > 0.009 ? ` · ya había pagado ${moneda(antes)}` : ''}
        </small>
        {/* Con qué correo se le da el acceso: es lo que crea la suscripción (ADR-W013). */}
        {!pago && respuestas.dar_acceso_academia === true && (
          <small className="ln-t-body-sm fi-rev-acceso">
            {`Acceso a la Academia con ${respuestas.mail_cliente || '(sin correo)'}`}
            {respuestas.acceso_hasta ? ` hasta el ${fechaCorta(respuestas.acceso_hasta)}` : ''}
          </small>
        )}
      </div>
      <div className="fi-rev-cifras">
        <div className="fi-rev-cifra">
          <small className="fi-rev-sec-tit">{pago ? 'Pagó' : 'Cobrado hoy'}</small>
          <b className="ln-t-h3 ln-mono">{moneda(cobrado)}</b>
        </div>
        <div className="fi-rev-cifra">
          <small className="fi-rev-sec-tit">{pago ? 'Le queda debiendo' : 'Saldo'}</small>
          <b className="ln-t-h3 ln-mono" style={{ color: debe ? 'var(--warning)' : 'var(--success)' }}>
            {debe ? moneda(saldo) : 'Sin saldo'}
          </b>
        </div>
        <div className="fi-rev-cifra">
          <small className="fi-rev-sec-tit">Medio de pago</small>
          <b className="ln-t-body">{respuestas.metodo_pago || 'Sin elegir'}</b>
        </div>
      </div>
    </motion.section>
  );
}

// Los datos que faltan o no cuadran, con el botón que lleva directo al paso que los arregla.
function AvisosRevision({ nivel, titulo, avisos, onEditar }) {
  return (
    <div className={`ln-alert ln-alert--${nivel}`} role={nivel === 'error' ? 'alert' : 'status'}>
      <span className="ln-alert-ico"><AlertTriangle /></span>
      <span className="ln-alert-body">
        <span className="ln-alert-title">{titulo}</span>
        <ul className="fi-rev-avisos">
          {avisos.map((a) => (
            <li key={a.id}>
              <span>{a.texto}</span>
              <button type="button" className="fi-rev-editar" onClick={() => onEditar(a.paso)}>
                <Pencil size={12} aria-hidden="true" /> Corregir
              </button>
            </li>
          ))}
        </ul>
      </span>
    </div>
  );
}

// --- lo que queda después de guardar ------------------------------------------------------

// El «guardado» ya lo dice el aviso del cascarón (`MENSAJES` en FichaLeadModal): repetirlo acá
// serían dos avisos iguales apilados. Este panel dice lo que sigue.
function Hecho({ hecho, irA, onAvisoCerrado }) {
  let linea = hecho.seguimiento?.linea || 'Resultado guardado';
  let detalle = hecho.seguimiento?.detalle || 'Ya podés cerrar la ficha.';
  if (hecho.venta && hecho.conDeuda) {
    linea = `Queda un saldo de ${moneda(hecho.saldo)}`;
    detalle = 'El cobro sigue en «Acciones»: el plan, los pagos y los seguimientos.';
  } else if (hecho.venta) {
    linea = 'Pagó todo: no queda saldo por cobrar';
    detalle = 'Ya podés cerrar la ficha, o revisar el historial del cliente.';
  }
  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <div className="ln-panel ln-panel--sm" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
        <CheckCircle2 size={20} aria-hidden="true" style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
        <span style={{ display: 'grid', gap: 'var(--space-1)' }}>
          <b className="ln-t-body">{linea}</b>
          <small className="ln-t-body-sm ln-muted">{detalle}</small>
        </span>
      </div>

      {hecho.avisos.length > 0 && (
        <div className="ln-alert ln-alert--warning" role="status">
          <span className="ln-alert-ico"><AlertTriangle /></span>
          <span className="ln-alert-body">
            <span className="ln-alert-title">Se guardo, pero hay algo para revisar</span>
            <span className="ln-alert-desc">
              <ul style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
                {hecho.avisos.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </span>
          </span>
          <button type="button" className="ln-alert-x" aria-label="Descartar el aviso" onClick={onAvisoCerrado}>
            <X />
          </button>
        </div>
      )}

      {irA && (
        <div className="fi-botonera">
          <button type="button" className="btn btn--linea" onClick={() => irA('hist')}>
            <History /> Ver historial
          </button>
          {hecho.venta && (
            <button type="button" className="btn btn--cta" onClick={() => irA('acciones')}>
              Ir a Acciones <ArrowRight />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
