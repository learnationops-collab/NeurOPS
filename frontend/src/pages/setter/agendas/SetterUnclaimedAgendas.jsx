import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { HelpCircle, Check, X, Instagram, Phone, Mail, Loader2 } from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import { parseUtcIso } from '../../../utils/datetime';

/**
 * Agendas que entraron por setting pero sin saber de qué setter son.
 *
 * Los tres setters comparten el mismo evento de Calendly, así que el webhook solo
 * puede decir 'setting'; el nombre viaja en el formulario. Cuando el formulario no
 * llegó o vino como "No identificado", la agenda queda huérfana y se le pregunta
 * al equipo en vez de dejarla sin atribuir.
 *
 * Solo aparecen las posteriores al ingreso de cada setter, y lo que uno descarta
 * deja de mostrársele a él pero le sigue apareciendo al resto.
 *
 * Desde el 10/10/2026 vive al pie de «Mis agendas» (antes, en la pestaña Historial) y con el
 * sistema visual del espacio: va dentro de un `.dc-shell`, así que sus botones son los del shell
 * (`btn`), no los de Tailwind, que su reset borraría.
 */
const fecha = (iso) => {
    const d = parseUtcIso(iso);
    if (!d) return 'Sin fecha';
    return `${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
};

const SetterUnclaimedAgendas = ({ agendas, onResuelta }) => {
    const reducir = useReducedMotion();
    const [enviando, setEnviando] = useState(null);

    if (!agendas || agendas.length === 0) return null;

    const responder = async (agenda, accion) => {
        setEnviando(`${agenda.id}-${accion}`);
        try {
            const res = await api.post(`/setter/agendas/${agenda.id}/reclamar`, { accion });
            toast.success(accion === 'mia'
                ? `"${agenda.lead_name}" quedó como tuya`
                : `"${agenda.lead_name}" ya no te aparecerá`);
            onResuelta(agenda.id, res.data);
        } catch (err) {
            console.error('Error al responder por la agenda sin asignar:', err);
            toast.error(err.response?.data?.error || 'No se pudo registrar tu respuesta');
        } finally {
            setEnviando(null);
        }
    };

    return (
        <section className="ma-sin-dueno" aria-labelledby="ma-sin-dueno-t">
            <header className="ma-sin-dueno-cab">
                <HelpCircle size={18} aria-hidden="true" />
                <div>
                    <h2 id="ma-sin-dueno-t">¿Alguna de estas agendas es tuya? <span className="num">({agendas.length})</span></h2>
                    <p>
                        Entraron por un link de setting pero el formulario no dice de quién son. Si la
                        reclamás, queda con tu fuente y tus respuestas del formulario se vinculan a vos.
                        Si no es tuya, deja de aparecerte (les sigue apareciendo a los demás).
                    </p>
                </div>
            </header>

            <ul className="ma-sin-dueno-lista">
                <AnimatePresence initial={false}>
                    {agendas.map(a => (
                        <motion.li key={a.id} layout={!reducir} className="ma-sin-dueno-fila"
                            initial={reducir ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, transition: { duration: reducir ? 0 : 0.18 } }}>
                            <div className="ma-sin-dueno-dato">
                                <div className="fila" style={{ gap: 'var(--s2)', flexWrap: 'wrap' }}>
                                    <b className="trunc">{a.lead_name}</b>
                                    <span className="chip" style={{ '--c': 'var(--idle)' }}>{a.fuente || 'sin fuente'}</span>
                                </div>
                                <span className="ma-sin-dueno-cita">Cita: {fecha(a.start_time)}</span>
                                <span className="ma-meta">
                                    {a.instagram && <span><Instagram size={13} aria-hidden="true" />@{a.instagram.replace('@', '')}</span>}
                                    {a.phone && <span><Phone size={13} aria-hidden="true" />{a.phone}</span>}
                                    {a.mail && <span className="trunc"><Mail size={13} aria-hidden="true" />{a.mail}</span>}
                                </span>
                            </div>
                            <div className="ma-sin-dueno-acciones">
                                <button type="button" className="btn btn--cta btn--sm" disabled={!!enviando}
                                    onClick={() => responder(a, 'mia')}>
                                    {enviando === `${a.id}-mia` ? <Loader2 size={14} className="ma-gira" /> : <Check size={14} />}
                                    Es mía
                                </button>
                                <button type="button" className="btn btn--linea btn--sm" disabled={!!enviando}
                                    onClick={() => responder(a, 'no_mia')}>
                                    {enviando === `${a.id}-no_mia` ? <Loader2 size={14} className="ma-gira" /> : <X size={14} />}
                                    No es mía
                                </button>
                            </div>
                        </motion.li>
                    ))}
                </AnimatePresence>
            </ul>
        </section>
    );
};

export default SetterUnclaimedAgendas;
