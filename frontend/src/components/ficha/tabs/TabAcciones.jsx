// Pestaña «Acciones»: el cobro post-venta. A la izquierda la deuda, a la derecha las cuatro
// acciones en grid 2×2. Cada acción es una SUB-VISTA con «Volver» dentro del mismo panel — nunca
// un modal encima de otro modal.

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CalendarDays, CheckCircle2, Clock, XCircle, AlertTriangle, X,
} from 'lucide-react';
import { TarjetaAccion } from '../acciones/piezas';
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
            <TarjetaDeuda cobro={ficha?.cobro} />
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

// La deuda es el dato que manda en esta pestaña: monto grande en rojo, y al pie lo cobrado y el
// último pago para que el closer sepa si el cliente venía pagando o no.
function TarjetaDeuda({ cobro }) {
  const deuda = Number(cobro?.deuda) || 0;
  const alDia = deuda < 0.01;
  return (
    <div className="ln-panel ln-panel--sm">
      <small className="ln-t-eyebrow ln-muted">Deuda</small>
      <p
        className="ln-t-display"
        style={{ color: alDia ? 'var(--success)' : 'var(--error)', margin: 'var(--space-2) 0 var(--space-4)' }}
      >
        {alDia ? 'Al día' : moneda(deuda)}
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
        <span>
          <small className="ln-t-caption ln-muted" style={{ display: 'block' }}>Pagado</small>
          <b className="ln-t-body">{moneda(cobro?.pagado)}</b>
        </span>
        <span>
          <small className="ln-t-caption ln-muted" style={{ display: 'block' }}>Último pago</small>
          <b className="ln-t-body">{cobro?.ultimo_pago || '—'}</b>
        </span>
      </div>
    </div>
  );
}
