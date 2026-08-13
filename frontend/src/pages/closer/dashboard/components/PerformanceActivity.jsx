import React from 'react';
import Card from '../../../../components/ui/Card';
import MetricTip from './MetricTip';
import { tip } from '../metricSources';

const PerformanceActivity = ({ fuente, actividad, referidos, reportsProductivity }) => {
    const fu = actividad.follow_ups;
    const rec = actividad.recoveries;
    const fuRate = fu.sent ? Math.round((fu.replied / fu.sent) * 100) : 0;
    const recRate = rec.contacted ? Math.round((rec.replied / rec.contacted) * 100) : 0;

    return (
        <div className="space-y-4">
            <Card variant="surface" padding="p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-base flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" /> Performance por fuente
                    <MetricTip iconOnly {...tip('fuente_agendas')} />
                </h3>
                <p className="text-[11px] text-muted mt-1 mb-5">Agendas y show rate reales agrupados por origen (aproximado, sin cruce de ventas por fuente).</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-[12.5px]">
                        <thead>
                            <tr className="text-[8.5px] font-black uppercase tracking-widest text-muted border-b border-base">
                                <th className="text-left py-2">Fuente</th>
                                <th className="text-right py-2">Agendas</th>
                                <th className="text-right py-2">Asistencias</th>
                                <th className="text-right py-2">Show rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fuente.map(f => (
                                <tr key={f.name} className="border-b border-base/50 last:border-0">
                                    <td className="py-2.5"><b>{f.name}</b></td>
                                    <td className="py-2.5 text-right">{f.agendas}</td>
                                    <td className="py-2.5 text-right">{f.asistencias}</td>
                                    <td className="py-2.5 text-right">
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${f.show_rate >= 55 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : f.show_rate >= 40 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                            {f.show_rate}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {fuente.length === 0 && (
                                <tr><td colSpan={4} className="text-center py-6 text-muted">Sin agendas en el período</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card variant="surface" padding="p-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-base mb-4 flex items-center gap-2">Seguimientos <MetricTip iconOnly {...tip('seguimientos_hechos')} /></h3>
                    <div className="flex justify-between text-[12.5px] font-semibold mb-1">
                        <span>Hechos / contestados</span><span><b>{fu.sent}</b> / {fu.replied}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden mb-4">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${fuRate}%` }} />
                    </div>
                    <div className="flex justify-between text-[12.5px] font-semibold mb-1">
                        <span>Recuperación · contactados / respondidos</span><span><b>{rec.contacted}</b> / {rec.replied}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
                        <div className="h-full rounded-full bg-secondary" style={{ width: `${recRate}%` }} />
                    </div>
                </Card>

                <Card variant="surface" padding="p-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-base mb-4 flex items-center gap-2">Disciplina de reportes <MetricTip iconOnly {...tip('disciplina_reportes')} /></h3>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-black text-base">{reportsProductivity.al_dia_pct}%</span>
                        <span className="text-[11px] text-muted mb-1">al día ({reportsProductivity.al_dia_count}/{reportsProductivity.total_closers})</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden mt-3">
                        <div className={`h-full rounded-full ${reportsProductivity.al_dia_pct >= 80 ? 'bg-emerald-500' : reportsProductivity.al_dia_pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${reportsProductivity.al_dia_pct}%` }} />
                    </div>
                    <p className="text-[10.5px] text-muted mt-3">{reportsProductivity.vencidos_count} closer(s) con reportes atrasados.</p>
                </Card>

                <Card variant="surface" padding="p-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-base mb-4 flex items-center gap-2">Referidos <MetricTip iconOnly {...tip('referidos')} /></h3>
                    <p className="text-[10.5px] text-muted mb-3">Solo los 2 contadores agregados que existen hoy en el reporte diario (no hay embudo detallado ni atribución por lead).</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-main/60 border border-base rounded-xl p-3 text-center">
                            <div className="text-2xl font-black text-base">{referidos.sourced}</div>
                            <div className="text-[9px] font-black uppercase tracking-wider text-muted mt-1">Conseguidos</div>
                        </div>
                        <div className="bg-main/60 border border-base rounded-xl p-3 text-center">
                            <div className="text-2xl font-black text-base">{referidos.scheduled}</div>
                            <div className="text-[9px] font-black uppercase tracking-wider text-muted mt-1">Agendados</div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default PerformanceActivity;
