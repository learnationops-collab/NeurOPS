import React from 'react';
import { CircleDollarSign, TrendingUp, Gauge, Users, CalendarDays, Award } from 'lucide-react';
import InfoTooltip from '../../../../components/ui/InfoTooltip';

// Tarjeta KPI individual — vocabulario visual de la referencia (.kpi-card / .kpi-head / .kpi-foot)
const KpiCard = ({ label, value, icon: Icon, subtitle, badge, ayuda }) => (
    <article className="kpi-card">
        <div className="kpi-head">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {label}
                {ayuda && <InfoTooltip label={label} text={ayuda} />}
            </span>
            <Icon size={18} aria-hidden="true" />
        </div>
        <strong>{value}</strong>
        <div className="kpi-foot">
            <span>{subtitle}</span>
            {badge && <b className={`status ${badge.tone}`}>{badge.text}</b>}
        </div>
    </article>
);

const WorkshopKpiCards = ({ totalStats, eventsCount }) => {
    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

    const netProfit = totalStats.cash - totalStats.inversion;
    const profitMargin = totalStats.cash > 0 ? ((netProfit / totalStats.cash) * 100).toFixed(1) : '0';
    const cplAvg = totalStats.leads > 0 ? totalStats.inversion / totalStats.leads : 0;
    const cpaAvg = totalStats.agendas > 0 ? totalStats.inversion / totalStats.agendas : 0;
    const cacAvg = totalStats.sales > 0 ? totalStats.inversion / totalStats.sales : 0;
    const ticketAvg = totalStats.sales > 0 ? totalStats.cash / totalStats.sales : 0;

    let roasBadge = { text: 'Sin datos', tone: 'warning' };
    if (totalStats.roas >= 3.0) {
        roasBadge = { text: 'Sobresaliente', tone: 'success' };
    } else if (totalStats.roas >= 1.5) {
        roasBadge = { text: 'Saludable', tone: 'success' };
    } else if (totalStats.roas > 0) {
        roasBadge = { text: 'En riesgo', tone: 'warning' };
    }

    return (
        <section className="kpi-grid" aria-label="Indicadores principales">
            <KpiCard
                label="Inversión ads"
                ayuda="Cuánta plata se gastó en publicidad para estos workshops. Es el dinero que sale."
                value={formatCurrency(totalStats.inversion)}
                icon={CircleDollarSign}
                subtitle={`Promedio ${formatCurrency(eventsCount ? totalStats.inversion / eventsCount : 0)}`}
            />
            <KpiCard
                label="Cash collected"
                ayuda="Cuánta plata entró de verdad a la cuenta (no lo prometido ni lo facturado: lo cobrado). Beneficio neto = cobrado menos inversión en ads."
                value={formatCurrency(totalStats.cash)}
                icon={TrendingUp}
                subtitle={`Neto ${formatCurrency(netProfit)} (${profitMargin}%)`}
            />
            <KpiCard
                label="ROAS global"
                ayuda="Por cada $1 gastado en publicidad, cuántos dólares volvieron. 1x es empatar; arriba de 3x va muy bien. Ticket promedio = cuánto deja en promedio cada persona que compra."
                value={`${totalStats.roas.toFixed(2)}x`}
                icon={Gauge}
                subtitle={`Ticket prom. ${formatCurrency(ticketAvg)}`}
                badge={roasBadge}
            />
            <KpiCard
                label="Leads & CPL"
                ayuda="Personas que se registraron al workshop. CPL = cuánto costó conseguir cada una (inversión ÷ leads)."
                value={totalStats.leads.toLocaleString()}
                icon={Users}
                subtitle={`CPL ${formatCurrency(cplAvg)}`}
            />
            <KpiCard
                label="Agendas & CPA"
                ayuda="Llamadas de venta agendadas, sumando las que salen de la clase en vivo y las de la grabación. CPA = cuánto costó conseguir cada agenda."
                value={totalStats.agendas.toLocaleString()}
                icon={CalendarDays}
                subtitle={`CPA ${formatCurrency(cpaAvg)}`}
            />
            <KpiCard
                label="Ventas & CAC"
                ayuda="Personas distintas que compraron (no transacciones: si alguien paga en dos partes cuenta una sola vez). CAC = cuánto costó en publicidad conseguir cada cliente."
                value={totalStats.sales.toLocaleString()}
                icon={Award}
                subtitle={`CAC ${formatCurrency(cacAvg)}`}
            />
        </section>
    );
};

export default WorkshopKpiCards;
