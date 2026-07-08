import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Reply, Users, Target, CalendarDays, TrendingUp,
  RefreshCw, Settings2, HelpCircle, Info, Calendar, ChevronDown, Loader2, Plus, Eye
} from 'lucide-react';
import api from '../../services/api';
import MessageManagerModal from '../setter/dashboard/MessageManagerModal';
import StatTooltip from '../../components/shared/StatTooltip';

// ── Helpers de formato ──
const pct = (a, b) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '0.0%');
const fmt = (n) => (n ?? 0).toLocaleString();

const getResponseRateColor = (rate) => {
  if (rate < 15) return { text: 'text-rose-400', progress: 'bg-gradient-to-r from-rose-500 to-rose-400' };
  if (rate < 30) return { text: 'text-amber-400', progress: 'bg-gradient-to-r from-amber-500 to-amber-400' };
  return { text: 'text-emerald-400', progress: 'bg-gradient-to-r from-emerald-500 to-emerald-400' };
};

const ConversationalStatsTab = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [ads, setAds] = useState([]);
  const [showManager, setShowManager] = useState(false);
  const [initialMessageId, setInitialMessageId] = useState(null);
  const [initialCategory, setInitialCategory] = useState('cualificacion');

  const handleConfigureMessage = (messageId, category) => {
    setInitialMessageId(messageId);
    setInitialCategory(category || 'cualificacion');
    setShowManager(true);
  };

  // Filtros principales y comparación
  const [period, setPeriod] = useState('this_month'); // Default "Mes"
  const [category, setCategory] = useState('all');
  const [adId, setAdId] = useState('');
  const [compare, setCompare] = useState(false);
  const [customRange, setCustomRange] = useState({
    start: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
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

  const fetchStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = {};
      if (category !== 'all') params.category = category;
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
      console.error('[ConversationalStatsTab] Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const kpis = data?.kpis || {};
  const table = data?.table || [];

  // Mapear tabla anterior para las tablas de openings/seguimientos
  const comparisonMap = useMemo(() => {
    if (!data?.comparison?.table) return {};
    const map = {};
    data.comparison.table.forEach(row => {
      map[row.message_id] = row;
    });
    return map;
  }, [data]);

  // Dividir la tabla en Openings (Cualificación / Dolor) y Seguimientos (Seguimiento)
  const openings = useMemo(() => {
    return table.filter(row => row.category === 'cualificacion' || row.category === 'dolor' || !row.category);
  }, [table]);

  const seguimientos = useMemo(() => {
    return table.filter(row => row.category === 'seguimiento');
  }, [table]);

  // Totales Openings
  const totalOpenings = useMemo(() => {
    const sends = openings.reduce((acc, curr) => acc + curr.total_sends, 0);
    const responses = openings.reduce((acc, curr) => acc + curr.total_responses, 0);
    return { sends, responses };
  }, [openings]);

  // Totales Seguimientos
  const totalSeguimientos = useMemo(() => {
    const sends = seguimientos.reduce((acc, curr) => acc + curr.total_sends, 0);
    const responses = seguimientos.reduce((acc, curr) => acc + curr.total_responses, 0);
    return { sends, responses };
  }, [seguimientos]);

  // Totales globales para cálculo de porcentajes relativos
  const globalTotalSends = useMemo(() => {
    return table.reduce((acc, curr) => acc + curr.total_sends, 0);
  }, [table]);

  // Helper para variaciones
  const renderChange = (current, previous) => {
    if (!compare || previous === undefined || previous === null) return null;
    const curVal = typeof current === 'number' ? current : parseFloat(String(current).replace(/,/g, '')) || 0;
    const prevVal = typeof previous === 'number' ? previous : parseFloat(String(previous).replace(/,/g, '')) || 0;

    if (prevVal === 0) {
      return (
        <span className={`text-[9px] font-black uppercase ${curVal > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
          {curVal > 0 ? '+100%' : '0%'}
        </span>
      );
    }

    const diff = ((curVal - prevVal) / prevVal) * 100;
    const sign = diff > 0 ? '+' : '';
    const color = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-slate-500';

    return (
      <span className={`text-[9px] font-black uppercase ${color}`}>
        {sign}{diff.toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* ── HEADER DE SECCIÓN CON FILTROS ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-900/40 p-6 rounded-3xl border border-slate-800/80 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shadow-inner">
            <MessageSquare className="text-indigo-400" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-widest text-white italic">Rendimiento Conversacional</h3>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">
              Métricas de tus flujos de mensajes (independiente de los anuncios)
            </p>
          </div>
        </div>

        {/* Controles de Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Periodo Rápido */}
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800/80">
            {[
              { id: 'yesterday', label: 'Ayer' },
              { id: 'last_7', label: 'Semana' },
              { id: 'this_month', label: 'Mes' },
              { id: 'custom', label: 'Personalizado' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                  period === p.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Rango de Fecha Personalizado */}
          <AnimatePresence>
            {period === 'custom' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-2"
              >
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" size={12} />
                  <input
                    type="date"
                    value={customRange.start}
                    onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))}
                    className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-[10px] font-black text-white/70 outline-none focus:border-indigo-500 transition-all w-36"
                  />
                </div>
                <span className="text-slate-700 font-black text-xs">/</span>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" size={12} />
                  <input
                    type="date"
                    value={customRange.end}
                    onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))}
                    className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-[10px] font-black text-white/70 outline-none focus:border-indigo-500 transition-all w-36"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Selector de Anuncio (Filtro avanzado) */}
          <div className="relative">
            <select
              value={adId}
              onChange={e => setAdId(e.target.value)}
              className="appearance-none bg-slate-950 border border-slate-800 text-[10px] font-black text-slate-300 rounded-xl pl-4 pr-9 py-2.5 outline-none focus:border-indigo-500 cursor-pointer w-44"
            >
              <option value="">Todos los Anuncios</option>
              {ads.map(ad => (
                <option key={ad.id} value={ad.id}>{ad.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {/* Switch de Comparación */}
          <div className="flex items-center gap-2.5 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Comparar</span>
            <button
              onClick={() => setCompare(!compare)}
              type="button"
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                compare ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20' : 'bg-slate-900 border border-slate-800'
              }`}
            >
              <motion.span
                layout
                className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md"
                animate={{ x: compare ? 16 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          {/* Botones de acción */}
          <button
            onClick={() => setShowManager(true)}
            className="p-2.5 bg-slate-800 hover:bg-slate-750 text-indigo-400 hover:text-indigo-300 rounded-xl transition-all border border-slate-700/60 active:scale-95 shadow-lg flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest"
            title="Configurar Mensajes"
          >
            <Settings2 size={15} />
            <span className="hidden sm:inline">Configurar</span>
          </button>

          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="p-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl transition-all border border-slate-700/60 active:scale-95 shadow-lg"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="animate-spin text-indigo-500" size={40} />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Procesando métricas...</span>
        </div>
      ) : (
        <>
          {/* ── FILA DE 6 KPI CARDS ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            
            {/* Mensajes Recibidos (Enviados) */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-5 shadow-xl relative group hover:border-slate-700/50 transition-all flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mensajes recibidos</p>
                <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                  <MessageSquare size={14} />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-white italic tracking-tighter">
                  <StatTooltip
                    label="Mensajes Recibidos (ManyChat)"
                    value={fmt(kpis.total_sends)}
                    calculation="Suma total de mensajes iniciales y seguimientos enviados en las automatizaciones."
                  >
                    {fmt(kpis.total_sends)}
                  </StatTooltip>
                </h3>
                <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">
                  Prom. diario: <StatTooltip
                    label="Promedio Diario de Mensajes"
                    value={fmt(kpis.daily_avg_sends)}
                    calculation="Mensajes totales enviados divididos por el número de días en el periodo seleccionado."
                  >
                    {fmt(kpis.daily_avg_sends)}
                  </StatTooltip>
                </p>
                {compare && data?.comparison?.kpis && (
                  <div className="mt-2 pt-2 border-t border-slate-800/60 flex flex-col gap-0.5">
                    {renderChange(kpis.total_sends, data.comparison.kpis.total_sends)}
                    <span className="text-[8px] text-slate-500 font-bold uppercase">Anterior: {fmt(data.comparison.kpis.total_sends)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Respuestas Totales */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-5 shadow-xl relative group hover:border-slate-700/50 transition-all flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Respuestas totales</p>
                <div className="p-2 bg-pink-500/10 rounded-xl border border-pink-500/20 text-pink-400">
                  <Reply size={14} />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-white italic tracking-tighter">
                  <StatTooltip
                    label="Respuestas Totales"
                    value={fmt(kpis.total_responses)}
                    calculation="Suma total de respuestas recibidas de los prospectos."
                  >
                    {fmt(kpis.total_responses)}
                  </StatTooltip>
                </h3>
                <p className="text-[9px] text-pink-400 font-black uppercase mt-1">
                  Tasa de respuesta: <StatTooltip
                    label="Tasa Global de Respuesta"
                    value={`${kpis.global_response_rate}%`}
                    calculation="Proporción de respuestas sobre mensajes enviados. Fórmula: (Respuestas / Mensajes Enviados) * 100"
                  >
                    {kpis.global_response_rate}%
                  </StatTooltip>
                </p>
                {compare && data?.comparison?.kpis && (
                  <div className="mt-2 pt-2 border-t border-slate-800/60 flex flex-col gap-0.5">
                    {renderChange(kpis.total_responses, data.comparison.kpis.total_responses)}
                    <span className="text-[8px] text-slate-500 font-bold uppercase">Anterior: {fmt(data.comparison.kpis.total_responses)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Leads Generados */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-5 shadow-xl relative group hover:border-slate-700/50 transition-all flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Leads generados</p>
                <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                  <Users size={14} />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-white italic tracking-tighter">
                  <StatTooltip
                    label="Leads Generados"
                    value={fmt(kpis.total_responses)}
                    calculation="Cantidad de prospectos que interactuaron o iniciaron conversación."
                  >
                    {fmt(kpis.total_responses)}
                  </StatTooltip>
                </h3>
                <p className="text-[9px] text-blue-400 font-black uppercase mt-1">
                  Tasa de conversión: <StatTooltip
                    label="Tasa Conversión a Lead"
                    value={pct(kpis.total_responses, kpis.total_sends)}
                    calculation="Porcentaje de mensajes que derivaron en un lead interesado. Fórmula: (Leads Generados / Mensajes Enviados) * 100"
                  >
                    {pct(kpis.total_responses, kpis.total_sends)}
                  </StatTooltip>
                </p>
                {compare && data?.comparison?.kpis && (
                  <div className="mt-2 pt-2 border-t border-slate-800/60 flex flex-col gap-0.5">
                    {renderChange(kpis.total_responses, data.comparison.kpis.total_responses)}
                    <span className="text-[8px] text-slate-500 font-bold uppercase">Anterior: {fmt(data.comparison.kpis.total_responses)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Leads Cualificados */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-5 shadow-xl relative group hover:border-slate-700/50 transition-all flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Leads cualificados</p>
                <div className="p-2 bg-violet-500/10 rounded-xl border border-violet-500/20 text-violet-400">
                  <Target size={14} />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-white italic tracking-tighter">
                  <StatTooltip
                    label="Leads Cualificados"
                    value={fmt(kpis.total_leads)}
                    calculation="Prospectos confirmados que cumplen con los requisitos del cliente ideal."
                  >
                    {fmt(kpis.total_leads)}
                  </StatTooltip>
                </h3>
                <p className="text-[9px] text-violet-400 font-black uppercase mt-1">
                  Tasa de cualificación: <StatTooltip
                    label="Tasa de Cualificación"
                    value={`${kpis.global_qualification_rate}%`}
                    calculation="Porcentaje de leads cualificados sobre leads totales. Fórmula: (Leads Cualificados / Leads Generados) * 100"
                  >
                    {kpis.global_qualification_rate}%
                  </StatTooltip>
                </p>
                {compare && data?.comparison?.kpis && (
                  <div className="mt-2 pt-2 border-t border-slate-800/60 flex flex-col gap-0.5">
                    {renderChange(kpis.total_leads, data.comparison.kpis.total_leads)}
                    <span className="text-[8px] text-slate-500 font-bold uppercase">Anterior: {fmt(data.comparison.kpis.total_leads)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Agendas Generadas */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-5 shadow-xl relative group hover:border-slate-700/50 transition-all flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Agendas generadas</p>
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                  <CalendarDays size={14} />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-white italic tracking-tighter">
                  <StatTooltip
                    label="Agendas Generadas"
                    value={fmt(kpis.total_agendas)}
                    calculation="Total de citas agendadas registradas en el periodo."
                  >
                    {fmt(kpis.total_agendas)}
                  </StatTooltip>
                </h3>
                <p className="text-[9px] text-emerald-400 font-black uppercase mt-1">
                  Tasa de agenda: <StatTooltip
                    label="Tasa de Agenda"
                    value={`${kpis.agenda_rate}%`}
                    calculation="Porcentaje de leads cualificados que agendaron cita. Fórmula: (Agendas / Leads Cualificados) * 100"
                  >
                    {kpis.agenda_rate}%
                  </StatTooltip>
                </p>
                {compare && data?.comparison?.kpis && (
                  <div className="mt-2 pt-2 border-t border-slate-800/60 flex flex-col gap-0.5">
                    {renderChange(kpis.total_agendas, data.comparison.kpis.total_agendas)}
                    <span className="text-[8px] text-slate-500 font-bold uppercase">Anterior: {fmt(data.comparison.kpis.total_agendas)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ventas Generadas */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-5 shadow-xl relative group hover:border-slate-700/50 transition-all flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ventas generadas</p>
                <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                  <TrendingUp size={14} />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-white italic tracking-tighter">
                  <StatTooltip
                    label="Ventas Generadas"
                    value={fmt(kpis.total_ventas)}
                    calculation="Ventas totales originadas a partir de las agendas del periodo."
                  >
                    {fmt(kpis.total_ventas)}
                  </StatTooltip>
                </h3>
                <p className="text-[9px] text-amber-400 font-black uppercase mt-1">
                  Tasa de cierre: <StatTooltip
                    label="Tasa de Cierre"
                    value={`${kpis.venta_rate_from_agendas}%`}
                    calculation="Porcentaje de agendas completadas que se concretaron en ventas. Fórmula: (Ventas / Agendas) * 100"
                  >
                    {kpis.venta_rate_from_agendas}%
                  </StatTooltip>
                </p>
                {compare && data?.comparison?.kpis && (
                  <div className="mt-2 pt-2 border-t border-slate-800/60 flex flex-col gap-0.5">
                    {renderChange(kpis.total_ventas, data.comparison.kpis.total_ventas)}
                    <span className="text-[8px] text-slate-500 font-bold uppercase">Anterior: {fmt(data.comparison.kpis.total_ventas)}</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── RENDIMIENTO DE CONVERSACIONES (Doble Panel) ── */}
          <div className="bg-slate-900/20 border border-slate-800/60 rounded-[2.5rem] p-6 lg:p-8 space-y-6 shadow-2xl backdrop-blur-sm">
            
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Rendimiento de conversaciones</h3>
              <p className="text-xs text-slate-500 font-bold uppercase mt-1">
                Analiza qué tan efectivos son tus openings y seguimientos.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* ─ PANEL IZQUIERDO: OPENINGS ─ */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      <MessageSquare size={13} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Openings (Mensajes Iniciales)</h4>
                      <p className="text-[9px] text-slate-500 uppercase font-black">Mensajes enviados primero al contacto.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/40 rounded-2xl border border-slate-800/60 overflow-hidden shadow-inner">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-900/30 border-b border-slate-800/80">
                        <th className="p-3.5 text-[8px] font-black text-slate-500 uppercase tracking-widest w-8">#</th>
                        <th className="p-3.5 text-[8px] font-black text-slate-500 uppercase tracking-widest">Opening</th>
                        <th className="p-3.5 text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Enviados</th>
                        <th className="p-3.5 text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Respuestas</th>
                        <th className="p-3.5 text-[8px] font-black text-slate-500 uppercase tracking-widest w-32">% Respuesta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30 font-medium">
                      {openings.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-[10px] text-slate-600 font-black uppercase tracking-widest">
                            Sin openings registrados
                          </td>
                        </tr>
                      ) : (
                        openings.map((row, idx) => {
                          const sendsRel = globalTotalSends > 0 ? pct(row.total_sends, globalTotalSends) : '0%';
                          return (
                            <tr key={row.message_id} className="hover:bg-slate-800/20 transition-all group">
                              <td className="p-3.5 text-[9px] font-bold text-slate-600">{idx + 1}</td>
                              <td className="p-3.5 max-w-[150px]">
                                <div className="flex items-center gap-2">
                                  <div className="truncate">
                                    <p className="font-black text-white group-hover:text-blue-400 transition-colors truncate">{row.title}</p>
                                    <p className="text-[8px] text-slate-500 font-mono mt-0.5 truncate">{row.message_id}</p>
                                  </div>
                                  {row.body && (
                                    <div className="relative group/body flex-shrink-0">
                                      <Eye size={11} className="text-slate-500 cursor-help hover:text-blue-400 transition-colors" />
                                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-72 bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-300 rounded-xl p-4 opacity-0 group-hover/body:opacity-100 transition-all pointer-events-none shadow-2xl z-50 leading-relaxed max-h-48 overflow-y-auto break-words whitespace-pre-wrap">
                                        {row.body}
                                      </div>
                                    </div>
                                  )}
                                  {!row.is_configured && (
                                    <button
                                      onClick={() => handleConfigureMessage(row.message_id, row.category || 'cualificacion')}
                                      className="text-[7px] font-black uppercase text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full hover:bg-amber-500/20 hover:text-amber-400 active:scale-95 transition-all flex items-center gap-0.5 cursor-pointer flex-shrink-0"
                                      title="Configurar este ID en NeurOPS ahora mismo"
                                    >
                                      <Plus size={8} />
                                      Configurar ID
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="p-3.5 text-center">
                                <p className="font-black text-white font-mono">{fmt(row.total_sends)}</p>
                                <p className="text-[8px] text-slate-500 font-mono mt-0.5">{sendsRel}</p>
                                {compare && comparisonMap[row.message_id] && (
                                  <p className="text-[8px] text-slate-600 font-mono mt-0.5">Ant: {fmt(comparisonMap[row.message_id].total_sends)}</p>
                                )}
                              </td>
                              <td className="p-3.5 text-center">
                                <p className="font-black text-white font-mono">{fmt(row.total_responses)}</p>
                                {compare && comparisonMap[row.message_id] && (
                                  <p className="text-[8px] text-slate-600 font-mono mt-0.5">Ant: {fmt(comparisonMap[row.message_id].total_responses)}</p>
                                )}
                              </td>
                              <td className="p-3.5">
                                {(() => {
                                  const colorData = getResponseRateColor(row.response_rate);
                                  return (
                                    <div className="space-y-1">
                                      <span className={`text-[9px] font-black font-mono ${colorData.text}`}>{row.response_rate}%</span>
                                      <div className="h-1 bg-slate-850 rounded-full overflow-hidden p-px">
                                        <div
                                          className={`h-full rounded-full transition-all duration-500 ${colorData.progress}`}
                                          style={{ width: `${Math.min(row.response_rate, 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {openings.length > 0 && (
                      <tfoot className="border-t border-slate-800 bg-slate-900/20">
                        <tr className="font-black text-[9px] uppercase tracking-wider text-slate-400">
                          <td colSpan={2} className="p-3.5">Total</td>
                          <td className="p-3.5 text-center font-mono">{fmt(totalOpenings.sends)}</td>
                          <td className="p-3.5 text-center font-mono">{fmt(totalOpenings.responses)}</td>
                          <td className="p-3.5 font-mono text-blue-400">{pct(totalOpenings.responses, totalOpenings.sends)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                <div className="flex items-center gap-2 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                  <Info size={12} className="text-blue-400 flex-shrink-0" />
                  <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-wide leading-relaxed">
                    <span className="text-blue-400 font-black">% Respuesta =</span> (Respuestas / Enviados) * 100. Mide qué porcentaje de contactos respondió cada opening.
                  </p>
                </div>
              </div>

              {/* ─ PANEL DERECHO: SEGUIMIENTOS ─ */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <Target size={13} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Seguimientos (Mensajes de Follow Up)</h4>
                      <p className="text-[9px] text-slate-500 uppercase font-black">Mensajes enviados después del primer contacto.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/40 rounded-2xl border border-slate-800/60 overflow-hidden shadow-inner">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-900/30 border-b border-slate-800/80">
                        <th className="p-3.5 text-[8px] font-black text-slate-500 uppercase tracking-widest w-8">#</th>
                        <th className="p-3.5 text-[8px] font-black text-slate-500 uppercase tracking-widest">Seguimiento</th>
                        <th className="p-3.5 text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Enviados</th>
                        <th className="p-3.5 text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Respuestas</th>
                        <th className="p-3.5 text-[8px] font-black text-slate-500 uppercase tracking-widest w-32">% Respuesta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30 font-medium">
                      {seguimientos.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-[10px] text-slate-600 font-black uppercase tracking-widest">
                            Sin seguimientos registrados
                          </td>
                        </tr>
                      ) : (
                        seguimientos.map((row, idx) => {
                          const sendsRel = globalTotalSends > 0 ? pct(row.total_sends, globalTotalSends) : '0%';
                          return (
                            <tr key={row.message_id} className="hover:bg-slate-800/20 transition-all group">
                              <td className="p-3.5 text-[9px] font-bold text-slate-600">{idx + 1}</td>
                              <td className="p-3.5 max-w-[150px]">
                                <div className="flex items-center gap-2">
                                  <div className="truncate">
                                    <p className="font-black text-white group-hover:text-emerald-400 transition-colors truncate">{row.title}</p>
                                    <p className="text-[8px] text-slate-500 font-mono mt-0.5 truncate">{row.message_id}</p>
                                  </div>
                                  {row.body && (
                                    <div className="relative group/body flex-shrink-0">
                                      <Eye size={11} className="text-slate-500 cursor-help hover:text-emerald-400 transition-colors" />
                                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-72 bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-300 rounded-xl p-4 opacity-0 group-hover/body:opacity-100 transition-all pointer-events-none shadow-2xl z-50 leading-relaxed max-h-48 overflow-y-auto break-words whitespace-pre-wrap">
                                        {row.body}
                                      </div>
                                    </div>
                                  )}
                                  {!row.is_configured && (
                                    <button
                                      onClick={() => handleConfigureMessage(row.message_id, row.category || 'seguimiento')}
                                      className="text-[7px] font-black uppercase text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full hover:bg-amber-500/20 hover:text-amber-400 active:scale-95 transition-all flex items-center gap-0.5 cursor-pointer flex-shrink-0"
                                      title="Configurar este ID en NeurOPS ahora mismo"
                                    >
                                      <Plus size={8} />
                                      Configurar ID
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="p-3.5 text-center">
                                <p className="font-black text-white font-mono">{fmt(row.total_sends)}</p>
                                <p className="text-[8px] text-slate-500 font-mono mt-0.5">{sendsRel}</p>
                                {compare && comparisonMap[row.message_id] && (
                                  <p className="text-[8px] text-slate-600 font-mono mt-0.5">Ant: {fmt(comparisonMap[row.message_id].total_sends)}</p>
                                )}
                              </td>
                              <td className="p-3.5 text-center">
                                <p className="font-black text-white font-mono">{fmt(row.total_responses)}</p>
                                {compare && comparisonMap[row.message_id] && (
                                  <p className="text-[8px] text-slate-600 font-mono mt-0.5">Ant: {fmt(comparisonMap[row.message_id].total_responses)}</p>
                                )}
                              </td>
                              <td className="p-3.5">
                                {(() => {
                                  const colorData = getResponseRateColor(row.response_rate);
                                  return (
                                    <div className="space-y-1">
                                      <span className={`text-[9px] font-black font-mono ${colorData.text}`}>{row.response_rate}%</span>
                                      <div className="h-1 bg-slate-850 rounded-full overflow-hidden p-px">
                                        <div
                                          className={`h-full rounded-full transition-all duration-500 ${colorData.progress}`}
                                          style={{ width: `${Math.min(row.response_rate, 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {seguimientos.length > 0 && (
                      <tfoot className="border-t border-slate-800 bg-slate-900/20">
                        <tr className="font-black text-[9px] uppercase tracking-wider text-slate-400">
                          <td colSpan={2} className="p-3.5">Total</td>
                          <td className="p-3.5 text-center font-mono">{fmt(totalSeguimientos.sends)}</td>
                          <td className="p-3.5 text-center font-mono">{fmt(totalSeguimientos.responses)}</td>
                          <td className="p-3.5 font-mono text-emerald-400">{pct(totalSeguimientos.responses, totalSeguimientos.sends)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                <div className="flex items-center gap-2 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                  <Info size={12} className="text-emerald-400 flex-shrink-0" />
                  <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-wide leading-relaxed">
                    <span className="text-emerald-400 font-black">% Respuesta =</span> (Respuestas / Enviados) * 100. Mide qué porcentaje de contactos respondió cada seguimiento.
                  </p>
                </div>
              </div>

            </div>

          </div>

          {/* ── ¿CÓMO SE CALCULAN ESTAS MÉTRICAS? ── */}
          <div className="bg-slate-900/10 border border-slate-800/40 rounded-3xl p-6 space-y-6">
            <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              <HelpCircle className="text-indigo-400" size={14} /> ¿Cómo se calculan estas métricas?
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-slate-950/30 border border-slate-850 p-4 rounded-2xl flex gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl h-fit border border-indigo-500/10">
                  <MessageSquare size={13} />
                </div>
                <div>
                  <h5 className="text-[10px] font-black uppercase text-white tracking-wider">Enviados</h5>
                  <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">
                    Cantidad total de mensajes enviados en flujos automatizados de ManyChat.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/30 border border-slate-850 p-4 rounded-2xl flex gap-3">
                <div className="p-2 bg-pink-500/10 text-pink-400 rounded-xl h-fit border border-pink-500/10">
                  <Reply size={13} />
                </div>
                <div>
                  <h5 className="text-[10px] font-black uppercase text-white tracking-wider">Respuestas</h5>
                  <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">
                    Cantidad total de respuestas o clicks recibidos por parte del lead sobre esos mensajes.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/30 border border-slate-850 p-4 rounded-2xl flex gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl h-fit border border-blue-500/10">
                  <TrendingUp size={13} />
                </div>
                <div>
                  <h5 className="text-[10px] font-black uppercase text-white tracking-wider">% Respuesta</h5>
                  <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">
                    Porcentaje de leads que respondieron del total de mensajes de esa variante que recibieron.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/30 border border-slate-850 p-4 rounded-2xl flex gap-3">
                <div className="p-2 bg-violet-500/10 text-violet-400 rounded-xl h-fit border border-violet-500/10">
                  <Users size={13} />
                </div>
                <div>
                  <h5 className="text-[10px] font-black uppercase text-white tracking-wider">Recepción de mensajes</h5>
                  <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">
                    Interacciones y asignaciones en tiempo real desde webhook e integraciones de ManyChat.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      {/* ── MODAL DE GESTIÓN DE MENSAJES CONVERSACIONALES ── */}
      <MessageManagerModal
        isOpen={showManager}
        initialMessageId={initialMessageId}
        initialCategory={initialCategory}
        onClose={() => {
          setShowManager(false);
          setInitialMessageId(null);
          setInitialCategory('cualificacion');
          fetchStats();
        }}
      />

    </div>
  );
};

export default ConversationalStatsTab;
