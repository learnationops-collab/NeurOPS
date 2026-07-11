import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, MessageSquare, Target, UserX, 
    ArrowUpRight, HelpCircle, Inbox, 
    CheckCircle2, AlertCircle
} from 'lucide-react';
import StatTooltip from './StatTooltip';

/**
 * LeadUnifiedKPI - Panel premium del embudo inicial de leads.
 * Orden: Entrantes → Cualificación Final → Engagement Rate
 */
const LeadUnifiedKPI = ({ stats, compareActive, comparisonStats }) => {
    if (!stats) return null;

    const { totals, percentages } = stats;
    
    // Muestra la variación entre periodos
    const renderComparison = (current, previous, isPercentage = false, justifyClass = "justify-start") => {
        if (!compareActive || !comparisonStats) return null;
        const curVal = Number(current || 0);
        const prevVal = Number(previous || 0);

        if (prevVal === 0) {
            return (
                <div className={`flex items-center gap-1 mt-0.5 text-[9px] font-black uppercase text-slate-500 ${justifyClass}`}>
                    <span>Ant: {prevVal}{isPercentage ? '%' : ''}</span>
                    {curVal > 0 && <span className="text-emerald-400 font-bold">(+100%)</span>}
                </div>
            );
        }

        const diff = ((curVal - prevVal) / prevVal) * 100;
        const sign = diff > 0 ? '+' : '';
        const color = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-slate-500';

        return (
            <div className={`flex items-center gap-1 mt-0.5 text-[9px] font-black uppercase text-slate-500 ${justifyClass}`}>
                <span>Ant: {prevVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}{isPercentage ? '%' : ''}</span>
                <span className={`${color} font-bold`}>({sign}{diff.toFixed(1)}%)</span>
            </div>
        );
    };

    // Extracción de datos
    const entrantes = totals.entrantes || 0;
    const sinRespuesta = totals.no_response || 0;
    const respondidos = Math.max(0, entrantes - sinRespuesta);
    const respondidosPct = percentages.rates.opening_response || 0;
    
    const cualificados = totals.leads || 0;
    const noCualificados = totals.not_lead || 0;
    
    // % Cualificados sobre Entrantes (métrica principal)
    const cualificadosSobreEntrantes = percentages.rates.opening_rate || 0;
    
    // % Cualificados sobre Respondidos (sub-dato de apoyo)
    const cualificadosSobreRespondidos = respondidos > 0 
        ? Number(((cualificados / respondidos) * 100).toFixed(1)) 
        : 0;

    // Tooltips en lenguaje accesible para usuarios no técnicos
    const tooltipContent = {
        entrantes: "¿Cuántas personas llegaron? Este número muestra el total de personas que ingresaron al sistema durante el período, sin importar si respondieron o no.",
        cualificacion: "¿Cuántas personas cumplieron el perfil? Indica qué porcentaje de todos los que llegaron terminaron siendo buenos prospectos para agendar una llamada.",
        respuesta: "¿Cuántas personas respondieron los mensajes? De cada 100 personas que llegaron, este número dice cuántas sí interactuaron con la conversación.",
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-full bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative group"
        >
            {/* Decoración de fondo */}
            <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/10 blur-[120px] -mr-40 -mt-40 rounded-full pointer-events-none group-hover:bg-emerald-600/15 transition-all duration-700" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-pink-600/5 blur-[100px] -ml-20 -mb-20 rounded-full pointer-events-none group-hover:bg-pink-600/10 transition-all duration-700" />
            </div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* 1. SECCIÓN DOMINANTE: ENTRANTES */}
                <div className="lg:col-span-3 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-slate-800/50 pb-8 lg:pb-0 lg:pr-8">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Lead Discovery</span>
                        <div className="relative group/tt flex items-center">
                            <HelpCircle size={12} className="text-slate-650 cursor-help" />
                            <div className="absolute bottom-full left-0 mb-2 w-52 p-3 bg-slate-800 text-white text-[10px] rounded-xl opacity-0 group-hover/tt:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-700 shadow-2xl shadow-black">
                                {tooltipContent.entrantes}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-end gap-4">
                        <div className="relative">
                            <h2 className="text-7xl lg:text-8xl font-black text-white italic tracking-tighter leading-none">
                                <StatTooltip 
                                    label="Leads Entrantes" 
                                    value={entrantes} 
                                    calculation="Total de personas que llegaron al sistema en el período, desde cualquier fuente (ManyChat, formularios, etc.)."
                                >
                                    {entrantes}
                                </StatTooltip>
                            </h2>
                            <motion.div 
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="absolute -top-4 -right-6 p-2 bg-pink-600 rounded-xl shadow-lg shadow-pink-600/20"
                            >
                                <Inbox className="text-white" size={20} />
                            </motion.div>
                        </div>
                        <div className="pb-2">
                            <p className="text-sm font-black text-pink-500 uppercase italic leading-none">Entrantes</p>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Total Periodo</p>
                            {renderComparison(entrantes, comparisonStats?.totals?.entrantes, false, "justify-start")}
                        </div>
                    </div>
                </div>

                {/* 2. SECCIÓN PRINCIPAL: CUALIFICACIÓN (ahora en posición 2, col-span-5) */}
                <div className="lg:col-span-5 bg-slate-950/30 border border-slate-800/50 rounded-[2rem] p-6 relative group/qual border-b lg:border-b-0 lg:border-r border-r-slate-800/50 pb-8 lg:pb-6 lg:mr-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Target className="text-emerald-400" size={16} />
                            <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest italic">Cualificación Final</h3>
                        </div>
                        <div className="relative group/tt flex items-center">
                            <HelpCircle size={12} className="text-slate-650 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-xl opacity-0 group-hover/tt:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-700 shadow-2xl shadow-black leading-relaxed">
                                {tooltipContent.cualificacion}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-5 items-center">
                        {/* Donut con cantidad absoluta */}
                        <div className="flex-shrink-0 relative">
                            <svg className="w-24 h-24 transform -rotate-90">
                                <circle
                                    cx="48"
                                    cy="48"
                                    r="40"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    className="text-slate-800"
                                />
                                <motion.circle
                                    cx="48"
                                    cy="48"
                                    r="40"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    strokeDasharray="251.2"
                                    initial={{ strokeDashoffset: 251.2 }}
                                    animate={{ strokeDashoffset: 251.2 - (251.2 * cualificadosSobreEntrantes) / 100 }}
                                    transition={{ duration: 1.5, ease: "easeInOut" }}
                                    className="text-emerald-500"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-black text-white italic leading-none">
                                    <StatTooltip 
                                        label="Leads Cualificados" 
                                        value={cualificados} 
                                        calculation="Personas que respondieron y además cumplieron con el perfil ideal para agendar una llamada."
                                    >
                                        {cualificados}
                                    </StatTooltip>
                                </span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Leads</span>
                                {renderComparison(cualificados, comparisonStats?.totals?.leads, false, "justify-center mt-1")}
                            </div>
                        </div>

                        {/* Métricas de tasa */}
                        <div className="flex-1 space-y-4 w-full">
                            {/* Tasa sobre Entrantes — MÉTRICA PRINCIPAL, tamaño grande */}
                            <div className="bg-emerald-950/30 border border-emerald-800/30 rounded-2xl p-3">
                                <div className="flex items-end justify-between gap-2">
                                    <div>
                                        <p className="text-3xl font-black text-emerald-400 italic leading-none">
                                            <StatTooltip 
                                                label="Tasa de Cualificación sobre Entrantes" 
                                                value={`${cualificadosSobreEntrantes}%`} 
                                                calculation="De cada 100 personas que llegaron, ¿cuántas terminaron siendo buenos prospectos? Fórmula: (Cualificados / Total Entrantes) × 100"
                                            >
                                                {cualificadosSobreEntrantes}%
                                            </StatTooltip>
                                        </p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">% sobre Entrantes</p>
                                        {renderComparison(cualificadosSobreEntrantes, comparisonStats?.percentages?.rates?.opening_rate, true, "justify-start")}
                                    </div>
                                    <div className="text-right pb-1">
                                        <p className="text-xs font-black text-slate-400 italic leading-none">
                                            <StatTooltip 
                                                label="Tasa de Cualificación sobre Respuesta" 
                                                value={`${cualificadosSobreRespondidos}%`} 
                                                calculation="De cada 100 personas que sí respondieron, ¿cuántas fueron cualificadas? Este dato mide cuán efectiva es la conversación en sí. Fórmula: (Cualificados / Respondidos) × 100"
                                            >
                                                {cualificadosSobreRespondidos}%
                                            </StatTooltip>
                                        </p>
                                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-wider mt-0.5">% / Respuesta</p>
                                        {renderComparison(
                                            cualificadosSobreRespondidos,
                                            (comparisonStats?.totals?.entrantes - comparisonStats?.totals?.no_response) > 0 
                                                ? Number(((comparisonStats?.totals?.leads / (comparisonStats?.totals?.entrantes - comparisonStats?.totals?.no_response)) * 100).toFixed(1))
                                                : 0,
                                            true,
                                            "justify-end"
                                        )}
                                    </div>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 mt-3 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${cualificadosSobreEntrantes}%` }}
                                        transition={{ duration: 1.2, ease: "easeOut" }}
                                        className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                                    />
                                </div>
                            </div>

                            {/* No Cualificados — sub-dato */}
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500/60" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase">No Cualificados</span>
                                </div>
                                <span className="text-sm font-black text-rose-500/70 italic">
                                    <StatTooltip 
                                        label="Leads No Cualificados" 
                                        value={noCualificados} 
                                        calculation="Personas que llegaron pero no cumplieron con el perfil requerido. Fueron descartadas durante la conversación."
                                    >
                                        {noCualificados}
                                    </StatTooltip>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. SECCIÓN: ENGAGEMENT RATE (ahora en posición 3, col-span-4) */}
                <div className="lg:col-span-4 space-y-6 lg:pl-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="text-indigo-400" size={16} />
                            <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest italic">Engagement Rate</h3>
                        </div>
                        <div className="relative group/tt flex items-center">
                            <HelpCircle size={12} className="text-slate-650 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-xl opacity-0 group-hover/tt:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-700 shadow-2xl shadow-black leading-relaxed">
                                {tooltipContent.respuesta}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-3xl group/sub hover:bg-slate-800/40 transition-colors">
                            <p className="text-4xl font-black text-indigo-400 italic leading-none mb-1">
                                <StatTooltip 
                                    label="Tasa de Respuesta (Engagement)" 
                                    value={`${respondidosPct}%`}
                                    calculation="De cada 100 personas que llegaron, ¿cuántas respondieron algún mensaje? Si este número es bajo, puede indicar que el mensaje inicial no está generando suficiente interés."
                                >
                                    {respondidosPct}%
                                </StatTooltip>
                            </p>
                            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Tasa Respuesta</p>
                            {renderComparison(respondidosPct, comparisonStats?.percentages?.rates?.opening_response, true, "justify-start")}
                        </div>
                        <div className="flex flex-col justify-center space-y-3 px-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    <span className="text-xs font-black text-slate-400 uppercase">Respondidos</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-black text-white italic block">
                                        <StatTooltip 
                                            label="Leads Respondidos" 
                                            value={respondidos} 
                                            calculation="Número de personas que contestaron al menos un mensaje de la secuencia. Se calcula restando los 'Sin Respuesta' del total de entrantes."
                                        >
                                            {respondidos}
                                        </StatTooltip>
                                    </span>
                                    {renderComparison(respondidos, (comparisonStats?.totals?.entrantes || 0) - (comparisonStats?.totals?.no_response || 0), false, "justify-end")}
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                                    <span className="text-xs font-black text-slate-500 uppercase">Sin Respuesta</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-black text-slate-400 italic block">
                                        <StatTooltip 
                                            label="Leads Sin Respuesta" 
                                            value={sinRespuesta} 
                                            calculation="Personas que llegaron al sistema pero nunca respondieron ningún mensaje. Pueden ser prospectos fríos o que el mensaje no llegó correctamente."
                                        >
                                            {sinRespuesta}
                                        </StatTooltip>
                                    </span>
                                    {renderComparison(sinRespuesta, comparisonStats?.totals?.no_response, false, "justify-end")}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${respondidosPct}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                        />
                    </div>
                </div>

            </div>
        </motion.div>
    );
};

export default LeadUnifiedKPI;
