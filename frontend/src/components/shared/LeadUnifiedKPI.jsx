import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, MessageSquare, Target, UserX, 
    ArrowUpRight, HelpCircle, Inbox, 
    CheckCircle2, AlertCircle, TrendingUp
} from 'lucide-react';

/**
 * LeadUnifiedKPI - Un componente premium para visualizar el embudo inicial de leads.
 * Fusiona Entrantes, Tasa de Respuesta y Cualificación en una sola pieza de diseño.
 */
const LeadUnifiedKPI = ({ stats }) => {
    if (!stats) return null;

    const { totals, percentages } = stats;
    
    // Cálculos y extracción de datos
    const entrantes = totals.entrantes || 0;
    const sinRespuesta = totals.no_response || 0;
    const respondidos = Math.max(0, entrantes - sinRespuesta);
    const respondidosPct = percentages.rates.opening_response || 0;
    
    const cualificados = totals.leads || 0;
    const noCualificados = totals.not_lead || 0;
    
    // % Cualificados sobre Entrantes
    const cualificadosSobreEntrantes = percentages.rates.opening_rate || 0;
    
    // % Cualificados sobre Respondidos (Conversión interna de la conversación)
    const cualificadosSobreRespondidos = respondidos > 0 
        ? Number(((cualificados / respondidos) * 100).toFixed(1)) 
        : 0;

    const tooltipContent = {
        entrantes: "Total de leads que ingresaron al sistema desde todas las fuentes en el periodo seleccionado.",
        respuesta: "Mide cuántos de los leads entrantes iniciaron una conversación real. Cálculo: ((Entrantes - Sin Respuesta) / Entrantes).",
        cualificacion: "Leads que cumplen con el perfil ideal. El porcentaje se calcula sobre el total de entrantes y sobre los que respondieron.",
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-full bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative group"
        >
            {/* Background Decor - Wrapped to allow tooltips to escape the main container */}
            <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] -mr-40 -mt-40 rounded-full pointer-events-none group-hover:bg-indigo-600/15 transition-all duration-700" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-pink-600/5 blur-[100px] -ml-20 -mb-20 rounded-full pointer-events-none group-hover:bg-pink-600/10 transition-all duration-700" />
            </div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* 1. SECCIÓN DOMINANTE: ENTRANTES */}
                <div className="lg:col-span-3 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-slate-800/50 pb-8 lg:pb-0 lg:pr-8">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Lead Discovery</span>
                        <div className="relative group/tt flex items-center">
                            <HelpCircle size={12} className="text-slate-600 cursor-help" />
                            <div className="absolute bottom-full left-0 mb-2 w-48 p-3 bg-slate-800 text-white text-[10px] rounded-xl opacity-0 group-hover/tt:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-700 shadow-2xl shadow-black">
                                {tooltipContent.entrantes}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-end gap-4">
                        <div className="relative">
                            <h2 className="text-7xl lg:text-8xl font-black text-white italic tracking-tighter leading-none">
                                {entrantes}
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
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Total Periodo</p>
                        </div>
                    </div>
                </div>

                {/* 2. SECCIÓN: TASA DE RESPUESTA */}
                <div className="lg:col-span-4 space-y-6 lg:px-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="text-indigo-400" size={16} />
                            <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest italic">Engagement Rate</h3>
                        </div>
                        <div className="relative group/tt flex items-center">
                            <HelpCircle size={12} className="text-slate-600 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-xl opacity-0 group-hover/tt:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-700 shadow-2xl shadow-black">
                                {tooltipContent.respuesta}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950/40 border border-slate-800/50 p-4 rounded-3xl group/sub hover:bg-slate-800/40 transition-colors">
                            <p className="text-3xl font-black text-indigo-400 italic leading-none mb-1">{respondidosPct}%</p>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Tasa Respuesta</p>
                        </div>
                        <div className="flex flex-col justify-center space-y-3 px-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    <span className="text-[9px] font-black text-slate-400 uppercase">Respondidos</span>
                                </div>
                                <span className="text-xs font-black text-white italic">{respondidos}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase">Sin Respuesta</span>
                                </div>
                                <span className="text-xs font-black text-slate-400 italic">{sinRespuesta}</span>
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

                {/* 3. SECCIÓN: CUALIFICACIÓN (QUALIFIED) */}
                <div className="lg:col-span-5 bg-slate-950/30 border border-slate-800/50 rounded-[2rem] p-6 relative group/qual">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Target className="text-emerald-400" size={16} />
                            <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest italic">Cualificación Final</h3>
                        </div>
                        <div className="relative group/tt flex items-center">
                            <HelpCircle size={12} className="text-slate-600 cursor-help" />
                            <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-xl opacity-0 group-hover/tt:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-700 shadow-2xl shadow-black">
                                {tooltipContent.cualificacion}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6 items-center">
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
                                <span className="text-xl font-black text-white italic leading-none">{cualificados}</span>
                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Leads</span>
                            </div>
                        </div>

                        <div className="flex-1 grid grid-cols-2 gap-y-4 gap-x-8 w-full">
                            <div>
                                <p className="text-[10px] font-black text-white italic tracking-tighter leading-none mb-1">{cualificadosSobreEntrantes}%</p>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">% / Entrantes</p>
                                <div className="w-full h-1 bg-slate-800 mt-2 rounded-full">
                                    <div className="h-full bg-emerald-500/40 rounded-full" style={{ width: `${cualificadosSobreEntrantes}%` }} />
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-white italic tracking-tighter leading-none mb-1">{cualificadosSobreRespondidos}%</p>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">% / Respuesta</p>
                                <div className="w-full h-1 bg-slate-800 mt-2 rounded-full">
                                    <div className="h-full bg-indigo-500/40 rounded-full" style={{ width: `${cualificadosSobreRespondidos}%` }} />
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-rose-500 italic tracking-tighter leading-none mb-1">{noCualificados}</p>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">No Cualificados</p>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 flex items-center justify-center">
                                <TrendingUp className="text-emerald-500 mr-2" size={12} />
                                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">High Quality</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </motion.div>
    );
};

export default LeadUnifiedKPI;
