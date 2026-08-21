import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, RefreshCw, Loader2, Check, Instagram, ExternalLink, Link2Off, Phone
} from 'lucide-react';

/**
 * La lista única de agendas del setter.
 *
 * Antes esto eran dos listas: un panel de "Agendas Desatribuidas" arriba (con los
 * campos para corregir el Instagram y asignar el anuncio) y una lista de "Agendas
 * Atribuidas" abajo. La misma agenda salía en las dos y cada mitad hacía sólo la
 * mitad del trabajo: arriba se podía atribuir pero no abrir el lead, abajo al
 * revés.
 *
 * Ahora es una sola fila por agenda: se hace clic para abrir el lead y, si le
 * falta el anuncio, se resuelve ahí mismo sin cambiar de lista.
 */
const SetterAgendasList = ({
    agendas,
    cargando,
    onRefrescar,
    onAbrirLead,
    availableKeywords,
    agendaIgMap,
    setAgendaIgMap,
    selectedAdsMap,
    setSelectedAdsMap,
    onAsignarAnuncio,
    onGuardarInstagram,
    assigningId,
    guardandoIgId,
}) => {
    const [editandoIg, setEditandoIg] = useState(null);

    const igDe = (a) => agendaIgMap[a.id] ?? ((a.instagram && a.instagram !== 'N/A') ? a.instagram : '');
    const igLimpio = (v) => (v || '').replace('@', '').trim();

    const fecha = (iso) => {
        if (!iso) return 'Sin fecha';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return `${d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} · ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    };

    const sinAnuncio = agendas.filter(a => !a.tiene_anuncio).length;

    return (
        <div className="bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900 pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400"><Calendar size={16} /></span>
                    <h3 className="text-sm font-black text-white italic tracking-wider uppercase">Mis Agendas</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-900 text-slate-300 border border-slate-800">
                        {agendas.length}
                    </span>
                    {sinAnuncio > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            {sinAnuncio} sin anuncio
                        </span>
                    )}
                </div>
                <button
                    onClick={onRefrescar}
                    disabled={cargando}
                    className="p-2.5 bg-slate-950 border border-slate-800 hover:border-slate-600 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Actualizar"
                >
                    <RefreshCw size={14} className={cargando ? 'animate-spin text-amber-400' : ''} />
                </button>
            </div>

            {cargando ? (
                <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
                    <Loader2 size={18} className="animate-spin text-amber-400" />
                    <span className="text-xs font-bold uppercase">Cargando tus agendas...</span>
                </div>
            ) : agendas.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs font-bold uppercase tracking-wide">
                    👏 ¡No tienes agendas en este rango!
                </div>
            ) : (
                <div className="space-y-3">
                    <AnimatePresence initial={false}>
                        {agendas.map(a => {
                            const editando = editandoIg === a.id;
                            const igActual = igDe(a);
                            const cambio = igLimpio(igActual) !== igLimpio(a.instagram);
                            return (
                                <motion.div
                                    key={a.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.97 }}
                                    className="bg-black/20 border border-slate-900/60 hover:border-slate-800 hover:bg-slate-900/40 rounded-2xl p-4 transition-all"
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                        {/* Zona clickeable: abre el lead */}
                                        <button
                                            onClick={() => onAbrirLead(a)}
                                            className="flex items-center gap-4 min-w-0 flex-1 text-left cursor-pointer group"
                                        >
                                            <div className="w-12 h-12 bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg shrink-0 relative">
                                                <Calendar size={24} className="text-slate-950" />
                                                {a.unread_comment && (
                                                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-600 rounded-full border-2 border-slate-950 animate-bounce" title="Mensajes nuevos" />
                                                )}
                                            </div>
                                            <div className="min-w-0 space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="text-sm font-black text-white truncate group-hover:text-amber-300 transition-colors">
                                                        {a.cliente}
                                                    </h4>
                                                    {a.unread_comment && (
                                                        <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md animate-pulse">
                                                            Mensaje nuevo
                                                        </span>
                                                    )}
                                                    <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-slate-950 text-slate-400 border border-slate-800 rounded-md">
                                                        {a.estado}
                                                    </span>
                                                    {a.tiene_anuncio ? (
                                                        <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                                                            {a.ad_name}
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md flex items-center gap-1">
                                                            <Link2Off size={9} /> Sin anuncio
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold flex-wrap">
                                                    <span className="text-amber-300/90">{fecha(a.date)}</span>
                                                    {a.whatsapp && (
                                                        <span className="flex items-center gap-1"><Phone size={10} />{a.whatsapp}</span>
                                                    )}
                                                    <span>Closer: <strong className="text-slate-300">{a.closer}</strong></span>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Instagram: se ve como enlace y se edita al tocarlo */}
                                        <div className="w-full lg:w-56 shrink-0">
                                            {editando || cambio ? (
                                                <div className="flex items-center gap-1.5">
                                                    <div className="relative flex-1">
                                                        <Instagram size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/80" />
                                                        <input
                                                            type="text"
                                                            autoFocus
                                                            placeholder="@instagram_lead"
                                                            value={igActual}
                                                            onChange={(e) => setAgendaIgMap(prev => ({ ...prev, [a.id]: e.target.value }))}
                                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-amber-500/50"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => { onGuardarInstagram(a); setEditandoIg(null); }}
                                                        disabled={guardandoIgId === a.id || !igLimpio(igActual)}
                                                        className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl transition-colors cursor-pointer"
                                                        title="Guardar Instagram"
                                                    >
                                                        {guardandoIgId === a.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-[10px] font-bold">
                                                    {igLimpio(a.instagram) ? (
                                                        <a
                                                            href={`https://instagram.com/${igLimpio(a.instagram)}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-amber-400 hover:text-amber-300 hover:underline inline-flex items-center gap-1 truncate"
                                                        >
                                                            @{igLimpio(a.instagram)}<ExternalLink size={9} />
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-600">Sin instagram</span>
                                                    )}
                                                    <button
                                                        onClick={() => setEditandoIg(a.id)}
                                                        className="text-[9px] uppercase tracking-wider text-slate-500 hover:text-white border border-slate-800 hover:border-slate-600 rounded-lg px-2 py-1 transition-colors cursor-pointer"
                                                    >
                                                        Cambiar
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Anuncio: solo cuando falta */}
                                        {!a.tiene_anuncio && (
                                            <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full lg:w-auto shrink-0">
                                                <select
                                                    value={selectedAdsMap[a.id] || ''}
                                                    onChange={(e) => setSelectedAdsMap(prev => ({ ...prev, [a.id]: e.target.value }))}
                                                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-amber-500/50 w-full sm:w-52 cursor-pointer"
                                                >
                                                    <option value="">Seleccionar anuncio...</option>
                                                    {availableKeywords.map(ad => (
                                                        <option key={ad.id} value={ad.id}>{ad.name} ({ad.slug})</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => onAsignarAnuncio(a)}
                                                    disabled={assigningId === a.id || !selectedAdsMap[a.id]}
                                                    className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-40 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                                >
                                                    {assigningId === a.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                                    Asignar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default SetterAgendasList;
