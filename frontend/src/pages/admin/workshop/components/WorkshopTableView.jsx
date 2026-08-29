import React from 'react';
import { Edit2, Trash2, ArrowRight } from 'lucide-react';

const WorkshopTableView = ({ events, onSelectFunnel, onEdit, onDelete, formatDate, formatCurrency, selectedIds, onToggleSelect }) => {
    return (
        <div className="bg-slate-950 border border-slate-900 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900/50 border-b border-slate-900">
                            {onToggleSelect && <th className="p-4 w-8" />}
                            <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                            <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Workshop / Evento</th>
                            <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Inversión</th>
                            <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Recaudado</th>
                            <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Profit Neto</th>
                            <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Leads</th>
                            <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">CPL</th>
                            <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Show Up %</th>
                            <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Agendas</th>
                            <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">CPA</th>
                            <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ventas</th>
                            <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">ROAS</th>
                            <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/50">
                        {events.map((e) => {
                            const profit = e.cash_collected - e.inversion;
                            const isSelected = selectedIds?.includes(e.id);
                            return (
                                <tr key={e.id} className={`hover:bg-slate-900/25 transition-colors group ${isSelected ? 'bg-indigo-500/5' : ''}`}>
                                    {onToggleSelect && (
                                        <td className="p-4">
                                            <button
                                                onClick={() => onToggleSelect(e.id)}
                                                title="Seleccionar para comparar"
                                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-transparent hover:border-slate-500'}`}
                                            >
                                                ✓
                                            </button>
                                        </td>
                                    )}
                                    <td className="p-4 text-xs font-black text-white whitespace-nowrap italic">{formatDate(e.date)}</td>
                                    <td className="p-4 text-xs font-black text-slate-300 uppercase tracking-wider">{e.name}</td>
                                    <td className="p-4 text-xs font-black text-slate-300 text-right whitespace-nowrap">{formatCurrency(e.inversion)}</td>
                                    <td className="p-4 text-xs font-black text-emerald-400 text-right whitespace-nowrap">{formatCurrency(e.cash_collected)}</td>
                                    <td className={`p-4 text-xs font-black text-right whitespace-nowrap ${profit >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                                        {formatCurrency(profit)}
                                    </td>
                                    <td className="p-4 text-xs font-black text-indigo-300 text-right">{e.leads.toLocaleString()}</td>
                                    <td className="p-4 text-xs font-black text-slate-400 text-right whitespace-nowrap">{formatCurrency(e.cpl)}</td>
                                    <td className="p-4 text-xs font-bold text-slate-400 text-right">{e.show_up_rate}%</td>
                                    <td className="p-4 text-xs font-black text-white text-right">{e.agendas_exitosas}</td>
                                    <td className="p-4 text-xs font-black text-slate-400 text-right whitespace-nowrap">{formatCurrency(e.costo_por_agenda)}</td>
                                    <td className="p-4 text-xs font-black text-white text-right">{e.sales}</td>
                                    <td className="p-4 text-xs text-right">
                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest ${
                                            e.roas >= 3 
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                                : e.roas >= 1.5 
                                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                                                : e.roas >= 1.0 
                                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                        }`}>
                                            {e.roas.toFixed(2)}x
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <button
                                                onClick={() => onSelectFunnel(e)}
                                                className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-indigo-600 hover:text-white text-indigo-400 transition-colors"
                                                title="Ver embudo"
                                            >
                                                <ArrowRight size={12} />
                                            </button>
                                            <button
                                                onClick={() => onEdit(e)}
                                                className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 hover:text-white text-slate-400 transition-colors"
                                                title="Editar datos"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                onClick={() => onDelete(e.id)}
                                                className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 transition-colors"
                                                title="Eliminar evento"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default WorkshopTableView;
