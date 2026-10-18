import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Bot, CalendarClock, Check, Instagram, ListChecks, Loader2, Tag } from 'lucide-react';
import BuscadorAnuncio from './BuscadorAnuncio';
import { parseUtcIso } from '../../../utils/datetime';
import { colorDe, cuandoLegible, iniciales } from './TarjetaAgenda';
import { nombreDeMes } from './meses';

/**
 * La pestaña «Completadas» de «Mis agendas»: las agendas del mes que ya tienen la palabra clave.
 *
 * Pedido del dueño (15/10/2026): «quisiera saber los que ya pusieron, quiero saber si están
 * avanzando o no en esto: pendientes por un lado y [...] el tab de completados por otro, para saber
 * rápidamente al entrar si están funcionando o no». Es de solo lectura: quién es, cuándo es la
 * reunión, en qué estado está, qué palabra clave tiene y quién se la puso (el setter, con la fecha,
 * o ManyChat, que la atribuyó solo: ver `palabra_clave_service.completadas`).
 *
 * **Cambiar (18/10/2026).** Kerwin: «debería haber forma de cambiar la palabra clave si es incorrecta».
 * Cada una tiene «Cambiar», que abre el buscador debajo: la nueva queda como elegida por el setter y
 * manda sobre ManyChat (`Appointment.anuncio_id`).
 */
const dos = (n) => String(n).padStart(2, '0');

/** "10/10 · 11:00": cuándo la asignó, en la hora de quien mira. */
export const asignadaLegible = (iso) => {
    const d = parseUtcIso(iso);
    if (!d) return null;
    return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} · ${dos(d.getHours())}:${dos(d.getMinutes())}`;
};

/** El buscador para cambiar la palabra clave de una completada: foco directo, Enter guarda, Esc cierra. */
const Cambiar = ({ agenda, anuncios, onCambiar, onCerrar }) => {
    const [elegido, setElegido] = useState(null);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState(null);
    const buscador = useRef(null);
    useEffect(() => { buscador.current?.focus(); }, []);

    const guardar = async (anuncio = elegido) => {
        if (!anuncio || enviando) return;
        setEnviando(true);
        setError(null);
        const r = await onCambiar(agenda, anuncio);
        if (r?.error) {
            setEnviando(false);
            setError(r.error);
            requestAnimationFrame(() => buscador.current?.focus());
        }
    };

    return (
        <div className="ma-cambiar" onKeyDown={(e) => { if (e.key === 'Escape') onCerrar(); }}>
            <BuscadorAnuncio ref={buscador} anuncios={anuncios} elegido={elegido} deshabilitado={enviando}
                onElegir={(a) => { setElegido(a); setError(null); }} onConfirmar={guardar}
                etiqueta="Nueva palabra clave" />
            <button type="button" className="btn btn--cta btn--sm ma-btn" disabled={!elegido || enviando} onClick={() => guardar()}>
                {enviando ? <Loader2 size={15} className="ma-gira" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                {enviando ? 'Guardando' : 'Cambiar'}
            </button>
            <button type="button" className="ma-ig-cambiar" disabled={enviando} onClick={onCerrar}>Cancelar</button>
            {error && <p className="ma-error" role="alert">{error}</p>}
        </div>
    );
};

const FilaCompletada = ({ agenda, anuncios, onCambiar }) => {
    const [cambiando, setCambiando] = useState(false);
    const estado = agenda.estado;
    const cuando = agenda.por === 'setter' ? asignadaLegible(agenda.asignada) : null;
    return (
        <li className="ma-hecha" aria-label={`Completada: ${agenda.cliente}`}>
            <div className="ma-quien">
                <span className="ma-ini" style={{ '--c': colorDe(agenda.cliente) }} aria-hidden="true">
                    {iniciales(agenda.cliente)}
                </span>
                <div className="ma-quien-t">
                    <h3 className="ma-nombre trunc" title={agenda.cliente}>{agenda.cliente}</h3>
                    <div className="ma-meta">
                        <span title="La reunión, en tu hora"><CalendarClock size={14} aria-hidden="true" />{cuandoLegible(agenda.reunion)}</span>
                        {agenda.instagram && (
                            <span className="ma-hecha-ig" title="Instagram"><Instagram size={14} aria-hidden="true" />@{agenda.instagram}</span>
                        )}
                    </div>
                </div>
                {estado?.label && (
                    <span className="chip ma-estado" style={{ '--c': `var(--${estado.tone || 'idle'})` }}
                        title={estado.ayuda}>{estado.label}</span>
                )}
            </div>
            <div className="ma-hecha-clave">
                <span className="chip ma-clave" title="Palabra clave del anuncio">
                    <Tag size={13} aria-hidden="true" /><span className="ma-clave-t">{agenda.palabra_clave || 'Sin anuncio'}</span>
                </span>
                {agenda.por === 'manychat' ? (
                    <span className="ma-hecha-por ma-hecha-por--manychat"
                        title="Llegó por ManyChat con su anuncio: nadie tuvo que asignarla.">
                        <Bot size={14} aria-hidden="true" />Por ManyChat
                    </span>
                ) : (
                    <span className="ma-hecha-por">
                        <Check size={14} aria-hidden="true" />{cuando ? `Asignada el ${cuando}` : 'Asignada'}
                    </span>
                )}
                {onCambiar && !cambiando && (
                    <button type="button" className="ma-ig-cambiar" onClick={() => setCambiando(true)}
                        aria-label={`Cambiar la palabra clave de ${agenda.cliente}`}>
                        Cambiar
                    </button>
                )}
            </div>
            {cambiando && (
                <Cambiar agenda={agenda} anuncios={anuncios}
                    onCambiar={async (a, anuncio) => {
                        const r = await onCambiar(a, anuncio);
                        if (!r?.error) setCambiando(false);
                        return r;
                    }}
                    onCerrar={() => setCambiando(false)} />
            )}
        </li>
    );
};

const ListaCompletadas = ({ agendas, mes, anuncios = [], onCambiar }) => {
    const reducir = useReducedMotion();
    const nombre = mes ? nombreDeMes(mes) : '';
    if (!agendas.length) {
        return (
            <motion.div key={`vacia-${mes || 'todas'}`} className="ma-hechas-vacia"
                initial={reducir ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
                <ListChecks size={28} aria-hidden="true" />
                <p>Todavía no completaste ninguna{nombre ? ` en ${nombre}` : ''}.</p>
            </motion.div>
        );
    }
    return (
        <motion.ul key={mes || 'todas'} className="ma-lista ma-hechas"
            aria-label={nombre ? `Completadas en ${nombre}` : 'Completadas'}
            initial={reducir ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
            {agendas.map(a => <FilaCompletada key={a.id} agenda={a} anuncios={anuncios} onCambiar={onCambiar} />)}
        </motion.ul>
    );
};

export default ListaCompletadas;
