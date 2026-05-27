import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Loader2, MessageSquare, Reply, Users, CalendarDays,
  DollarSign, Settings2, Filter, ChevronDown, HelpCircle, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import MessageManagerModal from './MessageManagerModal';

// ── Períodos rápidos ──
const PERIODS = [
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'last_7', label: '7D' },
  { key: 'this_month', label: 'Este Mes' },
  { key: 'custom', label: 'Personalizado' }
];

const CATEGORIES = [
  { value: 'all', label: 'Todas' },
  { value: 'cualificacion', label: 'Cualificación', color: '#60a5fa' },
  { value: 'dolor', label: 'Dolor', color: '#f87171' },
  { value: 'seguimiento', label: 'Seguimiento', color: '#fbbf24' }
];

const CAT_COLORS = {
  cualificacion: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  dolor: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
  seguimiento: 'text-amber-400 bg-amber-400/10 border-amber-400/20'
};

// ── Helpers ──
const pct = (a, b) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '0%');
const fmt = (n) => (n ?? 0).toLocaleString();

// ──────────────────────────────────────────────────────────
const SetterStatisticsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [ads, setAds] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Filtros
  const [period, setPeriod] = useState('last_7');
  const [category, setCategory] = useState('all');
  const [adId, setAdId] = useState('');
  const [customRange, setCustomRange] = useState({
    start: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchAds();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [period, category, adId, customRange]);

  const fetchAds = async () => {
    try {
      const res = await api.get('/marketing/ads');
      setAds(res.data || []);
    } catch {
      setAds([]);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = { category: category !== 'all' ? category : undefined };
      if (adId) params.ad_id = adId;

      if (period === 'custom') {
        params.start_date = customRange.start;
        params.end_date = customRange.end;
      } else {
        params.period = period;
      }

      const res = await api.get('/conversational/stats/conversational', { params });
      setData(res.data);
    } catch (err) {
      console.error('[ConversationalStats] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const kpis = data?.kpis || {};
  const table = data?.table || [];

  // Totales para la fila de pie
  const totals = useMemo(() => ({
    sends: table.reduce((s, r) => s + r.total_sends, 0),
    responses: table.reduce((s, r) => s + r.total_responses, 0),
    leads: table.reduce((s, r) => s + r.leads_generated, 0),
    agendas: table.reduce((s, r) => s + r.agendas, 0),
    ventas: table.reduce((s, r) => s + r.ventas, 0)
  }), [table]);

  return (
    <div className="min-h-screen text-base p-4 md:p-10 font-main selection:bg-primary/20 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* ── Header ── */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-base pb-8">
          <div className="space-y-4">
            <button
              onClick={() => navigate('/setter/report')}
              className="flex items-center gap-2 text-primary hover:text-white transition-all group border border-primary/30 px-4 py-2 rounded-full hover:bg-primary/10 text-[10px] font-black uppercase tracking-widest"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
              Reporte Diario
            </button>
            <div className="flex items-center gap-5">
              <div className="p-4 bg-primary/10 rounded-[2rem] text-primary border border-primary/20 shadow-lg shadow-primary/5">
                <MessageSquare size={28} />
              </div>
              <div>
                <h1 className="text-4xl font-black italic tracking-tighter uppercase text-base leading-none">
                  Rendimiento <span className="text-primary underline decoration-primary/20 underline-offset-8">Conversacional</span>
                </h1>
                <p className="text-[10px] font-black text-muted uppercase tracking-[0.3em] mt-2">
                  Analítica de Mensajes ManyChat
                </p>
              </div>
            </div>
          </div>
          {/* Botón gestionar mensajes */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-primary/10 text-primary border border-primary/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all shadow-lg shadow-primary/5"
          >
            <Settings2 size={14} /> Gestionar Mensajes
          </button>
        </header>

        {/* ── Filtros ── */}
        <FilterBar
          period={period} setPeriod={setPeriod}
          category={category} setCategory={setCategory}
          adId={adId} setAdId={setAdId}
          ads={ads}
          customRange={customRange} setCustomRange={setCustomRange}
          loading={loading}
        />

        {/* ── Contenido ── */}
        {loading && !data ? (
          <div className="h-[40vh] flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-primary" size={48} />
            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Calculando métricas...</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
            {/* KPI Cards */}
            <KPIGrid kpis={kpis} />

            {/* Tabla de mensajes */}
            <MessageTable rows={table} totals={totals} loading={loading} />
          </motion.div>
        )}
      </div>

      {/* Modal Gestión */}
      <MessageManagerModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); fetchStats(); }}
      />
    </div>
  );
};

// ──────────────────────────────────────────────────────────
// FILTROS
// ──────────────────────────────────────────────────────────
const FilterBar = ({ period, setPeriod, category, setCategory, adId, setAdId, ads, customRange, setCustomRange, loading }) => (
  <div className="flex flex-wrap items-center gap-3 p-4 bg-surface border border-base rounded-2xl shadow-xl">
    <Filter size={14} className="text-muted ml-1" />

    {/* Períodos */}
    <div className="flex items-center gap-1 bg-main/30 p-1 rounded-xl">
      {PERIODS.map(p => (
        <button
          key={p.key}
          onClick={() => setPeriod(p.key)}
          className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
            period === p.key ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:text-base'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>

    {/* Fechas personalizadas */}
    <AnimatePresence>
      {period === 'custom' && (
        <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }}
          className="flex items-center gap-2 overflow-hidden"
        >
          <input type="date" value={customRange.start} onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))}
            className="bg-surface border border-base text-[9px] font-black text-base rounded-xl px-3 py-1.5 focus:outline-none focus:border-primary/50" />
          <span className="text-muted text-xs">—</span>
          <input type="date" value={customRange.end} onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))}
            className="bg-surface border border-base text-[9px] font-black text-base rounded-xl px-3 py-1.5 focus:outline-none focus:border-primary/50" />
        </motion.div>
      )}
    </AnimatePresence>

    <div className="w-px h-5 bg-base" />

    {/* Categoría */}
    <div className="flex items-center gap-1">
      {CATEGORIES.map(c => (
        <button
          key={c.value}
          onClick={() => setCategory(c.value)}
          className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl border transition-all ${
            category === c.value
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'text-muted border-transparent hover:border-base/50 hover:text-base'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>

    <div className="w-px h-5 bg-base" />

    {/* Anuncio */}
    <div className="relative">
      <select
        value={adId}
        onChange={e => setAdId(e.target.value)}
        className="appearance-none bg-surface border border-base text-[9px] font-black text-base rounded-xl pl-3 pr-8 py-1.5 focus:outline-none focus:border-primary/50 cursor-pointer"
      >
        <option value="">Todos los Anuncios</option>
        {ads.map(ad => (
          <option key={ad.id} value={ad.id}>{ad.name}</option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
    </div>

    {loading && <Loader2 size={14} className="animate-spin text-primary ml-auto" />}
  </div>
);

// ──────────────────────────────────────────────────────────
// KPI GRID
// ──────────────────────────────────────────────────────────
const KPIGrid = ({ kpis }) => {
  const cards = [
    {
      label: 'Mensajes Enviados',
      value: fmt(kpis.total_sends),
      sub: `~${kpis.daily_avg_sends ?? 0}/día promedio`,
      icon: <MessageSquare size={18} />,
      tooltip: 'Total de id_option_send únicos registrados en el período.'
    },
    {
      label: 'Respuestas Totales',
      value: fmt(kpis.total_responses),
      sub: `Tasa: ${kpis.global_response_rate ?? 0}%`,
      icon: <Reply size={18} />,
      tooltip: 'Leads que respondieron (id_option). Tasa = Respuestas / Enviados.'
    },
    {
      label: 'Leads Generados',
      value: fmt(kpis.total_leads),
      sub: `Cualificación: ${kpis.global_qualification_rate ?? 0}%`,
      icon: <Users size={18} />,
      tooltip: 'Leads con cualificacion = true entre los que respondieron.',
      highlight: true
    },
    {
      label: 'Agendas',
      value: fmt(kpis.total_agendas),
      sub: `Tasa: ${kpis.agenda_rate ?? 0}%`,
      icon: <CalendarDays size={18} />,
      tooltip: 'Agendas atribuidas por IG del lead en el período.'
    },
    {
      label: 'Ventas',
      value: fmt(kpis.total_ventas),
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
        {cards.map((c, i) => <KPICard key={i} {...c} />)}
      </div>
    </div>
  );
};

const KPICard = ({ label, value, sub, icon, tooltip, highlight }) => (
  <Card variant="surface" className={`p-6 border-base/50 shadow-xl border-b-4 transition-all hover:-translate-y-1 group overflow-visible ${highlight ? 'border-primary shadow-primary/5' : 'border-base'}`}>
    <div className="flex justify-between items-start mb-5">
      <span className={`p-2.5 rounded-xl text-sm border border-white/5 transition-all duration-300 group-hover:scale-110 ${highlight ? 'bg-primary/20 text-primary' : 'bg-surface-hover/50 text-muted'}`}>
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
    <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${highlight ? 'text-primary' : 'text-muted'}`}>{label}</p>
    <p className="text-3xl font-black italic tracking-tighter text-base">{value}</p>
    <p className="text-[9px] text-muted font-bold mt-1.5">{sub}</p>
  </Card>
);

// ──────────────────────────────────────────────────────────
// TABLA DE MENSAJES
// ──────────────────────────────────────────────────────────
const MessageTable = ({ rows, totals, loading }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <SectionTitle>Rendimiento por Mensaje</SectionTitle>
      {loading && <Loader2 size={14} className="animate-spin text-primary" />}
    </div>

    <Card variant="surface" padding="p-0" className="border-base/50 overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-main/20 border-b border-base">
            <tr>
              {['#', 'ID / Título', 'Enviados', '% Total', 'Respuestas', 'Tasa Resp.', 'Leads', 'Agendas', 'Ventas'].map(h => (
                <th key={h} className="px-5 py-4 text-[8px] font-black text-muted uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-base/20">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-16 text-center">
                  <MessageSquare className="mx-auto text-muted/20 mb-3" size={32} />
                  <p className="text-[10px] font-black text-muted/40 uppercase tracking-widest">Sin datos para los filtros seleccionados</p>
                </td>
              </tr>
            ) : rows.map((row, i) => (
              <MessageRow key={row.message_id} row={row} index={i + 1} totalSends={totals.sends} />
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-primary/20 bg-primary/5">
              <tr>
                <td className="px-5 py-4 text-[9px] font-black text-primary uppercase tracking-widest" colSpan={2}>TOTALES</td>
                <td className="px-5 py-4 text-xs font-black text-base font-mono">{fmt(totals.sends)}</td>
                <td className="px-5 py-4 text-[10px] font-black text-primary">100%</td>
                <td className="px-5 py-4 text-xs font-black text-base font-mono">{fmt(totals.responses)}</td>
                <td className="px-5 py-4 text-[10px] font-black text-primary">{pct(totals.responses, totals.sends)}</td>
                <td className="px-5 py-4 text-xs font-black text-base font-mono">{fmt(totals.leads)}</td>
                <td className="px-5 py-4 text-xs font-black text-base font-mono">{fmt(totals.agendas)}</td>
                <td className="px-5 py-4 text-xs font-black text-base font-mono">{fmt(totals.ventas)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  </div>
);

const MessageRow = ({ row, index, totalSends }) => {
  const catClass = CAT_COLORS[row.category] || 'text-muted bg-muted/10 border-muted/20';
  const catLabel = CATEGORIES.find(c => c.value === row.category)?.label;
  const responseRate = row.response_rate;
  const barColor = responseRate >= 50 ? 'bg-primary' : responseRate >= 25 ? 'bg-amber-400' : 'bg-rose-400';

  return (
    <tr className="hover:bg-primary/5 transition-all group">
      {/* # */}
      <td className="px-5 py-4 text-[9px] font-bold text-muted/40">{index}</td>

      {/* ID / Título con tooltip del body */}
      <td className="px-5 py-4 max-w-[220px]">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black text-base truncate group-hover:text-primary transition-colors">
                {row.title}
              </p>
              {row.category && (
                <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border flex-shrink-0 ${catClass}`}>
                  {catLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[8px] text-muted font-mono truncate">{row.message_id}</p>
              {!row.is_configured && (
                <span className="text-[7px] font-black uppercase text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  Sin configurar
                </span>
              )}
            </div>
          </div>
          {/* Tooltip del body */}
          {row.body && (
            <div className="relative group/body flex-shrink-0">
              <HelpCircle size={11} className="text-muted/30 cursor-help hover:text-primary transition-colors" />
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 bg-surface border border-base text-[10px] font-medium text-base rounded-xl p-3 opacity-0 group-hover/body:opacity-100 transition-all pointer-events-none shadow-xl z-50 leading-relaxed">
                {row.body}
              </div>
            </div>
          )}
        </div>
      </td>

      {/* Enviados */}
      <td className="px-5 py-4 text-xs font-black font-mono text-base">{fmt(row.total_sends)}</td>

      {/* % del total */}
      <td className="px-5 py-4">
        <Badge variant="primary" className="text-[9px] px-2 py-0.5 font-mono">{row.pct_of_total_sends}%</Badge>
      </td>

      {/* Respuestas + barra */}
      <td className="px-5 py-4 text-xs font-black font-mono text-base">{fmt(row.total_responses)}</td>

      {/* Tasa de respuesta con barra */}
      <td className="px-5 py-4 min-w-[120px]">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-base">{responseRate}%</span>
          </div>
          <div className="h-1.5 bg-surface-hover/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(responseRate, 100)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`h-full rounded-full ${barColor}`}
            />
          </div>
        </div>
      </td>

      {/* Leads */}
      <td className="px-5 py-4">
        <div>
          <p className="text-xs font-black font-mono text-base">{fmt(row.leads_generated)}</p>
          <p className="text-[8px] text-muted">{row.qualification_rate}% cual.</p>
        </div>
      </td>

      {/* Agendas */}
      <td className="px-5 py-4">
        <div>
          <p className="text-xs font-black font-mono text-base">{fmt(row.agendas)}</p>
          <p className="text-[8px] text-muted">{row.agenda_rate}% agenda</p>
        </div>
      </td>

      {/* Ventas */}
      <td className="px-5 py-4">
        <div>
          <p className="text-xs font-black font-mono text-base">{fmt(row.ventas)}</p>
          <p className="text-[8px] text-muted">{row.venta_rate}% cierre</p>
        </div>
      </td>
    </tr>
  );
};

// ──────────────────────────────────────────────────────────
// HELPERS UI
// ──────────────────────────────────────────────────────────
const SectionTitle = ({ children }) => (
  <div className="flex items-center gap-4">
    <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted whitespace-nowrap">{children}</h2>
    <div className="h-px bg-base flex-1" />
  </div>
);

export default SetterStatisticsPage;
