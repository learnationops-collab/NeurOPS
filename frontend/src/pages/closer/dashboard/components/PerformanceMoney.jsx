import React from 'react';
import Card from '../../../../components/ui/Card';
import { money } from '../performanceUtils';

const CASH_KEYS = [
    { key: 'nuevas_ventas', label: 'Nuevas ventas', color: '#FF3FA4' },
    { key: 'cobro_cuotas', label: 'Cobro de cuotas', color: '#6366F1' },
    { key: 'depositos', label: 'Depósitos / reservas', color: '#F59E0B' },
    { key: 'upsell_renovacion', label: 'Upsell + renovación', color: '#22C55E' }
];

const PerformanceMoney = ({ cashMix, cuotas, programas }) => {
    const total = Object.values(cashMix).reduce((a, b) => a + b, 0) || 1;
    const pmax = Math.max(1, ...programas.map(p => p.count));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card variant="surface" padding="p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-base flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" /> Composición del cash
                </h3>
                <p className="text-[11px] text-muted mt-1 mb-5">De dónde vino la plata que efectivamente entró.</p>
                <div className="space-y-3.5">
                    {CASH_KEYS.map(k => {
                        const v = cashMix[k.key] || 0;
                        const q = Math.round((v / total) * 100);
                        return (
                            <div key={k.key}>
                                <div className="flex justify-between text-[12.5px] font-semibold">
                                    <span>{k.label}</span>
                                    <span><b>{money(v)}</b> <span className="text-muted text-[11px]">{q}%</span></span>
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
                <p className="text-[11px] text-muted mt-1 mb-5">Saldo pendiente histórico según el plan de cuotas de cada cliente (no filtrado por período).</p>
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {cuotas.rows.length > 0 ? cuotas.rows.map((c, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-base/60 last:border-0">
                            <div className="min-w-0">
                                <b className="text-[12px] block truncate">{c.client_name}</b>
                                <span className="text-[10px] text-muted">{c.program}</span>
                            </div>
                            <b className="text-[12.5px] shrink-0 ml-2">{money(c.pending_amount)}</b>
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
