// El link de Fathom de la llamada, en la pestaña Resultado (pedido del 02/10/2026: «que los closers
// puedan poner el link de Fathom con la grabación y la transcripción»).
//
// Se guarda solo, con su botón, y no como un paso más del árbol de reporte: la grabación llega
// cuando Fathom termina de procesarla, muchas veces con la llamada ya reportada, y pegarla no puede
// obligar a reportar de nuevo. Por lo mismo el campo queda a la vista en todos los modos de la
// pestaña, con lo que haya guardado adentro: cambiarlo es editar el texto y guardar, y vaciarlo y
// guardar lo quita.
//
// El link guardado se abre desde la cabecera de la ficha (`FichaHeader`), que se ve en todas las
// pestañas: acá no se repite el botón para abrirlo.

import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Video } from 'lucide-react';
import { mensajeDeError } from '../fichaApi';
import { esDeFathom } from '../fathom';
import MotivoDelFallo from '../historial/MotivoDelFallo';

export default function GrabacionFathom({ ficha, onAccion }) {
  const ids = useId();
  const reducido = useReducedMotion();
  const guardado = ficha?.identidad?.fathom_url || '';
  const [borrador, setBorrador] = useState(guardado);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  // Después de guardar, la ficha se recarga con el link como lo dejó el backend (con el `https://`
  // que le faltaba, sin espacios): el campo pasa a mostrar ese. Durante el render y no en un
  // efecto, que pintaría una vez el valor viejo.
  const [previo, setPrevio] = useState(guardado);
  if (previo !== guardado) {
    setPrevio(guardado);
    setBorrador(guardado);
  }

  if (!onAccion || !ficha?.identidad?.appointment_id) return null;

  const texto = borrador.trim();
  const cambio = texto !== guardado;
  // Avisa, no bloquea: un link de otra herramienta se guarda igual (ver `ficha_grabacion_service`).
  const ajeno = !!texto && !esDeFathom(texto);

  const guardar = async (e) => {
    e?.preventDefault();
    if (!cambio || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      // El cascarón recarga la ficha y deja el aviso; el árbol de reporte no se toca.
      await onAccion('guardar_fathom', { fathom_url: texto });
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const ayuda = `${ids}-ayuda`;
  return (
    <form className="ln-panel ln-panel--sm fi-fathom" onSubmit={guardar} noValidate
      aria-label="Grabación de la llamada"
      onKeyDown={(e) => {
        // Con algo a medio escribir, Escape lo descarta en vez de cerrar la ficha (el cascarón
        // escucha Escape en todo el documento).
        if (e.key !== 'Escape' || !cambio) return;
        e.stopPropagation();
        setBorrador(guardado);
        setError(null);
      }}>
      <div className="fi-fathom-cab">
        <Video size={16} aria-hidden="true" />
        <label className="ln-t-body" htmlFor={`${ids}-link`}><b>Link de Fathom</b></label>
        <small className="ln-t-caption ln-muted">Grabación y transcripción de la llamada</small>
      </div>
      <div className="fi-fathom-fila">
        <span className={`ln-field${error ? ' ln-field--invalid' : ''}`}>
          <input id={`${ids}-link`} type="url" inputMode="url" autoComplete="off" spellCheck={false}
            value={borrador} disabled={guardando}
            placeholder="https://fathom.video/share/…"
            aria-invalid={!!error} aria-describedby={ajeno ? ayuda : undefined}
            onChange={(e) => { setBorrador(e.target.value); setError(null); }} />
        </span>
        <motion.button type="submit" className="btn btn--linea btn--sm"
          disabled={!cambio || guardando}
          whileTap={reducido || !cambio ? undefined : { scale: 0.97 }}>
          {guardando && <span className="ln-spinner" />}
          {!texto && guardado ? 'Quitar' : 'Guardar'}
        </motion.button>
      </div>
      {ajeno && !error && (
        <motion.small id={ayuda} className="t-cap fi-fathom-aviso"
          {...(reducido ? {} : {
            initial: { opacity: 0, y: -4 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.18, ease: [0.22, 0.7, 0.2, 1] },
          })}>
          No parece un link de Fathom. Se puede guardar igual, pero revisalo.
        </motion.small>
      )}
      <MotivoDelFallo motivo={error} />
    </form>
  );
}
