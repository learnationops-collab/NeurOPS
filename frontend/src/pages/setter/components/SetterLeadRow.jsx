import React from 'react';
import { motion } from 'framer-motion';
import { 
    Instagram, ExternalLink, Check, X, Loader2, Calendar, ChevronRight, Phone
} from 'lucide-react';

const SetterLeadRow = ({ 
    lead, 
    activeStep, 
    isSelected, 
    isViewed, 
    processingId, 
    onSelectLead, 
    onToggleSelect, 
    onQuickAction 
}) => {
    if (!lead) return null;

    // Notificación de comentarios sin leer
    const unreadKey = `read_comments_${lead.client_id}`;
    const readCount = parseInt(localStorage.getItem(unreadKey) || '0');
    const hasUnread = lead.unread_comment || (lead.client_id && lead.comments_count > readCount);

    // Formatear enlace directo a perfil de Instagram
    const rawIg = lead.instagram || '';
    const igClean = rawIg.replace('@', '').trim();
    const igUrl = lead.ig_chat_link && lead.ig_chat_link.startsWith('http')
        ? lead.ig_chat_link
        : (igClean ? `https://instagram.com/${igClean}` : null);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => onSelectLead(lead)}
            className={`p-4 rounded-2xl border transition-all cursor-pointer text-left flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group ${
                isViewed 
                    ? 'bg-violet-650/10 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.1)]' 
                    : 'bg-black/20 border-slate-900/60 hover:bg-slate-900/50 hover:border-slate-800'
            }`}
        >
            {/* Contenido principal (Checkbox, Avatar y texto) */}
            <div className="flex items-center gap-4 min-w-0 flex-1 w-full">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onToggleSelect(lead.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded bg-slate-950 border-slate-800 text-violet-500 focus:ring-0 cursor-pointer w-4 h-4 shrink-0"
                />
                
                {/* Avatar de Canal / Tipo */}
                {activeStep === 'cualificacion' ? (
                    <div className="w-12 h-12 bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shrink-0 relative">
                        <Instagram size={24} className="text-white" />
                        {hasUnread && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-600 rounded-full border-2 border-slate-950 flex items-center justify-center animate-bounce" title="Nuevas notas">
                                <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="w-12 h-12 bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg shrink-0 relative">
                        <Calendar size={24} className="text-slate-950 font-bold" />
                        {hasUnread && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-600 rounded-full border-2 border-slate-950 flex items-center justify-center animate-bounce" title="Nuevas notas">
                                <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                            </span>
                        )}
                    </div>
                )}

                <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 items-center">
                    {/* Nombre e IG */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-black text-white leading-tight truncate font-bold flex items-center gap-2">
                                {lead.lead_name || 'Sin Nombre'}
                                {hasUnread && (
                                    <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md animate-pulse">
                                        Mensaje nuevo
                                    </span>
                                )}
                            </h4>
                            {(() => {
                                const status = String(lead.result || '').toLowerCase();
                                if (status === 'yes' || status === 'true' || status === 'cualificado') {
                                    return (
                                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full shrink-0">
                                            Cualificado
                                        </span>
                                    );
                                }
                                if (status === 'no' || status === 'false' || status === 'descualificado') {
                                    return (
                                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full shrink-0">
                                            Descualificado
                                        </span>
                                    );
                                }
                                if (status === 'agendado' || activeStep === 'agendas') {
                                    return (
                                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full shrink-0">
                                            Agendado
                                        </span>
                                    );
                                }
                                return (
                                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full shrink-0">
                                        Pendiente
                                    </span>
                                );
                            })()}
                        </div>

                        {/* Enlace directo a perfil de IG */}
                        {igUrl ? (
                            <a
                                href={igUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1 hover:underline cursor-pointer w-max"
                                onClick={(e) => e.stopPropagation()}
                                title="Abrir perfil de Instagram directamente"
                            >
                                <Instagram size={11} className="shrink-0 text-violet-400" />
                                <span>@{igClean}</span>
                                <ExternalLink size={10} className="shrink-0 opacity-70" />
                            </a>
                        ) : (
                            <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                                <Instagram size={10} className="shrink-0" />
                                Sin Instagram
                            </span>
                        )}
                    </div>

                    {/* Anuncio */}
                    <div className="space-y-1">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            {activeStep === 'agendas' ? 'Origen / Anuncio' : 'Anuncio'}
                        </div>
                        <div className="text-xs font-black text-violet-400 truncate max-w-[200px]" title={lead.ad_name || lead.keyword}>
                            {lead.ad_name || lead.keyword || 'Desatribuido'}
                        </div>
                    </div>

                    {/* Fecha / Hora */}
                    <div className="space-y-1 md:text-right">
                        <div className="text-xs font-black text-white">
                            {lead.start_time ? (() => {
                                const date = new Date(lead.start_time);
                                return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                            })() : 'Sin fecha'}
                        </div>
                        {lead.start_time && (
                            <div className="text-[9px] text-slate-400 font-mono font-bold">
                                {new Date(lead.start_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Acciones directas a la derecha */}
            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                {/* Paso Cualificación: Botones de confirmación rápida */}
                {activeStep === 'cualificacion' && (
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={(e) => onQuickAction(lead.id, 'Cualificado', e)}
                            disabled={processingId === lead.id}
                            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/15 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 flex-1 md:flex-initial"
                            title="Confirmar cualificado"
                        >
                            {processingId === lead.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Confirmar cualificado
                        </button>
                        <button
                            onClick={(e) => onQuickAction(lead.id, 'Descualificado', e)}
                            disabled={processingId === lead.id}
                            className="h-9 w-9 bg-slate-900 border border-slate-800 hover:bg-rose-550/10 hover:border-rose-500/20 text-slate-400 hover:text-rose-500 font-black rounded-xl transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                            title="Descualificar"
                        >
                            {processingId === lead.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                        </button>
                    </div>
                )}

                {/* Paso Agendas: Botón directo para ingresar a Instagram */}
                {activeStep === 'agendas' && (
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        {igUrl ? (
                            <a
                                href={igUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="h-9 px-3.5 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 hover:from-purple-500 hover:to-rose-400 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-purple-600/20 flex items-center justify-center gap-1.5 cursor-pointer flex-1 md:flex-initial"
                                title="Entrar directamente al perfil de Instagram"
                            >
                                <Instagram size={13} />
                                <span>Perfil IG</span>
                                <ExternalLink size={11} />
                            </a>
                        ) : (
                            <span className="text-[10px] text-slate-500 font-bold italic px-3 py-2 bg-slate-900 rounded-xl border border-slate-800">
                                Sin IG
                            </span>
                        )}
                        {lead.phone && (
                            <a
                                href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="h-9 w-9 bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white text-emerald-400 rounded-xl transition-all flex items-center justify-center cursor-pointer"
                                title="Abrir WhatsApp"
                            >
                                <Phone size={13} />
                            </a>
                        )}
                    </div>
                )}

                <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors hidden md:block" />
            </div>
        </motion.div>
    );
};

export default SetterLeadRow;
