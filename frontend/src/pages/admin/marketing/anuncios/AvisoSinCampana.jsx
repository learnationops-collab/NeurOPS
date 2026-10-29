import { AlertTriangle } from 'lucide-react';
import { Chip } from '../../../../components/standard';
import { formatear } from './metricas';

/**
 * Indicador de palabras clave con gasto en Meta que no están en ninguna campaña vigente del Inbox
 * (Kerwin, 24/10/2026). Sin campaña, cuando ManyChat se apague sus leads dejan de contarse: el CPL de
 * Setting se ve más alto y el ROAS, más bajo. La lista la arma `fuentes_service.sin_campana`; sin casos
 * no se dibuja nada.
 *
 * Desde el 28/10/2026 es una pastilla en la cabecera de cada pantalla (una por pantalla, no un renglón en
 * cada pestaña): dice cuántas y cuánto, y el tooltip, cuáles y cómo se arregla.
 */
const MAXIMO_EN_TOOLTIP = 6;

const AvisoSinCampana = ({ sinCampana, moneda }) => {
    const palabras = sinCampana?.palabras || [];
    if (!palabras.length) return null;
    const dinero = (v) => formatear(v, 'money', moneda);
    const nombres = palabras.slice(0, MAXIMO_EN_TOOLTIP).map((p) => `${p.nombre} ${dinero(p.gasto)}`).join(' · ');
    const resto = palabras.length - MAXIMO_EN_TOOLTIP;
    const texto = palabras.length === 1 ? `${palabras[0].nombre} sin campaña` : `${palabras.length} palabras sin campaña`;
    const pct = sinCampana.pct_gasto !== null && sinCampana.pct_gasto !== undefined ? ` (${sinCampana.pct_gasto}% del gasto)` : '';
    return (
        <Chip subtle color="var(--warning)" className="mk-aviso-chip" role="status"
            data-tip={`Gasto sin campaña en el Inbox|${nombres}${resto > 0 ? ` y ${resto} más` : ''}. Creá la campaña en Inbox › Campañas y se va.`}>
            <AlertTriangle size={13} aria-hidden="true" />
            <span className="mk-aviso-nombre">{texto}</span> {dinero(sinCampana.gasto)}{pct}
        </Chip>
    );
};

export default AvisoSinCampana;
