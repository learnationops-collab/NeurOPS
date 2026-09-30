// Un campo del árbol, pintado según su `tipo`. Vive aparte para que `TabResultado` no tenga que
// saber cómo se dibuja un monto o un grupo de píldoras: solo pide «pintá estos campos».

import { motion, useReducedMotion } from 'framer-motion';
import { Check, Minus, Plus, X } from 'lucide-react';
import { SelectorFecha } from './piezas';
import { fechaCorta } from '../arbolResultado.venta';
import { moneda } from './planCuotas';

// La `.pastilla` de la ficha, con la elegida en blanco lleno (`.fi-elegible`, en `ficha.css`).
// Era un `.ln-chip` y dentro de `.dc-shell` perdía el borde y el aire: se leía como una palabra
// suelta. El apretón es de framer-motion para que respete el movimiento reducido.
const Pildora = ({ activo, children, onClick }) => {
  const reducido = useReducedMotion();
  return (
    <motion.button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className="pastilla fi-elegible"
      whileTap={reducido ? undefined : { scale: 0.96 }}
    >
      {children}
    </motion.button>
  );
};

// `<small>` y no `<span>`: el CSS global con !important anula el tracking fuerte en span/div.
const Rotulo = ({ children, id }) => (
  <small id={id} className="ln-field-label" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>
    {children}
  </small>
);

// De dónde salió el dato, como en el wizard de venta: lo que vino de la agenda se revisa, lo que
// no, se carga. Es lo que le dice al closer cuál de las pantallas tiene que mirar con atención.
const ORIGENES = {
  agenda: { texto: '✓ Traído de la agenda', color: 'var(--success)' },
  vos: { texto: '● Este lo cargás vos', color: 'var(--warning)' },
  corregido: { texto: '✎ Corregido por vos', color: 'var(--info)' },
};

const Origen = ({ origen }) => (ORIGENES[origen] ? (
  <small className="ln-t-caption" style={{ color: ORIGENES[origen].color }}>{ORIGENES[origen].texto}</small>
) : null);

const ESTADO_CUOTA = { vencido: 'Vencida', pendiente: 'Pendiente' };

export default function CampoArbol({
  campo, respuestas, onCambio, cuotas = [], autoFocus = false, onEnter = null, origen = null,
}) {
  const valor = respuestas[campo.campo];
  const set = (v) => onCambio({ [campo.campo]: v });
  const idRotulo = `campo-${campo.campo}`;
  // Enter confirma el paso, como «Siguiente» en el wizard: en una pregunta por pantalla el closer
  // espera poder seguir con el teclado. En un párrafo no, ahí Enter es un salto de línea.
  const alEnter = onEnter ? (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    onEnter();
  } : undefined;

  if (campo.tipo === 'mapa') return null; // lo pinta el cronograma de cuotas

  if (campo.tipo === 'contador') {
    const minimo = campo.minimo ?? 1;
    const maximo = campo.maximo ?? 12;
    const n = Math.max(minimo, Math.min(maximo, Math.trunc(Number(valor) || minimo)));
    return (
      <div className="ln-field-wrap" role="group" aria-labelledby={idRotulo}>
        <Rotulo id={idRotulo}>{campo.label}</Rotulo>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          {/* `.ibtn` y no `.ln-iconbtn`: dentro de `.dc-shell` el del DS pierde el borde. */}
          <button type="button" className="ibtn" aria-label="Una cuota menos"
            disabled={n <= minimo} onClick={() => set(n - 1)}><Minus /></button>
          <b className="ln-t-h2 ln-mono" aria-live="polite" style={{ minWidth: '2ch', textAlign: 'center' }}>{n}</b>
          <button type="button" className="ibtn" aria-label="Una cuota más"
            disabled={n >= maximo} onClick={() => set(n + 1)}><Plus /></button>
        </div>
        {campo.atajos?.length > 0 && (
          <div className="ln-btn-row">
            {campo.atajos.map((k) => (
              <Pildora key={k} activo={n === k} onClick={() => set(k)}>{`${k} cuotas`}</Pildora>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (campo.tipo === 'dia_mes') {
    return (
      <div className="ln-field-wrap" role="group" aria-labelledby={idRotulo}>
        <Rotulo id={idRotulo}>{campo.label}</Rotulo>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 'var(--space-1)', maxWidth: 360 }}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => (
            <Pildora key={dia} activo={Number(valor) === dia} onClick={() => set(dia)}>{dia}</Pildora>
          ))}
        </div>
      </div>
    );
  }

  if (campo.tipo === 'booleano') {
    // La estructura es la del design system: el input nativo queda invisible encima y lo que se
    // ve es `.ln-check`. Sin ese hermano la casilla no se dibujaba y el aviso por WhatsApp del
    // seguimiento se prendía a ciegas.
    return (
      <label className="ln-choice" style={{ display: 'block' }}>
        <input
          type="checkbox"
          className="ln-choice-input"
          checked={valor === true}
          onChange={(e) => set(e.target.checked)}
        />
        <span className="ln-choice-label">
          <span className="ln-check" aria-hidden="true"><Check /></span>
          <span className="ln-choice-text">{campo.label}</span>
        </span>
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
          // La fila no tiene identidad propia: es su posicion en la lista.
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
            {/* El `.ibtn` de la ficha: el `.ln-iconbtn` del DS perdía el borde y el fondo contra
                `.dc-shell button` y la cruz quedaba suelta al lado de los campos. */}
            <button
              type="button"
              className="ibtn"
              aria-label={`Quitar el referido ${i + 1}`}
              onClick={() => set(filas.filter((_, j) => j !== i))}
            >
              <X />
            </button>
          </div>
        ))}
        {/* Una herramienta del campo, no un guardado: la pastilla con contorno, como «Repartir en
            partes iguales». Con `alignSelf` no se estira a todo el ancho de la columna. */}
        <button type="button" className="pastilla pastilla--sm" style={{ alignSelf: 'flex-start' }}
          onClick={() => set([...filas, {}])}>
          <Plus aria-hidden="true" /> Agregar otro
        </button>
      </div>
    );
  }

  if (campo.tipo === 'cuota') {
    if (!cuotas.length) return null;
    // Una fila por cuota pendiente, como la tabla del wizard: se elige tocando la fila. Elegirla
    // trae su monto a «cobrado hoy» si todavía no se había cargado nada.
    return (
      <div className="ln-field-wrap" role="radiogroup" aria-labelledby={idRotulo}>
        <Rotulo id={idRotulo}>{campo.label}</Rotulo>
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          {cuotas.map((c) => {
            const elegida = valor === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={elegida}
                onClick={() => onCambio({
                  [campo.campo]: c.id,
                  ...(respuestas.monto ? {} : { monto: String(c.monto) }),
                })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)', textAlign: 'left',
                  padding: 'var(--space-3) var(--space-4)', cursor: 'pointer',
                  borderRadius: 'var(--radius-control)', color: 'var(--text-on-surface)',
                  background: elegida ? 'var(--info-surface)' : 'var(--bg-element)',
                  border: `1px solid ${elegida ? 'var(--info)' : 'var(--border-control)'}`,
                }}
              >
                <b className="ln-t-body" style={{ minWidth: 72 }}>{`Cuota ${c.numero_cuota}`}</b>
                <span className="ln-t-body-sm" style={{ flex: 1 }}>{`Vence ${fechaCorta(c.fecha_vencimiento)}`}</span>
                <b className="ln-t-body">{moneda(c.monto)}</b>
                <small className="ln-t-caption" style={{ color: c.estado === 'vencido' ? 'var(--error)' : 'var(--text-muted)', minWidth: 64 }}>
                  {ESTADO_CUOTA[c.estado] || c.estado}
                </small>
                {elegida && <Check size={16} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
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
    // Sin `sinMinimo` el selector no deja elegir antes de hoy, que es lo que se quiere para un
    // seguimiento; la fecha de una venta de ayer sí tiene que poder ser ayer.
    return (
      <div className="ln-field-wrap">
        <Rotulo id={idRotulo}>{campo.label}</Rotulo>
        <SelectorFecha
          valor={valor || ''}
          onChange={set}
          presets={campo.presets || []}
          etiqueta={campo.label}
          minimo={campo.sinMinimo ? null : undefined}
        />
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
          autoFocus={autoFocus}
          onKeyDown={alEnter}
          onChange={(e) => set(campo.tipo === 'entero' && e.target.value !== ''
            ? Number(e.target.value) : e.target.value)}
        />
        {campo.tipo === 'monto' && <span className="ln-unit">USD</span>}
      </span>
      <Origen origen={origen} />
    </div>
  );
}
