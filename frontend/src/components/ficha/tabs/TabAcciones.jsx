// Pestaña «Acciones»: el cobro post-venta. A la izquierda la deuda, a la derecha las cuatro
// acciones en grid 2×2. Cada acción es una SUB-VISTA con «Volver» dentro del mismo panel — nunca
// un modal encima de otro modal.

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CalendarDays, CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import { TarjetaAccion } from '../acciones/piezas';
import { CampoPrograma, CampoTotal } from '../acciones/CamposCobro';
import { soloDia } from '../piezas/fecha';
import SubVistaPlanCuotas from '../acciones/SubVistaPlanCuotas';
import { SubVistaPago, SubVistaSeguimiento, SubVistaBaja } from '../acciones/SubVistasCobro';
import { moneda } from '../acciones/planCuotas';

// El orden y los tonos son los del mockup (`fcAcciones`).
//
// Sin texto de éxito propio: el que se muestra lo pone el cascarón (`MENSAJES` en
// `FichaLeadModal`), que es el que sabe qué pasó. Cuando cada uno ponía el suyo, guardar el plan
// dejaba DOS avisos idénticos apilados.
const ACCIONES = [
  { modo: 'plan', label: 'Armar plan de cuotas', tono: 'info', icono: CalendarDays, accion: 'guardar_plan' },
  { modo: 'pago', label: 'Registrar pago', tono: 'success', icono: CheckCircle2, accion: 'registrar_pago' },
  { modo: 'seg', label: 'Registrar seguimiento', tono: 'warning', icono: Clock, accion: 'registrar_seguimiento' },
  { modo: 'baja', label: 'Dar de baja', tono: 'error', icono: XCircle, accion: 'dar_de_baja' },
];

export default function TabAcciones({ ficha, onAccion, puedeEditar = true }) {
  const reducido = useReducedMotion();
  const [modo, setModo] = useState('menu');
  const [guardando, setGuardando] = useState(false);

  const puedeCobrar = puedeEditar && ficha?.permisos?.cobrar !== false;
  const definicion = ACCIONES.find((a) => a.modo === modo);

  const volver = () => setModo('menu');

  const guardar = async (payload) => {
    if (!definicion) return;
    setGuardando(true);
    try {
      // `onAccion` ya recarga la ficha y deja el aviso —de éxito o de error— en el cascarón.
      // Volver a recargar acá era pedir la ficha dos veces por cada guardado.
      await onAccion(definicion.accion, payload);
      setModo('menu');
    } catch {
      // El aviso de error ya está puesto. Se vuelve del `catch` para que la sub-vista se quede
      // abierta con lo que el closer cargó, en vez de mandarlo al menú a empezar de nuevo.
    } finally {
      setGuardando(false);
    }
  };

  // Igual que en «Resultado»: se anima la entrada, no la salida. Con `AnimatePresence mode="wait"`
  // la sub-vista no monta hasta que el menú termina de irse.
  const animar = reducido
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.18, ease: 'easeOut' } };

  const comunes = { ficha, onVolver: volver, onGuardar: guardar, guardando };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {modo === 'menu' ? (
          <motion.div key="menu" {...animar} className="ln-grid" style={{ gridTemplateColumns: 'minmax(220px, 1fr) minmax(0, 2fr)', gap: 'var(--space-6)' }}>
            <TarjetaDeuda
              cobro={ficha?.cobro}
              programas={ficha?.vocabulario?.programas}
              puedeEditar={puedeCobrar}
              onGuardarTotal={(total) => onAccion('guardar_total', { total })}
              onGuardarPrograma={(programa_code) => onAccion('guardar_programa', { programa_code })}
            />
            <div className="ln-grid ln-grid-2">
              {ACCIONES.map((a) => (
                <TarjetaAccion
                  key={a.modo}
                  tono={a.tono}
                  icono={a.icono}
                  label={a.label}
                  onClick={puedeCobrar ? () => setModo(a.modo) : undefined}
                />
              ))}
            </div>
            {!puedeCobrar && (
              <p className="ln-t-body-sm ln-muted" style={{ gridColumn: '1 / -1' }}>
                Tu rol puede ver el cobro de este cliente pero no registrarlo.
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div key={modo} {...animar}>
            {modo === 'plan' && <SubVistaPlanCuotas {...comunes} />}
            {modo === 'pago' && <SubVistaPago {...comunes} />}
            {modo === 'seg' && <SubVistaSeguimiento {...comunes} />}
            {modo === 'baja' && <SubVistaBaja {...comunes} />}
          </motion.div>
        )}
    </div>
  );
}

// La deuda es el dato que manda en esta pestaña: monto grande en rojo, y debajo los cuatro datos
// que la explican — el programa, el total que el cliente negoció, lo que ya pagó y el último pago.
//
// El programa y el total son `CamposCobro`, los mismos que monta la franja del historial: el
// closer corrige donde ve el problema, no donde el menú lo mande.
function TarjetaDeuda({ cobro, programas, puedeEditar = true, onGuardarTotal, onGuardarPrograma }) {
  const reducido = useReducedMotion();
  const deuda = Number(cobro?.deuda) || 0;
  const alDia = deuda < 0.01;

  const animar = reducido
    ? {}
    : { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.14, ease: 'easeOut' } };

  return (
    <div className="ln-panel ln-panel--sm">
      <small className="ln-t-eyebrow ln-muted">Deuda</small>
      {/* La cifra se remonta con su valor: corregir el total la cambia, y el parpadeo es lo que
          avisa que ese era el número que estaba mal. */}
      <motion.p
        key={deuda}
        {...animar}
        className="ln-t-display"
        style={{ color: alDia ? 'var(--success)' : 'var(--error)', margin: 'var(--space-2) 0 var(--space-4)' }}
      >
        {alDia ? 'Al día' : moneda(deuda)}
      </motion.p>

      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <CampoPrograma cobro={cobro} programas={programas} puedeEditar={puedeEditar}
          onGuardar={onGuardarPrograma} />
        <CampoTotal cobro={cobro} puedeEditar={puedeEditar} onGuardar={onGuardarTotal} />

        <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          <span>
            <small className="ln-t-caption ln-muted" style={{ display: 'block' }}>Pagado</small>
            <b className="ln-t-body">{moneda(cobro?.pagado)}</b>
          </span>
          <span>
            <small className="ln-t-caption ln-muted" style={{ display: 'block' }}>Último pago</small>
            <b className="ln-t-body">{soloDia(cobro?.ultimo_pago) || '—'}</b>
          </span>
        </div>
      </div>
    </div>
  );
}
