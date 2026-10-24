import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { esFecha, textoRango } from '../../../comercial/components/RangoFechas';
import { PERIODOS, PERIODO_POR_DEFECTO, rangoDePeriodo } from './metricas';

/**
 * El período de las vistas de Marketing y Workshop que lo piden al tablero de anuncios: vive en la URL
 * (`periodo`, `desde`, `hasta`), así un link lleva a lo mismo que se estaba mirando.
 * `elegir(key)` cambia de período; `cambiar(cambios)` toca cualquier otro parámetro de la URL.
 */
export const usePeriodoDeUrl = () => {
    const [params, setParams] = useSearchParams();
    const periodo = PERIODOS.some((p) => p.key === params.get('periodo')) ? params.get('periodo') : PERIODO_POR_DEFECTO;
    const pDesde = params.get('desde');
    const pHasta = params.get('hasta');
    const rango = useMemo(() => {
        if (periodo === 'personalizado' && esFecha(pDesde) && esFecha(pHasta)) return { desde: pDesde, hasta: pHasta };
        return rangoDePeriodo(periodo === 'personalizado' ? PERIODO_POR_DEFECTO : periodo);
    }, [periodo, pDesde, pHasta]);

    const cambiar = useCallback((cambios) => {
        const siguiente = new URLSearchParams(params);
        Object.entries(cambios).forEach(([k, v]) => (v ? siguiente.set(k, v) : siguiente.delete(k)));
        setParams(siguiente, { replace: true });
    }, [params, setParams]);

    const elegir = useCallback((key) => cambiar(key === 'personalizado'
        ? { periodo: key, desde: rango.desde, hasta: rango.hasta }
        : { periodo: key === PERIODO_POR_DEFECTO ? null : key, desde: null, hasta: null }), [cambiar, rango]);

    const textoPeriodo = periodo === 'personalizado' ? textoRango(rango) : PERIODOS.find((p) => p.key === periodo)?.label;
    return { periodo, rango, cambiar, elegir, textoPeriodo };
};
