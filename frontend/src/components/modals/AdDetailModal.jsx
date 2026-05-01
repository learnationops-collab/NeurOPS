import React, { useState, useEffect } from 'react';
import { X, Users, TrendingUp, DollarSign, Calendar, Instagram, Loader2, CalendarDays, HelpCircle, MessageCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';

const AdDetailModal = ({ adId, isOpen, onClose }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [adjustingDate, setAdjustingDate] = useState(null);
    const [adjustValue, setAdjustValue] = useState("");
    const [activeTab, setActiveTab] = useState('performance'); // 'performance' | 'conversations'

    useEffect(() => {
        if (isOpen && adId) {
            fetchDetails();
        }
    }, [isOpen, adId]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/manychat-webhook/ad-details/${adId}`);
            setDetails(res.data);
        } catch (err) {
            console.error('Error fetching ad details:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdjustLeads = async (dateStr) => {
        if (adjustValue === "" || parseInt(adjustValue) < 0) return alert("Ingresa un número válido (0 o mayor)");
        const [y, m, d] = dateStr.split('-');
        const safeDate = new Date(y, m - 1, d);
        if (!window.confirm(`¿Ajustar a ${adjustValue} leads el día ${safeDate.toLocaleDateString('es-AR')}? El sistema reasignará o creará comodines automáticamente.`)) return;
        
        try {
            const res = await api.post(`/marketing/ads/${adId}/adjust-leads`, {
                date: dateStr,
                target_count: parseInt(adjustValue)
            });
            alert(res.data.message);
            setAdjustingDate(null);
            fetchDetails();
        } catch (err) {
            alert(err.response?.data?.message || err.message);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                />
                
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-500/10 rounded-xl">
                                <TrendingUp className="text-blue-400" size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                                    {loading ? 'Cargando Detalles...' : details?.name}
                                </h3>
                                <p className="text-xs text-slate-500 font-mono">ID: {adId}</p>
                            </div>
                        </div>

                        {!loading && details && (
                            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
                                <button
                                    onClick={() => setActiveTab('performance')}
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'performance' ? 'bg-slate-800 text-blue-400 shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <TrendingUp size={12} /> Rendimiento
                                </button>
                                <button
                                    onClick={() => setActiveTab('conversations')}
                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'conversations' ? 'bg-slate-800 text-emerald-400 shadow' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <MessageCircle size={12} /> Conversaciones
                                </button>
                            </div>
                        )}

                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors self-start sm:self-auto"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 size={32} className="animate-spin text-blue-500" />
                            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Obteniendo Métricas...</p>
                        </div>
                    ) : !details ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                            <X size={32} className="text-red-500" />
                            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Error al cargar datos del anuncio</p>
                            <button 
                                onClick={fetchDetails}
                                className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                Reintentar
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            
                            {activeTab === 'performance' ? (
                                <>
                                    {/* Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatCard 
                                    label="Leads Totales" 
                                    value={details.total_leads} 
                                    icon={<Users className="text-blue-400" size={14} />}
                                    color="blue"
                                    description="Suma total de leads registrados para este anuncio en el periodo seleccionado."
                                />
                                <StatCard 
                                    label="% Cualificación" 
                                    value={`${details.qualified_percentage}%`} 
                                    subValue={`(${details.qualified_leads})`}
                                    icon={<TrendingUp className="text-emerald-400" size={14} />}
                                    color="emerald"
                                    description="Porcentaje de leads marcados como cualificados. Cálculo: (Cualificados / Total Leads)."
                                />
                                <StatCard 
                                    label="Agendas" 
                                    value={details.agendas || 0} 
                                    icon={<Calendar className="text-cyan-400" size={14} />}
                                    color="cyan"
                                    description="Cantidad de leads que agendaron una llamada o cita."
                                />
                                <StatCard 
                                    label="Ventas" 
                                    value={details.ventas || 0} 
                                    icon={<DollarSign className="text-amber-400" size={14} />}
                                    color="amber"
                                    description="Cantidad de leads que terminaron en una venta cerrada."
                                />
                                <StatCard 
                                    label="CPL / CPQL" 
                                    value={`$${details.cpl}`} 
                                    subValue={`($${details.cpql})`}
                                    icon={<DollarSign className="text-slate-400" size={14} />}
                                    color="slate"
                                    description="CPL: Costo por lead. CPQL: Costo por lead cualificado."
                                />
                                <StatCard 
                                    label="CPA" 
                                    value={`$${details.cpa || 0}`} 
                                    icon={<DollarSign className="text-cyan-400" size={14} />}
                                    color="cyan"
                                    description="Costo por cada agenda conseguida. Cálculo: (Inversión / Agendas)."
                                />
                                <StatCard 
                                    label="CPV" 
                                    value={`$${details.cpv || 0}`} 
                                    icon={<DollarSign className="text-amber-400" size={14} />}
                                    color="amber"
                                    description="Costo por cada venta cerrada. Cálculo: (Inversión / Ventas)."
                                />
                                <StatCard 
                                    label="Inversión" 
                                    value={`$${details.spend || 0}`} 
                                    icon={<DollarSign className="text-violet-400" size={14} />}
                                    color="violet"
                                    description="Gasto total reportado en la plataforma de anuncios para este periodo."
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Evolution Chart */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="text-slate-400" size={16} />
                                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Evolución (Últimos 30 días)</h4>
                                    </div>
                                    <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-4 h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={details.evolution}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                                <XAxis 
                                                    dataKey="date" 
                                                    stroke="#64748b" 
                                                    fontSize={10} 
                                                    tickFormatter={(str) => {
                                                        const [year, month, day] = str.split('-');
                                                        const safeDate = new Date(year, month - 1, day);
                                                        return safeDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
                                                    }}
                                                />
                                                <YAxis stroke="#64748b" fontSize={10} />
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: '12px', borderRadius: '8px' }}
                                                    itemStyle={{ color: '#3b82f6' }}
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="leads" 
                                                    stroke="#3b82f6" 
                                                    strokeWidth={3} 
                                                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                                                    activeDot={{ r: 6 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                    
                                    {/* Daily Breakdown for Adjustment */}
                                    <div className="mt-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Ajuste de Leads Diarios (Últimos 7 días)</h4>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {details.evolution && details.evolution.slice(-7).map(day => {
                                                const [y, m, d] = day.date.split('-');
                                                const safeDate = new Date(y, m - 1, d);
                                                return (
                                                <div key={day.date} className="bg-slate-800/40 border border-slate-700/50 p-2 rounded-lg flex flex-col justify-between group">
                                                    <span className="text-[9px] font-bold text-slate-400 mb-1">
                                                        {safeDate.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}
                                                    </span>
                                                    {adjustingDate === day.date ? (
                                                        <div className="flex items-center gap-1">
                                                            <input 
                                                                type="number" 
                                                                autoFocus
                                                                className="w-full bg-slate-900 border border-blue-500 rounded text-xs text-white px-1 py-0.5 outline-none font-mono text-center"
                                                                value={adjustValue}
                                                                onChange={e => setAdjustValue(e.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') handleAdjustLeads(day.date);
                                                                    if (e.key === 'Escape') setAdjustingDate(null);
                                                                }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div 
                                                            className="flex items-center justify-between cursor-pointer hover:bg-slate-700/30 p-1 -mx-1 rounded transition-colors"
                                                            onClick={() => {
                                                                setAdjustingDate(day.date);
                                                                setAdjustValue(day.leads.toString());
                                                            }}
                                                            title="Clic para ajustar cantidad de leads"
                                                        >
                                                            <span className="text-sm font-black text-white">{day.leads}</span>
                                                            <span className="text-[8px] text-blue-400 opacity-0 group-hover:opacity-100 uppercase font-black transition-opacity">Editar</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )})}
                                        </div>
                                    </div>
                                </div>

                                {/* Setter Breakdown & Recent Leads */}
                                <div className="space-y-6">
                                    {/* Setter Breakdown */}
                                    {details.setter_breakdown && Object.keys(details.setter_breakdown).length > 0 && (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2">
                                                <Users className="text-slate-400" size={16} />
                                                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Agendas por Setter</h4>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                {Object.entries(details.setter_breakdown).map(([setter, count]) => (
                                                    <div key={setter} className="bg-slate-800/20 border border-slate-800/50 p-3 rounded-xl flex items-center justify-between">
                                                        <span className="text-xs font-bold text-slate-300">{setter}</span>
                                                        <span className="text-emerald-400 font-black">{count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {/* End of Setter Breakdown */}

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Users className="text-slate-400" size={16} />
                                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Últimas Personas Registradas</h4>
                                        </div>
                                    <div className="bg-slate-800/30 border border-slate-800 rounded-2xl overflow-hidden">
                                        <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                            {details.recent_leads.length === 0 ? (
                                                <div className="p-8 text-center text-slate-500 text-sm">No hay registros recientes</div>
                                            ) : (
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="sticky top-0 bg-slate-800/80 backdrop-blur-md text-[10px] font-black uppercase text-slate-500 border-b border-slate-700/50">
                                                        <tr>
                                                            <th className="px-4 py-2">Nombre</th>
                                                            <th className="px-4 py-2">Estado</th>
                                                            <th className="px-4 py-2">Fecha</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800/50">
                                                        {details.recent_leads.map((lead, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-700/20 transition-colors">
                                                                <td className="px-4 py-3">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-bold text-white">{lead.name || 'Desconocido'}</span>
                                                                        {lead.ig && (
                                                                            <span className="text-[10px] text-pink-400 flex items-center gap-1">
                                                                                <Instagram size={8} /> @{lead.ig}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                                        lead.qualification === 'true' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                                        lead.qualification === 'false' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                                        'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                                                    }`}>
                                                                        {lead.qualification === 'true' ? 'Cualif.' : lead.qualification === 'false' ? 'No Cualif.' : 'Pend.'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-[10px] text-slate-500 font-mono">
                                                                    {new Date(lead.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                </div>
                            </div>
                            </>
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MessageCircle className="text-emerald-400" size={16} />
                                        <h4 className="text-xs font-black uppercase text-emerald-400 tracking-wider">Métricas Conversacionales</h4>
                                    </div>
                                    <p className="text-xs text-slate-400 font-medium mb-6">
                                        Analiza cuáles son los mensajes gancho iniciales que más atraen a los usuarios y qué preguntas de seguimiento generan más respuestas y reactivaciones.
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Opciones Iniciales */}
                                        <div className="bg-slate-800/30 border border-slate-800 rounded-3xl p-6 shadow-xl">
                                            <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-4 flex items-center justify-between">
                                                <span>Opciones Iniciales (Ganchos)</span>
                                            </h5>
                                            {details.option_breakdown && Object.keys(details.option_breakdown).length > 0 ? (
                                                <div className="space-y-3">
                                                    {Object.entries(details.option_breakdown).sort((a,b)=>b[1]-a[1]).map(([opt, count]) => {
                                                        const total = Object.values(details.option_breakdown).reduce((sum, val) => sum + val, 0);
                                                        const percentage = Math.round((count / total) * 100);
                                                        return (
                                                            <div key={opt} className="group relative">
                                                                <div className="flex justify-between items-center bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 hover:border-blue-500/30 transition-colors z-10 relative">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-bold text-slate-200" title={opt}>{opt}</span>
                                                                        <span className="text-[10px] font-medium text-slate-500">{percentage}% del total de respuestas</span>
                                                                    </div>
                                                                    <span className="text-sm font-black text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">{count}</span>
                                                                </div>
                                                                {/* Progress bar background */}
                                                                <div className="absolute left-0 top-0 bottom-0 bg-blue-500/5 rounded-xl z-0 transition-all" style={{ width: `${percentage}%` }}></div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-center py-12 text-slate-500 text-[10px] font-medium border border-dashed border-slate-700/50 rounded-2xl flex flex-col items-center gap-2">
                                                    <MessageCircle size={24} className="opacity-20" />
                                                    Sin datos registrados
                                                </div>
                                            )}
                                        </div>

                                        {/* Preguntas/Seguimientos */}
                                        <div className="bg-slate-800/30 border border-slate-800 rounded-3xl p-6 shadow-xl">
                                            <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-4 flex items-center justify-between">
                                                <span>Seguimientos Respondidos</span>
                                            </h5>
                                            {details.question_breakdown && Object.keys(details.question_breakdown).length > 0 ? (
                                                <div className="space-y-3">
                                                    {Object.entries(details.question_breakdown).sort((a,b)=>b[1]-a[1]).map(([q, count]) => {
                                                        const total = Object.values(details.question_breakdown).reduce((sum, val) => sum + val, 0);
                                                        const percentage = Math.round((count / total) * 100);
                                                        return (
                                                            <div key={q} className="group relative">
                                                                <div className="flex justify-between items-center bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 hover:border-emerald-500/30 transition-colors z-10 relative">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-bold text-slate-200" title={q}>{q}</span>
                                                                        <span className="text-[10px] font-medium text-slate-500">{percentage}% del total de respuestas</span>
                                                                    </div>
                                                                    <span className="text-sm font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">{count}</span>
                                                                </div>
                                                                {/* Progress bar background */}
                                                                <div className="absolute left-0 top-0 bottom-0 bg-emerald-500/5 rounded-xl z-0 transition-all" style={{ width: `${percentage}%` }}></div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-center py-12 text-slate-500 text-[10px] font-medium border border-dashed border-slate-700/50 rounded-2xl flex flex-col items-center gap-2">
                                                    <MessageCircle size={24} className="opacity-20" />
                                                    Sin datos registrados
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Footer */}
                    <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-900/50">
                        <button 
                            onClick={onClose}
                            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                        >
                            Cerrar
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const StatCard = ({ label, value, subValue, icon, color, description }) => {
    const colors = {
        blue: "text-blue-400 bg-blue-500/5 border-blue-500/20",
        emerald: "text-emerald-400 bg-emerald-500/5 border-emerald-500/20",
        amber: "text-amber-400 bg-amber-500/5 border-amber-500/20",
        violet: "text-violet-400 bg-violet-500/5 border-violet-500/20",
        cyan: "text-cyan-400 bg-cyan-500/5 border-cyan-500/20",
        slate: "text-slate-400 bg-slate-500/5 border-slate-500/20",
    };

    return (
        <div className={`p-4 rounded-2xl border ${colors[color] || colors.slate} relative group/stat overflow-visible`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 opacity-70">
                    {icon}
                    <p className="text-[9px] font-black uppercase tracking-wider">{label}</p>
                </div>
                {description && (
                    <div className="relative group/tooltip">
                        <HelpCircle size={10} className="text-slate-500 cursor-help hover:text-white transition-colors" />
                        <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-50 shadow-xl border border-slate-700/50">
                            {description}
                            <div className="absolute top-full right-1.5 border-4 border-transparent border-t-slate-800"></div>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex items-baseline gap-1.5">
                <p className="text-xl font-black text-white">{value}</p>
                {subValue && <span className="text-[10px] font-bold text-slate-500">{subValue}</span>}
            </div>
        </div>
    );
};

export default AdDetailModal;
