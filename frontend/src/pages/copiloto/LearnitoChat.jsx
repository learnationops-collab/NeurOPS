// El chat de Learnito: la lista de mensajes y el redactor con dictado por voz. Lo usan el modal (desde
// el dock) y la página /copiloto; la conversación es la de LearnitoContext, así que es la misma en los dos.
// Con el cerebro de la Academia (la dirección), las respuestas vienen en markdown y pueden traer botones u
// opciones para seguir; la conversación se puede calificar para revisar después las que salieron mal.
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Frown, Meh, Mic, MicOff, Send, Smile, Sparkles } from 'lucide-react';
import { Button, EmptyState, FieldError, IconButton, TextArea } from '../../components/standard';
import { useLearnito } from '../../sesion/LearnitoContext';
import { juntar } from './dictado';
import Markdown from './Markdown';
import { useDictado } from './useDictado';
import UsoMensual from './UsoMensual';
import './copiloto.css';

const SUGERENCIAS = {
    local: [
        'Decime mis agendas de hoy',
        '¿Quién me debe más?',
        'Redactame un seguimiento para un alumno que no responde hace una semana',
    ],
    cerebro: [
        'Ventas por mes de este año',
        '¿Qué cuotas vencen esta semana?',
        'Show up por closer en los últimos 30 días',
    ],
};

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

function Mensaje({ role, content, mensaje }) {
    const [copiado, setCopiado] = useState(false);
    const copiar = () => navigator.clipboard?.writeText(content).then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
    });
    return (
        <li className={`cp-msg cp-msg--${role === 'user' ? 'closer' : 'copiloto'}`}>
            {mensaje ? <div className="cp-texto">{content ? <Markdown texto={content} /> : null}</div>
                : <p className="cp-texto">{content}</p>}
            {role === 'assistant' && (
                <IconButton size="xs" icon={copiado ? <Check size={13} /> : <Copy size={13} />}
                    label={copiado ? 'Copiado' : 'Copiar respuesta'} onClick={copiar} />
            )}
        </li>
    );
}

export default function LearnitoChat() {
    const {
        mensajes, enviando, enviar, tocar, lleno, agotado, uso, cargarUso, modo, calificacion, calificar,
        borrador: texto, setBorrador: setTexto,
    } = useLearnito();
    const cerebro = modo === 'cerebro';
    const ultima = mensajes.length - 1;
    const respondio = cerebro && mensajes.some((m) => m.role === 'assistant');
    const [error, setError] = useState(null);
    const tocarBoton = async (...args) => {
        setError(null);
        const fallo = await tocar(...args);
        if (fallo) setError(fallo);
    };
    const dictado = useDictado((frase) => setTexto((t) => juntar(t, frase)));
    const finRef = useRef(null);

    useEffect(() => { cargarUso(); }, [cargarUso]);
    useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [mensajes, enviando]);

    const mandar = async () => {
        const limpio = texto.trim();
        if (!limpio || enviando || lleno || agotado) return;
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
                            {SUGERENCIAS[cerebro ? 'cerebro' : 'local'].map((s) => (
                                <Button key={s} onClick={() => setTexto(s)}>{s}</Button>
                            ))}
                        </div>
                    )}>
                    {cerebro
                        ? 'Escribí o tocá el micrófono y hablá. Veo los datos de Work y de la Academia: ventas, '
                          + 'pagos, agendas, clientes y alumnos.'
                        : 'Escribí o tocá el micrófono y hablá. Veo tus agendas y quién te debe; el avance de los '
                          + 'alumnos todavía no.'}
                </EmptyState>
            ) : (
                <ul className="cp-lista" aria-live="polite">
                    {mensajes.map((m, i) => <Mensaje key={i} {...m} />)}
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
                        disabled={!texto.trim() || enviando || dictado.escuchando || lleno || agotado}>
                        Enviar
                    </Button>
                </div>
                {(dictado.error || error) && <FieldError>{dictado.error || error}</FieldError>}
                {lleno && <FieldError role="note">La conversación llegó al límite. Empezá una nueva.</FieldError>}
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
