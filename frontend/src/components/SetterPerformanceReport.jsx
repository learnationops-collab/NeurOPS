import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    Calendar,
    Users,
    PieChart,
    CheckCircle,
    XCircle,
    Clock,
    TrendingUp,
    Target,
    BarChart3,
    Search,
    ChevronDown,
    Inbox,
    Zap
} from 'lucide-react';
import Card from './ui/Card';
import Counter from './ui/Counter';
import Badge from './ui/Badge';

const SetterPerformanceReport = () => {
    const [performance, setPerformance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [setters, setSetters] = useState([]);

    // Filtros
    const [selectedSetter, setSelectedSetter] = useState('');
    const [period, setPeriod] = useState('this_month');

    useEffect(() => {
        fetchSetters();
    }, []);

    useEffect(() => {
        fetchPerformance();
    }, [selectedSetter, period]);

    const fetchSetters = async () => {
        try {
            const res = await api.get('/admin/users?role=setter');
            setSetters(res.data);
        } catch (err) {
            console.error("Error fetching setters", err);
        }
    };

    const fetchPerformance = async () => {
        try {
            setLoading(true);
            const params = {
                period,
                setter_id: selectedSetter || undefined
            };
            const res = await api.get('/admin/analysis/setter-performance', { params });
            setPerformance(res.data);
        } catch (err) {
            console.error("Error fetching setter performance", err);
        } finally {
            setLoading(false);
        }
    };

    const StatusItem = ({ label, value, icon: Icon, colorClass, percentage }) => (
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-white/10 transition-all">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
                    <Icon className={colorClass.replace('bg-', 'text-')} size={16} />
                </div>
                <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
                    {percentage !== undefined && (
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                            {percentage}% de efectividad
                        </span>
                    )}
                </div>
            </div>
            <span className="text-lg font-black text-white">
                <Counter value={value || 0} />
            </span>
        </div>
    );

    if (loading && !performance) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-indigo-500 font-black uppercase tracking-[0.5em] text-[10px]">Analizando Datos...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in zoom-in-95 duration-500">
            {/* Filters Navigation */}
            <div id="filter-period" className="flex flex-wrap items-center justify-between gap-6 p-2 bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-[2.5rem] sticky top-4 z-40">
                <div className="flex items-center gap-2 p-1">
                    {['today', 'yesterday', 'last_7_days', 'this_month', 'last_month', 'all_time'].map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${period === p
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                : 'text-slate-500 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            {p === 'today' ? 'Hoy' : p === 'yesterday' ? 'Ayer' : p === 'this_month' ? 'Este Mes' : p === 'last_month' ? 'Mes Pasado' : p === 'last_7_days' ? '7 Días' : 'Todo'}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4 pr-4">
                    <div className="relative group min-w-[200px]">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-indigo-400 transition-colors" size={16} />
                        <select
                            value={selectedSetter}
                            onChange={(e) => setSelectedSetter(e.target.value)}
                            className="w-full pl-12 pr-10 py-3 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer hover:bg-slate-800 transition-all font-bold"
                        >
                            <option value="">Todos los Setters</option>
                            {setters.map(s => (
                                <option key={s.id} value={s.id}>{s.username}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
                    </div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card variant="surface" className="p-8 rounded-[2rem] space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                        <Inbox size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Inbound Leads</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-4xl font-black text-white italic tracking-tighter">
                                <Counter value={performance?.stats?.inbound_leads || 0} />
                            </h2>
                        </div>
                    </div>
                </Card>

                <Card variant="surface" className="p-8 rounded-[2rem] space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Zap size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Aperturas</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-4xl font-black text-white italic tracking-tighter">
                                <Counter value={performance?.stats?.openings || 0} />
                            </h2>
                            <span className="text-[10px] font-black text-emerald-500/60">
                                {performance?.stats?.inbound_leads > 0 ? ((performance.stats.openings / performance.stats.inbound_leads) * 100).toFixed(1) : 0}%
                            </span>
                        </div>
                    </div>
                </Card>

                <Card variant="surface" className="p-8 rounded-[2rem] space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Agendas booked</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-4xl font-black text-white italic tracking-tighter">
                                <Counter value={performance?.stats?.appointments_booked || 0} />
                            </h2>
                            <span className="text-[10px] font-black text-amber-500/60">
                                {performance?.stats?.openings > 0 ? ((performance.stats.appointments_booked / performance.stats.openings) * 100).toFixed(1) : 0}%
                            </span>
                        </div>
                    </div>
                </Card>

                <Card variant="surface" className="p-8 rounded-[2rem] space-y-4 border-indigo-500/30 bg-indigo-500/5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Conversión</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-4xl font-black text-white italic tracking-tighter">
                                <Counter value={performance?.kpis?.conversion_rate || 0} suffix="%" />
                            </h2>
                            <span className="text-[10px] font-black text-indigo-500/60">Global</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2 ml-4">
                        <BarChart3 size={16} /> Detalle de Actividad
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        <StatusItem
                            label="Ofertas Realizadas"
                            value={performance?.stats?.new_offers}
                            icon={CheckCircle}
                            colorClass="bg-emerald-500"
                            percentage={performance?.stats?.openings > 0 ? ((performance.stats.new_offers / performance.stats.openings) * 100).toFixed(1) : 0}
                        />
                        <StatusItem
                            label="Links Enviados"
                            value={performance?.stats?.links_sent}
                            icon={TrendingUp}
                            colorClass="bg-blue-500"
                            percentage={performance?.stats?.openings > 0 ? ((performance.stats.links_sent / performance.stats.openings) * 100).toFixed(1) : 0}
                        />
                        <StatusItem
                            label="No es Lead / Descartados"
                            value={performance?.stats?.not_lead}
                            icon={XCircle}
                            colorClass="bg-rose-500"
                            percentage={performance?.stats?.inbound_leads > 0 ? ((performance.stats.not_lead / performance.stats.inbound_leads) * 100).toFixed(1) : 0}
                        />
                        <StatusItem
                            label="Follow ups"
                            value={performance?.stats?.follow_ups}
                            icon={Clock}
                            colorClass="bg-amber-500"
                            percentage={performance?.stats?.openings > 0 ? ((performance.stats.follow_ups / performance.stats.openings) * 100).toFixed(1) : 0}
                        />
                    </div>
                </div>

                {/* Info Card */}
                <Card variant="surface" className="relative overflow-hidden p-10 rounded-[3rem] bg-indigo-600/5 flex flex-col justify-center text-center space-y-6">
                    <PieChart size={140} className="absolute -right-10 -bottom-10 text-indigo-500/5 -rotate-12" />
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Reportes Procesados</p>
                        <h2 className="text-6xl font-black text-white italic tracking-tighter">
                            <Counter value={performance?.count || 0} />
                        </h2>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Días con actividad registrada</p>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default SetterPerformanceReport;
