import React, { useMemo } from 'react';
import {
    Loader2, BarChart3, DollarSign, Phone, Target,
    CalendarDays, Layers, TrendingUp, Users,
    CheckCircle, XCircle, PhoneOff, RefreshCw, Table, List,
    PenTool, Info, HelpCircle, Activity, PhoneCall
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import FunnelChart from '../../components/charts/FunnelChart';

const normalizeStats = (s) => {
    if (!s) return null;
    return {
        ...s,
        general: {
            slots: s.general?.slots ?? 0,
            offers_made: s.general?.offers_made ?? 0,
            decision_makers: s.general?.decision_makers ?? 0,
            rescheduled_calls: s.general?.rescheduled_calls ?? 0,
        },
        agendas: {
            first_call: {
                scheduled: s.agendas?.first_call?.scheduled ?? 0,
                attended: s.agendas?.first_call?.attended ?? 0,
                no_show: s.agendas?.first_call?.no_show ?? 0,
                rescheduled: s.agendas?.first_call?.rescheduled ?? 0,
                canceled: s.agendas?.first_call?.canceled ?? 0,
            },
            second_call: {
                scheduled: s.agendas?.second_call?.scheduled ?? 0,
                attended: s.agendas?.second_call?.attended ?? 0,
                no_show: s.agendas?.second_call?.no_show ?? 0,
                rescheduled: s.agendas?.second_call?.rescheduled ?? 0,
                canceled: s.agendas?.second_call?.canceled ?? 0,
            },
            totals: {
                scheduled: s.agendas?.totals?.scheduled ?? 0,
                attended: s.agendas?.totals?.attended ?? 0,
                no_show: s.agendas?.totals?.no_show ?? 0,
                rescheduled: s.agendas?.totals?.rescheduled ?? 0,
                canceled: s.agendas?.totals?.canceled ?? 0,
            }
        },
        sales: {
            pif: {
                count: s.sales?.pif?.count ?? 0,
                cash: s.sales?.pif?.cash ?? 0,
                cash_neto: s.sales?.pif?.cash_neto ?? 0,
                in_call_count: s.sales?.pif?.in_call_count ?? 0,
                in_call_cash: s.sales?.pif?.in_call_cash ?? 0,
            },
            split: {
                count: s.sales?.split?.count ?? 0,
                cash: s.sales?.split?.cash ?? 0,
                cash_neto: s.sales?.split?.cash_neto ?? 0,
                in_call_count: s.sales?.split?.in_call_count ?? 0,
                in_call_cash: s.sales?.split?.in_call_cash ?? 0,
            },
            deposit: {
                count: s.sales?.deposit?.count ?? 0,
                cash: s.sales?.deposit?.cash ?? 0,
                cash_neto: s.sales?.deposit?.cash_neto ?? 0,
                in_call_count: s.sales?.deposit?.in_call_count ?? 0,
                in_call_cash: s.sales?.deposit?.in_call_cash ?? 0,
            },
            installment: {
                count: s.sales?.installment?.count ?? 0,
                cash: s.sales?.installment?.cash ?? 0,
                cash_neto: s.sales?.installment?.cash_neto ?? 0,
                in_call_count: s.sales?.installment?.in_call_count ?? 0,
                in_call_cash: s.sales?.installment?.in_call_cash ?? 0,
            },
            deposit_conversions: {
                total: s.sales?.deposit_conversions?.total ?? 0,
                converted: s.sales?.deposit_conversions?.converted ?? 0,
                rate: s.sales?.deposit_conversions?.rate ?? 0,
            },
            general_average_ticket: s.sales?.general_average_ticket ?? 0,
            program_tickets: s.sales?.program_tickets || [],
            discrepancies: s.sales?.discrepancies || [],
            totals: {
                count: s.sales?.totals?.count ?? 0,
                cash: s.sales?.totals?.cash ?? 0,
                cash_neto: s.sales?.totals?.cash_neto ?? 0,
                in_call_count: s.sales?.totals?.in_call_count ?? 0,
                in_call_cash: s.sales?.totals?.in_call_cash ?? 0,
            }
        },
        follow_ups: {
            sent: s.follow_ups?.sent ?? 0,
            replied: s.follow_ups?.replied ?? 0,
            hot_sent: s.follow_ups?.hot_sent ?? 0,
            hot_replied: s.follow_ups?.hot_replied ?? 0,
            cold_sent: s.follow_ups?.cold_sent ?? 0,
            cold_replied: s.follow_ups?.cold_replied ?? 0,
        },
        percentages: {
            show_rate: s.percentages?.show_rate ?? 0,
            no_show_rate: s.percentages?.no_show_rate ?? 0,
            cancel_rate: s.percentages?.cancel_rate ?? 0,
            close_rate: s.percentages?.close_rate ?? 0,
            offer_to_sale: s.percentages?.offer_to_sale ?? 0,
            respond_rate: s.percentages?.respond_rate ?? 0,
            pitch_rate: s.percentages?.pitch_rate ?? 0,
            decision_maker_rate: s.percentages?.decision_maker_rate ?? 0,
            rescheduled_rate: s.percentages?.rescheduled_rate ?? 0,
            deposit_conversion_rate: s.percentages?.deposit_conversion_rate ?? 0,
        },
        metadata: {
            days_analyzed: s.metadata?.days_analyzed ?? 1,
            agg_type: s.metadata?.agg_type ?? 'sum',
        },
        comparison: s.comparison ? normalizeStats(s.comparison) : null
    };
};

const MetricWithTooltip = ({ children, tooltip, className = "flex items-center justify-between w-full", position = "top" }) => {
    return (
        <div className={`relative group/metric cursor-help ${className}`}>
            {children}
            <div className={`absolute ${position === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'} left-1/2 -translate-x-1/2 w-64 bg-slate-900 border border-slate-800 text-slate-200 text-[10px] leading-relaxed font-bold normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/metric:opacity-100 transition-all pointer-events-none z-[9999] shadow-2xl text-center`}>
                {tooltip}
                <div className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${position === 'bottom' ? 'bottom-full border-b-slate-900' : 'top-full border-t-slate-900'}`}></div>
            </div>
        </div>
    );
};

const CloserPerformanceTab = ({ stats: rawStats, loading, compare, setActiveTab, setFilters }) => {

    const [showDiscrepanciesModal, setShowDiscrepanciesModal] = React.useState(false);
    const stats = useMemo(() => normalizeStats(rawStats), [rawStats]);

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

    const renderComparisonSubdata = (current, previous, isCurrency = false, isPct = false) => {
        if (!compare || !stats?.comparison) return null;
        const curVal = Number(current || 0);
        const prevVal = Number(previous || 0);

        let fmtPrev = prevVal.toLocaleString(undefined, { maximumFractionDigits: 1 });
        if (isCurrency) fmtPrev = fmtCash(prevVal);
        else if (isPct) fmtPrev = `${prevVal.toFixed(1)}%`;

        if (prevVal === 0) {
            return (
                <div className="flex items-center justify-end gap-1.5 text-[9px] font-black uppercase text-slate-500 mt-0.5">
                    <span>Ant: {fmtPrev}</span>
                    {curVal > 0 && <span className="text-emerald-400 font-bold">(+100%)</span>}
                </div>
            );
        }

        const diff = ((curVal - prevVal) / prevVal) * 100;
        const sign = diff > 0 ? '+' : '';
        const color = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-slate-500';

        return (
            <div className="flex items-center justify-end gap-1.5 text-[9px] font-black uppercase text-slate-500 mt-0.5 animate-in fade-in duration-300">
                <span>Ant: {fmtPrev}</span>
                <span className={`${color} font-bold`}>({sign}{diff.toFixed(1)}%)</span>
            </div>
        );
    };

    const renderComparisonSubdataLeft = (current, previous, isCurrency = false, isPct = false) => {
        if (!compare || !stats?.comparison) return null;
        const curVal = Number(current || 0);
        const prevVal = Number(previous || 0);

        let fmtPrev = prevVal.toLocaleString(undefined, { maximumFractionDigits: 1 });
        if (isCurrency) fmtPrev = fmtCash(prevVal);
        else if (isPct) fmtPrev = `${prevVal.toFixed(1)}%`;

        if (prevVal === 0) {
            return (
                <div className="flex items-center gap-1.5 mt-1 text-[9px] font-black uppercase text-slate-500">
                    <span>Ant: {fmtPrev}</span>
                    {curVal > 0 && <span className="text-emerald-400 font-bold">(+100%)</span>}
                </div>
            );
        }

        const diff = ((curVal - prevVal) / prevVal) * 100;
        const sign = diff > 0 ? '+' : '';
        const color = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-slate-500';

        return (
            <div className="flex items-center gap-1.5 mt-1 text-[9px] font-black uppercase text-slate-500 animate-in fade-in duration-300">
                <span>Ant: {fmtPrev}</span>
                <span className={`${color} font-bold`}>({sign}{diff.toFixed(1)}%)</span>
            </div>
        );
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

    const CallPieChart = ({ title, attended, noShow, canceled, scheduled }) => {
        const pieData = [
            { name: 'Asistencias', value: attended },
            { name: 'No Show', value: noShow },
            { name: 'Cancelado', value: canceled }
        ].filter(d => d.value > 0);

        if (pieData.length === 0) {
            pieData.push({ name: 'Sin Agendas', value: 1 });
        }

        const colors = pieData[0].name === 'Sin Agendas' ? ['#334155'] : ['#10b981', '#f43f5e', '#f59e0b'];

        const showRate = scheduled > 0 ? (attended / scheduled) * 100 : 0;
        const noShowRate = scheduled > 0 ? (noShow / scheduled) * 100 : 0;
        const cancelRate = scheduled > 0 ? (canceled / scheduled) * 100 : 0;

        return (
            <div className="bg-slate-950/40 p-4 rounded-3xl border border-slate-800/50 flex flex-col items-center space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{title}</h4>
                <div className="h-32 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={30}
                                outerRadius={40}
                                paddingAngle={3}
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} className="stroke-slate-950 stroke-2" />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '1rem', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                                itemStyle={{ color: '#e2e8f0' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="w-full space-y-2 text-[9px] font-bold text-slate-300">
                    <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded-xl border border-slate-900">
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Show Rate:</span>
                        </div>
                        <span className="text-emerald-400 font-black tabular-nums">{showRate.toFixed(1)}% <span className="text-slate-600 font-bold">({attended})</span></span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded-xl border border-slate-900">
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>No Show Rate:</span>
                        </div>
                        <span className="text-rose-400 font-black tabular-nums">{noShowRate.toFixed(1)}% <span className="text-slate-600 font-bold">({noShow})</span></span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded-xl border border-slate-900">
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>Cancel Rate:</span>
                        </div>
                        <span className="text-amber-400 font-black tabular-nums">{cancelRate.toFixed(1)}% <span className="text-slate-600 font-bold">({canceled})</span></span>
                    </div>
                </div>
            </div>
        );
    };

    const SalesPieChart = ({ title, pifVal, splitVal, installmentVal, depositVal, isCurrency = false }) => {
        const pieData = [
            { name: 'PIF', value: pifVal },
            { name: 'Split Pay', value: splitVal },
            { name: 'Cuotas', value: installmentVal },
            { name: 'Señas', value: depositVal }
        ].filter(d => d.value > 0);

        if (pieData.length === 0) {
            pieData.push({ name: 'Sin Ventas', value: 1 });
        }

        const colors = pieData[0].name === 'Sin Ventas' ? ['#334155'] : ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];
        const total = pifVal + splitVal + installmentVal + depositVal;

        const fmtVal = (val) => {
            return isCurrency ? fmtCash(val) : fmt(val);
        };

        const getPct = (val) => {
            return total > 0 ? (val / total) * 100 : 0;
        };

        return (
            <div className="bg-slate-950/40 p-4 rounded-3xl border border-slate-800/50 flex flex-col items-center space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{title}</h4>
                <div className="h-32 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={30}
                                outerRadius={40}
                                paddingAngle={3}
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} className="stroke-slate-950 stroke-2" />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '1rem', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                                itemStyle={{ color: '#e2e8f0' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="w-full space-y-2 text-[9px] font-bold text-slate-300">
                    <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded-xl border border-slate-900">
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>PIF:</span>
                        </div>
                        <span className="text-emerald-400 font-black tabular-nums">{getPct(pifVal).toFixed(1)}% <span className="text-slate-600 font-bold">({fmtVal(pifVal)})</span></span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded-xl border border-slate-900">
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span>Split Pay:</span>
                        </div>
                        <span className="text-blue-400 font-black tabular-nums">{getPct(splitVal).toFixed(1)}% <span className="text-slate-600 font-bold">({fmtVal(splitVal)})</span></span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded-xl border border-slate-900">
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                            <span>Cuotas:</span>
                        </div>
                        <span className="text-violet-400 font-black tabular-nums">{getPct(installmentVal).toFixed(1)}% <span className="text-slate-600 font-bold">({fmtVal(installmentVal)})</span></span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded-xl border border-slate-900">
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>Señas:</span>
                        </div>
                        <span className="text-amber-400 font-black tabular-nums">{getPct(depositVal).toFixed(1)}% <span className="text-slate-600 font-bold">({fmtVal(depositVal)})</span></span>
                    </div>
                </div>
            </div>
        );
    };

    const funnelData = useMemo(() => {
        if (!stats) return [];
        const pif = stats.sales.pif?.count ?? stats.sales.totals?.pif_count ?? 0;
        const split = stats.sales.split?.count ?? stats.sales.totals?.split_count ?? 0;
        const realSales = pif + split;
        return [
            { name: 'Slots', value: stats.general.slots, fill: '#8b5cf6' },
            { name: 'Agendas', value: stats.agendas.totals.scheduled, fill: '#10b981' },
            { name: 'Asistencias', value: stats.agendas.first_call.attended, fill: '#0ea5e9' },
            { name: 'Ofertas', value: stats.general.offers_made, fill: '#d946ef' },
            { name: 'Ventas', value: realSales, fill: '#f59e0b' }
        ];
    }, [stats]);

    // Optimizacion de Rendimiento: Calculo unificado con useMemo
    const salesMetrics = useMemo(() => {
        if (!stats) return {};

        const pifCount = stats.sales.pif?.count ?? stats.sales.totals?.pif_count ?? 0;
        const splitCount = stats.sales.split?.count ?? stats.sales.totals?.split_count ?? 0;
        const depositCount = stats.sales.deposit?.count ?? stats.sales.totals?.deposit_count ?? stats.sales.totals?.seña_count ?? 0;
        const installmentCount = stats.sales.installment?.count ?? stats.sales.totals?.installment_count ?? 0;
        
        const pifCash = stats.sales.pif?.cash ?? stats.sales.totals?.pif_cash_collected ?? stats.sales.totals?.pif_cash ?? 0;
        const splitCash = stats.sales.split?.cash ?? stats.sales.totals?.split_cash_collected ?? stats.sales.totals?.split_cash ?? 0;
        const depositCash = stats.sales.deposit?.cash ?? stats.sales.totals?.deposit_cash_collected ?? stats.sales.totals?.deposit_cash ?? stats.sales.totals?.seña_cash ?? 0;
        const installmentCash = stats.sales.installment?.cash ?? stats.sales.totals?.installment_cash ?? stats.sales.totals?.installment_cash_collected ?? 0;

        const pifCashNeto = stats.sales.pif?.cash_neto ?? 0;
        const splitCashNeto = stats.sales.split?.cash_neto ?? 0;
        const depositCashNeto = stats.sales.deposit?.cash_neto ?? 0;
        const installmentCashNeto = stats.sales.installment?.cash_neto ?? 0;

        const realSalesCount = pifCount + splitCount;
        const realSalesCash = pifCash + splitCash;
        const totalCashCollected = pifCash + splitCash + installmentCash + depositCash;
        const totalCashCollectedNeto = pifCashNeto + splitCashNeto + installmentCashNeto + depositCashNeto;

        const ticketPromedioReal = realSalesCount > 0 ? (realSalesCash / realSalesCount) : 0;

        // Datos del periodo anterior (Comparison)
        const compStats = stats.comparison;
        const compPifCount = compStats?.sales?.pif?.count ?? compStats?.sales?.totals?.pif_count ?? 0;
        const compSplitCount = compStats?.sales?.split?.count ?? compStats?.sales?.totals?.split_count ?? 0;
        const compDepositCount = compStats?.sales?.deposit?.count ?? compStats?.sales?.totals?.deposit_count ?? compStats?.sales?.totals?.seña_count ?? 0;
        const compInstallmentCount = compStats?.sales?.installment?.count ?? compStats?.sales?.totals?.installment_count ?? 0;

        const compPifCash = compStats?.sales?.pif?.cash ?? compStats?.sales?.totals?.pif_cash_collected ?? compStats?.sales?.totals?.pif_cash ?? 0;
        const compSplitCash = compStats?.sales?.split?.cash ?? compStats?.sales?.totals?.split_cash_collected ?? compStats?.sales?.totals?.split_cash ?? 0;
        const compDepositCash = compStats?.sales?.deposit?.cash ?? compStats?.sales?.totals?.deposit_cash_collected ?? compStats?.sales?.totals?.deposit_cash ?? compStats?.sales?.totals?.seña_cash ?? 0;
        const compInstallmentCash = compStats?.sales?.installment?.cash ?? compStats?.sales?.totals?.installment_cash ?? compStats?.sales?.totals?.installment_cash_collected ?? 0;

        const compPifCashNeto = compStats?.sales?.pif?.cash_neto ?? 0;
        const compSplitCashNeto = compStats?.sales?.split?.cash_neto ?? 0;
        const compDepositCashNeto = compStats?.sales?.deposit?.cash_neto ?? 0;
        const compInstallmentCashNeto = compStats?.sales?.installment?.cash_neto ?? 0;

        const compRealSalesCount = compPifCount + compSplitCount;
        const compRealSalesCash = compPifCash + compSplitCash;
        const compTotalCashCollected = compPifCash + compSplitCash + compInstallmentCash + compDepositCash;
        const compTotalCashCollectedNeto = compPifCashNeto + compSplitCashNeto + compInstallmentCashNeto + compDepositCashNeto;

        const compTicketPromedioReal = compRealSalesCount > 0 ? (compRealSalesCash / compRealSalesCount) : 0;

        // Metricas de in-call / out-call cash
        const pifInCall = stats.sales.pif?.in_call_cash ?? 0;
        const splitInCall = stats.sales.split?.in_call_cash ?? 0;
        const depositInCall = stats.sales.deposit?.in_call_cash ?? 0;
        const installmentInCall = stats.sales.installment?.in_call_cash ?? 0;

        const compPifInCall = compStats?.sales?.pif?.in_call_cash ?? 0;
        const compSplitInCall = compStats?.sales?.split?.in_call_cash ?? 0;
        const compDepositInCall = compStats?.sales?.deposit?.in_call_cash ?? 0;
        const compInstallmentInCall = compStats?.sales?.installment?.in_call_cash ?? 0;

        const totalInCallCash = pifInCall + splitInCall + depositInCall + installmentInCall;
        const compTotalInCallCash = compPifInCall + compSplitInCall + compDepositInCall + compInstallmentInCall;

        const totalOutCallCash = totalCashCollected - totalInCallCash;
        const compTotalOutCallCash = compTotalCashCollected - compTotalInCallCash;

        // Calculos de Tickets Promedio
        const ticketPif = pifCount > 0 ? pifCash / pifCount : 0;
        const compTicketPif = compPifCount > 0 ? compPifCash / compPifCount : 0;
        const ticketSplit = splitCount > 0 ? splitCash / splitCount : 0;
        const compTicketSplit = compSplitCount > 0 ? compSplitCash / compSplitCount : 0;
        const ticketDeposit = depositCount > 0 ? depositCash / depositCount : 0;
        const compTicketDeposit = compDepositCount > 0 ? compDepositCash / compDepositCount : 0;
        const ticketInstallment = installmentCount > 0 ? installmentCash / installmentCount : 0;
        const compTicketInstallment = compInstallmentCount > 0 ? compInstallmentCash / compInstallmentCount : 0;

        const programTickets = stats.sales.program_tickets || [];
        const generalAverageTicket = stats.sales.general_average_ticket || 0;
        const discrepancies = stats.sales.discrepancies || [];

        const compProgramTickets = compStats?.sales?.program_tickets || [];
        const compGeneralAverageTicket = compStats?.sales?.general_average_ticket || 0;

        return {
            pifCount, splitCount, depositCount, installmentCount,
            pifCash, splitCash, depositCash, installmentCash,
            realSalesCount, realSalesCash, totalCashCollected, totalCashCollectedNeto, ticketPromedioReal,
            compStats,
            compPifCount, compSplitCount, compDepositCount, compInstallmentCount,
            compPifCash, compSplitCash, compDepositCash, compInstallmentCash,
            compRealSalesCount, compRealSalesCash, compTotalCashCollected, compTotalCashCollectedNeto, compTicketPromedioReal,
            pifInCall, splitInCall, depositInCall, installmentInCall,
            compPifInCall, compSplitInCall, compDepositInCall, compInstallmentInCall,
            totalInCallCash, compTotalInCallCash,
            totalOutCallCash, compTotalOutCallCash,
            ticketPif, compTicketPif,
            ticketSplit, compTicketSplit,
            ticketDeposit, compTicketDeposit,
            ticketInstallment, compTicketInstallment,
            programTickets, generalAverageTicket,
            compProgramTickets, compGeneralAverageTicket,
            discrepancies
        };
    }, [stats]);

    if (loading || !stats) {
        return (
            <div className="flex flex-col items-center justify-center py-40 space-y-4">
                <Loader2 className="animate-spin text-violet-500" size={48} />
                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Sincronizando datos...</p>
            </div>
        );
    }

    const {
        pifCount = 0, splitCount = 0, depositCount = 0, installmentCount = 0,
        pifCash = 0, splitCash = 0, depositCash = 0, installmentCash = 0,
        realSalesCount = 0, realSalesCash = 0, totalCashCollected = 0, totalCashCollectedNeto = 0, ticketPromedioReal = 0,
        compStats,
        compPifCount = 0, compSplitCount = 0, compDepositCount = 0, compInstallmentCount = 0,
        compPifCash = 0, compSplitCash = 0, compDepositCash = 0, compInstallmentCash = 0,
        compRealSalesCount = 0, compRealSalesCash = 0, compTotalCashCollected = 0, compTotalCashCollectedNeto = 0, compTicketPromedioReal = 0,
        pifInCall = 0, splitInCall = 0, depositInCall = 0, installmentInCall = 0,
        compPifInCall = 0, compSplitInCall = 0, compDepositInCall = 0, compInstallmentInCall = 0,
        totalInCallCash = 0, compTotalInCallCash = 0,
        totalOutCallCash = 0, compTotalOutCallCash = 0,
        ticketPif = 0, compTicketPif = 0,
        ticketSplit = 0, compTicketSplit = 0,
        ticketDeposit = 0, compTicketDeposit = 0,
        ticketInstallment = 0, compTicketInstallment = 0,
        programTickets = [], generalAverageTicket = 0,
        compProgramTickets = [], compGeneralAverageTicket = 0,
        discrepancies = []
    } = salesMetrics;




    const salesData = [
        { name: 'PIF', value: pifCount },
        { name: 'Split Pay', value: splitCount },
        { name: 'Cuotas', value: installmentCount },
        { name: 'Promesas (Señas)', value: depositCount }
    ].filter(d => d.value > 0);
    if (salesData.length === 0) salesData.push({ name: 'Sin Ventas', value: 1 });
    const salesColors = salesData[0].name === 'Sin Ventas' ? ['#334155'] : ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

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
            {/* 1. EJECUTIVO DASHBOARD: 3 PILARES ESTRATÉGICOS (C-LEVEL VIEW) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* PILAR 1: INGRESO CONSOLIDADO (CASH COLLECT) */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                    <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                        <div className="absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-10 bg-emerald-500 group-hover:opacity-20 transition-opacity duration-300" />
                    </div>
                    <div className="flex justify-between items-center relative z-10">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Facturación y Flujo de Caja</span>
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <DollarSign size={16} />
                        </div>
                    </div>
                    <div className="space-y-4 relative z-10">
                        <MetricWithTooltip tooltip="Total de dinero bruto facturado o recaudado en el período, incluyendo nuevos cierres (PIF/Splits), señas y cobro de cuotas, sin descontar comisiones de pasarelas." className="block cursor-help">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">CASH COLLECT BRUTO</h4>
                            <h2 className="text-4xl font-black text-white italic tracking-tighter leading-none mt-1">{fmtCash(totalCashCollected)}</h2>
                            {renderComparisonSubdataLeft(totalCashCollected, compTotalCashCollected, true)}
                        </MetricWithTooltip>
                        <div className="pt-3 border-t border-slate-800/60">
                            <MetricWithTooltip tooltip="Total de dinero neto recaudado tras descontar comisiones de pasarelas (Stripe: 4.5%, Hotmart: 8.9%)." className="block cursor-help">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">CASH COLLECT NETO</h4>
                                <h2 className="text-4xl font-black text-emerald-400 italic tracking-tighter leading-none mt-1">{fmtCash(totalCashCollectedNeto)}</h2>
                                {renderComparisonSubdataLeft(totalCashCollectedNeto, compTotalCashCollectedNeto, true)}
                            </MetricWithTooltip>
                        </div>
                    </div>
                    <div className="pt-6 border-t border-slate-800 space-y-3 relative z-10">
                        <MetricWithTooltip tooltip="Recaudación bruta de pagos únicos o iniciales de nuevos contratos." className="flex justify-between items-center bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80 cursor-help">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nuevas Ventas (New Cash)</span>
                            <div className="text-right">
                                <span className="text-sm font-black text-emerald-400 tabular-nums">{fmtCash(realSalesCash)}</span>
                                {renderComparisonSubdata(realSalesCash, compRealSalesCash, true)}
                            </div>
                        </MetricWithTooltip>
                        <MetricWithTooltip tooltip="Recaudación bruta de cobros de cuotas de alumnos inscritos previamente." className="flex justify-between items-center bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80 cursor-help">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cobro de Cuotas (Installments)</span>
                            <div className="text-right">
                                <span className="text-sm font-black text-white tabular-nums">{fmtCash(installmentCash)}</span>
                                {renderComparisonSubdata(installmentCash, compInstallmentCash, true)}
                            </div>
                        </MetricWithTooltip>
                        <MetricWithTooltip tooltip="Recaudación bruta de reservas o señas de llamadas." className="flex justify-between items-center bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80 cursor-help">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reservas (Cash Señas)</span>
                            <div className="text-right">
                                <span className="text-sm font-black text-fuchsia-400 tabular-nums">{fmtCash(depositCash)}</span>
                                {renderComparisonSubdata(depositCash, compDepositCash, true)}
                            </div>
                        </MetricWithTooltip>
                    </div>
                </div>

                {/* PILAR 2: CIERRE Y EFICIENCIA DE VENTAS (NUEVOS CLIENTES) */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
                    <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                        <div className="absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-10 bg-amber-500 group-hover:opacity-20 transition-opacity duration-300" />
                    </div>
                    <div className="flex justify-between items-center relative z-10">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Cierre y Eficiencia Comercial</span>
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <Target size={16} />
                        </div>
                    </div>
                    <div className="space-y-1 relative z-10">
                        <MetricWithTooltip tooltip="Cantidad de nuevos contratos o alumnos cerrados (incluye solo transacciones iniciales PIF y Split Pay)." className="block cursor-help">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none">NUEVOS CLIENTES (VENTAS)</h4>
                            <h2 className="text-5xl font-black text-white italic tracking-tighter leading-none mt-1">{fmt(realSalesCount)}</h2>
                            {renderComparisonSubdataLeft(realSalesCount, compRealSalesCount)}
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Contratos PIF + Split Concretados</p>
                        </MetricWithTooltip>
                    </div>
                    <div className="pt-6 border-t border-slate-800 space-y-3 relative z-10">
                        <MetricWithTooltip tooltip="Porcentaje de cierres de ventas sobre el total de llamadas atendidas en primera llamada." className="flex justify-between items-center bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80 cursor-help">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Close Rate (Asistencias)</span>
                            <div className="text-right">
                                <span className="text-sm font-black text-amber-400 tabular-nums">
                                    {fmtNum(calcDiv(realSalesCount, stats.agendas.first_call.attended, true), true)}
                                </span>
                                {renderComparisonSubdata(
                                    calcDiv(realSalesCount, stats.agendas.first_call.attended, true),
                                    calcDiv(compRealSalesCount, compStats?.agendas?.first_call?.attended, true),
                                    false,
                                    true
                                )}
                            </div>
                        </MetricWithTooltip>
                        <MetricWithTooltip tooltip="Monto promedio cobrado por cada nuevo contrato (PIF + Split) concretado en el período." className="flex justify-between items-center bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80 cursor-help">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ticket Promedio Real</span>
                            <div className="text-right">
                                <span className="text-sm font-black text-sky-400 tabular-nums">{fmtNum(ticketPromedioReal, false, true)}</span>
                                {renderComparisonSubdata(ticketPromedioReal, compTicketPromedioReal, true)}
                            </div>
                        </MetricWithTooltip>
                        <MetricWithTooltip tooltip="Porcentaje de señas del período que se convirtieron en un contrato cerrado (PIF o Split)." className="flex justify-between items-center bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80 cursor-help">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Conversión de Señas</span>
                            <div className="text-right">
                                <span className="text-sm font-black text-fuchsia-400 tabular-nums">{stats.sales.deposit_conversions?.rate ?? 0}%</span>
                                {renderComparisonSubdata(
                                    stats.sales.deposit_conversions?.rate ?? 0,
                                    compStats?.sales?.deposit_conversions?.rate ?? 0,
                                    false,
                                    true
                                )}
                            </div>
                        </MetricWithTooltip>
                    </div>
                </div>

                {/* PILAR 3: PRODUCTIVIDAD Y AGENDA (LLAMADAS Y SHOW RATE) */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden group hover:border-sky-500/30 transition-all duration-300">
                    <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                        <div className="absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-10 bg-sky-500 group-hover:opacity-20 transition-opacity duration-300" />
                    </div>
                    <div className="flex justify-between items-center relative z-10">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Productividad y Agendamiento</span>
                        <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20">
                            <Phone size={16} />
                        </div>
                    </div>
                    <div className="space-y-1 relative z-10">
                        <MetricWithTooltip tooltip="Cantidad total de reuniones uno a uno que fueron atendidas en el período." className="block cursor-help">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none">ASISTENCIAS REALES</h4>
                            <h2 className="text-5xl font-black text-white italic tracking-tighter leading-none mt-1">{fmt(stats.agendas.totals.attended)}</h2>
                            {renderComparisonSubdataLeft(stats.agendas.totals.attended, compStats?.agendas?.totals?.attended)}
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Reuniones Uno a Uno Completadas</p>
                        </MetricWithTooltip>
                    </div>
                    <div className="pt-6 border-t border-slate-800 space-y-3 relative z-10">
                        <MetricWithTooltip tooltip="Porcentaje de citas agendadas que asistieron a la llamada." className="flex justify-between items-center bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80 cursor-help">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Show Rate (Asistencia %)</span>
                            <div className="text-right">
                                <span className="text-sm font-black text-emerald-400 tabular-nums">{stats.percentages.show_rate.toFixed(1)}%</span>
                                {renderComparisonSubdata(stats.percentages.show_rate, compStats?.percentages?.show_rate, false, true)}
                            </div>
                        </MetricWithTooltip>
                        <MetricWithTooltip tooltip="Porcentaje de citas agendadas que no asistieron ni cancelaron." className="flex justify-between items-center bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80 cursor-help">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No Show Rate (Inasistencias %)</span>
                            <div className="text-right">
                                <span className="text-sm font-black text-rose-400 tabular-nums">{stats.percentages.no_show_rate.toFixed(1)}%</span>
                                {renderComparisonSubdata(stats.percentages.no_show_rate, compStats?.percentages?.no_show_rate, false, true)}
                            </div>
                        </MetricWithTooltip>
                        <MetricWithTooltip tooltip="Porcentaje de citas agendadas que cancelaron la llamada." className="flex justify-between items-center bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80 cursor-help">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cancel Rate (Cancelaciones %)</span>
                            <div className="text-right">
                                <span className="text-sm font-black text-amber-400 tabular-nums">{stats.percentages.cancel_rate.toFixed(1)}%</span>
                                {renderComparisonSubdata(stats.percentages.cancel_rate, compStats?.percentages?.cancel_rate, false, true)}
                            </div>
                        </MetricWithTooltip>
                        <MetricWithTooltip tooltip="Porcentaje de llamadas atendidas en las que el closer logró realizar la presentación de la oferta." className="flex justify-between items-center bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80 cursor-help">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pitch Rate (Presentación)</span>
                            <div className="text-right">
                                <span className="text-sm font-black text-fuchsia-400 tabular-nums">{stats.percentages.pitch_rate.toFixed(1)}%</span>
                                {renderComparisonSubdata(stats.percentages.pitch_rate, compStats?.percentages?.pitch_rate, false, true)}
                            </div>
                        </MetricWithTooltip>
                        <MetricWithTooltip tooltip="Cantidad total de citas agendadas que no se concretaron (No Shows + Cancelaciones)." className="flex justify-between items-center bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80 cursor-help">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No Shows / Canceladas (Cant.)</span>
                            <div className="text-right">
                                <span className="text-sm font-black text-rose-400 tabular-nums">{fmt(totalNoShow + totalCanceled)}</span>
                                {renderComparisonSubdata(totalNoShow + totalCanceled, (compStats?.agendas?.totals?.no_show ?? 0) + (compStats?.agendas?.totals?.canceled ?? 0))}
                            </div>
                        </MetricWithTooltip>
                    </div>
                </div>
                
            </div>

            {/* 2. GRÁFICO DE EMBUDO Y CONVERSIONES CRÍTICAS (EJECUTIVO) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* COL 1: CONVERSIONES CRÍTICAS Y TASAS DE NEGOCIO */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 flex flex-col justify-between">
                    <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                            <TrendingUp size={20} />
                        </div>
                        <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Conversiones de Embudo</h3>
                    </div>

                    <div className="space-y-4 flex-1 flex flex-col justify-center">
                        <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex justify-between items-center relative group overflow-hidden">
                            <div>
                                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">Agendamiento General</p>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mt-1">Slots → Agendas Totales</span>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-black text-white italic tabular-nums">
                                    {stats.general.slots ? ((stats.agendas.totals.scheduled / stats.general.slots) * 100).toFixed(1) : 0}%
                                </span>
                                {renderComparisonSubdata(
                                    stats.general.slots ? ((stats.agendas.totals.scheduled / stats.general.slots) * 100) : 0,
                                    compStats?.general?.slots ? ((compStats?.agendas?.totals?.scheduled / compStats?.general?.slots) * 100) : 0,
                                    false,
                                    true
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex justify-between items-center relative group overflow-hidden">
                            <div>
                                <p className="text-[9px] font-black text-sky-500 uppercase tracking-widest leading-none">Asistencia (Show Rate)</p>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mt-1">Agendas → Asistencias</span>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-black text-white italic tabular-nums">
                                    {stats.agendas.totals.scheduled ? ((stats.agendas.totals.attended / stats.agendas.totals.scheduled) * 100).toFixed(1) : 0}%
                                </span>
                                {renderComparisonSubdata(
                                    stats.agendas.totals.scheduled ? ((stats.agendas.totals.attended / stats.agendas.totals.scheduled) * 100) : 0,
                                    compStats?.agendas?.totals?.scheduled ? ((compStats?.agendas?.totals?.attended / compStats?.agendas?.totals?.scheduled) * 100) : 0,
                                    false,
                                    true
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex justify-between items-center relative group overflow-hidden">
                            <div>
                                <p className="text-[9px] font-black text-fuchsia-500 uppercase tracking-widest leading-none">Presentación (Pitch Rate)</p>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mt-1">Asistencias → Ofertas</span>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-black text-white italic tabular-nums">
                                    {stats.agendas.totals.attended ? ((stats.general.offers_made / stats.agendas.totals.attended) * 100).toFixed(1) : 0}%
                                </span>
                                {renderComparisonSubdata(
                                    stats.agendas.totals.attended ? ((stats.general.offers_made / stats.agendas.totals.attended) * 100) : 0,
                                    compStats?.agendas?.totals?.attended ? ((compStats?.general?.offers_made / compStats?.agendas?.totals?.attended) * 100) : 0,
                                    false,
                                    true
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex justify-between items-center relative group overflow-hidden">
                            <div>
                                <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest leading-none">Cierre Real sobre Asistencia</p>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mt-1">Asistencias → Ventas</span>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-black text-white italic tabular-nums">
                                    {stats.agendas.first_call.attended ? ((realSalesCount / stats.agendas.first_call.attended) * 100).toFixed(1) : 0}%
                                </span>
                                {renderComparisonSubdata(
                                    stats.agendas.first_call.attended ? ((realSalesCount / stats.agendas.first_call.attended) * 100) : 0,
                                    compStats?.agendas?.first_call?.attended ? ((compRealSalesCount / compStats?.agendas?.first_call?.attended) * 100) : 0,
                                    false,
                                    true
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex justify-between items-center relative group overflow-hidden">
                            <div>
                                <p className="text-[9px] font-black text-amber-500/80 uppercase tracking-widest leading-none">Cierre Real sobre Propuesta</p>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mt-1">Ofertas → Ventas</span>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-black text-white italic tabular-nums">
                                    {stats.general.offers_made ? ((realSalesCount / stats.general.offers_made) * 100).toFixed(1) : 0}%
                                </span>
                                {renderComparisonSubdata(
                                    stats.general.offers_made ? ((realSalesCount / stats.general.offers_made) * 100) : 0,
                                    compStats?.general?.offers_made ? ((compRealSalesCount / compStats?.general?.offers_made) * 100) : 0,
                                    false,
                                    true
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex justify-between items-center relative group overflow-hidden">
                            <div>
                                <p className="text-[9px] font-black text-fuchsia-400 uppercase tracking-widest leading-none">Show a Seña (Reserva)</p>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mt-1">Ofertas → Promesas</span>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-black text-white italic tabular-nums">
                                    {stats.general.offers_made ? ((depositCount / stats.general.offers_made) * 100).toFixed(1) : 0}%
                                </span>
                                {renderComparisonSubdata(
                                    stats.general.offers_made ? ((depositCount / stats.general.offers_made) * 100) : 0,
                                    compStats?.general?.offers_made ? ((compDepositCount / compStats?.general?.offers_made) * 100) : 0,
                                    false,
                                    true
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col justify-center space-y-2 relative group overflow-visible">
                            <div className="flex items-center gap-1.5 relative group/tooltip">
                                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-none">Efectividad de Cobro Señas</p>
                                <Info size={10} className="text-emerald-400/50 cursor-help" />
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-800 border border-slate-700 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-[9999] shadow-xl">
                                    Tasa de conversión de señas en ventas reales (PIF o Split Pay). Mide la efectividad del closer para concretar el cobro total posterior a la reserva.
                                    <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-800"></div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <span className="text-[10px] font-bold text-slate-500">Señas → Ventas Reales</span>
                                <div className="text-right">
                                    <span className="text-lg font-black text-white italic tabular-nums">
                                        {stats.sales.deposit_conversions?.rate ?? 0}%
                                    </span>
                                    {renderComparisonSubdata(
                                        stats.sales.deposit_conversions?.rate ?? 0,
                                        compStats?.sales?.deposit_conversions?.rate ?? 0,
                                        false,
                                        true
                                    )}
                                </div>
                            </div>
                            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider text-right">
                                {stats.sales.deposit_conversions?.converted ?? 0} de {stats.sales.deposit_conversions?.total ?? 0} señas convertidas
                            </p>
                        </div>
                    </div>
                </div>

                {/* COL 2: EMBUDO GRÁFICO (CON MÁS ESPACIO) */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col justify-between h-full group hover:border-fuchsia-500/30 transition-all duration-300">
                    <div className="w-full flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
                        <div className="p-3 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-500">
                            <TrendingUp size={20} />
                        </div>
                        <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Visualización Gráfica</h3>
                    </div>
                    <div className="w-full flex-1 min-h-[460px]">
                        <FunnelChart data={funnelData} />
                    </div>
                </div>
            </div>

            {/* 3. KPI CARDS: TICKETS PROMEDIO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {(() => {
                    const colors = ['text-sky-400', 'text-fuchsia-400', 'text-violet-400', 'text-amber-400', 'text-indigo-400'];
                    const icons = [Layers, Activity, RefreshCw, Target, CheckCircle];

                    const kpis = [
                        {
                            title: 'Ticket Promedio General',
                            val: generalAverageTicket,
                            compVal: compGeneralAverageTicket,
                            icon: DollarSign,
                            color: 'text-emerald-400',
                            count: pifCount + splitCount,
                            label: 'Ventas PIF + Split',
                            tooltip: 'Valor promedio cobrado en nuevos cierres (incluye solo pagos completos y split pays).'
                        }
                    ];

                    programTickets.forEach((pt, idx) => {
                        const compPt = compProgramTickets.find(c => c.program === pt.program);
                        const compVal = compPt ? compPt.average_ticket : 0;
                        kpis.push({
                            title: `T. Promedio ${pt.program}`,
                            val: pt.average_ticket,
                            compVal: compVal,
                            icon: icons[idx % icons.length],
                            color: colors[idx % colors.length],
                            count: pt.count,
                            label: `Ventas ${pt.program}`,
                            tooltip: `Valor promedio de cierres para el programa ${pt.program} (incluye solo pagos completos y split pays).`
                        });
                    });

                    return kpis.map((kpi) => (
                        <div key={kpi.title} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative group">
                            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                                <div className={`absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 group-hover:opacity-30 transition-opacity ${kpi.color.replace('text-', 'bg-')}`} />
                            </div>
                            <div className="flex items-start justify-between relative z-10">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{kpi.title}</p>
                                        {kpi.tooltip && (
                                            <div className="relative group/tooltip flex items-center">
                                                <HelpCircle size={10} className="text-slate-600 cursor-help hover:text-slate-300 transition-colors" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none z-[9999] shadow-xl border border-slate-700/50">
                                                    {kpi.tooltip}
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="text-3xl font-black text-white italic tracking-tighter">{fmtCash(kpi.val)}</h3>
                                    {renderComparisonSubdataLeft(kpi.val, kpi.compVal, true)}
                                    <p className="text-[9px] text-slate-600 font-bold uppercase mt-2">
                                        {kpi.count > 0 ? `Sobre ${fmt(kpi.count)} ${kpi.label}` : `Sin ${kpi.label}`}
                                    </p>
                                </div>
                                <div className={`p-3 rounded-2xl bg-slate-800 border border-slate-700/50 ${kpi.color}`}>
                                    <kpi.icon size={18} />
                                </div>
                            </div>
                        </div>
                    ));
                })()}
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
                                    {renderComparisonSubdata(stats.agendas.first_call[row.key], compStats?.agendas?.first_call?.[row.key])}
                                </div>
                                <div className="p-3 text-center border-r border-slate-800/50">
                                    <p className="text-sm font-black text-sky-400 tabular-nums">{fmt(stats.agendas.second_call[row.key])}</p>
                                    {renderComparisonSubdata(stats.agendas.second_call[row.key], compStats?.agendas?.second_call?.[row.key])}
                                </div>
                                <div className="p-3 text-center">
                                    <p className="text-sm font-black text-white tabular-nums">{fmt(stats.agendas.totals[row.key])}</p>
                                    {renderComparisonSubdata(stats.agendas.totals[row.key], compStats?.agendas?.totals?.[row.key])}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                        <CallPieChart 
                            title="1ra Llamada (Ratios)" 
                            attended={stats.agendas.first_call.attended}
                            noShow={stats.agendas.first_call.no_show}
                            canceled={stats.agendas.first_call.canceled}
                            scheduled={stats.agendas.first_call.scheduled}
                        />
                        <CallPieChart 
                            title="2da Llamada (Ratios)" 
                            attended={stats.agendas.second_call.attended}
                            noShow={stats.agendas.second_call.no_show}
                            canceled={stats.agendas.second_call.canceled}
                            scheduled={stats.agendas.second_call.scheduled}
                        />
                    </div>
                </div>

                {/* VENTAS BREAKDOWN TABLE */}
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/50 pb-4 mb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                                <DollarSign size={20} />
                            </div>
                            <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Ventas Breakdown</h3>
                        </div>
                        {discrepancies.length > 0 && (
                            <button
                                onClick={() => setShowDiscrepanciesModal(true)}
                                className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 px-4 py-2 rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all cursor-pointer shadow-lg shadow-amber-500/5"
                            >
                                <Activity size={12} className="animate-pulse text-amber-500" />
                                {discrepancies.length} {discrepancies.length === 1 ? 'Discrepancia' : 'Discrepancias'}
                            </button>
                        )}
                    </div>

                    <div className="bg-slate-800/30 rounded-2xl overflow-hidden border border-slate-800/40">
                        <div className="grid grid-cols-5 gap-0">
                            <div className="p-3 bg-slate-700/50" />
                            <div className="p-3 text-center bg-amber-900/20">
                                <p className="text-[8px] font-black text-amber-400 uppercase tracking-wider">Cantidad</p>
                            </div>
                            <div className="p-3 text-center bg-emerald-900/20">
                                <p className="text-[8px] font-black text-emerald-400 uppercase tracking-wider">Cash en llamada</p>
                            </div>
                            <div className="p-3 text-center bg-blue-900/20">
                                <p className="text-[8px] font-black text-blue-400 uppercase tracking-wider">Cash fuera de llamada</p>
                            </div>
                            <div className="p-3 text-center bg-indigo-900/20">
                                <p className="text-[8px] font-black text-indigo-400 uppercase tracking-wider">Cash Total</p>
                            </div>
                        </div>

                        {[
                            { 
                                label: 'PIF (Completo)', 
                                valCount: pifCount, 
                                compCount: compPifCount,
                                inCall: pifInCall,
                                compInCall: compPifInCall,
                                outCall: pifCash - pifInCall,
                                compOutCall: compPifCash - compPifInCall,
                                total: pifCash,
                                compTotal: compPifCash
                            },
                            { 
                                label: 'Split Pay (Inicial)', 
                                valCount: splitCount, 
                                compCount: compSplitCount,
                                inCall: splitInCall,
                                compInCall: compSplitInCall,
                                outCall: splitCash - splitInCall,
                                compOutCall: compSplitCash - compSplitInCall,
                                total: splitCash,
                                compTotal: compSplitCash
                            },
                            { 
                                label: 'Cuotas Cobradas', 
                                valCount: installmentCount, 
                                compCount: compInstallmentCount,
                                inCall: installmentInCall,
                                compInCall: compInstallmentInCall,
                                outCall: installmentCash - installmentInCall,
                                compOutCall: compInstallmentCash - compInstallmentInCall,
                                total: installmentCash,
                                compTotal: compInstallmentCash
                            },
                            { 
                                label: 'Promesas (Señas)', 
                                valCount: depositCount, 
                                compCount: compDepositCount,
                                inCall: depositInCall,
                                compInCall: compDepositInCall,
                                outCall: depositCash - depositInCall,
                                compOutCall: compDepositCash - compDepositInCall,
                                total: depositCash,
                                compTotal: compDepositCash
                            },
                        ].map((row, i) => (
                            <div key={row.label} className={`grid grid-cols-5 gap-0 ${i % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                                <div className="p-3 flex items-center gap-2 border-r border-slate-800/50">
                                    <p className="text-[9px] font-bold text-slate-300">{row.label}</p>
                                </div>
                                <div className="p-3 text-center border-r border-slate-800/50">
                                    <p className="text-sm font-black text-amber-400 tabular-nums">{fmt(row.valCount)}</p>
                                    {renderComparisonSubdata(row.valCount, row.compCount)}
                                </div>
                                <div className="p-3 text-center border-r border-slate-800/50">
                                    <p className="text-[11px] font-black text-emerald-400 tabular-nums">{fmtCash(row.inCall)}</p>
                                    {renderComparisonSubdata(row.inCall, row.compInCall, true)}
                                </div>
                                <div className="p-3 text-center border-r border-slate-800/50">
                                    <p className="text-[11px] font-black text-blue-400 tabular-nums">{fmtCash(row.outCall)}</p>
                                    {renderComparisonSubdata(row.outCall, row.compOutCall, true)}
                                </div>
                                <div className="p-3 text-center">
                                    <p className="text-[11px] font-black text-indigo-400 tabular-nums">{fmtCash(row.total)}</p>
                                    {renderComparisonSubdata(row.total, row.compTotal, true)}
                                </div>
                            </div>
                        ))}

                        <div className="grid grid-cols-5 gap-0 bg-slate-900/50 border-t border-slate-800 font-bold">
                            <div className="p-3 border-r border-slate-800/50">
                                <p className="text-[9px] font-black text-white uppercase tracking-widest">Totales</p>
                            </div>
                            <div className="p-3 text-center border-r border-slate-800/50">
                                <p className="text-sm font-black text-amber-400 tabular-nums">{fmt(realSalesCount + depositCount + installmentCount)}</p>
                                {renderComparisonSubdata(
                                    realSalesCount + depositCount + installmentCount,
                                    compRealSalesCount + compDepositCount + compInstallmentCount
                                )}
                            </div>
                            <div className="p-3 text-center border-r border-slate-800/50">
                                <p className="text-[11px] font-black text-emerald-400 tabular-nums">{fmtCash(totalInCallCash)}</p>
                                {renderComparisonSubdata(
                                    totalInCallCash,
                                    compTotalInCallCash,
                                    true
                                )}
                            </div>
                            <div className="p-3 text-center border-r border-slate-800/50">
                                <p className="text-[11px] font-black text-blue-400 tabular-nums">{fmtCash(totalOutCallCash)}</p>
                                {renderComparisonSubdata(
                                    totalOutCallCash,
                                    compTotalOutCallCash,
                                    true
                                )}
                            </div>
                            <div className="p-3 text-center">
                                <p className="text-[11px] font-black text-indigo-400 tabular-nums">{fmtCash(totalCashCollected)}</p>
                                {renderComparisonSubdata(
                                    totalCashCollected,
                                    compTotalCashCollected,
                                    true
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                        <SalesPieChart 
                            title="Distribución de Cierres (Cantidad)" 
                            pifVal={pifCount}
                            splitVal={splitCount}
                            installmentVal={installmentCount}
                            depositVal={depositCount}
                            isCurrency={false}
                        />
                        <SalesPieChart 
                            title="Distribución de Recaudación (Cash)" 
                            pifVal={pifCash}
                            splitVal={splitCash}
                            installmentVal={installmentCash}
                            depositVal={depositCash}
                            isCurrency={true}
                        />
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

            {/* 6. BOTTOM ROW: DISTRIBUTION CHARTS (FOLLOW-UPS RE-ENGAGEMENT) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

            {/* Modal de Discrepancias Diarias */}
            {showDiscrepanciesModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl space-y-6 relative overflow-hidden text-left">
                        <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                            <div className="absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-10 bg-amber-500" />
                        </div>
                        <div className="flex justify-between items-center relative z-10 border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                    <Activity size={16} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Discrepancias Diarias</h3>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Reportes de llamadas vs Ventas registradas</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDiscrepanciesModal(false)}
                                className="text-slate-500 hover:text-white transition-colors text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-slate-800 hover:bg-slate-750 rounded-xl border border-slate-750 cursor-pointer"
                            >
                                Cerrar
                            </button>
                        </div>

                        <div className="text-[10px] text-slate-400 font-medium leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-850">
                            <p className="font-bold text-amber-400 mb-1">¿Por qué ocurre esto?</p>
                            Estas discrepancias ocurren cuando el **Cash en Llamada** declarado por el closer en su reporte diario supera al **Cash Total** bruto de ventas registradas oficialmente en un mismo día. Indica que pueden faltar ventas por declarar o registrar en la planilla.
                        </div>

                        <div className="max-h-[300px] overflow-y-auto bg-slate-950/40 rounded-2xl border border-slate-800/60">
                            <table className="w-full text-left text-[10px] text-slate-300">
                                <thead className="bg-slate-950 text-slate-400 uppercase tracking-widest sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 font-black">Fecha</th>
                                        <th className="px-4 py-3 text-right font-black">Reportado (Llamada)</th>
                                        <th className="px-4 py-3 text-right font-black">Registrado (Ventas)</th>
                                        <th className="px-4 py-3 text-right font-black">Diferencia</th>
                                        {setFilters && setActiveTab && <th className="px-4 py-3 text-center font-black">Acción</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-850">
                                    {discrepancies.map((d) => (
                                        <tr key={d.date} className="hover:bg-slate-800/10 transition-colors">
                                            <td className="px-4 py-3.5 font-bold text-white tabular-nums">
                                                {d.date.split('-').reverse().join('/')}
                                            </td>
                                            <td className="px-4 py-3.5 text-right font-black text-amber-400 tabular-nums">
                                                {fmtCash(d.reported_in_call)}
                                            </td>
                                            <td className="px-4 py-3.5 text-right font-black text-white tabular-nums">
                                                {fmtCash(d.registered_total)}
                                            </td>
                                            <td className="px-4 py-3.5 text-right font-black text-rose-400 tabular-nums">
                                                {fmtCash(d.difference)}
                                            </td>
                                            {setFilters && setActiveTab && (
                                                <td className="px-4 py-2.5 text-center">
                                                    <button
                                                        onClick={() => {
                                                            setFilters(prev => ({
                                                                ...prev,
                                                                time_preset: 'custom',
                                                                start_date: d.date,
                                                                end_date: d.date
                                                            }));
                                                            setActiveTab('sales_log');
                                                            setShowDiscrepanciesModal(false);
                                                        }}
                                                        className="bg-violet-600 hover:bg-violet-700 text-white font-black uppercase text-[8px] tracking-widest px-3 py-1.5 rounded-xl cursor-pointer transition-colors shadow-md shadow-violet-600/10"
                                                    >
                                                        Ir a Ventas
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CloserPerformanceTab;
