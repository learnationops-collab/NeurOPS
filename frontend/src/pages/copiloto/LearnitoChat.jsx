// El chat de Learnito: la lista de mensajes y el redactor con dictado por voz. Lo usan el modal (desde
// el dock) y la página /copiloto; la conversación es la de LearnitoContext, así que es la misma en los dos.
// Las respuestas del cerebro de la Academia vienen en markdown y pueden traer gráficos (ubicados en el texto con
// su marcador, [[A]]), botones u opciones para seguir y una acción para confirmar. La conversación se puede
// calificar para revisar después las que salieron mal.
import { useEffect, useRef, useState } from 'react';
import { Bell, Check, Copy, Frown, Meh, MessageSquare, Mic, MicOff, Send, Smile, Sparkles, X } from 'lucide-react';
import { Button, EmptyState, FieldError, IconButton, TextArea } from '../../components/standard';
import { useLearnito } from '../../sesion/LearnitoContext';
import { juntar } from './dictado';
import Grafico from './Grafico';
import Markdown from './Markdown';
import { useDictado } from './useDictado';
import UsoMensual from './UsoMensual';
import './copiloto.css';

const SUGERENCIAS = [
    'Mis agendas de hoy',
    '¿Quién me debe más?',
    'Show up por closer en los últimos 30 días',
];

const CALIFICACIONES = [
    { valor: 'insatisfactoria', texto: 'Insatisfactoria', icono: <Frown size={13} /> },
    { valor: 'regular', texto: 'Regular', icono: <Meh size={13} /> },
    { valor: 'satisfactoria', texto: 'Satisfactoria', icono: <Smile size={13} /> },
];

// Los botones y las opciones que el cerebro ofrece para seguir (solo en la última respuesta).
function Siguientes({ mensaje, indice, tocar, deshabilitado }) {
    const botones = (mensaje?.botones || []).map((b, i) => ({ ...b, tipo: 'boton', i }));
    // Las opciones llegan como texto ("No show (Agendas)"); los botones, como {texto, icono}.
    const opciones = (mensaje?.opciones || []).map((o, i) => ({ texto: typeof o === 'string' ? o : o?.texto, tipo: 'opcion', i }));
    const todos = [...opciones, ...botones].filter((b) => b.texto);
    if (!todos.length) return null;
    return (
        <div className="cp-siguientes">
            {todos.map((b) => (
                <Button key={`${b.tipo}${b.i}`} disabled={deshabilitado}
                    onClick={() => tocar(indice, b.tipo, b.i, b.texto)}>{b.texto}</Button>
            ))}
        </div>
    );
}

// El texto con sus gráficos: cada [[A]] se reemplaza por su gráfico; los que el texto no ubicó van al final.
function Respuesta({ texto, adjuntos }) {
    const graficos = adjuntos && typeof adjuntos === 'object' ? adjuntos : {};
    const partes = (texto || '').split(/\[\[([A-Z])\]\]/);
    const usados = new Set();
    const bloques = partes.map((p, i) => {
        if (i % 2 === 0) return p.trim() ? <Markdown key={i} texto={p} /> : null;
        if (!graficos[p] || usados.has(p)) return null;
        usados.add(p);
        return <Grafico key={i} adjunto={graficos[p]} />;
    });
    const resto = Object.keys(graficos).filter((id) => !usados.has(id) && graficos[id]?.tipo === 'grafico');
    return (
        <>
            {bloques}
            {resto.map((id) => <Grafico key={id} adjunto={graficos[id]} />)}
        </>
    );
}

// La acción que propuso la respuesta: se puede editar el texto y se hace recién al confirmar.
function Accion({ accion, confirmar }) {
    const [texto, setTexto] = useState(accion.texto || '');
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);
    const hacer = async (opciones) => {
        setOcupado(true);
        setError(null);
        const fallo = await confirmar(opciones);
        setOcupado(false);
        if (fallo) setError(fallo);
    };
    const Icono = accion.tipo === 'aviso' ? Bell : MessageSquare;
    return (
        <div className={`cp-accion cp-accion--${accion.estado}`}>
            <p className="cp-accion__titulo"><Icono size={14} aria-hidden="true" /> {accion.titulo}</p>
            {(accion.detalle || []).map((d) => <p key={d} className="cp-accion__detalle">{d}</p>)}
            {accion.estado === 'propuesta' ? (
                <>
                    <TextArea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000}
                        aria-label="Texto de la acción" rows={3} />
                    <div className="cp-botones">
                        <Button variant="ghost" icon={<X size={14} />} disabled={ocupado}
                            onClick={() => hacer({ descartar: true })}>Descartar</Button>
                        <Button variant="primary" icon={<Check size={14} />} disabled={ocupado || !texto.trim()}
                            onClick={() => hacer({ texto: texto.trim() })}>Confirmar</Button>
                    </div>
                    {error && <FieldError>{error}</FieldError>}
                </>
            ) : (
                <>
                    <p className="cp-accion__texto">{accion.texto}</p>
                    <p className="cp-accion__estado">
                        {accion.estado === 'hecha' ? (accion.resultado || 'Hecho.') : 'Descartada.'}
                    </p>
                </>
            )}
        </div>
    );
}

function Mensaje({ role, content, mensaje, confirmar }) {
    const [copiado, setCopiado] = useState(false);
    const copiar = () => navigator.clipboard?.writeText(content.replace(/\[\[[A-Z]\]\]/g, '').trim()).then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
    });
    return (
        <li className={`cp-msg cp-msg--${role === 'user' ? 'closer' : 'copiloto'}`}>
            {mensaje ? (
                <div className="cp-texto">
                    <Respuesta texto={content} adjuntos={mensaje.adjuntos} />
                    {mensaje.accion && <Accion accion={mensaje.accion} confirmar={confirmar} />}
                </div>
            ) : <p className="cp-texto">{content}</p>}
            {role === 'assistant' && (
                <IconButton size="xs" icon={copiado ? <Check size={13} /> : <Copy size={13} />}
                    label={copiado ? 'Copiado' : 'Copiar respuesta'} onClick={copiar} />
            )}
        </li>
    );
}

export default function LearnitoChat() {
    const {
        mensajes, enviando, enviar, tocar, confirmar, agotado, uso, calificacion, calificar,
        borrador: texto, setBorrador: setTexto,
    } = useLearnito();
    const ultima = mensajes.length - 1;
    const respondio = mensajes.some((m) => m.role === 'assistant');
    const [error, setError] = useState(null);
    const tocarBoton = async (...args) => {
        setError(null);
        const fallo = await tocar(...args);
        if (fallo) setError(fallo);
    };
    const dictado = useDictado((frase) => setTexto((t) => juntar(t, frase)));
    const finRef = useRef(null);

    useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [mensajes, enviando]);

    const mandar = async () => {
        const limpio = texto.trim();
        if (!limpio || enviando || agotado) return;
        dictado.detener();
        setTexto('');
        setError(null);
        const fallo = await enviar(limpio);
        if (fallo) {
            setTexto(limpio);
            setError(fallo);
        }
    };

    const alTeclear = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            mandar();
        }
    };

    const mostrado = dictado.escuchando && dictado.parcial ? juntar(texto, dictado.parcial) : texto;

    return (
        <div className="learnito">
            {mensajes.length === 0 ? (
                <EmptyState icon={<Sparkles size={28} />} title="¿En qué te ayudo?"
                    action={(
                        <div className="cp-sugerencias">
                            {SUGERENCIAS.map((s) => <Button key={s} onClick={() => setTexto(s)}>{s}</Button>)}
                        </div>
                    )}>
                    Escribí o tocá el micrófono y hablá. Veo tus agendas, tus clientes y quién te debe, y los números
                    del equipo. También puedo dejar un comentario en un cliente o avisarle algo a alguien, cuando lo
                    confirmes.
                </EmptyState>
            ) : (
                <ul className="cp-lista" aria-live="polite">
                    {mensajes.map((m, i) => <Mensaje key={i} {...m} confirmar={(opciones) => confirmar(i, opciones)} />)}
                    {!enviando && mensajes[ultima]?.mensaje && (
                        <li className="cp-siguientes-fila">
                            <Siguientes mensaje={mensajes[ultima].mensaje} indice={mensajes[ultima].indice} tocar={tocarBoton}
                                deshabilitado={enviando} />
                        </li>
                    )}
                    {enviando && <li className="cp-msg cp-msg--copiloto cp-pensando">Pensando…</li>}
                    <li ref={finRef} aria-hidden="true" />
                </ul>
            )}

            <div className="cp-redactor">
                <TextArea value={mostrado} onChange={(e) => setTexto(e.target.value)} onKeyDown={alTeclear}
                    readOnly={dictado.escuchando} maxLength={4000} aria-label="Mensaje para Learnito"
                    placeholder={dictado.escuchando ? 'Te escucho…' : 'Escribí o dictá tu pedido'} />
                <div className="cp-botones">
                    <IconButton
                        icon={dictado.escuchando ? <MicOff size={16} /> : <Mic size={16} />}
                        label={dictado.soportado ? (dictado.escuchando ? 'Dejar de dictar' : 'Dictar') : 'Dictado no disponible: usá Chrome o Edge'}
                        title={dictado.soportado ? undefined : 'Usá Chrome o Edge para dictar.'}
                        pressed={dictado.escuchando}
                        disabled={!dictado.soportado || enviando}
                        onClick={dictado.escuchando ? dictado.detener : dictado.empezar} />
                    <Button variant="primary" icon={<Send size={14} />} onClick={mandar}
                        disabled={!texto.trim() || enviando || dictado.escuchando || agotado}>
                        Enviar
                    </Button>
                </div>
                {(dictado.error || error) && <FieldError>{dictado.error || error}</FieldError>}
                {respondio && (
                    <div className="cp-calificar" role="group" aria-label="Calificar la conversación">
                        <span>¿Cómo viene la conversación?</span>
                        {CALIFICACIONES.map((c) => (
                            <Button key={c.valor} icon={c.icono} aria-pressed={calificacion === c.valor}
                                variant={calificacion === c.valor ? 'primary' : 'ghost'}
                                onClick={() => calificar(c.valor)}>{c.texto}</Button>
                        ))}
                    </div>
                )}
                <UsoMensual uso={uso} />
            </div>
        </div>
    );
}
