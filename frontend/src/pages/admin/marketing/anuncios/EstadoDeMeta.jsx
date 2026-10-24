import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Cuándo se trajo por última vez el estado de las campañas desde Meta (activa, pausada…) y el botón para
 * traerlo ahora (Kerwin, 23/10/2026: «que se actualice qué campañas están activas»). Si la última
 * sincronización falló, lo dice: un estado viejo sin aviso es peor que uno marcado como viejo.
 */

/** «hace 5 min», «hace 2 h», «hace 3 días». `iso`: UTC sin zona, como lo manda el backend. */
export const haceCuanto = (iso, ahora = Date.now()) => {
    if (!iso) return null;
    const ms = ahora - new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).getTime();
    if (!Number.isFinite(ms)) return null;
    const min = Math.max(0, Math.round(ms / 60000));
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 48) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} días`;
};

const EstadoDeMeta = ({ meta, estadoMeta }) => {
    const [, repintar] = useState(0);
    useEffect(() => {
        const id = setInterval(() => repintar((n) => n + 1), 60000);
        return () => clearInterval(id);
    }, []);
    if (!estadoMeta?.activo) return null;

    const cuando = haceCuanto(meta?.ultima_sincronizacion);
    const texto = estadoMeta.fallo ? 'No se pudo actualizar desde Meta'
        : cuando ? `Estado de Meta: ${cuando}` : 'Estado de Meta: sin actualizar';
    return (
        <span className={`mk-estado-meta t-cap${estadoMeta.fallo ? ' mk-estado-meta--falla' : ' mut40'}`} role="status"
            title={estadoMeta.fallo || 'Qué campañas están activas o pausadas, traído de Meta. Se refresca solo cada pocos minutos.'}>
            <span className="trunc">{texto}</span>
            <button type="button" className="ibtn ibtn--sm" disabled={estadoMeta.actualizando}
                title="Traer ahora el estado de las campañas desde Meta" aria-label="Actualizar el estado desde Meta"
                onClick={() => estadoMeta.actualizar({ forzar: true })}>
                <RefreshCw className={estadoMeta.actualizando ? 'mk-gira' : ''} aria-hidden="true" />
            </button>
        </span>
    );
};

export default EstadoDeMeta;
