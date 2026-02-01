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
    ChevronDown,
    LayoutDashboard,
    DollarSign,
    Wallet,
    X
} from 'lucide-react';
import Card from './ui/Card';
import Counter from './ui/Counter';
import Badge from './ui/Badge';

const CloserPerformanceReport = () => {
    const [performance, setPerformance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [closers, setClosers] = useState([]);

    // Filtros
    // Filtros
    const [selectedCloser, setSelectedCloser] = useState('');
    const [period, setPeriod] = useState('last_month');
    const [customDates, setCustomDates] = useState({ start: '', end: '' });
    const [activeTab, setActiveTab] = useState('general');

    useEffect(() => {
        fetchClosers();
    }, []);

    useEffect(() => {
        if (period === 'custom' && (!customDates.start || !customDates.end)) return;
        fetchPerformance();
    }, [selectedCloser, period, customDates]);

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
                closer_id: selectedCloser || undefined,
                start_date: period === 'custom' ? customDates.start : undefined,
                end_date: period === 'custom' ? customDates.end : undefined
            };
            const res = await api.get('/admin/analysis/closer-performance', { params });
            setPerformance(res.data);
        } catch (err) {
            console.error("Error fetching performance", err);
        } finally {
            setLoading(false);
        }
    };

    const getPercentage = (value, total) => {
        if (!total || total === 0) return '0%';
        return `${Math.round((value / total) * 100)}%`;
    };

    const StatusItem = ({ label, value, total, icon: Icon, colorClass }) => (
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-white/10 transition-all">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
                    <Icon className={colorClass.replace('bg-', 'text-')} size={14} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                    {total > 0 && (
                        <span className="text-[10px] text-slate-500 font-medium">{getPercentage(value, total)} del total</span>
                    )}
                </div>
            </div>
            <span className="text-sm font-black text-white">
                <Counter value={value || 0} />
            </span>
        </div>
    );

    const StatCard = ({ title, value, total, icon: Icon, gradient, subtext }) => (
        <Card variant="surface" className={`overflow-hidden relative group rounded-[2rem]`}>
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-[0.03] -mr-16 -mt-16 rounded-full group-hover:scale-125 transition-transform duration-700`} />
            <div className="relative space-y-4">
                <div className="flex justify-between items-start">
                    <div className={`p-3 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg shadow-black/20`}>
                        <Icon size={24} className="text-white" />
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{title}</p>
                        <h2 className="text-4xl font-black text-white italic tracking-tighter">
                            <Counter value={value || 0} prefix={title.includes('Money') || title.includes('Ticket') ? '$' : ''} />
                        </h2>
                    </div>
                </div>
                {(subtext || total > 0) && (
                    <p className="text-xs text-slate-400 text-right">
                        {subtext || `${getPercentage(value, total)} del total`}
                    </p>
                )}
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
                    KPI
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
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Context Header with Filters */}
            <div className="flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center p-2 bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-[2.5rem] sticky top-4 z-40">
                <div className="flex items-center gap-2 p-1 overflow-x-auto max-w-full transition-all duration-300">
                    {period !== 'custom' ? (
                        <>
                            {['today', 'yesterday', 'this_month', 'last_month', 'last_7_days', 'all_time', 'custom'].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${period === p
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                        : 'text-slate-500 hover:text-white hover:bg-slate-800'
                                        }`}
                                >
                                    {p === 'today' ? 'Hoy' : p === 'yesterday' ? 'Ayer' : p === 'this_month' ? 'Este Mes' : p === 'last_month' ? 'Mes Pasado' : p === 'last_7_days' ? '7 Días' : p === 'all_time' ? 'Todo' : 'Personalizado'}
                                </button>
                            ))}
                        </>
                    ) : (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-4 duration-300">
                            <button
                                onClick={() => setPeriod('last_month')}
                                className="p-3 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>

                            <div className="relative group">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-indigo-400" size={14} />
                                <input
                                    type="date"
                                    value={customDates.start}
                                    onChange={(e) => setCustomDates(prev => ({ ...prev, start: e.target.value }))}
                                    className="pl-9 pr-3 py-3 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white text-xs font-bold uppercase tracking-wide outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-slate-800 transition-all"
                                />
                            </div>
                            <span className="text-slate-500 font-bold">-</span>
                            <div className="relative group">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-indigo-400" size={14} />
                                <input
                                    type="date"
                                    value={customDates.end}
                                    onChange={(e) => setCustomDates(prev => ({ ...prev, end: e.target.value }))}
                                    className="pl-9 pr-3 py-3 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white text-xs font-bold uppercase tracking-wide outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-slate-800 transition-all"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 px-4 w-full xl:w-auto">
                    <div className="relative group w-full xl:w-[200px]">
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

            {/* View Tabs */}
            <div className="flex justify-center">
                <div className="flex bg-slate-900/60 p-1.5 rounded-[2rem] border border-slate-800 backdrop-blur-sm">
                    {[
                        { id: 'general', label: 'General', icon: LayoutDashboard },
                        { id: 'sales', label: 'Ventas', icon: DollarSign },
                        { id: 'agendas', label: 'Agendas', icon: Calendar }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-8 py-3 rounded-[1.5rem] transition-all ${activeTab === tab.id
                                ? 'bg-white text-slate-900 shadow-xl shadow-white/10'
                                : 'text-slate-500 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <tab.icon size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Areas */}
            <div className="space-y-6">

                {activeTab === 'general' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* High Level Overview */}
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/40">
                            <div className="relative z-10">
                                <p className="text-indigo-200 font-bold uppercase tracking-widest text-xs mb-2">Cash Collected</p>
                                <h2 className="text-6xl font-black italic tracking-tighter mb-8">
                                    <Counter value={performance?.financials?.cash_collected || 0} prefix="$" />
                                </h2>
                                <div className="flex items-center gap-4">
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Cierres</p>
                                        <p className="text-2xl font-black"><Counter value={performance?.sales || 0} /></p>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Closing Rate</p>
                                        <p className="text-2xl font-black"><Counter value={performance?.kpis?.closing_rate || 0} suffix="%" /></p>
                                    </div>
                                </div>
                            </div>
                            <Wallet className="absolute -bottom-12 -right-12 text-white/5 rotate-12" size={300} />
                        </div>

                        <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col justify-center relative overflow-hidden">
                            <div className="relative z-10 space-y-6">
                                <div className="flex justify-between items-center">
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Eficiencia de Agenda</p>
                                    <Badge variant={performance?.kpis?.show_up_rate > 60 ? 'success' : 'warning'}>
                                        {performance?.kpis?.show_up_rate > 60 ? 'Saludable' : 'Atención'}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <PercentageCard label="Show Rate" value={performance?.kpis?.show_up_rate} icon={Users} colorClass="bg-blue-500" />
                                    <PercentageCard label="Oferta" value={performance?.kpis?.offer_rate || 0} icon={Target} colorClass="bg-amber-500" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'sales' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatCard
                                title="Cash Collected"
                                value={performance?.financials?.cash_collected}
                                icon={DollarSign}
                                gradient="from-emerald-600 to-teal-500"
                            />
                            <StatCard
                                title="Ticket Promedio"
                                value={performance?.financials?.average_ticket}
                                icon={TrendingUp}
                                gradient="from-indigo-600 to-blue-500"
                            />
                            <StatCard
                                title="Total Cierres"
                                value={performance?.sales}
                                icon={CheckCircle}
                                gradient="from-violet-600 to-purple-500"
                            />
                        </div>

                        <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8">
                            <h3 className="text-xl font-black text-white italic tracking-tighter mb-6">Detalle Financiero</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <PercentageCard label="% Cierre Global" value={performance?.kpis?.closing_rate_global} icon={Target} colorClass="bg-blue-500" />
                                <PercentageCard label="% Cierre (Pres)" value={performance?.kpis?.closing_rate_presentation} icon={CheckCircle} colorClass="bg-emerald-500" />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'agendas' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <StatCard
                                title="Agendas Totales"
                                value={performance?.agendas?.total_agendas?.total}
                                icon={PieChart}
                                gradient="from-slate-700 to-slate-600"
                            />
                            <StatCard
                                title="Primeras Agendas"
                                value={performance?.agendas?.first_agendas?.total}
                                total={performance?.agendas?.total_agendas?.total}
                                icon={Calendar}
                                gradient="from-indigo-600 to-blue-500"
                            />
                            <StatCard
                                title="Segundas Agendas"
                                value={performance?.agendas?.second_agendas?.total}
                                total={performance?.agendas?.total_agendas?.total}
                                icon={Target}
                                gradient="from-amber-600 to-orange-500"
                            />
                        </div>

                        <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8">
                            <h3 className="text-xl font-black text-white italic tracking-tighter mb-6">Desglose de Estados</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                <StatusItem
                                    label="Completadas"
                                    value={performance?.agendas?.total_agendas?.completed}
                                    total={performance?.agendas?.total_agendas?.total}
                                    icon={CheckCircle}
                                    colorClass="bg-emerald-500"
                                />
                                <StatusItem
                                    label="No Show"
                                    value={performance?.agendas?.total_agendas?.no_show}
                                    total={performance?.agendas?.total_agendas?.total}
                                    icon={XCircle}
                                    colorClass="bg-rose-500"
                                />
                                <StatusItem
                                    label="Canceladas"
                                    value={performance?.agendas?.total_agendas?.canceled}
                                    total={performance?.agendas?.total_agendas?.total}
                                    icon={XCircle}
                                    colorClass="bg-slate-500"
                                />
                                <StatusItem
                                    label="Reagendadas"
                                    value={performance?.agendas?.total_agendas?.rescheduled}
                                    total={performance?.agendas?.total_agendas?.total}
                                    icon={RotateCcw}
                                    colorClass="bg-amber-500"
                                />
                                <StatusItem
                                    label="Pendientes"
                                    value={performance?.agendas?.total_agendas?.pending}
                                    total={performance?.agendas?.total_agendas?.total}
                                    icon={Clock}
                                    colorClass="bg-blue-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                            <PercentageCard label="Asistencia" value={performance?.kpis?.show_up_rate} icon={Users} colorClass="bg-blue-500" />
                            <PercentageCard label="Cancelación" value={performance?.kpis?.cancellation_rate} icon={XCircle} colorClass="bg-slate-500" />
                            <PercentageCard label="No Show" value={performance?.kpis?.no_show_rate} icon={XCircle} colorClass="bg-rose-500" />
                            <PercentageCard label="Reagendamiento" value={performance?.kpis?.rescheduling_rate} icon={RotateCcw} colorClass="bg-amber-500" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CloserPerformanceReport;
