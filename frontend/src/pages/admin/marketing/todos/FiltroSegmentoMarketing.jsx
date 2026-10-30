import FiltroSegmentos from './FiltroSegmentos';
import { SEGMENTOS, segmentosDeUrl } from './segmentos';

/**
 * El filtro de segmento (A, B, C, D, sin; varios a la vez) de las vistas de Marketing fuera de «Segmentos» (Kerwin,
 * 28/10/2026): decide qué grupos entran en las cifras. Vive en la URL (`segmento=A,B`) y se recuerda por usuario junto con el
 * período (`usePeriodoDeUrl`). Las cuentas con segmento las hace el backend (`segmentos_marketing_service.acotar_fuentes`).
 *
 * Con un segmento elegido, el rótulo avisa lo que no se parte: el gasto de Meta no conoce al lead, así que el gasto, los costos
 * y el ROAS pasan a «—»; los leads de Workshop son clics anónimos. `rotulo`: el aviso de esta vista, si no es el de siempre. `derecha`: lo que va al borde derecho de la fila, alineado con las tarjetas (la leyenda Setting · Workshop).
 */
export const segmentoDeUrl = (params) => segmentosDeUrl(params.get('segmento'), SEGMENTOS);

const FiltroSegmentoMarketing = ({ params, cambiar, rotulo = null, derecha = null }) => {
    const elegidos = segmentoDeUrl(params);
    return (
        <div className="sg-barra">
            <FiltroSegmentos segmentos={SEGMENTOS} elegidos={elegidos} onCambiar={(lista) => cambiar({ segmento: lista.join(',') || null })} />
            {elegidos.length > 0 && (
                <span className="t-cap mut">
                    {rotulo || 'Por fecha de alta. Gasto, costos y ROAS no se parten por segmento: Meta no conoce al lead.'}
                </span>
            )}
            {derecha && <div className="sg-derecha">{derecha}</div>}
        </div>
    );
};

export default FiltroSegmentoMarketing;
