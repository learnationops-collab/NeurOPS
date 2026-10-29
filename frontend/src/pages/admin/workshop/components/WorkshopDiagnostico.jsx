import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Settings2 } from 'lucide-react';
import { Delta, Humo, PanelCab, Tip, useMontado } from '../../../comercial/components/Shared';
import Cifra from '../../../comercial/components/Cifra';
import { EsqueletoClarity, EsqueletoEtapas, EsqueletoPrioridad } from '../resumen/EsqueletosResumen';
import { CifraConCuenta } from '../../../../components/standard';
import { cuentaDeEtapa } from '../registros/cuentas';
import { STAGE_ORDER, aggregateTotals, computeClarityScore, computeFuga, stageRates } from '../funnelMath';

/**
 * La salud del embudo y lo que hay que atacar primero.
 *
 * Una fila por etapa, en el orden del embudo: la barra es la tasa real, la raya blanca su meta y la
 * barra fina de abajo lo que daba la comparación. A la derecha, las mismas tres cifras escritas en
 * columnas fijas (actual, cambio en puntos, comparado y meta) para que nunca se pisen.
 *
 * Al costado, la prioridad (la etapa más lejos de su meta, con «Simular mejora» que lleva a
 * Planificar › Simulador) y el Clarity score.
 */

const TONO = { ok: 'success', al_limite: 'warning', fuga: 'error' };
const ESTADO = { ok: 'Sobre meta', al_limite: 'Al límite', fuga: 'Bajo meta' };

const tope = (v) => Math.min(100, Math.max(0, v || 0));
const pct = (v) => `${Number(v).toFixed(1)}%`;

// Cada fila mide su propio montaje: si llega después que el panel (las metas tardaron), su barra
// igual crece desde cero.
const Fila = ({ f, antes, i, cuenta, onVer }) => {
    const montado = useMontado();
    const color = `var(--${TONO[f.estado]})`;
    const demora = `${120 + i * 70}ms`;
    const cambio = antes == null ? null : Math.round((f.real - antes) * 10) / 10;
    return (
        <div className="wr-etapa" role="row">
            <span className="wr-etapa-nombre" role="rowheader" title={f.label}>{f.label}</span>
            <span className="wr-etapa-pista" aria-hidden="true">
                <span className="wr-etapa-riel">
                    <i style={{ width: montado ? `${tope(f.real)}%` : 0, background: color, transitionDelay: demora }} />
                    <em style={{ left: `${tope(f.meta)}%` }} />
                </span>
                {antes != null && (
                    <span className="wr-etapa-riel wr-etapa-riel--antes">
                        <i style={{ width: montado ? `${tope(antes)}%` : 0, transitionDelay: demora }} />
                    </span>
                )}
            </span>
            <span className="wr-etapa-n num" role="cell" style={{ color }}>
                <CifraConCuenta cuenta={cuenta} onVer={onVer} lado="der">{pct(f.real)}</CifraConCuenta>
            </span>
            <span className="wr-etapa-delta" role="cell">
                {cambio != null && <Delta delta={{ valor: cambio, modo: 'pts' }} />}
            </span>
            <span className="wr-etapa-antes num" role="cell">{antes == null ? '' : pct(antes)}</span>
            <span className="wr-etapa-meta num" role="cell">{pct(f.meta)}</span>
            <span className="wr-etapa-estado" role="cell">
                <span className="chip" style={{ '--c': color }}>{ESTADO[f.estado]}</span>
            </span>
        </div>
    );
};

const Anillo = ({ score }) => (
    <span className="wr-anillo" style={{ '--score': `${tope(score) * 3.6}deg` }}>
        <Cifra tag="b" className="num" valor={String(score)} desdeAnterior />
        <small>/100</small>
    </span>
);

/**
 * Los tres paneles se dibujan desde el primer momento con su título; lo de adentro espera SU dato:
 * la salud y la prioridad, los talleres y las metas; el Clarity score, además, el plan de acciones.
 * Mientras tanto, huesos del tamaño real (resumen/EsqueletosResumen.jsx).
 */
const WorkshopDiagnostico = ({ events, comparados, goals, actions, onEditGoals, onGoToSimulador, onVer = null }) => {
    const reducir = useReducedMotion();

    const conMetas = Boolean(events && goals);
    const totals = conMetas ? aggregateTotals(events) : null;
    const fugas = conMetas ? computeFuga(totals, stageRates(totals), goals) : [];
    const porEtapa = Object.fromEntries(fugas.map((f) => [f.key, f]));
    const filas = STAGE_ORDER.map((s) => porEtapa[s.key]).filter(Boolean);

    const ratesAntes = conMetas && comparados ? stageRates(aggregateTotals(comparados)) : null;
    const antesDe = (key) => (ratesAntes ? Math.round(ratesAntes[key] * 1000) / 10 : null);

    const clarity = conMetas && actions ? computeClarityScore(goals, actions, fugas) : null;
    const principal = fugas.find((f) => f.estado === 'fuga') || fugas.find((f) => f.estado === 'al_limite');
    // computeFuga proyecta sobre los leads de TODOS los talleres de la selección: por taller es ÷ N.
    const ventasPorTaller = principal && events.length ? principal.impactoVentas / events.length : 0;

    const entrada = (i) => ({
        initial: reducir ? false : { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.32, delay: reducir ? 0 : 0.18 + i * 0.06, ease: [0.22, 0.7, 0.2, 1] },
    });

    return (
        <div className="wr-diag">
            <motion.section className="panel wr-salud" {...entrada(0)}>
                <PanelCab titulo="Salud del embudo"
                    tip="Cada etapa contra su meta. La barra fina es la comparación.">
                    {/* La leyenda va en la cabecera del panel: un renglón menos y el Resumen entra sin scroll. */}
                    <div className="leyenda wr-leyenda" aria-hidden="true">
                        <span><i style={{ background: 'var(--success)' }} />Actual</span>
                        {ratesAntes && <span><i className="wr-leyenda-antes" />Comparación</span>}
                        <span><i className="wr-leyenda-meta" />Meta</span>
                    </div>
                    <button type="button" className="btn btn--linea btn--sm" onClick={onEditGoals} disabled={!goals}>
                        <Settings2 aria-hidden="true" /> Editar metas
                    </button>
                </PanelCab>
                {conMetas ? (
                    <div className={`wr-etapas ui-reveal${ratesAntes ? '' : ' wr-etapas--sin-vs'}`} role="table" aria-label="Salud del embudo">
                        <CabEtapas conVs={Boolean(ratesAntes)} />
                        {filas.map((f, i) => <Fila key={f.key} f={f} antes={antesDe(f.key)} i={i} cuenta={cuentaDeEtapa(f.key, totals)} onVer={onVer} />)}
                    </div>
                ) : <EsqueletoEtapas cabecera={<CabEtapas conVs={false} />} />}
            </motion.section>

            <div className="wr-lado">
                <motion.section className="panel caja wr-prioridad" {...entrada(1)}>
                    <Humo clase="humo--tarjeta" colores={['var(--brand-secondary)', 'var(--brand-primary)', 'var(--brand-secondary-light)', 'var(--brand-navy)']} />
                    <div className="panel-cab">
                        <p className="t-eyebrow">Prioridad</p>
                        <Tip titulo="Prioridad"
                            texto="La etapa más lejos de su meta y lo que sumaría llegar." />
                    </div>
                    {!conMetas ? <EsqueletoPrioridad /> : principal ? (
                        <div className="ui-reveal">
                            <h3 className="t-h3 wr-prioridad-etapa">{principal.label}</h3>
                            <p className="wr-prioridad-cifras num">
                                <b style={{ color: `var(--${TONO[principal.estado]})` }}>{pct(principal.real)}</b>
                                <ArrowRight aria-hidden="true" />
                                <b>{pct(principal.meta)}</b>
                            </p>
                            <p className="t-cap mut num">+{ventasPorTaller.toFixed(1)} ventas por taller</p>
                            <button type="button" className="btn btn--cta btn--sm wr-prioridad-btn"
                                onClick={() => onGoToSimulador?.(principal.key)}>
                                Simular mejora <ArrowRight aria-hidden="true" />
                            </button>
                        </div>
                    ) : (
                        <h3 className="t-h3 wr-prioridad-etapa ui-reveal">Todo en meta</h3>
                    )}
                </motion.section>

                <motion.section className="panel wr-clarity" {...entrada(2)}>
                    <div className="panel-cab">
                        <p className="t-eyebrow">Clarity score</p>
                        <Tip titulo="Clarity score"
                            texto="Promedio de metas cargadas, plan y acciones hechas." />
                    </div>
                    {clarity ? <Clarity clarity={clarity} /> : <EsqueletoClarity />}
                </motion.section>
            </div>
        </div>
    );
};

const CabEtapas = ({ conVs }) => (
    <div className="wr-etapa wr-etapa--cab" role="row">
        <span role="columnheader" className="wr-etapa-nombre"><small>Etapa</small></span>
        <span aria-hidden="true" />
        <span role="columnheader" className="wr-etapa-n"><small>Actual</small></span>
        <span role="columnheader" className="wr-etapa-delta"><small>{conVs ? 'Cambio' : ''}</small></span>
        <span role="columnheader" className="wr-etapa-antes"><small>{conVs ? 'VS' : ''}</small></span>
        <span role="columnheader" className="wr-etapa-meta"><small>Meta</small></span>
        <span role="columnheader" className="wr-etapa-estado"><small>Estado</small></span>
    </div>
);

// Su propio montaje: si el plan de acciones llega después, las barras igual crecen desde cero.
const Clarity = ({ clarity }) => {
    const montado = useMontado();
    return (
        <div className="wr-clarity-cuerpo ui-reveal">
            <Anillo score={clarity.score} />
            <div className="wr-clarity-partes">
                {[['Diagnóstico', clarity.diagnostico], ['Plan', clarity.plan], ['Ejecución', clarity.ejecucion]].map(([rotulo, v], i) => (
                    <div key={rotulo} className="wr-clarity-parte">
                        <span className="t-cap mut">{rotulo}</span>
                        <span className="t-cap num">{v}%</span>
                        <span className="riel riel--fino">
                            <i style={{ width: montado ? `${tope(v)}%` : 0, background: 'var(--brand-secondary)', transitionDelay: `${200 + i * 90}ms` }} />
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WorkshopDiagnostico;
