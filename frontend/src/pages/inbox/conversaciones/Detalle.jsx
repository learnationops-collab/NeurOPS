// La conversación abierta: el chat al centro y, a la derecha, la ficha del lead y su recorrido por
// los flujos. En el chat se ve qué botón eligió el lead y qué activó cada respuesta suya en el flujo.
// Por ahora solo se mira: contestar desde acá llega cuando el Inbox reemplace a Kommo.
import { useEffect, useRef, useState } from 'react';
import { Bot, Check, Instagram, MessageSquare, Zap } from 'lucide-react';
import { Avatar, EmptyState, IconButton, Panel } from '../../../components/standard';
import { rotuloPaso } from '../estadoFlujo';
import { inboxApi } from '../api';
import { Asignado } from './Fila';
import { REFRESCO, examenDe, quien } from './colas';

const EJECUCION = {
    en_curso: { texto: 'En curso', color: 'var(--info)' },
    esperando_respuesta: { texto: 'Esperando respuesta', color: 'var(--info)' },
    esperando_tiempo: { texto: 'Esperando', color: 'var(--info)' },
    terminada: { texto: 'Terminó', color: 'var(--success)' },
    cancelada: { texto: 'Cancelado', color: 'var(--idle)' },
    ventana_vencida: { texto: 'Venció la ventana de 24 h', color: 'var(--warning)' },
    error: { texto: 'Error', color: 'var(--error)' },
};
const ABIERTA = ['en_curso', 'esperando_respuesta', 'esperando_tiempo'];

function momento(iso) {
    const d = new Date(iso);
    const hoy = new Date().toDateString() === d.toDateString();
    return d.toLocaleString('es', hoy ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Qué activó la respuesta del lead: «Palabra clave #enarm → arrancó X», «Guardó examen = ENARM → Paso 2».
function textoEfecto(e) {
    const hacia = e.paso && ABIERTA.includes(e.estado) ? ` → ${rotuloPaso(e.paso)}` : e.estado === 'terminada' ? ' → terminó el flujo' : '';
    if (e.tipo === 'inicio') return <>{e.clave ? <>Palabra clave <b>#{e.clave}</b> → </> : null}arrancó <b>{e.flujo}</b>{hacia}</>;
    if (e.tipo === 'respuesta') {
        const [campo, valor] = Object.entries(e.guardo || {})[0] || [];
        return <>Guardó <b>{campo} = {valor}</b>{hacia}</>;
    }
    if (e.tipo === 'boton') return <>Eligió <b>{e.boton}</b>{hacia}</>;
    return null;
}

function Burbuja({ m }) {
    return (
        <li className={`cv-burbuja cv-burbuja--${m.direccion} cv-burbuja--${m.origen}`}>
            {m.texto && <p>{m.texto}</p>}
            {m.adjuntos.map((a, i) => <p key={i} className="mut">📎 {a}</p>)}
            {m.botones.length > 0 && (
                <div className={`cv-botones${m.elegido ? ' cv-botones--respondido' : ''}`}>
                    {m.botones.map((b) => (b === m.elegido
                        ? <span key={b} className="cv-elegido" data-tip="Lo eligió el lead"><Check size={11} aria-hidden="true" />{b}</span>
                        : <span key={b}>{b}</span>))}
                </div>
            )}
            <span className="cv-meta">
                {m.origen === 'motor' && <><Bot size={12} aria-hidden="true" />Automático · </>}
                {m.origen === 'otro' && 'Equipo · '}
                {momento(m.en)}
            </span>
        </li>
    );
}

function Chat({ contacto, asignado, ejecucion, mensajes, yo }) {
    const lista = useRef(null);
    const cantidad = mensajes.length;
    // Abre en el último mensaje, como cualquier chat, y baja cuando llega uno nuevo.
    useEffect(() => { if (lista.current) lista.current.scrollTop = lista.current.scrollHeight; }, [cantidad]);
    const pausado = contacto.bot_pausado_hasta && new Date(contacto.bot_pausado_hasta) > new Date();
    const abierta = ejecucion && ABIERTA.includes(ejecucion.estado);
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
                <div className="cv-chat-asignado">
                    <Asignado asignado={asignado} yo={yo} />
                    <span className="t-cap mut40">{asignado?.campana ? `entró por ${asignado.campana}` : 'Sin campaña'}</span>
                </div>
                {contacto.username && (
                    <IconButton label={`Abrir @${contacto.username} en Instagram`} data-tip="Abrir en Instagram" icon={<Instagram size={16} />}
                        onClick={() => window.open(`https://www.instagram.com/${encodeURIComponent(contacto.username)}/`, '_blank', 'noopener')} />
                )}
            </div>
            <ol className="cv-mensajes" ref={lista}>
                {mensajes.map((m) => {
                    const efecto = m.efecto && textoEfecto(m.efecto);
                    return [
                        <Burbuja key={m.id} m={m} />,
                        efecto && <li key={`e${m.id}`} className="cv-efecto"><Zap size={11} aria-hidden="true" /><span>{efecto}</span></li>,
                    ];
                })}
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
                                <span>{est.texto}{e.paso && ABIERTA.includes(e.estado) ? ` en ${rotuloPaso(e.paso)}` : ''}</span>
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

export default function Detalle({ id, yo }) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    // Cada conversación monta un Detalle nuevo (key={id}): arranca vacío. Se vuelve a pedir cada
    // REFRESCO sin vaciar lo que se ve.
    useEffect(() => {
        let vivo = true;
        const pedir = () => inboxApi.conversacion(id)
            .then((d) => { if (vivo) { setDatos(d); setError(null); } })
            .catch(() => { if (vivo) setError('No se pudo cargar la conversación'); });
        pedir();
        const cada = setInterval(pedir, REFRESCO);
        return () => { vivo = false; clearInterval(cada); };
    }, [id]);
    if (error && !datos) return <Panel size="sm" className="cv-detalle"><EmptyState icon={<MessageSquare size={22} />}>{error}</EmptyState></Panel>;
    if (!datos) return <Panel size="sm" className="cv-detalle"><EmptyState>Cargando…</EmptyState></Panel>;
    return (
        <>
            <Chat contacto={datos.contacto} asignado={datos.asignado} ejecucion={datos.ejecucion} mensajes={datos.mensajes} yo={yo} />
            <Ficha contacto={datos.contacto} recorrido={datos.recorrido || []} />
        </>
    );
}
