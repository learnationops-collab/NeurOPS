import { AlertTriangle } from 'lucide-react';
import { Chip } from '../../../../components/standard';
import { Tip } from '../../../comercial/components/Shared';
import { formatear } from './metricas';

/**
 * Aviso de palabras clave con gasto en Meta que no están en ninguna campaña vigente del Inbox
 * (Kerwin, 24/10/2026). Sin campaña, cuando ManyChat se apague sus leads dejan de contarse: el CPL de
 * Setting se ve más alto y el ROAS, más bajo. La lista la arma `fuentes_service.sin_campana`; sin casos
 * no se dibuja nada.
 */
const MAXIMO_VISIBLES = 6;

const AvisoSinCampana = ({ sinCampana, moneda }) => {
    const palabras = sinCampana?.palabras || [];
    if (!palabras.length) return null;
    const dinero = (v) => formatear(v, 'money', moneda);
    const visibles = palabras.slice(0, MAXIMO_VISIBLES);
    const resto = palabras.length - visibles.length;
    const plural = palabras.length === 1;
    return (
        <div className="mk-aviso mk-aviso--palabras" role="status">
            <AlertTriangle size={16} aria-hidden="true" />
            <div className="mk-aviso-cuerpo">
                <p className="t-cap">
                    <b>{plural ? '1 palabra con gasto no tiene' : `${palabras.length} palabras con gasto no tienen`} campaña en el Inbox</b>
                    {' · '}{dinero(sinCampana.gasto)}
                    {sinCampana.pct_gasto !== null && sinCampana.pct_gasto !== undefined ? ` (${sinCampana.pct_gasto}% del gasto de Setting)` : ''}
                    {'. '}El CPL de Setting puede verse más alto y el ROAS más bajo.
                </p>
                <ul className="mk-aviso-palabras" aria-label="Palabras sin campaña">
                    {visibles.map((p) => (
                        <li key={p.clave}>
                            <Chip subtle data-tip={`${p.nombre}|${dinero(p.gasto)} gastados · ${p.entrantes} entrantes`}>
                                <span className="mk-aviso-nombre">{p.nombre}</span> {dinero(p.gasto)}
                            </Chip>
                        </li>
                    ))}
                    {resto > 0 && <li><Chip subtle>+{resto} más</Chip></li>}
                </ul>
            </div>
            <Tip texto="Creá una campaña con esa palabra en Inbox › Campañas y el aviso se va." titulo="Sin campaña" />
        </div>
    );
};

export default AvisoSinCampana;
