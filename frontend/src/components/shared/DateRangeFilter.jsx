import React, { useState } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';

const DateRangeFilter = ({ value, onChange, label = "Rango de Fecha" }) => {
    const [isOpen, setIsOpen] = useState(false);

    /**
     * Structure of 'value': { type: 'today' | 'month' | 'custom', start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
     */

    const presets = [
        { id: 'today', label: 'Hoy' },
        { id: 'month', label: 'Este Mes' },
        { id: 'custom', label: 'Personalizado' }
    ];

    const applyPreset = (presetId) => {
        let newValue = { type: presetId, start: '', end: '' };

        const today = new Date();

        if (presetId === 'today') {
            const strDate = today.toISOString().split('T')[0];
            newValue.start = strDate;
            newValue.end = strDate;
        } else if (presetId === 'month') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            newValue.start = firstDay.toISOString().split('T')[0];
            newValue.end = lastDay.toISOString().split('T')[0];
        } else {
            // custom, keep existing range or clear
            newValue.start = value?.start || '';
            newValue.end = value?.end || '';
        }

        onChange(newValue);
        if (presetId !== 'custom') setIsOpen(false);
    };

    const handleCustomChange = (field, val) => {
        onChange({ ...value, type: 'custom', [field]: val });
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-main border border-base rounded-2xl px-4 py-3 text-muted hover:text-white hover:border-primary transition-all text-[10px] font-black uppercase tracking-widest"
            >
                <Calendar size={16} className={value?.type !== 'all' ? 'text-primary' : ''} />
                <span>{presets.find(p => p.id === value?.type)?.label || label}</span>
                <ChevronDown size={14} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full mt-2 left-0 w-64 bg-surface border border-base rounded-2xl shadow-2xl z-20 overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="p-2 space-y-1">
                            {presets.map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => applyPreset(preset.id)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-bold transition-all ${value?.type === preset.id ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-surface-hover hover:text-white'}`}
                                >
                                    {preset.label}
                                    {value?.type === preset.id && <Check size={14} />}
                                </button>
                            ))}
                        </div>

                        {value?.type === 'custom' && (
                            <div className="p-3 bg-main border-t border-base space-y-2">
                                <div>
                                    <label className="text-[9px] text-muted font-black uppercase tracking-widest block mb-1">Desde</label>
                                    <input
                                        type="date"
                                        className="w-full bg-surface border border-base rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-primary"
                                        value={value.start || ''}
                                        onChange={(e) => handleCustomChange('start', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] text-muted font-black uppercase tracking-widest block mb-1">Hasta</label>
                                    <input
                                        type="date"
                                        className="w-full bg-surface border border-base rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-primary"
                                        value={value.end || ''}
                                        onChange={(e) => handleCustomChange('end', e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default DateRangeFilter;
