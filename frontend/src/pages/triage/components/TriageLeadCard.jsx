import React from 'react';
import { motion } from 'framer-motion';
import { Clock, MoreVertical, MessageSquare, AlertTriangle, CalendarCheck, CheckCircle2 } from 'lucide-react';
import { parseUtcIso } from '../../../utils/datetime';

const TriageLeadCard = ({ lead, sectionType, isSelected, onSelect, onActionClick, onOpenMenu, onMarkFollowUpDone }) => {
    // Hora del meet en la zona horaria de quien mira. `lead.date` viene del backend en UTC sin
    // sufijo 'Z', así que `new Date()` la leería como hora local y mostraría la cita corrida.
    const formatTime = (dateStr) => {
        if (!dateStr) return '12:00';
        const d = parseUtcIso(dateStr);
        return d ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : dateStr;
    };

    // Estilos por tipo de sección
    const sectionStyles = {
        citas: {
            timeBg: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
            btnBg: 'bg-violet-600 hover:bg-violet-500 text-white',
            btnText: 'Confirmar',
            tagBg: 'bg-violet-950/60 text-violet-300 border-violet-800/40'
        },
        mensajes: {
            timeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
            btnBg: 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-black',
            btnText: 'Responder',
            tagBg: 'bg-amber-950/60 text-amber-300 border-amber-800/40'
        },
        seguimientos: {
            timeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
            btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white font-black',
            btnText: 'Marcar Realizado',
            tagBg: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40'
        },
        reagendar: {
            timeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
            btnBg: 'bg-rose-600 hover:bg-rose-500 text-white',
            btnText: 'Reagendar',
            tagBg: 'bg-rose-950/60 text-rose-300 border-rose-800/40'
        }
    };

    const style = sectionStyles[sectionType] || sectionStyles.citas;

    // Calcular o mockear etiqueta de tiempo límite / tiempo transcurrido
    const getTimeLimitLabel = () => {
        if (lead.fecha_seguimiento) return `Seguimiento: ${lead.fecha_seguimiento}`;
        if (lead.time_limit) return lead.time_limit;
        if (lead.unread_comment) return 'Mensaje nuevo';
        if (lead.estado === 'Sin respuesta') return 'Re-contactar';
        return 'Tiempo límite: 2h';
    };

    const isOverdue = (getTimeLimitLabel() || '').toLowerCase().includes('vencido');

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            onClick={onSelect}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 relative overflow-hidden group ${
                isSelected 
                    ? 'bg-violet-650/15 border-violet-500/60 shadow-[0_0_20px_rgba(139,92,246,0.15)]' 
                    : 'bg-slate-950/70 border-slate-850 hover:bg-slate-900/60 hover:border-slate-800'
            }`}
        >
            {/* Columna Izquierda: Hora + Info del Lead */}
            <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                {/* Badge de Hora */}
                <div className={`px-2.5 py-1.5 rounded-xl border text-xs font-black tracking-tight shrink-0 flex items-center gap-1 ${style.timeBg}`}>
                    <Clock size={12} />
                    <span>{formatTime(lead.date || lead.fecha_meet)}</span>
                </div>

                {/* Nombre, Red y Ubicación */}
                <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-white leading-tight truncate">
                            {lead.lead || lead.nombre || 'Lead sin Nombre'}
                        </h4>
                        {lead.unread_comment && (
                            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-md animate-pulse flex items-center gap-1">
                                <MessageSquare size={10} />
                                Mensaje nuevo
                            </span>
                        )}
                        {lead.seguimiento_realizado && (
                            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md flex items-center gap-1">
                                <CheckCircle2 size={10} />
                                Seguimiento Realizado
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                        <span className="text-[11px] font-medium text-slate-400">
                            {lead.instagram ? 'Instagram' : 'WhatsApp'}
                        </span>
                        
                        {/* Etiqueta de Taller / Programa / Fuente */}
                        <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-md border ${style.tagBg}`}>
                            {lead.nombre || 'TALLER DIAGNÓSTICO BCL'}
                        </span>

                        {lead.zona_geografica && (
                            <span className="text-[11px] text-slate-500 font-medium">
                                • {lead.zona_geografica}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Columna Central: Badges de Código y Setter */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <span className="text-[10px] font-mono font-black uppercase text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                    COD: {lead.id ? `SEG-${String(lead.id).padStart(3, '0')}` : 'FUENTE01'}
                </span>

                <span className="text-[10px] font-bold text-slate-300 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-lg">
                    Setter: {lead.setter_name || lead.setter || 'Valentina'}
                </span>
            </div>

            {/* Columna Derecha: Tiempo límite / Botón de Acción / Menú */}
            <div className="flex items-center gap-3 shrink-0 justify-between md:justify-end">
                {/* Tiempo Límite / Alerta */}
                <span className={`text-xs font-bold ${
                    isOverdue ? 'text-rose-400 flex items-center gap-1 font-extrabold' : 'text-amber-400'
                }`}>
                    {isOverdue && <AlertTriangle size={12} />}
                    {getTimeLimitLabel()}
                </span>

                {/* Botón de Acción Principal */}
                {sectionType === 'seguimientos' && !lead.seguimiento_realizado ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onMarkFollowUpDone?.(lead);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
                    >
                        <CalendarCheck size={14} />
                        <span>Marcar Realizado</span>
                    </button>
                ) : (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onActionClick?.(lead);
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm ${style.btnBg}`}
                    >
                        {style.btnText}
                    </button>
                )}

                {/* Menú Tres Puntos */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenMenu?.(lead);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-850 rounded-xl transition-colors cursor-pointer border-none bg-transparent"
                    title="Opciones"
                >
                    <MoreVertical size={16} />
                </button>
            </div>
        </motion.div>
    );
};

export default TriageLeadCard;
