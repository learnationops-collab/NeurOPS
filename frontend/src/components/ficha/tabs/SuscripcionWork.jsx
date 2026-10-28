// La suscripción como la registra Work (20/10/2026): Work es la fuente de verdad del acceso, y
// cada cambio —la venta que la abrió, una renovación, la seña que pasó a completo, una prórroga
// de la Academia, una corrección a mano— queda con de qué fecha a qué fecha, por qué y quién.
// No depende de que la Academia conteste: viaja en el mismo pedido de Fulfillment.

import { SeccionColapsable, diaLegible, instanteLegible } from '../piezas';

const QUE = {
  alta: 'Alta', renovacion: 'Renovación', conversion: 'Seña → completo', extension: 'Extensión',
  prorroga: 'Prórroga', correccion: 'Corrección', quitado: 'Acceso quitado',
};

/** «1 jul 2026», o de dónde venía: «1 jul → 1 nov 2026». */
const tramo = (e) => (e.from_date ? `${diaLegible(e.from_date)} → ${diaLegible(e.to_date)}` : diaLegible(e.to_date));

/** Quién y desde dónde: «Marlon», «Academia · ana@x.com». */
const quien = (e) => [e.source === 'academia' ? 'Academia' : null, e.actor].filter(Boolean).join(' · ') || 'Automático';

function Suscripcion({ s, nombreDe }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      <div className="ful-acceso-titulo">
        <p className="ln-t-body" style={{ margin: 0, fontWeight: 700 }}>{nombreDe(s)}</p>
        <span className={`ln-chip ln-chip--sm ln-chip--${s.vigente ? 'success' : 'danger'}`}>
          {s.vigente ? `Hasta el ${diaLegible(s.expires_at)}` : `Venció el ${diaLegible(s.expires_at)}`}
        </span>
        {s.is_deposit && <span className="ln-chip ln-chip--sm ln-chip--warning">Seña</span>}
      </div>
      <div className="ln-table" style={{ '--cols': '0.9fr 1fr 1.3fr 1.6fr 1fr' }}>
        <div className="ln-table-head">
          <span>Cuándo</span>
          <span>Qué</span>
          <span>Vencimiento</span>
          <span>Motivo</span>
          <span>Quién</span>
        </div>
        {[...(s.events || [])].reverse().map((e) => (
          <div key={e.id} className="ln-table-row">
            <span className="ln-t-body-sm">{e.created_at ? instanteLegible(e.created_at) : '—'}</span>
            <span className="ln-cell-label">{QUE[e.kind] || e.kind}</span>
            <span className="ln-t-body-sm">{tramo(e)}</span>
            <span className="ln-t-body-sm">{e.reason || '—'}</span>
            <span className="ln-t-body-sm ln-muted">{quien(e)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SuscripcionWork({ suscripciones = [], programas = [] }) {
  if (!suscripciones.length) return null;
  const nombreDe = (s) => programas.find((p) => p.clave === s.program_code)?.label || s.program_code || s.product_slug;
  const principal = suscripciones[0];
  const cambios = suscripciones.reduce((n, s) => n + (s.events?.length || 0), 0);
  return (
    <SeccionColapsable titulo="Historial de la suscripción"
      resumen={`${principal.vigente ? 'Vence' : 'Venció'} el ${diaLegible(principal.expires_at)} · `
        + `${cambios} ${cambios === 1 ? 'cambio' : 'cambios'}`}>
      <p className="t-sm mut" style={{ margin: '0 0 var(--s3)' }}>
        Lo que Work registra del acceso: la venta lo abre (7 días si es seña), los pagos y las
        renovaciones lo extienden, y la Academia puede dar prórrogas. Cada cambio queda acá.
      </p>
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        {suscripciones.map((s) => <Suscripcion key={s.id} s={s} nombreDe={nombreDe} />)}
      </div>
    </SeccionColapsable>
  );
}
