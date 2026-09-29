// El editor del plan de cuotas: total, cantidad en píldoras, cronograma editable y cuadre.
//
// Vive aparte del `SubVista` que lo envolvía porque ahora se monta en DOS lugares: la acción
// «Armar plan de cuotas» y, en línea, la sección «Plan de cuotas» del historial — que es donde el
// closer lo está mirando cuando se da cuenta de que hay que corregirlo, y desde donde antes había
// que saltar a otra pestaña para tocarlo.
//
// Dos montajes, UN editor. Es la diferencia entre tener el plan en dos lugares y tener dos
// verdades sobre el plan: la aritmética la hace `planCuotas.js` (testeada aparte) y el guardado
// es la misma acción `guardar_plan` con el mismo payload.

import { useState } from 'react';
import CronogramaCuotas from './CronogramaCuotas';
import {
  CANTIDADES_SUGERIDAS, redimensionar, repartirParejo, sumarMeses, moneda, cuadre,
} from './planCuotas';

export const primeraFechaPorDefecto = () => {
  const d = new Date();
  return sumarMeses(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-10`, 1);
};

// Un plan que ya existe se edita tal cual está; si no hay plan se arranca con la deuda repartida.
export function filasIniciales(cuotas, deuda) {
  if (cuotas?.length) {
    return cuotas.map((c) => ({
      id: c.id,
      fecha: c.fecha_vencimiento || '',
      monto: c.monto ?? 0,
      // `to_dict()` deriva 'vencido' de una cuota pendiente que ya venció: se respeta.
      estado: c.estado || 'pendiente',
    }));
  }
  const inicio = primeraFechaPorDefecto();
  return repartirParejo(1, deuda).map((monto, i) => ({ fecha: sumarMeses(inicio, i), monto, estado: 'pendiente' }));
}

const Rotulo = ({ children }) => (
  <small className="ln-field-label" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>
    {children}
  </small>
);

/**
 * `children` recibe `{ boton }`: el botón de guardar ya armado, con su estado y su texto. Así cada
 * montaje lo pone donde le corresponde —la sub-vista en su cabecera, el historial al pie— sin que
 * el editor tenga que saber en cuál de los dos está.
 */
export default function PlanCuotasForm({ ficha, onGuardar, guardando, children }) {
  const cobro = ficha?.cobro || {};
  const deuda = Number(cobro.deuda) || 0;
  const [total, setTotal] = useState(() => (cobro.cuotas?.length
    ? cobro.cuotas.reduce((a, c) => a + (Number(c.monto) || 0), 0)
    : deuda));
  const [filas, setFilas] = useState(() => filasIniciales(cobro.cuotas, deuda));

  const estado = cuadre(total, filas);
  const elegirCantidad = (n) => setFilas(redimensionar(filas, n, total, primeraFechaPorDefecto()));
  const cambiarTotal = (v) => {
    setTotal(v);
    // Cambiar el total sin recalcular dejaba el plan descuadrado en silencio.
    setFilas((prev) => redimensionar(prev, prev.length, Number(v) || 0, primeraFechaPorDefecto()));
  };

  // El backend reconcilia por `id`: una cuota que ya existe se actualiza en su sitio y por eso
  // un plan con cobros se puede corregir. Una fila nueva viaja con `id: null`.
  const guardar = () => onGuardar({
    programa_code: cobro.programa_code || null,
    total: Number(total) || 0,
    cuotas: filas.map((f) => ({
      id: f.id ?? null,
      monto: Number(f.monto) || 0,
      fecha_vencimiento: f.fecha || null,
      estado: f.estado || 'pendiente',
    })),
  });

  const sinFecha = filas.some((f) => !f.fecha);

  const boton = (
    <button
      type="button"
      className="ln-btn ln-btn--cta ln-btn--sm"
      disabled={guardando || filas.length === 0 || sinFecha}
      title={sinFecha ? 'Cada cuota necesita su fecha de cobro' : undefined}
      onClick={guardar}
    >
      {guardando && <span className="ln-spinner" />}
      {`Guardar plan de ${filas.length} ${filas.length === 1 ? 'cuota' : 'cuotas'}`}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="ln-field-wrap" style={{ maxWidth: 280 }}>
        <Rotulo>Total del plan</Rotulo>
        <span className="ln-field">
          <input
            type="number"
            min="0"
            step="0.01"
            value={total}
            aria-label="Total del plan"
            onChange={(e) => cambiarTotal(e.target.value)}
          />
          <span className="ln-unit">USD</span>
        </span>
        {/* No es el total del programa: es lo que queda por cobrar y se reparte en estas cuotas.
            El total del programa se edita en la tarjeta de Deuda, que es de donde sale esta
            deuda. */}
        <small className="ln-t-caption ln-muted">
          {`Lo que queda por cobrar, repartido en cuotas. Hoy la deuda es ${moneda(deuda)}.`}
        </small>
      </div>

      <div className="ln-field-wrap">
        <Rotulo>Cantidad de cuotas</Rotulo>
        <div className="ln-btn-row" role="group" aria-label="Cantidad de cuotas">
          {CANTIDADES_SUGERIDAS.map((n) => {
            const activo = n === filas.length;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={activo}
                onClick={() => elegirCantidad(n)}
                className="ln-chip ln-chip--sm"
                style={{
                  cursor: 'pointer',
                  background: activo ? 'var(--brand-secondary)' : 'transparent',
                  borderColor: activo ? 'var(--brand-secondary)' : 'var(--border-control)',
                  color: activo ? 'var(--ink)' : 'var(--text-on-surface)',
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <CronogramaCuotas
        total={total}
        filas={filas}
        conEstado
        onCambiar={setFilas}
        onRepartir={() => setFilas(repartirParejo(filas.length, total)
          .map((monto, i) => ({ ...filas[i], monto })))}
      />

      {!estado.cuadra && (
        <small className="ln-t-caption" style={{ color: 'var(--warning)' }}>
          {`El plan se puede guardar igual, pero ${estado.mensaje.toLowerCase()} contra el total de ${moneda(total)}.`}
        </small>
      )}

      {children?.({ boton })}
    </div>
  );
}
