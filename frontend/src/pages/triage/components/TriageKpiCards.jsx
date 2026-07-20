import React from 'react';
import { Calendar, CheckSquare, Clock, ChevronDown } from 'lucide-react';

const TriageKpiCards = ({ counts, activeFilter, onFilterChange }) => {
    const cards = [
        {
            id: 'citas',
            title: 'Citas por confirmar',
            count: counts.citas || 0,
            icon: Calendar,
            color: 'violet',
            bgColor: 'bg-violet-500/10',
            borderColor: 'border-violet-500/20',
            textColor: 'text-violet-400',
            glowColor: 'shadow-[0_0_15px_rgba(139,92,246,0.15)]'
        },
        {
            id: 'seguimientos',
            title: 'Seguimientos por hacer',
            count: counts.seguimientos || 0,
            icon: CheckSquare,
            color: 'emerald',
            bgColor: 'bg-emerald-500/10',
            borderColor: 'border-emerald-500/20',
            textColor: 'text-emerald-400',
            glowColor: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]'
        },
        {
            id: 'reagendar',
            title: 'Reagendar / Actualizar',
            count: counts.reagendar || 0,
            icon: Clock,
            color: 'rose',
            bgColor: 'bg-rose-500/10',
            borderColor: 'border-rose-500/20',
            textColor: 'text-rose-400',
            glowColor: 'shadow-[0_0_15px_rgba(244,63,94,0.15)]'
        }
    ];

    return (
        <div className="relative space-y-3 text-left">
            {/* Header del bloque con filtro */}
            <div className="flex justify-end items-center">
                <div className="relative">
                    <select
                        value={activeFilter || 'all'}
                        onChange={(e) => onFilterChange?.(e.target.value)}
                        className="bg-slate-900/80 border border-slate-800 text-slate-300 text-xs font-semibold py-1.5 pl-3 pr-8 rounded-xl appearance-none outline-none cursor-pointer hover:border-slate-700 transition-colors"
                    >
                        <option value="all">Todos los tipos</option>
                        <option value="citas">Solo Citas por confirmar</option>
                        <option value="seguimientos">Solo Seguimientos</option>
                        <option value="reagendar">Solo Reagenda</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* Grid de 3 tarjetas KPI */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {cards.map((card) => {
                    const IconComponent = card.icon;
                    const isSelected = activeFilter === card.id;

                    return (
                        <div
                            key={card.id}
                            onClick={() => onFilterChange?.(isSelected ? 'all' : card.id)}
                            className={`p-4 rounded-2xl bg-slate-950/60 border ${
                                isSelected ? `${card.borderColor} ${card.glowColor}` : 'border-slate-850 hover:border-slate-800'
                            } transition-all cursor-pointer flex items-center justify-between group relative overflow-hidden`}
                        >
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl ${card.bgColor} ${card.textColor} border ${card.borderColor}`}>
                                        <IconComponent size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-medium text-slate-400 leading-tight">
                                            {card.title}
                                        </p>
                                        <span className="text-2xl font-black text-white tracking-tight">
                                            {card.count}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TriageKpiCards;
