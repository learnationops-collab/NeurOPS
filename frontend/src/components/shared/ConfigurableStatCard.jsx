import React, { useState, useEffect } from 'react';
import { HelpCircle, Settings, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ConfigurableStatCard = ({ id, title, value, percentage, icon: Icon, tooltipInfo }) => {
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

    const getColors = () => {
        const val = parseFloat(percentage);
        if (isNaN(val)) return 'text-slate-400';
        if (val >= thresholds.max) return 'text-emerald-500';
        if (val <= thresholds.min) return 'text-rose-500';
        return 'text-amber-500';
    };

    const colorClass = getColors();

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative group hover:shadow-indigo-500/5 transition-all overflow-visible">
            <div className={`absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 group-hover:opacity-30 transition-opacity bg-indigo-500`} />
            
            <div className="flex items-start justify-between relative z-10 overflow-visible">
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
                        {tooltipInfo && (
                            <div className="relative group/tooltip inline-block">
                                <HelpCircle size={12} className="text-slate-400 cursor-help hover:text-indigo-500 transition-colors" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50 shadow-xl border border-slate-700/50">
                                    {tooltipInfo}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                </div>
                            </div>
                        )}
                    </div>
                    <h3 className="text-3xl font-black text-white italic tracking-tighter">{value}</h3>
                    {percentage !== undefined && (
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${colorClass} bg-opacity-10 border border-current/30`}>
                                {percentage}%
                            </span>
                        </div>
                    )}
                </div>
                
                <div className="flex flex-col gap-2">
                    <div className={`p-3 rounded-2xl bg-slate-800 border border-slate-700/50 ${colorClass}`}>
                        <Icon size={18} />
                    </div>
                    <button 
                        onClick={() => {
                            setTempThresholds(thresholds);
                            setShowConfig(!showConfig);
                        }}
                        className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/30 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 transition-all opacity-0 group-hover:opacity-100"
                    >
                        <Settings size={12} />
                    </button>
                </div>
            </div>

            {/* Config Popover */}
            <AnimatePresence>
                {showConfig && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-2xl p-4 z-50 shadow-2xl"
                    >
                        <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
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
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
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
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                            </div>
                            <button 
                                onClick={saveThresholds}
                                className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 flex items-center justify-center gap-2"
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
