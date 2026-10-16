import React, { useMemo, useState } from 'react';
import Legado from './Legado';
import { CalendarDays } from 'lucide-react';
import WorkshopKpiCards from '../components/WorkshopKpiCards';
import WorkshopDiagnostico from '../components/WorkshopDiagnostico';
import WorkshopFiltroResumen from '../components/WorkshopFiltroResumen';
import { FILTRO_TODOS, filtrarTalleres, talleresAnteriores, totalesResumen, variaciones } from '../filtroTalleres';

/**
 * Resumen: qué talleres se analizan, los KPIs y la salud del embudo contra las metas.
 *
 * El filtro vive acá (no en la página): solo lo usa el Resumen.
 */
const ResumenTab = ({ realizados, goals, actions, onEditGoals, onGoToSimulador, formatDate }) => {
    // Qué talleres analiza el Resumen (ver filtroTalleres.js)
    const [filtroResumen, setFiltroResumen] = useState(FILTRO_TODOS);

    // El Resumen analiza solo los talleres del filtro; las flechas comparan contra los anteriores.
    const analizados = useMemo(() => filtrarTalleres(realizados, filtroResumen), [realizados, filtroResumen]);
    const anteriores = useMemo(() => talleresAnteriores(realizados, filtroResumen), [realizados, filtroResumen]);
    const totalStats = useMemo(() => totalesResumen(analizados), [analizados]);
    const cambios = useMemo(
        () => (anteriores ? variaciones(totalStats, analizados.length, totalesResumen(anteriores), anteriores.length) : null),
        [totalStats, analizados.length, anteriores]
    );

    return (
        <Legado>
            <section className="hero" aria-labelledby="workshop-intel-title">
                <div>
                    <p className="eyebrow"><span className="live-dot" />Sistema actualizado · {realizados.length} talleres</p>
                    <h1 id="workshop-intel-title">Rendimiento & Workshop Intelligence.</h1>
                    <p className="hero-copy">Consola ejecutiva de análisis financiero, ROI publicitario y eficiencia de embudo para talleres y webinars.</p>
                </div>
                <div className="hero-period">
                    <span>Período analizado</span>
                    <strong>
                        {analizados.length
                            ? `${formatDate(analizados[analizados.length - 1].date)} — ${formatDate(analizados[0].date)}`
                            : 'Sin talleres'}
                    </strong>
                </div>
            </section>
            <WorkshopFiltroResumen
                talleres={realizados}
                filtro={filtroResumen}
                onCambiar={setFiltroResumen}
                formatDate={formatDate}
                cantidad={analizados.length}
                cantidadAnterior={anteriores?.length || 0}
            />
            {analizados.length === 0 ? (
                <section className="empty-state">
                    <div><CalendarDays size={26} /></div>
                    <p className="eyebrow">Sin talleres</p>
                    <h2>Ningún taller entra en esta selección</h2>
                    <p>Elegí al menos un taller o ampliá el período para ver los números.</p>
                </section>
            ) : (
                <>
                    <WorkshopKpiCards totalStats={totalStats} eventsCount={analizados.length} cambios={cambios} />
                    <WorkshopDiagnostico
                        events={analizados}
                        goals={goals}
                        actions={actions}
                        onEditGoals={onEditGoals}
                        onGoToSimulador={onGoToSimulador}
                    />
                </>
            )}
        </Legado>
    );
};

export default ResumenTab;
