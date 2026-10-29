import { useMemo, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { PanelCab, Tip } from '../../../comercial/components/Shared';
import Cifra from '../../../comercial/components/Cifra';
import FilaAccion from '../planificar/FilaAccion';
import { estimarImpacto } from '../planificar/plan';
import { aggregateTotals, computeClarityScore, computeFuga, money, stageRates, ticketPromedio } from '../funnelMath';

/**
 * El plan de acciones en números (impacto estimado, Clarity Score) y todas las acciones: las de cada
 * próximo taller (que ya no se ven en su fila, 24/10/2026), las que no tienen taller y las de talleres
 * que ya pasaron. `sinTaller` trae las de los próximos talleres también.
 */
const WorkshopAccionesView = ({
    events, goals, actions, sinTaller, pasadas, talleres, formatCurrency,
    onNueva, onTildar, onEditar, onBorrar, onAsignar,
}) => {
    const [verHechas, setVerHechas] = useState(false);
    const totals = useMemo(() => aggregateTotals(events), [events]);
    const rates = useMemo(() => stageRates(totals), [totals]);
    const fugas = useMemo(() => computeFuga(totals, rates, goals), [totals, rates, goals]);
    const clarity = useMemo(() => computeClarityScore(goals, actions, fugas), [goals, actions, fugas]);
    const ticket = ticketPromedio(totals);
    const fmt = formatCurrency || money;

    const pendientes = actions.filter((a) => a.status === 'pending');
    const impacto = pendientes.reduce((acc, a) => {
        const i = estimarImpacto(a, totals, rates, ticket);
        return { ventas: acc.ventas + i.ventas, cash: acc.cash + i.cash };
    }, { ventas: 0, cash: 0 });

    const sueltas = [...sinTaller, ...pasadas].filter((a) => a.status === 'pending');
    const hechasPasadas = [...sinTaller, ...pasadas].filter((a) => a.status === 'done');
    const fila = (a, conTaller) => (
        <FilaAccion key={a.id} accion={a} onTildar={onTildar} onEditar={onEditar} onBorrar={onBorrar}
            talleres={conTaller ? talleres : undefined} onAsignar={conTaller ? onAsignar : undefined} />
    );

    const cifras = [
        { key: 'pend', label: 'Pendientes', valor: String(pendientes.length), sub: actions.length - pendientes.length === 1 ? '1 hecha' : `${actions.length - pendientes.length} hechas` },
        { key: 'ventas', label: 'Si se cumplen', valor: `+${impacto.ventas.toFixed(1)}`, sub: `+${fmt(impacto.cash)} cash`,
          tip: 'Ventas que sumarían las pendientes. Estimación para priorizar.' },
        { key: 'clarity', label: 'Plan de mejora', valor: String(clarity.score), sub: `Metas ${clarity.diagnostico}% · etapas con acción ${clarity.plan}%`,
          tip: 'Bajo: cargá las metas y una acción por cada etapa bajo meta.' },
        { key: 'ejec', label: 'Ejecución', valor: `${clarity.ejecucion}%`, sub: 'de las acciones, hechas' },
    ];

    return (
        <section className="panel wp-panel" id="wp-acciones" aria-label="Plan de acciones">
            <PanelCab titulo="Plan de acciones"
                tip="Lo que falta hacer: tildalo o asignalo a un taller.">
                <button type="button" className="btn btn--cta btn--sm" onClick={onNueva}>
                    <Plus aria-hidden="true" /> Nueva acción
                </button>
            </PanelCab>

            <div className="wp-cifras">
                {cifras.map((c) => (
                    <div key={c.key} className="tarjeta wp-cifra">
                        <span className="wp-cifra-cab"><span className="t-rotulo">{c.label}</span>{c.tip && <Tip texto={c.tip} titulo={c.label} />}</span>
                        <Cifra valor={c.valor} className="wp-cifra-n num" desdeAnterior />
                        <span className="t-cap mut40">{c.sub}</span>
                    </div>
                ))}
            </div>

            <div className="wp-sueltas">
                <p className="t-rotulo">Por hacer {sueltas.length > 0 && <span className="wp-cuenta num">{sueltas.length}</span>}</p>
                {sueltas.length === 0 ? (
                    <p className="t-cap mut40">No hay acciones por hacer.</p>
                ) : (
                    <ul className="wp-acciones" aria-label="Acciones por hacer">
                        {sueltas.map((a) => fila(a, true))}
                    </ul>
                )}
                {hechasPasadas.length > 0 && (
                    <>
                        <button type="button" className="wp-ver" aria-expanded={verHechas} onClick={() => setVerHechas((v) => !v)}>
                            <ChevronDown aria-hidden="true" data-abierto={verHechas ? '1' : undefined} />
                            {verHechas ? 'Ocultar' : 'Ver'} {hechasPasadas.length === 1 ? 'la hecha' : `las ${hechasPasadas.length} hechas`}
                        </button>
                        {verHechas && (
                            <ul className="wp-acciones" aria-label="Acciones hechas">
                                {hechasPasadas.map((a) => fila(a, false))}
                            </ul>
                        )}
                    </>
                )}
            </div>
        </section>
    );
};

export default WorkshopAccionesView;
