import React from 'react';
import { Settings2, Sparkles, ArrowRight } from 'lucide-react';
import InfoTooltip from '../../../../components/ui/InfoTooltip';
import { aggregateTotals, stageRates, computeFuga, computeClarityScore } from '../funnelMath';

const TONE_OF = { ok: 'success', al_limite: 'warning', fuga: 'error' };
const STATUS_LABEL = { ok: 'Sobre meta', al_limite: 'Al límite', fuga: 'Bajo meta' };

const clamp = (v) => Math.min(100, Math.max(0, v || 0));

// Panel "Diagnóstico" — vive siempre visible arriba de las pestañas (como la
// sección General de la herramienta de referencia), no es una pestaña más:
// es la lectura rápida de "qué está frenando las ventas" antes de bajar al
// detalle de un evento, simular un escenario, o cargar una acción.
const WorkshopDiagnostico = ({ events, goals, actions, onEditGoals, onGoToSimulador }) => {
    if (!goals) return null;

    const totals = aggregateTotals(events);
    const rates = stageRates(totals);
    const fugas = computeFuga(totals, rates, goals);
    const clarity = computeClarityScore(goals, actions, fugas);
    const fugaPrincipal = fugas.find((f) => f.estado === 'fuga') || fugas.find((f) => f.estado === 'al_limite');

    const clarityHeadline = clarity.score < 40
        ? 'Todavía faltan diagnóstico y plan.'
        : clarity.score < 70
            ? 'El diagnóstico está; cubrí las fugas con acciones.'
            : 'El sistema tiene dirección y ejecución.';

    return (
        <section className="content-grid">
            <article className="panel health-panel">
                <div className="section-heading">
                    <div>
                        <p className="eyebrow">Diagnóstico</p>
                        <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            Salud del embudo
                            <InfoTooltip label="Salud del embudo" text="La tasa real de cada etapa contra la meta configurada. Verde: en meta. Ámbar: al límite (dentro de la banda de tolerancia). Rojo: fuga — acá se está perdiendo la mayor parte de las ventas posibles." />
                        </h2>
                    </div>
                    <button type="button" className="secondary-action" onClick={onEditGoals}>
                        <Settings2 size={14} /> Editar metas
                    </button>
                </div>
                <div className="lever-list">
                    {fugas.map((f) => (
                        <div className="lever-row" key={f.key}>
                            <span className="lever-name">{f.label}</span>
                            <span className="track" aria-hidden="true">
                                <i style={{ width: `${clamp(f.real)}%` }} />
                                <em style={{ left: `${clamp(f.meta)}%` }} />
                            </span>
                            <span className="metric-pair">
                                <strong>{f.real}%</strong>
                                <small>meta {f.meta}%</small>
                            </span>
                            <span className={`status ${TONE_OF[f.estado]}`}>{STATUS_LABEL[f.estado]}</span>
                        </div>
                    ))}
                </div>
            </article>

            <aside className="insight-stack" aria-label="Prioridades">
                <article className="priority-card">
                    <div className="priority-icon"><Sparkles size={18} aria-hidden="true" /></div>
                    <p className="eyebrow">Prioridad del sistema</p>
                    {fugaPrincipal ? (
                        <>
                            <h2>{fugaPrincipal.label}</h2>
                            <p>
                                Hoy está en <strong>{fugaPrincipal.real}%</strong>. Llegar a {fugaPrincipal.meta}% puede sumar{' '}
                                <strong>+{fugaPrincipal.impactoVentas.toFixed(1)} ventas</strong> por taller.
                            </p>
                            <button type="button" onClick={() => onGoToSimulador?.(fugaPrincipal.key)}>
                                Simular mejora <ArrowRight size={15} />
                            </button>
                        </>
                    ) : (
                        <>
                            <h2>Todo en meta</h2>
                            <p>Todas las etapas del embudo están en meta o por encima.</p>
                        </>
                    )}
                </article>

                <article className="clarity-card">
                    <div>
                        <p className="eyebrow">Clarity Score</p>
                        <h2>{clarityHeadline}</h2>
                        <div className="clarity-parts">
                            <span>Diagnóstico {clarity.diagnostico}%</span>
                            <span>Plan {clarity.plan}%</span>
                            <span>Ejecución {clarity.ejecucion}%</span>
                        </div>
                    </div>
                    <div className="score-ring" style={{ '--score': `${clarity.score * 3.6}deg` }}>
                        <strong>{clarity.score}</strong>
                        <span>/100</span>
                    </div>
                </article>
            </aside>
        </section>
    );
};

export default WorkshopDiagnostico;
