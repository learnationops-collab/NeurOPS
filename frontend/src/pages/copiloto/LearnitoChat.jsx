// El chat de Learnito: la lista de mensajes y el redactor con dictado por voz. Lo usan el modal (desde
// el dock) y la página /copiloto; la conversación es la de LearnitoContext, así que es la misma en los dos.
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Mic, MicOff, Send, Sparkles } from 'lucide-react';
import { Button, EmptyState, FieldError, IconButton, TextArea } from '../../components/standard';
import { useLearnito } from '../../sesion/LearnitoContext';
import { juntar } from './dictado';
import { useDictado } from './useDictado';
import './copiloto.css';

const SUGERENCIAS = [
    'Redactame un seguimiento para un alumno que no responde hace una semana',
    'Ayudame a ordenar mis cobros de hoy',
];

function Mensaje({ role, content }) {
    const [copiado, setCopiado] = useState(false);
    const copiar = () => navigator.clipboard?.writeText(content).then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
    });
    return (
        <li className={`cp-msg cp-msg--${role === 'user' ? 'closer' : 'copiloto'}`}>
            <p className="cp-texto">{content}</p>
            {role === 'assistant' && (
                <IconButton size="xs" icon={copiado ? <Check size={13} /> : <Copy size={13} />}
                    label={copiado ? 'Copiado' : 'Copiar respuesta'} onClick={copiar} />
            )}
        </li>
    );
}

export default function LearnitoChat() {
    const { mensajes, enviando, enviar, lleno, borrador: texto, setBorrador: setTexto } = useLearnito();
    const [error, setError] = useState(null);
    const dictado = useDictado((frase) => setTexto((t) => juntar(t, frase)));
    const finRef = useRef(null);

    useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [mensajes, enviando]);

    const mandar = async () => {
        const limpio = texto.trim();
        if (!limpio || enviando || lleno) return;
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
                    Escribí o tocá el micrófono y hablá. Todavía no veo deudas ni el avance de los alumnos:
                    si los necesitás, contámelos.
                </EmptyState>
            ) : (
                <ul className="cp-lista" aria-live="polite">
                    {mensajes.map((m, i) => <Mensaje key={i} {...m} />)}
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
                        disabled={!texto.trim() || enviando || dictado.escuchando || lleno}>
                        Enviar
                    </Button>
                </div>
                {(dictado.error || error) && <FieldError>{dictado.error || error}</FieldError>}
                {lleno && <FieldError role="note">La conversación llegó al límite. Empezá una nueva.</FieldError>}
            </div>
        </div>
    );
}
