import React from 'react';
import { Search, Users, CalendarDays } from 'lucide-react';

const SetterHeader = ({ activeStep, onStepChange, searchQuery, setSearchQuery }) => {
    return (
        <div className="px-6 pt-6 pb-4 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 space-y-4">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white italic uppercase tracking-tight flex items-center gap-2">
                        Setter Workspace
                    </h1>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Flujo de Trabajo Operativo • {activeStep === 'agendas' ? '2. Agendas' : '1. Leads Cualificados'}
                    </p>
                </div>

                {/* Selector de Pestaña (Leads cualificados / Agendas) */}
                <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800/80">
                    <button
                        onClick={() => onStepChange('cualificacion')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                            activeStep === 'cualificacion'
                                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                    >
                        <Users size={14} />
                        <span>Leads cualificados</span>
                    </button>
                    <button
                        onClick={() => onStepChange('agendas')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                            activeStep === 'agendas'
                                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                    >
                        <CalendarDays size={14} />
                        <span>Agendas</span>
                    </button>
                </div>

                {/* Buscador */}
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o IG..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-200 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                    />
                </div>
            </div>
        </div>
    );
};

export default SetterHeader;
