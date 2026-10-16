import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Flag, Plus, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import { PanelCab } from '../../../comercial/components/Shared';
import Cifra from '../../../comercial/components/Cifra';
import { STAGE_ORDER, aggregateTotals, money, projectSales, ticketPromedio } from '../funnelMath';
import { borradorDesdePalanca } from '../planificar/plan';

const clamp = (v) => Math.min(100, Math.max(0, v || 0));
const pct1 = (r) => Math.round(r * 1000) / 10;

/**
 * Simulador de escenarios: cálculo en el cliente sobre el promedio de los talleres realizados. No
 * escribe datos salvo «Fijar como meta» (WorkshopGoals) y, desde el 16/10/2026, la acción que sale de
 * una palanca subida: `onCrearAccion` recibe el borrador (etapa, puntos y título) y lo abre para
 * asignarlo a un próximo taller.
 *
 * `etapaEnfocada` resalta una palanca (llega desde «Simular mejora» del Resumen).
 */
const WorkshopSimuladorView = ({ events, goals, etapaEnfocada, onGoalsUpdated, onCrearAccion, formatCurrency }) => {
    const reducir = useReducedMotion();
    // El polling de la página trae un arreglo nuevo cada 20 s aunque nada cambie: el promedio se
    // recalcula (y el escenario vuelve a él) solo si cambian los números.
    const crudos = aggregateTotals(events);
    const firma = `${events.length}|${JSON.stringify(crudos)}`;
    const totals = useMemo(() => crudos, [firma]); // eslint-disable-line react-hooks/exhaustive-deps
    const n = events.length || 1;

    const baseline = useMemo(() => {
        const rates = {};
        STAGE_ORDER.forEach((s) => {
            const den = totals[s.den] || 0;
            rates[s.key] = den > 0 ? (totals[s.num] || 0) / den : 0;
        });
        return {
            rates,
            inversion: totals.inversion / n,
            cpl: totals.leads > 0 ? totals.inversion / totals.leads : 0,
            ticket: ticketPromedio(totals),
            sales: totals.sales / n,
            cash: totals.cash_collected / n,
            roas: totals.inversion > 0 ? totals.cash_collected / totals.inversion : 0,
            cac: totals.sales > 0 ? totals.inversion / totals.sales : 0,
        };
    }, [totals, n]);

    const [rates, setRates] = useState(baseline.rates);
    const [inversion, setInversion] = useState(baseline.inversion);
    const [cpl, setCpl] = useState(baseline.cpl);
    const [ticket, setTicket] = useState(baseline.ticket);

    const reset = () => {
        setRates(baseline.rates);
        setInversion(baseline.inversion);
        setCpl(baseline.cpl);
        setTicket(baseline.ticket);
    };
    // Otros números en los talleres recalculan el promedio: el escenario vuelve a él (en el render).
    const [baseVista, setBaseVista] = useState(baseline);
    if (baseVista !== baseline) {
        setBaseVista(baseline);
        reset();
    }

    const fmt = formatCurrency || money;
    const leadsProyectados = cpl > 0 ? inversion / cpl : 0;
    const ventas = projectSales(leadsProyectados, rates);
    const cash = ventas * ticket;
    const roas = inversion > 0 ? cash / inversion : 0;
    const cac = ventas > 0 ? inversion / ventas : 0;
    const delta = (v, base) => (base > 0 ? ((v - base) / base) * 100 : 0);

    const cambiado = STAGE_ORDER.some((s) => pct1(rates[s.key]) !== pct1(baseline.rates[s.key]))
        || Math.round(inversion) !== Math.round(baseline.inversion)
        || cpl.toFixed(2) !== baseline.cpl.toFixed(2)
        || Math.round(ticket) !== Math.round(baseline.ticket);

    const fijarMeta = async (stage) => {
        if (!goals) return;
        try {
            const res = await api.put('workshop/goals', { [stage.goalKey]: pct1(rates[stage.key]) });
            toast.success(`${stage.label}: meta actualizada`);
            onGoalsUpdated?.(res.data);
        } catch (err) {
            console.error('Error fijando meta:', err);
            toast.error('No se pudo actualizar la meta');
        }
    };

    const economia = [
        { key: 'inv', label: 'Inversión', valor: Math.round(inversion), set: setInversion, paso: 1 },
        { key: 'cpl', label: 'Costo por lead', valor: cpl.toFixed(2), set: setCpl, paso: 0.01 },
        { key: 'ticket', label: 'Ticket promedio', valor: Math.round(ticket), set: setTicket, paso: 1 },
    ];
    const proyeccion = [
        { label: 'Ventas', valor: ventas.toFixed(1), d: delta(ventas, baseline.sales) },
        { label: 'Cash', valor: fmt(cash), d: delta(cash, baseline.cash) },
        { label: 'ROAS', valor: `${roas.toFixed(1)}x`, d: delta(roas, baseline.roas) },
        { label: 'CAC', valor: fmt(cac), d: delta(cac, baseline.cac), invertido: true },
    ];

    return (
        <section className="panel wp-panel" id="wp-simulador" aria-label="Simulador">
            <PanelCab titulo="Simulador"
                tip="Mové una palanca y mirá cuánto cambia el resultado de un taller promedio. Si la subiste, «Acción» la convierte en algo que hay que cumplir en un próximo taller. Modelo lineal: las tasas se multiplican con techo de 95%. Sirve para priorizar; no es una predicción.">
                <button type="button" className="btn btn--linea btn--sm" onClick={reset} disabled={!cambiado}>
                    <RotateCcw aria-hidden="true" /> Restablecer
                </button>
            </PanelCab>

            <div className="wp-sim-tope">
                <div className="wp-eco hundido">
                    {economia.map((c) => (
                        <label key={c.key} className="wp-eco-celda">
                            <span className="t-rotulo">{c.label}</span>
                            <span className="wp-plata"><b>$</b>
                                <input type="number" step={c.paso} min="0" value={c.valor}
                                    onChange={(e) => c.set(parseFloat(e.target.value) || 0)} />
                            </span>
                        </label>
                    ))}
                    <div className="wp-eco-celda">
                        <span className="t-rotulo">Leads</span>
                        <span className="wp-eco-n num">{Math.round(leadsProyectados)}</span>
                    </div>
                </div>
                <div className="wp-proy" aria-live="polite">
                    {proyeccion.map((k) => {
                        const bien = k.invertido ? k.d <= 0 : k.d >= 0;
                        const quieto = Math.abs(k.d) < 0.05;
                        return (
                            <div key={k.label} className="wp-proy-celda">
                                <span className="t-rotulo">{k.label}</span>
                                <Cifra valor={k.valor} className="wp-proy-n num" desdeAnterior duracion={420} />
                                <span className="wp-proy-d num" style={{ '--c': quieto ? 'var(--text-muted-40)' : `var(--${bien ? 'success' : 'error'})` }}>
                                    {quieto ? 'igual al prom.' : `${k.d > 0 ? '+' : ''}${k.d.toFixed(1)}% vs prom.`}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="wp-palancas">
                {STAGE_ORDER.map((s) => {
                    const pct = pct1(rates[s.key]);
                    const base = pct1(baseline.rates[s.key]);
                    const meta = goals?.[s.goalKey] ?? 0;
                    const banda = goals?.banda_limite ?? 5;
                    const estado = pct >= meta ? 'success' : meta - pct <= banda ? 'warning' : 'error';
                    const subio = pct > base;
                    const enfocada = etapaEnfocada === s.key;
                    return (
                        <motion.div key={s.key} className="palanca wp-palanca" data-enfocada={enfocada ? '1' : undefined}
                            animate={enfocada && !reducir ? { scale: [1, 1.025, 1] } : undefined}
                            transition={{ duration: 0.5 }}>
                            <div className="palanca-cab">
                                <i className="wp-punto" style={{ '--c': `var(--${estado})` }}
                                    title={estado === 'success' ? 'En meta' : estado === 'warning' ? 'Cerca de la meta' : 'Lejos de la meta'} />
                                <span className="wp-pal-nom">{s.label}</span>
                                <span className="palanca-v num" data-cambiada={pct !== base ? '1' : undefined}>{pct.toFixed(1)}%</span>
                            </div>
                            <div className="wp-riel">
                                <input className="slider" type="range" min="0" max="100" step="0.5" value={pct}
                                    aria-label={`${s.label}: ${pct.toFixed(1)}%`}
                                    onChange={(e) => setRates((p) => ({ ...p, [s.key]: parseFloat(e.target.value) / 100 }))} />
                                <i className="wp-marca wp-marca--prom" style={{ left: `${clamp(base)}%` }} title={`Promedio ${base}%`} />
                                <i className="wp-marca wp-marca--meta" style={{ left: `${clamp(meta)}%` }} title={`Meta ${meta}%`} />
                            </div>
                            <div className="wp-pal-pie">
                                <span className="t-cap mut40 num">prom. {base}% · meta {meta}%</span>
                                <button type="button" className="ibtn ibtn--sm wp-pal-btn" onClick={() => fijarMeta(s)}
                                    title={`Fijar ${pct.toFixed(1)}% como meta`} aria-label={`Fijar ${pct.toFixed(1)}% como meta de ${s.label}`}
                                    disabled={!goals || pct === meta}>
                                    <Flag aria-hidden="true" />
                                </button>
                                <button type="button" className="wp-agregar" disabled={!subio}
                                    title={subio ? 'Crear una acción para lograr este cambio' : 'Subí la palanca para convertirla en acción'}
                                    aria-label={`Crear acción: ${s.label}`}
                                    onClick={() => onCrearAccion?.(borradorDesdePalanca(s.key, baseline.rates[s.key], rates[s.key]))}>
                                    <Plus aria-hidden="true" /> Acción
                                </button>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </section>
    );
};

export default WorkshopSimuladorView;
