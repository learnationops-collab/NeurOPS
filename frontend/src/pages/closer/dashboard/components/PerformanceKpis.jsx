import React from 'react';
import Card from '../../../../components/ui/Card';
import DeltaBadge from './DeltaBadge';
import MetricTip from './MetricTip';
import { money } from '../performanceUtils';
import { tip } from '../metricSources';

const KpiCard = ({ label, value, hero, sm, current, previous, invert, note, warning, metric }) => (
    <Card
        variant="surface"
        padding={sm ? 'p-5' : 'p-6'}
        className={warning ? 'border-amber-500/40 bg-amber-500/5' : hero ? 'border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/5' : ''}
    >
        <div className="flex items-start justify-between gap-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted">{label}</p>
            {metric && <MetricTip iconOnly {...tip(metric)} />}
        </div>
        <p className={`font-black tracking-tighter mt-2 ${sm ? 'text-2xl' : 'text-3xl'} ${warning ? 'text-amber-400' : hero ? 'text-primary' : 'text-base'}`}>{value}</p>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
            {previous !== undefined && <DeltaBadge current={current} previous={previous} invert={invert} />}
            {/* Solo texto corto y accionable queda siempre visible (p. ej. "$X vencidos") — el resto
                de la explicación (qué cuenta, por qué es histórico, etc.) ya vive en el tooltip. */}
            {note && <span className="text-[10px] font-bold text-amber-400">{note}</span>}
        </div>
    </Card>
);

/* Solo los 4 números de dinero: close rates y seguimientos se sacaron de acá (27/ago/2026, calco
   del sectionado del HTML de referencia) porque quedaban duplicados — "Close s/ llamada" y
   "Close s/ presentación" ya se ven con su fracción real y su umbral en PerformanceQuality
   ("03 · Calidad de la llamada"), y "Seguimientos hechos/respondidos" ya está en la tarjeta
   Seguimientos de PerformanceActivity. Mostrarlos acá arriba, sueltos y sin esa fracción, no
   sumaba información nueva. */
const PerformanceKpis = ({ current, previous, deuda }) => {
    const k = current.kpis;
    const pk = previous?.kpis;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard hero metric="cash_collected" label="Cash collected" value={money(k.cash_collected)} current={k.cash_collected} previous={pk?.cash_collected} />
            <KpiCard metric="ventas" label="Ventas cerradas" value={k.ventas} current={k.ventas} previous={pk?.ventas} />
            <KpiCard metric="ticket_promedio" label="Ticket promedio" value={money(k.ticket_promedio)} current={k.ticket_promedio} previous={pk?.ticket_promedio} />
            <KpiCard metric="deuda_total_pendiente" label="Deuda total pendiente" value={money(k.deuda_total_pendiente ?? deuda)}
                note={k.deuda_vencida > 0 ? `${money(k.deuda_vencida)} vencidos` : null}
                warning={k.deuda_vencida > 0} />
        </div>
    );
};

export default PerformanceKpis;
