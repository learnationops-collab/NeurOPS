import React, { useState, useEffect } from 'react';
import { Calendar, X, Check, Loader2 } from 'lucide-react';

const TriageFollowUpModal = ({
    show,
    onClose,
    onConfirm,
    leadName,
    newStatus,
    loading = false
}) => {
    const [followUpDate, setFollowUpDate] = useState('');

    useEffect(() => {
        if (show) {
            // Predeterminar mañana a la fecha actual si no hay valor
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setFollowUpDate(tomorrow.toISOString().split('T')[0]);
        }
    }, [show]);

    if (!show) return null;

    const isNextFollowUp = newStatus === 'Seguimiento Realizado';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 relative">
                
                <div className="flex justify-between items-start border-b border-slate-800/80 pb-4">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">
                            Call Confirmer Workflow
                        </span>
                        <h3 className="text-lg font-black text-white italic tracking-tight">
                            {isNextFollowUp ? '¿Programar Próximo Seguimiento?' : '¿Programar Seguimiento?'}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-white transition-colors p-1 cursor-pointer bg-transparent border-none"
                    >
                        <X size={18} />
                    </button>
                </div>

                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    {isNextFollowUp ? (
                        <>
                            Has marcado el seguimiento de <strong className="text-white italic">{leadName}</strong> como{' '}
                            <span className="text-emerald-400 font-black uppercase">Completado</span>. 
                            ¿Deseas agendar un <strong>nuevo seguimiento futuro</strong> para este prospecto?
                        </>
                    ) : (
                        <>
                            Has marcado a <strong className="text-white italic">{leadName}</strong> como{' '}
                            <span className="text-amber-400 font-black uppercase">{newStatus}</span>. 
                            Selecciona una fecha para que aparezca en tu lista de <strong>Seguimientos por hacer</strong>.
                        </>
                    )}
                </p>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1.5">
                        <Calendar size={12} className="text-violet-400" />
                        Fecha del {isNextFollowUp ? 'Próximo Seguimiento' : 'Seguimiento'}
                    </label>
                    <input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-bold cursor-pointer"
                    />
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                        {isNextFollowUp ? 'Sin más seguimientos' : 'Omitir'}
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(followUpDate)}
                        disabled={loading || !followUpDate}
                        className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border-none"
                    >
                        {loading ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <>
                                <Check size={14} />
                                <span>Guardar Fecha</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TriageFollowUpModal;
