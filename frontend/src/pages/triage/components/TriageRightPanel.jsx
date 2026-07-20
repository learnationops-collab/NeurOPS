import React from 'react';

const TriageRightPanel = ({ counts }) => {
    const total = (counts.citas || 0) + (counts.mensajes || 0) + (counts.seguimientos || 0) + (counts.reagendar || 0);

    const calcPct = (val) => {
        if (!total) return 0;
        return Math.round((val / total) * 100);
    };

    const categories = [
        { key: 'citas', label: 'Citas por confirmar', count: counts.citas || 0, color: '#8b5cf6', dotClass: 'bg-violet-500' },
        { key: 'mensajes', label: 'Mensajes por contestar', count: counts.mensajes || 0, color: '#f59e0b', dotClass: 'bg-amber-500' },
        { key: 'seguimientos', label: 'Seguimientos por hacer', count: counts.seguimientos || 0, color: '#10b981', dotClass: 'bg-emerald-500' },
        { key: 'reagendar', label: 'Reagendar / Actualizar', count: counts.reagendar || 0, color: '#f43f5e', dotClass: 'bg-rose-500' },
    ];

    // Calcular SVG Dasharrays para la gráfica Donut
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    let strokeOffset = 0;

    return (
        <div className="space-y-6">
            {/* Tarjeta 1: Resumen de Pendientes (Donut Chart) */}
            <div className="bg-slate-950/60 border border-slate-850 rounded-3xl p-5 space-y-5 shadow-xl">
                <h3 className="text-sm font-black text-white tracking-tight">
                    Resumen de pendientes
                </h3>

                <div className="flex flex-col items-center justify-center py-2 relative">
                    {/* SVG Donut Chart */}
                    <div className="relative w-40 h-40 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            {/* Track Base */}
                            <circle
                                cx="50"
                                cy="50"
                                r={radius}
                                stroke="#1e293b"
                                strokeWidth="10"
                                fill="transparent"
                            />
                            {/* Segmentos de color */}
                            {total > 0 && categories.map((cat) => {
                                const pct = (cat.count / total);
                                const strokeDasharray = `${pct * circumference} ${circumference}`;
                                const currentOffset = strokeOffset;
                                strokeOffset -= pct * circumference;

                                return (
                                    <circle
                                        key={cat.key}
                                        cx="50"
                                        cy="50"
                                        r={radius}
                                        stroke={cat.color}
                                        strokeWidth="10"
                                        strokeDasharray={strokeDasharray}
                                        strokeDashoffset={currentOffset}
                                        strokeLinecap="round"
                                        fill="transparent"
                                        className="transition-all duration-500"
                                    />
                                );
                            })}
                        </svg>

                        {/* Texto central del Donut */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-black text-white leading-none tracking-tight">
                                {total}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                Total
                            </span>
                        </div>
                    </div>
                </div>

                {/* Leyenda de Categorías */}
                <div className="space-y-2.5 pt-2 border-t border-slate-900">
                    {categories.map((cat) => {
                        const pct = calcPct(cat.count);
                        return (
                            <div key={cat.key} className="flex items-center justify-between text-xs font-semibold">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span className={`w-2.5 h-2.5 rounded-full ${cat.dotClass} shrink-0`} />
                                    <span className="text-slate-300 truncate">{cat.label}</span>
                                </div>
                                <span className="text-slate-400 font-mono shrink-0 ml-2">
                                    {cat.count} ({pct}%)
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TriageRightPanel;
