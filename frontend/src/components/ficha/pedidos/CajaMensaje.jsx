import { useEffect, useMemo, useState } from 'react';
import { Mic, Send, Square, X } from 'lucide-react';
import { Button, FieldError, IconButton, TextArea } from '../../standard';
import { juntar } from '../../../pages/copiloto/dictado';
import useGrabacion from './useGrabacion';

const reloj = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Texto + micrófono: grabar deja el audio y escribe lo que se dijo. `requerido`: no se manda vacío. */
export default function CajaMensaje({ placeholder, enviarLabel, requerido = false, onEnviar, onCancelar }) {
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState(null);
    const g = useGrabacion((frase) => setTexto((t) => juntar(t, frase)));
    const urlAudio = useMemo(() => (g.audio ? URL.createObjectURL(g.audio) : null), [g.audio]);
    useEffect(() => () => { if (urlAudio) URL.revokeObjectURL(urlAudio); }, [urlAudio]);

    const vacio = !texto.trim() && !g.audio;
    const enviar = async () => {
        setEnviando(true);
        setError(null);
        try {
            await onEnviar(texto.trim(), g.audio);
        } catch (e) {
            setError(e?.response?.data?.message || 'No se pudo enviar. Probá de nuevo.');
            setEnviando(false);
        }
    };

    return (
        <div className="pa-caja">
            <div className="pa-campo">
                <TextArea value={g.parcial ? juntar(texto, g.parcial) : texto} rows={2} placeholder={placeholder}
                    disabled={g.grabando} onChange={(e) => setTexto(e.target.value)} />
                <IconButton size="md" pressed={g.grabando} className={g.grabando ? 'pa-mic--on' : undefined}
                    label={g.grabando ? 'Terminar de grabar' : 'Grabar audio'}
                    icon={g.grabando ? <Square size={14} /> : <Mic size={16} />}
                    onClick={g.grabando ? g.detener : g.empezar} />
            </div>
            {g.grabando && (
                <span className="pa-grabando t-cap"><i aria-hidden="true" />{reloj(g.segundos)}{g.transcribe ? ' · transcribiendo' : ''}</span>
            )}
            {urlAudio && !g.grabando && (
                <div className="pa-previa">
                    <audio src={urlAudio} controls />
                    <IconButton size="xs" label="Borrar audio" icon={<X size={12} />} onClick={g.borrar} />
                </div>
            )}
            {(error || g.error) && <FieldError>{error || g.error}</FieldError>}
            <div className="pa-pie">
                {onCancelar && <Button variant="ghost" onClick={onCancelar} disabled={enviando}>Cancelar</Button>}
                <Button variant="primary" icon={<Send size={14} />} onClick={enviar}
                    disabled={enviando || g.grabando || (requerido && vacio)}>
                    {enviarLabel}
                </Button>
            </div>
        </div>
    );
}
