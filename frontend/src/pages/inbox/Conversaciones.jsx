// Sección Conversaciones: cada persona que le escribió a la cuenta y su historial (lo que guardó el motor).
// El buscador y el filtro van en la cabecera; el filtro es local, sobre lo que trae la búsqueda.
// Por ahora solo se mira: contestar desde acá llega cuando el Inbox reemplace a Kommo.
import { useEffect, useRef, useState } from 'react';
import { Bot, MessageSquare, PauseCircle, Search, User, Workflow } from 'lucide-react';
import { Avatar, Chip, EmptyState, HeaderActions, InputGroup, Panel, Segmented } from '../../components/standard';
import { inboxApi } from './api';

const ORIGEN = { lead: 'Lead', motor: 'Bot', otro: 'Equipo' };
const FILTROS = [
    { value: 'todas', label: 'Todas', cumple: () => true },
    { value: 'sin_responder', label: 'Sin responder', cumple: (c) => c.ultimo_de === 'lead' },
    { value: 'bot_pausado', label: 'Bot pausado', cumple: (c) => c.bot_pausado },
];

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
    const lista = useRef(null);
    // Cada conversación monta un Chat nuevo (key={id}): arranca vacío, sin limpiar el estado acá.
    useEffect(() => {
        inboxApi.conversacion(id).then(setDatos).catch(() => setError('No se pudo cargar la conversación'));
    }, [id]);
    // Abre en el último mensaje, como cualquier chat.
    useEffect(() => { if (lista.current) lista.current.scrollTop = lista.current.scrollHeight; }, [datos]);
    if (error) return <EmptyState icon={<MessageSquare size={22} />}>{error}</EmptyState>;
    if (!datos) return <EmptyState>Cargando…</EmptyState>;
    const { contacto, ejecucion, mensajes } = datos;
    const variables = Object.entries(contacto.variables || {}).filter(([k]) => !k.startsWith('_'));
    const pausado = contacto.bot_pausado_hasta && new Date(contacto.bot_pausado_hasta) > new Date();
    return (
        <div className="cv-chat">
            <div className="cv-chat-cab">
                <Avatar name={contacto.username || contacto.nombre || '?'} />
                <h3 className="t-h3">{quien(contacto)}</h3>
                {ejecucion && <Chip color="var(--brand-secondary)" subtle icon={<Workflow />}>{ejecucion.flujo} · {ejecucion.estado.replace('_', ' ')}</Chip>}
                {pausado && <Chip color="var(--warning)" subtle icon={<PauseCircle />} data-tip={`Bot pausado|Hasta ${hora(contacto.bot_pausado_hasta)}`}>Bot pausado</Chip>}
                {variables.length > 0 && (
                    <div className="cv-variables" aria-label="Variables">
                        {variables.map(([k, v]) => <Chip key={k} subtle>{k}: {String(v)}</Chip>)}
                    </div>
                )}
            </div>
            <ol className="cv-mensajes" ref={lista}>
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

function Item({ c, elegida, onElegir }) {
    return (
        <li>
            <button type="button" className="cv-item" aria-pressed={elegida} onClick={() => onElegir(c.id)}>
                <Avatar name={c.username || c.nombre || '?'} size="sm" />
                <span className="cv-item-cuerpo">
                    <span className="cv-item-cab">
                        <strong>{quien(c)}</strong>
                        <span className="mut">{hora(c.ultimo_en)}</span>
                    </span>
                    <span className="cv-item-texto mut">
                        {c.ultimo_de === 'motor' ? <Bot size={12} /> : c.ultimo_de === 'otro' ? <User size={12} /> : null}
                        <span>{c.ultimo_texto || '…'}</span>
                        {c.ultimo_de === 'lead' && <i className="cv-nuevo" title="Sin responder" />}
                    </span>
                </span>
            </button>
        </li>
    );
}

export default function Conversaciones() {
    const [lista, setLista] = useState(null);
    const [buscar, setBuscar] = useState('');
    const [filtro, setFiltro] = useState('todas');
    const [elegida, setElegida] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => {
            inboxApi.conversaciones(buscar.trim()).then(setLista).catch(() => setError('No se pudieron cargar las conversaciones'));
        }, 250);
        return () => clearTimeout(t);
    }, [buscar]);

    const cuenta = (f) => (lista || []).filter(f.cumple).length;
    const visibles = (lista || []).filter(FILTROS.find((f) => f.value === filtro).cumple);

    let listado;
    if (error) listado = <EmptyState>{error}</EmptyState>;
    else if (lista === null) listado = <EmptyState>Cargando…</EmptyState>;
    else if (!lista.length) {
        listado = (
            <EmptyState icon={<MessageSquare size={22} />}>
                {buscar.trim() ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay conversaciones. Aparecen cuando el motor empieza a procesar los mensajes de Instagram.'}
            </EmptyState>
        );
    } else if (!visibles.length) listado = <EmptyState>No hay conversaciones en «{FILTROS.find((f) => f.value === filtro).label}».</EmptyState>;
    else {
        listado = (
            <ul>
                {visibles.map((c) => <Item key={c.id} c={c} elegida={elegida === c.id} onElegir={setElegida} />)}
            </ul>
        );
    }

    return (
        <>
            <HeaderActions>
                <div className="barra">
                    <Segmented size="sm" label="Filtrar conversaciones" value={filtro} onChange={setFiltro}
                        options={FILTROS.map((f) => ({ value: f.value, label: <>{f.label}<span className="fl-cuenta">{cuenta(f)}</span></> }))} />
                    <InputGroup className="cv-buscar" prefix={<Search size={16} />}>
                        <label className="sr" htmlFor="cv-buscar">Buscar por usuario</label>
                        <input id="cv-buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por usuario" autoComplete="off" />
                    </InputGroup>
                </div>
            </HeaderActions>
            <div className="cv">
                <Panel as="aside" size="sm" className="cv-lista" aria-label="Conversaciones">{listado}</Panel>
                <Panel as="section" size="sm" className="cv-detalle">
                    {elegida ? <Chat key={elegida} id={elegida} /> : <EmptyState icon={<MessageSquare size={22} />}>Elegí una conversación.</EmptyState>}
                </Panel>
            </div>
        </>
    );
}
