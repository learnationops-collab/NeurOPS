import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { COLOR_SEGMENTO } from '../../../pages/admin/marketing/todos/segmentos';

/**
 * El segmento A/B/C/D del lead junto al nombre de la ficha, como un círculo del color del segmento con su letra
 * (Kerwin, 04/11/2026: «un circulito de color, como un icono»). Sin segmento, un círculo punteado. Los puntos y si
 * lo cambió una persona van en el tooltip. Con `puedeCambiar`, tocarlo abre un menú para cambiarlo de toda la
 * persona: `PATCH /ficha/<agenda>/segmento` (`ficha_segmento_service`).
 */
const OPCIONES = [
    { key: 'A', label: 'A' }, { key: 'B', label: 'B' }, { key: 'C', label: 'C' }, { key: 'D', label: 'D' },
    { key: null, label: 'Sin segmento' },
];

const Circulo = ({ segmento, chico = false }) => (
    <span className={`fi-segl-c${chico ? ' fi-segl-c--chico' : ''}${segmento ? '' : ' fi-segl-c--sin'}`}
        style={segmento ? { background: COLOR_SEGMENTO[segmento] } : undefined} aria-hidden="true">
        {segmento || '–'}
    </span>
);

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

    const detalle = segmento && puntos != null
        ? ` · ${Number(puntos) > 0 ? '+' : ''}${Number(puntos).toLocaleString('es-AR', { maximumFractionDigits: 1 })} pts`
        : '';
    const titulo = `${segmento ? `Segmento ${segmento}${detalle}` : 'Sin segmento'}${manual ? ' · cambiado a mano' : ''}`;
    if (!puedeCambiar) {
        return <span className="fi-segl-caja" title={titulo} role="img" aria-label={titulo}><Circulo segmento={segmento} /></span>;
    }

    const elegir = async (key) => {
        setAbierto(false);
        if ((key || null) === (segmento || null)) return;
        setGuardando(true);
        try { await onCambiar?.(key); } catch { /* el cascarón muestra el aviso */ } finally { setGuardando(false); }
    };

    return (
        <span className="fi-segl-caja" ref={ref}>
            <button type="button" className="fi-segl-btn" aria-haspopup="listbox" aria-expanded={abierto}
                disabled={guardando} title={`${titulo}. Tocá para cambiarlo`} aria-label={`${titulo}. Cambiar el segmento`}
                onClick={() => setAbierto((a) => !a)}>
                <Circulo segmento={segmento} />
            </button>
            {abierto && (
                <div className="fi-pop fi-segl-menu" role="listbox" aria-label="Segmento del lead">
                    {OPCIONES.map((o) => {
                        const on = (o.key || null) === (segmento || null);
                        return (
                            <button key={o.label} type="button" className="fi-opcion" role="option" aria-selected={on}
                                onClick={() => elegir(o.key)}>
                                <span className="fi-segl-op"><Circulo segmento={o.key} chico />{o.key ? `Segmento ${o.label}` : o.label}</span>
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
