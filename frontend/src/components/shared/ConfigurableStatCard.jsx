import React, { useState, useEffect } from 'react';
import { Info, Settings, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ConfigurableStatCard - Versión "Minimalismo Funcional"
 * @param {string} variant - 'summary' | 'analysis' | 'footer'
 * @param {string} accentColor - '#8B5CF6' | '#3B82F6' | '#10B981'
 */
const ConfigurableStatCard = ({ 
    id, title, value, percentage, icon: Icon, tooltipInfo, subValue,
    variant = 'summary', accentColor = '#8B5CF6' 
}) => {
    const [showConfig, setShowConfig] = useState(false);
    const [thresholds, setThresholds] = useState(() => {
        const saved = localStorage.getItem(`kpi_thresholds_${id}`);
        return saved ? JSON.parse(saved) : { min: 20, max: 60 };
    });

    const [tempThresholds, setTempThresholds] = useState(thresholds);

    const saveThresholds = () => {
        setThresholds(tempThresholds);
        localStorage.setItem(`kpi_thresholds_${id}`, JSON.stringify(tempThresholds));
        setShowConfig(false);
    };

    const getStatusColor = () => {
        const val = parseFloat(percentage);
        if (isNaN(val)) return null;
        if (val >= thresholds.max) return 'bg-emerald-500';
        if (val <= thresholds.min) return 'bg-rose-500';
        return 'bg-amber-500';
    };

    const statusColor = getStatusColor();

    // Renderizado según variante
    if (variant === 'footer') {
        return (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/30 rounded-2xl border border-slate-800/50 hover:bg-slate-800/40 transition-colors group">
                <div className="p-1.5 rounded-lg bg-slate-800 text-slate-500 group-hover:text-slate-300 transition-colors">
                    <Icon size={12} />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{title}</span>
                    <span className="text-xs font-black text-white italic">{value}</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative bg-[#0b1120] border border-slate-800/60 rounded-[1.5rem] p-6 transition-all duration-300 hover:border-slate-700/80 group ${showConfig ? 'z-[100]' : 'z-10'}`}>
            {/* Border de acento opcional (basado en la instrucción: aplicar solo cuando deba destacar) */}
            <div className="absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-[1px]" style={{ backgroundColor: accentColor }} />
            
            <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center p-1.5 bg-slate-800 rounded-lg shadow-inner">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.15em]">{title}</span>
                    {tooltipInfo && (
                        <div className="relative group/tooltip inline-block">
                            <Info size={12} className="text-slate-600 cursor-help hover:text-blue-400 transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 bg-[#0f172a] text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-[9999] shadow-2xl border border-slate-800">
                                <div className="text-blue-400 font-bold mb-1 uppercase tracking-tighter">Explicación:</div>
                                {tooltipInfo}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#0f172a]"></div>
                            </div>
                        </div>
                    )}
                </div>
                <button 
                    onClick={() => {
                        setTempThresholds(thresholds);
                        setShowConfig(!showConfig);
                    }}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-all opacity-0 group-hover:opacity-100"
                >
                    <Settings size={12} />
                </button>
            </div>

            <div className="flex items-center gap-5 relative z-10">
                {/* Icon Container */}
                <div className={`flex-shrink-0 flex items-center justify-center ${variant === 'summary' ? 'w-14 h-14 bg-slate-900 border border-slate-800 rounded-xl' : 'w-12 h-12 rounded-full bg-slate-900 border border-slate-800'}`}>
                    <Icon size={variant === 'summary' ? 24 : 20} className="text-slate-300" />
                </div>

                <div className="flex-1">
                    <div className="flex flex-col">
                        <span className={`text-4xl font-black leading-none tracking-tight ${variant === 'analysis' ? '' : 'text-white'}`} style={variant === 'analysis' ? { color: accentColor } : {}}>
                            {variant === 'analysis' && percentage !== undefined ? `${percentage}%` : value}
                        </span>
                        {subValue && (
                            <span className="text-[10px] font-medium text-slate-500 mt-1 uppercase tracking-tighter">
                                {subValue}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Barra de Progreso Minimalista */}
            {percentage !== undefined && (
                <div className="mt-6 space-y-2 relative z-10">
                    <div className="w-full h-[3px] bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            className="h-full transition-all duration-1000"
                            style={{ backgroundColor: accentColor }}
                        />
                    </div>
                </div>
            )}

            {/* Píldora de Estado (Bottom Right) */}
            {statusColor && (
                <div className="absolute bottom-4 right-4 flex items-center gap-1.5 px-2 py-0.5 bg-slate-900/80 rounded-full border border-slate-800">
                    <div className={`w-1 h-1 rounded-full animate-pulse ${statusColor}`} />
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">
                        {statusColor.includes('emerald') ? 'Óptimo' : statusColor.includes('rose') ? 'Alerta' : 'Bajo'}
                    </span>
                </div>
            )}

            {/* Config Popover */}
            <AnimatePresence>
                {showConfig && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-[#0f172a] border border-slate-800 rounded-2xl p-4 z-[110] shadow-2xl"
                    >
                        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Configurar Umbrales</span>
                            <button onClick={() => setShowConfig(false)} className="text-slate-400 hover:text-white">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <div className="flex justify-between">
                                    <label className="text-[8px] font-black text-slate-400 uppercase">Mínimo (Rojo)</label>
                                    <span className="text-[8px] font-black text-rose-400">{tempThresholds.min}%</span>
                                </div>
                                <input 
                                    type="range" min="0" max="100" 
                                    value={tempThresholds.min}
                                    onChange={(e) => setTempThresholds({...tempThresholds, min: parseInt(e.target.value)})}
                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between">
                                    <label className="text-[8px] font-black text-slate-400 uppercase">Máximo (Verde)</label>
                                    <span className="text-[8px] font-black text-emerald-400">{tempThresholds.max}%</span>
                                </div>
                                <input 
                                    type="range" min="0" max="100" 
                                    value={tempThresholds.max}
                                    onChange={(e) => setTempThresholds({...tempThresholds, max: parseInt(e.target.value)})}
                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                            </div>
                            <button 
                                onClick={saveThresholds}
                                className="w-full py-2 bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 flex items-center justify-center gap-2 border border-slate-700"
                            >
                                <Check size={12} /> Guardar
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ConfigurableStatCard;
