import React, { useState, useRef, useEffect } from 'react';
import { Settings2, HelpCircle } from 'lucide-react';

const GradientSettings = ({ sortKey, thresholds, setThresholds, columns }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Si no hay sortKey o no existe configuración para ella, no mostramos el panel
    if (!sortKey || !thresholds[sortKey]) {
        return null;
    }

    const currentConfig = thresholds[sortKey];
    const columnLabel = columns.find(c => c.id === sortKey)?.label || sortKey;

    const handleUpdate = (field, value) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;
        setThresholds({
            ...thresholds,
            [sortKey]: {
                ...currentConfig,
                [field]: numValue
            }
        });
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 ${
                    isOpen 
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
                title={`Configurar Rangos para ${columnLabel}`}
            >
                <Settings2 size={16} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl z-[100] p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                            Limites de Color
                            <span className="text-white bg-slate-800 px-1.5 py-0.5 rounded">{columnLabel}</span>
                        </h4>
                    </div>

                    <div className="space-y-4">
                        <div className="relative group/tooltip overflow-visible">
                            <label className="text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-1 mb-1">
                                Óptimo (Verde)
                                <HelpCircle size={10} className="text-slate-500 cursor-help" />
                            </label>
                            <input 
                                type="number" 
                                value={currentConfig.optimal}
                                onChange={(e) => handleUpdate('optimal', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                            />
                        </div>

                        <div className="relative group/tooltip overflow-visible">
                            <label className="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-1 mb-1">
                                Tolerable (Amarillo)
                                <HelpCircle size={10} className="text-slate-500 cursor-help" />
                            </label>
                            <input 
                                type="number" 
                                value={currentConfig.tolerable}
                                onChange={(e) => handleUpdate('tolerable', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-amber-500 outline-none"
                            />
                        </div>
                        
                        <p className="text-[9px] text-slate-500 leading-tight">
                            Lo que quede por {currentConfig.mode === 'higher' ? 'debajo' : 'encima'} de Tolerable se marcará en <span className="text-red-400 font-bold">Rojo</span>.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GradientSettings;
