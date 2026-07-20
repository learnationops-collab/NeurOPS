import React from 'react';
import { Sparkles, Save, Loader2 } from 'lucide-react';

const LeadRoadmapCalificacion = ({
    dolores,
    setDolores,
    objeciones,
    setObjeciones,
    observaciones,
    setObservaciones,
    handleSaveCalificacion,
    savingCalificacion,
    userRole
}) => {
    const isConfirmer = userRole === 'triage';
    const isSetter = userRole === 'setter';
    const isCloser = userRole === 'closer';
    const isAdmin = userRole === 'admin';

    return (
        <div className="bg-slate-900/40 p-6 rounded-3xl border border-violet-950/40 space-y-4 shadow-xl relative overflow-hidden text-left">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-violet-500 to-amber-500" />
            
            <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} className="text-violet-400" />
                    Calificación en Caliente
                </h4>
                <span className="text-[9px] font-bold text-slate-400 bg-slate-950 border border-slate-850 px-2 py-0.5 rounded-md">
                    Quick Save
                </span>
            </div>

            {/* DOLORES */}
            <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Dolores del Prospecto</label>
                {isConfirmer || isCloser ? (
                    <div className="px-3.5 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-slate-300 font-bold whitespace-pre-wrap min-h-[3.5rem]">
                        {dolores || "Sin dolores registrados por el setter"}
                    </div>
                ) : (
                    <textarea
                        className="w-full h-20 px-3.5 py-2.5 bg-slate-950/50 border border-transparent rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:bg-slate-900 transition-all font-bold resize-none custom-scrollbar"
                        placeholder="Ingresa los dolores del prospecto..."
                        value={dolores}
                        onChange={(e) => setDolores(e.target.value)}
                    />
                )}
            </div>

            {/* OBJECIONES */}
            {!isConfirmer && (
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Objeciones</label>
                    {isSetter ? (
                        <div className="px-3.5 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-slate-300 font-bold whitespace-pre-wrap min-h-[3.5rem]">
                            {objeciones || "Sin objeciones registradas por el closer"}
                        </div>
                    ) : (
                        <textarea
                            className="w-full h-20 px-3.5 py-2.5 bg-slate-950/50 border border-transparent rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:bg-slate-900 transition-all font-bold resize-none custom-scrollbar"
                            placeholder="Ingresa las objeciones del prospecto..."
                            value={objeciones}
                            onChange={(e) => setObjeciones(e.target.value)}
                        />
                    )}
                </div>
            )}

            {/* OBSERVACIONES */}
            <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Observaciones del Call Confirmer</label>
                {isConfirmer || isAdmin ? (
                    <textarea
                        className="w-full h-24 px-3.5 py-2.5 bg-slate-950/50 border border-transparent rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:bg-slate-900 transition-all font-bold resize-none custom-scrollbar"
                        placeholder="Notas del call confirmer..."
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                    />
                ) : (
                    <div className="px-3.5 py-2.5 bg-slate-950/60 border border-slate-850 rounded-xl text-xs text-slate-300 font-bold whitespace-pre-wrap min-h-[3.5rem]">
                        {observaciones || "Sin observaciones del call confirmer"}
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={handleSaveCalificacion}
                disabled={savingCalificacion}
                className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border-none"
            >
                {savingCalificacion ? (
                    <Loader2 size={12} className="animate-spin" />
                ) : (
                    <>
                        <Save size={12} />
                        <span>Guardar Calificación</span>
                    </>
                )}
            </button>
        </div>
    );
};

export default LeadRoadmapCalificacion;
