import React from 'react';
import Card from '../../../../components/ui/Card';

const FUNNEL_COLORS = ['#6366F1', '#7C5CE0', '#9B4FD8', '#C441C8', '#E639B0', '#FF3FA4'];

/* Confirmaciones del período vs. de agendas posteriores: solo las primeras son un paso de este
   embudo. Las próximas son pipeline hacia adelante — mezclarlas infla el confirmation rate con
   trabajo que todavía no se llamó. */
const ConfirmacionesCard = ({ confirmaciones }) => (
    <Card variant="surface" padding="p-6">
        <h3 className="text-xs font-black uppercase tracking-widest text-base flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Confirmaciones
        </h3>
        <p className="text-[11px] text-muted mt-1 mb-5">Las del período y las de agendas que todavía no llegaron son dos cosas distintas.</p>
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
        <p className="text-[10px] text-muted mt-3 leading-snug">
            El paso «Confirmadas» del embudo usa solo las del período. Las próximas no entran: su llamada todavía no pasó.
        </p>
    </Card>
);

const PerformanceFunnel = ({ funnel, perdidas, coverage, confirmaciones }) => {
    const { labels, values } = funnel;
    const max = values[0] || 1;

    let worst = { idx: 1, rate: 100 };
    const rows = values.map((v, i) => {
        const width = Math.max(6, Math.round((v / max) * 100));
        const conv = i ? (values[i - 1] ? Math.round((v / values[i - 1]) * 100) : 0) : null;
        if (i && conv !== null && conv < worst.rate) worst = { idx: i, rate: conv };
        return { label: labels[i], v, width, conv };
    });

    const losses = [
        { name: 'No show', icon: '😶', ...perdidas.no_show, color: '#EF4444' },
        { name: 'Cancelaciones', icon: '🚫', ...perdidas.cancelaciones, color: '#F59E0B' },
        { name: 'Reprogramaciones', icon: '🔁', ...perdidas.reprogramaciones, color: '#60A5FA' }
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-4 items-start">
            <Card variant="surface" padding="p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-base flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" /> Embudo completo
                </h3>
                <p className="text-[11px] text-muted mt-1 mb-1">Conversión de cada paso respecto al paso anterior. «Ventas» cuenta solo PIF y Split Pay.</p>
                <p className="text-[11px] text-muted mb-5">
                    Slots, agendas, asistencias y presentaciones salen de los reportes diarios; las confirmadas y las ventas, de las agendas y del registro financiero.
                    {coverage && (
                        <span className={coverage.faltantes > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                            {' '}{coverage.dias_con_reporte} de {coverage.dias_esperados} reportes enviados ({coverage.pct}%).
                        </span>
                    )}
                </p>
                <div className="space-y-2">
                    {rows.map((r, i) => (
                        <div key={r.label} className="flex items-center gap-3">
                            <div className="w-28 shrink-0 text-[11px] font-bold text-muted">{r.label}</div>
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
                {worst.idx && worst.rate < 55 && (
                    <div className={`mt-5 flex gap-3 rounded-xl p-3 border text-[12px] ${worst.rate < 40 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                        <span>{worst.rate < 40 ? '🩸' : '⚠️'}</span>
                        <div>
                            <b className="block text-[12.5px]">El mayor desperdicio está en «{labels[worst.idx]}»</b>
                            <p className="text-muted">Solo {worst.rate}% de {labels[worst.idx - 1].toLowerCase()} llega a {labels[worst.idx].toLowerCase()}.</p>
                        </div>
                    </div>
                )}
            </Card>

            <div className="space-y-4">
                {confirmaciones && <ConfirmacionesCard confirmaciones={confirmaciones} />}

                <Card variant="surface" padding="p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-base flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-secondary" /> Pérdidas de agenda
                </h3>
                <p className="text-[11px] text-muted mt-1 mb-5">Qué porcentaje de las agendas se pierde y por qué motivo.</p>
                <div className="space-y-3">
                    {losses.map(l => (
                        <div key={l.name} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg grid place-items-center text-sm shrink-0" style={{ background: `${l.color}22`, border: `1px solid ${l.color}55` }}>
                                {l.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <b className="text-[13px] block">{l.name}</b>
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
            </div>
        </div>
    );
};

export default PerformanceFunnel;
