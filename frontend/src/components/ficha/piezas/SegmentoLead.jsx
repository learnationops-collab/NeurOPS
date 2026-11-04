import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { COLOR_SEGMENTO } from '../../../pages/admin/marketing/todos/segmentos';

/**
 * El segmento A/B/C/D del lead en la cabecera de la ficha, siempre visible (también «Sin segmento»), y un menú
 * para cambiarlo a mano (Kerwin, 04/11/2026). El cambio es de toda la persona: `PATCH /ficha/<agenda>/segmento`
 * (`ficha_segmento_service`). Sin `puedeCambiar` es solo una etiqueta.
 */
const OPCIONES = [
    { key: 'A', label: 'A' }, { key: 'B', label: 'B' }, { key: 'C', label: 'C' }, { key: 'D', label: 'D' },
    { key: null, label: 'Sin segmento' },
];

const SegmentoLead = ({ segmento, puntos, manual, puedeCambiar, onCambiar }) => {
    const [abierto, setAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
        const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', tecla);
        return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
    }, [abierto]);

    const color = COLOR_SEGMENTO[segmento || 'sin'];
    const detalle = segmento && puntos != null
        ? ` · ${Number(puntos) > 0 ? '+' : ''}${Number(puntos).toLocaleString('es-AR', { maximumFractionDigits: 1 })} pts`
        : '';
    const contenido = (
        <>
            <i className="fi-segl-punto" style={{ background: color }} aria-hidden="true" />
            <span className="fi-val trunc">{segmento ? `${segmento}${detalle}` : 'Sin segmento'}</span>
            {manual && <small className="t-cap mut" title="Lo cambió una persona del equipo">manual</small>}
        </>
    );
    if (!puedeCambiar) return <span className="fi-segl">{contenido}</span>;

    const elegir = async (key) => {
        setAbierto(false);
        if ((key || null) === (segmento || null)) return;
        setGuardando(true);
        try { await onCambiar?.(key); } catch { /* el cascarón muestra el aviso */ } finally { setGuardando(false); }
    };

    return (
        <span className="fi-segl-caja" ref={ref}>
            <button type="button" className="fi-segl fi-segl--editable" aria-haspopup="listbox" aria-expanded={abierto}
                disabled={guardando} title="Cambiar el segmento del lead" onClick={() => setAbierto((a) => !a)}>
                {contenido}
                <ChevronDown size={13} aria-hidden="true" />
            </button>
            {abierto && (
                <div className="fi-pop fi-segl-menu" role="listbox" aria-label="Segmento del lead">
                    {OPCIONES.map((o) => {
                        const on = (o.key || null) === (segmento || null);
                        return (
                            <button key={o.label} type="button" className="fi-opcion" role="option" aria-selected={on}
                                onClick={() => elegir(o.key)}>
                                <span className="fi-segl"><i className="fi-segl-punto" style={{ background: COLOR_SEGMENTO[o.key || 'sin'] }} aria-hidden="true" />{o.label}</span>
                                {on && <Check size={13} aria-hidden="true" />}
                            </button>
                        );
                    })}
                    <small className="t-cap mut" style={{ padding: 'var(--s2) var(--s3)' }}>
                        Cambia el de toda la persona y queda en la bitácora.
                    </small>
                </div>
            )}
        </span>
    );
};

export default SegmentoLead;
