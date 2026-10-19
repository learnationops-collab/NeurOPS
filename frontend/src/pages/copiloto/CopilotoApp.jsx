// Copiloto de closers: chat con Claude y dictado por voz desde el navegador. Primera versión, para
// probar la voz: todavía no ve deudas, cuotas ni el avance de los alumnos (app/api/copiloto.py).
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Mic, MicOff, RotateCcw, Send, Sparkles } from 'lucide-react';
import '../agendas_v2/thalamus.css';
import './copiloto.css';
import { dataThemeDe, useApariencia } from '../../context/AparienciaContext';
import {
    Button, EmptyState, FieldError, IconButton, PageHeader, Panel, TextArea, Toaster, Tooltip, toast,
} from '../../components/standard';
import { juntar } from './dictado';
import { useDictado } from './useDictado';
import { useCopiloto } from './useCopiloto';

const SUGERENCIAS = [
    'Redactame un seguimiento para un alumno que no responde hace una semana',
    'Ayudame a ordenar mis cobros de hoy',
];

function Mensaje({ role, content }) {
    const copiar = () => navigator.clipboard?.writeText(content).then(() => toast('Copiado', 'success'));
    return (
        <li className={`cp-msg cp-msg--${role === 'user' ? 'closer' : 'copiloto'}`}>
            <p className="cp-texto">{content}</p>
            {role === 'assistant' && (
                <IconButton size="xs" icon={<Copy size={13} />} label="Copiar respuesta" onClick={copiar} />
            )}
        </li>
    );
}

export default function CopilotoApp() {
    const navigate = useNavigate();
    const apariencia = useApariencia();
    const { mensajes, enviando, enviar, reiniciar, lleno } = useCopiloto();
    const [texto, setTexto] = useState('');
    const dictado = useDictado((frase) => setTexto((t) => juntar(t, frase)));
    const finRef = useRef(null);

    useEffect(() => { document.title = 'Copiloto · Learnation'; }, []);
    useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [mensajes, enviando]);

    const mandar = async () => {
        const limpio = texto.trim();
        if (!limpio || enviando || lleno) return;
        dictado.detener();
        setTexto('');
        const error = await enviar(limpio);
        if (error) {
            setTexto(limpio);
            toast(error, 'error');
        }
    };

    const alTeclear = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            mandar();
        }
    };

    const volver = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));
    const mostrado = dictado.escuchando && dictado.parcial ? juntar(texto, dictado.parcial) : texto;

    return (
        <div className="thalamus thalamus-app copiloto" data-theme={dataThemeDe(apariencia, undefined)}>
            <div className="wrap">
                <PageHeader size="sm" title="Copiloto" logo={<Sparkles className="cp-logo" size={22} aria-hidden="true" />}
                    actions={(
                        <>
                            {mensajes.length > 0 && (
                                <Button variant="ghost" icon={<RotateCcw size={14} />} onClick={reiniciar} disabled={enviando}>
                                    Nueva conversación
                                </Button>
                            )}
                            <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={volver}>Volver</Button>
                        </>
                    )} />
                <main className="vista cp-vista">
                    {mensajes.length === 0 ? (
                        <EmptyState icon={<Sparkles size={28} />} title="¿En qué te ayudo?"
                            action={(
                                <div className="cp-sugerencias">
                                    {SUGERENCIAS.map((s) => (
                                        <Button key={s} onClick={() => setTexto(s)}>{s}</Button>
                                    ))}
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

                    <Panel className="cp-redactor">
                        <TextArea value={mostrado} onChange={(e) => setTexto(e.target.value)} onKeyDown={alTeclear}
                            readOnly={dictado.escuchando} maxLength={4000} aria-label="Mensaje para el copiloto"
                            placeholder={dictado.escuchando ? 'Te escucho…' : 'Escribí o dictá tu pedido'} />
                        <div className="cp-botones">
                            <IconButton
                                icon={dictado.escuchando ? <MicOff size={16} /> : <Mic size={16} />}
                                label={dictado.escuchando ? 'Dejar de dictar' : 'Dictar'}
                                pressed={dictado.escuchando}
                                disabled={!dictado.soportado || enviando}
                                data-tip={dictado.soportado ? undefined : 'Dictado no disponible|Usá Chrome o Edge para dictar.'}
                                onClick={dictado.escuchando ? dictado.detener : dictado.empezar} />
                            <Button variant="primary" icon={<Send size={14} />} onClick={mandar}
                                disabled={!texto.trim() || enviando || dictado.escuchando || lleno}>
                                Enviar
                            </Button>
                        </div>
                        {dictado.error && <FieldError>{dictado.error}</FieldError>}
                        {lleno && <FieldError role="note">La conversación llegó al límite. Empezá una nueva.</FieldError>}
                    </Panel>
                </main>
            </div>
            <Toaster />
            <Tooltip />
        </div>
    );
}
