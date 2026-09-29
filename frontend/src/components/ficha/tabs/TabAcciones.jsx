// Pestaña «Acciones»: el cobro post-venta. A la izquierda la deuda, a la derecha las cuatro
// acciones en grid 2×2. Cada acción es una SUB-VISTA con «Volver» dentro del mismo panel — nunca
// un modal encima de otro modal.

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CalendarDays, Check, CheckCircle2, Clock, Pencil, XCircle, AlertTriangle, X,
} from 'lucide-react';
import { TarjetaAccion } from '../acciones/piezas';
import { soloDia } from '../piezas/fecha';
import SubVistaPlanCuotas from '../acciones/SubVistaPlanCuotas';
import { SubVistaPago, SubVistaSeguimiento, SubVistaBaja } from '../acciones/SubVistasCobro';
import { moneda } from '../acciones/planCuotas';

// El orden y los tonos son los del mockup (`fcAcciones`).
const ACCIONES = [
  { modo: 'plan', label: 'Armar plan de cuotas', tono: 'info', icono: CalendarDays, accion: 'guardar_plan', ok: 'Plan de cuotas guardado.' },
  { modo: 'pago', label: 'Registrar pago', tono: 'success', icono: CheckCircle2, accion: 'registrar_pago', ok: 'Pago registrado.' },
  { modo: 'seg', label: 'Registrar seguimiento', tono: 'warning', icono: Clock, accion: 'registrar_seguimiento', ok: 'Seguimiento agendado.' },
  { modo: 'baja', label: 'Dar de baja', tono: 'error', icono: XCircle, accion: 'dar_de_baja', ok: 'Baja registrada.' },
];

export default function TabAcciones({ ficha, onAccion, onRecargar, puedeEditar = true }) {
  const reducido = useReducedMotion();
  const [modo, setModo] = useState('menu');
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const puedeCobrar = puedeEditar && ficha?.permisos?.cobrar !== false;
  const definicion = ACCIONES.find((a) => a.modo === modo);

  const volver = () => { setModo('menu'); setError(null); };

  const guardar = async (payload) => {
    if (!definicion) return;
    setGuardando(true);
    setError(null);
    try {
      await onAccion(definicion.accion, payload);
      await onRecargar?.();
      setAviso(definicion.ok);
      setModo('menu');
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  // Igual que en «Resultado»: se anima la entrada, no la salida. Con `AnimatePresence mode="wait"`
  // la sub-vista no monta hasta que el menú termina de irse.
  const animar = reducido
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.18, ease: 'easeOut' } };

  const comunes = { ficha, onVolver: volver, onGuardar: guardar, guardando };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {aviso && (
        <div className="ln-alert ln-alert--success" role="status">
          <span className="ln-alert-ico"><CheckCircle2 /></span>
          <span className="ln-alert-body"><span className="ln-alert-title">{aviso}</span></span>
          <button type="button" className="ln-alert-x" aria-label="Descartar el aviso" onClick={() => setAviso(null)}>
            <X />
          </button>
        </div>
      )}
      {error && (
        <div className="ln-alert ln-alert--error" role="alert">
          <span className="ln-alert-ico"><AlertTriangle /></span>
          <span className="ln-alert-body"><span className="ln-alert-title">{error}</span></span>
        </div>
      )}

        {modo === 'menu' ? (
          <motion.div key="menu" {...animar} className="ln-grid" style={{ gridTemplateColumns: 'minmax(220px, 1fr) minmax(0, 2fr)', gap: 'var(--space-6)' }}>
            <TarjetaDeuda
              cobro={ficha?.cobro}
              programas={ficha?.vocabulario?.programas}
              puedeEditar={puedeCobrar}
              onGuardarTotal={(total) => onAccion('guardar_total', { total })}
              onGuardarPrograma={(programa_code) => onAccion('guardar_programa', { programa_code })}
            />
            <div className="ln-grid ln-grid-2">
              {ACCIONES.map((a) => (
                <TarjetaAccion
                  key={a.modo}
                  tono={a.tono}
                  icono={a.icono}
                  label={a.label}
                  onClick={puedeCobrar ? () => { setAviso(null); setModo(a.modo); } : undefined}
                />
              ))}
            </div>
            {!puedeCobrar && (
              <p className="ln-t-body-sm ln-muted" style={{ gridColumn: '1 / -1' }}>
                Tu rol puede ver el cobro de este cliente pero no registrarlo.
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div key={modo} {...animar}>
            {modo === 'plan' && <SubVistaPlanCuotas {...comunes} />}
            {modo === 'pago' && <SubVistaPago {...comunes} />}
            {modo === 'seg' && <SubVistaSeguimiento {...comunes} />}
            {modo === 'baja' && <SubVistaBaja {...comunes} />}
          </motion.div>
        )}
    </div>
  );
}

// La deuda es el dato que manda en esta pestaña: monto grande en rojo, y debajo los tres números
// que la explican — el total que el cliente negoció, lo que ya pagó y cuándo fue el último pago.
//
// El total se edita ACÁ y no solo en el historial del mazo porque es de donde sale la deuda:
// `_client_debt` lo prefiere al precio de lista del programa, que es igual para todos y no
// refleja descuentos. Ver un saldo que no cierra y no poder tocar el número que lo produce era
// pedirle al closer que avisara a Operaciones para arreglar su propia cartera.
function TarjetaDeuda({ cobro, programas, puedeEditar = true, onGuardarTotal, onGuardarPrograma }) {
  const reducido = useReducedMotion();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);

  const deuda = Number(cobro?.deuda) || 0;
  const alDia = deuda < 0.01;
  const total = cobro?.total ?? null;
  const sugerido = Number(cobro?.total_sugerido) || 0;

  const abrir = () => {
    // Sin total cargado se propone el deducido (pagado + deuda): es el que el sistema ya está
    // usando de hecho, así que confirmarlo tal cual también es una corrección.
    setValor(String(total ?? sugerido));
    setEditando(true);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardarTotal?.(Number(valor));
      setEditando(false);
    } catch {
      // El error lo muestra el aviso del cascarón. Acá el editor se queda abierto con lo que
      // el closer tipeó, para corregirlo sin volver a escribirlo entero.
    } finally {
      setGuardando(false);
    }
  };

  const animar = reducido
    ? {}
    : { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.14, ease: 'easeOut' } };

  return (
    <div className="ln-panel ln-panel--sm">
      <small className="ln-t-eyebrow ln-muted">Deuda</small>
      {/* La cifra se remonta con su valor: corregir el total la cambia, y el parpadeo es lo que
          avisa que ese era el número que estaba mal. */}
      <motion.p
        key={deuda}
        {...animar}
        className="ln-t-display"
        style={{ color: alDia ? 'var(--success)' : 'var(--error)', margin: 'var(--space-2) 0 var(--space-4)' }}
      >
        {alDia ? 'Al día' : moneda(deuda)}
      </motion.p>

      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <CampoPrograma
          cobro={cobro}
          programas={programas}
          puedeEditar={puedeEditar}
          onGuardar={onGuardarPrograma}
        />

        <div>
          <small className="ln-t-caption ln-muted" style={{ display: 'block' }}>Total a pagar</small>
          {editando ? (
            <motion.span
              {...animar}
              style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-2)' }}
            >
              <span className="ln-field" style={{ maxWidth: 160 }}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  value={valor}
                  aria-label="Total a pagar"
                  onChange={(e) => setValor(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') guardar();
                    if (e.key === 'Escape') setEditando(false);
                  }}
                />
                <span className="ln-unit">USD</span>
              </span>
              <button
                type="button"
                className="ln-iconbtn"
                disabled={guardando}
                aria-label="Guardar el total a pagar"
                onClick={guardar}
              >
                {guardando ? <span className="ln-spinner" /> : <Check />}
              </button>
              <button
                type="button"
                className="ln-iconbtn"
                aria-label="Dejar el total como estaba"
                onClick={() => setEditando(false)}
              >
                <X />
              </button>
            </motion.span>
          ) : (
            <span style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
              <b className="ln-t-body" style={{ color: total === null ? 'var(--text-muted)' : undefined }}>
                {total === null ? 'Sin definir' : moneda(total)}
              </b>
              {puedeEditar && (
                <button
                  type="button"
                  className="ln-iconbtn"
                  style={{ width: 32, height: 32 }}
                  aria-label={total === null ? 'Poner el total a pagar' : 'Corregir el total a pagar'}
                  title={total === null ? 'Poner el total a pagar' : 'Corregir el total a pagar'}
                  onClick={abrir}
                >
                  <Pencil />
                </button>
              )}
            </span>
          )}
          {total === null && !editando && (
            <small className="ln-t-caption ln-muted" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
              {`Nadie lo cargó. Por lo cobrado y lo que debe hoy, serían ${moneda(sugerido)}.`}
            </small>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          <span>
            <small className="ln-t-caption ln-muted" style={{ display: 'block' }}>Pagado</small>
            <b className="ln-t-body">{moneda(cobro?.pagado)}</b>
          </span>
          <span>
            <small className="ln-t-caption ln-muted" style={{ display: 'block' }}>Último pago</small>
            <b className="ln-t-body">{soloDia(cobro?.ultimo_pago) || '—'}</b>
          </span>
        </div>
      </div>
    </div>
  );
}

// El programa del cliente, arriba de la deuda porque es de lo que dependen las otras dos acciones:
// el plan de cuotas cuelga del par (cliente, programa) y un pago necesita el prefijo del programa
// para declarar su tipo. Un cliente en «Sin programa» las tenía las dos a medias.
//
// Guardar reetiqueta las ventas del cliente, que es donde el programa vive de verdad — se avisa,
// porque no es un campo suelto de esta pantalla.
function CampoPrograma({ cobro, programas, puedeEditar, onGuardar }) {
  const [eligiendo, setEligiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const opciones = programas || [];
  const actual = cobro?.programa_code || '';
  const nombre = cobro?.programa_nombre || null;

  const elegir = async (codigo) => {
    if (!codigo || codigo === actual) {
      setEligiendo(false);
      return;
    }
    setGuardando(true);
    try {
      await onGuardar?.(codigo);
      setEligiendo(false);
    } catch {
      // El aviso del cascarón ya lo dice (ej. "tiene ventas de más de un programa"): el
      // desplegable se queda abierto para elegir otro o cerrarlo.
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <small className="ln-t-caption ln-muted" style={{ display: 'block' }}>Programa</small>
      {eligiendo ? (
        <span style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-2)' }}>
          <span className="ln-field" style={{ maxWidth: 220 }}>
            <select
              autoFocus
              defaultValue={actual}
              disabled={guardando}
              aria-label="Programa que compró el cliente"
              onChange={(e) => elegir(e.target.value)}
            >
              <option value="">Elegí el programa…</option>
              {opciones.map((p) => <option key={p.clave} value={p.clave}>{p.label}</option>)}
            </select>
          </span>
          {guardando ? <span className="ln-spinner" /> : (
            <button type="button" className="ln-iconbtn" style={{ width: 32, height: 32 }}
              aria-label="Dejar el programa como estaba" onClick={() => setEligiendo(false)}>
              <X />
            </button>
          )}
        </span>
      ) : (
        <span style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <b className="ln-t-body" style={{ color: nombre ? undefined : 'var(--text-muted)' }}>
            {nombre || 'Sin programa'}
          </b>
          {puedeEditar && opciones.length > 0 && (
            <button
              type="button"
              className="ln-iconbtn"
              style={{ width: 32, height: 32 }}
              aria-label={nombre ? 'Corregir el programa' : 'Asignar el programa'}
              title={nombre ? 'Corregir el programa' : 'Asignar el programa'}
              onClick={() => setEligiendo(true)}
            >
              <Pencil />
            </button>
          )}
        </span>
      )}
      {!nombre && !eligiendo && (
        <small className="ln-t-caption ln-muted" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
          Sin programa no se puede armar el plan de cuotas ni registrar una cuota. Asignarlo
          reetiqueta las ventas de este cliente.
        </small>
      )}
    </div>
  );
}
