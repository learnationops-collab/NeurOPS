import React, { useMemo } from 'react';
import {
    Loader2, BarChart3, DollarSign, Phone, Target,
    CalendarDays, Layers, TrendingUp, Users,
    CheckCircle, XCircle, PhoneOff, RefreshCw, Table, List,
    PenTool, Info, HelpCircle, Activity, PhoneCall
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import FunnelChart from '../../components/charts/FunnelChart';

const CloserPerformanceTab = ({ stats, loading }) => {

    const fmt = (n) => {
        if (n === undefined || n === null || isNaN(n)) return 0;
        return typeof n === 'number' && !Number.isInteger(n) ? n.toFixed(1) : n;
    };

    const fmtCash = (n) => {
        if (!n) return '$0';
        return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    const calcDiv = (num, den, isPercentage = false) => {
        if (!den || den === 0) return 0;
        const val = num / den;
        return isPercentage ? val * 100 : val;
    };

    const fmtNum = (n, isPct = false, isCurrency = false) => {
        if (n === undefined || n === null || isNaN(n)) return isPct ? '0.00%' : '0.00';
        if (isPct) {
            return `${n.toFixed(2)}%`;
        } else if (isCurrency) {
            return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        return n.toFixed(2);
    };

    const StatCard = ({ title, value, icon: Icon, colorClass, subtitle, tooltip }) => (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative group">
            {/* Contenedor del brillo de fondo con overflow-hidden para no salirse de los bordes redondeados */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div className={`absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 group-hover:opacity-30 transition-opacity ${colorClass.replace('text-', 'bg-')}`} />
            </div>
            <div className="flex items-start justify-between relative z-10">
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
                        {tooltip && (
                            <div className="relative group/tooltip flex items-center">
                                <HelpCircle size={10} className="text-slate-600 cursor-help hover:text-slate-300 transition-colors" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-[9999] shadow-xl border border-slate-700/50">
                                    {tooltip}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                </div>
                            </div>
                        )}
                    </div>
                    <h3 className="text-3xl font-black text-white italic tracking-tighter">{value}</h3>
                    {subtitle && <p className="text-[9px] text-slate-600 font-bold uppercase mt-1">{subtitle}</p>}
                </div>
                <div className={`p-3 rounded-2xl bg-slate-800 border border-slate-700/50 ${colorClass}`}>
                    <Icon size={18} />
                </div>
            </div>
        </div>
    );

    const ProgressRow = ({ label, percentage, colorClass, absolute, tooltip }) => (
        <div className="space-y-2 relative">
            <div className="flex justify-between items-end">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                    {tooltip && (
                        <div className="relative group/tooltip flex items-center">
                            <Info size={10} className="text-slate-500 cursor-help hover:text-white transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 border border-slate-700 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-[9999] shadow-xl">
                                {tooltip}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                            </div>
                        </div>
                    )}
                    {absolute !== undefined && <span className="text-[10px] font-bold text-slate-600 ml-0.5">({absolute})</span>}
                </div>
                <span className={`text-xs font-black ${colorClass}`}>{(percentage || 0).toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/30">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ${colorClass.replace('text-', 'bg-')}`}
                    style={{ width: `${Math.min(percentage || 0, 100)}%` }}
                />
            </div>
        </div>
    );

    const SimplePieChart = ({ data, colors }) => (
        <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={65}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} className="stroke-slate-900 stroke-2" />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '1rem', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                        itemStyle={{ color: '#e2e8f0' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', color: '#94a3b8' }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );

    const ChartTable = ({ data, colors }) => (
        <div className="w-full mt-2 bg-slate-950/50 rounded-xl overflow-hidden border border-slate-800/50">
            <table className="w-full text-left text-[10px] text-slate-300">
                <thead className="bg-slate-800/50 text-slate-400 uppercase tracking-widest">
                    <tr>
                        <th className="px-3 py-2 font-black">Métrica</th>
                        <th className="px-3 py-2 text-right font-black">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                    {data.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                            <td className="px-3 py-1.5 flex items-center gap-2 font-bold">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                                {item.name}
                            </td>
                            <td className="px-3 py-1.5 text-right font-black text-white tabular-nums">{item.value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const funnelData = useMemo(() => {
        if (!stats) return [];
        return [
            { name: 'Slots', value: stats.general.slots, fill: '#8b5cf6' },
            { name: 'Agendas', value: stats.agendas.totals.scheduled, fill: '#10b981' },
            { name: 'Asistencias', value: stats.agendas.totals.attended, fill: '#0ea5e9' },
            { name: 'Ofertas', value: stats.general.offers_made, fill: '#d946ef' },
            { name: 'Ventas', value: stats.sales.totals.count, fill: '#f59e0b' }
        ];
    }, [stats]);

    if (loading || !stats) {
        return (
            <div className="flex flex-col items-center justify-center py-40 space-y-4">
                <Loader2 className="animate-spin text-violet-500" size={48} />
                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Sincronizando datos...</p>
            </div>
        );
    }

    // Chart Data Configs
    const pifCount = stats.sales.pif?.count ?? stats.sales.totals?.pif_count ?? 0;
    const splitCount = stats.sales.split?.count ?? stats.sales.totals?.split_count ?? 0;
    const depositCount = stats.sales.deposit?.count ?? stats.sales.totals?.deposit_count ?? stats.sales.totals?.seña_count ?? 0;
    
    const pifCash = stats.sales.pif?.cash ?? stats.sales.totals?.pif_cash_collected ?? stats.sales.totals?.pif_cash ?? 0;
    const splitCash = stats.sales.split?.cash ?? stats.sales.totals?.split_cash_collected ?? stats.sales.totals?.split_cash ?? 0;
    const depositCash = stats.sales.deposit?.cash ?? stats.sales.totals?.deposit_cash_collected ?? stats.sales.totals?.deposit_cash ?? stats.sales.totals?.seña_cash ?? 0;

    const realSalesCount = pifCount + splitCount;
    const realSalesCash = pifCash + splitCash;

    const ticketPromedioReal = realSalesCount > 0 ? (realSalesCash / realSalesCount) : 0;

    const salesData = [
        { name: 'PIF', value: pifCount },
        { name: 'Split Pay', value: splitCount },
        { name: 'Promesas (Señas)', value: depositCount }
    ].filter(d => d.value > 0);
    if (salesData.length === 0) salesData.push({ name: 'Sin Ventas', value: 1 });
    const salesColors = salesData[0].name === 'Sin Ventas' ? ['#334155'] : ['#10b981', '#3b82f6', '#f59e0b'];

    const totalAttended = stats.agendas.totals.attended;
    const totalNoShow = stats.agendas.totals.no_show;
    const totalCanceled = stats.agendas.totals.canceled;

    const attendanceData = [
        { name: 'Asistencias', value: totalAttended },
        { name: 'No Show', value: totalNoShow },
        { name: 'Cancelado', value: totalCanceled },
    ].filter(d => d.value > 0);
    if (attendanceData.length === 0) attendanceData.push({ name: 'Sin Agendas', value: 1 });
    const attendanceColors = attendanceData[0].name === 'Sin Agendas' ? ['#334155'] : ['#8b5cf6', '#f59e0b', '#ef4444'];

    const fuHotReplied = stats.follow_ups?.hot_replied || 0;
    const fuHotSent = stats.follow_ups?.hot_sent || 0;
    const fuHotNoReply = Math.max(0, fuHotSent - fuHotReplied);
    const fuHotData = [
        { name: 'Respondido', value: fuHotReplied },
        { name: 'Sin Respuesta', value: fuHotNoReply },
    ].filter(d => d.value > 0);
    if (fuHotData.length === 0) fuHotData.push({ name: 'Sin Datos', value: 1 });
    const fuHotColors = fuHotData[0].name === 'Sin Datos' ? ['#334155'] : ['#f43f5e', '#881337'];

    const fuColdReplied = stats.follow_ups?.cold_replied || 0;
    const fuColdSent = stats.follow_ups?.cold_sent || 0;
    const fuColdNoReply = Math.max(0, fuColdSent - fuColdReplied);
    const fuColdData = [
        { name: 'Respondido', value: fuColdReplied },
        { name: 'Sin Respuesta', value: fuColdNoReply },
    ].filter(d => d.value > 0);
    if (fuColdData.length === 0) fuColdData.push({ name: 'Sin Datos', value: 1 });
    const fuColdColors = fuColdData[0].name === 'Sin Datos' ? ['#334155'] : ['#0ea5e9', '#0c4a6e'];

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            {/* 1. TOP ROW: GLOBAL KEY METRICS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Ingreso Total Cash"
                    value={fmtCash(realSalesCash)}
                    icon={DollarSign}
                    colorClass="text-emerald-500"
                    subtitle={`Total Promesa: ${fmtCash(depositCash)}`}
                    tooltip="Ingreso en efectivo generado por ventas reales (PIF y Split). Excluye Promesas/Señas."
                />
                <StatCard
                    title="Cierres Reales"
                    value={fmt(realSalesCount)}
                    icon={Target}
                    colorClass="text-amber-500"
                    subtitle={`Tasa Cierre Real: ${fmtNum(calcDiv(realSalesCount, stats.agendas.totals.attended, true), true)}`}
                    tooltip="Total de ventas completadas o con cuota iniciada (PIF + Split). No incluye señas."
                />
                <StatCard
                    title="Ticket Promedio"
                    value={fmtNum(ticketPromedioReal, false, true)}
                    icon={Activity}
                    colorClass="text-sky-500"
                    tooltip="Promedio de ingresos generados solo por ventas reales (PIF + Split)."
                />
                <StatCard
                    title="Promesas de Venta"
                    value={fmt(depositCount)}
                    icon={DollarSign}
                    colorClass="text-fuchsia-500"
                    subtitle={`Close Rate Promesa: ${fmtNum(calcDiv(depositCount, stats.agendas.totals.attended, true), true)}`}
                    tooltip="Total de señas o reservas (Promesas de venta) realizadas en el periodo."
                />
            </div>

            {/* 2. GRÁFICO DE EMBUDO Y SECCIÓN DE CONVERSIONES */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* COL 1: CANTIDADES */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 flex flex-col">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                            <List size={20} />
                        </div>
                        <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Cantidades</h3>
                    </div>

                    <div className="space-y-3 flex-1">
                        <div className="flex justify-between items-center p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                            <span className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Slots</span>
                            <span className="text-xl font-black text-white italic tabular-nums">{fmt(stats.general.slots)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Agendas</span>
                            <span className="text-xl font-black text-white italic tabular-nums">{fmt(stats.agendas.totals.scheduled)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                            <span className="text-[10px] font-black text-sky-500 uppercase tracking-widest">Asistencias</span>
                            <span className="text-xl font-black text-white italic tabular-nums">{fmt(stats.agendas.totals.attended)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                            <span className="text-[10px] font-black text-fuchsia-500 uppercase tracking-widest">Ofertas</span>
                            <span className="text-xl font-black text-white italic tabular-nums">{fmt(stats.general.offers_made)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Cierres Reales</span>
                            <span className="text-xl font-black text-white italic tabular-nums">{fmt(realSalesCount)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                            <span className="text-[10px] font-black text-fuchsia-500 uppercase tracking-widest">Promesas (Señas)</span>
                            <span className="text-xl font-black text-white italic tabular-nums">{fmt(depositCount)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Seg. Hot</span>
                            <span className="text-xl font-black text-white italic tabular-nums">{fmt(stats.follow_ups?.hot_sent)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-sky-500/5 rounded-2xl border border-sky-500/10">
                            <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Seg. Cold</span>
                            <span className="text-xl font-black text-white italic tabular-nums">{fmt(stats.follow_ups?.cold_sent)}</span>
                        </div>
                    </div>
                </div>

                {/* COL 2: CONVERSIONES */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 flex flex-col">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                            <TrendingUp size={20} />
                        </div>
                        <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Conversiones</h3>
                    </div>

                    <div className="space-y-4 flex-1 flex flex-col justify-center">
                        <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col justify-center space-y-2">
                            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Agendamiento</p>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400">Slots → Agendas</span>
                                <span className="text-lg font-black text-white tabular-nums">
                                    {stats.general.slots ? ((stats.agendas.totals.scheduled / stats.general.slots) * 100).toFixed(1) : 0}%
                                </span>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col justify-center space-y-2">
                            <p className="text-[9px] font-black text-sky-500 uppercase tracking-widest">Show Rate</p>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400">Agendas → Asistencias</span>
                                <span className="text-lg font-black text-white tabular-nums">
                                    {stats.agendas.totals.scheduled ? ((stats.agendas.totals.attended / stats.agendas.totals.scheduled) * 100).toFixed(1) : 0}%
                                </span>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col justify-center space-y-2">
                            <p className="text-[9px] font-black text-fuchsia-500 uppercase tracking-widest">Pitch Rate</p>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400">Asistencias → Ofertas</span>
                                <span className="text-lg font-black text-white tabular-nums">
                                    {stats.agendas.totals.attended ? ((stats.general.offers_made / stats.agendas.totals.attended) * 100).toFixed(1) : 0}%
                                </span>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col justify-center space-y-2">
                            <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Close Rate Real</p>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400">Ofertas → Cierres Reales</span>
                                <span className="text-lg font-black text-white tabular-nums">
                                    {stats.general.offers_made ? ((realSalesCount / stats.general.offers_made) * 100).toFixed(1) : 0}%
                                </span>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col justify-center space-y-2">
                            <p className="text-[9px] font-black text-fuchsia-500 uppercase tracking-widest">Close Rate Promesa</p>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400">Ofertas → Promesas</span>
                                <span className="text-lg font-black text-white tabular-nums">
                                    {stats.general.offers_made ? ((depositCount / stats.general.offers_made) * 100).toFixed(1) : 0}%
                                </span>
                            </div>
                        </div>

                        <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 flex flex-col justify-center space-y-2 relative group/stat overflow-visible">
                            <div className="flex items-center gap-1.5 relative group/tooltip">
                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Global Win Rate</p>
                                <Info size={10} className="text-indigo-400/50 cursor-help" />
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-800 border border-slate-700 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-[9999] shadow-xl">
                                    Tasa de cierre global (Ventas / Asistencias totales). Indica el porcentaje de personas con las que hablaste que terminaron comprando.
                                    <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-800"></div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-[10px] font-bold text-indigo-300">Asistencias → Cierres Reales</span>
                                <span className="text-lg font-black text-indigo-400 tabular-nums">
                                    {stats.agendas.totals.attended ? ((realSalesCount / stats.agendas.totals.attended) * 100).toFixed(1) : 0}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-indigo-300">Asistencias → Promesas</span>
                                <span className="text-lg font-black text-indigo-400 tabular-nums">
                                    {stats.agendas.totals.attended ? ((depositCount / stats.agendas.totals.attended) * 100).toFixed(1) : 0}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COL 3: EMBUDO GRÁFICO */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col items-center">
                    <div className="w-full flex items-center gap-3 mb-8">
                        <div className="p-3 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-500">
                            <TrendingUp size={20} />
                        </div>
                        <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Visualización</h3>
                    </div>
                    <div className="w-full h-[400px]">
                        <FunnelChart data={funnelData} />
                    </div>
                </div>
            </div>

            {/* 3. LLAMADAS Y CONVERSIONES (Tarjetas + Progreso) */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-500">
                        <Target size={20} />
                    </div>
                    <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Llamadas y Conversiones</h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Asistencias</p>
                            <h4 className="text-2xl font-black text-white italic tracking-tighter mt-1">{fmt(stats.agendas.totals.attended)}</h4>
                        </div>
                        <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-500">
                            <CheckCircle size={16} />
                        </div>
                    </div>
                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Presentaciones (Ofertas)</p>
                            <h4 className="text-2xl font-black text-white italic tracking-tighter mt-1">{fmt(stats.general.offers_made)}</h4>
                        </div>
                        <div className="p-2.5 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-500">
                            <Layers size={16} />
                        </div>
                    </div>
                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Decisores</p>
                            <h4 className="text-2xl font-black text-white italic tracking-tighter mt-1">{fmt(stats.general.decision_makers)}</h4>
                        </div>
                        <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                            <Users size={16} />
                        </div>
                    </div>
                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Reagendados</p>
                            <h4 className="text-2xl font-black text-white italic tracking-tighter mt-1">{fmt(stats.general.rescheduled_calls)}</h4>
                        </div>
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                            <RefreshCw size={16} />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-800">
                    <ProgressRow 
                        label="Pitch Rate (Pres. / Asist.)" 
                        percentage={stats.percentages.pitch_rate} 
                        colorClass="text-fuchsia-500" 
                        absolute={`${fmt(stats.general.offers_made)} / ${fmt(stats.agendas.totals.attended)}`} 
                    />
                    <ProgressRow 
                        label="Decision Maker Rate" 
                        percentage={stats.percentages.decision_maker_rate} 
                        colorClass="text-indigo-500" 
                        absolute={`${fmt(stats.general.decision_makers)} / ${fmt(stats.agendas.totals.attended)}`} 
                    />
                    <ProgressRow 
                        label="Reschedule Rate" 
                        percentage={stats.percentages.rescheduled_rate} 
                        colorClass="text-amber-500" 
                        absolute={`${fmt(stats.general.rescheduled_calls)} / ${fmt(stats.agendas.totals.attended)}`} 
                    />
                </div>
            </div>

            {/* 4. SECCIÓN DE DESGLOSE (AGENDAS Y VENTAS TABLES) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* AGENDAS BREAKDOWN TABLE */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                                <Phone size={20} />
                            </div>
                            <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Agenda Breakdown</h3>
                        </div>
                        <div className="text-[10px] font-black text-slate-500 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                            {stats.metadata.days_analyzed} DÍAS
                        </div>
                    </div>

                    <div className="bg-slate-800/30 rounded-2xl overflow-hidden border border-slate-800/40">
                        <div className="grid grid-cols-4 gap-0">
                            <div className="p-3 bg-slate-700/50" />
                            <div className="p-3 text-center bg-emerald-900/30">
                                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">1ra</p>
                            </div>
                            <div className="p-3 text-center bg-sky-900/30">
                                <p className="text-[9px] font-black text-sky-400 uppercase tracking-wider">2da</p>
                            </div>
                            <div className="p-3 text-center bg-violet-900/30">
                                <p className="text-[9px] font-black text-violet-400 uppercase tracking-wider">Total</p>
                            </div>
                        </div>

                        {[
                            { label: 'Agendas', key: 'scheduled', icon: CalendarDays },
                            { label: 'Asistencias', key: 'attended', icon: CheckCircle },
                            { label: 'No Shows', key: 'no_show', icon: PhoneOff },
                            { label: 'Reprog.', key: 'rescheduled', icon: RefreshCw },
                            { label: 'Cancelac.', key: 'canceled', icon: XCircle },
                        ].map((row, i) => (
                            <div key={row.key} className={`grid grid-cols-4 gap-0 ${i % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                                <div className="p-3 flex items-center gap-2 border-r border-slate-800/50">
                                    <row.icon size={12} className="text-slate-500" />
                                    <p className="text-[10px] font-bold text-slate-300">{row.label}</p>
                                </div>
                                <div className="p-3 text-center border-r border-slate-800/50">
                                    <p className="text-sm font-black text-emerald-400 tabular-nums">{fmt(stats.agendas.first_call[row.key])}</p>
                                </div>
                                <div className="p-3 text-center border-r border-slate-800/50">
                                    <p className="text-sm font-black text-sky-400 tabular-nums">{fmt(stats.agendas.second_call[row.key])}</p>
                                </div>
                                <div className="p-3 text-center">
                                    <p className="text-sm font-black text-white tabular-nums">{fmt(stats.agendas.totals[row.key])}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-800">
                        <ProgressRow label="Show Rate (1ra/2da)" percentage={stats.percentages.show_rate} colorClass="text-emerald-500" absolute={`${fmt(stats.agendas.totals.attended)} / ${fmt(stats.agendas.totals.scheduled)}`} tooltip="Porcentaje de asistencias (Total Asistencias / Total Agendados)." />
                        <ProgressRow label="No Show Rate" percentage={stats.percentages.no_show_rate} colorClass="text-rose-500" absolute={fmt(stats.agendas.totals.no_show)} tooltip="Porcentaje de prospectos agendados que no se presentaron." />
                        <ProgressRow label="Cancel Rate" percentage={stats.percentages.cancel_rate} colorClass="text-amber-500" absolute={fmt(stats.agendas.totals.canceled)} tooltip="Porcentaje de llamadas que fueron canceladas." />
                    </div>
                </div>

                {/* VENTAS BREAKDOWN TABLE */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                            <DollarSign size={20} />
                        </div>
                        <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Ventas Breakdown</h3>
                    </div>

                    <div className="bg-slate-800/30 rounded-2xl overflow-hidden border border-slate-800/40">
                        <div className="grid grid-cols-5 gap-0">
                            <div className="p-3 bg-slate-700/50" />
                            <div className="p-3 text-center bg-amber-900/20">
                                <p className="text-[8px] font-black text-amber-400 uppercase tracking-wider">Cants</p>
                            </div>
                            <div className="p-3 text-center bg-emerald-900/20">
                                <p className="text-[8px] font-black text-emerald-400 uppercase tracking-wider">Cash Collected</p>
                            </div>
                            <div className="p-3 text-center bg-blue-900/20">
                                <p className="text-[8px] font-black text-blue-400 uppercase tracking-wider">Recup. Cants</p>
                            </div>
                            <div className="p-3 text-center bg-indigo-900/20">
                                <p className="text-[8px] font-black text-indigo-400 uppercase tracking-wider">Recup. Cash</p>
                            </div>
                        </div>

                        {[
                            { label: 'PIF (Completo)', keyCount: 'pif_count', keyCash: 'pif_cash', keyRecCount: 'rec_pif_count', keyRecCash: 'rec_pif_cash', valCount: pifCount, valCash: pifCash },
                            { label: 'Split (Cuotas)', keyCount: 'split_count', keyCash: 'split_cash', keyRecCount: 'rec_split_count', keyRecCash: 'rec_split_cash', valCount: splitCount, valCash: splitCash },
                            { label: 'Promesas (Señas)', keyCount: 'deposit_count', keyCash: 'deposit_cash', keyRecCount: 'rec_seña_count', keyRecCash: 'rec_seña_cash', valCount: depositCount, valCash: depositCash },
                        ].map((row, i) => (
                            <div key={row.label} className={`grid grid-cols-5 gap-0 ${i % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                                <div className="p-3 flex items-center gap-2 border-r border-slate-800/50">
                                    <p className="text-[9px] font-bold text-slate-300">{row.label}</p>
                                </div>
                                <div className="p-3 text-center border-r border-slate-800/50">
                                    <p className="text-sm font-black text-amber-400 tabular-nums">{fmt(row.valCount)}</p>
                                </div>
                                <div className="p-3 text-center border-r border-slate-800/50">
                                    <p className="text-[11px] font-black text-emerald-400 tabular-nums">{fmtCash(row.valCash)}</p>
                                </div>
                                <div className="p-3 text-center border-r border-slate-800/50">
                                    <p className="text-sm font-black text-blue-400 tabular-nums">{fmt(stats.sales.totals[row.keyRecCount] || 0)}</p>
                                </div>
                                <div className="p-3 text-center">
                                    <p className="text-[11px] font-black text-indigo-400 tabular-nums">{fmtCash(stats.sales.totals[row.keyRecCash] || 0)}</p>
                                </div>
                            </div>
                        ))}

                        <div className="grid grid-cols-5 gap-0 bg-slate-900/50 border-t border-slate-800 font-bold">
                            <div className="p-3 border-r border-slate-800/50">
                                <p className="text-[9px] font-black text-white uppercase tracking-widest">Totales</p>
                            </div>
                            <div className="p-3 text-center border-r border-slate-800/50">
                                <p className="text-sm font-black text-amber-400 tabular-nums">{fmt(realSalesCount + depositCount)}</p>
                            </div>
                            <div className="p-3 text-center border-r border-slate-800/50">
                                <p className="text-[11px] font-black text-emerald-400 tabular-nums">{fmtCash(realSalesCash + depositCash)}</p>
                            </div>
                            <div className="p-3 text-center border-r border-slate-800/50">
                                <p className="text-sm font-black text-blue-400 tabular-nums">{fmt(stats.sales.totals.recuperado_count || 0)}</p>
                            </div>
                            <div className="p-3 text-center">
                                <p className="text-[11px] font-black text-indigo-400 tabular-nums">{fmtCash(stats.sales.totals.recuperado_cash || 0)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                        <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex flex-col justify-center space-y-1">
                            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest text-center">Ticket Promedio PIF</p>
                            <p className="text-lg font-black text-white text-center tabular-nums">
                                {pifCount ? fmtCash(pifCash / pifCount) : '$0'}
                            </p>
                        </div>
                        <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 flex flex-col justify-center space-y-1">
                            <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest text-center">Ticket Promedio Split</p>
                            <p className="text-lg font-black text-white text-center tabular-nums">
                                {splitCount ? fmtCash(splitCash / splitCount) : '$0'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. SECCIÓN DE RE-ENGAGEMENT Y FOLLOW-UPS */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
                        <RefreshCw size={20} />
                    </div>
                    <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Re-engagement Breakdown</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Hot Flow */}
                    <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[50px] pointer-events-none" />
                        <div className="flex items-center gap-2 mb-6 border-b border-slate-700/50 pb-4">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            <h4 className="text-sm font-black text-rose-400 uppercase tracking-widest">Flujo Caliente</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enviados</span>
                                <span className="text-lg font-black text-white tabular-nums">{fmt(stats.follow_ups?.hot_sent)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Respondidos</span>
                                <span className="text-lg font-black text-white tabular-nums">{fmt(stats.follow_ups?.hot_replied)}</span>
                            </div>
                            <ProgressRow
                                label="Response Rate (Hot)"
                                percentage={stats.follow_ups?.hot_sent ? ((stats.follow_ups.hot_replied / stats.follow_ups.hot_sent) * 100) : 0}
                                colorClass="text-rose-500"
                                absolute={fmt(stats.follow_ups?.hot_replied)}
                                tooltip="Porcentaje de leads del flujo caliente que respondieron al mensaje."
                            />
                        </div>
                    </div>

                    {/* Cold Flow */}
                    <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 blur-[50px] pointer-events-none" />
                        <div className="flex items-center gap-2 mb-6 border-b border-slate-700/50 pb-4">
                            <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                            <h4 className="text-sm font-black text-sky-400 uppercase tracking-widest">Flujo Frío</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enviados</span>
                                <span className="text-lg font-black text-white tabular-nums">{fmt(stats.follow_ups?.cold_sent)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Respondidos</span>
                                <span className="text-lg font-black text-white tabular-nums">{fmt(stats.follow_ups?.cold_replied)}</span>
                            </div>
                            <ProgressRow
                                label="Response Rate (Cold)"
                                percentage={stats.follow_ups?.cold_sent ? ((stats.follow_ups.cold_replied / stats.follow_ups.cold_sent) * 100) : 0}
                                colorClass="text-sky-500"
                                absolute={fmt(stats.follow_ups?.cold_replied)}
                                tooltip="Porcentaje de leads del flujo frío que respondieron al mensaje."
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                    <div className="p-5 bg-blue-600/10 rounded-2xl border border-blue-600/20 text-center space-y-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Total Re-engagement Enviados</p>
                        <p className="text-2xl font-black text-white italic">{fmt(stats.follow_ups?.sent)}</p>
                    </div>
                    <div className="p-5 bg-blue-600/10 rounded-2xl border border-blue-600/20 text-center space-y-1">
                        <p className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">Total Re-engagement Respondidos</p>
                        <p className="text-2xl font-black text-white italic">{fmt(stats.follow_ups?.replied)}</p>
                    </div>
                </div>
            </div>

            {/* 6. BOTTOM ROW: DISTRIBUTION CHARTS (FUSIONADO DESDE % RENDIMIENTO) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Sales Type Distribution */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 w-full text-center">Tipo de Cierre</h4>
                    <SimplePieChart data={salesData} colors={salesColors} />
                    <ChartTable data={salesData} colors={salesColors} />
                </div>

                {/* Attendance Distribution */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 w-full text-center">Estado de Agendas</h4>
                    <SimplePieChart data={attendanceData} colors={attendanceColors} />
                    <ChartTable data={attendanceData} colors={attendanceColors} />
                </div>

                {/* Hot Follow Ups Distribution */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center relative group">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 w-full text-center">Re-engagement (Hot)</h4>
                    <SimplePieChart data={fuHotData} colors={fuHotColors} />
                    <ChartTable data={fuHotData} colors={fuHotColors} />
                    <div className="absolute top-4 left-4 right-4 md:right-auto md:w-56 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        <div className="bg-slate-800 p-3 border border-slate-700 rounded-xl flex items-start gap-2 shadow-2xl">
                            <Info size={14} className="text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-[9px] text-slate-300">Flujo Caliente (Leads que ya respondieron en el pasado o mostraron interés de compra).</p>
                        </div>
                    </div>
                </div>

                {/* Cold Follow Ups Distribution */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center relative group">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 w-full text-center">Re-engagement (Cold)</h4>
                    <SimplePieChart data={fuColdData} colors={fuColdColors} />
                    <ChartTable data={fuColdData} colors={fuColdColors} />
                    <div className="absolute top-4 left-4 right-4 md:right-auto md:w-56 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        <div className="bg-slate-800 p-3 border border-slate-700 rounded-xl flex items-start gap-2 shadow-2xl">
                            <Info size={14} className="text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-[9px] text-slate-300">Flujo Frío (Leads antiguos abandonados o prospección nueva).</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CloserPerformanceTab;
