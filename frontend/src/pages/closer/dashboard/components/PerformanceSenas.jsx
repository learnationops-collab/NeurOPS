import React from 'react';
import Card from '../../../../components/ui/Card';
import MetricTip from './MetricTip';
import { money } from '../performanceUtils';
import { tip } from '../metricSources';

/* Las señas no son ventas: son reservas. Esta sección responde dos preguntas distintas —
   con qué frecuencia se consiguen (sobre presentaciones y sobre llamadas asistidas) y en qué
   terminan (pago completo, split, o nada todavía). El seguimiento de conversión mira ventas
   POSTERIORES a la seña del mismo cliente, así que las señas recientes aparecen como pendientes
   hasta que efectivamente paguen. */

const Stat = ({ label, value, note, color, metric }) => (
    <div className="bg-main/60 border border-base rounded-2xl px-4 py-3.5">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted flex items-center justify-between gap-2">
            <span>{label}</span>{metric && <MetricTip iconOnly {...tip(metric)} />}
        </p>
        <p className="text-2xl font-black tracking-tighter mt-1" style={color ? { color } : undefined}>{value}</p>
        {note && <p className="text-[10px] text-muted mt-0.5 leading-tight">{note}</p>}
    </div>
);

const Bar = ({ label, count, rate, note, color, metric }) => (
    <div>
        <div className="flex justify-between text-[12.5px] font-semibold gap-2">
            <span className="min-w-0">
                <span className="inline-flex items-center gap-1.5">{label} {metric && <MetricTip iconOnly {...tip(metric)} />}</span>
                <span className="block text-[10px] font-normal text-muted leading-tight">{note}</span>
            </span>
            <span className="text-right shrink-0"><b>{count}</b> <span className="text-muted text-[11px]">{rate}%</span></span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-hover mt-1.5 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, rate)}%`, background: color }} />
        </div>
    </div>
);

const PerformanceSenas = ({ senas }) => {
    if (!senas) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card variant="surface" padding="p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-base flex items-center gap-2 mb-5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> Cuántas señas se consiguen
                    <MetricTip iconOnly title="Las señas no son ventas" source="derivado"
                        note="Una seña es una reserva, no una venta — por eso no entra en el close rate ni en el ticket promedio." />
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <Stat metric="senas_count" label="Señas del período" value={senas.count} note={`${money(senas.cash)} cobrados`} color="#F59E0B" />
                    <Stat metric="senas_ticket" label="Seña promedio" value={money(senas.ticket_promedio)} note="monto de reserva" />
                    <Stat metric="senas_por_presentacion" label="Por presentación" value={`${senas.por_presentacion}%`} note={`sobre ${senas.presentaciones} presentaciones`} color="#A78BFA" />
                    <Stat metric="senas_por_llamada" label="Por llamada" value={`${senas.por_llamada}%`} note={`sobre ${senas.asistencias} asistencias`} color="#60A5FA" />
                </div>
                <div className="flex justify-between text-[12px] font-bold border-t border-base mt-4 pt-3">
                    <span className="text-muted inline-flex items-center gap-1.5">Close rate con señas (cierres + reservas) <MetricTip iconOnly {...tip('senas_close_promesa')} /></span>
                    <b>{senas.close_rate_promesa}%</b>
                </div>
            </Card>

            <Card variant="surface" padding="p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-base flex items-center gap-2 mb-5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> En qué terminan las señas
                    <MetricTip iconOnly title="Seguimiento de la seña" source="derivado"
                        note={`De las ${senas.seguidas} señas del período, cuántas terminaron en un pago posterior del mismo cliente.`} />
                </h3>
                {senas.seguidas > 0 ? (
                    <>
                        <div className="space-y-3.5">
                            <Bar metric="senas_a_pif" label="Pasaron a pago completo" note="PIF — pagó todo el programa" count={senas.a_pif} rate={senas.a_pif_rate} color="#22C55E" />
                            <Bar metric="senas_a_split" label="Pasaron a Split Pay" note="primer pago, resto en cuotas" count={senas.a_split} rate={senas.a_split_rate} color="#6366F1" />
                            <Bar metric="senas_pendientes" label="Todavía sin pago" note="la reserva no se cerró (o es reciente)" count={senas.pendientes} rate={senas.pendientes_rate} color="#EF4444" />
                        </div>
                        <div className="flex justify-between text-[13px] font-black border-t border-base mt-4 pt-3">
                            <span>Conversión total</span><span>{senas.conversion_total}%</span>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-8 text-[11px] text-muted">Sin señas en el período.</div>
                )}
            </Card>
        </div>
    );
};

export default PerformanceSenas;
