// La conversación abierta: el chat al centro y, a la derecha, la ficha del lead y su recorrido por
// los flujos. Por ahora solo se mira: contestar desde acá llega cuando el Inbox reemplace a Kommo.
import { useEffect, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Avatar, EmptyState, Panel } from '../../../components/standard';
import { rotuloPaso } from '../estadoFlujo';
import { inboxApi } from '../api';
import { examenDe, quien } from './colas';

const ORIGEN = { lead: 'Lead', motor: 'Bot', otro: 'Equipo' };
const EJECUCION = {
    en_curso: { texto: 'En curso', color: 'var(--brand-secondary)' },
    esperando_respuesta: { texto: 'Esperando respuesta', color: 'var(--brand-secondary)' },
    esperando_tiempo: { texto: 'Esperando', color: 'var(--brand-secondary)' },
    terminada: { texto: 'Terminó', color: 'var(--success)' },
    cancelada: { texto: 'Cancelado', color: 'var(--idle)' },
    ventana_vencida: { texto: 'Venció la ventana de 24 h', color: 'var(--warning)' },
    error: { texto: 'Error', color: 'var(--error)' },
};

function momento(iso) {
    const d = new Date(iso);
    const hoy = new Date().toDateString() === d.toDateString();
    return d.toLocaleString('es', hoy ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Chat({ contacto, ejecucion, mensajes }) {
    const lista = useRef(null);
    // Abre en el último mensaje, como cualquier chat.
    useEffect(() => { if (lista.current) lista.current.scrollTop = lista.current.scrollHeight; }, [mensajes]);
    const pausado = contacto.bot_pausado_hasta && new Date(contacto.bot_pausado_hasta) > new Date();
    const abierta = ejecucion && EJECUCION[ejecucion.estado]?.color === 'var(--brand-secondary)';
    const linea = [
        examenDe({ examen: contacto.variables?.examen }),
        abierta && ejecucion.paso && rotuloPaso(ejecucion.paso),
        pausado && `bot en pausa hasta ${momento(contacto.bot_pausado_hasta)}`,
    ].filter(Boolean).join(' · ');
    return (
        <Panel as="section" size="sm" className="cv-detalle" aria-label="Conversación">
            <div className="cv-chat-cab">
                <Avatar name={contacto.username || contacto.nombre || '?'} />
                <div className="cv-chat-quien">
                    <h3 className="t-h3">{quien(contacto)}</h3>
                    {linea && <span className="t-cap mut">{linea}</span>}
                </div>
            </div>
            <ol className="cv-mensajes" ref={lista}>
                {mensajes.map((m) => (
                    <li key={m.id} className={`cv-burbuja cv-burbuja--${m.direccion} cv-burbuja--${m.origen}`}>
                        {m.texto && <p>{m.texto}</p>}
                        {m.adjuntos.map((a, i) => <p key={i} className="mut">📎 {a}</p>)}
                        {m.botones.length > 0 && <div className="cv-botones">{m.botones.map((b) => <span key={b}>{b}</span>)}</div>}
                        <span className="cv-meta">{m.direccion === 'saliente' ? `${ORIGEN[m.origen]} · ` : ''}{momento(m.en)}</span>
                    </li>
                ))}
            </ol>
            <p className="cv-pie t-cap mut40">Para contestar, usá Instagram o Kommo: responder desde acá llega cuando el Inbox reemplace a Kommo.</p>
        </Panel>
    );
}

function Ficha({ contacto, recorrido }) {
    const variables = contacto.variables || {};
    const califica = variables._califica;
    const filas = [
        ['Examen', variables.examen],
        ['Califica', califica === true ? 'Sí' : califica === false ? 'No' : null],
        ...Object.entries(variables).filter(([k]) => !k.startsWith('_') && k !== 'examen').map(([k, v]) => [k.replace(/_/g, ' '), String(v)]),
    ].filter(([, v]) => v != null && v !== '');
    return (
        <Panel as="aside" size="sm" className="cv-ficha" aria-label="Ficha del lead">
            <span className="t-rotulo">Ficha del lead</span>
            {filas.length ? (
                <dl className="cv-datos">
                    {filas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                </dl>
            ) : <p className="t-cap mut">El flujo todavía no guardó datos de esta persona.</p>}
            <span className="t-rotulo">Recorrido</span>
            {recorrido.length ? (
                <ol className="cv-recorrido">
                    {recorrido.map((e, i) => {
                        const est = EJECUCION[e.estado] || { texto: e.estado };
                        return (
                            <li key={i} style={{ '--c': est.color }}>
                                <strong>{e.flujo}</strong>
                                <span>{est.texto}{e.paso && est.color === 'var(--brand-secondary)' ? ` en ${rotuloPaso(e.paso)}` : ''}</span>
                                {e.detalle && <span className="mut">{e.detalle}</span>}
                                <span className="mut40">{momento(e.iniciada_en)}</span>
                            </li>
                        );
                    })}
                </ol>
            ) : <p className="t-cap mut">No pasó por ningún flujo.</p>}
        </Panel>
    );
}

export default function Detalle({ id }) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    // Cada conversación monta un Detalle nuevo (key={id}): arranca vacío, sin limpiar el estado acá.
    useEffect(() => {
        inboxApi.conversacion(id).then(setDatos).catch(() => setError('No se pudo cargar la conversación'));
    }, [id]);
    if (error) return <Panel size="sm" className="cv-detalle"><EmptyState icon={<MessageSquare size={22} />}>{error}</EmptyState></Panel>;
    if (!datos) return <Panel size="sm" className="cv-detalle"><EmptyState>Cargando…</EmptyState></Panel>;
    return (
        <>
            <Chat contacto={datos.contacto} ejecucion={datos.ejecucion} mensajes={datos.mensajes} />
            <Ficha contacto={datos.contacto} recorrido={datos.recorrido || []} />
        </>
    );
}
