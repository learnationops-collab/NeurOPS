// Dar, renovar y quitar el acceso a la Academia desde Fulfillment (pedido del 30/09/2026).
//
// Hasta ahora el acceso solo se daba al registrar un pago en Resultado: extenderle el plazo a un
// alumno, o cortárselo, obligaba a inventar un pago o a ir a la otra plataforma.
//
// La Academia tiene una sola escritura sobre accesos —asignar un producto con su vencimiento— y
// ninguna para borrarlo, así que las tres acciones son la misma con otra fecha (ver
// `app/services/ficha_academia.py`): dar crea la cuenta si no la tiene, renovar reasigna con la
// fecha nueva, y quitar la hace vencer hoy. Quitar lleva el `InlineConfirm` de la casa: el
// deshacer es de verdad porque el pedido se manda recién cuando se agota la ventana.
//
// Solo lo ve quien puede cobrar (`permisos.cobrar`): es lo mismo que hasta ahora pasaba al
// registrar un pago.

import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarPlus, KeyRound } from 'lucide-react';
import InlineConfirm from '../../ui/InlineConfirm';
import Tip from '../../../pages/comercial/components/Tip';
import { diaLegible } from '../piezas/fecha';
import { localDateFromNow, localToday } from '../../../utils/datetime';
import { mensajeDeError } from '../fichaApi';
import MotivoDelFallo from '../historial/MotivoDelFallo';
import { AYUDA_ACCESO, baseDeRenovacion, sumarMeses } from '../fulfillment';

// Los atajos de plazo: 4 meses es la regla del alta para un pago completo o parcial.
const PLAZOS = [
  { meses: 1, label: '1 mes' },
  { meses: 4, label: '4 meses' },
  { meses: 12, label: '1 año' },
];

/** Por qué no se puede dar el acceso todavía, o null. El aviso del producto ya lo explica arriba. */
const bloqueoDe = (datos) => {
  if (!datos.programa) return 'Falta cargar en Acciones qué programa pagó.';
  if (!datos.programa.product_slug) return 'El programa no está vinculado a un producto de la Academia.';
  return null;
};

export default function AccesoAcademia({ datos, ficha, onAccion, onHecho }) {
  const ids = useId();
  const reducido = useReducedMotion();
  const [abierto, setAbierto] = useState(false);
  const [vence, setVence] = useState('');
  const [email, setEmail] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [errorQuitar, setErrorQuitar] = useState(null);

  // Con la Academia caída no se ofrece nada: no se sabe qué tiene, y el pedido fallaría igual.
  if (!ficha?.permisos?.cobrar || !onAccion || !datos || datos.error) return null;

  const esAlumno = !!datos.vinculado;
  const pagado = datos.producto_pagado;
  const renovar = esAlumno && !!pagado;
  const hoy = localToday();
  const base = renovar ? baseDeRenovacion(pagado, hoy) : hoy;
  const bloqueo = bloqueoDe(datos);
  const verbo = renovar ? 'Renovar' : 'Dar';

  const abrir = () => {
    // La sugerencia del backend es la regla del alta; si llegó vieja (la pestaña quedó abierta de
    // un día para otro), se recalcula acá con la misma cuenta.
    setVence(datos.vence_sugerido > hoy ? datos.vence_sugerido : sumarMeses(base, 4));
    setEmail(datos.email_sugerido || '');
    setError(null);
    setAbierto(true);
  };

  const cerrar = () => { setAbierto(false); setError(null); };

  const guardar = async (e) => {
    e?.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await onAccion('acceso_academia', esAlumno ? { vence } : { vence, email: email.trim() });
      setAbierto(false);
      onHecho?.();
    } catch (err) {
      // El formulario se queda con lo cargado y dice por qué, al lado del botón.
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async () => {
    setErrorQuitar(null);
    try {
      await onAccion('quitar_acceso_academia', { confirmo: true });
      onHecho?.();
    } catch (err) {
      setErrorQuitar(mensajeDeError(err));
    }
  };

  if (!abierto) {
    return (
      <div className="ful-gestion">
        <div className="ful-gestion-botones">
          <button type="button" className="btn btn--linea btn--sm" onClick={abrir}
            disabled={!!bloqueo} title={bloqueo || undefined}>
            {renovar ? <CalendarPlus /> : <KeyRound />}
            {`${verbo} acceso`}
          </button>
          {renovar && (
            // `alto` 34: el mismo que el `.btn--sm` de al lado.
            <InlineConfirm tema="oscuro" compacto={false} alto={34} tamIcono={13}
              label="Quitar acceso" question="¿Le quitás el acceso?" confirmLabel="Sí, quitar"
              doneLabel="Acceso quitado" title="Hace vencer hoy su acceso a la Academia"
              onConfirm={quitar} />
          )}
          <Tip titulo="Dar, renovar o quitar el acceso" texto={AYUDA_ACCESO.gestionar} />
        </div>
        <MotivoDelFallo motivo={errorQuitar} />
      </div>
    );
  }

  const desde = !renovar || base === hoy ? 'hoy' : `su vencimiento actual, el ${diaLegible(base)}`;
  return (
    <motion.form className="fi-agenda-editor ful-gestion-editor" onSubmit={guardar}
      aria-label={`${verbo} el acceso a la Academia`}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        // Escape cierra el formulario y nada más: el cascarón escucha Escape para cerrar la ficha.
        e.stopPropagation();
        cerrar();
      }}
      {...(reducido ? {} : {
        initial: { opacity: 0, y: -6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.18, ease: [0.22, 0.7, 0.2, 1] },
      })}>
      <div className="fi-agenda-campos">
        <div className="fi-campo">
          <label className="t-rotulo" htmlFor={`${ids}-vence`}>Tiene acceso hasta el</label>
          <span className="ln-field" style={{ height: 44 }}>
            <input id={`${ids}-vence`} type="date" value={vence} min={localDateFromNow(1)} required
              autoFocus disabled={guardando} onChange={(e) => setVence(e.target.value)} />
          </span>
          <div className="ful-plazos" role="group" aria-label="Plazos rápidos">
            {PLAZOS.map((p) => {
              const dia = sumarMeses(base, p.meses);
              return (
                <button key={p.meses} type="button" disabled={guardando} aria-pressed={vence === dia}
                  className={`btn btn--linea btn--sm${vence === dia ? ' ful-plazo--on' : ''}`}
                  onClick={() => setVence(dia)}>
                  {`+${p.label}`}
                </button>
              );
            })}
          </div>
          {/* La fecha elegida, escrita: el botón de abajo no la repite (en mayúsculas no entraba
              al lado de «Cancelar» y el pie se partía en dos filas). */}
          <small className="t-cap mut">
            {`${vence ? `Hasta el ${diaLegible(vence)}. ` : ''}Los plazos se cuentan desde ${desde}.`}
          </small>
        </div>

        {!esAlumno && (
          <div className="fi-campo">
            <span className="ful-rotulo">
              <label className="t-rotulo" htmlFor={`${ids}-email`}>Correo con el que va a entrar</label>
              <Tip titulo="Correo de la Academia" texto={AYUDA_ACCESO.dar} />
            </span>
            <span className="ln-field" style={{ height: 44 }}>
              <input id={`${ids}-email`} type="email" value={email} required disabled={guardando}
                placeholder="correo@ejemplo.com" onChange={(e) => setEmail(e.target.value)} />
            </span>
          </div>
        )}
      </div>

      <MotivoDelFallo motivo={error} />

      <div className="fi-agenda-pie">
        <button type="button" className="btn btn--linea" disabled={guardando} onClick={cerrar}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--cta"
          disabled={guardando || !vence || (!esAlumno && !email.trim())}>
          {guardando && <span className="ln-spinner" />}
          {`${verbo} acceso`}
        </button>
      </div>
    </motion.form>
  );
}
