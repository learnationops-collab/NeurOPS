import React from 'react';
import { ArrowRight } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import MetricTip from './MetricTip';
import { tip } from '../metricSources';
import { money, qualityItems, computeWeakestQuality, estimateUpside } from '../performanceUtils';

/* "Mirá esto primero", calcada de la referencia (28/ago/2026): antes de los 4 KPIs de dinero, la
   referencia pone 3 tarjetas de una sola cosa accionable — no un dato más, una recomendación con
   un número de plata detrás. El resto del dashboard ya tenía todos estos números sueltos
   (PerformanceQuality ya calcula el eslabón más débil, PerformanceMoney ya muestra "sin plan",
   PerformanceActivity ya muestra seguimientos hechos/contestados) — acá se reusan, no se
   recalculan, para que nunca queden desincronizados entre sí. */

const HighlightCard = ({ hero, eyebrow, value, sub, tone, children, cta, onCta, tipProps }) => (
    <Card
        variant="surface"
        padding="p-6"
        className={hero ? 'border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/5' : ''}
    >
        <div className="flex items-start justify-between gap-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted">{eyebrow}</p>
            {tipProps && <MetricTip iconOnly {...tipProps} />}
        </div>
        <p className={`font-black tracking-tighter mt-2 text-3xl ${tone === 'danger' ? 'text-rose-400' : hero ? 'text-primary' : 'text-base'}`}>{value}</p>
        {sub && <p className="text-[10.5px] text-muted mt-1 leading-tight">{sub}</p>}
        {children}
        {cta && (
            <button
                onClick={onCta}
                className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary hover:text-secondary transition-colors"
            >
                {cta} <ArrowRight size={12} />
            </button>
        )}
    </Card>
);

const PerformanceHighlights = ({ rings, funnel, confirmaciones, cuotas, actividad, ticketPromedio, onNavigate }) => {
    const items = qualityItems(rings, funnel, confirmaciones);
    const weakest = computeWeakestQuality(items);
    const upside = weakest ? estimateUpside(weakest, funnel, rings, ticketPromedio) : null;

    const fu = actividad?.follow_ups;
    const fuRate = fu?.sent ? Math.round((fu.replied / fu.sent) * 100) : null;

    const irA = weakest?.group === 'convertir' ? 'calls' : 'confirmations';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {weakest ? (
                <HighlightCard
                    hero
                    eyebrow="Eslabón más débil"
                    value={`${weakest.value}%`}
                    tipProps={tip(weakest.metric)}
                    cta={onNavigate ? `Ir a ${irA === 'calls' ? 'reportar' : 'confirmar'}` : null}
                    onCta={() => onNavigate?.('inbox', { step: irA })}
                >
                    <p className="text-[11px] font-black uppercase tracking-wider text-muted mt-1">{weakest.label}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[10.5px] text-muted">{weakest.num} de {weakest.den} {weakest.unit}</span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md border text-muted border-base">ref {weakest.benchmarkGood}%</span>
                    </div>
                    {upside > 0 && (
                        <p className="text-[12px] font-bold text-emerald-400 mt-3">
                            Si llegás a la ref: <b className="text-sm">+{money(upside)}</b>
                        </p>
                    )}
                </HighlightCard>
            ) : (
                <HighlightCard eyebrow="Calidad de la llamada" value="Todo por encima de la ref" sub="Ninguna tasa está por debajo de su umbral en este período." />
            )}

            <HighlightCard
                eyebrow="Deuda sin plan"
                value={money(cuotas?.sin_plan)}
                sub={`${cuotas?.count_sin_plan ?? 0} cliente${cuotas?.count_sin_plan === 1 ? '' : 's'} sin cronograma`}
                tone={cuotas?.sin_plan > 0 ? 'danger' : undefined}
                tipProps={tip('deuda_total_pendiente')}
            />

            <HighlightCard
                eyebrow="Respuesta a seguimientos"
                value={fuRate !== null ? `${fuRate}%` : '—'}
                sub={fu ? `${fu.replied} de ${fu.sent} contestó` : 'Sin seguimientos en el período'}
                tipProps={tip('seguimientos_respondidos')}
            />
        </div>
    );
};

export default PerformanceHighlights;
