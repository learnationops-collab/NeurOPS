// El editor del plan de cuotas: total, cantidad en un control segmentado, cronograma editable y
// cuadre.
//
// Vive aparte del `SubVista` que lo envolvía porque ahora se monta en DOS lugares: la acción
// «Armar plan de cuotas» y, en línea, la sección «Plan de cuotas» del historial — que es donde el
// closer lo está mirando cuando se da cuenta de que hay que corregirlo, y desde donde antes había
// que saltar a otra pestaña para tocarlo.
//
// Dos montajes, UN editor. Es la diferencia entre tener el plan en dos lugares y tener dos
// verdades sobre el plan: la aritmética la hace `planCuotas.js` (testeada aparte) y el guardado
// es la misma acción `guardar_plan` con el mismo payload.
//
// Los botones son los de la ficha (`.btn`, `.pastilla`, `.fi-seg`) y no los `.ln-*` del design
// system: dentro de `.dc-shell` una clase sola del DS pierde contra
// `.dc-shell button{background:none;border:0;padding:0}` y el botón se queda sin forma — que es
// exactamente lo que se veía (29/09/2026): «GUARDAR PLAN DE 1 CUOTA» como texto suelto.

import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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
 * La cantidad de cuotas: un control segmentado, con el elegido en blanco lleno.
 *
 * La marca del elegido se corre de un número al otro (`layoutId`) en vez de apagarse en uno y
 * prenderse en otro: así se ve qué cambió al tocar. Con movimiento reducido, salta sin animar.
 * El `layoutId` lleva un id propio porque el editor se puede montar en el historial y en Acciones.
 */
function CantidadDeCuotas({ actual, onElegir }) {
  const reducido = useReducedMotion();
  const marca = useId();
  return (
    <div className="fi-seg" role="group" aria-label="Cantidad de cuotas">
      {CANTIDADES_SUGERIDAS.map((n) => {
        const activo = n === actual;
        return (
          <button key={n} type="button" className="fi-seg-op" aria-pressed={activo}
            onClick={() => onElegir(n)}>
            {activo && (
              <motion.span className="fi-seg-marca" aria-hidden="true"
                {...(reducido ? {} : {
                  layoutId: `fi-seg-cuotas-${marca}`,
                  transition: { type: 'spring', bounce: 0.18, duration: 0.36 },
                })} />
            )}
            {n}
          </button>
        );
      })}
    </div>
  );
}

/**
 * `children` recibe `{ formulario, boton }` y devuelve el montaje entero: los campos por un lado y
 * el botón de guardar ya armado —con su estado y su texto— por el otro. Así cada montaje pone el
 * botón donde le corresponde sin que el editor sepa en cuál está: la sub-vista de Acciones en su
 * pie, a la derecha de «Volver», y el historial debajo de la tabla, al lado de «Cancelar».
 *
 * Antes `children` recibía solo el botón y se dibujaba DENTRO del formulario, así que en Acciones
 * el guardado quedaba en una fila propia y «Volver» en otra debajo: dos barras de botones al pie
 * de la misma pantalla. Sin `children`, los campos y el botón van uno debajo del otro.
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
      className="btn btn--cta"
      disabled={guardando || filas.length === 0 || sinFecha}
      title={sinFecha ? 'Cada cuota necesita su fecha de cobro' : undefined}
      onClick={guardar}
    >
      {guardando && <span className="ln-spinner" />}
      {`Guardar plan de ${filas.length} ${filas.length === 1 ? 'cuota' : 'cuotas'}`}
    </button>
  );

  const formulario = (
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

      <div className="ln-field-wrap" style={{ alignItems: 'flex-start' }}>
        <Rotulo>Cantidad de cuotas</Rotulo>
        <CantidadDeCuotas actual={filas.length} onElegir={elegirCantidad} />
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
  );

  if (children) return children({ formulario, boton });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {formulario}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{boton}</div>
    </div>
  );
}
