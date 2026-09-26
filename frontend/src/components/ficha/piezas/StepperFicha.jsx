import React from 'react';
import { Check, X } from 'lucide-react';

/**
 * Stepper de la ficha: el mismo componente sirve para la etapa de confirmación
 * (clicable, se guarda solo) y para los hitos del resultado (solo lectura).
 *
 * `estado` de cada paso:
 *   hecho     — verde con tilde
 *   alerta    — ámbar con X (alcanzado pero malo: no asistió, no cerró, con deuda)
 *   actual    — color de marca con halo
 *   pendiente — gris con su número
 *
 * Si `onPaso` es null los pasos no son botones: no se ofrece un control que no
 * hace nada, que es peor que no tenerlo.
 */
const StepperFicha = ({ pasos = [], onPaso = null, ayuda = null, rotulo = null, deshabilitado = false }) => {
    if (!pasos.length) return null;

    // El riel verde llega hasta el último paso alcanzado, medido sobre el 80% que
    // ocupa el tramo entre el primer y el último punto.
    const ultimo = pasos.reduce((acc, p, i) => (['hecho', 'actual', 'alerta'].includes(p.estado) ? i : acc), 0);
    const avance = `${(ultimo / Math.max(1, pasos.length - 1)) * 80}%`;

    const marca = (paso, i) => {
        if (paso.estado === 'alerta') return <X size={16} />;
        if (paso.estado === 'hecho') return <Check size={16} />;
        return i + 1;
    };

    return (
        <div style={{ display: 'grid', gap: 'var(--s4)' }}>
            {(rotulo || ayuda) && (
                <div className="fi-campo-cab">
                    {rotulo && <small className="t-rotulo">{rotulo}</small>}
                    {ayuda && <span className="t-cap mut40">{ayuda}</span>}
                </div>
            )}
            <div className="fi-stepper" style={{ '--pasos': pasos.length, '--avance': avance }}>
                <span className="fi-stepper-riel" aria-hidden="true"><i /></span>
                {pasos.map((paso, i) => {
                    const contenido = (
                        <>
                            <span className="fi-paso-punto">{marca(paso, i)}</span>
                            <span className="fi-paso-lbl">{paso.label}</span>
                            {paso.sub && <span className="fi-paso-sub">{paso.sub}</span>}
                        </>
                    );
                    if (!onPaso) {
                        return (
                            <div key={paso.key} className="fi-paso" data-estado={paso.estado}>
                                {contenido}
                            </div>
                        );
                    }
                    return (
                        <button key={paso.key} type="button" className="fi-paso"
                            data-estado={paso.estado}
                            disabled={deshabilitado}
                            aria-current={paso.estado === 'actual' ? 'step' : undefined}
                            onClick={() => onPaso(paso.key, i)}>
                            {contenido}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default StepperFicha;
