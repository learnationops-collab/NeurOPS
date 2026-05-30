import { MessageSquare, Reply, Users, CalendarDays, DollarSign, HelpCircle } from 'lucide-react';
import Card from '../../../components/ui/Card';

const fmt = (n) => (n ?? 0).toLocaleString();

const KPIGrid = ({ kpis, comparisonKpis, compareActive }) => {
  const cards = [
    {
      label: 'Mensajes Enviados',
      value: fmt(kpis.total_sends),
      valuePrev: comparisonKpis?.total_sends,
      sub: `~${kpis.daily_avg_sends ?? 0}/día promedio`,
      icon: <MessageSquare size={18} />,
      tooltip: 'Total de id_option_send únicos registrados en el período.'
    },
    {
      label: 'Respuestas Totales',
      value: fmt(kpis.total_responses),
      valuePrev: comparisonKpis?.total_responses,
      sub: `Tasa: ${kpis.global_response_rate ?? 0}%`,
      icon: <Reply size={18} />,
      tooltip: 'Leads que respondieron (id_option). Tasa = Respuestas / Enviados.'
    },
    {
      label: 'Leads Generados',
      value: fmt(kpis.total_leads),
      valuePrev: comparisonKpis?.total_leads,
      sub: `Cualificación: ${kpis.global_qualification_rate ?? 0}%`,
      icon: <Users size={18} />,
      tooltip: 'Leads con cualificacion = true entre los que respondieron.',
      highlight: true
    },
    {
      label: 'Agendas',
      value: fmt(kpis.total_agendas),
      valuePrev: comparisonKpis?.total_agendas,
      sub: `Tasa: ${kpis.agenda_rate ?? 0}%`,
      icon: <CalendarDays size={18} />,
      tooltip: 'Agendas atribuidas por IG del lead en el período.'
    },
    {
      label: 'Ventas',
      value: fmt(kpis.total_ventas),
      valuePrev: comparisonKpis?.total_ventas,
      sub: `vs Agendas: ${kpis.venta_rate_from_agendas ?? 0}%`,
      icon: <DollarSign size={18} />,
      tooltip: 'Ventas atribuidas a leads del período. Tasa = Ventas / Agendas.',
      highlight: true
    }
  ];

  return (
    <div className="space-y-4">
      <SectionTitle>KPIs del Período</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c, i) => (
          <KPICard key={i} {...c} compareActive={compareActive} />
        ))}
      </div>
    </div>
  );
};

const KPICard = ({ label, value, sub, icon, tooltip, highlight, valuePrev, compareActive }) => {
  const change = (() => {
    if (!compareActive || valuePrev === undefined || valuePrev === null) return null;

    const parseNum = (val) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val.replace(/,/g, '')) || 0;
      return 0;
    };

    const curVal = parseNum(value);
    const prevVal = parseNum(valuePrev);

    if (prevVal === 0) {
      return curVal > 0
        ? { pct: '+100%', color: 'text-emerald-400', label: 'vs período anterior (0)' }
        : { pct: '0%', color: 'text-muted', label: 'vs período anterior (0)' };
    }

    const diff = ((curVal - prevVal) / prevVal) * 100;
    const sign = diff > 0 ? '+' : '';
    const color = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-muted';

    return {
      pct: `${sign}${diff.toFixed(1)}%`,
      color,
      label: `Anterior: ${prevVal.toLocaleString()}`
    };
  })();

  return (
    <Card
      variant="surface"
      className={`p-6 border-base/50 shadow-xl border-b-4 transition-all hover:-translate-y-1 group overflow-visible ${
        highlight ? 'border-primary shadow-primary/5' : 'border-base'
      }`}
    >
      <div className="flex justify-between items-start mb-5">
        <span
          className={`p-2.5 rounded-xl text-sm border border-white/5 transition-all duration-300 group-hover:scale-110 ${
            highlight ? 'bg-primary/20 text-primary' : 'bg-surface-hover/50 text-muted'
          }`}
        >
          {icon}
        </span>
        {tooltip && (
          <div className="relative group/tip">
            <HelpCircle size={11} className="text-muted/40 cursor-help hover:text-primary transition-colors" />
            <div className="absolute bottom-full right-0 mb-2 w-52 bg-surface border border-base text-base text-[10px] font-medium rounded-xl p-3 opacity-0 group-hover/tip:opacity-100 transition-all pointer-events-none shadow-xl z-50">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${highlight ? 'text-primary' : 'text-muted'}`}>
        {label}
      </p>
      <p className="text-3xl font-black italic tracking-tighter text-base">{value}</p>
      <p className="text-[9px] text-muted font-bold mt-1.5">{sub}</p>

      {change && (
        <div className="mt-3 pt-3 border-t border-base/20 flex flex-col gap-0.5">
          <span className={`text-[10px] font-black tracking-wider ${change.color}`}>{change.pct}</span>
          <span className="text-[9px] text-muted font-semibold">{change.label}</span>
        </div>
      )}
    </Card>
  );
};

const SectionTitle = ({ children }) => (
  <div className="flex items-center gap-4">
    <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted whitespace-nowrap">{children}</h2>
    <div className="h-px bg-base flex-1" />
  </div>
);

export default KPIGrid;
