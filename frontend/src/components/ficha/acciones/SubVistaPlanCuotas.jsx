// Sub-vista «Armar plan de cuotas»: total, cantidad de cuotas en píldoras, tabla editable y cuadre.
// La aritmética no vive acá: la hace `planCuotas.js`, que está testeada aparte.

import { useState } from 'react';
import { SubVista } from './piezas';
import CronogramaCuotas from './CronogramaCuotas';
import {
  CANTIDADES_SUGERIDAS, redimensionar, repartirParejo, sumarMeses, moneda, cuadre,
} from './planCuotas';

const primeraFechaPorDefecto = () => {
  const d = new Date();
  return sumarMeses(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-10`, 1);
};

// Un plan que ya existe se edita tal cual está; si no hay plan se arranca con la deuda repartida.
function filasIniciales(cuotas, deuda) {
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

export default function SubVistaPlanCuotas({ ficha, onVolver, onGuardar, guardando }) {
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

  const guardar = () => onGuardar({
    programa_code: cobro.programa_code || null,
    total: Number(total) || 0,
    cuotas: filas.map((f, i) => ({
      id: f.id ?? null,
      numero_cuota: i + 1,
      monto: Number(f.monto) || 0,
      fecha_vencimiento: f.fecha || null,
      estado: f.estado || 'pendiente',
    })),
  });

  return (
    <SubVista
      titulo="Armar plan de cuotas"
      onVolver={onVolver}
      acciones={(
        <button
          type="button"
          className="ln-btn ln-btn--cta"
          disabled={guardando || filas.length === 0}
          onClick={guardar}
        >
          {guardando && <span className="ln-spinner" />}
          {`Guardar plan de ${filas.length} ${filas.length === 1 ? 'cuota' : 'cuotas'}`}
        </button>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className="ln-field-wrap" style={{ maxWidth: 240 }}>
          <small className="ln-field-label" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Total del plan
          </small>
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
        </div>

        <div className="ln-field-wrap">
          <small className="ln-field-label" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Cantidad de cuotas
          </small>
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
      </div>
    </SubVista>
  );
}
