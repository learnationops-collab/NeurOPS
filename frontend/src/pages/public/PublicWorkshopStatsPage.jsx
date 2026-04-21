import React, { useState, useEffect } from 'react';
import { 
    LayoutGrid, BarChart3, TrendingUp, Zap, 
    MousePointer2, MessageSquare, Send, RefreshCw, 
    ChevronRight, ArrowRight, Activity, Loader2, Sparkles
} from 'lucide-react';
import api from '../../services/api';

const StatMiniCard = ({ label, value, icon: Icon, colorClass }) => (
    <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-2xl flex items-center gap-4 group hover:bg-slate-800 transition-colors">
        <div className={`p-2 rounded-xl bg-slate-900 border border-slate-800 ${colorClass}`}>
            <Icon size={16} />
        </div>
        <div>
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{label}</p>
            <p className="text-lg font-black text-white italic tracking-tighter">{value}</p>
        </div>
    </div>
);

const TemplateCard = ({ template }) => {
    if (!template) return null;

    // Aseguramos que total_sent sea un número
    const totalSent = template.total_sent || 0;

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl relative group hover:border-indigo-500/30 transition-all duration-500">
            <div className="absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-10 bg-indigo-500 group-hover:opacity-20 transition-opacity" />
            
            <div className="p-8 space-y-6 relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[8px] font-black uppercase tracking-widest italic">
                                {template.template_id || 'ID'}
                            </span>
                        </div>
                        <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">{template.template_name || 'Sin Nombre'}</h3>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 text-indigo-400 group-hover:scale-110 transition-transform">
                        <Send size={24} />
                    </div>
                </div>

                {/* Primary Metric */}
                <div className="bg-slate-950/50 rounded-3xl p-6 border border-slate-800/50 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Envíos</p>
                        <p className="text-4xl font-black text-white italic tracking-tighter">{totalSent.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                        <Activity className="text-indigo-500 mb-2 ml-auto" size={24} />
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Active Template</p>
                    </div>
                </div>

                {/* Buttons Breakdown */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <Zap size={14} className="text-amber-500" />
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Interacción por Botón</h4>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {template.buttons && template.buttons.length > 0 ? template.buttons.map((btn, idx) => (
                            <div key={idx} className="bg-slate-800/30 border border-slate-700/30 p-4 rounded-2xl group/btn hover:bg-slate-800 transition-colors">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center text-indigo-400 font-black text-xs italic">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-white uppercase tracking-wider">{btn.button || 'Botón'}</span>
                                            <p className="text-[8px] font-bold text-slate-500 uppercase">Clicks: {btn.clicks || 0}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xl font-black text-indigo-400 italic tracking-tighter">{btn.ctr || 0}%</span>
                                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">CTR</p>
                                    </div>
                                </div>
                                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full group-hover/btn:scale-x-105 transition-transform origin-left duration-1000"
                                        style={{ width: `${Math.min(btn.ctr || 0, 100)}%` }}
                                    />
                                </div>
                            </div>
                        )) : (
                            <div className="py-8 text-center bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">
                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">Aún no hay interacciones registradas</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const PublicWorkshopStatsPage = () => {
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            // Quitamos el slash inicial si baseURL ya lo tiene o para mayor compatibilidad
            const res = await api.get('workshop/stats/summary');
            if (Array.isArray(res.data)) {
                setStats(res.data);
            } else {
                setStats([]);
            }
        } catch (err) {
            console.error("Error fetching workshop stats:", err);
            setStats([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-12 relative overflow-hidden">
            {/* Background elements (Matching NeurOPS theme) */}
            <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="max-w-7xl mx-auto z-10 relative space-y-16">
                {/* Header Section */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                    <div className="space-y-6 max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            <Sparkles size={14} className="animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Workshop Intelligence Center</span>
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-4xl md:text-7xl font-black text-white italic tracking-tighter uppercase leading-[0.9]">
                                Plantilla & <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">Workshop Stats</span>
                            </h1>
                        </div>
                        <p className="text-slate-500 font-bold text-xs md:text-sm leading-relaxed uppercase tracking-widest max-w-xl">
                            Analítica avanzada de interacciones vía WhatsApp. Mide el CTR de cada botón y la efectividad de tus mensajes de convocatoria.
                        </p>
                    </div>

                    <button 
                        onClick={fetchStats}
                        className="flex items-center gap-3 px-8 py-4 bg-slate-900 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all group"
                    >
                        <RefreshCw size={18} className={`text-indigo-400 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Actualizar Datos</span>
                    </button>
                </div>

                {loading && (!stats || stats.length === 0) ? (
                    <div className="flex flex-col items-center justify-center py-40 space-y-6">
                        <div className="relative">
                            <Loader2 className="animate-spin text-indigo-500" size={64} />
                            <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse" />
                        </div>
                        <p className="text-slate-500 font-black uppercase tracking-[0.4em] text-xs">Sincronizando con WhatsApp...</p>
                    </div>
                ) : (!stats || stats.length === 0) ? (
                    <div className="py-40 text-center space-y-6 bg-slate-900/30 rounded-[3rem] border border-dashed border-slate-800">
                        <Send size={64} className="mx-auto text-slate-800" />
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-slate-500 uppercase italic tracking-tighter">Sin Datos Registrados</h3>
                            <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">Los envíos aparecerán aquí una vez que ManyChat lance los webhooks</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {stats.map((template, idx) => (
                            <TemplateCard key={idx} template={template} />
                        ))}
                    </div>
                )}

                {/* Footer Insight */}
                <div className="pt-20 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-8 pb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                            <Layers className="text-indigo-500" size={24} />
                        </div>
                        <div>
                            <p className="text-white font-black uppercase tracking-widest text-xs italic">Analytics Engine v2.0</p>
                            <p className="text-slate-600 font-bold text-[9px] uppercase tracking-widest">Procesando interacciones en tiempo real</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-500 font-bold text-[8px] uppercase tracking-[0.3em]">NeurOPS Strategy Board</p>
                        <p className="text-slate-700 font-bold text-[8px] uppercase tracking-[0.3em]">© 2026 • Workshop Performance Hub</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicWorkshopStatsPage;
