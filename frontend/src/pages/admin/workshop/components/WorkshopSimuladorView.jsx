import React, { useMemo, useState, useEffect } from 'react';
import { RotateCcw, Flag } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import { STAGE_ORDER, aggregateTotals, projectSales, computeFuga, money } from '../funnelMath';

const clamp = (v) => Math.min(100, Math.max(0, v || 0));

// Simulador de escenarios — 100% cálculo en el cliente, no lee/escribe datos
// reales (salvo "Fijar como meta", que sí persiste en WorkshopGoals a
// pedido explícito del closer/director). El baseline es el promedio de los
// talleres ya cargados; los deltas de la proyección siempre comparan contra
// ese mismo promedio, igual que la herramienta de referencia.
const WorkshopSimuladorView = ({ events, goals, highlightStage, onGoalsUpdated, formatCurrency }) => {
    const totals = useMemo(() => aggregateTotals(events), [events]);
    const n = events.length || 1;

    const baseline = useMemo(() => {
        const rates = {};
        STAGE_ORDER.forEach((s) => {
            const den = totals[s.den] || 0;
            rates[s.key] = den > 0 ? (totals[s.num] || 0) / den : 0;
        });
        const inversion = totals.inversion / n;
        const cpl = totals.leads > 0 ? totals.inversion / totals.leads : 0;
        const ticket = totals.sales > 0 ? totals.cash_collected / totals.sales : 0;
        const sales = totals.sales / n;
        const cash = totals.cash_collected / n;
        const roas = totals.inversion > 0 ? totals.cash_collected / totals.inversion : 0;
        const cac = totals.sales > 0 ? totals.inversion / totals.sales : 0;
        return { rates, inversion, cpl, ticket, sales, cash, roas, cac };
    }, [totals, n]);

    const [rates, setRates] = useState(baseline.rates);
    const [inversion, setInversion] = useState(baseline.inversion);
    const [cpl, setCpl] = useState(baseline.cpl);
    const [ticket, setTicket] = useState(baseline.ticket);

    // Si cambia el set de eventos cargados (recarga), el baseline se recalcula
    // y el escenario se reinicia sobre el promedio nuevo.
    useEffect(() => {
        setRates(baseline.rates);
        setInversion(baseline.inversion);
        setCpl(baseline.cpl);
        setTicket(baseline.ticket);
    }, [baseline]);

    const reset = () => {
        setRates(baseline.rates);
        setInversion(baseline.inversion);
        setCpl(baseline.cpl);
        setTicket(baseline.ticket);
    };

    const leadsProyectados = cpl > 0 ? inversion / cpl : 0;
    const ventasProyectadas = projectSales(leadsProyectados, rates);
    const cashProyectado = ventasProyectadas * ticket;
    const roasProyectado = inversion > 0 ? cashProyectado / inversion : 0;
    const cacProyectado = ventasProyectadas > 0 ? inversion / ventasProyectadas : 0;

    const deltaPct = (proyectado, base) => base > 0 ? ((proyectado - base) / base) * 100 : 0;

    const fugas = useMemo(() => computeFuga(totals, rates, goals), [totals, rates, goals]);

    const fijarMeta = async (stage) => {
        if (!goals) return;
        try {
            const payload = { [stage.goalKey]: Math.round(rates[stage.key] * 1000) / 10 };
            const res = await api.put('workshop/goals', payload);
            toast.success(`${stage.label}: meta actualizada`);
            onGoalsUpdated?.(res.data);
        } catch (err) {
            console.error('Error fijando meta:', err);
            toast.error('No se pudo actualizar la meta');
        }
    };

    const fmt = formatCurrency || money;

    const projectionMetrics = [
        { label: 'Ventas', value: ventasProyectadas.toFixed(1), base: baseline.sales },
        { label: 'Cash', value: fmt(cashProyectado), base: baseline.cash, raw: cashProyectado },
        { label: 'ROAS', value: `${roasProyectado.toFixed(1)}x`, base: baseline.roas, raw: roasProyectado },
        { label: 'CAC', value: fmt(cacProyectado), base: baseline.cac, raw: cacProyectado, invert: true },
    ];

    const workItems = fugas.filter((f) => f.estado !== 'ok').slice(0, 5);

    return (
        <section className="sim-grid">
            <div className="sim-controls">
                <article className="panel money-controls">
                    <div className="section-heading">
                        <div><p className="eyebrow">Variables comerciales</p><h2>Economía del escenario</h2></div>
                        <button type="button" className="icon-text-button" onClick={reset}><RotateCcw size={15} /> Restablecer</button>
                    </div>
                    <div className="input-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                        <label className="money-field">
                            <span>Inversión ads</span>
                            <span><b>$</b><input type="number" value={Math.round(inversion)} onChange={(e) => setInversion(parseFloat(e.target.value) || 0)} /></span>
                        </label>
                        <label className="money-field">
                            <span>Costo por lead</span>
                            <span><b>$</b><input type="number" step="0.01" value={cpl.toFixed(2)} onChange={(e) => setCpl(parseFloat(e.target.value) || 0)} /></span>
                        </label>
                        <label className="money-field">
                            <span>Ticket promedio</span>
                            <span><b>$</b><input type="number" value={Math.round(ticket)} onChange={(e) => setTicket(parseFloat(e.target.value) || 0)} /></span>
                        </label>
                        <div className="derived-field">
                            <span>Leads proyectados</span>
                            <strong>{Math.round(leadsProyectados)}</strong>
                            <small>inversión ÷ CPL</small>
                        </div>
                    </div>
                </article>

                <article className="panel lever-controls">
                    <div className="section-heading">
                        <div><p className="eyebrow">Palancas de conversión</p><h2>Ajustá las 8 tasas</h2></div>
                        <span className="legend"><i /> Promedio <i className="goal" /> Meta</span>
                    </div>
                    <div className="slider-list">
                        {STAGE_ORDER.map((s) => {
                            const pct = Math.round(rates[s.key] * 1000) / 10;
                            const metaPct = goals?.[s.goalKey] ?? 0;
                            const enMeta = pct >= metaPct;
                            const active = highlightStage === s.key;
                            return (
                                <div className="slider-row" key={s.key} style={active ? { background: 'rgba(19,35,198,.14)', borderRadius: 16 } : undefined}>
                                    <div><span>{s.label}</span><strong>{pct.toFixed(1)}%</strong></div>
                                    <div className="range-wrap">
                                        <input
                                            aria-label={`${s.label}: ${pct.toFixed(1)}%`}
                                            type="range" min="0" max="100" step="0.5" value={pct}
                                            onChange={(e) => setRates((prev) => ({ ...prev, [s.key]: parseFloat(e.target.value) / 100 }))}
                                        />
                                        <i className="average-marker" style={{ left: `${clamp(baseline.rates[s.key] * 100)}%` }} />
                                        <i className="target-marker" style={{ left: `${clamp(metaPct)}%` }} />
                                    </div>
                                    <div className="slider-actions">
                                        <button type="button" onClick={() => fijarMeta(s)} title={`Fijar ${pct.toFixed(1)}% como meta`}>
                                            <Flag size={12} style={{ marginRight: 4 }} />
                                            {enMeta ? 'Ya está en meta' : 'Fijar como meta'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </article>
            </div>

            <aside className="sim-results" aria-live="polite">
                <article className="projection-card">
                    <p className="eyebrow">Proyección</p>
                    <h2>Con este escenario</h2>
                    <div className="projection-kpis">
                        {projectionMetrics.map((k) => {
                            const rawVal = k.raw !== undefined ? k.raw : parseFloat(k.value);
                            const d = deltaPct(rawVal, k.base);
                            const good = k.invert ? d <= 0 : d >= 0;
                            return (
                                <div key={k.label}>
                                    <span>{k.label}</span>
                                    <strong>{k.value}</strong>
                                    <small className={good ? 'positive' : 'negative'}>{d >= 0 ? '+' : ''}{d.toFixed(1)}% vs prom.</small>
                                </div>
                            );
                        })}
                    </div>
                </article>

                <article className="panel work-order">
                    <p className="eyebrow">Orden de trabajo</p>
                    <h2>Mayor impacto primero</h2>
                    <div>
                        {workItems.map((f, i) => (
                            <article key={f.key}>
                                <span className="rank">{i + 1}</span>
                                <div><strong>{f.label}</strong><p>{f.real}% → {f.meta}%</p></div>
                                <b>+{f.impactoVentas.toFixed(1)} ventas</b>
                            </article>
                        ))}
                    </div>
                    {fugas.every((f) => f.estado === 'ok') && (
                        <p className="all-target">Todo está en meta. Sostené el resultado.</p>
                    )}
                </article>

                <p className="secondary-copy" style={{ fontSize: 10 }}>
                    Modelo lineal: los puntos porcentuales se suman por palanca con techo de 95%. Sirve para priorizar; no es una predicción.
                </p>
            </aside>
        </section>
    );
};

export default WorkshopSimuladorView;
