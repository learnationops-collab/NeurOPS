import React from 'react';
import { DollarSign, TrendingUp, Activity, Target, Award, Wallet } from 'lucide-react';
import InfoTooltip from '../../../../components/ui/InfoTooltip';

// Tarjeta KPI individual ejecutiva
const ExecutiveStatCard = ({ label, value, icon: Icon, colorClass, subtitle, badge, ayuda }) => (
    <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-3xl relative overflow-hidden group hover:border-slate-700/80 transition-all duration-300">
        <div className="absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-10 bg-indigo-500 group-hover:opacity-20 transition-opacity" />
        <div className="flex justify-between items-start relative z-10">
            <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none flex items-center gap-1.5">
                    {label}
                    {ayuda && <InfoTooltip label={label} text={ayuda} />}
                </p>
                <p className="text-2xl md:text-3xl font-black text-white italic tracking-tighter">{value}</p>
                {subtitle && <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{subtitle}</p>}
            </div>
            <div className="flex flex-col items-end gap-2">
                <div className={`p-3 rounded-2xl bg-slate-950 border border-slate-800 ${colorClass}`}>
                    <Icon size={20} />
                </div>
                {badge && (
                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border ${badge.color}`}>
                        {badge.text}
                    </span>
                )}
            </div>
        </div>
    </div>
);

const WorkshopKpiCards = ({ totalStats, eventsCount }) => {
    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

    const netProfit = totalStats.cash - totalStats.inversion;
    const profitMargin = totalStats.cash > 0 ? ((netProfit / totalStats.cash) * 100).toFixed(1) : '0';
    const cplAvg = totalStats.leads > 0 ? totalStats.inversion / totalStats.leads : 0;
    const cpaAvg = totalStats.agendas > 0 ? totalStats.inversion / totalStats.agendas : 0;
    const cacAvg = totalStats.sales > 0 ? totalStats.inversion / totalStats.sales : 0;
    const ticketAvg = totalStats.sales > 0 ? totalStats.cash / totalStats.sales : 0;

    let roasBadge = { text: 'Sin Datos', color: 'bg-slate-800 text-slate-400 border-slate-700' };
    if (totalStats.roas >= 3.0) {
        roasBadge = { text: '🔥 Sobresaliente', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    } else if (totalStats.roas >= 1.5) {
        roasBadge = { text: '🟢 Saludable', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
    } else if (totalStats.roas > 0) {
        roasBadge = { text: '⚠️ En Riesgo', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <ExecutiveStatCard
                    label="Inversión Ads"
                    ayuda="Cuánta plata se gastó en publicidad para estos workshops. Es el dinero que sale."
                    value={formatCurrency(totalStats.inversion)}
                    icon={DollarSign}
                    colorClass="text-slate-400"
                    subtitle={`Promedio: ${formatCurrency(eventsCount ? totalStats.inversion / eventsCount : 0)}`}
                />
                <ExecutiveStatCard
                    label="Cash Collected"
                    ayuda="Cuánta plata entró de verdad a la cuenta (no lo prometido ni lo facturado: lo cobrado). Beneficio neto = cobrado menos inversión en ads."
                    value={formatCurrency(totalStats.cash)}
                    icon={Wallet}
                    colorClass="text-emerald-400"
                    subtitle={`Beneficio Neto: ${formatCurrency(netProfit)} (${profitMargin}%)`}
                />
                <ExecutiveStatCard
                    label="ROAS Global"
                    ayuda="Por cada $1 gastado en publicidad, cuántos dólares volvieron. 1x es empatar; arriba de 3x va muy bien. Ticket promedio = cuánto deja en promedio cada persona que compra."
                    value={`${totalStats.roas.toFixed(2)}x`}
                    icon={TrendingUp}
                    colorClass={totalStats.roas >= 3 ? "text-emerald-400" : totalStats.roas >= 1.5 ? "text-indigo-400" : "text-amber-400"}
                    subtitle={`Ticket Prom: ${formatCurrency(ticketAvg)}`}
                    badge={roasBadge}
                />
                <ExecutiveStatCard
                    label="Leads & CPL"
                    ayuda="Personas que se registraron al workshop. CPL = cuánto costó conseguir cada una (inversión ÷ leads)."
                    value={totalStats.leads.toLocaleString()}
                    icon={Activity}
                    colorClass="text-indigo-400"
                    subtitle={`CPL Promedio: ${formatCurrency(cplAvg)}`}
                />
                <ExecutiveStatCard
                    label="Agendas & CPA"
                    ayuda="Llamadas de venta agendadas, sumando las que salen de la clase en vivo y las de la grabación. CPA = cuánto costó conseguir cada agenda."
                    value={totalStats.agendas.toLocaleString()}
                    icon={Target}
                    colorClass="text-sky-400"
                    subtitle={`CPA Promedio: ${formatCurrency(cpaAvg)}`}
                />
                <ExecutiveStatCard
                    label="Ventas & CAC"
                    ayuda="Personas distintas que compraron (no transacciones: si alguien paga en dos partes cuenta una sola vez). CAC = cuánto costó en publicidad conseguir cada cliente."
                    value={totalStats.sales.toLocaleString()}
                    icon={Award}
                    colorClass="text-purple-400"
                    subtitle={`CAC Promedio: ${formatCurrency(cacAvg)}`}
                />
            </div>
        </div>
    );
};

export default WorkshopKpiCards;
