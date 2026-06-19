import React from 'react';

const FunnelChart = ({ data }) => {
    // data expected format: [{ name: 'Stage Name', value: 100, fill: '#8b5cf6' }, ...]

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
                
                // Ancho del contenedor del bloque (escala de 45% a 100% para que siempre sea legible)
                const barWidth = 45 + (pctOfTotal * 0.55);
                
                // Tasa de conversión respecto al paso anterior
                let convRate = null;
                if (index > 0) {
                    const prevValue = data[index - 1].value;
                    convRate = prevValue > 0 ? (entry.value / prevValue) * 100 : 0;
                }

                return (
                    <React.Fragment key={entry.name}>
                        {/* Conector y Tasa de Conversión de paso intermedio */}
                        {index > 0 && (
                            <div className="flex flex-col items-center justify-center my-1 select-none">
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-[10px] font-black text-slate-400 shadow-md">
                                    <span className="text-emerald-400 font-black">↓</span>
                                    <span>Tasa de conversión:</span>
                                    <span className="text-white tabular-nums">{convRate.toFixed(1)}%</span>
                                </div>
                            </div>
                        )}

                        {/* Bloque del Embudo */}
                        <div className="flex justify-center w-full">
                            <div 
                                className="relative group/funnel-step bg-slate-950/60 hover:bg-slate-950/80 border rounded-2xl p-4 flex items-center justify-between transition-all duration-300 shadow-lg cursor-default"
                                style={{ 
                                    width: `${barWidth}%`,
                                    borderColor: `${entry.fill}30`, // 30 es opacidad hexadecimal para bordes suaves
                                }}
                            >
                                {/* Brillo de fondo con el color de la etapa al pasar el cursor */}
                                <div 
                                    className="absolute inset-0 rounded-2xl opacity-0 group-hover/funnel-step:opacity-5 transition-opacity duration-300 pointer-events-none"
                                    style={{ backgroundColor: entry.fill }}
                                />

                                {/* Barra de progreso interna sutil */}
                                <div 
                                    className="absolute left-0 bottom-0 top-0 rounded-l-2xl opacity-10 pointer-events-none transition-all duration-500"
                                    style={{ 
                                        width: `${pctOfTotal}%`, 
                                        backgroundColor: entry.fill,
                                    }}
                                />

                                {/* Lado Izquierdo: Indicador y Nombre */}
                                <div className="flex items-center gap-2.5 z-10">
                                    <span 
                                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-lg"
                                        style={{ backgroundColor: entry.fill, boxShadow: `0 0 8px ${entry.fill}` }}
                                    />
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover/funnel-step:text-white transition-colors">
                                        {entry.name}
                                    </span>
                                </div>

                                {/* Centro: Valor Absoluto */}
                                <div className="text-center z-10">
                                    <span className="text-xl font-black text-white italic tracking-tighter tabular-nums">
                                        {Number(entry.value).toLocaleString()}
                                    </span>
                                </div>

                                {/* Lado Derecho: Porcentaje sobre el total */}
                                <div className="text-right z-10">
                                    <span className="text-[10px] font-black text-slate-500 group-hover/funnel-step:text-slate-300 transition-colors tabular-nums">
                                        {pctOfTotal.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default FunnelChart;
