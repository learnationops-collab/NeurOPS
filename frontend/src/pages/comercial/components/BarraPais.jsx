import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useEnPantalla } from '../../../components/ui/useEnPantalla';

/**
 * El filtro de país del dashboard comercial (Kerwin, 04/11/2026): decide de qué países se cuentan las agendas y los
 * cobros. Vive en la URL (`pa`) y se recuerda por usuario (ver `DashboardComercial`). El país sale del WhatsApp del lead
 * (`app/services/paises_lectura.py`). Acota los KPIs del closer, las listas de Revisar y el panel «Por país» (que siempre
 * muestra todos para poder compararlos); el reporte diario del setter (ManyChat), las comparativas y la variabilidad no
 * lo traen.
 */
const TABLAS_CON_PAIS = ['agendas', 'generadas', 'ventas'];

/** { chips, texto } de lo que se ve, o null si el filtro no tiene nada que decir acá. */
export const paisDeLaVista = ({ seccion, tab, rol, tabla, triage = false }) => {
    if (triage) return null;
    if (seccion === 'analizar' && tab === 'dashboard') {
        return rol === 'closers'
            ? { chips: true, texto: 'Acota los KPIs, las listas y Segmentos; «Por país» siempre muestra todos.' }
            : { chips: false, texto: 'El reporte diario del setter no trae país: mirá «Por país».' };
    }
    if (seccion === 'analizar') return null;
    if (seccion === 'revisar') {
        return TABLAS_CON_PAIS.includes(tabla)
            ? { chips: true, texto: 'Acota esta lista y sus totales.' }
            : null;
    }
    return null;
};

const resumen = (paises, elegidos) => {
    if (!elegidos.length) return 'Todos los países';
    const nombres = elegidos.map((k) => paises.find((p) => p.key === k)?.label || k);
    return nombres.length <= 2 ? nombres.join(', ') : `${nombres.length} países`;
};

const BarraPais = ({ vista, paises = [], elegidos, onElegir }) => {
    const [abierto, setAbierto] = useState(false);
    const ref = useRef(null);
    const menuRef = useRef(null);
    const enPantalla = useEnPantalla(menuRef);

    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, [abierto]);

    if (!vista || !paises.length) return null;
    const alternar = (key) => onElegir(elegidos.includes(key) ? elegidos.filter((k) => k !== key) : [...elegidos, key]);

    return (
        <div className="sg-barra" data-testid="barra-pais">
            {vista.chips && (
                <div style={{ position: 'relative' }} ref={ref}>
                    <button type="button" className={`pastilla${abierto || elegidos.length ? ' pastilla--on' : ''}`}
                        aria-expanded={abierto} aria-haspopup="true" onClick={() => setAbierto((a) => !a)}>
                        <Globe size={14} />
                        <span className="trunc">País: {resumen(paises, elegidos)}</span>
                        <ChevronDown size={14} />
                    </button>
                    {abierto && (
                        <div ref={enPantalla}
                            className="menu menu--der" role="menu" aria-label="Filtrar por país"
                            style={{ maxHeight: 320, overflowY: 'auto', minWidth: 210 }}>
                            {paises.map((p) => (
                                <button key={p.key} type="button" className="menu-item" role="menuitemcheckbox"
                                    aria-checked={elegidos.includes(p.key)} onClick={() => alternar(p.key)}>
                                    <span className="trunc">{p.label}</span>
                                    {elegidos.includes(p.key) && <Check size={13} style={{ marginLeft: 'auto' }} />}
                                </button>
                            ))}
                            {elegidos.length > 0 && (
                                <div className="menu-pie">
                                    <button type="button" className="link-btn" onClick={() => { onElegir([]); setAbierto(false); }}>Ver todos</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            {(!vista.chips || elegidos.length > 0) && <span className="t-cap mut">{vista.texto}</span>}
        </div>
    );
};

export default BarraPais;
