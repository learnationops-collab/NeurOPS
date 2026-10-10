import React, { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MessageSquarePlus, Quote } from 'lucide-react';
import { instanteLegible } from '../piezas/fecha';
import { mensajeDeError } from '../fichaApi';
import { OBJECION_MINIMA } from '../arbolResultado.preguntas';
import MotivoDelFallo from './MotivoDelFallo';

/**
 * La objeción de una llamada que no cerró, debajo de su fila en «Agendas» del historial.
 *
 * Pedido de Kerwin (09/10/2026): desde ese día reportar «No cerró» pide la objeción, y el historial
 * deja agregársela a las llamadas que se reportaron antes («es para agregar objeciones a leads que
 * se reportaron antes de ahora»). El backend dice en cada agenda cuál es su objeción vigente
 * (`objecion`) y si le corresponde una (`admite_objecion`: asistió y no cerró).
 *
 *   · con objeción: se lee entera, con quién la escribió y cuándo, y «Reemplazar» la corrige (la
 *     vigente es la más nueva; la anterior queda en el registro de eventos);
 *   · sin objeción, en una llamada que no cerró: una línea que dice que falta y «Agregar objeción».
 *
 * Quien no puede reportar ve la objeción pero no el aviso de que falta: no es algo que pueda hacer.
 */
const ObjecionDeAgenda = ({ agenda, puedeEditar = false, onGuardar }) => {
    const reducido = useReducedMotion();
    const ids = useId();
    const disparador = useRef(null);
    const [editando, setEditando] = useState(false);
    const [texto, setTexto] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState(null);
    // La cita entra animada solo cuando se acaba de guardar: al abrir el historial ya está ahí.
    const [recien, setRecien] = useState(false);
    // Al cerrar el editor el foco vuelve al botón que lo abrió (que se vuelve a montar recién en
    // ese render): si no, queda en el `body` y quien usa el teclado vuelve a empezar desde arriba.
    const devolverFoco = useRef(false);
    useEffect(() => {
        if (editando || !devolverFoco.current) return;
        devolverFoco.current = false;
        disparador.current?.focus();
    }, [editando]);

    const objecion = agenda.objecion || null;
    if (!objecion && !(agenda.admite_objecion && puedeEditar)) return null;

    const fecha = instanteLegible(agenda.fecha) || 'sin fecha';
    const largo = texto.trim().length;
    const corta = largo < OBJECION_MINIMA;

    const abrir = () => {
        setTexto(objecion?.texto || '');
        setError(null);
        setEditando(true);
    };

    const cerrar = () => {
        devolverFoco.current = true;
        setEditando(false);
        setError(null);
    };

    const guardar = async () => {
        if (corta || guardando) return;
        setGuardando(true);
        setError(null);
        try {
            await onGuardar?.(texto.trim());
            setRecien(true);
            devolverFoco.current = true;
            setEditando(false);
        } catch (err) {
            // El motivo va al lado del botón: el aviso del cascarón queda arriba, fuera de la vista.
            setError(mensajeDeError(err));
        } finally {
            setGuardando(false);
        }
    };

    const tap = reducido ? {} : { whileTap: { scale: 0.97 } };

    return (
        <div className="fi-objecion">
            {!editando && objecion && (
                <motion.figure className="fi-objecion-cita"
                    {...(recien && !reducido ? {
                        initial: { opacity: 0, y: 6 },
                        animate: { opacity: 1, y: 0 },
                        transition: { duration: 0.22, ease: [0.22, 0.7, 0.2, 1] },
                    } : {})}>
                    <small className="fi-objecion-rotulo">
                        <Quote size={12} aria-hidden="true" /> Objeción
                    </small>
                    <blockquote className="t-sm">{objecion.texto}</blockquote>
                    <figcaption className="fi-objecion-pie">
                        <span className="t-cap mut">
                            {[objecion.autor, instanteLegible(objecion.fecha)].filter(Boolean).join(' · ')}
                        </span>
                        {puedeEditar && (
                            <motion.button type="button" className="btn btn--linea btn--sm" ref={disparador}
                                aria-label={`Reemplazar la objeción de la agenda del ${fecha}`}
                                onClick={abrir} {...tap}>
                                Reemplazar
                            </motion.button>
                        )}
                    </figcaption>
                </motion.figure>
            )}

            {!editando && !objecion && (
                <div className="fi-objecion-falta">
                    <span className="t-cap">Asistió y no cerró: falta la objeción.</span>
                    <motion.button type="button" className="btn btn--linea btn--sm" ref={disparador}
                        aria-label={`Agregar la objeción de la agenda del ${fecha}`}
                        onClick={abrir} {...tap}>
                        <MessageSquarePlus size={14} aria-hidden="true" />
                        Agregar objeción
                    </motion.button>
                </div>
            )}

            {editando && (
                <motion.div className="fi-objecion-despliegue"
                    {...(reducido ? {} : {
                        initial: { opacity: 0, height: 0 },
                        animate: { opacity: 1, height: 'auto' },
                        transition: { duration: 0.24, ease: [0.22, 0.7, 0.2, 1] },
                    })}>
                    <div className="fi-agenda-editor" role="group"
                        aria-label={`Objeción de la agenda del ${fecha}`}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                // Cierra ESTE editor y nada más: el cascarón escucha Escape en
                                // `document` para cerrar la ficha entera.
                                e.stopPropagation();
                                cerrar();
                            }
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) guardar();
                        }}>
                        <div className="fi-campo">
                            <div className="fi-campo-cab">
                                <label className="t-rotulo" htmlFor={`${ids}-texto`}>
                                    ¿Por qué no cerró? ¿Cuál es la objeción?
                                </label>
                                <small className="t-cap mut">Queda en Comunicación</small>
                            </div>
                            <span className="ln-field" style={{ height: 'auto', padding: 'var(--s3) var(--s4)' }}>
                                <textarea id={`${ids}-texto`} rows={3} value={texto} autoFocus
                                    disabled={guardando} style={{ resize: 'vertical' }}
                                    placeholder="Lo que dijo, con sus palabras si podés"
                                    onChange={(e) => { setTexto(e.target.value); setError(null); }} />
                            </span>
                            <small className="t-cap mut" aria-live="polite">
                                {`Mínimo ${OBJECION_MINIMA} caracteres · llevás ${largo}`}
                            </small>
                        </div>

                        <MotivoDelFallo motivo={error} />

                        <div className="fi-agenda-pie">
                            <button type="button" className="btn btn--linea" disabled={guardando}
                                onClick={cerrar}>
                                Cancelar
                            </button>
                            <button type="button" className="btn btn--cta" disabled={guardando || corta}
                                title={corta ? `Escribí al menos ${OBJECION_MINIMA} caracteres` : undefined}
                                onClick={guardar}>
                                {guardando && <span className="ln-spinner" />}
                                Guardar objeción
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default ObjecionDeAgenda;
