// Tabla editable de un cronograma de cuotas: monto, fecha y (si se pide) estado por cuota, con el
// cuadre al pie. La usan el paso `venta_cuotas` del árbol y la sub-vista «Armar plan de cuotas».
//
// La última fila nunca se tipea: absorbe la diferencia para que la suma cierre exacto contra el
// total (mismo criterio que el backend). Mostrarla como input invitaría a desbalancear el plan.

import { cuadre, moneda, ESTADOS_CUOTA } from './planCuotas';

const Rotulo = ({ children }) => (
  <small className="ln-field-label" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>{children}</small>
);

export default function CronogramaCuotas({
  total, filas, onCambiar, onRepartir, conEstado = false, soloLectura = false,
}) {
  const estado = cuadre(total, filas);
  const cambiar = (i, parche) => onCambiar(filas.map((f, j) => (j === i ? { ...f, ...parche } : f)));

  return (
    <div className="ln-table" style={{ '--cols': conEstado ? '48px 1.3fr 1fr 150px' : '48px 1.3fr 1fr' }}>
      <div className="ln-table-head">
        <span>Cuota</span>
        <span>Fecha de cobro</span>
        <span>Monto</span>
        {conEstado && <span>Estado</span>}
      </div>
      {filas.map((fila, i) => {
        const ultima = i === filas.length - 1;
        return (
          // eslint-disable-next-line react/no-array-index-key
          <div className="ln-table-row" key={i}>
            <span className="ln-cell-label">{i + 1}</span>
            <span className="ln-field">
              <input
                type="date"
                value={fila.fecha || ''}
                disabled={soloLectura}
                aria-label={`Fecha de cobro de la cuota ${i + 1}`}
                onChange={(e) => cambiar(i, { fecha: e.target.value })}
              />
            </span>
            {ultima ? (
              // Se muestra en rojo si quedó negativa: el closer editó las anteriores por encima
              // del total y hay que bajar alguna, no dejar una cuota sin sentido.
              <span
                className="ln-cell-label"
                title="Se ajusta sola para que la suma cierre"
                style={{ color: Number(fila.monto) < 0 ? 'var(--error)' : 'var(--text-muted)' }}
              >
                {moneda(fila.monto)}
              </span>
            ) : (
              <span className="ln-field">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fila.monto ?? ''}
                  disabled={soloLectura}
                  aria-label={`Monto de la cuota ${i + 1}`}
                  onChange={(e) => cambiar(i, { monto: e.target.value })}
                />
                <span className="ln-unit">USD</span>
              </span>
            )}
            {conEstado && (
              <span className="ln-field">
                <select
                  value={fila.estado || 'pendiente'}
                  disabled={soloLectura}
                  aria-label={`Estado de la cuota ${i + 1}`}
                  onChange={(e) => cambiar(i, { estado: e.target.value })}
                >
                  {ESTADOS_CUOTA.map((op) => <option key={op.valor} value={op.valor}>{op.label}</option>)}
                </select>
              </span>
            )}
          </div>
        );
      })}

      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'baseline',
          justifyContent: 'space-between', paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'baseline' }}>
          <Rotulo>Suma de cuotas</Rotulo>
          <b className="ln-t-body">{moneda(estado.suma)}</b>
          <small
            className="ln-t-caption"
            role="status"
            style={{ color: estado.cuadra ? 'var(--success)' : 'var(--warning)' }}
          >
            {estado.mensaje}
          </small>
        </span>
        {onRepartir && !soloLectura && (
          <button type="button" className="ln-btn ln-btn--ghost ln-btn--sm" onClick={onRepartir}>
            Repartir en partes iguales
          </button>
        )}
      </div>
    </div>
  );
}
