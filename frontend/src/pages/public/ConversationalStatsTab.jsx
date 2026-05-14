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

    const renderCard = (title, items, icon) => {
        if (!items || items.length === 0) return null;
        
        // Ensure options 1, 2, 3 exist
        const isOpt = title === 'Opciones Iniciales' || title === 'Seguimientos (Preguntas)';
        let displayItems = [...items];
        
        if (isOpt) {
            const keys = ['1', '2', '3'];
            keys.forEach(k => {
                if (!displayItems.find(i => i.name === k)) {
                    displayItems.push({ name: k, total_leads: 0, qualified_percentage: 0 });
                }
            });
            displayItems.sort((a, b) => a.name.localeCompare(b.name));
        }

        const totalCategoryLeads = displayItems.reduce((acc, curr) => acc + curr.total_leads, 0);

        return (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-800/80 pb-3">
                    {icon}
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">{title}</h3>
                </div>
                <div className="space-y-4">
                    {displayItems.map((item, idx) => {
                        const isZero = item.total_leads === 0;
                        const percentageOfTotal = totalCategoryLeads > 0 ? ((item.total_leads / totalCategoryLeads) * 100).toFixed(1) : 0;
                        
                        let qualColor = "text-slate-400";
                        if (item.qualified_percentage >= 50) qualColor = "text-emerald-400";
                        else if (item.qualified_percentage >= 20) qualColor = "text-yellow-400";
                        else if (!isZero) qualColor = "text-red-400";

                        return (
                            <div key={idx} className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/50">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold text-white capitalize">{isOpt ? `Opción ${item.name}` : item.name}</span>
                                    <span className={`text-[10px] font-black uppercase ${qualColor}`}>
                                        {isZero ? 'Sin datos' : `${item.qualified_percentage}% Cualificados`}
                                    </span>
                                </div>
                                
                                {/* Progress bar background */}
                                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                                    <div 
                                        className="h-full bg-blue-500 transition-all duration-1000"
                                        style={{ width: `${percentageOfTotal}%` }}
                                    />
                                </div>
                                
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs text-slate-400 font-bold">{item.total_leads} Respuestas</span>
                                    <span className="text-[10px] text-blue-400 font-black">{percentageOfTotal}% del total</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderSendPerformanceCard = (items) => {
        if (!items || items.length === 0) return null;
        
        // Ensure options 1, 2, 3 exist
        let displayItems = [...items];
        const keys = ['1', '2', '3'];
        keys.forEach(k => {
            if (!displayItems.find(i => i.name === k)) {
                displayItems.push({ name: k, total_sends: 0, total_responses: 0, response_percentage: 0, qualified_percentage: 0 });
            }
        });
        displayItems.sort((a, b) => a.name.localeCompare(b.name));

        return (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-xl col-span-1 md:col-span-2">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-800/80 pb-3">
                    <Activity size={18} className="text-pink-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Efectividad de Envío (Preguntas Aleatorias)</h3>
                    <div className="ml-auto group relative">
                        <HelpCircle size={14} className="text-slate-500 cursor-help" />
                        <div className="absolute right-0 bottom-full mb-2 w-64 bg-slate-800 text-[10px] text-slate-300 p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-700 shadow-2xl z-20">
                            Mide cuántas veces se envió cada opción y qué porcentaje de esas personas respondió y luego cualificó.
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {displayItems.map((item, idx) => {
                        const isZero = item.total_sends === 0;
                        
                        let responseColor = "text-slate-400";
                        if (item.response_percentage >= 40) responseColor = "text-emerald-400";
                        else if (item.response_percentage >= 20) responseColor = "text-yellow-400";
                        else if (!isZero) responseColor = "text-red-400";

                        return (
                            <div key={idx} className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/50 hover:border-pink-500/30 transition-colors">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-black text-white uppercase tracking-widest bg-slate-800 px-2 py-1 rounded">Opción {item.name}</span>
                                    <div className="text-right">
                                        <div className={`text-lg font-black ${responseColor}`}>{item.response_percentage}%</div>
                                        <div className="text-[8px] text-slate-500 font-bold uppercase">Respuesta</div>
                                    </div>
                                </div>
                                
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between text-[10px] mb-1">
                                            <span className="text-slate-400 font-bold">VOLUMEN</span>
                                            <span className="text-white font-black">{item.total_responses} / {item.total_sends}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-pink-500 transition-all duration-1000"
                                                style={{ width: `${item.response_percentage}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/50">
                                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">Cualificación</span>
                                        <span className="text-xs font-black text-emerald-400">{item.qualified_percentage}%</span>
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/40 p-5 rounded-2xl border border-slate-800/50">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-pink-500/10 rounded-xl">
                        <MessageSquare className="text-pink-400" size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-white italic">Rendimiento Conversacional</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Métricas globales de respuestas a flujos (Independiente de los anuncios)</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
                        {periods.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setPeriod(p.id)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all
                                    ${period === p.id 
                                        ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/20' 
                                        : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {period === 'custom' && (
                        <div className="flex items-center gap-2 animate-in zoom-in-95 duration-300">
                            <div className="relative group">
                                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400 group-hover:text-pink-300 transition-colors pointer-events-none z-10" size={12} />
                                <input 
                                    type="date"
                                    value={customDates.start}
                                    onChange={e => setCustomDates({...customDates, start: e.target.value})}
                                    onClick={(e) => e.currentTarget.showPicker?.()}
                                    className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-2 py-1.5 text-[8px] font-black text-white/70 outline-none focus:border-pink-500 focus:text-white transition-all cursor-pointer shadow-inner w-32 relative"
                                />
                            </div>
                            <span className="text-slate-600 font-black text-[10px] uppercase">a</span>
                            <div className="relative group">
                                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400 group-hover:text-pink-300 transition-colors pointer-events-none z-10" size={12} />
                                <input 
                                    type="date"
                                    value={customDates.end}
                                    onChange={e => setCustomDates({...customDates, end: e.target.value})}
                                    onClick={(e) => e.currentTarget.showPicker?.()}
                                    className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-2 py-1.5 text-[8px] font-black text-white/70 outline-none focus:border-pink-500 focus:text-white transition-all cursor-pointer shadow-inner w-32 relative"
                                />
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => fetchStats(true)}
                        disabled={refreshing}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700/50"
                        title="Actualizar"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-pink-500" size={28} />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderSendPerformanceCard(stats.opciones_send)}
                    {renderCard("Opciones Iniciales", stats.opciones, <BarChart2 size={18} className="text-blue-400" />)}
                    {renderCard("Seguimientos (Preguntas)", stats.seguimientos, <BarChart2 size={18} className="text-emerald-400" />)}
                    {renderCard("Variantes", stats.variantes, <BarChart2 size={18} className="text-amber-400" />)}
                    {renderCard("Openings", stats.openings, <BarChart2 size={18} className="text-purple-400" />)}
                </div>
            )}
        </div>
    );
};

export default ConversationalStatsTab;
