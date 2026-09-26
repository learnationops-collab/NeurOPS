// Un campo del árbol, pintado según su `tipo`. Vive aparte para que `TabResultado` no tenga que
// saber cómo se dibuja un monto o un grupo de píldoras: solo pide «pintá estos campos».

import { Plus, X } from 'lucide-react';
import { SelectorFecha } from './piezas';

const Pildora = ({ activo, children, onClick }) => (
  <button
    type="button"
    aria-pressed={activo}
    onClick={onClick}
    className="ln-chip ln-chip--sm"
    style={{
      cursor: 'pointer',
      background: activo ? 'var(--brand-secondary)' : 'transparent',
      borderColor: activo ? 'var(--brand-secondary)' : 'var(--border-control)',
      color: activo ? 'var(--ink)' : 'var(--text-on-surface)',
    }}
  >
    {children}
  </button>
);

// `<small>` y no `<span>`: el CSS global con !important anula el tracking fuerte en span/div.
const Rotulo = ({ children, id }) => (
  <small id={id} className="ln-field-label" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>
    {children}
  </small>
);

export default function CampoArbol({ campo, respuestas, onCambio, cuotas = [] }) {
  const valor = respuestas[campo.campo];
  const set = (v) => onCambio({ [campo.campo]: v });
  const idRotulo = `campo-${campo.campo}`;

  if (campo.tipo === 'mapa') return null; // lo pinta el cronograma de cuotas

  if (campo.tipo === 'booleano') {
    return (
      <label className="ln-choice" style={{ cursor: 'pointer' }}>
        <input
          type="checkbox"
          className="ln-choice-input"
          checked={valor === true}
          onChange={(e) => set(e.target.checked)}
        />
        <span className="ln-choice-text"><span className="ln-choice-label">{campo.label}</span></span>
      </label>
    );
  }

  if (campo.tipo === 'opcion' || campo.tipo === 'multiple') {
    const multiple = campo.tipo === 'multiple';
    const lista = campo.opciones || [];
    return (
      <div className="ln-field-wrap" role="group" aria-labelledby={idRotulo}>
        <Rotulo id={idRotulo}>{campo.label}</Rotulo>
        <div className="ln-btn-row">
          {lista.map((o) => {
            const activo = multiple ? (valor || []).includes(o) : valor === o;
            return (
              <Pildora
                key={o}
                activo={activo}
                onClick={() => set(multiple
                  ? (activo ? (valor || []).filter((v) => v !== o) : [...(valor || []), o])
                  : o)}
              >
                {campo.etiquetas?.[o] || o}
              </Pildora>
            );
          })}
        </div>
      </div>
    );
  }

  if (campo.tipo === 'filas') {
    const filas = valor || [];
    const cambiar = (i, clave, v) => set(filas.map((f, j) => (j === i ? { ...f, [clave]: v } : f)));
    return (
      <div className="ln-field-wrap">
        <Rotulo id={idRotulo}>{campo.label}</Rotulo>
        {filas.map((fila, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            {campo.columnas.map((col) => (
              <span key={col} className="ln-field" style={{ flex: 1 }}>
                <input
                  value={fila[col] || ''}
                  placeholder={col === 'nombre' ? 'Nombre del referido' : '@instagram o teléfono'}
                  aria-label={`${col} del referido ${i + 1}`}
                  onChange={(e) => cambiar(i, col, e.target.value)}
                />
              </span>
            ))}
            <button
              type="button"
              className="ln-iconbtn"
              aria-label={`Quitar el referido ${i + 1}`}
              onClick={() => set(filas.filter((_, j) => j !== i))}
            >
              <X />
            </button>
          </div>
        ))}
        <button type="button" className="ln-btn ln-btn--ghost ln-btn--sm" onClick={() => set([...filas, {}])}>
          <Plus /> Agregar otro
        </button>
      </div>
    );
  }

  if (campo.tipo === 'cuota') {
    if (!cuotas.length) return null;
    return (
      <div className="ln-field-wrap">
        <Rotulo id={idRotulo}>{campo.label}</Rotulo>
        <span className="ln-field">
          <select
            value={valor || ''}
            aria-labelledby={idRotulo}
            onChange={(e) => set(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Sin elegir</option>
            {cuotas.map((c) => (
              <option key={c.id} value={c.id}>
                {`Cuota ${c.numero_cuota} · ${c.fecha_vencimiento} · ${c.monto} · ${c.estado}`}
              </option>
            ))}
          </select>
        </span>
      </div>
    );
  }

  if (campo.tipo === 'parrafo') {
    return (
      <div className="ln-field-wrap">
        <Rotulo id={idRotulo}>{campo.label}</Rotulo>
        <span className="ln-field" style={{ height: 'auto', padding: 'var(--space-3) var(--space-4)' }}>
          <textarea
            rows={3}
            value={valor || ''}
            aria-labelledby={idRotulo}
            onChange={(e) => set(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </span>
        {campo.minimoTexto && (
          <small className="ln-field-hint">
            {`Mínimo ${campo.minimoTexto} caracteres · llevás ${String(valor || '').trim().length}`}
          </small>
        )}
      </div>
    );
  }

  if (campo.tipo === 'fecha') {
    return (
      <div className="ln-field-wrap">
        <Rotulo id={idRotulo}>{campo.label}</Rotulo>
        <SelectorFecha valor={valor || ''} onChange={set} presets={campo.presets || []} />
      </div>
    );
  }

  const tipoHtml = campo.tipo === 'monto' || campo.tipo === 'entero' ? 'number'
    : campo.tipo === 'hora' ? 'time'
      : campo.tipo === 'email' ? 'email'
        : campo.tipo === 'tel' ? 'tel' : 'text';

  return (
    <div className="ln-field-wrap">
      <Rotulo id={idRotulo}>{campo.label}</Rotulo>
      <span className={`ln-field${campo.invalido ? ' ln-field--invalid' : ''}`}>
        {campo.prefijo && <span className="ln-unit">{campo.prefijo}</span>}
        <input
          type={tipoHtml}
          inputMode={tipoHtml === 'number' ? 'decimal' : undefined}
          step={campo.tipo === 'monto' ? '0.01' : undefined}
          min={campo.minimo ?? undefined}
          value={valor ?? ''}
          aria-labelledby={idRotulo}
          aria-required={campo.requerido ? 'true' : undefined}
          onChange={(e) => set(campo.tipo === 'entero' && e.target.value !== ''
            ? Number(e.target.value) : e.target.value)}
        />
        {campo.tipo === 'monto' && <span className="ln-unit">USD</span>}
      </span>
    </div>
  );
}
