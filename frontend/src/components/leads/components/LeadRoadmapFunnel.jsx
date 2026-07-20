import React from 'react';
import { Sparkles, MessageCircle, User, Calendar, Phone, DollarSign } from 'lucide-react';

const LeadRoadmapFunnel = ({ stages }) => {
    const stageIcons = [Sparkles, MessageCircle, User, Calendar, Phone, DollarSign];

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="space-y-6 mb-8 text-left">
            <div className="space-y-1">
                <h3 className="text-lg font-black text-white tracking-tight uppercase">Lead Roadmap</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    Paso a paso del recorrido del lead en el embudo
                </p>
            </div>

            <div className="relative pt-6 pb-2">
                <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
                
                <div className="grid grid-cols-2 md:grid-cols-6 gap-8 relative z-10">
                    {(stages || []).map((stage, idx) => {
                        const IconComp = stageIcons[idx] || Sparkles;
                        const isCompleted = stage.completed;
                        
                        return (
                            <div key={stage.name} className="relative flex flex-col items-center text-center space-y-4 group">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                                    isCompleted 
                                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 border-2 border-violet-500' 
                                        : 'bg-slate-900 text-slate-600 border border-slate-800'
                                }`}>
                                    <IconComp size={22} className={isCompleted ? 'animate-pulse' : ''} />
                                </div>

                                <div className="space-y-1">
                                    <div className="text-xs font-black text-white">{stage.name}</div>
                                    <span className={`inline-block px-2 py-0.5 text-[8px] font-black rounded-md uppercase tracking-widest ${
                                        isCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800/40 text-slate-500'
                                    }`}>
                                        {isCompleted ? 'Completado' : 'Pendiente'}
                                    </span>
                                    {isCompleted && stage.date && (
                                        <div className="text-[9px] font-medium text-slate-500">{formatTime(stage.date)}</div>
                                    )}
                                </div>

                                {/* Tooltip al pasar el cursor */}
                                <div className="absolute top-[85%] left-1/2 -translate-x-1/2 mt-4 w-48 bg-slate-950/95 border border-slate-800 p-3.5 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-300 z-50 text-left text-[10px] space-y-1.5 font-bold scale-95 group-hover:scale-100 origin-top">
                                    {idx === 0 && (
                                        <>
                                            <div className="text-slate-500">Origen: <span className="text-slate-300">{stage.details?.origen || 'Instagram'}</span></div>
                                            <div className="text-slate-500">Canal: <span className="text-slate-300">{stage.details?.canal}</span></div>
                                            <div className="text-slate-500 flex flex-col">Campaña: <span className="text-slate-300 truncate">{stage.details?.campaña}</span></div>
                                        </>
                                    )}
                                    {idx === 1 && (
                                        <>
                                            <div className="text-slate-500">Acción: <span className="text-slate-300">{stage.details?.accion}</span></div>
                                            <div className="text-slate-500">Medio: <span className="text-slate-300">{stage.details?.medio}</span></div>
                                            <div className="text-slate-500 italic break-words">{stage.details?.mensaje}</div>
                                        </>
                                    )}
                                    {idx === 2 && (
                                        <>
                                            <div className="text-slate-500">Dolores:</div>
                                            <ul className="list-disc pl-3 text-slate-300 space-y-0.5 max-h-24 overflow-y-auto custom-scrollbar">
                                                {(stage.details?.dolores || []).map((d, i) => (
                                                    <li key={i} className="break-words">{d}</li>
                                                ))}
                                            </ul>
                                        </>
                                    )}
                                    {idx === 3 && (
                                        <>
                                            <div className="text-slate-500">Tipo: <span className="text-slate-300">{stage.details?.tipo || 'Reunión'}</span></div>
                                            <div className="text-slate-500">Fecha: <span className="text-slate-300">{stage.details?.fecha_agendada ? stage.details.fecha_agendada.split('T')[0] : 'N/A'}</span></div>
                                        </>
                                    )}
                                    {idx === 4 && (
                                        <>
                                            <div className="text-slate-500">Resultado: <span className="text-slate-300">{stage.details?.resultado || 'Pendiente'}</span></div>
                                            <div className="text-slate-500 italic break-words">{stage.details?.notes}</div>
                                        </>
                                    )}
                                    {idx === 5 && (
                                        <>
                                            <div className="text-slate-500">Monto: <span className="text-emerald-400 font-bold">${stage.details?.monto || '0.00'}</span></div>
                                            <div className="text-slate-500">Método: <span className="text-slate-300">{stage.details?.metodo_pago}</span></div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default LeadRoadmapFunnel;
