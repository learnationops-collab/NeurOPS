import React from 'react';
import { Bot } from 'lucide-react';
import { REPORT_TYPES } from './reportTypes';

// Primer paso del chat de reportes: qué tipo de reporte es.
const ReportTypeStep = ({ onSelect }) => (
    <div className="space-y-3">
        <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                <Bot size={14} />
            </div>
            <div className="bg-surface rounded-2xl rounded-tl-sm p-3 text-sm max-w-[85%]">
                ¿Qué querés reportar?
            </div>
        </div>
        <div className="pl-9 grid grid-cols-1 gap-2">
            {REPORT_TYPES.map(({ id, icon: Icon, boton, icono, titulo, sub }) => (
                <button
                    key={id}
                    onClick={() => onSelect(id)}
                    className={`flex items-start gap-3 text-left bg-surface border border-base rounded-2xl p-3 transition-all active:scale-[0.98] ${boton}`}
                >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${icono}`}>
                        <Icon size={16} />
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide">{titulo}</p>
                        <p className="text-[11px] text-muted">{sub}</p>
                    </div>
                </button>
            ))}
        </div>
    </div>
);

export default ReportTypeStep;
