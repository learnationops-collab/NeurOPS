import { PillMenu } from '../../../comercial/components/Shared';
import RangoFechas, { esFecha, rangoAnterior, textoRango } from '../../../comercial/components/RangoFechas';

/**
 * El «VS» de Marketing (Kerwin, 28/10/2026): contra qué período se compara. Son las mismas opciones que el VS de Analizar
 * (`ComercialService.rango_comparado`): el período anterior del mismo largo, el mes o el año anterior, o dos fechas libres.
 * Vive en la URL (`vs`, `vd`, `vh`) y queda recordado por usuario; el backend calcula el rango y la diferencia de cada celda.
 */
export const COMPARACIONES = [
    { key: 'none', label: 'Sin comparar' },
    { key: 'prev', label: 'Período anterior' },
    { key: 'month', label: 'Mes anterior' },
    { key: 'year', label: 'Año anterior' },
    { key: 'custom', label: 'Elegir fechas', quedaAbierto: true },
];

/** Los parámetros del pedido (`comparar`, `comparar_desde`, `comparar_hasta`) de lo que hay en la URL. */
export const comparacionDeUrl = (params) => {
    const vs = COMPARACIONES.some((c) => c.key === params.get('vs')) ? params.get('vs') : 'none';
    const vd = params.get('vd');
    const vh = params.get('vh');
    if (vs === 'custom' && !(esFecha(vd) && esFecha(vh))) return { vs: 'custom', pedido: {}, rango: null };
    return {
        vs,
        rango: vs === 'custom' ? { desde: vd, hasta: vh } : null,
        pedido: vs === 'none' ? {} : { comparar: vs, ...(vs === 'custom' ? { comparar_desde: vd, comparar_hasta: vh } : {}) },
    };
};

const ComparaCon = ({ vs, rango, periodo, comparado, onCambiar }) => {
    const elegir = (key) => {
        if (key !== 'custom') {
            onCambiar({ vs: key === 'none' ? null : key, vd: null, vh: null });
        } else if (vs !== 'custom') {
            const inicial = rangoAnterior(periodo);
            onCambiar({ vs: 'custom', vd: inicial.desde, vh: inicial.hasta });
        }
    };
    const texto = rango ? textoRango(rango) : COMPARACIONES.find((c) => c.key === vs)?.label;
    return (
        <PillMenu icono={<span className="ln-muted" style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.14em' }}>VS</span>}
            rotulo="comparación" texto={texto}
            detalle={vs !== 'none' && vs !== 'custom' && comparado ? textoRango({ desde: comparado.desde, hasta: comparado.hasta }) : null}
            valor={vs} opciones={COMPARACIONES} ancho={vs === 'custom' ? 324 : 250} onChange={elegir}
            pie={vs === 'custom' && (
                <RangoFechas rotulo="Comparación" desde={rango?.desde || ''} hasta={rango?.hasta || ''}
                    onCambiar={({ desde, hasta }) => onCambiar({ vs: 'custom', vd: desde || null, vh: hasta || null })} />
            )} />
    );
};

export default ComparaCon;
