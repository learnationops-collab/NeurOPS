// Los dos campos del cobro que se corrigen en el sitio: el programa y el total a pagar.
//
// Viven acá y no dentro de una pestaña porque se montan en DOS: la tarjeta de deuda de Acciones y
// la franja del historial. Es el mismo criterio que `PlanCuotasForm`: el closer se da cuenta de
// que el dato está mal mientras lo está MIRANDO, y mandarlo a otra pestaña a buscar el mismo
// campo no evita ninguna contradicción — un editor, dos montajes.
//
// Los dos guardan por `onGuardar`, que devuelve la promesa de la acción de la ficha: el aviso, la
// recarga y el error los pone el cascarón, y acá sólo se decide si el editor se cierra o se queda
// abierto con lo que la persona cargó.
//
// Los botones de ícono son el `.ibtn` de la ficha y no el `.ln-iconbtn` del design system: dentro
// de `.dc-shell` una clase sola del DS pierde el borde y el fondo contra `.dc-shell button`, y el
// lápiz o la cruz quedaban como un ícono suelto al lado del dato (ver `PlanCuotasForm`).

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Pencil, X } from 'lucide-react';
import { moneda } from './planCuotas';

const Rotulo = ({ children }) => (
  <small className="ln-t-caption ln-muted" style={{ display: 'block' }}>{children}</small>
);

const useAnimarEntrada = () => {
  const reducido = useReducedMotion();
  return reducido
    ? {}
    : { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.14, ease: 'easeOut' } };
};

/**
 * El programa que compró el cliente.
 *
 * Es de lo que dependen las otras dos acciones de cobro: el plan de cuotas cuelga del par
 * (cliente, programa) y un pago necesita el prefijo del programa para declarar su tipo. Un
 * cliente en «Sin programa» las tenía las dos a medias.
 *
 * Guardar reetiqueta las ventas del cliente, que es donde el programa vive de verdad — se avisa,
 * porque no es un campo suelto de esta pantalla.
 */
export function CampoPrograma({ cobro, programas, puedeEditar, onGuardar }) {
  const animar = useAnimarEntrada();
  const [eligiendo, setEligiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const opciones = programas || [];
  const actual = cobro?.programa_code || '';
  const nombre = cobro?.programa_nombre || null;

  const elegir = async (codigo) => {
    if (!codigo || codigo === actual) {
      setEligiendo(false);
      return;
    }
    setGuardando(true);
    try {
      await onGuardar?.(codigo);
      setEligiendo(false);
    } catch {
      // El aviso del cascarón ya lo dice (ej. "tiene ventas de más de un programa"): el
      // desplegable se queda abierto para elegir otro o cerrarlo.
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <Rotulo>Programa</Rotulo>
      {eligiendo ? (
        <motion.span {...animar}
          style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-2)' }}>
          <span className="ln-field" style={{ maxWidth: 240 }}>
            <select
              autoFocus
              defaultValue={actual}
              disabled={guardando}
              aria-label="Programa que compró el cliente"
              onChange={(e) => elegir(e.target.value)}
            >
              <option value="">Elegí el programa…</option>
              {opciones.map((p) => <option key={p.clave} value={p.clave}>{p.label}</option>)}
            </select>
          </span>
          {guardando ? <span className="ln-spinner" /> : (
            <button type="button" className="ibtn ibtn--sm"
              aria-label="Dejar el programa como estaba" onClick={() => setEligiendo(false)}>
              <X />
            </button>
          )}
        </motion.span>
      ) : (
        <span style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <b className="ln-t-body" style={{ color: nombre ? undefined : 'var(--text-muted)' }}>
            {nombre || 'Sin programa'}
          </b>
          {puedeEditar && opciones.length > 0 && (
            <button
              type="button"
              className="ibtn ibtn--sm"
              aria-label={nombre ? 'Corregir el programa' : 'Asignar el programa'}
              title={nombre ? 'Corregir el programa' : 'Asignar el programa'}
              onClick={() => setEligiendo(true)}
            >
              <Pencil />
            </button>
          )}
        </span>
      )}
      {!nombre && !eligiendo && (
        <small className="ln-t-caption ln-muted" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
          Sin programa no se puede armar el plan de cuotas ni registrar una cuota. Asignarlo
          reetiqueta las ventas de este cliente.
        </small>
      )}
    </div>
  );
}

/**
 * El total que este cliente negoció (`Client.total_amount`).
 *
 * Es el número del que sale la deuda: `_client_debt` lo prefiere al precio de lista del programa,
 * que es igual para todos y no refleja descuentos. Viaja en `null` cuando nadie lo cargó, y
 * entonces se propone el deducido (pagado + deuda) en vez de hacerlo pasar por declarado.
 */
export function CampoTotal({ cobro, puedeEditar, onGuardar }) {
  const animar = useAnimarEntrada();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);

  const total = cobro?.total ?? null;
  const sugerido = Number(cobro?.total_sugerido) || 0;

  const abrir = () => {
    // El deducido es el que el sistema ya está usando de hecho, así que confirmarlo tal cual
    // también es una corrección.
    setValor(String(total ?? sugerido));
    setEditando(true);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar?.(Number(valor));
      setEditando(false);
    } catch {
      // El editor se queda abierto con lo que se tipeó, para corregirlo sin reescribirlo.
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <Rotulo>Total a pagar</Rotulo>
      {editando ? (
        <motion.span {...animar}
          style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginTop: 'var(--space-2)' }}>
          <span className="ln-field" style={{ maxWidth: 160 }}>
            <input
              type="number"
              min="0"
              step="0.01"
              autoFocus
              value={valor}
              aria-label="Total a pagar"
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') guardar();
                if (e.key === 'Escape') setEditando(false);
              }}
            />
            <span className="ln-unit">USD</span>
          </span>
          <button type="button" className="ibtn" disabled={guardando}
            aria-label="Guardar el total a pagar" onClick={guardar}>
            {guardando ? <span className="ln-spinner" /> : <Check />}
          </button>
          <button type="button" className="ibtn"
            aria-label="Dejar el total como estaba" onClick={() => setEditando(false)}>
            <X />
          </button>
        </motion.span>
      ) : (
        <span style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <b className="ln-t-body" style={{ color: total === null ? 'var(--text-muted)' : undefined }}>
            {total === null ? 'Sin definir' : moneda(total)}
          </b>
          {puedeEditar && (
            <button
              type="button"
              className="ibtn ibtn--sm"
              aria-label={total === null ? 'Poner el total a pagar' : 'Corregir el total a pagar'}
              title={total === null ? 'Poner el total a pagar' : 'Corregir el total a pagar'}
              onClick={abrir}
            >
              <Pencil />
            </button>
          )}
        </span>
      )}
      {total === null && !editando && (
        <small className="ln-t-caption ln-muted" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
          {`Nadie lo cargó. Por lo cobrado y lo que debe hoy, serían ${moneda(sugerido)}.`}
        </small>
      )}
    </div>
  );
}
