// Formulario chico y declarativo: una lista de campos, lo que falta para poder guardar, y el CTA.
// Lo comparten las sub-vistas de cobro (pago, seguimiento, baja) para que las tres validen y se
// vean igual sin repetir markup.

import { AlertTriangle } from 'lucide-react';
import CampoArbol from './CampoArbol';

/** Qué falta para poder guardar, en palabras. Mismo criterio que el árbol de resultado. */
export function faltantesDe(campos, valores) {
  return campos.filter((c) => c.requerido).map((c) => {
    const valor = valores[c.campo];
    if (c.tipo === 'monto') {
      const n = parseFloat(valor);
      return Number.isNaN(n) || n <= 0 ? `Cargá ${c.label}` : null;
    }
    const vacio = valor === undefined || valor === null || valor === ''
      || (Array.isArray(valor) && valor.length === 0);
    return vacio ? `Completá ${c.label}` : null;
  }).filter(Boolean);
}

export default function FormularioSimple({
  campos, valores, onCambio, cta, onGuardar, guardando = false, extra = null, faltantesExtra = [],
}) {
  const faltan = [...faltantesDe(campos, valores), ...faltantesExtra];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {campos.map((campo) => (
          <CampoArbol key={campo.campo} campo={campo} respuestas={valores} onCambio={onCambio} />
        ))}
      </div>

      {extra}

      {faltan.length > 0 && (
        <div className="ln-alert ln-alert--warning" role="status">
          <span className="ln-alert-ico"><AlertTriangle /></span>
          <span className="ln-alert-body">
            <span className="ln-alert-title">Falta para poder guardar</span>
            <span className="ln-alert-desc">
              <ul style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
                {faltan.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </span>
          </span>
        </div>
      )}

      {/* El widget de bugs flota abajo a la derecha: se le dejan sus ~168 px. */}
      <div className="ln-btn-row" style={{ justifyContent: 'flex-end', paddingRight: 168 }}>
        <button type="button" className="ln-btn ln-btn--cta" disabled={faltan.length > 0 || guardando} onClick={onGuardar}>
          {guardando && <span className="ln-spinner" />}
          {cta}
        </button>
      </div>
    </div>
  );
}
