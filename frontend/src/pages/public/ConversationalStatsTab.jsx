import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, MessageSquare, RefreshCw, HelpCircle, Activity, CalendarDays, BarChart2 } from 'lucide-react';

const ConversationalStatsTab = () => {
    const [stats, setStats] = useState({ opciones: [], seguimientos: [], variantes: [], openings: [], opciones_send: [] });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Filtros de periodo
    const [period, setPeriod] = useState('last_month');
    const [customDates, setCustomDates] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchStats();
    }, [period, customDates]);

    const fetchStats = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const params = {};
            
            // Transformar periodos a fechas absolutas
            if (period === 'custom') {
                params.start_date = customDates.start;
                params.end_date = customDates.end;
            } else {
                const now = new Date();
                let start = new Date();
                if (period === 'yesterday') {
                    start.setDate(now.getDate() - 1);
                    params.start_date = start.toISOString().split('T')[0];
                    params.end_date = start.toISOString().split('T')[0];
                } else if (period === 'last_week') {
                    start.setDate(now.getDate() - 7);
                    params.start_date = start.toISOString().split('T')[0];
                    params.end_date = now.toISOString().split('T')[0];
                } else if (period === 'last_month') {
                    start.setDate(now.getDate() - 30);
                    params.start_date = start.toISOString().split('T')[0];
                    params.end_date = now.toISOString().split('T')[0];
                }
            }
            
            const res = await api.get('/manychat-webhook/stats/segmentation', { params });
            const data = res.data || {};
            setStats({
                opciones: data.options || [],
                seguimientos: data.questions || [],
                variantes: data.variantes || [],
                openings: data.openings || [],
                opciones_send: data.options_send || []
            });
        } catch (err) {
            console.error('Error fetching conversational stats:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const periods = [
        { id: 'yesterday', label: 'Ayer' },
        { id: 'last_week', label: 'Semana' },
        { id: 'last_month', label: 'Mes' },
        { id: 'custom', label: 'Personalizado' }
    ];

    const renderCompactCard = (title, items, icon, description, colorClass = "indigo") => {
        if (!items || items.length === 0) return null;
        
        const isSeguimiento = title === 'Seguimientos (Preguntas)';
        let displayItems = [...items];
        
        // Compact styles
        const colorMap = {
            indigo: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
            emerald: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
            amber: "bg-amber-500/20 text-amber-400 border-amber-500/30",
            purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
            blue: "bg-blue-500/20 text-blue-400 border-blue-500/30"
        };
        
        const barColorMap = {
            indigo: "bg-indigo-500",
            emerald: "bg-emerald-500",
            amber: "bg-amber-500",
            purple: "bg-purple-500",
            blue: "bg-blue-500"
        };

        const total = displayItems.reduce((acc, curr) => acc + curr.total_leads, 0);

        return (
            <div className="bg-slate-900/30 border border-slate-800/60 rounded-2xl p-4 shadow-lg flex flex-col h-full">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800/40">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${colorMap[colorClass].split(' ')[0]}`}>
                            {React.cloneElement(icon, { size: 14, className: colorMap[colorClass].split(' ')[1] })}
                        </div>
                        <h3 className="text-[11px] font-black text-white uppercase tracking-tighter">{title}</h3>
                    </div>
                    {description && (
                        <div className="group relative">
                            <HelpCircle size={12} className="text-slate-600 cursor-help" />
                            <div className="absolute right-0 bottom-full mb-2 w-48 bg-slate-800 text-[9px] text-slate-400 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-700 shadow-2xl z-40">
                                {description}
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1 scrollbar-thin">
                    {displayItems.map((item, idx) => {
                        const percent = total > 0 ? (item.total_leads / total * 100).toFixed(0) : 0;
                        return (
                            <div key={idx} className="group">
                                <div className="flex items-center justify-between text-[10px] mb-1">
                                    <span className="text-slate-300 font-bold truncate max-w-[120px]">{item.name}</span>
                                    <span className="text-slate-500 font-black">{item.total_leads} <span className="opacity-50">u.</span></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 flex-1 bg-slate-950/50 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full ${barColorMap[colorClass]} opacity-60 group-hover:opacity-100 transition-all`}
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                    <span className="text-[9px] font-black text-slate-600 w-6 text-right">{percent}%</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };



    // Lógica para determinar el ganador (Best Performer)
    const getWinnerId = (items) => {
        if (!items || items.length === 0) return null;
        const validItems = items.filter(i => i.total_sends > 0);
        if (validItems.length === 0) return null;
        const maxRR = Math.max(...validItems.map(i => i.response_percentage));
        if (maxRR === 0) return null;
        return items.find(i => i.response_percentage === maxRR)?.name;
    };
    const renderSendPerformanceCard = (items) => {
        if (!items || items.length === 0) return null;
        
        let displayItems = [...items];
        const keys = ['1', '2', '3'];
        keys.forEach(k => {
            if (!displayItems.find(i => i.name === k)) {
                displayItems.push({ name: k, total_sends: 0, total_responses: 0, response_percentage: 0, qualified_percentage: 0, qualified_leads: 0 });
            }
        });
        displayItems.sort((a, b) => a.name.localeCompare(b.name));
        
        const winnerId = getWinnerId(displayItems);

        return (
            <div className="col-span-1 md:col-span-2 lg:col-span-4 space-y-8">
                {/* Header de Sección */}
                <div className="flex items-center justify-between bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800/50 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
                            <Activity size={24} className="text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-widest italic">A/B Testing: Eficacia de Preguntas</h3>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Comparativa de conversión por opción de mensaje</p>
                        </div>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-950/50 rounded-xl border border-slate-800/50">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Monitoreo en Tiempo Real</span>
                    </div>
                </div>

                {/* Grid de Opciones */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {displayItems.map((item, idx) => {
                        const isWinner = winnerId === item.name;
                        
                        let colorClass = "text-rose-500";
                        let borderColor = "border-rose-500/20";
                        let glowColor = "shadow-rose-500/5";
                        
                        if (item.response_percentage >= 40) {
                            colorClass = "text-emerald-500";
                            borderColor = "border-emerald-500/20";
                            glowColor = "shadow-emerald-500/5";
                        } else if (item.response_percentage >= 20) {
                            colorClass = "text-yellow-500";
                            borderColor = "border-yellow-500/20";
                            glowColor = "shadow-yellow-500/5";
                        }

                        return (
                            <div key={idx} className={`relative group transition-all duration-500 ${isWinner ? 'scale-[1.02]' : 'opacity-90 hover:opacity-100'}`}>
                                {isWinner && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-xl shadow-emerald-900/40 z-30 flex items-center gap-2">
                                        <TrendingUp size={12} />
                                        Best Performer
                                    </div>
                                )}
                                
                                <div className={`h-full bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] p-8 border-2 ${isWinner ? 'border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.15)]' : 'border-slate-800/80'} relative overflow-hidden flex flex-col transition-all duration-500`}>
                                    {/* Decoración de fondo */}
                                    <div className={`absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-10 transition-opacity ${isWinner ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                                    
                                    <div className="relative z-10 flex-1 space-y-8">
                                        {/* Top Header */}
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Variante</span>
                                                <h4 className="text-3xl font-black text-white italic tracking-tighter">Opción {item.name}</h4>
                                            </div>
                                            <div className={`w-16 h-16 rounded-[1.25rem] bg-slate-950 border-2 ${borderColor} flex flex-col items-center justify-center shadow-inner`}>
                                                <span className={`text-xl font-black ${colorClass} leading-none`}>{item.response_percentage}%</span>
                                                <span className="text-[8px] font-black uppercase text-slate-500 mt-1">RR</span>
                                            </div>
                                        </div>

                                        {/* Metrics Grid */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 space-y-1">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Respondidos</p>
                                                <p className="text-2xl font-black text-white italic tabular-nums">{item.total_responses}</p>
                                            </div>
                                            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 space-y-1">
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cualificados</p>
                                                <p className="text-2xl font-black text-emerald-500 italic tabular-nums">{item.qualified_leads}</p>
                                            </div>
                                        </div>

                                        {/* Explicit Summary Block */}
                                        <div className={`mt-auto pt-6 border-t ${isWinner ? 'border-emerald-500/20' : 'border-slate-800'}`}>
                                            <div className={`bg-slate-950 rounded-2xl p-4 border ${isWinner ? 'border-emerald-500/20' : 'border-slate-800/50'} shadow-inner group-hover:border-slate-700 transition-colors`}>
                                                <p className="text-[11px] font-bold text-slate-400 text-center leading-relaxed">
                                                    <span className="text-indigo-400 font-black text-sm">{item.total_sends}</span> enviados, 
                                                    <br />
                                                    <span className="text-pink-400 font-black text-sm">{item.total_responses}</span> respondidos y 
                                                    <br />
                                                    <span className={`${colorClass} font-black text-sm`}>{item.response_percentage}%</span> de respuesta
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-3xl border border-slate-800/50 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-pink-500/10 rounded-2xl border border-pink-500/20 shadow-inner">
                        <MessageSquare className="text-pink-400" size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black uppercase tracking-widest text-white italic">Intelligence Center</h3>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Análisis detallado de flujos y conversión conversacional</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800/80 shadow-2xl">
                        {periods.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setPeriod(p.id)}
                                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300
                                    ${period === p.id 
                                        ? 'bg-gradient-to-br from-pink-600 to-rose-700 text-white shadow-lg shadow-pink-500/20' 
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {period === 'custom' && (
                        <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-500">
                            <div className="relative group">
                                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400 group-hover:text-pink-300 transition-colors pointer-events-none z-10" size={14} />
                                <input 
                                    type="date"
                                    value={customDates.start}
                                    onChange={e => setCustomDates({...customDates, start: e.target.value})}
                                    className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-[10px] font-black text-white/70 outline-none focus:border-pink-500 focus:text-white transition-all w-36"
                                />
                            </div>
                            <span className="text-slate-700 font-black text-xs">/</span>
                            <div className="relative group">
                                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400 group-hover:text-pink-300 transition-colors pointer-events-none z-10" size={14} />
                                <input 
                                    type="date"
                                    value={customDates.end}
                                    onChange={e => setCustomDates({...customDates, end: e.target.value})}
                                    className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-[10px] font-black text-white/70 outline-none focus:border-pink-500 focus:text-white transition-all w-36"
                                />
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => fetchStats(true)}
                        disabled={refreshing}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700 active:scale-95 shadow-lg"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="animate-spin text-pink-500" size={40} />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Cargando Inteligencia...</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {renderSendPerformanceCard(stats.options_send)}
                    <div className="col-span-1 md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {renderCompactCard("Seguimientos", stats.seguimientos, <BarChart2 />, "Métricas de avance en el flujo de seguimiento.", "emerald")}
                        {renderCompactCard("Opciones Iniciales", stats.opciones, <BarChart2 />, "Desglose por elección del usuario.", "blue")}
                        {renderCompactCard("Variantes", stats.variantes, <BarChart2 />, "Rendimiento por variante de anuncio.", "amber")}
                        {renderCompactCard("Openings", stats.openings, <BarChart2 />, "Efectividad del gancho de apertura.", "purple")}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConversationalStatsTab;
