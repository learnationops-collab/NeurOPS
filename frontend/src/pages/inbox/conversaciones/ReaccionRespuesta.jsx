// Al responder a un lead que esperaba (Mario, 26/11/2026): en menos de 5 min, una mini felicitación con papelitos;
// pasados los 30 min, un «guarda». Entre medio, nada. Se va sola o al tocarla.
import { useEffect } from 'react';
import { PartyPopper, TimerOff } from 'lucide-react';
import { RAPIDA, TARDE, reloj } from './reloj';

// Qué decir según cuánto esperó el lead (segundos), o null si no hay nada que decir.
export function reaccionDe(seg) {
    if (seg == null) return null;
    if (seg < RAPIDA) return { tipo: 'rapida', seg };
    if (seg > TARDE) return { tipo: 'lenta', seg };
    return null;
}

const PAPELITOS = Array.from({ length: 12 }, (_, i) => i);

export default function ReaccionRespuesta({ reaccion, onCerrar }) {
    useEffect(() => {
        if (!reaccion) return undefined;
        const t = setTimeout(onCerrar, reaccion.tipo === 'rapida' ? 3800 : 5500);
        return () => clearTimeout(t);
    }, [reaccion, onCerrar]);
    if (!reaccion) return null;
    const rapida = reaccion.tipo === 'rapida';
    return (
        <button type="button" className={`cv-reaccion cv-reaccion--${reaccion.tipo}`} onClick={onCerrar} role="status">
            {rapida && <span className="cv-reaccion-papel" aria-hidden="true">{PAPELITOS.map((i) => <i key={i} style={{ '--i': i }} />)}</span>}
            <span className="cv-reaccion-ico" aria-hidden="true">{rapida ? <PartyPopper size={16} /> : <TimerOff size={16} />}</span>
            <span className="cv-reaccion-t">
                <b>{rapida ? `¡Respondiste en ${reloj(reaccion.seg)}!` : `Tardaste ${reloj(reaccion.seg)} en responder`}</b>
                <small>{rapida ? 'Menos de 5 minutos. Así se hace.' : 'Guarda: pasados los 30 min el lead se enfría.'}</small>
            </span>
        </button>
    );
}
