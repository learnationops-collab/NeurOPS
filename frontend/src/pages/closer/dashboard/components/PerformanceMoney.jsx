import React from 'react';
import Card from '../../../../components/ui/Card';
import { money } from '../performanceUtils';

const CASH_KEYS = [
    { key: 'nuevas_ventas', label: 'Nuevas ventas', note: 'PIF + Split Pay', color: '#FF3FA4' },
    { key: 'cobro_cuotas', label: 'Cobro de cuotas', note: 'de ventas ya cerradas', color: '#6366F1' },
    { key: 'senas', label: 'Señas', note: 'reservas, todavía no son venta', color: '#F59E0B' },
    { key: 'upsell_renovacion', label: 'Upsell + renovación', note: 'clientes que ya habían comprado', color: '#22C55E' },
    { key: 'otros', label: 'Sin clasificar', note: 'tipo de pago no reconocido', color: '#94A3B8' }
];

const PerformanceMoney = ({ cashMix, cuotas, programas }) => {
    const total = Object.values(cashMix).reduce((a, b) => a + (b?.cash || 0), 0) || 1;
    const pmax = Math.max(1, ...programas.map(p => p.count));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card variant="surface" padding="p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-base flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" /> Composición del cash
                </h3>
                <p className="text-[11px] text-muted mt-1 mb-5">De dónde vino la plata que efectivamente entró, y con cuántos pagos.</p>
                <div className="space-y-3.5">
                    {CASH_KEYS.map(k => {
                        const bucket = cashMix[k.key] || { cash: 0, count: 0 };
                        const v = bucket.cash || 0;
                        const n = bucket.count || 0;
                        const q = Math.round((v / total) * 100);
                        if (!v && !n && k.key === 'otros') return null;
                        return (
                            <div key={k.key}>
                                <div className="flex justify-between text-[12.5px] font-semibold gap-2">
                                    <span className="min-w-0">
                                        {k.label}
                                        <span className="block text-[10px] font-normal text-muted leading-tight">{k.note}</span>
                                    </span>
                                    <span className="text-right shrink-0">
                                        <b>{money(v)}</b> <span className="text-muted text-[11px]">{q}%</span>
                                        <span className="block text-[10px] font-bold text-muted leading-tight">{n} pago{n === 1 ? '' : 's'}</span>
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-surface-hover mt-1.5 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${q}%`, background: k.color }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between text-[13px] font-black border-t border-base mt-4 pt-3">
                    <span>Cash total</span><span>{money(total)}</span>
                </div>
            </Card>

            <Card variant="surface" padding="p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-base flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-secondary" /> Cuotas por cobrar
                </h3>
                <p className="text-[11px] text-muted mt-1 mb-4">Saldo pendiente histórico según el plan de cuotas de cada cliente (no filtrado por período).</p>
                {/* Vencido vs. por vencer: un total alto puede ser un plan recién firmado con todo
                    su cronograma a futuro (normal) o plata que había que cobrar y no se cobró. */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className={`rounded-xl px-3 py-2.5 border ${cuotas.vencido > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-main/60 border-base'}`}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted">Vencido</p>
                        <b className={`text-lg font-black block ${cuotas.vencido > 0 ? 'text-rose-400' : 'text-base'}`}>{money(cuotas.vencido)}</b>
                        <span className="text-[10px] text-muted">{cuotas.count_vencido} cuota{cuotas.count_vencido === 1 ? '' : 's'}</span>
                    </div>
                    <div className="rounded-xl px-3 py-2.5 border bg-main/60 border-base">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted">Por vencer</p>
                        <b className="text-lg font-black block">{money(cuotas.por_vencer)}</b>
                        <span className="text-[10px] text-muted">{cuotas.count - cuotas.count_vencido} cuota{cuotas.count - cuotas.count_vencido === 1 ? '' : 's'}</span>
                    </div>
                </div>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {cuotas.rows.length > 0 ? cuotas.rows.map((c, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-base/60 last:border-0">
                            <div className="min-w-0">
                                <b className="text-[12px] block truncate">{c.client_name}</b>
                                <span className="text-[10px] text-muted">{c.program}</span>
                            </div>
                            <div className="shrink-0 ml-2 text-right">
                                <b className="text-[12.5px] block">{money(c.pending_amount)}</b>
                                <span className={`text-[10px] ${c.is_overdue ? 'text-rose-400 font-bold' : 'text-muted'}`}>
                                    {c.is_overdue ? `vencida hace ${c.days_overdue}d` : c.due_date ? `vence ${c.due_date}` : 'sin fecha'}
                                </span>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-8 text-[11px] text-muted">Sin cuotas pendientes</div>
                    )}
                </div>
                <div className="flex justify-between text-[13px] font-black border-t border-base mt-3 pt-3">
                    <span>Total pendiente</span><span>{money(cuotas.total)}</span>
                </div>
            </Card>

            <Card variant="surface" padding="p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-base flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" /> Programas vendidos
                </h3>
                <p className="text-[11px] text-muted mt-1 mb-5">Unidades y ticket promedio por programa.</p>
                <div className="space-y-3.5">
                    {programas.length > 0 ? programas.map((p, i) => (
                        <div key={p.program}>
                            <div className="flex justify-between text-[12.5px] font-semibold">
                                <span>{p.program}</span>
                                <span><b>{p.count}</b> <span className="text-muted text-[11px]">· {money(p.average_ticket)} prom.</span></span>
                            </div>
                            <div className="h-1.5 rounded-full bg-surface-hover mt-1.5 overflow-hidden">
                                <div className="h-full rounded-full bg-secondary" style={{ width: `${Math.round((p.count / pmax) * 100)}%` }} />
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-8 text-[11px] text-muted">Sin ventas en el período</div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default PerformanceMoney;
