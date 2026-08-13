import React from 'react';
import Card from '../../../../components/ui/Card';
import MetricTip from './MetricTip';
import { tip, rateHealth } from '../metricSources';

/* Calidad de la llamada, leída como la cadena que realmente es: primero hay que LLEGAR a la
   llamada (confirmar → que asista) y después hay que CONVERTIRLA (presentar → cerrar).
   Antes esto eran 6 anillos idénticos en fila, todos del mismo tamaño y sin los números de
   atrás: un 54% y un 0% se veían igual de importantes, no se sabía sobre cuántas llamadas
   estaba calculado ninguno, y no había forma de saber si 54% era bueno o malo. Ahora cada
   métrica muestra su fracción real, su barra contra el umbral de referencia y su estado. */

const HEALTH_CHIP = {
    bien: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    'a mejorar': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    crítico: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    imposible: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
};

const QualityMeter = ({ label, meaning, value, num, den, unit, metric, weakest }) => {
    const t = tip(metric);
    const health = rateHealth(value, t.benchmark);
    const fill = Math.max(2, Math.min(100, value));

    // Nota: `border-base-hover` (usado en el resto del dashboard) mapea a --color-border-hover,
    // que no está definido en el tema, así que ese hover no hace nada. Acá se usa el color de marca.
    return (
        <div className={`relative rounded-2xl border p-4 transition-all ${weakest ? 'border-rose-500/40 bg-rose-500/[0.06]' : 'border-base bg-main/60 hover:border-primary/40'}`}>
            {weakest && (
                <span className="absolute -top-2 left-4 text-[8.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-rose-500 text-white">
                    eslabón más débil
                </span>
            )}
            <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted leading-tight">{label}</p>
                <MetricTip iconOnly {...t} />
            </div>

            <div className="flex items-baseline gap-2 mt-2 flex-wrap">
                <span className={`text-3xl font-black tracking-tighter ${health.text}`}>{value}%</span>
                {health.label && (
                    <span className={`text-[8.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border ${HEALTH_CHIP[health.label]}`}>
                        {health.label}
                    </span>
                )}
            </div>

            {/* La fracción real detrás del porcentaje: un 100% sobre 2 llamadas y uno sobre 40 no
                dicen lo mismo, y hasta ahora el anillo no mostraba ninguno de los dos números. */}
            <p className="text-[10.5px] text-muted mt-0.5">
                {num} de {den} {unit}
            </p>

            <div className="relative h-2 rounded-full bg-surface-hover mt-3 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${fill}%`, background: health.bar }} />
            </div>
            {t.benchmark && (
                <div className="relative h-3">
                    <span
                        className="absolute top-0 -translate-x-1/2 text-[8px] font-bold text-muted whitespace-nowrap"
                        style={{ left: `${Math.min(92, t.benchmark.good)}%` }}
                    >
                        ▲ ref. {t.benchmark.good}%
                    </span>
                </div>
            )}

            <p className="text-[10.5px] text-muted mt-2 leading-snug">{meaning}</p>
        </div>
    );
};

const Group = ({ title, subtitle, accent, children }) => (
    <div>
        <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
            <h4 className="text-[11px] font-black uppercase tracking-widest text-base">{title}</h4>
            <span className="text-[10.5px] text-muted normal-case tracking-normal font-normal">· {subtitle}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{children}</div>
    </div>
);

const PerformanceQuality = ({ rings, funnel, confirmaciones }) => {
    const v = funnel?.values || [];
    const [, agendas = 0, confirmadas = 0, asistencias = 0, presentaciones = 0, ventas = 0] = v;

    const items = [
        {
            metric: 'q_confirmation_rate', label: 'Confirmation rate', value: rings.confirmation_rate,
            num: confirmaciones?.del_periodo ?? confirmadas, den: confirmaciones?.agendas_periodo ?? agendas, unit: 'agendas',
            meaning: 'Cuántas agendas lográs confirmar antes de la llamada.', group: 'llegar'
        },
        {
            metric: 'q_show_rate', label: 'Show rate', value: rings.show_rate,
            num: asistencias, den: agendas, unit: 'agendas',
            meaning: 'Cuántas agendas terminan en una llamada real, confirmadas o no.', group: 'llegar'
        },
        {
            metric: 'q_show_sobre_confirmada', label: 'Show s/ confirmada', value: rings.show_sobre_confirmada,
            num: asistencias, den: confirmadas, unit: 'confirmadas',
            meaning: 'De las que dijeron que sí, cuántas aparecieron. Mide qué tan real es tu confirmación.', group: 'llegar'
        },
        {
            metric: 'q_pitch_rate', label: 'Pitch rate', value: rings.pitch_rate,
            num: presentaciones, den: asistencias, unit: 'asistencias',
            meaning: 'En cuántas llamadas llegás a presentar la oferta.', group: 'convertir'
        },
        {
            metric: 'q_close_llamada', label: 'Close s/ llamada', value: rings.close_llamada,
            num: ventas, den: asistencias, unit: 'asistencias',
            meaning: 'Tu cierre sobre todas las llamadas, hayas presentado o no.', group: 'convertir'
        },
        {
            metric: 'q_close_presentacion', label: 'Close s/ presentación', value: rings.close_presentacion,
            num: ventas, den: presentaciones, unit: 'presentaciones',
            meaning: 'Tu cierre puro: solo las llamadas donde llegaste a presentar.', group: 'convertir'
        }
    ];

    // El eslabón más débil se marca sobre la salud relativa al umbral, no sobre el porcentaje
    // crudo: un 45% de close rate es excelente y un 45% de show rate es un problema, así que
    // compararlos entre sí en bruto marcaría siempre al close como el peor.
    let weakest = null;
    items.forEach(it => {
        const b = tip(it.metric).benchmark;
        if (!b || it.value > 100 || !it.den) return;
        const ratio = it.value / b.good;
        if (!weakest || ratio < weakest.ratio) weakest = { metric: it.metric, ratio, label: it.label, value: it.value };
    });
    if (weakest && weakest.ratio >= 1) weakest = null;

    const render = (group) => items.filter(i => i.group === group).map(it => (
        <QualityMeter key={it.metric} {...it} weakest={weakest?.metric === it.metric} />
    ));

    return (
        <Card variant="surface" padding="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                <p className="text-[11px] text-muted max-w-2xl leading-snug">
                    La llamada es una cadena: primero hay que <b className="text-base">llegar</b> a ella y después
                    hay que <b className="text-base">convertirla</b>. Cada tasa muestra la fracción real que hay detrás
                    del porcentaje — un 100% sobre 2 llamadas no dice lo mismo que uno sobre 40.
                </p>
                {weakest && (
                    <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
                        <span>🩸</span>
                        <span className="text-[11px] font-bold text-rose-300">
                            Lo que más te frena: <b>{weakest.label}</b> en {weakest.value}%
                        </span>
                    </div>
                )}
            </div>

            <div className="space-y-6">
                <Group title="Llegar a la llamada" subtitle="que la agenda se convierta en una conversación" accent="#60A5FA">
                    {render('llegar')}
                </Group>
                <Group title="Convertir la llamada" subtitle="que la conversación se convierta en venta" accent="#FF3FA4">
                    {render('convertir')}
                </Group>
            </div>

            <p className="text-[10px] text-muted mt-5 pt-4 border-t border-base leading-snug">
                El <b className="text-base">▲ ref.</b> de cada barra es el umbral que ya usaban las alertas del sistema para
                marcar una tasa como sana — es una referencia para leer el color, no una meta asignada.
            </p>
        </Card>
    );
};

export default PerformanceQuality;
