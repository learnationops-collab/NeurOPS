// El chat como historial, igual que en Kommo: los mensajes y, intercalados por hora, las notas internas
// (amarillas, el lead no las ve), las tareas y los eventos (reasignada, cambió la sub-etapa, corrigió una
// variable). Debajo de cada respuesta del lead, qué activó en el flujo.
import { useEffect, useRef } from 'react';
import { Bot, CalendarCheck, Check, History, StickyNote, Zap } from 'lucide-react';
import { rotuloPaso } from '../estadoFlujo';

const ABIERTA = ['en_curso', 'esperando_respuesta', 'esperando_tiempo'];

export function momento(iso) {
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
    if (e.tipo === 'pendiente') return <>Arrancó <b>{e.flujo}</b>, que había dejado listo el equipo{hacia}</>;
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

function Item({ x }) {
    if (x.tipo === 'mensaje') {
        const efecto = x.m.efecto && textoEfecto(x.m.efecto);
        return (
            <>
                <Burbuja m={x.m} />
                {efecto && <li className="cv-efecto"><Zap size={11} aria-hidden="true" /><span>{efecto}</span></li>}
            </>
        );
    }
    if (x.tipo === 'note') {
        return (
            <li className="cv-nota">
                <span className="cv-nota-cab"><StickyNote size={12} aria-hidden="true" />Nota interna · {x.n.autor || 'Equipo'}<span>{momento(x.n.en)}</span></span>
                <p>{x.n.texto}</p>
            </li>
        );
    }
    if (x.tipo === 'event') {
        return <li className="cv-evento"><History size={12} aria-hidden="true" />{x.n.texto}{x.n.autor ? ` · ${x.n.autor}` : ''}<span className="mut40">{momento(x.n.en)}</span></li>;
    }
    return (
        <li className={`cv-tarea-card${x.t.hecha ? ' cv-tarea-card--hecha' : ''}`}>
            <CalendarCheck size={14} aria-hidden="true" />
            <span>{x.t.titulo}{x.t.asignada ? ` · ${x.t.asignada.username}` : ''}</span>
            {x.t.vence && <small>{momento(x.t.vence)}</small>}
        </li>
    );
}

export default function Feed({ mensajes, notas, tareas }) {
    const lista = useRef(null);
    const items = [
        ...mensajes.map((m) => ({ tipo: 'mensaje', en: m.en, key: `m${m.id}`, m })),
        ...notas.map((n) => ({ tipo: n.tipo, en: n.en, key: `n${n.id}`, n })),
        ...tareas.map((t) => ({ tipo: 'tarea', en: t.en, key: `t${t.id}`, t })),
    ].sort((a, b) => new Date(a.en) - new Date(b.en));
    const cantidad = items.length;
    // Abre en lo último, como cualquier chat, y baja cuando llega algo nuevo.
    useEffect(() => { if (lista.current) lista.current.scrollTop = lista.current.scrollHeight; }, [cantidad]);
    return <ol className="cv-mensajes" ref={lista}>{items.map((x) => <Item key={x.key} x={x} />)}</ol>;
}
