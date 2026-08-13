import React from 'react';
import Card from '../../../../components/ui/Card';
import DeltaBadge from './DeltaBadge';
import { money, pct } from '../performanceUtils';

const KpiCard = ({ label, value, hero, sm, current, previous, invert, note, warning }) => (
    <Card
        variant="surface"
        padding={sm ? 'p-5' : 'p-6'}
        className={warning ? 'border-amber-500/40 bg-amber-500/5' : hero ? 'border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/5' : ''}
    >
        <p className="text-[9px] font-black uppercase tracking-widest text-muted">{label}</p>
        <p className={`font-black tracking-tighter mt-2 ${sm ? 'text-2xl' : 'text-3xl'} ${warning ? 'text-amber-400' : hero ? 'text-primary' : 'text-base'}`}>{value}</p>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
            {previous !== undefined && <DeltaBadge current={current} previous={previous} invert={invert} />}
            {note && <span className="text-[10px] font-bold text-muted">{note}</span>}
        </div>
        {warning && <p className="text-[10px] font-bold text-amber-400/90 mt-2 leading-snug">⚠️ {warning}</p>}
    </Card>
);

const PerformanceKpis = ({ current, previous, deuda, coverage }) => {
    const k = current.kpis;
    const pk = previous?.kpis;

    // Un close rate por encima del 100% no es un error de cálculo: las ventas se leen del
    // registro financiero de todo el período y las presentaciones/asistencias solo de los
    // reportes diarios enviados, así que un día sin reporte baja el denominador y no el
    // numerador. Se marca en la propia tarjeta para que no se lea como un dato real.
    const faltantes = coverage?.faltantes || 0;
    const gapNote = faltantes > 0
        ? `Faltan ${faltantes} reporte(s) diario(s) en el período: las ventas cuentan todo el período, las presentaciones solo los días reportados.`
        : 'Hay más ventas registradas que presentaciones reportadas en el período.';

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard hero label="Cash collected" value={money(k.cash_collected)} current={k.cash_collected} previous={pk?.cash_collected} />
                <KpiCard label="Ventas cerradas" value={k.ventas} current={k.ventas} previous={pk?.ventas} note="solo PIF + Split Pay" />
                <KpiCard label="Ticket promedio" value={money(k.ticket_promedio)} current={k.ticket_promedio} previous={pk?.ticket_promedio} note="solo PIF + Split Pay" />
                <KpiCard label="Deuda total pendiente" value={money(deuda)} note="saldo histórico, no filtrado por período" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard sm label="Close rate s/ llamada" value={pct(k.close_rate_llamada)} current={k.close_rate_llamada} previous={pk?.close_rate_llamada}
                    note={`${k.ventas} ventas`} warning={k.close_rate_llamada > 100 ? gapNote : null} />
                <KpiCard sm label="Close rate s/ presentación" value={pct(k.close_rate_presentacion)} current={k.close_rate_presentacion} previous={pk?.close_rate_presentacion}
                    warning={k.close_rate_presentacion > 100 ? gapNote : null} />
                <KpiCard sm label="Seguimientos hechos" value={k.seguimientos_hechos} current={k.seguimientos_hechos} previous={pk?.seguimientos_hechos}
                    note={`${k.seguimientos_hechos ? Math.round(k.seguimientos_respondidos / k.seguimientos_hechos * 100) : 0}% de respuesta`} />
                <KpiCard sm label="Seguimientos respondidos" value={k.seguimientos_respondidos} current={k.seguimientos_respondidos} previous={pk?.seguimientos_respondidos} />
            </div>
        </div>
    );
};

export default PerformanceKpis;
