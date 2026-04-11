import React, { useState, useEffect } from 'react';
import { X, Users, TrendingUp, DollarSign, Calendar, Instagram, Loader2, CalendarDays } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';

const AdDetailModal = ({ adId, isOpen, onClose }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);

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
                    <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
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
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 size={32} className="animate-spin text-blue-500" />
                            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Obteniendo Métricas...</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatCard 
                                    label="Leads Totales" 
                                    value={details.total_leads} 
                                    icon={<Users className="text-blue-400" size={14} />}
                                    color="blue"
                                />
                                <StatCard 
                                    label="% Cualificación" 
                                    value={`${details.qualified_percentage}%`} 
                                    subValue={`(${details.qualified_leads})`}
                                    icon={<TrendingUp className="text-emerald-400" size={14} />}
                                    color="emerald"
                                />
                                <StatCard 
                                    label="Agendas" 
                                    value={details.agendas || 0} 
                                    icon={<Calendar className="text-cyan-400" size={14} />}
                                    color="cyan"
                                />
                                <StatCard 
                                    label="Ventas" 
                                    value={details.ventas || 0} 
                                    icon={<DollarSign className="text-amber-400" size={14} />}
                                    color="amber"
                                />
                                <StatCard 
                                    label="CPL" 
                                    value={`$${details.cpl}`} 
                                    icon={<DollarSign className="text-slate-400" size={14} />}
                                    color="slate"
                                />
                                <StatCard 
                                    label="CPA" 
                                    value={`$${details.cpa || 0}`} 
                                    icon={<DollarSign className="text-cyan-400" size={14} />}
                                    color="cyan"
                                />
                                <StatCard 
                                    label="CPV" 
                                    value={`$${details.cpv || 0}`} 
                                    icon={<DollarSign className="text-amber-400" size={14} />}
                                    color="amber"
                                />
                                <StatCard 
                                    label="Inversión" 
                                    value={`$${details.spend || 0}`} 
                                    icon={<DollarSign className="text-violet-400" size={14} />}
                                    color="violet"
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
                                                        const date = new Date(str);
                                                        return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
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

const StatCard = ({ label, value, subValue, icon, color }) => {
    const colors = {
        blue: "text-blue-400 bg-blue-500/5 border-blue-500/20",
        emerald: "text-emerald-400 bg-emerald-500/5 border-emerald-500/20",
        amber: "text-amber-400 bg-amber-500/5 border-amber-500/20",
        violet: "text-violet-400 bg-violet-500/5 border-violet-500/20",
    };

    return (
        <div className={`p-4 rounded-2xl border ${colors[color]}`}>
            <div className="flex items-center gap-2 mb-2 opacity-70">
                {icon}
                <p className="text-[9px] font-black uppercase tracking-wider">{label}</p>
            </div>
            <div className="flex items-baseline gap-1.5">
                <p className="text-xl font-black text-white">{value}</p>
                {subValue && <span className="text-[10px] font-bold text-slate-500">{subValue}</span>}
            </div>
        </div>
    );
};

export default AdDetailModal;
