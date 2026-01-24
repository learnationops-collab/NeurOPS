import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    Activity,
    Calendar,
    Users,
    TrendingUp,
    CheckCircle2,
    Clock,
    Pin,
    BarChart
} from 'lucide-react';

const CloserDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        try {
            const res = await api.get('/api/closer/dashboard');
            setData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-white">Cargando dashboard...</div>;

    const kpis = data.kpis;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-white italic tracking-tighter">Mi Panel</h1>
                    <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.2em] mt-1">Metricas de Rendimiento</p>
                </div>
                <div className="bg-slate-800/50 p-2 rounded-2xl border border-slate-700 flex items-center gap-4 px-6">
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Comision Mes</p>
                        <p className="text-lg font-black text-emerald-500">${data.commission.month?.toLocaleString()}</p>
                    </div>
                </div>
            </header>

            {/* Performance Circular Progress or similar mini cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Cierre Global</p>
                    <div className="flex items-end gap-2">
                        <h4 className="text-3xl font-black text-white">{data.rates.closing_month?.toFixed(1)}%</h4>
                        <TrendingUp size={18} className="text-emerald-500 mb-2" />
                    </div>
                </div>
                <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Ticket Promedio</p>
                    <h4 className="text-3xl font-black text-white">${kpis.avg_ticket?.toLocaleString()}</h4>
                </div>
                <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Agendas Hoy</p>
                    <h4 className="text-3xl font-black text-indigo-400">{kpis.scheduled}</h4>
                </div>
                <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Ventas Hoy</p>
                    <h4 className="text-3xl font-black text-emerald-500">{kpis.sales_count}</h4>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Agendas Column */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
                        <div className="px-8 py-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Agendas para Hoy</h3>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                <Activity size={12} className="text-indigo-500" />
                                <span>{kpis.completed} Procesadas</span>
                            </div>
                        </div>
                        <div className="divide-y divide-slate-800/50">
                            {data.upcoming_agendas.map(appt => (
                                <div key={appt.id} className="px-8 py-6 flex items-center justify-between hover:bg-slate-800/20 transition-all">
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 bg-slate-800 rounded-2xl flex flex-col items-center justify-center border border-slate-700">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase leading-none">LLAM</span>
                                            <span className="text-xs font-black text-white">#{appt.seq_num}</span>
                                        </div>
                                        <div>
                                            <p className="text-white font-black">{appt.lead_name}</p>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase">
                                                <Clock size={10} />
                                                {new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${appt.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'
                                            }`}>
                                            {appt.status}
                                        </span>
                                        <button className="p-3 bg-indigo-600/10 text-indigo-500 hover:bg-indigo-600 hover:text-white rounded-xl transition-all">
                                            <CheckCircle2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar Column: Recent/Pinned Clients */}
                <div className="space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-800 p-8 shadow-2xl">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Pin size={14} className="text-indigo-500 rotate-12" />
                            Acceso Rapido
                        </h3>
                        <div className="space-y-4">
                            {data.recent_clients.map(client => (
                                <div key={client.id} className="group relative bg-slate-800/30 hover:bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 transition-all cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black text-xs">
                                            {client.username[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white leading-tight">{client.username}</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-black">{client.status}</p>
                                        </div>
                                    </div>
                                    {client.is_pinned && <Pin className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500" size={14} fill="currentColor" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Progress Card */}
                    <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl shadow-indigo-600/20 text-white relative overflow-hidden">
                        <div className="relative z-10 space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Avance del Dia</p>
                            <h3 className="text-3xl font-black italic">{data.progress}%</h3>
                            <div className="w-full bg-indigo-400/30 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-white h-full transition-all duration-1000 shadow-[0_0_8px_white]" style={{ width: `${data.progress}%` }}></div>
                            </div>
                        </div>
                        <BarChart className="absolute -right-4 -bottom-4 text-white/10" size={120} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CloserDashboard;
