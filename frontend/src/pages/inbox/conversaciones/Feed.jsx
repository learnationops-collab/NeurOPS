// El chat como historial, igual que en Kommo: los mensajes y, intercalados por hora, las notas internas
// (amarillas, el lead no las ve), las tareas y los eventos (reasignada, cambió la sub-etapa, corrigió una
// variable). Debajo de cada respuesta del lead, qué activó en el flujo. Al final, lo que el setter acaba de
// mandar y todavía no confirmó Instagram (`useEnvio`): «enviando…» o «no salió» con Reintentar.
import { Fragment, useEffect, useRef, useState } from 'react';
import { Bot, CalendarCheck, Check, Copy, History, Hourglass, MessageCircle, RotateCcw, StickyNote, X, Zap } from 'lucide-react';
import { Button, IconButton, toast } from '../../../components/standard';
import { rotuloPaso } from '../estadoFlujo';
import { ADJUNTOS } from './colas';
import { Cita, Medio } from './Whatsapp';
import { MarcaEnMensaje } from './MarcaSeguimiento';

const ABIERTA = ['en_curso', 'esperando_respuesta', 'esperando_tiempo'];

// «hoy 10:34», «ayer 10:34», «25 nov 10:34» (Mario, 27/11/2026: que se sepa de qué día es sin pensar).
export function momento(iso) {
    const d = new Date(iso);
    const hora = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    const dias = diasAtras(d);
    if (dias === 0) return `hoy ${hora}`;
    if (dias === 1) return `ayer ${hora}`;
    return `${d.toLocaleDateString('es', { day: 'numeric', month: 'short' })} ${hora}`;
}

// Cuántos días calendario atrás (0 = hoy).
function diasAtras(d) {
    const ahora = new Date();
    return Math.round((new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
}

// El separador de día del chat: «Hoy», «Ayer», «Miércoles 25 nov».
function rotuloDia(iso) {
    const d = new Date(iso);
    const dias = diasAtras(d);
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Ayer';
    const t = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' });
    return t.charAt(0).toUpperCase() + t.slice(1);
}

// «45 min», «3 h», «2 d».
const duracion = (min) => (min < 60 ? `${Math.max(1, Math.round(min))} min` : min < 1440 ? `${Math.floor(min / 60)} h` : `${Math.floor(min / 1440)} d`);

// Al pie del chat, si lo último (sin el bot) es del equipo: hace cuánto no responde (desde el primer mensaje que quedó
// sin respuesta) y hace cuánto fue tu último mensaje. Con 12 h desde el último, ya toca seguimiento (ámbar); con 3 días
// sin responder, rojo (Mario, 27/11/2026: «saber si amerita seguimiento»). Se mueve solo cada minuto.
function SinRespuesta({ mensajes }) {
    const [, setTic] = useState(0);
    useEffect(() => { const id = setInterval(() => setTic((n) => n + 1), 60000); return () => clearInterval(id); }, []);
    const propios = mensajes.filter((m) => m.origen !== 'motor');
    let i = propios.length - 1;
    while (i >= 0 && propios[i].direccion !== 'entrante') i -= 1;
    const nuestros = propios.slice(i + 1);
    if (!nuestros.length) return null;
    const ahora = Date.now();
    const desde = (ahora - Date.parse(nuestros[0].en)) / 60000;
    const ultimo = (ahora - Date.parse(nuestros[nuestros.length - 1].en)) / 60000;
    const toca = ultimo >= 12 * 60;
    const tono = desde >= 3 * 1440 ? 'rojo' : toca ? 'toca' : '';
    return (
        <li className={`cv-sin-resp${tono ? ` cv-sin-resp--${tono}` : ''}`}
            data-tip={`${toca ? 'Ya toca seguimiento' : 'Todavía no toca seguimiento'}|${i >= 0 ? `Su última respuesta: ${momento(propios[i].en)}` : 'Nunca respondió'} · tu último mensaje: ${momento(nuestros[nuestros.length - 1].en)}`}>
            <Hourglass size={12} aria-hidden="true" />
            <b>No responde hace {duracion(desde)}</b>
            <span>tu último hace {duracion(ultimo)}{toca ? ' · toca seguimiento' : ''}</span>
        </li>
    );
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

function Copiar({ texto }) {
    const copiar = () => navigator.clipboard.writeText(texto).then(() => toast('Copiado'), () => toast('No se pudo copiar', 'error'));
    return <button type="button" className="cv-copiar" onClick={copiar}><Copy size={11} aria-hidden="true" />Copiar</button>;
}

function Burbuja({ m, onCambio, resaltado }) {
    return (
        <li className={`cv-burbuja cv-burbuja--${m.direccion} cv-burbuja--${m.origen}${m.medio?.tipo === 'sticker' ? ' cv-burbuja--sticker' : ''}${resaltado ? ' cv-burbuja--resaltada' : ''}`}
            data-mensaje={m.id} data-direccion={m.direccion}>
            {m.comentario && (
                <span className="cv-comentario" data-tip="No es un DM|Comentó una publicación: si no abrió la conversación, puede que no se le pueda escribir">
                    <MessageCircle size={12} aria-hidden="true" />Comentario en una publicación
                    {m.comentario.permalink && <a href={m.comentario.permalink} target="_blank" rel="noreferrer">Ver publicación</a>}
                </span>
            )}
            {m.responde_a && <Cita cita={m.responde_a} />}
            {m.medio && <Medio medio={m.medio} />}
            {(m.medio ? m.medio.leyenda : m.texto) && <p>{m.medio ? m.medio.leyenda : m.texto}</p>}
            {m.adjuntos.map((a, i) => <p key={i} className="mut">{ADJUNTOS[a] || `📎 ${a}`}</p>)}
            {m.botones.length > 0 && (
                <div className={`cv-botones${m.elegido ? ' cv-botones--respondido' : ''}`}>
                    {m.botones.map((b) => (b === m.elegido
                        ? <span key={b} className="cv-elegido" data-tip="Lo eligió el lead"><Check size={11} aria-hidden="true" />{b}</span>
                        : <span key={b}>{b}</span>))}
                </div>
            )}
            <span className="cv-meta">
                {m.origen === 'motor' && <><Bot size={12} aria-hidden="true" />Automático · </>}
                {m.origen === 'otro' && (m.autor ? `${m.autor} · ` : 'Equipo · ')}
                {momento(m.en)}
                <MarcaEnMensaje m={m} onCambio={onCambio} />
                {resaltado && m.texto && <Copiar texto={m.texto} />}
            </span>
        </li>
    );
}

function Item({ x, onCambio, resaltar }) {
    if (x.tipo === 'mensaje') {
        const efecto = x.m.efecto && textoEfecto(x.m.efecto);
        return (
            <>
                <Burbuja m={x.m} onCambio={onCambio} resaltado={x.m.id === resaltar} />
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

function Pendiente({ p, onReintentar, onDescartar }) {
    const error = p.estado === 'error';
    return (
        <li className={`cv-burbuja cv-burbuja--saliente cv-burbuja--otro cv-pendiente${error ? ' cv-pendiente--error' : ''}`}>
            <p>{p.rotulo}</p>
            {error ? (
                <span className="cv-pendiente-error" role="alert">
                    No salió: {p.motivo}
                    <Button size="sm" icon={<RotateCcw size={12} />} onClick={() => onReintentar(p)}>Reintentar</Button>
                    <IconButton size="xs" label="Descartar" icon={<X size={12} />} onClick={() => onDescartar(p.id)} />
                </span>
            ) : <span className="cv-meta">Vos · {p.estado === 'cola' ? 'en cola, sale en unos segundos' : 'enviando…'}</span>}
        </li>
    );
}

// `onSeleccion`: al soltar el mouse con texto seleccionado (Anotar resaltando, `Cita.jsx`).
// `resaltar`: el mensaje que encontró «#texto» (ADR-W294): el chat abre ahí en lugar de en lo último.
export default function Feed({ mensajes, notas, tareas, pendientes = [], onReintentar, onDescartar, onSeleccion, onCambio, resaltar }) {
    const lista = useRef(null);
    const items = [
        ...mensajes.map((m) => ({ tipo: 'mensaje', en: m.en, key: `m${m.id}`, m })),
        ...notas.map((n) => ({ tipo: n.tipo, en: n.en, key: `n${n.id}`, n })),
        ...tareas.map((t) => ({ tipo: 'tarea', en: t.en, key: `t${t.id}`, t })),
    ].sort((a, b) => new Date(a.en) - new Date(b.en));
    const cantidad = items.length + pendientes.length;
    // Abre en lo último, como cualquier chat, y baja cuando llega algo nuevo.
    const enResaltado = useRef(false);
    useEffect(() => {
        if (!lista.current) return;
        const destino = resaltar && !enResaltado.current && lista.current.querySelector(`[data-mensaje="${resaltar}"]`);
        if (destino) { enResaltado.current = true; destino.scrollIntoView({ block: 'center' }); return; }
        if (!enResaltado.current) lista.current.scrollTop = lista.current.scrollHeight;
    }, [cantidad, resaltar]);
    // Un separador cada vez que cambia el día, como en WhatsApp.
    let diaAnterior = null;
    return (
        <ol className="cv-mensajes" ref={lista} onMouseUp={onSeleccion}>
            {items.map((x) => {
                const dia = new Date(x.en).toDateString();
                const nuevo = dia !== diaAnterior;
                diaAnterior = dia;
                return (
                    <Fragment key={x.key}>
                        {nuevo && <li className="cv-dia" aria-label={rotuloDia(x.en)}><span>{rotuloDia(x.en)}</span></li>}
                        <Item x={x} onCambio={onCambio} resaltar={resaltar} />
                    </Fragment>
                );
            })}
            {pendientes.map((p) => <Pendiente key={p.id} p={p} onReintentar={onReintentar} onDescartar={onDescartar} />)}
            {!pendientes.length && <SinRespuesta mensajes={mensajes} />}
        </ol>
    );
}
