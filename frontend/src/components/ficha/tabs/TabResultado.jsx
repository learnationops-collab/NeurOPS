// Pestaña «Resultado»: el closer reporta qué pasó con la llamada y, si hubo venta, la declara.
//
// Todo el recorrido lo decide `arbolResultado.js` (función pura). Este componente solo guarda el
// objeto de respuestas y pinta lo que el árbol dice que toca: el stepper de hitos, las 4 tarjetas
// grandes mientras no hay resultado, una pregunta por pantalla, y al final la revisión.
// La escritura va SIEMPRE por `onAccion`: esta pestaña nunca llama fetch/axios.

import { useCallback, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CheckCircle2, XCircle, CalendarX, CalendarClock, RotateCcw, AlertTriangle, ArrowLeft, X,
} from 'lucide-react';
import { StepperFicha, TarjetaAccion } from '../acciones/piezas';
import CampoArbol from '../acciones/CampoArbol';
import CronogramaCuotas from '../acciones/CronogramaCuotas';
import { repartirCuotas, repartirParejo, sumarMeses, moneda } from '../acciones/planCuotas';
import {
  estadoInicial, responder, actualizar, volverA, preguntaActual, faltantes,
  puedeAvanzar, completo, arrancado, hitos, resumen, esVenta, quedaDeuda, construirPayload,
  RAICES,
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
  asistio: <CheckCircle2 />, no_asistio: <XCircle />, cancelo: <CalendarX />, reagenda: <CalendarClock />,
};

const hoyIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Los datos que ya sabemos no se vuelven a pedir. Ojo: acá NO se precargan los campos de las
// preguntas de opciones (programa, medio de pago…), porque un campo con valor cuenta como
// contestado y la pregunta se saltearía sin que el closer la haya visto.
function precargar(ficha) {
  const id = ficha?.identidad || {};
  return {
    ...estadoInicial(),
    nombre_cliente: id.nombre || '',
    instagram: id.instagram || '',
    mail_cliente: id.email || '',
    telefono: id.telefono || '',
    email_vendedor: id.closer?.email || ficha?.yo?.email || '',
    setter: id.setter?.nombre || '',
    examen_lead: id.examen || '',
    estado: 'Completada',
    sold_in_call: true,
    enviar_webhook: true,
    date: hoyIso(),
    num_cuotas: 1,
    installmentMode: 'monthly',
    dia_de_pago: 10,
    modalidad: [],
    refs_rows: [],
  };
}

export default function TabResultado({ ficha, onAccion, onRecargar, irA, puedeEditar = true }) {
  const reducido = useReducedMotion();
  const [respuestas, setRespuestas] = useState(() => precargar(ficha));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const contexto = useMemo(() => {
    const res = ficha?.resultado || {};
    return {
      modo: res.seguimiento_activo ? 'seguimiento' : 'llamada',
      intento: res.seguimiento_intento || 1,
      seguimientoTipo: res.seguimiento_tipo || null,
      appointmentId: ficha?.identidad?.appointment_id ?? null,
      clientId: ficha?.identidad?.client_id ?? null,
      estadoPagos: ficha?.cobro?.estado_pagos || null,
    };
  }, [ficha]);

  const pregunta = preguntaActual(respuestas, contexto);
  const listo = completo(respuestas, contexto);
  const pendientes = faltantes(respuestas, contexto);
  const pasos = hitos(respuestas, contexto).map((h) => ({ key: h.clave, label: h.label, sub: h.sub, estado: h.estado }));
  const cuotas = ficha?.cobro?.cuotas || [];

  const cambiar = useCallback((parche) => setRespuestas((prev) => actualizar(prev, parche)), []);
  const elegir = useCallback((clave, valores) => {
    setError(null);
    setRespuestas((prev) => responder(prev, clave, valores));
  }, []);

  // Se anima la ENTRADA de cada pantalla, sin `AnimatePresence`: con salida en `mode="wait"` la
  // pregunta siguiente no monta hasta que termina la anterior, y una pregunta que tarda en
  // aparecer se siente peor que una que entra sola.
  const animar = reducido
    ? {}
    : { initial: { opacity: 0, x: 18 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.18, ease: 'easeOut' } };

  const guardar = async () => {
    const { accion, datos } = construirPayload(respuestas, contexto);
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const respuesta = await onAccion(accion, datos);
      // La venta se guarda igual aunque el historial de pagos previo tenga una inconsistencia
      // (SheetsService avisa pero no bloquea). Ese aviso tiene que llegar al closer: si no, se
      // queda sin saber que hay un dato para revisar en el historial del cliente.
      if (respuesta?.warning) setAviso(respuesta.warning);
      await onRecargar?.();
      // Si quedó saldo, el trabajo sigue en «Acciones»: se lleva al closer ahí en vez de
      // dejarlo en una pantalla de resultado que ya no tiene nada para hacer.
      if (quedaDeuda(respuestas)) irA?.('acciones');
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'No se pudo guardar el resultado');
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

      {aviso && (
        <div className="ln-alert ln-alert--warning" role="status">
          <span className="ln-alert-ico"><AlertTriangle /></span>
          <span className="ln-alert-body">
            <span className="ln-alert-title">Se guardo, pero hay algo para revisar</span>
            <span className="ln-alert-desc">{aviso}</span>
          </span>
          <button type="button" className="ln-alert-x" aria-label="Descartar el aviso" onClick={() => setAviso(null)}>
            <X />
          </button>
        </div>
      )}

        {/* Las 4 tarjetas grandes son la entrada al reporte de la LLAMADA. En la cadencia de
            seguimiento la llamada ya se reportó: ahí se entra derecho por «¿qué pasó con este
            contacto?», que es la pregunta que el árbol pone primera en ese modo. */}
        {!arrancado(respuestas) && contexto.modo !== 'seguimiento' ? (
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
          </motion.section>
        ) : listo ? (
          <motion.section key="revision" {...animar} aria-label="Revisión del resultado">
            <Revision
              reducido={reducido}
              respuestas={respuestas}
              contexto={contexto}
              guardando={guardando}
              onGuardar={guardar}
              onVolverA={(clave) => setRespuestas((prev) => volverA(prev, clave))}
            />
          </motion.section>
        ) : (
          <motion.section key={pregunta.clave} {...animar} aria-live="polite">
            <Pregunta
              reducido={reducido}
              pregunta={pregunta}
              respuestas={respuestas}
              contexto={contexto}
              cuotas={cuotas}
              pendientes={pendientes}
              puede={puedeAvanzar(respuestas, contexto)}
              onElegir={elegir}
              onCambiar={cambiar}
            />
          </motion.section>
        )}

      {arrancado(respuestas) && (
        <div className="ln-btn-row" style={{ justifyContent: 'flex-start' }}>
          <button
            type="button"
            className="ln-btn ln-btn--ghost ln-btn--sm"
            onClick={() => { setError(null); setRespuestas(precargar(ficha)); }}
          >
            <RotateCcw /> Empezar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}

// --- una pregunta por pantalla -------------------------------------------------------------

function Pregunta({ pregunta, respuestas, contexto, cuotas, pendientes, puede, onElegir, onCambiar, reducido }) {
  if (pregunta.tipo !== 'formulario') {
    const columnas = pregunta.opciones.length > 2 ? 3 : 2;
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
              activa={respuestas[pregunta.campo] === o.valor}
              onClick={() => onElegir(pregunta.clave, valoresDeOpcion(pregunta, o, contexto))}
            />
          ))}
        </motion.div>
      </>
    );
  }

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
        {pregunta.campos.map((campo) => (
          <CampoArbol key={campo.campo} campo={campo} respuestas={respuestas} onCambio={onCambiar} cuotas={cuotas} />
        ))}
      </div>

      {pregunta.clave === 'venta_cuotas' && !respuestas.selectedCuotaId && (
        <CronogramaVenta respuestas={respuestas} contexto={contexto} onCambiar={onCambiar} />
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

      <div className="ln-btn-row" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
        <button
          type="button"
          className="ln-btn ln-btn--cta"
          disabled={!puede}
          onClick={() => onElegir(pregunta.clave, {})}
        >
          Continuar
        </button>
      </div>
    </>
  );
}

// Elegir una opción a veces arrastra un valor derivado, para no hacerle una pregunta más al
// closer cuando la respuesta ya se deduce (la fecha sugerida de la cadencia de seguimiento).
function valoresDeOpcion(pregunta, opcion, contexto) {
  const base = { [pregunta.campo]: opcion.valor };
  if (pregunta.clave === 'sig_action' && opcion.valor === 'next') {
    const dias = [0, 3, 7, 14][Math.min(3, contexto.intento || 1)];
    const d = new Date();
    d.setDate(d.getDate() + dias);
    base.fecha_seguimiento = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return base;
}

const TONOS = { success: 'success', error: 'error', warning: 'warning', info: 'info', idle: 'idle' };

function OpcionGrande({ opcion, activa, onClick, reducido }) {
  const tono = TONOS[opcion.tono] || 'info';
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      {...CASCADA.hijo(reducido)}
      whileHover={reducido ? undefined : { scale: 1.015 }}
      whileTap={reducido ? undefined : { scale: 0.98 }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: 'flex-start',
        textAlign: 'left', padding: 'var(--space-4)', cursor: 'pointer',
        borderRadius: 'var(--radius-control)',
        background: activa ? `var(--${tono}-surface)` : 'var(--bg-element)',
        border: `1px solid ${activa ? `var(--${tono}-border)` : 'var(--border-control)'}`,
        color: 'var(--text-on-surface)',
      }}
    >
      <b className="ln-t-body">{opcion.label}</b>
      {opcion.sub && <small className="ln-t-caption ln-muted">{opcion.sub}</small>}
    </motion.button>
  );
}

// --- cronograma que se va a crear con la venta ---------------------------------------------

function CronogramaVenta({ respuestas, contexto, onCambiar }) {
  const total = parseFloat(respuestas.precio_total) || 0;
  const pagadoAntes = contexto.estadoPagos?.total_paid || 0;
  const saldo = Math.max(0, total - pagadoAntes - (parseFloat(respuestas.monto) || 0));
  const n = Math.max(1, Math.trunc(Number(respuestas.num_cuotas) || 1));
  const montos = repartirCuotas(n, saldo, respuestas.cuotaMontos);
  const primera = `${hoyIso().slice(0, 7)}-${String(respuestas.dia_de_pago || 10).padStart(2, '0')}`;
  const filas = montos.map((monto, i) => ({
    monto,
    fecha: respuestas.cuotaFechas?.[i + 1] || sumarMeses(primera, i + 1),
  }));

  const escribir = (nuevas) => {
    const cuotaMontos = {};
    const cuotaFechas = {};
    nuevas.forEach((f, i) => {
      if (i < nuevas.length - 1) cuotaMontos[i + 1] = f.monto;
      cuotaFechas[i + 1] = f.fecha;
    });
    onCambiar({ cuotaMontos, cuotaFechas });
  };

  return (
    <div style={{ marginTop: 'var(--space-6)' }}>
      <small className="ln-t-eyebrow ln-muted">Saldo a financiar · {moneda(saldo)}</small>
      <CronogramaCuotas
        total={saldo}
        filas={filas}
        onCambiar={escribir}
        onRepartir={() => escribir(repartirParejo(n, saldo).map((monto, i) => ({ monto, fecha: filas[i].fecha })))}
      />
    </div>
  );
}

// --- pantalla de revisión -----------------------------------------------------------------

function Revision({ respuestas, contexto, guardando, onGuardar, onVolverA, reducido }) {
  const filas = resumen(respuestas, contexto);
  const venta = esVenta(respuestas);
  return (
    <>
      <h3 className="ln-t-h3">{venta ? 'Revisá la venta antes de registrarla' : 'Revisá el resultado antes de guardarlo'}</h3>
      <p className="ln-t-body-sm ln-muted">Tocá cualquier fila para volver a ese paso y corregirlo.</p>

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
            <small className="ln-t-caption" style={{ color: 'var(--info)' }}><ArrowLeft size={11} /> Corregir</small>
          </motion.button>
        ))}
      </motion.div>

      {quedaDeuda(respuestas) && (
        <div className="ln-alert ln-alert--warning" role="status" style={{ marginTop: 'var(--space-4)' }}>
          <span className="ln-alert-ico"><AlertTriangle /></span>
          <span className="ln-alert-body">
            <span className="ln-alert-title">Queda saldo por cobrar</span>
            <span className="ln-alert-desc">Al guardar se abre la pestaña «Acciones» para armar el cobro.</span>
          </span>
        </div>
      )}

      {/* El widget de bugs flota abajo a la derecha: la barra deja su margen libre. */}
      <div className="ln-btn-row" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-6)', paddingRight: 168 }}>
        <button type="button" className="ln-btn ln-btn--cta" disabled={guardando} onClick={onGuardar}>
          {guardando ? <span className="ln-spinner" /> : <CheckCircle2 />}
          {venta ? 'Registrar la venta' : 'Guardar el resultado'}
        </button>
      </div>
    </>
  );
}
