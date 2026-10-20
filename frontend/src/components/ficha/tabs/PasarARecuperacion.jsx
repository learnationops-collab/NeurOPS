import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { localToday, parseUtcIso } from '../../../utils/datetime';
import { mensajeDeError } from '../fichaApi';
import MotivoDelFallo from '../historial/MotivoDelFallo';

/**
 * «Pasar a seguimiento de recuperación», debajo de las cuatro tarjetas de la llamada.
 *
 * Pedido de Kerwin (19/10/2026): las agendas que eran de un closer que ya no está (Gabriel) no
 * tuvieron resultado, y quien las tiene ahora no puede reportarlas porque no estuvo en la llamada.
 * Lo que corresponde es contactar al lead y volver a agendarlo: la llamada queda archivada sin
 * reporte y la agenda pasa a la pestaña Seguimientos, en «Llamadas no tomadas», el día elegido.
 *
 * Solo aparece con la llamada ya pasada: una que todavía no ocurrió se reporta cuando ocurra.
 */
export const yaPaso = (iso) => {
    const d = iso ? parseUtcIso(String(iso)) : null;
    return !!d && d.getTime() < Date.now();
};

export default function PasarARecuperacion({ llamadaIso, onAccion }) {
    const reducido = useReducedMotion();
    const ids = useId();
    const [abierto, setAbierto] = useState(false);
    const [dia, setDia] = useState('');
    const [nota, setNota] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState(null);

    if (!yaPaso(llamadaIso)) return null;

    const abrir = () => {
        setDia(localToday());
        setNota('');
        setError(null);
        setAbierto(true);
    };

    const pasar = async () => {
        setGuardando(true);
        setError(null);
        try {
            await onAccion('pasar_a_recuperacion', { fecha: dia, nota: nota.trim() });
        } catch (err) {
            setError(mensajeDeError(err));
            setGuardando(false);
        }
    };

    return (
        <div className="ln-panel ln-panel--sm fi-recuperacion">
            <div className="fi-venta-directa" style={{ marginTop: 0 }}>
                <span style={{ display: 'grid', gap: 'var(--space-1)' }}>
                    <b className="ln-t-body">¿No tomaste esta llamada?</b>
                    <small className="ln-t-body-sm ln-muted">
                        Si era de otro closer y no tiene resultado, contactá al lead para volver a agendarlo.
                    </small>
                </span>
                {!abierto && (
                    <motion.button type="button" className="btn btn--linea" onClick={abrir}
                        whileTap={reducido ? undefined : { scale: 0.97 }}>
                        <RotateCcw /> Pasar a seguimiento de recuperación
                    </motion.button>
                )}
            </div>

            {abierto && (
                <motion.div className="fi-agenda-editor" role="group" aria-label="Pasar a seguimiento de recuperación"
                    style={{ marginTop: 'var(--s3)', marginBottom: 0 }}
                    onKeyDown={(e) => {
                        if (e.key !== 'Escape') return;
                        // Escape cierra el formulario y nada más, no la ficha entera.
                        e.stopPropagation();
                        setAbierto(false);
                    }}
                    {...(reducido ? {} : {
                        initial: { opacity: 0, y: -6 },
                        animate: { opacity: 1, y: 0 },
                        transition: { duration: 0.18, ease: [0.22, 0.7, 0.2, 1] },
                    })}>
                    <div className="fi-agenda-campos">
                        <div className="fi-campo">
                            <label className="t-rotulo" htmlFor={`${ids}-dia`}>Día del contacto</label>
                            <span className="ln-field" style={{ height: 44 }}>
                                <input id={`${ids}-dia`} type="date" value={dia} required autoFocus
                                    disabled={guardando} onChange={(e) => { setError(null); setDia(e.target.value); }} />
                            </span>
                        </div>
                        <div className="fi-campo" style={{ gridColumn: '1 / -1' }}>
                            <label className="t-rotulo" htmlFor={`${ids}-nota`}>Nota</label>
                            <span className="ln-field" style={{ height: 44 }}>
                                <input id={`${ids}-nota`} value={nota} maxLength={255} disabled={guardando}
                                    placeholder="Qué hay que hacer (opcional)"
                                    onChange={(e) => { setError(null); setNota(e.target.value); }} />
                            </span>
                        </div>
                    </div>
                    <small className="t-cap mut">
                        La llamada queda archivada sin reporte y el lead pasa a tu pestaña Seguimientos.
                    </small>
                    <MotivoDelFallo motivo={error} />
                    <div className="fi-agenda-pie">
                        <button type="button" className="btn btn--linea" disabled={guardando}
                            onClick={() => setAbierto(false)}>
                            Cancelar
                        </button>
                        <button type="button" className="btn btn--cta" disabled={guardando || !dia} onClick={pasar}>
                            {guardando && <span className="ln-spinner" />}
                            Pasar a recuperación
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
