// Cuánto hace que el lead espera respuesta, corriendo en vivo (Mario, 26/11/2026: que se mueva y dé urgencia).
// Un anillo que se llena hacia el próximo corte (5 min en verde, 30 min en ámbar; pasado eso, rojo entero y latiendo),
// una aguja que da la vuelta cada minuto y los minutos:segundos. En la fila de la bandeja y en la tarjeta del lead.
import { RAPIDA, TARDE, reloj, useSegundo } from './reloj';

const R = 6.5;
const VUELTA = 2 * Math.PI * R;

function nivelDe(seg) {
    if (seg < RAPIDA) return { clase: 'ok', parte: seg / RAPIDA, texto: 'Todavía estás a tiempo de responder en menos de 5 min' };
    if (seg < TARDE) return { clase: 'atento', parte: (seg - RAPIDA) / (TARDE - RAPIDA), texto: 'Respondé antes de los 30 min' };
    return { clase: 'tarde', parte: 1, texto: 'Pasaron más de 30 min: el lead se enfría' };
}

export default function Cronometro({ desde, grande }) {
    const ahora = useSegundo();
    if (!desde) return null;
    const seg = Math.max(0, (ahora - new Date(desde)) / 1000);
    const nivel = nivelDe(seg);
    const hora = new Date(desde).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    return (
        <span className={`cv-crono cv-crono--${nivel.clase}${grande ? ' cv-crono--grande' : ''}`} role="timer"
            aria-label={`Sin respuesta hace ${reloj(seg)}`} data-tip={`Sin respuesta · ${reloj(seg)}|Escribió a las ${hora}. ${nivel.texto}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r={R} className="cv-crono-fondo" />
                <circle cx="8" cy="8" r={R} className="cv-crono-arco" transform="rotate(-90 8 8)"
                    style={{ strokeDasharray: VUELTA, strokeDashoffset: VUELTA * (1 - Math.min(1, nivel.parte)) }} />
                {seg < 86400 && <line x1="8" y1="8" x2="8" y2="3.6" className="cv-crono-aguja" style={{ animationDelay: `-${seg % 60}s` }} />}
            </svg>
            <span className="cv-crono-t">{reloj(seg)}</span>
        </span>
    );
}
