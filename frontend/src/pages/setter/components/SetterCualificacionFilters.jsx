import React from 'react';
import { CalendarDays, ChevronDown, Check, Users, MessageSquare, X } from 'lucide-react';

const SetterCualificacionFilters = ({
    dateRange,
    setDateRange,
    customDate,
    setCustomDate,
    showCalendar,
    setShowCalendar,
    stats,
    showDisqualified,
    setShowDisqualified
}) => {
    return (
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-4 flex flex-wrap items-center justify-between gap-4">
            {/* Selector de fecha */}
            <div className="relative">
                <button
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
                >
                    <CalendarDays size={14} className="text-violet-400" />
                    <span>
                        {dateRange === 'today' && 'Hoy'}
                        {dateRange === 'yesterday' && 'Ayer'}
                        {dateRange === 'week' && 'Esta semana'}
                        {dateRange === 'month' && 'Este mes'}
                        {dateRange === 'custom' && `Personalizado: ${customDate}`}
                    </span>
                    <ChevronDown size={14} className="text-slate-500" />
                </button>
                
                {showCalendar && (
                    <div className="absolute top-12 left-0 bg-slate-950 border border-slate-850 p-3 rounded-2xl shadow-xl z-50 space-y-2 min-w-[200px] animate-in fade-in slide-in-from-top-1 duration-150">
                        {[
                            { value: 'today', label: 'Hoy' },
                            { value: 'yesterday', label: 'Ayer' },
                            { value: 'week', label: 'Esta semana' },
                            { value: 'month', label: 'Este mes' }
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    setDateRange(opt.value);
                                    setShowCalendar(false);
                                }}
                                className={`w-full text-left px-3.5 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-between ${
                                    dateRange === opt.value 
                                        ? 'bg-violet-650/20 text-violet-400' 
                                        : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                                }`}
                            >
                                {opt.label}
                                {dateRange === opt.value && <Check size={12} />}
                            </button>
                        ))}
                        
                        <div className="border-t border-slate-900 my-1 pt-2">
                            <button
                                onClick={() => {
                                    setDateRange('custom');
                                    setShowCalendar(false);
                                }}
                                className={`w-full text-left px-3.5 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-between ${
                                    dateRange === 'custom' 
                                        ? 'bg-violet-650/20 text-violet-400' 
                                        : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                                }`}
                            >
                                <span>Personalizado</span>
                                <CalendarDays size={12} />
                            </button>
                            
                            {dateRange === 'custom' && (
                                <input
                                    type="date"
                                    value={customDate}
                                    onChange={(e) => setCustomDate(e.target.value)}
                                    className="w-full mt-1.5 bg-slate-900 border border-slate-800 text-xs font-bold rounded-xl p-2 text-slate-200 outline-none focus:border-violet-500/50"
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Estadísticas de cualificación */}
            <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
                <div className="flex items-center gap-2 bg-violet-500/5 border border-violet-500/10 px-3 py-1.5 rounded-2xl">
                    <Users size={14} className="text-violet-400" />
                    <span className="text-xs font-black text-white">{stats.qualified_today}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cualificados hoy</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-900 px-3 py-1.5 rounded-2xl">
                    <Users size={14} className="text-slate-500" />
                    <span className="text-xs font-black text-white">{stats.unassigned_today}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sin asignación</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-900 px-3 py-1.5 rounded-2xl">
                    <MessageSquare size={14} className="text-slate-500" />
                    <span className="text-xs font-black text-white">{stats.no_response_today}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sin responder</span>
                </div>
            </div>

            {/* Botón Ver / Ocultar Descalificados */}
            <button
                onClick={() => setShowDisqualified(!showDisqualified)}
                className={`px-4 py-2 bg-slate-950 border border-slate-850 hover:border-slate-750 transition-all rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer ${
                    showDisqualified ? 'text-rose-400 bg-rose-500/5 border-rose-500/10 hover:border-rose-500/20' : 'text-slate-400'
                }`}
            >
                <X size={12} />
                {showDisqualified ? 'Ocultar descalificados' : 'Ver descalificados'}
            </button>
        </div>
    );
};

export default SetterCualificacionFilters;
