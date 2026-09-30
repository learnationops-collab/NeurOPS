// Pestaña «Resultado»: el closer reporta qué pasó con la llamada y, si hubo venta, la declara.
//
// Todo el recorrido lo decide `arbolResultado.js` (función pura). Este componente solo guarda el
// objeto de respuestas y pinta lo que el árbol dice que toca: el stepper de hitos, las 4 tarjetas
// grandes mientras no hay resultado, una pregunta por pantalla, y al final la revisión.
// La escritura va SIEMPRE por `onAccion` y la lectura por `onConsultar`: esta pestaña nunca llama
// fetch/axios.
//
// La venta es el wizard «Declarar venta» del mazo, dentro de la ficha y no en un modal encima:
// se confirma cada dato del comprador, qué compró, cómo paga, el cronograma, los referidos y el
// acceso a la Academia, y se registra todo en un solo guardado.
//
// Los botones son los de la ficha (`.btn`) y no los `.ln-btn` del design system: dentro de
// `.dc-shell` una clase sola del DS pierde contra `.dc-shell button{background:none;border:0;
// padding:0}` y el botón queda como texto suelto en mayúsculas (ver `PlanCuotasForm`).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Check, CheckCircle2, XCircle, CalendarX, CalendarClock, RotateCcw, AlertTriangle, ArrowLeft, X,
  ArrowRight, History, DollarSign,
} from 'lucide-react';
import { StepperFicha, TarjetaAccion } from '../acciones/piezas';
import CampoArbol from '../acciones/CampoArbol';
import CronogramaCuotas from '../acciones/CronogramaCuotas';
import { moneda } from '../acciones/planCuotas';
import { Hueso } from '../../huesos/Huesos';
import {
  estadoInicial, responder, actualizar, volverA, preguntaActual, faltantes,
  puedeAvanzar, completo, arrancado, hitos, resumen, esVenta, quedaDeuda, construirPayload,
  progresoVenta, saldoVenta, armaPlan, cuotasPendientes, fechasCuotas, montosCuotas, esCompleto,
  ventaDirecta, anterior, elegida, fechaCorta, RAICES,
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
function precargar(ficha) {
  const id = ficha?.identidad || {};
  return {
    ...estadoInicial(),
    nombre_cliente: id.nombre || '',
    instagram: (id.instagram || '').replace(/@/g, ''),
    mail_cliente: id.email || '',
    telefono: id.telefono || '',
    documento_identidad: '',
    // El respaldo cuando no hay lista de closers para elegir: la venta va al closer de la agenda.
    email_vendedor: id.closer?.email || '',
    setter: id.setter?.nombre || '',
    examen_lead: id.examen || '',
    sold_in_call: true,
    enviar_webhook: true,
    date: hoyIso(),
    num_cuotas: 1,
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
  // pasar por las cuatro tarjetas de la llamada («Anterior» vuelve a ellas).
  const [respuestas, setRespuestas] = useState(() => (arrancarEnVenta ? ventaDirecta(precarga) : precarga));
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
      estadoVenta: venta.estado,
      cargandoVenta: venta.cargando,
      closers: ficha?.vocabulario?.closers || [],
      closerAgenda: ficha?.identidad?.closer || null,
      cuotas: ficha?.cobro?.cuotas || [],
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <StepperFicha pasos={pasos} onPaso={null} />

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
          </motion.section>
        ) : !arrancado(respuestas) && contexto.modo === 'llamada' ? (
          <motion.section key="raices" {...animar} aria-label="¿Qué pasó con esta llamada?">
            <h3 className="ln-t-h3">¿Qué pasó con esta llamada?</h3>
            <div className="ln-grid ln-grid-4" style={{ marginTop: 'var(--space-4)' }}>
              {RAICES.map((o) => (
                <TarjetaAccion
                  key={o.valor}
                  tono={o.tono}
                  icono={ICONOS[o.valor]}
                  label={o.label}
                  onClick={() => elegir('res', { res: o.valor })}
                />
              ))}
            </div>
            {/* La venta que no sale de reportar ESTA llamada: la renovación o el upsell de un
                cliente, la cuota de su plan, una venta cerrada por WhatsApp. Antes se declaraba
                desde el historial del cliente, en un wizard aparte; es la misma rama de venta. */}
            <div className="ln-panel ln-panel--sm fi-venta-directa">
              <span style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <b className="ln-t-body">¿Es una venta que no sale de esta llamada?</b>
                <small className="ln-t-body-sm ln-muted">
                  Una renovación, un upsell, la cuota de su plan o una venta cerrada por fuera.
                </small>
              </span>
              <motion.button
                type="button"
                className="btn btn--linea"
                whileTap={reducido ? undefined : { scale: 0.97 }}
                onClick={() => { setError(null); setRespuestas((prev) => ventaDirecta(prev)); }}
              >
                <DollarSign /> Registrar una venta
              </motion.button>
            </div>
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
              onVolverA={(clave) => setRespuestas((prev) => volverA(prev, clave))}
              onAnterior={volver}
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
              irA={irA}
            />
          </motion.section>
        )}

      {/* Con contorno y del alto del botón que avanza: es la otra salida del paso, no una etiqueta. */}
      {arrancado(respuestas) && !hecho && (
        <div className="ln-btn-row" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="btn btn--linea" onClick={empezarDeNuevo}>
            <RotateCcw /> Empezar de nuevo
          </button>
        </div>
      )}
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

function Pregunta({
  pregunta, respuestas, precarga, contexto, pendientes, puede, onElegir, onCambiar, onAnterior, irA,
  reducido,
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
        {onAnterior && (
          <div className="fi-botonera" style={{ marginTop: 'var(--space-6)', justifyContent: 'flex-start' }}>
            <BotonAnterior onClick={onAnterior} reducido={reducido} />
          </div>
        )}
      </>
    );
  }

  const avanzar = () => { if (puede) onElegir(pregunta.clave, {}); };
  const primeroDeTexto = pregunta.campos.find((c) => TIPOS_DE_TEXTO.has(c.tipo || 'texto'));

  return (
    <>
      <h3 className="ln-t-h3">{pregunta.enunciado}</h3>
      {pregunta.ayuda && <p className="ln-t-body-sm ln-muted">{pregunta.ayuda}</p>}
      <div
        style={{
          display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-4)',
          gridTemplateColumns: pregunta.campos.length > 3 ? 'repeat(auto-fit, minmax(240px, 1fr))' : '1fr',
        }}
      >
        {pregunta.campos.map((campo) => {
          if (campo.tipo === 'estado_cliente') {
            return <EstadoCliente key={campo.campo} estado={contexto.estadoVenta} cargando={contexto.cargandoVenta} />;
          }
          if (campo.tipo === 'cronograma') {
            return <CronogramaVenta key={campo.campo} respuestas={respuestas} contexto={contexto} onCambiar={onCambiar} />;
          }
          return (
            <CampoArbol
              key={campo.campo}
              campo={campo}
              respuestas={respuestas}
              onCambio={onCambiar}
              cuotas={campo.tipo === 'cuota' ? cuotasPendientes(respuestas, contexto) : []}
              autoFocus={campo === primeroDeTexto}
              onEnter={TIPOS_DE_TEXTO.has(campo.tipo || 'texto') ? avanzar : null}
              origen={origenDe(campo, respuestas, precarga)}
            />
          );
        })}
      </div>

      {pregunta.clave === 'venta_montos' && !esCompleto(respuestas) && (
        <SaldoEnVivo saldo={saldoVenta(respuestas, contexto)} reducido={reducido} />
      )}

      {pendientes.length > 0 && (
        <div className="ln-alert ln-alert--warning" role="status" style={{ marginTop: 'var(--space-4)' }}>
          <span className="ln-alert-ico"><AlertTriangle /></span>
          <span className="ln-alert-body">
            <span className="ln-alert-title">Falta para poder seguir</span>
            <span className="ln-alert-desc">
              <ul style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
                {pendientes.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </span>
          </span>
        </div>
      )}

      <div className="fi-botonera" style={{ marginTop: 'var(--space-6)' }}>
        {onAnterior && <BotonAnterior onClick={onAnterior} reducido={reducido} />}
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

// A la izquierda de la botonera, como el «Anterior» del wizard de venta: el avance queda a la
// derecha, donde el closer ya tiene la mano.
function BotonAnterior({ onClick, reducido, disabled = false }) {
  return (
    <motion.button
      type="button"
      className="btn btn--linea"
      disabled={disabled}
      whileTap={reducido || disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      style={{ marginRight: 'auto' }}
    >
      <ArrowLeft /> Anterior
    </motion.button>
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
  // Lo que se cobra en un seguimiento no se cerró en la llamada (el mazo abría la venta así).
  if (pregunta.clave === 'contacto_result' && opcion.valor === 'pago') base.sold_in_call = false;
  if (pregunta.clave === 'refs_ask' && opcion.valor === 'si' && !(respuestas.refs_rows || []).length) {
    base.refs_rows = [{ nombre: '', contacto: '' }];
  }
  return base;
}

const TONOS = { success: 'success', error: 'error', warning: 'warning', info: 'info', idle: 'idle' };

function OpcionGrande({ opcion, activa, onClick, reducido }) {
  const tono = opcion.aviso ? 'warning' : (TONOS[opcion.tono] || 'info');
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      title={opcion.aviso || undefined}
      {...CASCADA.hijo(reducido)}
      whileHover={reducido ? undefined : { scale: 1.015 }}
      whileTap={reducido ? undefined : { scale: 0.98 }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: 'flex-start',
        textAlign: 'left', padding: 'var(--space-4)', cursor: 'pointer',
        borderRadius: 'var(--radius-control)',
        background: activa || opcion.aviso ? `var(--${tono}-surface)` : 'var(--bg-element)',
        border: `1px solid ${activa || opcion.aviso ? `var(--${tono}-border)` : 'var(--border-control)'}`,
        color: 'var(--text-on-surface)',
      }}
    >
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
    return { linea: 'Seguimiento de cobro cerrado', detalle: 'Avisó que no va a pagar: salió de la cola de cobros.' };
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

// «Así viene este cliente»: lo que ya pagó del programa, lo que le falta y cuántas ventas tiene.
// Mientras carga se dibuja su forma, no un spinner.
function EstadoCliente({ estado, cargando }) {
  if (cargando || !estado) {
    return (
      <div className="ln-panel ln-panel--sm" aria-busy="true" style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <Hueso alto={18} ancho="60%" />
        <Hueso alto={18} ancho="45%" paso={1} />
        <Hueso alto={18} ancho="35%" paso={2} />
      </div>
    );
  }
  const filas = [
    ['Pagó', `${moneda(estado.total_paid)} de ${moneda(estado.program_price)}`, 'var(--text-on-surface)'],
    ['Le falta', moneda(estado.balance_remaining), estado.balance_remaining > 0.009 ? 'var(--warning)' : 'var(--success)'],
    ['Ventas registradas', String(estado.sales_count ?? 0), 'var(--text-on-surface)'],
  ];
  return (
    <div className="ln-panel ln-panel--sm" style={{ display: 'grid', gap: 'var(--space-2)' }}>
      {filas.map(([rotulo, valor, color]) => (
        <div key={rotulo} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
          <small className="ln-t-caption ln-muted">{rotulo}</small>
          <b className="ln-t-body ln-mono" style={{ color }}>{valor}</b>
        </div>
      ))}
    </div>
  );
}

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
  respuestas, contexto, guardando, onGuardar, onCambiar, onVolverA, onAnterior, reducido,
}) {
  const filas = resumen(respuestas, contexto);
  const venta = esVenta(respuestas);
  const saldo = venta ? saldoVenta(respuestas, contexto) : 0;
  return (
    <>
      <h3 className="ln-t-h3">{venta ? 'Revisá la venta antes de registrarla' : 'Revisá el resultado antes de guardarlo'}</h3>
      <p className="ln-t-body-sm ln-muted">Tocá cualquier fila para volver a ese paso y corregirlo. Al terminar, volvés acá.</p>

      <motion.div
        className="ln-table"
        {...CASCADA.contenedor(reducido)}
        style={{ '--cols': '1.4fr 1fr auto', marginTop: 'var(--space-4)' }}
      >
        {filas.map((fila) => (
          <motion.button
            key={fila.clave}
            type="button"
            className="ln-table-row"
            {...CASCADA.hijo(reducido)}
            onClick={() => onVolverA(fila.paso || fila.clave)}
            style={{ width: '100%', cursor: 'pointer', textAlign: 'left', background: 'var(--bg-element)' }}
          >
            <span className="ln-cell-label ln-cell--title">{fila.label}</span>
            <span className="ln-t-body-sm">{fila.valor}</span>
            {/* inline-flex: Tailwind pone los svg en bloque y la flecha partía el rótulo en dos. */}
            <small className="ln-t-caption" style={{ color: 'var(--info)', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
              <ArrowLeft size={11} /> Corregir
            </small>
          </motion.button>
        ))}
      </motion.div>

      {venta && armaPlan(respuestas, contexto) && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <CronogramaVenta respuestas={respuestas} contexto={contexto} onCambiar={onCambiar} soloLectura />
        </div>
      )}

      {venta && saldo > 0.009 && (
        <div className="ln-alert ln-alert--warning" role="status" style={{ marginTop: 'var(--space-4)' }}>
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
        <label className="ln-choice" style={{ display: 'block', marginTop: 'var(--space-4)' }}>
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

      {/* El widget de bugs flota abajo a la derecha: `.fi-botonera` le deja su margen libre. */}
      <div className="fi-botonera" style={{ marginTop: 'var(--space-6)' }}>
        {onAnterior && <BotonAnterior onClick={onAnterior} reducido={reducido} disabled={guardando} />}
        <motion.button
          type="button"
          className="btn btn--cta"
          disabled={guardando}
          whileTap={reducido || guardando ? undefined : { scale: 0.97 }}
          onClick={onGuardar}
        >
          {guardando ? <span className="ln-spinner" /> : <CheckCircle2 />}
          {venta ? 'Registrar la venta' : 'Guardar el resultado'}
        </motion.button>
      </div>
    </>
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
