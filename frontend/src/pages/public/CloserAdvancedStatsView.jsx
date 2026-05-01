import React from 'react';
import { Loader2, Activity, Target, PhoneCall, BarChart2, TrendingUp, Users, Info, DollarSign, CalendarDays, HelpCircle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CloserAdvancedStatsView = ({ stats, loading }) => {

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
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative group/stat">
            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                <div className={`absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 group-hover/stat:opacity-30 transition-opacity ${colorClass.replace('text-', 'bg-')}`} />
            </div>
            <div className="flex items-start justify-between relative z-10 overflow-visible">
                <div className="space-y-1 relative overflow-visible">
                    <div className="flex items-center gap-1.5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
                        {tooltip && (
                            <div className="relative group/tooltip flex items-center">
                                <HelpCircle size={10} className="text-slate-600 cursor-help hover:text-slate-300 transition-colors" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-[100] shadow-xl border border-slate-700/50">
                                    {tooltip}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                </div>
                            </div>
                        )}
                    </div>
                    <h3 className="text-3xl font-black text-white italic tracking-tighter">{value}</h3>
                    {subtitle && <p className="text-[9px] text-slate-600 font-bold uppercase mt-1">{subtitle}</p>}
                </div>
                <div className={`p-3 rounded-2xl bg-slate-800 border border-slate-700/50 shrink-0 ${colorClass}`}>
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
                            <HelpCircle size={10} className="text-slate-600 cursor-help hover:text-slate-300 transition-colors" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-[100] shadow-xl border border-slate-700/50">
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
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
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
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8' }} />
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

    if (loading || !stats) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="animate-spin text-violet-500" size={48} />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Calculando rendimiento...</p>
            </div>
        );
    }

    // Chart Data Configs
    const salesData = [
        { name: 'Cierre en Llamada', value: stats.sales.totals.in_call_count },
        { name: 'Cierre Seguimiento', value: stats.sales.totals.count - stats.sales.totals.in_call_count },
    ].filter(d => d.value > 0);

    if (salesData.length === 0) salesData.push({ name: 'Sin Ventas', value: 1 });
    const salesColors = salesData[0].name === 'Sin Ventas' ? ['#334155'] : ['#10b981', '#3b82f6'];

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


    // Hot Follow Ups
    const fuHotReplied = stats.follow_ups?.hot_replied || 0;
    const fuHotSent = stats.follow_ups?.hot_sent || 0;
    const fuHotNoReply = Math.max(0, fuHotSent - fuHotReplied);

    const fuHotData = [
        { name: 'Respondido', value: fuHotReplied },
        { name: 'Sin Respuesta', value: fuHotNoReply },
    ].filter(d => d.value > 0);

    if (fuHotData.length === 0) fuHotData.push({ name: 'Sin Datos', value: 1 });
    const fuHotColors = fuHotData[0].name === 'Sin Datos' ? ['#334155'] : ['#f43f5e', '#881337'];

    // Cold Follow Ups
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
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* TOP ROW: GLOBAL STAT CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Cierres Totales"
                    value={fmtNum(stats.sales.totals.count)}
                    icon={Target}
                    colorClass="text-amber-500"
                    subtitle={`Tasa Cierre: ${fmtNum(stats.percentages.close_rate, true)}`}
                    tooltip="Suma total de todas las ventas cerradas por el Closer en el periodo seleccionado. Tasa de Cierre = (Ventas Totales / Ofertas Realizadas)."
                />
                <StatCard
                    title="Ticket Promedio"
                    value={fmtNum(calcDiv(stats.sales.totals.cash, stats.sales.totals.count), false, true)}
                    icon={Activity}
                    colorClass="text-emerald-500"
                    tooltip="Promedio de ingresos generados por cada venta cerrada. Cálculo: (Ingresos Totales / Cierres Totales)."
                />
                <StatCard
                    title="Estimado Comisión (10%)"
                    value={fmtNum(stats.sales.totals.cash * 0.10, false, true)}
                    icon={DollarSign}
                    colorClass="text-indigo-500"
                    tooltip="Cálculo estimativo de la comisión del Closer asumiendo un 10% estándar sobre el Cash Collected total del periodo."
                />
                <StatCard
                    title="Ofertas Realizadas"
                    value={fmtNum(stats.general.offers_made)}
                    icon={TrendingUp}
                    colorClass="text-fuchsia-500"
                    subtitle={`Offer to Sale: ${fmtNum(stats.percentages.offer_to_sale, true)}`}
                    tooltip="Total de veces que el Closer presentó la oferta durante una llamada."
                />
            </div>

            {/* MIDDLE ROW: AGENDAS COMPARISON */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 rounded-2xl border text-sky-500 bg-sky-500/10 border-sky-500/20">
                        <CalendarDays size={20} />
                    </div>
                    <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Rendimiento por Agenda</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Primera Llamada */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <h4 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                <PhoneCall size={16} className="text-emerald-500" />
                                Primera Llamada
                            </h4>
                            <span className="text-xs font-bold text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
                                {stats.agendas.first_call.scheduled} Totales
                            </span>
                        </div>

                        <ProgressRow
                            label="Show Rate (Asistencias)"
                            percentage={calcDiv(stats.agendas.first_call.attended, stats.agendas.first_call.scheduled, true)}
                            colorClass="text-emerald-500"
                            absolute={stats.agendas.first_call.attended}
                            tooltip="Porcentaje de leads agendados que realmente asistieron a la primera llamada."
                        />
                        <ProgressRow
                            label="No Show Rate"
                            percentage={calcDiv(stats.agendas.first_call.no_show, stats.agendas.first_call.scheduled, true)}
                            colorClass="text-rose-500"
                            absolute={stats.agendas.first_call.no_show}
                            tooltip="Porcentaje de leads agendados que no se presentaron a la primera llamada."
                        />
                        <ProgressRow
                            label="Cancelation Rate"
                            percentage={calcDiv(stats.agendas.first_call.canceled, stats.agendas.first_call.scheduled, true)}
                            colorClass="text-fuchsia-500"
                            absolute={stats.agendas.first_call.canceled}
                            tooltip="Porcentaje de leads que cancelaron explícitamente su primera llamada."
                        />
                        <ProgressRow
                            label="Reprogramation Rate"
                            percentage={calcDiv(stats.agendas.first_call.rescheduled, stats.agendas.first_call.scheduled, true)}
                            colorClass="text-amber-500"
                            absolute={stats.agendas.first_call.rescheduled}
                            tooltip="Porcentaje de agendas que fueron reprogramadas para otra fecha."
                        />
                    </div>

                    {/* Segunda Llamada */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <h4 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                <PhoneCall size={16} className="text-sky-500" />
                                Segunda Llamada
                            </h4>
                            <span className="text-xs font-bold text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
                                {stats.agendas.second_call.scheduled} Totales
                            </span>
                        </div>

                        <ProgressRow
                            label="Show Rate (Asistencias)"
                            percentage={calcDiv(stats.agendas.second_call.attended, stats.agendas.second_call.scheduled, true)}
                            colorClass="text-sky-500"
                            absolute={stats.agendas.second_call.attended}
                            tooltip="Porcentaje de leads agendados que realmente asistieron a la segunda llamada."
                        />
                        <ProgressRow
                            label="No Show Rate"
                            percentage={calcDiv(stats.agendas.second_call.no_show, stats.agendas.second_call.scheduled, true)}
                            colorClass="text-rose-500"
                            absolute={stats.agendas.second_call.no_show}
                            tooltip="Porcentaje de leads agendados que no se presentaron a la segunda llamada."
                        />
                        <ProgressRow
                            label="Cancelation Rate"
                            percentage={calcDiv(stats.agendas.second_call.canceled, stats.agendas.second_call.scheduled, true)}
                            colorClass="text-fuchsia-500"
                            absolute={stats.agendas.second_call.canceled}
                            tooltip="Porcentaje de leads que cancelaron explícitamente su segunda llamada."
                        />
                        <ProgressRow
                            label="Reprogramation Rate"
                            percentage={calcDiv(stats.agendas.second_call.rescheduled, stats.agendas.second_call.scheduled, true)}
                            colorClass="text-amber-500"
                            absolute={stats.agendas.second_call.rescheduled}
                            tooltip="Porcentaje de segundas agendas que fueron reprogramadas para otra fecha."
                        />
                    </div>
                </div>
            </div>

            {/* BOTTOM ROW: DISTRIBUTION CHARTS */}
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

export default CloserAdvancedStatsView;
