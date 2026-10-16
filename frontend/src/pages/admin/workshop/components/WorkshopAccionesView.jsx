import { useMemo, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { PanelCab, Tip } from '../../../comercial/components/Shared';
import Cifra from '../../../comercial/components/Cifra';
import FilaAccion from '../planificar/FilaAccion';
import { estimarImpacto } from '../planificar/plan';
import { aggregateTotals, computeClarityScore, computeFuga, money, stageRates, ticketPromedio } from '../funnelMath';

/**
 * El plan de acciones en números (impacto estimado, Clarity Score) y las acciones que no están en un
 * próximo taller: las que no tienen taller (todas las de antes del 16/10/2026) y las de talleres que
 * ya pasaron. Las de cada próximo taller se ven y se tildan en su fila, arriba.
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
          tip: 'Suma lo que movería cada acción pendiente que ataca una etapa (sus puntos sobre la tasa real). Sirve para priorizar; no es una predicción.' },
        { key: 'clarity', label: 'Clarity Score', valor: String(clarity.score), sub: `Diagnóstico ${clarity.diagnostico}% · plan ${clarity.plan}%`,
          tip: 'Promedio de tres cosas: metas cargadas (diagnóstico), etapas con fuga que tienen una acción (plan) y acciones hechas (ejecución).' },
        { key: 'ejec', label: 'Ejecución', valor: `${clarity.ejecucion}%`, sub: 'de las acciones, hechas' },
    ];

    return (
        <section className="panel wp-panel" id="wp-acciones" aria-label="Plan de acciones">
            <PanelCab titulo="Plan de acciones"
                tip="Las acciones de cada próximo taller están en su fila. Acá quedan las pendientes que no tienen taller o cuyo taller ya pasó: asignalas a uno o tildalas.">
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
                <p className="t-rotulo">Sin un próximo taller {sueltas.length > 0 && <span className="wp-cuenta num">{sueltas.length}</span>}</p>
                {sueltas.length === 0 ? (
                    <p className="t-cap mut40">Todas las acciones pendientes tienen un próximo taller.</p>
                ) : (
                    <ul className="wp-acciones" aria-label="Acciones sin un próximo taller">
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
