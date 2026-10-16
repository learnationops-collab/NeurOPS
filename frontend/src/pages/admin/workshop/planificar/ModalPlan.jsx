import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useComportamientoModal } from '../../../../components/ui/Modal';

/**
 * Modal de Planificar con el dibujo del dashboard comercial (`.dc-shell scrim` + `.modal`, como la
 * ficha del lead) y el comportamiento de `components/ui/Modal.jsx` (Escape, foco atrapado, scroll
 * trabado, fondo que cierra solo con un clic que empieza y termina en él).
 *
 * Va en un portal a `body`: el velo lleva la clase del shell para tener sus tokens ahí afuera.
 */
const ModalPlan = ({ titulo, eyebrow, onCerrar, onSubmit, pie, cerrable = true, children }) => {
    const panel = useRef(null);
    const id = useId();
    const { cerrar, atraparTab, propsFondo } = useComportamientoModal({ onCerrar, cerrable, panel });

    return createPortal(
        <div className="dc-shell scrim wp-velo" {...propsFondo}>
            <form ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}
                className="modal wp-modal" onKeyDown={atraparTab}
                onSubmit={(e) => { e.preventDefault(); onSubmit?.(e); }}>
                <div className="modal-cab wp-modal-cab">
                    <div className="wp-modal-tit">
                        {eyebrow && <p className="t-eyebrow">{eyebrow}</p>}
                        <h2 id={`${id}-t`} className="t-h3">{titulo}</h2>
                    </div>
                    <button type="button" className="ibtn ibtn--sm" onClick={cerrar} aria-label="Cerrar" disabled={!cerrable}>
                        <X aria-hidden="true" />
                    </button>
                </div>
                <div className="wp-modal-cuerpo">{children}</div>
                {pie && <div className="wp-modal-pie">{pie}</div>}
            </form>
        </div>,
        document.body,
    );
};

export default ModalPlan;
