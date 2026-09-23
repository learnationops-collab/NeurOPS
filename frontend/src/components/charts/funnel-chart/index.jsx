import { createContext, useContext, useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { NumberTicker } from '@/components/motion/number-ticker';
import { Tooltip } from '@/components/motion/tooltip';
import { EASE_OUT } from '@/lib/ease';
import { cn } from '@/lib/utils';
import { buildFunnel, funnelPath } from './model';
import './funnel-chart.css';

/**
 * Gráfico de embudo (beui.dev/charts/funnel-chart), portado al repo.
 *
 * Dos diferencias con el original, ambas por el entorno y no por gusto:
 *   · el proyecto es JavaScript, no TypeScript, así que se cayeron los tipos;
 *   · las clases de color de shadcn (`text-muted-foreground`, `border-border`, `bg-background`,
 *     `ring-ring`) no existen en este Tailwind, así que el color sale de las variables del
 *     design system vía `funnel-chart.css`. La estructura, los textos y la animación son los
 *     del original.
 *
 * La paleta por defecto es la del componente; cada paso puede traer su propio `color`, que es
 * lo que usa el dashboard comercial para pintar el embudo con la rampa de marca.
 */

const defaultFormat = (value) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });
const percentage = (value) => (value === null || value === undefined ? '—' : `${value.toFixed(1)}%`);
const colors = ['#8b5cf6', '#7774ef', '#548ee4', '#2ca6bc', '#14b8a6'];

const Context = createContext(null);

export function useFunnelChart() {
    const context = useContext(Context);
    if (!context) throw new Error('Funnel chart parts must be inside FunnelChart');
    return context;
}

export function FunnelChart({
    stages,
    direction = 'vertical',
    unit = 'people',
    label = 'Conversion funnel',
    formatValue = defaultFormat,
    className,
    children,
}) {
    const model = useMemo(() => buildFunnel(stages), [stages]);
    const value = useMemo(
        () => ({ ...model, direction, unit, formatValue }),
        [model, direction, unit, formatValue],
    );
    return (
        <Context.Provider value={value}>
            <section aria-label={label} className={cn('fc', className)}>
                {children === undefined ? (
                    <>
                        <FunnelChartPlot />
                        <FunnelChartSummary />
                    </>
                ) : (
                    children
                )}
            </section>
        </Context.Provider>
    );
}

export function FunnelChartPlot({ className }) {
    const { rows, direction, unit, formatValue } = useFunnelChart();
    const reduced = useReducedMotion();

    if (!rows.length) {
        return <p className={cn('fc-vacio', className)}>Sin datos del embudo</p>;
    }

    const horizontal = direction === 'horizontal';
    const proportions = rows.map((stage) => stage.proportion);

    return (
        <div className={cn('fc-plot', className)}>
            <div className="fc-scroll">
                <div
                    className="fc-lienzo"
                    style={{
                        height: horizontal ? 300 : Math.max(320, rows.length * 72),
                        minWidth: horizontal ? rows.length * 110 : 240,
                    }}
                >
                    <svg aria-hidden="true" viewBox="0 0 1000 500" preserveAspectRatio="none" className="fc-svg">
                        {rows.map((stage, index) => (
                            <motion.path
                                key={stage.id}
                                fill={stage.color ?? colors[index % colors.length]}
                                initial={false}
                                // Interpolar el mismo path mantiene unidas las fronteras curvas
                                // de dos bandas contiguas.
                                animate={{ d: funnelPath(proportions, index, direction) }}
                                transition={{ duration: reduced ? 0 : 0.28, ease: EASE_OUT }}
                            />
                        ))}
                    </svg>
                    <ol
                        aria-label="Pasos del embudo"
                        className="fc-pasos"
                        style={
                            horizontal
                                ? { gridTemplateColumns: `repeat(${rows.length}, 1fr)` }
                                : { gridTemplateRows: `repeat(${rows.length}, 1fr)` }
                        }
                    >
                        {rows.map((stage, index) => (
                            <li key={stage.id} className="fc-paso">
                                <Tooltip
                                    wrapperClassName="fc-paso-wrap"
                                    className="fc-tip"
                                    content={
                                        <span className="fc-tip-cuerpo">
                                            <span className="fc-tip-mut">{stage.label}</span>
                                            <NumberTicker
                                                value={stage.value}
                                                format={() => formatValue(stage.value)}
                                                suffix={` ${unit}`}
                                                duration={0.35}
                                                startOnView={false}
                                                className="fc-num"
                                            />
                                            {index > 0 && (
                                                <>
                                                    <span>{percentage(stage.stepConversion)} del paso anterior</span>
                                                    <span className="fc-tip-mut">
                                                        {formatValue(Math.abs(stage.change ?? 0))}{' '}
                                                        {(stage.change ?? 0) > 0 ? 'ganados' : 'perdidos'}
                                                    </span>
                                                </>
                                            )}
                                            <span className="fc-tip-mut">
                                                {percentage(stage.conversion)} del total inicial
                                            </span>
                                        </span>
                                    }
                                >
                                    <button
                                        type="button"
                                        className="fc-boton"
                                        aria-label={`${stage.label}: ${formatValue(stage.value)} ${unit}, ${percentage(stage.conversion)} del total inicial`}
                                    >
                                        <span className="fc-valor">{formatValue(stage.value)}</span>
                                    </button>
                                </Tooltip>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
            <div className="fc-leyenda">
                {rows.map((stage, index) => (
                    <span key={stage.id} className="fc-leyenda-item">
                        <span
                            aria-hidden="true"
                            className="fc-punto"
                            style={{ backgroundColor: stage.color ?? colors[index % colors.length] }}
                        />
                        <span>{stage.label}</span>
                        <span className="fc-leyenda-pct">{percentage(stage.conversion)}</span>
                    </span>
                ))}
            </div>
        </div>
    );
}

export function FunnelChartSummary({ className }) {
    const { rows, first, last, conversion, formatValue, unit } = useFunnelChart();
    if (!rows.length) return null;
    return (
        <div className={cn('fc-resumen', className)}>
            <span className="fc-tip-mut">
                {formatValue(first)} → {formatValue(last)} {unit}
            </span>
            <span className="fc-resumen-der">
                <span className="fc-tip-mut">Conversión final</span>
                <span className="fc-resumen-v">{percentage(conversion)}</span>
            </span>
        </div>
    );
}

export { buildFunnel, funnelPath };
