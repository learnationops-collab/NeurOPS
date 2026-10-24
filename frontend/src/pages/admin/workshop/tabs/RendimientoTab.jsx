import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { PillMenu } from '../../../comercial/components/Shared';
import RangoFechas, { esFecha, textoRango } from '../../../comercial/components/RangoFechas';
import RendimientoWorkshop from '../../marketing/anuncios/RendimientoWorkshop';
import { PERIODOS, PERIODO_POR_DEFECTO, rangoDePeriodo } from '../../marketing/anuncios/metricas';
import { mensajeDeError, pedirTablero } from '../../marketing/anuncios/marketingApi';
import { useDatosCacheados } from '../../../../services/cacheDeVistas';
import { EnCabecera } from '../components/CabeceraWorkshop';
import '../../../../components/dashboard/pareja.css';
import '../../marketing/anuncios/anuncios.css';

/**
 * Workshop › Rendimiento (24/10/2026): el gasto y los anuncios de Meta que llevan a la clase en vivo.
 * Antes era el embudo «Workshop» de Rendimiento en Marketing (hoy «Setting»); se separó para que cada
 * espacio muestre solo lo suyo. Es la misma vista (`RendimientoWorkshop`) con el mismo tablero (misma
 * clave de caché), y el período va en la URL (`periodo`, `desde`, `hasta`) como en Setting.
 */
const RendimientoTab = () => {
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const periodo = PERIODOS.some((p) => p.key === params.get('periodo')) ? params.get('periodo') : PERIODO_POR_DEFECTO;
    const pDesde = params.get('desde');
    const pHasta = params.get('hasta');
    const rango = useMemo(() => {
        if (periodo === 'personalizado' && esFecha(pDesde) && esFecha(pHasta)) return { desde: pDesde, hasta: pHasta };
        return rangoDePeriodo(periodo === 'personalizado' ? PERIODO_POR_DEFECTO : periodo);
    }, [periodo, pDesde, pHasta]);

    const [version, setVersion] = useState(0);
    const recargar = useCallback(() => setVersion((v) => v + 1), []);
    const cambiar = useCallback((cambios) => {
        const siguiente = new URLSearchParams(params);
        Object.entries(cambios).forEach(([k, v]) => (v ? siguiente.set(k, v) : siguiente.delete(k)));
        setParams(siguiente, { replace: true });
    }, [params, setParams]);

    // Mismo tablero que Setting: de acá salen el gasto por día y las cuentas de Meta.
    const { datos, error: fallo, cargando } = useDatosCacheados(`mk:tablero:${rango.desde}:${rango.hasta}`,
        (signal) => pedirTablero(rango.desde, rango.hasta, { signal }),
        { version, onError: (e) => toast.error(mensajeDeError(e, 'No se pudo cargar el rendimiento.')) });

    const fuente = datos?.fuentes?.fuentes?.find((f) => f.key === 'workshop') || null;
    const textoPeriodo = periodo === 'personalizado' ? textoRango(rango) : PERIODOS.find((p) => p.key === periodo)?.label;

    return (
        <div className="dc-shell dc-shell--embebido">
            <EnCabecera>
                <div className="fila">
                    <PillMenu icono={<CalendarDays />} texto={textoPeriodo} rotulo="Período"
                        detalle={periodo === 'personalizado' ? null : textoRango(rango)}
                        opciones={PERIODOS} valor={periodo} ancho={230}
                        onChange={(key) => cambiar(key === 'personalizado'
                            ? { periodo: key, desde: rango.desde, hasta: rango.hasta }
                            : { periodo: key === PERIODO_POR_DEFECTO ? null : key, desde: null, hasta: null })}
                        pie={periodo === 'personalizado' && (
                            <RangoFechas desde={rango.desde} hasta={rango.hasta} rotulo="Período"
                                onCambiar={({ desde, hasta }) => {
                                    if (esFecha(desde) && esFecha(hasta)) cambiar({ periodo: 'personalizado', desde, hasta });
                                }} />
                        )} />
                    <button type="button" className="ibtn" onClick={recargar} disabled={cargando}
                        title="Volver a cargar" aria-label="Volver a cargar">
                        <RefreshCw className={cargando ? 'mk-gira' : ''} aria-hidden="true" />
                    </button>
                </div>
            </EnCabecera>
            <div className={cargando && datos ? 'mk-recargando' : undefined} aria-busy={cargando}>
                <RendimientoWorkshop desde={rango.desde} hasta={rango.hasta} moneda={datos?.moneda}
                    embudos={datos ? datos.embudos || [] : (fallo ? [] : null)} fuente={fuente}
                    cuentas={datos?.meta?.cuentas || []} version={version}
                    irAMeta={() => navigate('/admin/marketing?tab=meta')} />
            </div>
        </div>
    );
};

export default RendimientoTab;
