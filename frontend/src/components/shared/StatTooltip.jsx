import React from 'react';

/**
 * StatTooltip - Componente premium para mostrar explicaciones y cálculos al pasar el mouse por números o porcentajes.
 */
const StatTooltip = ({ label, value, calculation, children }) => {
    return (
        <span className="relative group/tooltip inline-block cursor-help">
            <span className="underline decoration-dotted decoration-indigo-500/50 hover:text-indigo-400 transition-colors">
                {children || value}
            </span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3.5 w-64 bg-slate-950 text-slate-200 text-[10px] font-normal normal-case tracking-normal rounded-xl p-3.5 opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 pointer-events-none z-[9999] shadow-2xl border border-slate-800/80 leading-relaxed text-left">
                <span className="block font-black text-indigo-400 uppercase tracking-widest text-[9px] mb-1.5">{label}</span>
                {value && <span className="block text-slate-300 text-xs font-black italic tracking-tighter mb-2 border-b border-slate-900 pb-1.5">{value}</span>}
                <span className="block text-[9px] text-slate-400 leading-normal">
                    <strong className="text-slate-350 font-bold uppercase tracking-wider text-[8px] block mb-0.5">Cálculo:</strong> 
                    {calculation}
                </span>
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-950"></span>
            </span>
        </span>
    );
};

export default StatTooltip;
