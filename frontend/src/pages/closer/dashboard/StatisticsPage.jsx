import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../services/api';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import {
    Activity, CheckCircle2, XCircle, RefreshCw, Loader2, BarChart3,
    TrendingUp, DollarSign, List, Table, Users, Phone, CalendarDays,
    ArrowRight, Info
} from 'lucide-react';
import DateRangeFilter from '../../../components/shared/DateRangeFilter';
import FunnelChart from '../../../components/charts/FunnelChart';
import CloserAdvancedStatsView from '../../public/CloserAdvancedStatsView';
import CloserReportsTable from '../../public/CloserReportsTable';

const StatisticsPage = () => {
    const [activeTab, setActiveTab] = useState('general');
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ type: 'week', start: '', end: '' });
    const [aggType, setAggType] = useState('sum');

    useEffect(() => {
        fetchStats();
    }, [dateRange, aggType]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const params = { agg_type: aggType };
            
            if (dateRange.type === 'today') {
                const today = new Date().toISOString().split('T')[0];
                params.start_date = today;
                params.end_date = today;
            } else if (dateRange.type === 'week') {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 7);
                params.start_date = start.toISOString().split('T')[0];
                params.end_date = end.toISOString().split('T')[0];
            } else if (dateRange.type === 'month') {
                const end = new Date();
                const start = new Date();
                start.setMonth(end.getMonth() - 1);
                params.start_date = start.toISOString().split('T')[0];
                params.end_date = end.toISOString().split('T')[0];
            } else if (dateRange.type === 'custom') {
                if (dateRange.start) params.start_date = dateRange.start;
                if (dateRange.end) params.end_date = dateRange.end;
            }

            const res = await api.get('/closer/stats', { params });
            setStatsData(res.data);
        } catch (err) {
            console.error("Error fetching stats", err);
        } finally {
            setLoading(false);
        }
    };

    const funnelData = useMemo(() => {
        if (!statsData) return [];
        return [
            { name: 'Slots', value: statsData.general.slots, fill: '#818cf8' }, // indigo
            { name: 'Agendas', value: statsData.agendas.totals.scheduled, fill: '#10b981' }, // emerald
            { name: 'Asistencias', value: statsData.agendas.totals.attended, fill: '#0ea5e9' }, // sky
            { name: 'Ofertas', value: statsData.general.offers_made, fill: '#d946ef' }, // fuchsia
            { name: 'Ventas', value: statsData.sales.totals.count, fill: '#f59e0b' } // amber
        ];
    }, [statsData]);

    const fmtCash = (n) => {
        if (!n) return '$0';
        return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    const ProgressRow = ({ label, percentage, colorClass, absolute }) => (
        <div className="space-y-2">
            <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
                    {absolute !== undefined && <span className="text-[10px] font-bold text-muted-foreground/50">({absolute})</span>}
                </div>
                <span className={`text-xs font-black ${colorClass}`}>{percentage}%</span>
            </div>
            <div className="h-2 bg-surface border border-base rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ${colorClass.replace('text-', 'bg-')}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>
        </div>
    );

    const TabButton = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === id
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-muted-foreground hover:bg-surface'
                }`}
        >
            <Icon size={14} />
            {label}
        </button>
    );

    if (loading && !statsData) return (
        <div className="flex items-center justify-center p-20 min-h-screen">
            <Loader2 className="animate-spin text-primary" size={48} />
        </div>
    );

    return (
        <div className="p-8 max-w-[1800px] mx-auto space-y-12 animate-in fade-in duration-700">
            {/* Header & Main Filters */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-base">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-primary/10 rounded-3xl text-primary shadow-inner">
                        <Activity size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter italic uppercase">
                            Tus <span className="text-primary">Estadísticas</span>
                        </h1>
                        <p className="text-[10px] font-bold text-muted-foreground tracking-[0.3em] uppercase mt-1">Análisis de rendimiento y conversiones detalladas</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-surface/50 border border-base rounded-[2.5rem] p-2 pr-6">
                    <DateRangeFilter
                        value={dateRange}
                        onChange={setDateRange}
                        label="Rango de Fechas"
                    />
                    
                    <div className="h-8 w-px bg-base mx-2 hidden sm:block" />

                    <div className="flex bg-background p-1 rounded-2xl border border-base shadow-sm">
                        <button
                            onClick={() => setAggType('sum')}
                            className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${aggType === 'sum' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Total Suma
                        </button>
                        <button
                            onClick={() => setAggType('avg')}
                            className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${aggType === 'avg' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Promedio Diario
                        </button>
                    </div>
                </div>
            </header>

            {/* TABS SELECTION */}
            <div className="flex flex-wrap items-center gap-4 bg-surface/40 p-2 rounded-[2.5rem] border border-base w-fit">
                <TabButton id="general" label="Vista General" icon={BarChart3} />
                <TabButton id="advanced" label="% Rendimiento" icon={TrendingUp} />
                <TabButton id="history" label="Tu Historial" icon={List} />
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'general' && (
                    <motion.div
                        key="general"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-12"
                    >
                        {/* OPERATIONAL SECTION (Reuse existing elements) */}
                        <section className="space-y-6">
                            <h3 className="text-xs font-black tracking-widest text-muted-foreground border-l-4 border-primary pl-4 uppercase">Estado Operativo (En Tiempo Real)</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                                <Card variant="main" className="p-8 border-rose-500/20 bg-rose-500/5 relative overflow-hidden group">
                                    <div className="relative z-10">
                                        <p className="text-[10px] font-black text-rose-500 tracking-[0.2em]">Pendientes</p>
                                        <h2 className="text-5xl font-black text-rose-500 tracking-tighter mt-2">{statsData?.operational?.pending || 0}</h2>
                                        <p className="text-[9px] font-bold text-rose-500/60 mt-2">Agendas sin resultado</p>
                                    </div>
                                    <Activity size={100} className="absolute -right-8 -bottom-8 text-rose-500 opacity-[0.05] group-hover:scale-110 transition-transform duration-700" />
                                </Card>

                                {['Terminada', 'No Show', 'Cancelada', 'Reprogramada'].map((key) => {
                                    const val = statsData?.operational?.outcomes?.[key] || 0;
                                    const config = {
                                        'Terminada': { color: 'text-emerald-500', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', icon: CheckCircle2 },
                                        'No Show': { color: 'text-rose-500', bg: 'bg-rose-500/5', border: 'border-rose-500/20', icon: XCircle },
                                        'Cancelada': { color: 'text-muted-foreground', bg: 'bg-background/40', border: 'border-base', icon: XCircle },
                                        'Reprogramada': { color: 'text-primary', bg: 'bg-primary/5', border: 'border-primary/20', icon: RefreshCw },
                                    }[key] || { color: 'text-muted-foreground', bg: 'bg-background/40', border: 'border-base', icon: Activity };

                                    return (
                                        <Card key={key} variant="surface" className={`p-8 ${config.border} ${config.bg} relative overflow-hidden group border-2`}>
                                            <div className="relative z-10">
                                                <p className={`text-[10px] font-black ${config.color} tracking-[0.2em]`}>{key}</p>
                                                <h2 className={`text-5xl font-black ${config.color} tracking-tighter mt-2`}>{val}</h2>
                                            </div>
                                            <config.icon size={100} className={`absolute -right-8 -bottom-8 ${config.color} opacity-[0.05] group-hover:scale-110 transition-transform duration-700`} />
                                        </Card>
                                    );
                                })}
                            </div>
                        </section>

                        {/* NEW COMPREHENSIVE ELEMENTS SECTION */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            
                            {/* COL 1: FUNNEL CHART */}
                            <div className="lg:col-span-2 bg-background border border-base rounded-[3rem] p-10 shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] pointer-events-none" />
                                <div className="flex items-center justify-between mb-10">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                                            <TrendingUp size={20} />
                                        </div>
                                        <h3 className="text-2xl font-black text-foreground italic uppercase tracking-tighter">Embudo de Ventas</h3>
                                    </div>
                                    <div className="px-4 py-2 bg-surface border border-base rounded-xl text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                        Data de Reportes Diarios
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-center">
                                    <div className="md:col-span-3 h-[450px]">
                                        <FunnelChart data={funnelData} />
                                    </div>
                                    <div className="md:col-span-2 space-y-4">
                                        {funnelData.map((stage, i) => (
                                            <div key={stage.name} className="p-4 bg-surface/30 border border-base rounded-2xl hover:border-primary/30 transition-all group/item">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{stage.name}</span>
                                                    <span className="text-xl font-black italic tabular-nums">{stage.value}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-base rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full rounded-full transition-all duration-1000" 
                                                        style={{ backgroundColor: stage.fill, width: `${statsData.general.slots ? (stage.value / statsData.general.slots * 100) : 0}%` }}
                                                    />
                                                </div>
                                                {i > 0 && statsData.agendas.totals.scheduled > 0 && (
                                                    <p className="text-[9px] font-bold text-muted-foreground mt-2 flex items-center gap-1">
                                                        <ArrowRight size={10} /> 
                                                        Conv: {((stage.value / funnelData[i-1].value) * 100).toFixed(1)}% desde etapa anterior
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* COL 2: SALES BREAKDOWN */}
                            <div className="bg-background border border-base rounded-[3rem] p-10 shadow-xl space-y-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                                        <DollarSign size={20} />
                                    </div>
                                    <h3 className="text-2xl font-black text-foreground italic uppercase tracking-tighter">Ingresos</h3>
                                </div>

                                <div className="p-8 bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] text-center space-y-2 group hover:bg-emerald-500/15 transition-all">
                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Total Cash Collected</p>
                                    <h2 className="text-5xl font-black text-emerald-400 tracking-tighter tabular-nums drop-shadow-sm">
                                        {fmtCash(statsData.sales.totals.cash)}
                                    </h2>
                                    <p className="text-[9px] font-bold text-emerald-500/60 uppercase">Monto Bruto en Reportes</p>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        { label: 'PIF (Pay In Full)', key: 'pif', color: 'text-emerald-500' },
                                        { label: 'Split Pay', key: 'split', color: 'text-sky-500' },
                                        { label: 'Señas / Deposits', key: 'deposit', color: 'text-amber-500' }
                                    ].map((row) => (
                                        <div key={row.key} className="flex items-center justify-between p-5 bg-surface/50 border border-base rounded-2xl group hover:border-primary/20 transition-all">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{row.label}</p>
                                                <p className="text-lg font-black italic">{fmtCash(statsData.sales[row.key].cash)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-foreground/40 uppercase">Ventas</p>
                                                <p className={`text-xl font-black ${row.color}`}>{statsData.sales[row.key].count}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Global Win Rate</p>
                                            <Info size={10} className="text-primary/50" />
                                        </div>
                                        <p className="text-2xl font-black italic text-primary">{statsData.percentages.close_rate}%</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase italic px-3 py-1 bg-surface rounded-full">Ventas / Asistencias</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* BOTTOM GRID: AGENDAS & RE-ENGAGEMENT */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            
                            {/* AGENDA BREAKDOWN */}
                            <div className="bg-background border border-base rounded-[3rem] p-10 shadow-xl space-y-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-500">
                                        <Phone size={20} />
                                    </div>
                                    <h3 className="text-2xl font-black text-foreground italic uppercase tracking-tighter">Desglose de Agendas</h3>
                                </div>

                                <div className="bg-surface/30 rounded-3xl overflow-hidden border border-base">
                                    <div className="grid grid-cols-4 bg-background border-b border-base">
                                        <div className="p-4" />
                                        <div className="p-4 text-center bg-emerald-500/5"><p className="text-[10px] font-black text-emerald-500 uppercase">1ra</p></div>
                                        <div className="p-4 text-center bg-sky-500/5"><p className="text-[10px] font-black text-sky-500 uppercase">2da</p></div>
                                        <div className="p-4 text-center bg-primary/5"><p className="text-[10px] font-black text-primary uppercase">Total</p></div>
                                    </div>
                                    {[
                                        { label: 'Agendados', key: 'scheduled', icon: CalendarDays },
                                        { label: 'Asistidos', key: 'attended', icon: CheckCircle2 },
                                        { label: 'No Shows', key: 'no_show', icon: XCircle },
                                        { label: 'Reprogs.', key: 'rescheduled', icon: RefreshCw },
                                        { label: 'Cancelled', key: 'canceled', icon: XCircle },
                                    ].map((row, i) => (
                                        <div key={row.key} className={`grid grid-cols-4 items-center ${i % 2 === 0 ? 'bg-background/20' : 'bg-surface/10'}`}>
                                            <div className="p-4 flex items-center gap-2 border-r border-base">
                                                <row.icon size={14} className="text-muted-foreground/50" />
                                                <span className="text-[11px] font-bold text-muted-foreground">{row.label}</span>
                                            </div>
                                            <div className="p-4 text-center border-r border-base font-black text-emerald-500 tabular-nums">{statsData.agendas.first_call[row.key]}</div>
                                            <div className="p-4 text-center border-r border-base font-black text-sky-500 tabular-nums">{statsData.agendas.second_call[row.key]}</div>
                                            <div className="p-4 text-center font-black text-primary tabular-nums text-lg bg-primary/5">{statsData.agendas.totals[row.key]}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-6 bg-surface/50 border border-base rounded-3xl text-center space-y-1">
                                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">Show Rate</p>
                                        <p className="text-2xl font-black italic">{statsData.percentages.show_rate}%</p>
                                    </div>
                                    <div className="p-6 bg-surface/50 border border-base rounded-3xl text-center space-y-1">
                                        <p className="text-[9px] font-black text-rose-500 uppercase tracking-tighter">No Show</p>
                                        <p className="text-2xl font-black italic">{statsData.percentages.no_show_rate}%</p>
                                    </div>
                                    <div className="p-6 bg-surface/50 border border-base rounded-3xl text-center space-y-1">
                                        <p className="text-[9px] font-black text-amber-500 uppercase tracking-tighter">Cancelled</p>
                                        <p className="text-2xl font-black italic">{statsData.percentages.cancel_rate}%</p>
                                    </div>
                                </div>
                            </div>

                            {/* RE-ENGAGEMENT BREAKDOWN */}
                            <div className="bg-background border border-base rounded-[3rem] p-10 shadow-xl space-y-8 flex flex-col">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
                                        <RefreshCw size={20} />
                                    </div>
                                    <h3 className="text-2xl font-black text-foreground italic uppercase tracking-tighter">Re-engagement</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                                    {/* Hot */}
                                    <div className="bg-rose-500/5 p-8 rounded-[2rem] border border-rose-500/20 space-y-6 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[60px] pointer-events-none" />
                                        <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                                            Flujo Caliente
                                        </h4>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center bg-background/50 p-4 rounded-2xl border border-base">
                                                <span className="text-[10px] font-black text-muted-foreground uppercase">Enviados</span>
                                                <span className="text-2xl font-black italic tabular-nums">{statsData.follow_ups.hot_sent}</span>
                                            </div>
                                            <div className="flex justify-between items-center bg-background/50 p-4 rounded-2xl border border-base">
                                                <span className="text-[10px] font-black text-muted-foreground uppercase">Respuestas</span>
                                                <span className="text-2xl font-black italic tabular-nums text-rose-500">{statsData.follow_ups.hot_replied}</span>
                                            </div>
                                            <ProgressRow 
                                                label="Respuesta Hot" 
                                                percentage={statsData.follow_ups.hot_sent ? ((statsData.follow_ups.hot_replied / statsData.follow_ups.hot_sent) * 100).toFixed(1) : 0} 
                                                colorClass="text-rose-500" 
                                            />
                                        </div>
                                    </div>

                                    {/* Cold */}
                                    <div className="bg-sky-500/5 p-8 rounded-[2rem] border border-sky-500/20 space-y-6 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-[60px] pointer-events-none" />
                                        <h4 className="text-xs font-black text-sky-500 uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-2 h-2 bg-sky-500 rounded-full" />
                                            Flujo Frío
                                        </h4>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center bg-background/50 p-4 rounded-2xl border border-base">
                                                <span className="text-[10px] font-black text-muted-foreground uppercase">Enviados</span>
                                                <span className="text-2xl font-black italic tabular-nums">{statsData.follow_ups.cold_sent}</span>
                                            </div>
                                            <div className="flex justify-between items-center bg-background/50 p-4 rounded-2xl border border-base">
                                                <span className="text-[10px] font-black text-muted-foreground uppercase">Respuestas</span>
                                                <span className="text-2xl font-black italic tabular-nums text-sky-500">{statsData.follow_ups.cold_replied}</span>
                                            </div>
                                            <ProgressRow 
                                                label="Respuesta Cold" 
                                                percentage={statsData.follow_ups.cold_sent ? ((statsData.follow_ups.cold_replied / statsData.follow_ups.cold_sent) * 100).toFixed(1) : 0} 
                                                colorClass="text-sky-500" 
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-primary/5 p-6 rounded-[2rem] border border-primary/20 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-primary/10 rounded-2xl text-primary"><RefreshCw size={20} /></div>
                                        <div className="space-y-0.5">
                                            <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Total Social Selling</p>
                                            <p className="text-2xl font-black italic tabular-nums text-foreground">{statsData.follow_ups.sent} Seguimientos</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase italic px-4 py-1.5 bg-surface rounded-full border border-base">
                                            Tasa de Respuesta Global: {statsData.percentages.respond_rate}%
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'advanced' && (
                    <motion.div
                        key="advanced"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <CloserAdvancedStatsView stats={statsData} loading={loading} />
                    </motion.div>
                )}

                {activeTab === 'history' && (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                    >
                        {/* Note: CloserReportsTable expects a 'closers' list for internal filters, 
                            but in this private view we don't necessarily need to pass all closers.
                            Passing an empty list or the current user's name is enough since 
                            the reports tab in this dashboard is usually filtered by the logged-in user. */}
                        <CloserReportsTable closers={[]} isDashboardView={true} />
                    </motion.div>
                )}
            </AnimatePresence>

            <footer className="pt-20 pb-10 text-center border-t border-base">
                <p className="text-[9px] text-muted-foreground/40 font-black tracking-[0.5em] uppercase italic">
                    NeurOPS Closer Intelligence Core • Performance Analysis Session
                </p>
            </footer>
        </div>
    );
};

export default StatisticsPage;
