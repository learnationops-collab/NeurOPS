import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useComportamientoModal } from './Modal';
import './hoja-modal.css';

/**
 * Hoja: el modal de Configuración, al estilo del «settings center» de learnation-leadership
 * (`<x-modal.sheet>`). Sin barra de título: el contenido ocupa el panel desde arriba, la X flota
 * arriba a la izquierda y `acciones` (opcional) arriba a la derecha. En el celular es una hoja que
 * sube desde abajo; en la compu, un panel centrado.
 *
 * Usa el mismo comportamiento que `Modal` (Escape, foco atrapado, scroll trabado, clic en el fondo).
 * Se monta cuando hace falta y se desmonta al cerrar (`{abierto && <HojaModal …/>}`).
 *
 * Props: `titulo` (para lectores de pantalla), `onCerrar`, `acciones`, `children`.
 */
export default function HojaModal({ titulo, onCerrar, acciones = null, amplia = false, children }) {
    const panel = useRef(null);
    const { cerrar, atraparTab, propsFondo } = useComportamientoModal({ onCerrar, panel });
    const quieto = useReducedMotion();

    return createPortal(
        <div className="hoja-velo">
            <div className="modal-fondo" aria-hidden="true" {...propsFondo} />
            <motion.div
                ref={panel}
                role="dialog"
                aria-modal="true"
                aria-label={titulo}
                tabIndex={-1}
                onKeyDown={atraparTab}
                className={`hoja-panel${amplia ? ' hoja-panel--amplia' : ''} bg-surface border border-base text-base outline-none`}
                initial={quieto ? false : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
            >
                {/* Fila de alto cero pegada arriba: la X y las acciones flotan sobre el contenido y no se van con el scroll. */}
                <div className="hoja-flotante">
                    <button type="button" onClick={cerrar} aria-label="Cerrar"
                        className="hoja-cerrar flex items-center justify-center rounded-full bg-main border border-base text-muted hover:text-base">
                        <X size={14} />
                    </button>
                    {acciones && <div className="hoja-acciones flex items-center gap-1 rounded-full bg-main border border-base px-1.5 py-1">{acciones}</div>}
                </div>
                <div className="hoja-cuerpo">{children}</div>
            </motion.div>
        </div>,
        document.body,
    );
}
