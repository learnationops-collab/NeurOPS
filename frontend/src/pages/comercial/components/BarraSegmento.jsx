import FiltroSegmentos from '../../admin/marketing/todos/FiltroSegmentos';
import { SEGMENTOS } from '../../admin/marketing/todos/segmentos';
import '../../admin/marketing/todos/segmentos.css';

/**
 * El filtro de segmento (A, B, C, D, sin; varios a la vez) del dashboard comercial (Kerwin, 28/10/2026): decide qué grupos
 * entran en las cifras. Vive en la URL (`seg`) y se recuerda por usuario (ver `DashboardComercial`). Cada pantalla dice en una línea
 * qué filtra y qué no: los KPIs del closer, las listas de Revisar y el panel Segmentos sí (cuentas en
 * `app/services/segmentos_comercial.py`); el reporte diario del setter (ManyChat), las comparativas y la variabilidad no traen
 * segmento.
 */
const TABLAS_CON_SEGMENTO = ['agendas', 'generadas', 'ventas'];

/** { chips, texto } de lo que se ve, o null si el filtro no tiene nada que decir acá. */
export const segmentoDeLaVista = ({ seccion, tab, rol, tabla }) => {
    if (seccion === 'analizar' && tab === 'dashboard') {
        return rol === 'closers'
            ? { chips: true, texto: 'Acota los KPIs, las listas y Segmentos; la deuda por cobrar y las fuentes no se parten.' }
            : { chips: false, texto: 'El reporte diario del setter no trae segmento: se corta en Segmentos.' };
    }
    if (seccion === 'analizar') return { chips: false, texto: 'Esta pestaña no se filtra por segmento.' };
    if (seccion === 'revisar') {
        return TABLAS_CON_SEGMENTO.includes(tabla)
            ? { chips: true, texto: 'Acota esta lista y sus totales.' }
            : { chips: false, texto: 'Esta lista no se filtra por segmento.' };
    }
    return null;
};

const BarraSegmento = ({ vista, elegidos, onElegir }) => {
    if (!vista) return null;
    return (
        <div className="sg-barra" style={{ marginBottom: 'var(--s3)' }}>
            {vista.chips && <FiltroSegmentos segmentos={SEGMENTOS} elegidos={elegidos} onCambiar={onElegir} />}
            {(!vista.chips || elegidos.length > 0) && <span className="t-cap mut">{vista.texto}</span>}
        </div>
    );
};

export default BarraSegmento;
