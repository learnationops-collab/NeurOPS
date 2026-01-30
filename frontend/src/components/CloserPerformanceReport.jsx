import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    Calendar,
    Users,
    PieChart,
    CheckCircle,
    XCircle,
    Clock,
    RotateCcw,
    TrendingUp,
    Target,
    BarChart3,
    Search,
    ChevronDown
} from 'lucide-react';
import Card from './ui/Card';
import Counter from './ui/Counter';
import Badge from './ui/Badge';

const CloserPerformanceReport = () => {
    const [performance, setPerformance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [closers, setClosers] = useState([]);

    // Filtros
    const [selectedCloser, setSelectedCloser] = useState('');
    const [period, setPeriod] = useState('today');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    useEffect(() => {
        fetchClosers();
    }, []);

    useEffect(() => {
        fetchPerformance();
    }, [selectedCloser, period, dateRange]);

    const fetchClosers = async () => {
        try {
            const res = await api.get('/admin/users?role=closer');
            setClosers(res.data);
        } catch (err) {
            console.error("Error fetching closers", err);
        }
    };

    const fetchPerformance = async () => {
        try {
            setLoading(true);
            const params = {
                period,
                start_date: dateRange.start,
                end_date: dateRange.end,
                closer_id: selectedCloser || undefined
            };
            const res = await api.get('/admin/analysis/closer-performance', { params });
            setPerformance(res.data);
        } catch (err) {
            console.error("Error fetching performance", err);
        } finally {
            setLoading(false);
        }
    };

    const StatusItem = ({ label, value, icon: Icon, colorClass }) => (
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-white/10 transition-all">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
                    <Icon className={colorClass.replace('bg-', 'text-')} size={14} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
            <span className="text-sm font-black text-white">
                <Counter value={value || 0} />
            </span>
        </div>
    );

    const StatCard = ({ title, data, icon: Icon, gradient }) => (
        <Card variant="surface" className={`overflow-hidden relative group rounded-[2rem]`}>
            {/* Background Accent */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-[0.03] -mr-16 -mt-16 rounded-full group-hover:scale-125 transition-transform duration-700`} />

            <div className="relative space-y-6">
                <div className="flex justify-between items-start">
                    <div className={`p-3 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg shadow-black/20`}>
                        <Icon size={24} className="text-white" />
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{title}</p>
                        <h2 className="text-4xl font-black text-white italic tracking-tighter">
                            <Counter value={data.total || 0} />
                        </h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                    <StatusItem label="Completadas" value={data.completed} icon={CheckCircle} colorClass="bg-emerald-500" />
                    <StatusItem label="Pendientes" value={data.pending} icon={Clock} colorClass="bg-indigo-500" />
                    <StatusItem label="Reagendadas" value={data.rescheduled} icon={RotateCcw} colorClass="bg-amber-500" />
                    <StatusItem label="No Show" value={data.no_show} icon={XCircle} colorClass="bg-rose-500" />
                    <StatusItem label="Canceladas" value={data.canceled} icon={XCircle} colorClass="bg-slate-500" />
                </div>
            </div>
        </Card>
    );

    const PercentageCard = ({ label, value, icon: Icon, colorClass, suffix = "%" }) => (
        <div className="bg-slate-800/20 border border-slate-700/50 rounded-[2rem] p-6 flex flex-col justify-between hover:border-white/20 transition-all">
            <div className="flex justify-between items-center mb-4">
                <div className={`p-2 rounded-xl ${colorClass} bg-opacity-20`}>
                    <Icon className={colorClass.replace('bg-', 'text-')} size={20} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${colorClass.replace('bg-', 'text-')}`}>
                    Performance
                </span>
            </div>
            <div>
                <h4 className="text-3xl font-black text-white italic tracking-tighter mb-1">
                    <Counter value={value || 0} suffix={suffix} />
                </h4>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                    {label}
                </p>
            </div>
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
            <div className="flex flex-wrap items-center justify-between gap-6 p-2 bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-[2.5rem] sticky top-4 z-40">
                <div className="flex items-center gap-2 p-1">
                    {['today', 'yesterday', 'this_month', 'last_month', 'last_7_days', 'all_time'].map((p) => (
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
                            value={selectedCloser}
                            onChange={(e) => setSelectedCloser(e.target.value)}
                            className="w-full pl-12 pr-10 py-3 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer hover:bg-slate-800 transition-all"
                        >
                            <option value="">Todos los Closers</option>
                            {closers.map(c => (
                                <option key={c.id} value={c.id}>{c.username}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
                    </div>
                </div>
            </div>

            {/* Agendas Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <StatCard
                    title="Agendas Totales"
                    data={performance?.agendas?.total_agendas || {}}
                    icon={PieChart}
                    gradient="from-indigo-600 to-blue-500"
                />
                <StatCard
                    title="Primeras Agendas"
                    data={performance?.agendas?.first_agendas || {}}
                    icon={Calendar}
                    gradient="from-emerald-600 to-teal-500"
                />
                <StatCard
                    title="Segundas Agendas"
                    data={performance?.agendas?.second_agendas || {}}
                    icon={Target}
                    gradient="from-amber-600 to-orange-500"
                />
            </div>

            {/* KPIs & Conversion */}
            <div className="space-y-6">
                <div className="flex items-center gap-4 mb-2">
                    <BarChart3 className="text-indigo-500" size={20} />
                    <h3 className="text-lg font-black text-white italic tracking-tighter">KPIs de Conversión</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-6">
                    <PercentageCard
                        label="% de Cierre"
                        value={performance?.kpis?.closing_rate}
                        icon={TrendingUp}
                        colorClass="bg-emerald-500"
                    />
                    <PercentageCard
                        label="% de Conversión"
                        value={performance?.kpis?.conversion_rate}
                        icon={Target}
                        colorClass="bg-indigo-500"
                    />
                    <PercentageCard
                        label="% de Asistencia"
                        value={performance?.kpis?.attendance_rate}
                        icon={Users}
                        colorClass="bg-blue-500"
                    />
                    <PercentageCard
                        label="% No Show"
                        value={performance?.kpis?.no_show_rate}
                        icon={XCircle}
                        colorClass="bg-rose-500"
                    />
                    <PercentageCard
                        label="% de Cancelación"
                        value={performance?.kpis?.cancellation_rate}
                        icon={XCircle}
                        colorClass="bg-slate-500"
                    />
                    <PercentageCard
                        label="% de Reagendamiento"
                        value={performance?.kpis?.rescheduling_rate}
                        icon={RotateCcw}
                        colorClass="bg-amber-500"
                    />
                </div>
            </div>

            {/* Sales Summary Mini */}
            <div className="flex items-center justify-center p-12 bg-indigo-600/5 border border-indigo-500/20 rounded-[3rem] relative overflow-hidden group">
                <TrendingUp size={120} className="absolute -left-10 -bottom-10 text-indigo-500/10 -rotate-12 group-hover:scale-110 transition-transform duration-700" />
                <div className="text-center space-y-2 relative">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Ventas Totales en el Periodo</p>
                    <h2 className="text-7xl font-black text-white italic tracking-tighter">
                        <Counter value={performance?.sales || 0} />
                    </h2>
                </div>
                <div className="absolute top-8 right-12">
                    <Badge variant="success" className="px-4 py-2 text-[10px] font-black uppercase tracking-widest">Confirmadas</Badge>
                </div>
            </div>
        </div>
    );
};

export default CloserPerformanceReport;
