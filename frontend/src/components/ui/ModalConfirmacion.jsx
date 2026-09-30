import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import './modalConfirmacion.css';

/**
 * Confirmación de una acción que no se puede deshacer, dibujada por la página y no por el navegador.
 *
 * Pedido del usuario (29/09/2026), para borrar agendas desde el historial: "que muestre un modal de
 * confirmación de la página, no del navegador". `window.confirm` además no se puede estilar, el
 * navegador lo puede bloquear, y cuando no aparece el botón simplemente "no hace nada".
 *
 * Quien lo usa lo monta cuando hace falta y lo desmonta al cerrarse (`{abierto && <Modal…/>}`), sin
 * `AnimatePresence`: en esta versión de framer-motion dejó overlays sin desmontar dentro del mazo.
 *
 * Lo que tiene que cumplir un diálogo así, y por qué:
 *  - Va en un portal a `body`, con la clase `dc-shell` encima: montado adentro de la ficha, un
 *    ancestro con `transform` (los paneles animados) convierte el `position: fixed` en relativo a
 *    ese ancestro y el velo no tapa la pantalla; sin `dc-shell` no tendría ni tokens ni botones.
 *  - El foco arranca en «Cancelar», no en la acción: un Enter apurado no borra nada.
 *  - Tab no se escapa del diálogo, y al cerrarse el foco vuelve a donde estaba.
 *  - Escape se escucha en captura y corta la propagación: la ficha también cierra con Escape, y
 *    cancelar la confirmación no puede cerrar la ficha entera.
 *  - Si la acción falla, el motivo se dice ADENTRO del diálogo y el diálogo sigue abierto: el aviso
 *    de la ficha queda detrás del velo y nadie lo vería.
 */
const ModalConfirmacion = ({
    titulo,
    children = null,
    confirmar = 'Confirmar',
    confirmando = 'Un momento…',
    cancelar = 'Cancelar',
    onConfirmar,
    onCerrar,
}) => {
    const reducido = useReducedMotion();
    const ids = useId();
    const panel = useRef(null);
    const botonCancelar = useRef(null);
    const montado = useRef(true);
    const [enCurso, setEnCurso] = useState(false);
    const [error, setError] = useState(null);

    // Mientras la acción corre no se cierra por ningún lado: un Escape a mitad del borrado dejaría
    // de mostrar el resultado de algo que igual va a pasar.
    const cerrar = () => { if (!enCurso) onCerrar?.(); };

    useEffect(() => {
        montado.current = true;
        const antes = document.activeElement;
        botonCancelar.current?.focus();
        return () => {
            montado.current = false;
            // Si el disparador ya no está (la fila se borró), el foco queda donde lo deje el resto.
            if (antes && document.contains(antes)) antes.focus?.();
        };
    }, []);

    useEffect(() => {
        const escape = (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            e.preventDefault();
            cerrar();
        };
        document.addEventListener('keydown', escape, true);
        return () => document.removeEventListener('keydown', escape, true);
    });

    const atraparTab = (e) => {
        if (e.key !== 'Tab' || !panel.current) return;
        const enfocables = [...panel.current.querySelectorAll('button:not(:disabled)')];
        if (!enfocables.length) return;
        const primero = enfocables[0];
        const ultimo = enfocables[enfocables.length - 1];
        if (e.shiftKey && document.activeElement === primero) {
            e.preventDefault();
            ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
            e.preventDefault();
            primero.focus();
        }
    };

    const aceptar = async () => {
        setEnCurso(true);
        setError(null);
        try {
            await onConfirmar?.();
            if (montado.current) onCerrar?.();
        } catch (err) {
            if (!montado.current) return;
            setError(err?.response?.data?.message || err?.message || 'No se pudo completar.');
            setEnCurso(false);
        }
    };

    return createPortal(
        <motion.div className="dc-shell scrim confirma-velo"
            onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(); }}
            {...(reducido ? {} : {
                initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.16 },
            })}>
            <motion.div ref={panel} className="confirma" role="alertdialog" aria-modal="true"
                aria-labelledby={`${ids}-titulo`} aria-describedby={`${ids}-detalle`}
                onKeyDown={atraparTab}
                {...(reducido ? {} : {
                    initial: { opacity: 0, y: 12, scale: 0.98 },
                    animate: { opacity: 1, y: 0, scale: 1 },
                    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                })}>
                <span className="confirma-icono" aria-hidden="true"><AlertTriangle /></span>
                <h2 id={`${ids}-titulo`} className="t-h3">{titulo}</h2>
                <div id={`${ids}-detalle`} className="confirma-detalle t-sm">{children}</div>
                {error && <p className="confirma-error t-sm" role="alert">{error}</p>}
                <div className="confirma-acciones">
                    <button type="button" ref={botonCancelar} className="btn btn--linea"
                        disabled={enCurso} onClick={cerrar}>
                        {cancelar}
                    </button>
                    <button type="button" className="btn btn--peligro" disabled={enCurso}
                        onClick={aceptar}>
                        {enCurso ? confirmando : confirmar}
                    </button>
                </div>
            </motion.div>
        </motion.div>,
        document.body,
    );
};

export default ModalConfirmacion;
