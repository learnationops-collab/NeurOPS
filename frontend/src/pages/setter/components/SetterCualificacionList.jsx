import { AnimatePresence } from 'framer-motion';
import { Loader2, Check } from 'lucide-react';
import SetterLeadRow from './SetterLeadRow';

/**
 * La cola de leads cualificados del setter (paso 1).
 *
 * Extraído de SetterWorkflowPage, que ya pasaba las 500 líneas del proyecto. Es
 * el mismo JSX de antes: sólo cambia de archivo.
 */
const SetterCualificacionList = ({
    loading,
    cualificacionTab,
    setCualificacionTab,
    leadsPorProcesar,
    leadsProcesados,
    filteredLeads,
    selectedIds,
    toggleSelectAll,
    toggleSelect,
    selectedLead,
    processingId,
    handleSelectLead,
    handleQuickAction,
    activeStep,
}) => (
                <div className="bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 shadow-xl space-y-4">
                    
                    {/* Selector de Sub-Pestañas para Paso de Cualificación */}
                    {activeStep === 'cualificacion' ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900 pb-4">
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={() => setCualificacionTab('pendientes')}
                                    className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                        cualificacionTab === 'pendientes'
                                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-lg shadow-amber-500/10'
                                            : 'bg-slate-950 text-slate-400 border border-slate-900 hover:text-white hover:border-slate-800'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                                    Leads Cualificados Pendientes
                                    <span className="ml-1 px-2 py-0.5 rounded-full text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                                        {leadsPorProcesar.length}
                                    </span>
                                </button>

                                <button
                                    onClick={() => setCualificacionTab('procesados')}
                                    className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                        cualificacionTab === 'procesados'
                                            ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30 shadow-lg shadow-violet-500/10'
                                            : 'bg-slate-950 text-slate-400 border border-slate-900 hover:text-white hover:border-slate-800'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                                    Procesados
                                    <span className="ml-1 px-2 py-0.5 rounded-full text-[9px] bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold">
                                        {leadsProcesados.length}
                                    </span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={filteredLeads.length > 0 && selectedIds.size === filteredLeads.length}
                                    onChange={toggleSelectAll}
                                    className="rounded bg-slate-950 border-slate-800 text-violet-500 focus:ring-0 cursor-pointer w-4 h-4"
                                />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Seleccionar Todos
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap justify-between items-center border-b border-slate-900 pb-4 gap-2">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={filteredLeads.length > 0 && selectedIds.size === filteredLeads.length}
                                    onChange={toggleSelectAll}
                                    className="rounded bg-slate-950 border-slate-800 text-violet-500 focus:ring-0 cursor-pointer w-4 h-4"
                                />
                                <h3 className="text-xs font-black text-white italic uppercase tracking-wider">
                                    Agendas Atribuidas
                                </h3>
                            </div>
                            <span className="text-[10px] font-black bg-slate-900 text-slate-350 border border-slate-800 px-3 py-1 rounded-xl">
                                {filteredLeads.length} Agendas
                            </span>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="animate-spin text-violet-500" size={32} />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cargando cola de trabajo...</span>
                        </div>
                    ) : (
                        <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar">
                            {activeStep === 'cualificacion' ? (
                                cualificacionTab === 'pendientes' ? (
                                    leadsPorProcesar.length === 0 ? (
                                        <div className="text-center py-16 space-y-3">
                                            <div className="text-emerald-400 text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2">
                                                <Check size={18} />
                                                <span>¡No tienes leads cualificados pendientes por evaluar!</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                                Todos los leads cualificados de este periodo han sido procesados.
                                            </p>
                                            {leadsProcesados.length > 0 && (
                                                <button
                                                    onClick={() => setCualificacionTab('procesados')}
                                                    className="mt-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:border-violet-500/30 text-violet-400 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                                                >
                                                    Ver pestaña de procesados ({leadsProcesados.length})
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <AnimatePresence initial={false}>
                                            {leadsPorProcesar.map((l) => (
                                                <SetterLeadRow
                                                    key={l.id}
                                                    lead={l}
                                                    activeStep={activeStep}
                                                    isSelected={selectedIds.has(l.id)}
                                                    isViewed={selectedLead?.id === l.id}
                                                    processingId={processingId}
                                                    onSelectLead={handleSelectLead}
                                                    onToggleSelect={toggleSelect}
                                                    onQuickAction={handleQuickAction}
                                                />
                                            ))}
                                        </AnimatePresence>
                                    )
                                ) : (
                                    leadsProcesados.length === 0 ? (
                                        <div className="text-center py-16 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                            Aún no has procesado ningún lead en este periodo.
                                        </div>
                                    ) : (
                                        <AnimatePresence initial={false}>
                                            {leadsProcesados.map((l) => (
                                                <SetterLeadRow
                                                    key={l.id}
                                                    lead={l}
                                                    activeStep={activeStep}
                                                    isSelected={selectedIds.has(l.id)}
                                                    isViewed={selectedLead?.id === l.id}
                                                    processingId={processingId}
                                                    onSelectLead={handleSelectLead}
                                                    onToggleSelect={toggleSelect}
                                                    onQuickAction={handleQuickAction}
                                                />
                                            ))}
                                        </AnimatePresence>
                                    )
                                )
                            ) : null}
                        </div>
                    )}
            </div>
);

export default SetterCualificacionList;
