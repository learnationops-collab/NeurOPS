import React, { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import WorkshopKpiCards from '../components/WorkshopKpiCards';
import WorkshopDiagnostico from '../components/WorkshopDiagnostico';
import WorkshopFiltroResumen from '../components/WorkshopFiltroResumen';
import {
    comparacionDeParams, filtrarTalleres, filtroDeParams, paramsDeComparacion, paramsDeFiltro,
    talleresComparados, totalesResumen, variaciones,
} from '../filtroTalleres';
import useRegistrosWorkshop from '../registros/useRegistrosWorkshop';
import { EsqueletoFiltros } from '../resumen/EsqueletosResumen';
import { EnCabecera } from '../components/CabeceraWorkshop';
import RecorridoResumen, { EsqueletoRecorrido } from '../resumen/RecorridoResumen';
import '../resumen/resumen.css';

const SIN_TALLERES = [];

/**
 * Resumen: qué talleres se analizan y contra qué, los KPIs y la salud del embudo contra las metas.
 *
 * Estilo del dashboard comercial (`.dc-shell`). El filtro y la comparación viven en la URL con
 * claves propias (ver filtroTalleres.js), así un link lleva a la misma vista; Talleres, Planificar
 * y Tráfico no los usan.
 */
const ResumenTab = ({ realizados, goals, actions, onEditGoals, onGoToSimulador }) => {
    const [params, setParams] = useSearchParams();
    const filtro = useMemo(() => filtroDeParams(params), [params]);
    const comparacion = useMemo(() => comparacionDeParams(params, filtro), [params, filtro]);

    const escribir = useCallback((claves) => {
        const siguiente = new URLSearchParams(params);
        Object.entries(claves).forEach(([k, v]) => (v ? siguiente.set(k, v) : siguiente.delete(k)));
        setParams(siguiente, { replace: true });
    }, [params, setParams]);

    // Al cambiar qué se analiza, la comparación elegida a mano se conserva. La que sale por defecto
    // NO se congela: «Sin comparar» de «Todos» no debe quedar pegado al pasar a «Últimos N».
    const eligioComparacion = params.has('vs');
    const cambiarFiltro = (nuevo) => escribir({
        ...paramsDeFiltro(nuevo), ...paramsDeComparacion(eligioComparacion ? comparacion : null, nuevo),
    });
    const cambiarComparacion = (nueva) => escribir(paramsDeComparacion(nueva, filtro));

    // `realizados` es null mientras los talleres no llegaron: cada bloque muestra su esqueleto.
    const cargando = realizados == null;
    const lista = realizados || SIN_TALLERES;
    const analizados = useMemo(() => filtrarTalleres(lista, filtro), [lista, filtro]);
    const comparado = useMemo(
        () => (cargando ? null : talleresComparados(lista, filtro, comparacion)),
        [cargando, lista, filtro, comparacion]
    );
    const totales = useMemo(() => totalesResumen(analizados), [analizados]);
    const anterior = useMemo(
        () => (comparado ? { totales: totalesResumen(comparado.talleres), cantidad: comparado.talleres.length } : null),
        [comparado]
    );
    const cambios = useMemo(
        () => (anterior ? variaciones(totales, analizados.length, anterior.totales, anterior.cantidad) : null),
        [totales, analizados.length, anterior]
    );

    const registros = useRegistrosWorkshop(analizados);

    return (
        <div className="dc-shell dc-shell--embebido">
            <div className="vista wr-resumen">
                {/* Las pastillas van a la línea de la cabecera (solo en esta pestaña). */}
                <EnCabecera>
                    {cargando ? <EsqueletoFiltros /> : (
                        <WorkshopFiltroResumen
                            talleres={lista}
                            filtro={filtro}
                            comparacion={comparacion}
                            comparado={comparado}
                            onFiltro={cambiarFiltro}
                            onComparacion={cambiarComparacion}
                        />
                    )}
                </EnCabecera>
                {!cargando && analizados.length === 0 ? (
                    <section className="panel wr-vacio" role="status">
                        <p className="t-h3">Ningún taller en esta selección</p>
                        <p className="t-sm mut">Elegí al menos uno o ampliá el período.</p>
                    </section>
                ) : (
                    <>
                        <WorkshopKpiCards totalStats={cargando ? null : totales} eventsCount={analizados.length}
                            cambios={cambios} anterior={anterior} onVer={registros.abrir} />
                        {cargando ? <EsqueletoRecorrido /> : (
                            <RecorridoResumen talleres={analizados} plata={totales} onVer={registros.abrir} />
                        )}
                        <WorkshopDiagnostico
                            events={cargando ? null : analizados}
                            comparados={comparado?.talleres || null}
                            goals={goals}
                            actions={actions}
                            onEditGoals={onEditGoals}
                            onGoToSimulador={onGoToSimulador}
                            onVer={registros.abrir}
                        />
                    </>
                )}
                {registros.panel}
            </div>
        </div>
    );
};

export default ResumenTab;
