import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Loader2, MessageSquare, Settings2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import MessageManagerModal from './MessageManagerModal';
import FilterBar from './FilterBar';
import KPIGrid from './KPIGrid';
import MessageTable from './MessageTable';

const SetterStatisticsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [ads, setAds] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Filtros y Comparación
  const [period, setPeriod] = useState('last_7');
  const [category, setCategory] = useState('all');
  const [adId, setAdId] = useState('');
  const [compare, setCompare] = useState(false);
  const [customRange, setCustomRange] = useState({
    start: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchAds();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [period, category, adId, customRange, compare]);

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
      if (compare) params.compare = 'true';

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

  // Totales para la fila del pie de la tabla
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
          period={period}
          setPeriod={setPeriod}
          category={category}
          setCategory={setCategory}
          adId={adId}
          setAdId={setAdId}
          ads={ads}
          customRange={customRange}
          setCustomRange={setCustomRange}
          loading={loading}
          compare={compare}
          setCompare={setCompare}
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
            <KPIGrid kpis={kpis} comparisonKpis={data?.comparison?.kpis} compareActive={compare} />

            {/* Tabla de mensajes */}
            <MessageTable
              rows={table}
              totals={totals}
              loading={loading}
              compareActive={compare}
              comparisonTable={data?.comparison?.table}
              comparisonKpis={data?.comparison?.kpis}
            />
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

export default SetterStatisticsPage;
