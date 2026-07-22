import React from 'react';

const SetterBulkActionBar = ({
    selectedIds,
    onClearSelection,
    activeStep,
    submittingBulk,
    onBulkUpdate,
    availableKeywords
}) => {
    if (!selectedIds || selectedIds.size === 0) return null;

    return (
        <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-3xl flex flex-wrap items-center justify-between gap-4 text-left animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-400 px-3 py-1.5 rounded-xl border border-violet-500/20">
                    {selectedIds.size} Leads Marcados
                </span>
                <button 
                    onClick={onClearSelection}
                    className="text-[9px] font-black uppercase text-slate-500 hover:text-white underline cursor-pointer"
                >
                    Limpiar
                </button>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap md:flex-nowrap">
                {/* Acciones en Lote */}
                {activeStep === 'cualificacion' && (
                    <>
                        <button
                            onClick={() => onBulkUpdate('Cualificado')}
                            disabled={submittingBulk}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/20"
                        >
                            ✓ Cualificar
                        </button>
                        <button
                            onClick={() => onBulkUpdate('Descualificado')}
                            disabled={submittingBulk}
                            className="px-4 py-2 bg-rose-650 hover:bg-rose-550 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/20"
                        >
                            ✕ Descualificar
                        </button>
                    </>
                )}

                {/* Selector de anuncio en lote */}
                {availableKeywords.length > 0 && (
                    <select
                        onChange={(e) => {
                            if (e.target.value) {
                                onBulkUpdate(null, e.target.value);
                                e.target.value = '';
                            }
                        }}
                        disabled={submittingBulk}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-300 outline-none focus:border-violet-500/50 cursor-pointer"
                    >
                        <option value="">Asociar Anuncio...</option>
                        {availableKeywords.map(k => (
                            <option key={k.id} value={k.slug}>{k.name} ({k.slug})</option>
                        ))}
                    </select>
                )}
            </div>
        </div>
    );
};

export default SetterBulkActionBar;
