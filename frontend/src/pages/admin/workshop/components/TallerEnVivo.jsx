import { useEffect, useState } from 'react';
import { CalendarClock, Timer } from 'lucide-react';
import { estadoDelTaller, formatearCuenta, formatearInicio, nombreZona } from '../agendaTaller';

/**
 * El rótulo de arriba de Workshop Intelligence (Kerwin, 16/10/2026): cuenta regresiva hasta el próximo
 * taller programado y, al llegar a cero, «En vivo» durante 2 horas mientras termina el evento. Sale de
 * `inicio_at` de cada taller (se programan en «Próximos»); la hora se ve en la zona del navegador.
 */
const TallerEnVivo = ({ eventos, onIrAProximos }) => {
    const [ahora, setAhora] = useState(() => new Date());

    useEffect(() => {
        const reloj = setInterval(() => setAhora(new Date()), 1000);
        return () => clearInterval(reloj);
    }, []);

    const estado = estadoDelTaller(eventos, ahora);

    if (!estado) {
        return (
            <button type="button" className="live-badge live-badge--sin" onClick={onIrAProximos}
                title="Programá el próximo taller en «Próximos» para ver la cuenta regresiva.">
                <CalendarClock size={12} aria-hidden="true" /> Sin taller programado
            </button>
        );
    }

    const cuando = `${formatearInicio(estado.evento.inicio_at)} (hora de ${nombreZona()})`;
    if (estado.fase === 'en_vivo') {
        return (
            <span className="live-badge" role="status"
                title={`${estado.evento.name} empezó ${cuando}. Termina en ${formatearCuenta(estado.terminaEn)}.`}>
                <span className="live-dot" /> En vivo
            </span>
        );
    }
    return (
        <span className="live-badge live-badge--cuenta" role="timer" aria-live="off"
            title={`${estado.evento.name}: ${cuando}`}>
            <Timer size={12} aria-hidden="true" />
            <span>Próximo taller en</span>
            <span className="live-badge-cuenta">{formatearCuenta(estado.faltan)}</span>
        </span>
    );
};

export default TallerEnVivo;
