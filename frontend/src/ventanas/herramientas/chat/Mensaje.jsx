// Un mensaje del chat del equipo: la persona (o el bot), desde qué servicio escribió, a qué responde, el texto,
// las reacciones y, si es un aviso de Work, su tarjeta. Al pasar el mouse: Responder y Copiar.
import { Bell, CheckCircle2, Copy, CornerUpLeft, Flame, Heart, Paperclip, Smile, ThumbsUp, Zap } from 'lucide-react';
import { Avatar, IconButton, toast } from '../../../components/standard';
import { SISTEMAS, colorDe, hora } from './formato';

// Las de la Academia (ChatMessage::REACTIONS): íconos, nunca emojis.
const REACCIONES = { fire: Flame, heart: Heart, thumb: ThumbsUp, check: CheckCircle2, bolt: Zap, smile: Smile };

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

export default function Mensaje({ m, seguido, onResponder }) {
    const { autor } = m;
    const sistema = autor.sistema && SISTEMAS[autor.sistema];
    const copiar = () => navigator.clipboard?.writeText(m.texto).then(() => toast('Copiado', 'success'));
    const reacciones = Object.entries(m.reacciones || {});

    return (
        <div className={`ch-msg${seguido ? ' ch-msg--seguido' : ''}${m.mio ? ' ch-msg--mio' : ''}`}>
            <div className="ch-msg__av">
                {!seguido && (autor.bot
                    ? <Avatar size="sm" className="ch-av-bot"><Bell size={14} /></Avatar>
                    : <Avatar size="sm" name={autor.nombre} photo={autor.foto} color={colorDe(autor.nombre)} />)}
            </div>
            <div className="ch-msg__cuerpo">
                {!seguido && (
                    <div className="ch-msg__cab">
                        <b>{autor.nombre}</b>
                        {autor.bot && <span className="ch-tag ch-tag--bot">Bot</span>}
                        {sistema && <span className={`ch-tag ch-tag--${autor.sistema}`}>{sistema.nombre}</span>}
                        <time dateTime={m.fecha}>{hora(m.fecha)}</time>
                    </div>
                )}
                {m.responde_a && (
                    <div className="ch-msg__cita"><CornerUpLeft size={12} aria-hidden="true" /> <b>{m.responde_a.autor}</b> {m.responde_a.texto}</div>
                )}
                {m.tarjeta ? <TarjetaAviso t={m.tarjeta} /> : m.texto && <div className="ch-msg__txt">{m.texto}</div>}
                {m.adjuntos > 0 && (
                    <div className="ch-msg__adj"><Paperclip size={12} aria-hidden="true" /> {m.adjuntos === 1 ? 'Un adjunto' : `${m.adjuntos} adjuntos`}, se ven en la Academia</div>
                )}
                {reacciones.length > 0 && (
                    <div className="ch-msg__reacs">
                        {reacciones.map(([k, n]) => { const Icono = REACCIONES[k] || Heart; return <span key={k}><Icono size={12} aria-hidden="true" /> {n}</span>; })}
                    </div>
                )}
            </div>
            <div className="ch-msg__acciones">
                <IconButton size="xs" label="Responder" icon={<CornerUpLeft size={13} />} onClick={() => onResponder(m)} />
                {m.texto && <IconButton size="xs" label="Copiar" icon={<Copy size={13} />} onClick={copiar} />}
            </div>
        </div>
    );
}
