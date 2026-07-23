import React from 'react';
import { Link2, RefreshCw, Loader2, Check, Instagram, ExternalLink } from 'lucide-react';

const UnattributedAgendasSection = ({
    unattributedAgendas,
    loadingUnattributed,
    fetchUnattributedAgendas,
    agendaIgMap,
    setAgendaIgMap,
    selectedAdsMap,
    setSelectedAdsMap,
    availableKeywords,
    handleAssignAdToAgenda,
    assigningId
}) => {
    return (
        <div className="bg-gradient-to-r from-amber-500/10 via-slate-900/90 to-amber-500/5 border border-amber-500/20 rounded-[2rem] p-6 space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-amber-500/15 pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                            <Link2 size={16} />
                        </span>
                        <h3 className="text-sm font-black text-white italic tracking-wider uppercase">
                            Agendas Desatribuidas
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {unattributedAgendas.length} pendientes
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                        Agendas de la fuente Elias que no tienen anuncio asociado. Asigna el anuncio correspondiente para completar la atribución.
                    </p>
                </div>
                <button
                    onClick={fetchUnattributedAgendas}
                    disabled={loadingUnattributed}
                    className="p-2.5 bg-slate-950 border border-amber-500/20 hover:border-amber-500/40 rounded-xl text-slate-400 hover:text-white transition-colors shrink-0 self-start md:self-auto cursor-pointer"
                    title="Actualizar agendas desatribuidas"
                >
                    <RefreshCw size={14} className={loadingUnattributed ? 'animate-spin text-amber-400' : ''} />
                </button>
            </div>

            {loadingUnattributed ? (
                <div className="flex items-center justify-center py-6 text-slate-500 gap-2">
                    <Loader2 size={18} className="animate-spin text-amber-400" />
                    <span className="text-xs font-bold uppercase">Cargando agendas desatribuidas...</span>
                </div>
            ) : unattributedAgendas.length === 0 ? (
                <div className="text-center py-4 text-xs font-bold text-emerald-400 flex items-center justify-center gap-2">
                    <Check size={16} />
                    <span>No hay agendas de Elias pendientes de atribución. ¡Todas cuentan con anuncio asociado!</span>
                </div>
            ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                    {unattributedAgendas.map(agenda => (
                        <div 
                            key={agenda.id}
                            className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-amber-500/30 transition-all"
                        >
                            <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-black text-xs text-white uppercase">{agenda.cliente}</span>
                                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                        Fuente: {agenda.setter}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold flex-wrap">
                                    <span>
                                        IG: {' '}
                                        {agenda.instagram && agenda.instagram !== 'N/A' ? (
                                            <a 
                                                href={`https://instagram.com/ ${(agenda.instagram || '').replace('@', '').trim()}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-amber-400 hover:text-amber-300 hover:underline font-bold inline-flex items-center gap-1"
                                                title="Abrir perfil de Instagram"
                                            >
                                                @{(agenda.instagram || '').replace('@', '').trim()}
                                                <ExternalLink size={9} />
                                            </a>
                                        ) : (
                                            <strong className="text-slate-500">N/A</strong>
                                        )}
                                    </span>
                                    <span>WA: <strong className="text-slate-200">{agenda.whatsapp}</strong></span>
                                    {agenda.fecha_meet && agenda.fecha_meet !== 'N/A' && (
                                        <span>Cita: <strong className="text-indigo-400">{agenda.fecha_meet}</strong></span>
                                    )}
                                    <span>Closer: <strong className="text-slate-300">{agenda.closer}</strong></span>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto shrink-0">
                                {/* Input editable de Instagram del Lead */}
                                <div className="relative w-full sm:w-44">
                                    <Instagram size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/80" />
                                    <input
                                        type="text"
                                        placeholder="@instagram_lead"
                                        value={agendaIgMap[agenda.id] ?? (agenda.instagram && agenda.instagram !== 'N/A' ? agenda.instagram : '')}
                                        onChange={(e) => setAgendaIgMap(prev => ({ ...prev, [agenda.id]: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-amber-500/50"
                                        title="Escribe o verifica el Instagram del Lead para vincular con ManyChat"
                                    />
                                </div>



                                {/* Selector de anuncio (Meta Ad) */}
                                <select
                                    value={selectedAdsMap[agenda.id] || ''}
                                    onChange={(e) => setSelectedAdsMap(prev => ({ ...prev, [agenda.id]: e.target.value }))}
                                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-amber-500/50 w-full sm:w-56 cursor-pointer"
                                >
                                    <option value="">Seleccionar anuncio (Meta Ad)...</option>
                                    {availableKeywords.map(ad => (
                                        <option key={ad.id} value={ad.id}>
                                            {ad.name} ({ad.slug})
                                        </option>
                                    ))}
                                </select>

                                {/* Botón Asignar Anuncio */}
                                <button
                                    onClick={() => handleAssignAdToAgenda(agenda)}
                                    disabled={assigningId === agenda.id || !selectedAdsMap[agenda.id]}
                                    className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer w-full sm:w-auto"
                                >
                                    {assigningId === agenda.id ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <>
                                            <Check size={14} />
                                            Asignar Anuncio
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UnattributedAgendasSection;
