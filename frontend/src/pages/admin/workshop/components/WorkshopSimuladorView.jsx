import React, { useMemo, useState, useEffect } from 'react';
import { RotateCcw, Flag } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import { STAGE_ORDER, aggregateTotals, projectSales, computeFuga, money } from '../funnelMath';

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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                {/* Economía del escenario */}
                <div className="bg-slate-900/30 border border-slate-900 rounded-[2.5rem] p-8 space-y-5">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Economía del escenario</h3>
                        <button onClick={reset} className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-all cursor-pointer">
                            <RotateCcw size={12} /> Restablecer
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Inversión ads</label>
                            <input type="number" value={Math.round(inversion)} onChange={(e) => setInversion(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/30" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Costo por lead</label>
                            <input type="number" step="0.01" value={cpl.toFixed(2)} onChange={(e) => setCpl(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/30" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ticket promedio</label>
                            <input type="number" value={Math.round(ticket)} onChange={(e) => setTicket(parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-black text-white outline-none focus:ring-2 focus:ring-indigo-500/30" />
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Leads proyectados: <span className="text-slate-300">{Math.round(leadsProyectados)}</span> (inversión ÷ CPL)</p>
                </div>

                {/* Palancas de conversión */}
                <div className="bg-slate-900/30 border border-slate-900 rounded-[2.5rem] p-8 space-y-5">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Palancas de conversión</h3>
                    <div className="space-y-5">
                        {STAGE_ORDER.map((s) => {
                            const pct = Math.round(rates[s.key] * 1000) / 10;
                            const metaPct = goals?.[s.goalKey] ?? 0;
                            const enMeta = pct >= metaPct;
                            const active = highlightStage === s.key;
                            return (
                                <div key={s.key} className={`space-y-2 p-3 -mx-3 rounded-2xl transition-all ${active ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : ''}`}>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-slate-300">{s.label}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-white">{pct.toFixed(1)}%</span>
                                            <button
                                                onClick={() => fijarMeta(s)}
                                                title={`Fijar ${pct.toFixed(1)}% como meta`}
                                                className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                                            >
                                                <Flag size={10} /> {enMeta ? 'Ya está en meta' : 'Fijar como meta'}
                                            </button>
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        value={pct}
                                        onChange={(e) => setRates((prev) => ({ ...prev, [s.key]: parseFloat(e.target.value) / 100 }))}
                                        className="w-full accent-indigo-500"
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {/* Proyección */}
                <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900/40 border border-indigo-500/20 rounded-[2.5rem] p-6 space-y-4">
                    <h3 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Con este escenario</h3>
                    {[
                        { label: 'Ventas', value: ventasProyectadas.toFixed(1), base: baseline.sales },
                        { label: 'Cash', value: fmt(cashProyectado), base: baseline.cash, isCurrency: true, raw: cashProyectado },
                        { label: 'ROAS', value: `${roasProyectado.toFixed(1)}x`, base: baseline.roas, raw: roasProyectado },
                        { label: 'CAC', value: fmt(cacProyectado), base: baseline.cac, raw: cacProyectado, invert: true },
                    ].map((k) => {
                        const rawVal = k.raw !== undefined ? k.raw : parseFloat(k.value);
                        const d = deltaPct(rawVal, k.base);
                        const good = k.invert ? d <= 0 : d >= 0;
                        return (
                            <div key={k.label} className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-400">{k.label}</span>
                                <div className="text-right">
                                    <div className="text-lg font-black text-white italic">{k.value}</div>
                                    <div className={`text-[10px] font-black ${good ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {d >= 0 ? '+' : ''}{d.toFixed(1)}% vs prom.
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Orden de trabajo */}
                <div className="bg-slate-900/30 border border-slate-900 rounded-[2.5rem] p-6 space-y-3">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Orden de trabajo</h3>
                    <p className="text-[10px] text-slate-600 font-semibold">Mayor impacto primero</p>
                    <div className="space-y-2">
                        {fugas.filter((f) => f.estado !== 'ok').slice(0, 5).map((f, i) => (
                            <div key={f.key} className="flex items-center gap-3 py-2 border-t border-slate-900 first:border-t-0">
                                <span className="w-5 h-5 shrink-0 rounded-lg bg-slate-800 text-[10px] font-black text-slate-300 flex items-center justify-center">{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{f.label}</p>
                                    <p className="text-[10px] text-slate-500 font-semibold">{f.real}% → {f.meta}%</p>
                                </div>
                                <span className="text-xs font-black text-emerald-400 shrink-0">+{f.impactoVentas.toFixed(1)}</span>
                            </div>
                        ))}
                        {fugas.every((f) => f.estado === 'ok') && (
                            <p className="text-xs font-bold text-emerald-400 py-4 text-center">Ya en meta — sostener 🎯</p>
                        )}
                    </div>
                </div>

                <p className="text-[9px] text-slate-600 font-semibold leading-relaxed px-1">
                    Modelo lineal: los puntos porcentuales se suman por palanca con techo de 95%. Sirve para priorizar; no es una predicción.
                </p>
            </div>
        </div>
    );
};

export default WorkshopSimuladorView;
