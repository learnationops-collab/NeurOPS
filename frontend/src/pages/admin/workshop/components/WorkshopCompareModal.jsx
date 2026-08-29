import React from 'react';
import { X } from 'lucide-react';

const ROWS = [
    { key: 'inversion', label: 'Inversión', fmt: 'currency' },
    { key: 'leads', label: 'Leads', fmt: 'number' },
    { key: 'whatsapp_leads', label: 'Leads en WhatsApp', fmt: 'number' },
    { key: 'show_up', label: 'Show up webinar', fmt: 'number' },
    { key: 'agendas_exitosas', label: 'Agendas exitosas', fmt: 'number' },
    { key: 'show_up_sales_call', label: 'Show up cita', fmt: 'number' },
    { key: 'sales', label: 'Ventas', fmt: 'number' },
    { key: 'cash_collected', label: 'Cash cobrado', fmt: 'currency' },
    { key: 'cpl', label: 'CPL', fmt: 'currency' },
    { key: 'costo_por_agenda', label: 'Costo por agenda', fmt: 'currency' },
    { key: 'ticket_promedio', label: 'Ticket promedio', fmt: 'currency' },
    { key: 'roas', label: 'ROAS', fmt: 'roas' },
];

const WorkshopCompareModal = ({ events, onClose, formatDate, formatCurrency }) => {
    const fmtVal = (val, fmt) => {
        if (fmt === 'currency') return formatCurrency(val || 0);
        if (fmt === 'roas') return `${(val || 0).toFixed(2)}x`;
        return (val || 0).toLocaleString('en-US');
    };

    // Mejor valor de cada fila resaltado en verde — a simple vista, cuál
    // taller gana en cada métrica (costo por agenda/CPL: menor es mejor).
    // "Inversión" queda sin ganador: gastar más o menos no es en sí mismo
    // bueno ni malo, depende de lo que devolvió — no confundir marcando un
    // monto más alto como "mejor".
    const bestId = (row) => {
        if (row.key === 'inversion') return null;
        const lowerIsBetter = row.key === 'cpl' || row.key === 'costo_por_agenda';
        return events.reduce((best, e) => {
            const v = e[row.key] || 0;
            const bv = best ? best[row.key] || 0 : null;
            if (bv === null) return e;
            return lowerIsBetter ? (v < bv ? e : best) : (v > bv ? e : best);
        }, null)?.id;
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
            <div className="bg-slate-950 border border-slate-800 w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl border-indigo-500/20">
                <div className="px-8 py-6 bg-slate-900/40 border-b border-slate-900 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Comparar talleres</h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{events.length} seleccionados</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-900 text-slate-500 hover:text-white transition-all cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-x-auto max-h-[65vh]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/50 border-b border-slate-900 sticky top-0">
                                <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Métrica</th>
                                {events.map((e) => (
                                    <th key={e.id} className="p-4 text-[9px] font-black text-white uppercase tracking-widest text-right whitespace-nowrap">
                                        {formatDate(e.date)}
                                        <div className="text-slate-500 font-bold normal-case text-[10px] mt-0.5">{e.name}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/50">
                            {ROWS.map((row) => {
                                const winnerId = bestId(row);
                                return (
                                    <tr key={row.key}>
                                        <td className="p-4 text-xs font-bold text-slate-400">{row.label}</td>
                                        {events.map((e) => (
                                            <td key={e.id} className={`p-4 text-xs font-black text-right whitespace-nowrap ${e.id === winnerId ? 'text-emerald-400' : 'text-slate-200'}`}>
                                                {fmtVal(e[row.key], row.fmt)}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WorkshopCompareModal;
