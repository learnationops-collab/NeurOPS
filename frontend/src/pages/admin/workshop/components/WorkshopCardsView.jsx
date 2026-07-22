import React from 'react';
import { Edit2, Trash2, ArrowRight, ShieldCheck, AlertTriangle, Zap } from 'lucide-react';

const WorkshopCardsView = ({ events, onSelectFunnel, onEdit, onDelete, formatDate, formatCurrency }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((e) => {
                const profit = e.cash_collected - e.inversion;
                const profitMargin = e.cash_collected > 0 ? ((profit / e.cash_collected) * 100).toFixed(0) : 0;
                
                const roasColor = e.roas >= 3 
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
                    : e.roas >= 1.5 
                    ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" 
                    : e.roas >= 1.0 
                    ? "text-amber-400 bg-amber-500/10 border-amber-500/20" 
                    : "text-rose-400 bg-rose-500/10 border-rose-500/20";

                const roasGlow = e.roas >= 3 
                    ? "group-hover:border-emerald-500/30" 
                    : e.roas >= 1.5 
                    ? "group-hover:border-indigo-500/30" 
                    : "group-hover:border-rose-500/30";

                return (
                    <div 
                        key={e.id} 
                        className={`bg-slate-900/40 border border-slate-800 rounded-[2rem] p-6 space-y-5 relative overflow-hidden group hover:bg-slate-900/80 transition-all duration-300 ${roasGlow}`}
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-10 bg-indigo-500 pointer-events-none" />
                        
                        {/* Header */}
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] font-black uppercase tracking-widest italic">
                                    {formatDate(e.date)}
                                </span>
                                <h3 className="text-xl font-black text-white italic tracking-tighter uppercase mt-2 group-hover:text-indigo-400 transition-colors">
                                    {e.name}
                                </h3>
                            </div>
                            <span className={`px-3 py-1 rounded-xl text-[10px] font-black border tracking-widest ${roasColor}`}>
                                {e.roas.toFixed(2)}x ROAS
                            </span>
                        </div>

                        {/* Financiero CEO Breakdown */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/30 text-center">
                            <div>
                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Inversión</p>
                                <p className="text-xs md:text-sm font-black text-slate-300">{formatCurrency(e.inversion)}</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Recaudado</p>
                                <p className="text-xs md:text-sm font-black text-emerald-400">{formatCurrency(e.cash_collected)}</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Ganancia</p>
                                <p className={`text-xs md:text-sm font-black ${profit >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                                    {formatCurrency(profit)}
                                </p>
                            </div>
                        </div>

                        {/* Ratios clave del Embudo */}
                        <div className="grid grid-cols-3 gap-y-3 gap-x-2 text-xs">
                            <div>
                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Leads (WA)</p>
                                <p className="font-bold text-white">{e.leads} <span className="text-[9px] text-slate-500">({e.whatsapp_leads})</span></p>
                            </div>
                            <div>
                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Show Up</p>
                                <p className="font-bold text-white">{e.show_up} <span className="text-[9px] text-indigo-400 font-black">{e.show_up_rate}%</span></p>
                            </div>
                            <div>
                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Agendas</p>
                                <p className="font-bold text-white">{e.agendas_exitosas}</p>
                            </div>
                            <div>
                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Conv. Leads</p>
                                <p className="font-bold text-white">{e.conversion_leads}%</p>
                            </div>
                            <div>
                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Costo Agenda</p>
                                <p className="font-bold text-white">{formatCurrency(e.costo_por_agenda)}</p>
                            </div>
                            <div>
                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Ventas (Closes)</p>
                                <p className="font-bold text-white">{e.sales} <span className="text-[9px] text-emerald-400 font-black">{e.pct_close_rate}%</span></p>
                            </div>
                        </div>

                        {/* Footer con acciones */}
                        <div className="flex justify-between items-center border-t border-slate-900 pt-4 mt-2">
                            <button
                                onClick={() => onSelectFunnel(e)}
                                className="flex items-center gap-1.5 text-[9px] text-indigo-400 hover:text-indigo-300 font-black uppercase tracking-widest transition-colors cursor-pointer"
                            >
                                Ver Embudo Detallado
                                <ArrowRight size={10} />
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onEdit(e)}
                                    className="p-2 bg-slate-950 border border-slate-800 rounded-xl hover:bg-slate-800 hover:text-white text-slate-400 transition-colors"
                                    title="Editar evento"
                                >
                                    <Edit2 size={12} />
                                </button>
                                <button
                                    onClick={() => onDelete(e.id)}
                                    className="p-2 bg-slate-950 border border-slate-800 rounded-xl hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 transition-colors"
                                    title="Eliminar evento"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default WorkshopCardsView;
