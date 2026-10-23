import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, RotateCcw, X } from 'lucide-react';
import { localToday, parseUtcIso } from '../../../utils/datetime';
import { mensajeDeError } from '../fichaApi';
import { SelectorFecha } from '../piezas';
import MotivoDelFallo from '../historial/MotivoDelFallo';
import './seguimiento.css';

/**
 * «Pasar a seguimiento», junto a «Registrar una venta» debajo de las cuatro tarjetas de la llamada.
 *
 * Pedido de Kerwin (19/10/2026): las agendas que eran de un closer que ya no está (Gabriel) no
 * tuvieron resultado, y quien las tiene ahora no puede reportarlas porque no estuvo en la llamada.
 * Lo que corresponde es contactar al lead y volver a agendarlo: la llamada queda archivada sin
 * reporte y la agenda pasa a la pestaña Seguimientos, en «Llamadas no tomadas», el día elegido.
 *
 * Mario (23/10/2026): botones compactos en vez de los dos bloques con texto, y un flujo breve que
 * pregunta por qué se deriva y cuándo. Las claves de `MOTIVOS` son las del backend
 * (`ficha_recuperacion_service.MOTIVOS`).
 *
 * Solo aparece con la llamada ya pasada: una que todavía no ocurrió se reporta cuando ocurra.
 * `antes` son los otros botones de la fila (la venta), que se ven siempre.
 */
export const yaPaso = (iso) => {
    const d = iso ? parseUtcIso(String(iso)) : null;
    return !!d && d.getTime() < Date.now();
};

const MOTIVOS = [
    { valor: 'otro_closer', label: 'La llamada corresponde a otro closer' },
    { valor: 'no_tomada', label: 'No pude tomar la llamada' },
    { valor: 'falla', label: 'Falla técnica: no se pudo hacer' },
    { valor: 'otro', label: 'Otro motivo' },
];

const ENTRA = { initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 },
    transition: { duration: 0.18, ease: [0.22, 0.7, 0.2, 1] } };

export default function PasarARecuperacion({ llamadaIso, onAccion, antes = null }) {
    const reducido = useReducedMotion();
    const ids = useId();
    const [abierto, setAbierto] = useState(false);
    const [motivo, setMotivo] = useState(null);
    const [dia, setDia] = useState('');
    const [nota, setNota] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState(null);

    const disponible = yaPaso(llamadaIso);
    const anim = reducido ? {} : ENTRA;
    const toque = reducido ? undefined : { scale: 0.97 };

    const abrir = () => {
        setMotivo(null);
        setDia(localToday());
        setNota('');
        setError(null);
        setAbierto((a) => !a);
    };

    const notaFalta = motivo === 'otro' && !nota.trim();
    const listo = !!motivo && !!dia && !notaFalta;

    const pasar = async () => {
        if (!listo) return;
        setGuardando(true);
        setError(null);
        try {
            await onAccion('pasar_a_recuperacion', { motivo, fecha: dia, nota: nota.trim() });
        } catch (err) {
            setError(mensajeDeError(err));
            setGuardando(false);
        }
    };

    return (
        <div className="fi-otras-wrap">
            <div className="fi-otras">
                {antes}
                {disponible && (
                    <motion.button type="button" className="fi-otra" aria-expanded={abierto}
                        data-activo={abierto ? '1' : undefined} onClick={abrir} whileTap={toque}>
                        <RotateCcw aria-hidden="true" /> Pasar a seguimiento
                    </motion.button>
                )}
            </div>

            <AnimatePresence initial={false}>
                {disponible && abierto && (
                    <motion.div key="flujo" className="fi-deriva" role="group" aria-label="Pasar a seguimiento"
                        onKeyDown={(e) => {
                            if (e.key !== 'Escape') return;
                            // Escape cierra el flujo y nada más, no la ficha entera.
                            e.stopPropagation();
                            setAbierto(false);
                        }}
                        {...anim}>
                        <span className="fi-deriva-velo" aria-hidden="true" />
                        <div className="fi-deriva-cab">
                            <b>Pasar a seguimiento</b>
                            <button type="button" className="ibtn" aria-label="Cerrar" onClick={() => setAbierto(false)}>
                                <X size={16} />
                            </button>
                        </div>

                        <div className="fi-deriva-paso">
                            <small className="t-rotulo" id={`${ids}-motivo`}><i>1</i> ¿Por qué pasa a seguimiento?</small>
                            <div className="fi-deriva-motivos" role="radiogroup" aria-labelledby={`${ids}-motivo`}>
                                {MOTIVOS.map((m) => (
                                    <motion.button key={m.valor} type="button" role="radio"
                                        className="fi-deriva-motivo" aria-checked={motivo === m.valor}
                                        disabled={guardando} whileTap={toque}
                                        onClick={() => { setError(null); setMotivo(m.valor); }}>
                                        <span className="fi-deriva-check" aria-hidden="true"><Check /></span>
                                        {m.label}
                                    </motion.button>
                                ))}
                            </div>
                        </div>

                        <AnimatePresence initial={false}>
                            {motivo && (
                                <motion.div key="cuando" className="fi-deriva-paso" {...anim}>
                                    <small className="t-rotulo"><i>2</i> ¿Cuándo se hace el seguimiento?</small>
                                    <div className="fi-deriva-cuando">
                                        <SelectorFecha etiqueta="Día del seguimiento" valor={dia}
                                            deshabilitado={guardando}
                                            onChange={(v) => { setError(null); setDia(v); }} />
                                        <span className={`ln-field${notaFalta ? ' ln-field--invalid' : ''}`}>
                                            <input aria-label="Nota" value={nota} maxLength={200} disabled={guardando}
                                                placeholder={motivo === 'otro' ? 'Contá el motivo' : 'Nota (opcional)'}
                                                onChange={(e) => { setError(null); setNota(e.target.value); }} />
                                        </span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <MotivoDelFallo motivo={error} />
                        <div className="fi-deriva-pie">
                            <small className="t-cap mut">La llamada queda sin reporte y el lead pasa a tu pestaña Seguimientos.</small>
                            <button type="button" className="btn btn--cta" disabled={guardando || !listo} onClick={pasar}>
                                {guardando && <span className="ln-spinner" />}
                                Pasar a seguimiento
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
