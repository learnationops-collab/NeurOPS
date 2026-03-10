import React from 'react';
import { Loader2, Activity, Target, PhoneCall, BarChart2, TrendingUp, Users, Info } from 'lucide-react';

const CloserAdvancedStatsView = ({ stats, loading }) => {

    // Funciones de cálculo
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

    // --- Componente de Tabla Estándar ---
    const StandardTable = ({ title, icon: Icon, colorClass, rows }) => (
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
            <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl border ${colorClass}`}>
                    <Icon size={20} />
                </div>
                <h3 className="text-xl font-black text-white italic tracking-tight uppercase">{title}</h3>
            </div>

            <div className="bg-slate-800/30 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[60%_40%] gap-0">
                    <div className="p-3 bg-slate-700/50">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Métrica</p>
                    </div>
                    <div className="p-3 text-center bg-slate-700/40 flex items-center justify-center">
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-wider">Periodo</p>
                    </div>
                </div>

                {/* Rows */}
                {rows.map((r, i) => (
                    <div key={i} className={`grid grid-cols-[60%_40%] gap-0 ${i % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                        <div className="p-3 flex items-center border-r border-slate-700/30">
                            <p className="text-[10px] font-bold text-slate-300">{r.label}</p>
                        </div>
                        <div className="p-3 text-center flex items-center justify-center">
                            <p className="text-sm font-black text-white tabular-nums">{r.value}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    if (loading || !stats) {
        return (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <Loader2 className="animate-spin text-violet-500" size={48} />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Sincronizando vistas detalladas...</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">

            {/* LEFT COLUMN: Global, General, First, Second */}
            <div className="space-y-8">

                {/* GLOBAL TABLE */}
                <StandardTable
                    title="GLOBAL OVERVIEW"
                    icon={Activity}
                    colorClass="text-violet-500 bg-violet-500/10 border-violet-500/20"
                    rows={[
                        { label: 'Available Slots', value: fmtNum(stats.general.slots) },
                        { label: 'Scheduled Calls', value: fmtNum(stats.agendas.totals.scheduled) },
                        { label: 'Show Up Rate', value: fmtNum(stats.percentages.show_rate, true) },
                        { label: 'Sales Made', value: fmtNum(stats.sales.totals.count) },
                        { label: 'Close Rate [Taken Call]', value: fmtNum(stats.percentages.close_rate, true) },
                        { label: 'Close Rate [Ofert Made]', value: fmtNum(stats.percentages.offer_to_sale, true) },
                        { label: 'Ticket Promedio', value: fmtNum(calcDiv(stats.sales.totals.cash, stats.sales.totals.count), false, true) },
                        { label: 'Commission Earned (10%)', value: fmtNum(stats.sales.totals.cash * 0.10, false, true) },
                    ]}
                />

                {/* GENERAL TABLE */}
                <StandardTable
                    title="GENERAL METRICS"
                    icon={BarChart2}
                    colorClass="text-sky-500 bg-sky-500/10 border-sky-500/20"
                    rows={[
                        { label: 'Show Up Rate', value: fmtNum(stats.percentages.show_rate, true) },
                        { label: 'Presentation Rate', value: fmtNum(calcDiv(stats.general.offers_made, stats.agendas.totals.attended, true), true) },
                        { label: 'Cancelation Rate', value: fmtNum(stats.percentages.cancel_rate, true) },
                        { label: 'Reprogramation Rate', value: fmtNum(calcDiv(stats.agendas.totals.rescheduled, stats.agendas.totals.scheduled, true), true) },
                        { label: 'No Show Rate', value: fmtNum(stats.percentages.no_show_rate, true) },
                    ]}
                />

                {/* FIRST CALL TABLE */}
                <StandardTable
                    title="FIRST CALL"
                    icon={PhoneCall}
                    colorClass="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                    rows={[
                        { label: 'Show Up Rate', value: fmtNum(calcDiv(stats.agendas.first_call.attended, stats.agendas.first_call.scheduled, true), true) },
                        { label: 'No Show Rate', value: fmtNum(calcDiv(stats.agendas.first_call.no_show, stats.agendas.first_call.scheduled, true), true) },
                        { label: 'Cancelation Rate', value: fmtNum(calcDiv(stats.agendas.first_call.canceled, stats.agendas.first_call.scheduled, true), true) },
                        { label: 'Reprogramation Rate', value: fmtNum(calcDiv(stats.agendas.first_call.rescheduled, stats.agendas.first_call.scheduled, true), true) },
                    ]}
                />

                {/* SECOND CALL TABLE */}
                <StandardTable
                    title="SECOND CALL"
                    icon={PhoneCall}
                    colorClass="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                    rows={[
                        { label: 'Show Up Rate', value: fmtNum(calcDiv(stats.agendas.second_call.attended, stats.agendas.second_call.scheduled, true), true) },
                        { label: 'No Show Rate', value: fmtNum(calcDiv(stats.agendas.second_call.no_show, stats.agendas.second_call.scheduled, true), true) },
                        { label: 'Cancelation Rate', value: fmtNum(calcDiv(stats.agendas.second_call.canceled, stats.agendas.second_call.scheduled, true), true) },
                        { label: 'Reprogramation Rate', value: fmtNum(calcDiv(stats.agendas.second_call.rescheduled, stats.agendas.second_call.scheduled, true), true) },
                    ]}
                />

            </div>

            {/* RIGHT COLUMN: Close Rate, Type of Close, Follow Ups */}
            <div className="space-y-8">

                {/* CLOSE RATE TABLE */}
                <StandardTable
                    title="CLOSE RATES"
                    icon={Target}
                    colorClass="text-amber-500 bg-amber-500/10 border-amber-500/20"
                    rows={[
                        { label: '% Cierres x Total Agendas', value: fmtNum(calcDiv(stats.sales.totals.count, stats.agendas.totals.scheduled, true), true) },
                        { label: '% Cierres x Asistencias (Close Rate)', value: fmtNum(stats.percentages.close_rate, true) },
                        { label: '% Cierres x Presentación', value: fmtNum(stats.percentages.offer_to_sale, true) },
                    ]}
                />

                {/* TYPE OF CLOSE TABLE */}
                <StandardTable
                    title="TYPE OF CLOSE"
                    icon={TrendingUp}
                    colorClass="text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20"
                    rows={[
                        { label: 'On call', value: fmtNum(calcDiv(stats.sales.totals.in_call_count, stats.sales.totals.count, true), true) },
                        { label: 'Follow Up', value: fmtNum(calcDiv(stats.sales.totals.count - stats.sales.totals.in_call_count, stats.sales.totals.count, true), true) },
                    ]}
                />

                {/* FOLLOW UPS TABLE */}
                <StandardTable
                    title="FOLLOW UPS"
                    icon={Users}
                    colorClass="text-blue-500 bg-blue-500/10 border-blue-500/20"
                    rows={[
                        { label: 'Total Seguimientos Enviados', value: fmtNum(stats.follow_ups?.sent, false) },
                        { label: 'Total Seguimientos Respondidos', value: fmtNum(stats.follow_ups?.replied, false) },
                        { label: 'Respond Rate - Gral', value: fmtNum(stats.percentages.respond_rate, true) },
                    ]}
                />

                {/* Note / Disclamer */}
                <div className="bg-slate-800/40 p-6 border border-slate-700/50 rounded-[2rem] flex items-start gap-4">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-500 shrink-0">
                        <Info size={20} />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Aviso de Integración</h4>
                        <p className="text-xs text-slate-300 whitespace-pre-line">
                            Los datos de seguimiento (<strong className="text-white">Follow Ups</strong>) provienen de fuentes externas que aún no se encuentran integradas al modelo actual del reporte diario de closers.
                        </p>
                    </div>
                </div>

            </div>

        </div>
    );
};

export default CloserAdvancedStatsView;
