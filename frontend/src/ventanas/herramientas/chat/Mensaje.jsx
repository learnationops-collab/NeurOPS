// Un mensaje del chat del equipo (mockup docs/mockups/chat-cruzado): la persona, el bot o Learnito, desde qué
// servicio escribió, a qué responde, el texto con las etiquetas resaltadas, las reacciones (tocar una la pone o la
// saca) y, si es un aviso de Work, su tarjeta. Al pasar el mouse: tres reacciones (y las otras tres con «más»),
// Responder, la chispa (preguntarle a Learnito sobre este mensaje, al costado) y Copiar.
import { useState } from 'react';
import { Bell, CheckCircle2, Copy, CornerUpLeft, Flame, Heart, MoreHorizontal, Paperclip, Smile, Sparkles, ThumbsUp, Zap } from 'lucide-react';
import { Avatar, IconButton, toast } from '../../../components/standard';
import Markdown from '../../../pages/copiloto/Markdown';
import { SISTEMAS, colorDe, hora } from './formato';

// Las de la Academia (ChatMessage::REACTIONS): íconos, nunca emojis. Las tres primeras van a mano.
export const REACCIONES = [
    ['fire', Flame, 'Fuego'], ['heart', Heart, 'Me encanta'], ['thumb', ThumbsUp, 'De acuerdo'],
    ['check', CheckCircle2, 'Listo'], ['bolt', Zap, 'Fuerza'], ['smile', Smile, 'Me hace gracia'],
];
const ICONO = Object.fromEntries(REACCIONES.map(([k, I]) => [k, I]));

function TarjetaAviso({ t }) {
    return (
        <div className={`ch-aviso ch-aviso--${t.tono || 'ambar'}`}>
            <b className="ch-aviso__tit">{t.titulo}</b>
            {t.nombre && <div className="ch-aviso__nom">{t.nombre}</div>}
            {(t.telefono || t.estado) && <div className="ch-aviso__sub">{[t.telefono, t.estado].filter(Boolean).join(' · ')}</div>}
            {t.chips?.length > 0 && <div className="ch-aviso__chips">{t.chips.map((c, i) => <span key={i}>{c.texto}</span>)}</div>}
            {t.cajas?.length > 0 && (
                <div className="ch-aviso__cajas">
                    {t.cajas.map((c, i) => <div key={i}><small>{c.titulo}</small><b>{c.valor}</b>{c.sub && <small>{c.sub}</small>}</div>)}
                </div>
            )}
        </div>
    );
}

/** El texto con cada «@Nombre» conocido resaltado (Learnito con su color). */
function ConMenciones({ texto, menciones }) {
    if (!menciones) return texto;
    return texto.split(menciones).map((parte, i) => (i % 2
        ? <span key={i} className={`ch-mencion${parte === '@Learnito' ? ' ch-mencion--l' : ''}`}>{parte}</span>
        : parte));
}

function Autor({ m, seguido }) {
    const { autor } = m;
    if (seguido) return null;
    const sistema = autor.sistema && SISTEMAS[autor.sistema];
    return (
        <div className="ch-msg__cab">
            <b>{autor.nombre}</b>
            {autor.bot && <span className="ch-tag ch-tag--bot">Bot</span>}
            {autor.learnito && <><span className="ch-tag ch-tag--ia">IA</span><span className="ch-msg__pidio">pidió {autor.pidio}</span></>}
            {!autor.learnito && sistema && <span className={`ch-tag ch-tag--${autor.sistema}`}>{sistema.nombre}</span>}
            <time dateTime={m.fecha}>{hora(m.fecha)}</time>
        </div>
    );
}

function Cara({ autor }) {
    if (autor.learnito) return <span className="ch-av-l"><Sparkles size={14} aria-hidden="true" /></span>;
    if (autor.bot) return <Avatar size="sm" className="ch-av-bot"><Bell size={14} /></Avatar>;
    return <Avatar size="sm" name={autor.nombre} photo={autor.foto} color={colorDe(autor.nombre)} />;
}

export default function Mensaje({ m, seguido, menciones, onResponder, onReaccionar, onPreguntar }) {
    const [mas, setMas] = useState(false);
    const mias = new Set(m.mis_reacciones || []);
    const reacciones = Object.entries(m.reacciones || {});
    const copiar = () => navigator.clipboard?.writeText(m.texto).then(() => toast('Copiado', 'success'));
    const reaccionar = (k) => onReaccionar(m.id, k).catch(() => toast('No se pudo reaccionar. Probá de nuevo.', 'error'));

    return (
        <div className={`ch-msg${seguido ? ' ch-msg--seguido' : ''}${m.autor.learnito ? ' ch-msg--l' : ''}`} onMouseLeave={() => setMas(false)}>
            <div className="ch-msg__av">{!seguido && <Cara autor={m.autor} />}</div>
            <div className="ch-msg__cuerpo">
                <Autor m={m} seguido={seguido} />
                {m.responde_a && (
                    <div className="ch-msg__cita"><CornerUpLeft size={12} aria-hidden="true" /> <b>{m.responde_a.autor}</b> {m.responde_a.texto}</div>
                )}
                {m.tarjeta && <TarjetaAviso t={m.tarjeta} />}
                {!m.tarjeta && m.texto && (m.autor.learnito
                    ? <div className="ch-msg__l"><Markdown texto={m.texto} /></div>
                    : <div className="ch-msg__txt"><ConMenciones texto={m.texto} menciones={menciones} /></div>)}
                {m.adjuntos > 0 && (
                    <div className="ch-msg__adj"><Paperclip size={12} aria-hidden="true" /> {m.adjuntos === 1 ? 'Un adjunto' : `${m.adjuntos} adjuntos`}, se ven en la Academia</div>
                )}
                {reacciones.length > 0 && (
                    <div className="ch-msg__reacs">
                        {reacciones.map(([k, n]) => {
                            const Icono = ICONO[k] || Heart;
                            return (
                                <button key={k} type="button" aria-pressed={mias.has(k)} onClick={() => reaccionar(k)}
                                    title={mias.has(k) ? 'Sacar tu reacción' : 'Reaccionar'}>
                                    <Icono size={12} aria-hidden="true" /> {n}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className="ch-msg__acciones">
                {REACCIONES.slice(0, mas ? 6 : 3).map(([k, Icono, label]) => (
                    <IconButton key={k} size="xs" label={label} icon={<Icono size={13} />} pressed={mias.has(k)} onClick={() => reaccionar(k)} />
                ))}
                {!mas && <IconButton size="xs" label="Más reacciones" icon={<MoreHorizontal size={13} />} onClick={() => setMas(true)} />}
                <span className="ch-msg__sep" aria-hidden="true" />
                <IconButton size="xs" label="Responder" icon={<CornerUpLeft size={13} />} onClick={() => onResponder(m)} />
                {onPreguntar && (
                    <IconButton size="xs" label="Preguntarle a Learnito sobre esto" className="ch-accion-l"
                        icon={<Sparkles size={13} />} onClick={() => onPreguntar(m)} />
                )}
                {m.texto && <IconButton size="xs" label="Copiar" icon={<Copy size={13} />} onClick={copiar} />}
            </div>
        </div>
    );
}
