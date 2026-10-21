// El reporte de una Momentum de la Academia en la pestaña «Resultado»: ¿Asistió? → ¿Continúa? → motivo,
// todo en una pantalla. Lo que pide y cómo se arma el pedido lo dice `arbolMomentum.js`; la escritura va
// por `onAccion`, como el resto de la ficha. «Reporte completo» vuelve al árbol de siempre (la venta, el
// seguimiento) para el caso raro que lo necesite.

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, History, RotateCcw, ListTree } from 'lucide-react';
import {
  ASISTENCIA_MOMENTUM, elegirAsistencia, faltantesMomentum, motivoRequerido, opcionesContinua, payloadMomentum,
} from '../arbolMomentum';

const ETIQUETA_TIPO = { sena: 'Momentum de seña', cierre: 'Momentum de cierre' };

function Opciones({ titulo, opciones, valor, onElegir }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 'var(--space-3)' }}>
      <legend className="ln-t-h3" style={{ marginBottom: 'var(--space-3)' }}>{titulo}</legend>
      <div className="ln-grid ln-grid-4">
        {opciones.map((o) => {
          const activa = valor === o.valor;
          return (
            <button
              key={o.valor}
              type="button"
              aria-pressed={activa}
              onClick={() => onElegir(o.valor)}
              style={{
                display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: 'flex-start',
                textAlign: 'left', padding: 'var(--space-4)', cursor: 'pointer', borderRadius: 'var(--radius-control)',
                background: activa ? `var(--${o.tono}-surface)` : 'var(--bg-element)',
                border: `1px solid ${activa ? `var(--${o.tono}-border)` : 'var(--border-control)'}`,
                color: 'var(--text-on-surface)',
              }}
            >
              <b className="ln-t-body">{o.label}</b>
              {o.sub && <small className="ln-t-caption ln-muted">{o.sub}</small>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Campo({ id, label, children }) {
  return (
    <div className="ln-field-wrap">
      <small id={id} className="ln-field-label" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</small>
      {children}
    </div>
  );
}

export default function ResultadoMomentum({ momentum, onAccion, irA, onGenerico }) {
  const [r, setR] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(false);
  const faltan = faltantesMomentum(r);
  const requerido = motivoRequerido(r);
  const previo = momentum?.reporte;

  const guardar = async () => {
    const { accion, datos } = payloadMomentum(r);
    setGuardando(true);
    setError(null);
    try {
      await onAccion(accion, datos);
      setHecho(true);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'No se pudo guardar el reporte');
    } finally {
      setGuardando(false);
    }
  };

  if (hecho) {
    return (
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <div className="ln-panel ln-panel--sm" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <CheckCircle2 size={20} aria-hidden="true" style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
          <span style={{ display: 'grid', gap: 'var(--space-1)' }}>
            <b className="ln-t-body">Reporte de la Momentum guardado</b>
            <small className="ln-t-body-sm ln-muted">La Academia ya lo recibe. Ya podés cerrar la ficha.</small>
          </span>
        </div>
        <div className="fi-botonera">
          {irA && <button type="button" className="btn btn--linea" onClick={() => irA('hist')}><History /> Ver historial</button>}
          <button type="button" className="btn btn--linea" onClick={() => { setHecho(false); setR({}); }}><RotateCcw /> Reportar de nuevo</button>
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Reporte de la Momentum" style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <p className="ln-t-body-sm ln-muted" style={{ margin: 0 }}>
        {ETIQUETA_TIPO[momentum?.tipo] || 'Momentum'}{momentum?.sesion ? ` · ${momentum.sesion}` : ''}
        {previo ? ' · ya tiene un reporte: si lo guardás de nuevo, se reemplaza.' : ''}
      </p>

      {error && (
        <div className="ln-alert ln-alert--error" role="alert">
          <span className="ln-alert-ico"><AlertTriangle /></span>
          <span className="ln-alert-body"><span className="ln-alert-title">{error}</span></span>
        </div>
      )}

      <Opciones titulo="¿Asistió?" opciones={ASISTENCIA_MOMENTUM} valor={r.asistencia}
        onElegir={(v) => setR((prev) => elegirAsistencia(prev, v))} />

      {r.asistencia === 'asistio' && (
        <Opciones titulo="¿Continúa?" opciones={opcionesContinua(momentum?.tipo)} valor={r.resultado}
          onElegir={(v) => setR((prev) => ({ ...prev, resultado: v }))} />
      )}

      {r.asistencia === 'reagenda' && (
        <div className="ln-grid ln-grid-2">
          <Campo id="mo-fecha-l" label="Nueva fecha">
            <span className="ln-field">
              <input type="date" aria-labelledby="mo-fecha-l" value={r.fecha || ''} onChange={(e) => setR((prev) => ({ ...prev, fecha: e.target.value }))} />
            </span>
          </Campo>
          <Campo id="mo-hora-l" label="Hora">
            <span className="ln-field">
              <input type="time" aria-labelledby="mo-hora-l" value={r.hora || ''} onChange={(e) => setR((prev) => ({ ...prev, hora: e.target.value }))} />
            </span>
          </Campo>
        </div>
      )}

      {r.asistencia && (
        <Campo id="mo-motivo-l" label={requerido ? 'Motivo' : 'Motivo (opcional)'}>
          <span className="ln-field" style={{ height: 'auto', padding: 'var(--space-3) var(--space-4)' }}>
            <textarea rows={3} maxLength={1000} aria-labelledby="mo-motivo-l" aria-required={requerido ? 'true' : undefined}
              value={r.motivo || ''} onChange={(e) => setR((prev) => ({ ...prev, motivo: e.target.value }))} style={{ resize: 'vertical' }} />
          </span>
        </Campo>
      )}

      {r.asistencia && faltan.length > 0 && (
        <ul className="ln-t-body-sm ln-muted" style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
          {faltan.map((f) => <li key={f}>{f}</li>)}
        </ul>
      )}

      <div className="ln-btn-row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="btn btn--linea" onClick={onGenerico}><ListTree /> Reporte completo</button>
        <button type="button" className="btn btn--cta" disabled={guardando || faltan.length > 0} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar reporte'}
        </button>
      </div>
    </section>
  );
}
