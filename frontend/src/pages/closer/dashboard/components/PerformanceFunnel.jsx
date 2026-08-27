import React from 'react';
import Card from '../../../../components/ui/Card';
import MetricTip from './MetricTip';
import { tip } from '../metricSources';
import { CashMixCard } from './PerformanceMoney';

const FUNNEL_COLORS = ['#6366F1', '#7C5CE0', '#9B4FD8', '#C441C8', '#E639B0', '#FF3FA4'];
const FUNNEL_METRICS = ['funnel_slots', 'funnel_agendas', 'funnel_confirmadas', 'funnel_asistencias', 'funnel_presentaciones', 'funnel_ventas'];

/* Confirmaciones del período vs. de agendas posteriores: solo las primeras son un paso de este
   embudo. Las próximas son pipeline hacia adelante — mezclarlas infla el confirmation rate con
   trabajo que todavía no se llamó. Exportada (no vive más en este archivo por su cuenta) porque,
   en el reordenamiento del 27/ago/2026, pasa a mostrarse en "03 · Calidad de la llamada" junto a
   Confirmation rate — acá en el embudo quedaba desconectada de las otras tasas de conversión. */
export const ConfirmacionesCard = ({ confirmaciones }) => (
    <Card variant="surface" padding="p-6">
        <h3 className="text-xs font-black uppercase tracking-widest text-base flex items-center gap-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Confirmaciones
            <MetricTip iconOnly title="Confirmaciones: del período vs. próximas" source="agendas"
                note="Las del período y las de agendas que todavía no llegaron son dos cosas distintas. El paso «Confirmadas» del embudo usa solo las del período — las próximas no entran, su llamada todavía no pasó." />
        </h3>
        <div className="grid grid-cols-2 gap-3">
            <div className="bg-main/60 border border-base rounded-2xl px-4 py-3.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted">De este período</p>
                <p className="text-2xl font-black tracking-tighter mt-1 text-emerald-400">{confirmaciones.del_periodo}</p>
                <p className="text-[10px] text-muted mt-0.5 leading-tight">
                    de {confirmaciones.agendas_periodo} agendas · {confirmaciones.rate_periodo}%
                </p>
            </div>
            <div className="bg-main/60 border border-base rounded-2xl px-4 py-3.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted">Próximas agendas</p>
                <p className="text-2xl font-black tracking-tighter mt-1 text-teal-400">{confirmaciones.proximas}</p>
                <p className="text-[10px] text-muted mt-0.5 leading-tight">
                    de {confirmaciones.agendas_proximas} por venir · {confirmaciones.rate_proximas}%
                </p>
            </div>
        </div>
    </Card>
);

const PerformanceFunnel = ({ funnel, perdidas, coverage, cashMix }) => {
    const { labels, values } = funnel;
    const max = values[0] || 1;

    let worst = { idx: 1, rate: 100 };
    const rows = values.map((v, i) => {
        const width = Math.max(6, Math.round((v / max) * 100));
        const conv = i ? (values[i - 1] ? Math.round((v / values[i - 1]) * 100) : 0) : null;
        if (i && conv !== null && conv < worst.rate) worst = { idx: i, rate: conv };
        return { label: labels[i], v, width, conv, metric: FUNNEL_METRICS[i] };
    });

    const losses = [
        { name: 'No show', icon: '😶', metric: 'perdida_no_show', ...perdidas.no_show, color: '#EF4444' },
        { name: 'Cancelaciones', icon: '🚫', metric: 'perdida_cancelaciones', ...perdidas.cancelaciones, color: '#F59E0B' },
        { name: 'Reprogramaciones', icon: '🔁', metric: 'perdida_reprogramaciones', ...perdidas.reprogramaciones, color: '#60A5FA' }
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-4 items-start">
            <Card variant="surface" padding="p-6">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-base flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary" /> Embudo completo
                        <MetricTip iconOnly title="Cómo se arma el embudo" source="derivado"
                            note="Conversión de cada paso respecto al anterior. «Ventas» cuenta solo PIF y Split Pay. Slots, agendas, asistencias y presentaciones salen de los reportes diarios; confirmadas y ventas, de las agendas y del registro financiero." />
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        {worst.idx && worst.rate < 55 && (
                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg border cursor-help ${worst.rate < 40 ? 'text-rose-400 border-rose-500/30 bg-rose-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'}`}
                                title={`Solo ${worst.rate}% de ${labels[worst.idx - 1]?.toLowerCase()} llega a ${labels[worst.idx]?.toLowerCase()}.`}>
                                {worst.rate < 40 ? '🩸' : '⚠️'} más flojo: {labels[worst.idx]}
                            </span>
                        )}
                        {coverage && (
                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${coverage.faltantes > 0 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'}`}>
                                {coverage.dias_con_reporte}/{coverage.dias_esperados} reportes ({coverage.pct}%)
                            </span>
                        )}
                    </div>
                </div>
                <div className="space-y-2">
                    {rows.map((r, i) => (
                        <div key={r.label} className="flex items-center gap-3">
                            <div className="w-32 shrink-0 text-[11px] font-bold text-muted flex items-center gap-1.5">
                                <span className="truncate">{r.label}</span>
                                <MetricTip iconOnly {...tip(r.metric)} />
                            </div>
                            <div className="flex-1 h-8 rounded-lg bg-main border border-base overflow-hidden relative">
                                <div
                                    className="h-full flex items-center pl-3 text-[12px] font-black text-white rounded-lg transition-all"
                                    style={{ width: `${r.width}%`, background: FUNNEL_COLORS[i] }}
                                >
                                    {r.v}
                                </div>
                            </div>
                            <div className={`w-12 text-right text-[11px] font-black ${r.conv === null ? 'text-muted' : r.conv > 100 ? 'text-amber-400' : r.conv < 50 ? 'text-rose-400' : r.conv < 70 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {r.conv === null ? '—' : `${r.conv}%`}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <div className="space-y-4">
                <Card variant="surface" padding="p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-base flex items-center gap-2 mb-5">
                    <span className="w-2 h-2 rounded-full bg-secondary" /> Pérdidas de agenda
                </h3>
                <div className="space-y-3">
                    {losses.map(l => (
                        <div key={l.name} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg grid place-items-center text-sm shrink-0" style={{ background: `${l.color}22`, border: `1px solid ${l.color}55` }}>
                                {l.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <b className="text-[13px] flex items-center gap-1.5">
                                    {l.name}
                                    <MetricTip iconOnly {...tip(l.metric)} />
                                </b>
                                <div className="h-1.5 rounded-full bg-surface-hover mt-1 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, l.rate * 2.5)}%`, background: l.color }} />
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <b className="text-base font-black block" style={{ color: l.color }}>{l.rate}%</b>
                                <span className="text-[10px] text-muted">{l.count} de {values[1] || 0}</span>
                            </div>
                        </div>
                    ))}
                </div>
                </Card>

                {cashMix && <CashMixCard cashMix={cashMix} />}
            </div>
        </div>
    );
};

export default PerformanceFunnel;
