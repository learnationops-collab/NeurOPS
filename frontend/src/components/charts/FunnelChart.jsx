import React, { useState } from 'react';

const Tooltip = ({ children, content, position = 'top' }) => {
    const [visible, setVisible] = useState(false);

    return (
        <div
            className="relative inline-flex"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            {children}
            {visible && content && (
                <div className={`absolute z-[9999] pointer-events-none ${
                    position === 'top'
                        ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
                        : 'top-full mt-2 left-1/2 -translate-x-1/2'
                }`}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3.5 shadow-2xl w-64 animate-in fade-in duration-150">
                        {content}
                    </div>
                    {/* Flecha */}
                    <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-slate-700 rotate-45 ${
                        position === 'top'
                            ? '-bottom-1 border-r border-b'
                            : '-top-1 border-l border-t'
                    }`} />
                </div>
            )}
        </div>
    );
};

const FunnelChart = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center text-slate-500 text-sm h-full min-h-[300px]">
                No hay datos suficientes para el gráfico
            </div>
        );
    }

    const firstValue = data[0]?.value || 0;

    return (
        <div className="w-full flex flex-col space-y-3 py-4 animate-in fade-in duration-500">
            {data.map((entry, index) => {
                const pctOfTotal = firstValue > 0 ? (entry.value / firstValue) * 100 : 0;

                // Ancho del bloque (escala de 45% a 100%)
                const barWidth = 45 + (pctOfTotal * 0.55);

                // Tasa de conversión respecto al paso anterior
                let convRate = null;
                let prevEntry = null;
                if (index > 0) {
                    prevEntry = data[index - 1];
                    convRate = prevEntry.value > 0 ? (entry.value / prevEntry.value) * 100 : 0;
                }

                // Tooltip del bloque de la etapa
                const stageTooltipContent = (
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-700/60">
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: entry.fill, boxShadow: `0 0 6px ${entry.fill}` }}
                            />
                            <span className="text-xs font-black text-white uppercase tracking-wider">{entry.name}</span>
                        </div>

                        {/* Descripción */}
                        {entry.tooltip && (
                            <p className="text-xs text-slate-300 leading-relaxed">{entry.tooltip}</p>
                        )}

                        {/* Métricas */}
                        <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500 font-bold">Valor</span>
                                <span className="text-xs font-black text-white tabular-nums">{Number(entry.value).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500 font-bold">% vs {data[0].name}</span>
                                <span className="text-xs font-black tabular-nums" style={{ color: entry.fill }}>
                                    {pctOfTotal.toFixed(1)}%
                                </span>
                            </div>
                            {entry.formula && (
                                <div className="pt-1.5 border-t border-slate-700/40">
                                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider block mb-1">Fórmula</span>
                                    <span className="text-xs text-slate-400 font-mono">{entry.formula}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );

                // Tooltip de la tasa de conversión
                const convTooltipContent = prevEntry ? (
                    <div className="space-y-2">
                        <p className="text-xs font-black text-slate-300 uppercase tracking-wider">Tasa de conversión</p>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            De cada 100 <span className="text-white font-black">{prevEntry.name}</span>, cuántos llegan a <span className="text-white font-black">{entry.name}</span>.
                        </p>
                        <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-700/40">
                            <span className="text-[11px] text-slate-500 font-bold font-mono block">
                                {entry.name} ({entry.value}) ÷ {prevEntry.name} ({prevEntry.value}) × 100
                            </span>
                            <span className="text-sm font-black text-emerald-400 tabular-nums mt-1 block">
                                = {convRate.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                ) : null;

                return (
                    <React.Fragment key={entry.name}>
                        {/* Conector y Tasa de Conversión entre pasos */}
                        {index > 0 && (
                            <div className="flex flex-col items-center justify-center my-1 select-none">
                                <Tooltip content={convTooltipContent} position="top">
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/80 border border-slate-800 text-xs font-black text-slate-400 shadow-md cursor-help hover:border-slate-600 hover:text-slate-200 transition-all">
                                        <span className="text-emerald-400 font-black">↓</span>
                                        <span>Tasa de conversión:</span>
                                        <span className="text-white tabular-nums">{convRate.toFixed(1)}%</span>
                                        <span className="text-slate-600 font-normal text-[10px]">(?)</span>
                                    </div>
                                </Tooltip>
                            </div>
                        )}

                        {/* Bloque del Embudo */}
                        <div className="flex justify-center w-full">
                            <Tooltip content={stageTooltipContent} position="top">
                                <div
                                    className="relative group/funnel-step bg-slate-950/60 hover:bg-slate-950/80 border rounded-2xl p-4 flex items-center justify-between transition-all duration-300 shadow-lg cursor-help"
                                    style={{
                                        width: `${barWidth}%`,
                                        borderColor: `${entry.fill}30`,
                                    }}
                                >
                                    {/* Brillo de fondo al hover */}
                                    <div
                                        className="absolute inset-0 rounded-2xl opacity-0 group-hover/funnel-step:opacity-5 transition-opacity duration-300 pointer-events-none"
                                        style={{ backgroundColor: entry.fill }}
                                    />

                                    {/* Barra de progreso interna sutil */}
                                    <div
                                        className="absolute left-0 bottom-0 top-0 rounded-l-2xl opacity-10 pointer-events-none transition-all duration-500"
                                        style={{ width: `${pctOfTotal}%`, backgroundColor: entry.fill }}
                                    />

                                    {/* Nombre */}
                                    <div className="flex items-center gap-2.5 z-10">
                                        <span
                                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-lg"
                                            style={{ backgroundColor: entry.fill, boxShadow: `0 0 8px ${entry.fill}` }}
                                        />
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover/funnel-step:text-white transition-colors">
                                            {entry.name}
                                        </span>
                                    </div>

                                    {/* Valor Absoluto */}
                                    <div className="text-center z-10">
                                        <span className="text-xl font-black text-white italic tracking-tighter tabular-nums">
                                            {Number(entry.value).toLocaleString()}
                                        </span>
                                    </div>

                                    {/* % sobre total */}
                                    <div className="text-right z-10">
                                        <span className="text-xs font-black text-slate-500 group-hover/funnel-step:text-slate-300 transition-colors tabular-nums">
                                            {pctOfTotal.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </Tooltip>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default FunnelChart;
