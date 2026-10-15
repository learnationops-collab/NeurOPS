// Sección Conversaciones: cada persona que le escribió a la cuenta y su historial (lo que guardó el motor).
// Por ahora solo se mira: contestar desde acá llega cuando el Inbox reemplace a Kommo.
import { useEffect, useState } from 'react';
import { Bot, MessageSquare, Search, User } from 'lucide-react';
import { inboxApi } from './api';

const ORIGEN = { lead: 'Lead', motor: 'Bot', otro: 'Equipo' };

function hora(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const hoy = new Date().toDateString() === d.toDateString();
    return d.toLocaleString('es', hoy ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function quien(c) {
    return c.username ? `@${c.username}` : c.nombre || `Contacto ${c.igsid.slice(-6)}`;
}

function Chat({ id }) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        setDatos(null);
        inboxApi.conversacion(id).then(setDatos).catch(() => setError('No se pudo cargar la conversación'));
    }, [id]);
    if (error) return <p className="campo-err" role="alert">{error}</p>;
    if (!datos) return <p className="t-sm mut cv-vacio">Cargando…</p>;
    const { contacto, ejecucion, mensajes } = datos;
    const variables = Object.entries(contacto.variables || {}).filter(([k]) => !k.startsWith('_'));
    return (
        <div className="cv-chat">
            <div className="cv-chat-cab">
                <h3 className="t-h3">{quien(contacto)}</h3>
                {ejecucion && <span className="chip chip--n">{ejecucion.flujo} · {ejecucion.estado.replace('_', ' ')}</span>}
                {contacto.bot_pausado_hasta && new Date(contacto.bot_pausado_hasta) > new Date() && <span className="chip chip--n">Bot pausado</span>}
                {variables.length > 0 && (
                    <p className="t-sm mut cv-variables">{variables.map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
                )}
            </div>
            <ol className="cv-mensajes">
                {mensajes.map((m) => (
                    <li key={m.id} className={`cv-burbuja cv-burbuja--${m.direccion} cv-burbuja--${m.origen}`}>
                        {m.texto && <p>{m.texto}</p>}
                        {m.adjuntos.map((a, i) => <p key={i} className="mut">📎 {a}</p>)}
                        {m.botones.length > 0 && <div className="cv-botones">{m.botones.map((b) => <span key={b}>{b}</span>)}</div>}
                        <span className="cv-meta">{m.direccion === 'saliente' ? `${ORIGEN[m.origen]} · ` : ''}{hora(m.en)}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

export default function Conversaciones() {
    const [lista, setLista] = useState(null);
    const [buscar, setBuscar] = useState('');
    const [elegida, setElegida] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => {
            inboxApi.conversaciones(buscar.trim()).then(setLista).catch(() => setError('No se pudieron cargar las conversaciones'));
        }, 250);
        return () => clearTimeout(t);
    }, [buscar]);

    return (
        <div className="cv">
            <aside className="cv-lista panel panel--sm">
                <label className="cv-buscar">
                    <Search size={15} />
                    <input className="input" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por usuario" />
                </label>
                {error && <p className="campo-err" role="alert">{error}</p>}
                {lista?.length === 0 && (
                    <p className="t-sm mut cv-vacio">
                        Todavía no hay conversaciones. Aparecen cuando el motor empieza a procesar los mensajes de Instagram.
                    </p>
                )}
                <ul>
                    {lista?.map((c) => (
                        <li key={c.id}>
                            <button type="button" className={`cv-item${elegida === c.id ? ' cv-item--sel' : ''}`} onClick={() => setElegida(c.id)}>
                                <span className="cv-item-cab"><strong>{quien(c)}</strong><span className="mut">{hora(c.ultimo_en)}</span></span>
                                <span className="cv-item-texto mut">
                                    {c.ultimo_de === 'motor' ? <Bot size={12} /> : c.ultimo_de === 'otro' ? <User size={12} /> : null}
                                    {c.ultimo_texto || '…'}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </aside>
            <section className="cv-detalle panel panel--sm">
                {elegida ? <Chat id={elegida} /> : (
                    <div className="vacio cv-vacio"><MessageSquare size={22} /><p className="t-sm mut">Elegí una conversación.</p></div>
                )}
            </section>
        </div>
    );
}
