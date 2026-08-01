import React from 'react';
import Card from '../../../../components/ui/Card';
import DeltaBadge from './DeltaBadge';
import { money, pct } from '../performanceUtils';

const KpiCard = ({ label, value, hero, sm, current, previous, invert, note }) => (
    <Card
        variant="surface"
        padding={sm ? 'p-5' : 'p-6'}
        className={hero ? 'border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/5' : ''}
    >
        <p className="text-[9px] font-black uppercase tracking-widest text-muted">{label}</p>
        <p className={`font-black tracking-tighter mt-2 ${sm ? 'text-2xl' : 'text-3xl'} ${hero ? 'text-primary' : 'text-base'}`}>{value}</p>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
            {previous !== undefined && <DeltaBadge current={current} previous={previous} invert={invert} />}
            {note && <span className="text-[10px] font-bold text-muted">{note}</span>}
        </div>
    </Card>
);

const PerformanceKpis = ({ current, previous, deuda }) => {
    const k = current.kpis;
    const pk = previous?.kpis;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard hero label="Cash collected" value={money(k.cash_collected)} current={k.cash_collected} previous={pk?.cash_collected} />
                <KpiCard label="Ventas cerradas" value={k.ventas} current={k.ventas} previous={pk?.ventas} />
                <KpiCard label="Ticket promedio" value={money(k.ticket_promedio)} current={k.ticket_promedio} previous={pk?.ticket_promedio} />
                <KpiCard label="Deuda total pendiente" value={money(deuda)} note="saldo histórico, no filtrado por período" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard sm label="Close rate s/ llamada" value={pct(k.close_rate_llamada)} current={k.close_rate_llamada} previous={pk?.close_rate_llamada}
                    note={`${k.ventas} ventas`} />
                <KpiCard sm label="Close rate s/ presentación" value={pct(k.close_rate_presentacion)} current={k.close_rate_presentacion} previous={pk?.close_rate_presentacion} />
                <KpiCard sm label="Seguimientos hechos" value={k.seguimientos_hechos} current={k.seguimientos_hechos} previous={pk?.seguimientos_hechos}
                    note={`${k.seguimientos_hechos ? Math.round(k.seguimientos_respondidos / k.seguimientos_hechos * 100) : 0}% de respuesta`} />
                <KpiCard sm label="Seguimientos respondidos" value={k.seguimientos_respondidos} current={k.seguimientos_respondidos} previous={pk?.seguimientos_respondidos} />
            </div>
        </div>
    );
};

export default PerformanceKpis;
