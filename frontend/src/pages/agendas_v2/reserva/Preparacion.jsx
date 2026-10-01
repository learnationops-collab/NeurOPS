import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Play } from 'lucide-react';
import PantallaPregunta from './PantallaPregunta';
import { formatFechaLarga, formatHora } from '../shared/time';

// Segunda etapa, después de agendar: un video y una pregunta por pantalla. Lo que el lead responde
// acá le llega al closer antes de la llamada; "Confirmo que voy a estar" alimenta el pipeline de
// confirmación que hoy se trabaja a mano.
export default function Preparacion({ pasos, reserva, tz, respuestas, onRespuesta, onIndice }) {
    const [i, setI] = useState(0);
    const [visto, setVisto] = useState({});
    const [progreso, setProgreso] = useState(0);
    const [reproduciendo, setReproduciendo] = useState(false);
    const [confirmado, setConfirmado] = useState(false);
    const paso = pasos[i];

    useEffect(() => { onIndice?.(i); }, [i, onIndice]);

    // Simulación de reproducción: el video real todavía no existe.
    useEffect(() => {
        if (!reproduciendo) return undefined;
        const t = setInterval(() => setProgreso(p => {
            if (p >= 100) { clearInterval(t); setReproduciendo(false); setVisto(v => ({ ...v, [paso.id]: true })); return 100; }
            return p + 5;
        }), 120);
        return () => clearInterval(t);
    }, [reproduciendo, paso?.id]);

    const siguiente = () => { setI(n => n + 1); setProgreso(0); setReproduciendo(false); };

    if (!paso) {
        return (
            <div className="ag2-screen">
                <h1 className="ag2-display">Todo <span className="ag2-hl">listo</span>.</h1>
                <p className="ag2-lede">Nos vemos el {formatFechaLarga(reserva.utc, tz).toLowerCase()} a las {formatHora(reserva.utc, tz)}. Si te surge algo, avisanos por WhatsApp y lo movemos.</p>
                <div className="ag2-actions">
                    <button type="button" className={`ag2-btn ${confirmado ? 'ghost' : ''}`} disabled={confirmado} onClick={() => setConfirmado(true)}>
                        {confirmado ? <>Asistencia confirmada <Check size={16} /></> : 'Confirmo que voy a estar'}
                    </button>
                </div>
            </div>
        );
    }

    const titulo = paso.pregunta.texto;
    return (
        <div className="ag2-screen">
            <h2 className="ag2-q">{paso.titulo}</h2>
            <span className="ag2-sample">Video de ejemplo</span>
            <div className="ag2-video">
                {!reproduciendo && (
                    <button type="button" className="ag2-play" aria-label={visto[paso.id] ? 'Ver de nuevo' : 'Reproducir'}
                        onClick={() => { setProgreso(0); setReproduciendo(true); }}>
                        {visto[paso.id] ? <Check size={30} /> : <Play size={30} fill="currentColor" style={{ marginLeft: 4 }} />}
                    </button>
                )}
                <div className="ag2-video-cap"><span>Mario · Learnation</span><span>{paso.duracion}</span></div>
                <div className="ag2-video-bar" style={{ width: `${progreso}%` }} />
            </div>

            {visto[paso.id] ? (
                <div style={{ marginTop: 34 }}>
                    <PantallaPregunta
                        paso={{ id: `prep-${paso.id}`, tipo: paso.pregunta.opciones ? 'opciones' : 'texto', ...paso.pregunta }}
                        titulo={titulo}
                        valor={respuestas[paso.id]}
                        onCambio={(v) => onRespuesta(paso.id, v)}
                        onSiguiente={siguiente}
                    />
                </div>
            ) : (
                <div className="ag2-actions">
                    <span className="ag2-hint">Mirá el video para seguir.</span>
                    <button type="button" className="ag2-link" onClick={() => setVisto(v => ({ ...v, [paso.id]: true }))}>
                        Ya lo vi <ArrowRight size={12} style={{ display: 'inline', verticalAlign: '-1px' }} />
                    </button>
                </div>
            )}
        </div>
    );
}
