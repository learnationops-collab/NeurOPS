import React, { useState } from 'react';
import { Filter, ChevronDown, Check, X } from 'lucide-react';

const MultiSelectFilter = ({ options = [], value = [], onChange, label }) => {
    // options format: [{ value: 'scheduled', label: 'Programada' }, ...]
    // value format: ['scheduled', 'completed']
    const [isOpen, setIsOpen] = useState(false);

    const toggleOption = (optVal) => {
        const newValue = value.includes(optVal)
            ? value.filter(v => v !== optVal)
            : [...value, optVal];
        onChange(newValue);
    };

    const clearAll = () => onChange([]);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 bg-main border rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${value.length > 0 ? 'border-primary text-primary' : 'border-base text-muted hover:text-white hover:border-primary'}`}
            >
                <Filter size={16} />
                <span>{label} {value.length > 0 && `(${value.length})`}</span>
                <ChevronDown size={14} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full mt-2 left-0 min-w-[200px] bg-surface border border-base rounded-2xl shadow-2xl z-20 overflow-hidden animate-in fade-in zoom-in duration-200">
                        {value.length > 0 && (
                            <div className="p-2 border-b border-base flex justify-between items-center bg-surface-hover/50">
                                <span className="text-[10px] font-bold text-muted">{value.length} seleccionados</span>
                                <button onClick={clearAll} className="text-[10px] text-primary hover:text-white font-bold flex items-center gap-1">
                                    <X size={12} /> Limpiar
                                </button>
                            </div>
                        )}
                        <div className="p-2 max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                            {options.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => toggleOption(opt.value)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-bold transition-all ${value.includes(opt.value) ? 'bg-primary text-white' : 'text-muted hover:bg-surface-hover hover:text-white'}`}
                                >
                                    <span>{opt.label}</span>
                                    {value.includes(opt.value) && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default MultiSelectFilter;
