import React from 'react';
import Card from '../../../../components/ui/Card';
import { money } from '../performanceUtils';

const ALERT_STYLES = {
    danger: 'bg-rose-500/10 border-rose-500/30',
    warning: 'bg-amber-500/10 border-amber-500/30',
    info: 'bg-primary/10 border-primary/30',
    success: 'bg-emerald-500/10 border-emerald-500/30'
};

const PerformanceRanking = ({ ranking, selectedCloserId, alerts }) => {
    return (
        <div className="space-y-4">
            <Card variant="surface" padding="p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-base mb-5">Ranking del equipo</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-[12.5px]">
                        <thead>
                            <tr className="text-[8.5px] font-black uppercase tracking-widest text-muted border-b border-base">
                                <th className="text-left py-2 w-10"></th>
                                <th className="text-left py-2">Closer</th>
                                <th className="text-right py-2">Cash</th>
                                <th className="text-right py-2">Ventas</th>
                                <th className="text-right py-2">Show rate</th>
                                <th className="text-right py-2">Close s/ pres.</th>
                                <th className="text-right py-2">Ticket</th>
                                <th className="text-right py-2">Reportes</th>
                                <th className="text-right py-2">Sin enviar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ranking.map((r, i) => (
                                <tr key={r.closer_id} className="border-b border-base/50 last:border-0">
                                    <td className="py-2.5">
                                        <div className={`w-6 h-6 rounded-md grid place-items-center text-[10px] font-black ${i === 0 ? 'bg-gradient-to-br from-primary to-secondary text-white' : 'bg-surface-hover text-muted'}`}>
                                            {i + 1}
                                        </div>
                                    </td>
                                    <td className="py-2.5">
                                        <b>{r.name}</b>
                                        {String(r.closer_id) === String(selectedCloserId) && <span className="text-[9px] text-muted ml-2">seleccionado</span>}
                                    </td>
                                    <td className="py-2.5 text-right font-black">{money(r.cash_collected)}</td>
                                    <td className="py-2.5 text-right">{r.ventas}</td>
                                    <td className="py-2.5 text-right">{r.show_rate}%</td>
                                    <td className="py-2.5 text-right">
                                        <span
                                            title={r.close_rate_presentacion > 100
                                                ? `${r.ventas} ventas sobre ${r.presentaciones} presentaciones reportadas — le faltan ${r.reportes_faltantes} reporte(s) diario(s) en el período`
                                                : `${r.ventas} ventas sobre ${r.presentaciones} presentaciones`}
                                            className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${r.close_rate_presentacion > 100 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : r.close_rate_presentacion >= 40 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                            {r.close_rate_presentacion}%{r.close_rate_presentacion > 100 ? ' ⚠️' : ''}
                                        </span>
                                    </td>
                                    <td className="py-2.5 text-right">{money(r.ticket_promedio)}</td>
                                    <td className="py-2.5 text-right">{r.reports_status}%</td>
                                    <td className={`py-2.5 text-right font-black ${r.reportes_faltantes > 0 ? 'text-amber-400' : 'text-muted'}`}>{r.reportes_faltantes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card variant="surface" padding="p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-base mb-4">Qué mirar esta semana</h3>
                <div className="space-y-2.5">
                    {alerts.length > 0 ? alerts.map((a, i) => (
                        <div key={i} className={`flex gap-3 rounded-xl p-3 border text-[12.5px] ${ALERT_STYLES[a.type] || ALERT_STYLES.info}`}>
                            <span className="text-lg leading-none">{a.icon}</span>
                            <div>
                                <b className="block text-[13px]">{a.title}</b>
                                <p className="text-muted">{a.text}</p>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-6 text-[11px] text-muted">Sin alertas relevantes en este período.</div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default PerformanceRanking;
