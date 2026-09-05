import React, { useMemo, useState, useEffect } from 'react';
import { Loader2, Zap } from 'lucide-react';
import InfoTooltip from '../../../../components/ui/InfoTooltip';
import WorkshopSourceSplit from './WorkshopSourceSplit';

// Texto relativo tipo "hace 2 min" para `synced_at`. Se recalcula cada 30s
// (no solo cuando cambian los props) para que no se quede pegado en "hace 5s"
// mientras el usuario sigue mirando la misma pestaña.
function useRelativeTime(iso) {
    const [, forceTick] = useState(0);
    useEffect(() => {
        if (!iso) return;
        const id = setInterval(() => forceTick((n) => n + 1), 30000);
        return () => clearInterval(id);
    }, [iso]);
    if (!iso) return null;
    const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (diffSec < 45) return 'hace un momento';
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `hace ${diffH} h`;
    return `hace ${Math.round(diffH / 24)} d`;
}

const WorkshopFunnelView = ({
    events,
    selectedEvent,
    onSelectEvent,
    onResync,
    resyncing,
    formatDate,
    formatCurrency,
    desglose,
    ventana,
    cargandoDesglose
}) => {
    const activeFunnelData = useMemo(() => {
        if (!selectedEvent) return [];
        const e = selectedEvent;
        const leads = e.leads || 0;

        const pct = (val) => leads > 0 ? ((val / leads) * 100).toFixed(1) + '%' : '0%';

        return [
            { label: 'Leads captados', value: leads, rate: '100%', detail: 'Base del embudo — prospectos registrados',
              ayuda: 'Cuánta gente se anotó al workshop. Es la base contra la que se comparan todos los pasos de abajo: los porcentajes son "de cada 100 anotados, cuántos llegaron hasta acá".' },
            { label: 'Leads en WhatsApp', value: e.whatsapp_leads, rate: pct(e.whatsapp_leads), sub: 'Entrada WA', detail: 'Leads que ingresaron al grupo de WhatsApp',
              ayuda: 'De los anotados, cuántos entraron al grupo de WhatsApp donde se mandan los recordatorios. Si este número es bajo, mucha gente ni se entera de que la clase empieza.' },
            { label: 'Asistencia webinar (show up)', value: e.show_up, rate: pct(e.show_up), sub: 'Show up webinar', detail: 'Conectados en vivo al webinar',
              ayuda: 'Cuántos se conectaron a la clase en vivo. Un show up bajo casi siempre es problema de recordatorios o del horario, no del contenido.' },
            { label: 'Leads en pitch', value: e.pitch_leads, rate: pct(e.pitch_leads), sub: 'Retención clase', detail: 'Permanecieron hasta la presentación del pitch',
              ayuda: 'Cuántos seguían conectados cuando arrancó la parte de la oferta. Mide si la clase los mantuvo enganchados hasta el final.' },
            { label: 'Final de pitch', value: e.pitch_final_leads, rate: pct(e.pitch_final_leads), sub: 'Retención pitch', detail: 'Presenciaron la oferta completa',
              ayuda: 'Cuántos se quedaron hasta que terminó la oferta. Si cae fuerte respecto del paso anterior, la oferta está perdiendo gente mientras se presenta.' },
            { label: 'Aplicaciones form (Calendly)', value: e.aplicaciones_form, rate: pct(e.aplicaciones_form), sub: 'Tasa aplicación', detail: 'Completaron formulario de calificación',
              ayuda: 'Cuántos llenaron el formulario para pedir una llamada. Incluye los que lo llenaron desde la clase en vivo y los que lo llenaron viendo la grabación.' },
            { label: 'Agendas exitosas', value: e.agendas_exitosas, rate: pct(e.agendas_exitosas), sub: 'Aplicación a cita', detail: 'Agendaron sesión uno a uno con closer',
              ayuda: 'Cuántas llamadas de venta quedaron efectivamente agendadas. Suma la clase en vivo y la grabación: el detalle de cada una está más abajo.' },
            { label: 'Asistencia cita (show up)', value: e.show_up_sales_call, rate: pct(e.show_up_sales_call), sub: 'Show up en cita', detail: 'Asistieron a la llamada de ventas',
              ayuda: 'De las llamadas agendadas, a cuántas la persona realmente se presentó. La diferencia con el paso anterior son los "no show".' },
            { label: 'Ventas cerradas (compradores)', value: e.sales, rate: pct(e.sales), sub: 'Tasa de cierre global', detail: 'Leads compradores únicos (Seña, Split Pay o Completo).',
              ayuda: 'Personas distintas que compraron, no cantidad de pagos: si alguien paga en dos partes cuenta una sola vez. Solo cuentan Seña, Split Pay y pago Completo — cuotas, renovaciones y upsells quedan afuera.' }
        ];
    }, [selectedEvent]);

    const profit = selectedEvent ? selectedEvent.cash_collected - selectedEvent.inversion : 0;
    const cac = selectedEvent && selectedEvent.sales > 0 ? selectedEvent.inversion / selectedEvent.sales : 0;
    const leadsBase = selectedEvent?.leads || 0;
    const syncedLabel = useRelativeTime(selectedEvent?.synced_at);

    return (
        <>
            <section className="detail-grid">
                <article className="panel funnel-panel">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">{formatDate(selectedEvent?.date)}</p>
                            <h2>{selectedEvent?.name}</h2>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                <button type="button" className="secondary-action" onClick={onResync} disabled={resyncing} title="Forzar un resync manual ahora mismo (las agendas y ventas nuevas ya se sincronizan solas)">
                                    {resyncing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                                    {resyncing ? 'Sincronizando…' : 'Resync sistema'}
                                </button>
                                {syncedLabel && (
                                    <span className="sync-status" title="Las agendas y ventas nuevas actualizan este evento solas, sin recargar la página">
                                        <span className="live-dot" style={{ width: 5, height: 5 }} /> Sincronizado {syncedLabel}
                                    </span>
                                )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <strong style={{ display: 'block', fontSize: 22, color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>
                                    {selectedEvent && `${selectedEvent.roas.toFixed(2)}x`}
                                </strong>
                                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>ROAS</span>
                            </div>
                        </div>
                    </div>

                    {selectedEvent && (
                        <div className="economy-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                            <div><span>Inversión</span><strong>{formatCurrency(selectedEvent.inversion)}</strong></div>
                            <div><span>Recaudado</span><strong>{formatCurrency(selectedEvent.cash_collected)}</strong></div>
                            <div><span>Profit neto</span><strong className={profit < 0 ? 'negative' : ''}>{formatCurrency(profit)}</strong></div>
                            <div><span>CAC real</span><strong>{formatCurrency(cac)}</strong></div>
                        </div>
                    )}

                    <div className="funnel-list">
                        {activeFunnelData.map((step, idx) => {
                            const prev = activeFunnelData[idx - 1];
                            const pctFromPrev = idx > 0 && prev?.value > 0 ? (step.value / prev.value) * 100 : null;
                            const share = leadsBase ? (step.value / leadsBase) * 100 : 0;
                            const width = leadsBase ? 14 + 86 * Math.sqrt(Math.max(0, step.value) / leadsBase) : 14;
                            return (
                                <React.Fragment key={step.label}>
                                    {idx > 0 && (
                                        <div className="rate-pill green">
                                            <strong>{pctFromPrev !== null ? `${pctFromPrev.toFixed(1)}%` : '—'}</strong>
                                            <span>{step.sub || step.label}</span>
                                            <small>{step.value} de {prev.value}</small>
                                        </div>
                                    )}
                                    <div className="funnel-stage">
                                        <span className="stage-index">{idx + 1}</span>
                                        <div>
                                            <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                {step.label}
                                                {step.ayuda && <InfoTooltip label={step.label} text={step.ayuda} />}
                                            </strong>
                                            <small>{step.detail}</small>
                                        </div>
                                        <div className="stage-bar" role="img" aria-label={`${step.label}: ${step.value}, ${share.toFixed(1)}% del total`}>
                                            <i style={{ width: `${width}%` }}><b>{step.value.toLocaleString()}</b></i>
                                        </div>
                                        <span className="stage-share">{share.toFixed(1)}%<small>del total</small></span>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </article>

                <aside className="detail-sidebar">
                    <article className="panel event-selector">
                        <p className="eyebrow">Cambiar de taller</p>
                        <div className="event-selector-list">
                            {events.map((e) => (
                                <button
                                    type="button"
                                    key={e.id}
                                    className={selectedEvent?.id === e.id ? 'active' : ''}
                                    onClick={() => onSelectEvent(e)}
                                >
                                    <span>{formatDate(e.date)} · {e.name}</span>
                                    <strong>{e.roas.toFixed(2)}x</strong>
                                </button>
                            ))}
                        </div>
                    </article>
                </aside>
            </section>

            {/* Cuánto aportó la clase en vivo y cuánto la grabación */}
            <WorkshopSourceSplit
                desglose={desglose}
                ventana={ventana}
                cargando={cargandoDesglose}
                formatCurrency={formatCurrency}
            />
        </>
    );
};

export default WorkshopFunnelView;
