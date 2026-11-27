import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';

// El recordatorio de un recorrido sin terminar (ADR-W263): un botón redondo chiquito, con un aro que gira lento y un
// punto que respira, en el lugar que la pantalla le reserva (`data-nv-recuerda`: la barra del Inbox, la marca del
// Workspace). Está siempre mientras falte terminarlo; tocarlo retoma desde el paso donde quedó. Al pasar el mouse
// dice cuántos pasos faltan.
export default function Recuerda({ tanda: t, paso, onAbrir }) {
    const [lugar, setLugar] = useState(null);
    // El lugar lo pone otra parte de la pantalla (a veces en un portal que llega después): se busca cada segundo.
    useEffect(() => {
        const buscar = () => {
            const el = document.querySelector('[data-nv-recuerda]');
            setLugar((antes) => (antes === el ? antes : el));
        };
        buscar();
        const id = setInterval(buscar, 1000);
        return () => clearInterval(id);
    }, []);
    if (!lugar) return null;
    const total = t.pasos.length;
    const faltan = Math.max(1, total - paso);
    const hecho = Math.min(paso / total, 1);
    // Mario, 27/11/2026: que diga qué es («novedades sin revisar») y qué se aprende, no solo el nombre de la tanda.
    const detalle = paso
        ? `${t.etiqueta}: te ${faltan === 1 ? 'falta 1 paso' : `faltan ${faltan} pasos`}. Tocá para seguir`
        : `Aprendé lo nuevo de Work en 1 minuto: ${t.etiqueta}`;
    return createPortal(
        <button type="button" className="nv-recuerda" onClick={onAbrir} style={{ '--hecho': hecho }}
            data-tip={`Novedades sin revisar|${detalle}`} aria-label={`Novedades sin revisar. ${detalle}`}>
            <span className="nv-recuerda__aro" aria-hidden="true" />
            <Sparkles aria-hidden="true" />
            <i className="nv-recuerda__punto" aria-hidden="true" />
        </button>,
        lugar,
    );
}
