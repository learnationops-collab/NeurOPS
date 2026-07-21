import React, { useState, useEffect } from 'react';
import { Calendar, X, Check, Loader2 } from 'lucide-react';

const TriageFollowUpModal = ({
    show,
    onClose,
    onConfirm,
    onMarkLost,
    leadName,
    newStatus,
    subtitle = "Call Confirmer Workflow",
    isSaleFollowUp = false,
    loading = false
}) => {
    const [followUpDate, setFollowUpDate] = useState('');
    const [followUpCobroDate, setFollowUpCobroDate] = useState('');

    useEffect(() => {
        if (show) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            setFollowUpDate(tomorrowStr);
            setFollowUpCobroDate('');
        }
    }, [show]);

    if (!show) return null;

    const isNextFollowUp = newStatus === 'Seguimiento Realizado';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 relative">
                
                <div className="flex justify-between items-start border-b border-slate-800/80 pb-4">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">
                            {subtitle}
                        </span>
                        <h3 className="text-lg font-black text-white italic tracking-tight">
                            {isSaleFollowUp ? 'Configurar Seguimientos Post-Venta' : isNextFollowUp ? '¿Programar Próximo Seguimiento?' : '¿Programar Seguimiento?'}
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
                    {isSaleFollowUp ? (
                        <>
                            ¡Venta registrada para <strong className="text-white italic">{leadName}</strong>! 
                            Puedes programar una fecha de <strong>Seguimiento de Cobro</strong> (ej. segundo pago/cuotas) y/o un <strong>Seguimiento Normal / Onboarding</strong>.
                        </>
                    ) : isNextFollowUp ? (
                        <>
                            Has marcado el seguimiento de <strong className="text-white italic">{leadName}</strong> como{' '}
                            <span className="text-emerald-400 font-black uppercase">Completado</span>. 
                            ¿Deseas agendar un <strong>nuevo seguimiento futuro</strong> para este prospecto?
                        </>
                    ) : (
                        <>
                            Has marcado a <strong className="text-white italic">{leadName}</strong> como{' '}
                            <span className="text-amber-400 font-black uppercase">{newStatus}</span>. 
                            Selecciona una fecha para que aparezca en tu lista de <strong>Seguimientos por hacer</strong> o descártalo como lead perdido.
                        </>
                    )}
                </p>

                {isSaleFollowUp ? (
                    <div className="space-y-4">
                        <div className="space-y-1.5 bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/10">
                            <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block flex items-center gap-1.5">
                                <Calendar size={12} className="text-emerald-400" />
                                Seguimiento de Cobro (opcional)
                            </label>
                            <input
                                type="date"
                                value={followUpCobroDate}
                                onChange={(e) => setFollowUpCobroDate(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-bold cursor-pointer"
                            />
                        </div>
                        <div className="space-y-1.5 bg-violet-500/5 p-3 rounded-2xl border border-violet-500/10">
                            <label className="text-[10px] font-black text-violet-400 uppercase tracking-widest block flex items-center gap-1.5">
                                <Calendar size={12} className="text-violet-400" />
                                Seguimiento Normal / Onboarding (opcional)
                            </label>
                            <input
                                type="date"
                                value={followUpDate}
                                onChange={(e) => setFollowUpDate(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all font-bold cursor-pointer"
                            />
                        </div>
                    </div>
                ) : (
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
                )}

                {onMarkLost && !isSaleFollowUp && (
                    <div className="pt-1">
                        <button
                            type="button"
                            onClick={onMarkLost}
                            disabled={loading}
                            className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            🚫 Lead Perdido / Descartado
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-3 pt-1">
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
                        onClick={() => {
                            if (isSaleFollowUp) {
                                onConfirm({ normal: followUpDate, cobro: followUpCobroDate });
                            } else {
                                onConfirm(followUpDate);
                            }
                        }}
                        disabled={loading || (!isSaleFollowUp && !followUpDate) || (isSaleFollowUp && !followUpDate && !followUpCobroDate)}
                        className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border-none"
                    >
                        {loading ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <>
                                <Check size={14} />
                                <span>{isSaleFollowUp ? 'Guardar Seguimientos' : 'Guardar Fecha'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TriageFollowUpModal;
