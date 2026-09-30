// Pestaña «Fulfillment»: cómo le está yendo al alumno dentro de la Academia (Learnation).
//
// Es la contracara de Acciones — una cobra, la otra entrega. Hasta ahora, después de darle el
// acceso, el closer quedaba ciego: para saber si el alumno entró, cuánto avanzó o cuándo se le
// vence el producto había que abrir la otra plataforma.
//
// Pide sus datos APARTE de la ficha (`onConsultar('fulfillment')`) porque son de otro sistema:
// tienen su propio tiempo de espera y su propio modo de fallar, y ninguno de los dos puede
// tumbar el modal. Por eso esta pestaña tiene carga y error propios en vez de apoyarse en los
// del cascarón.

import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, GraduationCap, RefreshCw } from 'lucide-react';
import { soloDia } from '../piezas/fecha';
import { Hueso } from '../../huesos/Huesos';

const pct = (n) => `${Math.round(Number(n) || 0)}%`;
const horas = (n) => `${Math.round((Number(n) || 0) * 10) / 10} h`;

/** Las métricas del `performance` de la Academia, con el formato de cada una. */
const METRICAS = [
  { clave: 'progress_percentage', label: 'Progreso', formato: pct },
  { clave: 'completed_lessons', label: 'Lecciones hechas', formato: (v, d) => `${v ?? 0} de ${d?.total_lessons ?? '—'}` },
  { clave: 'streak_days', label: 'Racha', formato: (v) => `${v ?? 0} ${v === 1 ? 'día' : 'días'}` },
  { clave: 'total_study_hours', label: 'Horas de estudio', formato: horas },
  { clave: 'approval_rate', label: 'Tasa de aprobación', formato: pct },
  { clave: 'submitted_executions', label: 'Entregas', formato: (v) => `${v ?? 0}` },
  { clave: 'group_sessions_attended', label: 'Sesiones grupales', formato: (v) => `${v ?? 0}` },
  { clave: 'individual_sessions_attended', label: 'Sesiones 1 a 1', formato: (v) => `${v ?? 0}` },
];

const Dato = ({ rotulo, valor, tono = undefined }) => (
  <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
    <small className="ln-t-caption ln-muted">{rotulo}</small>
    <b className="ln-t-body" style={{ color: tono }}>{valor}</b>
  </div>
);

const PanelHuesos = () => (
  <div className="ln-panel ln-panel--sm" aria-hidden="true">
    <Hueso alto={22} ancho="38%" />
    <Hueso alto={64} paso={1} style={{ marginTop: 'var(--space-4)' }} />
  </div>
);

/** El producto tiene fecha de vencimiento: es el dato por el que se abre esta pestaña. */
function Producto({ p }) {
  const dias = p.days_remaining;
  const vigente = p.is_active;
  // Menos de 15 días es la ventana en la que hay que ir a renovar, no cuando ya venció.
  const tono = !vigente ? 'var(--error)' : (dias != null && dias <= 15) ? 'var(--warning)' : 'var(--success)';
  return (
    <div className="ln-table-row">
      <span className="ln-cell-label">
        {p.product_name || p.product_slug || 'Producto'}
        {/* `ln-cell-sublabel` no trae `display`, asi que el programa se pegaba al nombre
            del producto en la misma linea. */}
        {p.program_name && <span className="ln-cell-sublabel" style={{ display: 'block' }}>{p.program_name}</span>}
      </span>
      <span className="ln-t-body-sm">{p.expires_at ? soloDia(p.expires_at) : 'Sin vencimiento'}</span>
      <span className="ln-t-body-sm" style={{ color: tono, fontWeight: 700 }}>
        {vigente
          ? (dias != null ? `${dias} ${dias === 1 ? 'día' : 'días'}` : 'Activo')
          : 'Vencido'}
        {p.is_deposit ? ' · seña' : ''}
      </span>
    </div>
  );
}

export default function TabFulfillment({ ficha, onConsultar }) {
  const reducido = useReducedMotion();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(null);

  const pedir = useCallback(async () => {
    setCargando(true);
    setFallo(null);
    try {
      setDatos(await onConsultar?.('fulfillment'));
    } catch (e) {
      // Esto es que NeurOPS no contestó. Que la Academia no conteste viaja DENTRO de la
      // respuesta, en `error`: son dos fallas distintas y se cuentan distinto.
      setFallo(e?.response?.data?.message || e?.message || 'No se pudo consultar la Academia');
    } finally {
      setCargando(false);
    }
  }, [onConsultar]);

  useEffect(() => { pedir(); }, [pedir]);

  const animar = reducido
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.18, ease: 'easeOut' } };

  if (cargando && !datos) return <PanelHuesos />;

  const error = fallo || datos?.error?.motivo;
  const alumno = datos?.alumno;
  const desempeno = datos?.desempeno;
  const probados = datos?.emails_probados || [];

  return (
    <motion.div {...animar} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {error && (
        <div className="ln-alert ln-alert--error" role="alert">
          <span className="ln-alert-ico"><AlertTriangle /></span>
          <span className="ln-alert-body"><span className="ln-alert-title">{error}</span></span>
          {/* El `.btn` de la ficha: el `.ln-btn` del DS perdía el borde contra `.dc-shell button`
              y se leía como texto suelto. Chico porque vive dentro del aviso, al lado de una línea. */}
          <button type="button" className="btn btn--linea btn--sm" onClick={pedir}>
            <RefreshCw />
            Reintentar
          </button>
        </div>
      )}

      {!error && !datos?.vinculado && (
        <div className="vacio-grande">
          <span className="vacio-icono"><GraduationCap /></span>
          <p className="t-h3">Este cliente todavía no es alumno en la Academia</p>
          <p className="t-sm mut">
            {probados.length
              ? `No hay ninguna cuenta con ${probados.length === 1 ? 'su correo' : 'ninguno de sus correos'}: ${probados.join(', ')}.`
              : 'No tenemos ningún correo real suyo, y el cruce con la Academia es por correo.'}
            {' '}El alta se hace desde el historial del cliente, en «Acceso a la Academia».
          </p>
        </div>
      )}

      {datos?.vinculado && alumno && (
        <>
          <div className="ln-panel ln-panel--sm">
            <small className="ln-t-eyebrow ln-muted">Alumno</small>
            <p className="ln-t-h3" style={{ margin: 'var(--space-2) 0 var(--space-4)' }}>
              {alumno.nombre || 'Sin nombre'}
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
              <Dato rotulo="Producto activo" valor={alumno.producto_activo?.name || 'Ninguno'}
                tono={alumno.producto_activo ? undefined : 'var(--text-muted)'} />
              <Dato rotulo="Correo en la Academia" valor={alumno.email || '—'} />
              <Dato rotulo="Teléfono"
                valor={alumno.telefono || '—'}
                tono={datos.telefono_coincide === false ? 'var(--warning)' : undefined} />
            </div>
            {/* El teléfono no sirve para BUSCAR al alumno —la Academia sólo cruza por correo—,
                pero que no coincida es justo lo que hay que ver acá: es por donde se le escribe. */}
            {datos.telefono_coincide === false && (
              <small className="ln-t-caption" style={{ color: 'var(--warning)', display: 'block', marginTop: 'var(--space-3)' }}>
                {`El teléfono en la Academia no coincide con el de acá (${ficha?.identidad?.telefono || 'sin teléfono'}).`}
              </small>
            )}
            {datos.email_usado && datos.email_usado !== ficha?.identidad?.email && (
              <small className="ln-t-caption ln-muted" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
                {`Se lo encontró con ${datos.email_usado}, que no es el correo cargado en la ficha.`}
              </small>
            )}
          </div>

          {desempeno && (
            <div className="ln-panel ln-panel--sm">
              <small className="ln-t-eyebrow ln-muted">Cómo va</small>
              <div className="ln-grid ln-grid-4" style={{ marginTop: 'var(--space-4)' }}>
                {METRICAS.map((m) => (
                  <Dato key={m.clave} rotulo={m.label} valor={m.formato(desempeno[m.clave], desempeno)} />
                ))}
              </div>
              {desempeno.open_support_tickets > 0 && (
                <small className="ln-t-caption" style={{ color: 'var(--warning)', display: 'block', marginTop: 'var(--space-4)' }}>
                  {`Tiene ${desempeno.open_support_tickets} ticket(s) de soporte sin resolver.`}
                </small>
              )}
            </div>
          )}

          <div className="ln-panel ln-panel--sm">
            <small className="ln-t-eyebrow ln-muted">Productos y vencimientos</small>
            <div className="ln-table" style={{ '--cols': '1.6fr 1fr 1fr', marginTop: 'var(--space-4)' }}>
              <div className="ln-table-head">
                <span>Producto</span>
                <span>Vence</span>
                <span>Estado</span>
              </div>
              {datos.productos.length
                ? datos.productos.map((p) => <Producto key={p.assignment_id} p={p} />)
                : <p className="ln-t-body-sm ln-muted">Sin ningún producto asignado.</p>}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
