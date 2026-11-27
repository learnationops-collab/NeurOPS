import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, CornerDownRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar, Button, Status } from '../../standard';
import AudioPedido from './AudioPedido';
import CajaMensaje from './CajaMensaje';
import { listarPedidos, pedirActualizacion, responderPedido } from './pedidosApi';
import './pedidos.css';

const CADA = 20000;
const hora = (iso) => new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Mensaje({ quien, cuando, texto, audio }) {
    return (
        <div className="pa-msj">
            <Avatar name={quien} size="xs" />
            <div className="pa-msj__cuerpo">
                <span className="t-cap mut">{quien} · {hora(cuando)}</span>
                {texto && <p className="pa-msj__texto">{texto}</p>}
                {audio}
            </div>
        </div>
    );
}

function Pedido({ p, onResponder }) {
    const [respondiendo, setRespondiendo] = useState(false);
    return (
        <motion.li className="pa-pedido" layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Mensaje quien={p.de} cuando={p.creado} texto={p.mensaje || (!p.con_audio && 'Pidió una actualización.')}
                audio={p.con_audio && <AudioPedido id={p.id} cual="pedido" />} />
            {p.respondido ? (
                <div className="pa-respuesta">
                    <CornerDownRight size={14} className="mut" aria-hidden="true" />
                    <Mensaje quien={p.respondio} cuando={p.respondido} texto={p.respuesta}
                        audio={p.respuesta_con_audio && <AudioPedido id={p.id} cual="respuesta" />} />
                </div>
            ) : p.puede_responder ? (
                respondiendo
                    ? <CajaMensaje requerido placeholder="Contale qué pasó con la sesión…" enviarLabel="Responder"
                        onCancelar={() => setRespondiendo(false)}
                        onEnviar={async (t, a) => { await onResponder(p.id, t, a); setRespondiendo(false); }} />
                    : <div className="pa-pie"><Button variant="primary" onClick={() => setRespondiendo(true)}>Responder</Button></div>
            ) : (
                <Status color="var(--warning)"><Clock size={12} aria-hidden="true" /> Esperando a {p.para}</Status>
            )}
        </motion.li>
    );
}

/** Los pedidos de esta sesión, refrescados cada 20 s con la ficha abierta (ADR-W275). */
export function usePedidos(appointmentId) {
    const [datos, setDatos] = useState(null);
    const cargar = useCallback(() => {
        if (!appointmentId) return;
        listarPedidos(appointmentId).then(setDatos).catch(() => {});
    }, [appointmentId]);

    useEffect(() => {
        cargar();
        const id = setInterval(() => { if (document.visibilityState === 'visible') cargar(); }, CADA);
        return () => clearInterval(id);
    }, [cargar]);

    const pedir = async (m, a) => {
        await pedirActualizacion(appointmentId, m, a);
        toast.success('Pedido enviado. Te avisamos cuando responda.');
        cargar();
    };
    const responder = async (id, t, a) => {
        await responderPedido(id, t, a);
        toast.success('Respuesta enviada.');
        cargar();
    };
    return { pedidos: datos?.pedidos || [], puedePedir: !!datos?.puede_pedir, pedir, responder };
}

/** El hilo: cada pedido con su respuesta, o «Responder» para quien lo recibió. */
export function HiloPedidos({ pedidos, onResponder }) {
    if (!pedidos.length) return null;
    return (
        <ul className="pa-lista">
            {pedidos.map((p) => <Pedido key={p.id} p={p} onResponder={onResponder} />)}
        </ul>
    );
}

/** La caja para pedir una actualización: texto opcional o audio dictado. */
export function CajaPedido({ abierto, onPedir, onCerrar }) {
    return (
        <AnimatePresence initial={false}>
            {abierto && (
                <motion.div key="caja" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}>
                    <CajaMensaje placeholder="¿Qué querés saber? (opcional) · o grabá un audio"
                        enviarLabel="Pedir actualización" onCancelar={onCerrar}
                        onEnviar={async (m, a) => { await onPedir(m, a); onCerrar(); }} />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
