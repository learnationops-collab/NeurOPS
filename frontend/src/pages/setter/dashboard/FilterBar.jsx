import { motion, AnimatePresence } from 'framer-motion';
import { Filter, ChevronDown, Loader2 } from 'lucide-react';

const PERIODS = [
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'last_7', label: '7D' },
  { key: 'this_month', label: 'Este Mes' },
  { key: 'custom', label: 'Personalizado' }
];

export const CATEGORIES = [
  { value: 'all', label: 'Todas' },
  { value: 'cualificacion', label: 'Cualificación', color: '#60a5fa' },
  { value: 'dolor', label: 'Dolor', color: '#f87171' },
  { value: 'seguimiento', label: 'Seguimiento', color: '#fbbf24' }
];

const FilterBar = ({
  period,
  setPeriod,
  category,
  setCategory,
  adId,
  setAdId,
  ads,
  customRange,
  setCustomRange,
  loading,
  compare,
  setCompare
}) => (
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
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          className="flex items-center gap-2 overflow-hidden"
        >
          <input
            type="date"
            value={customRange.start}
            onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))}
            className="bg-surface border border-base text-[9px] font-black text-base rounded-xl px-3 py-1.5 focus:outline-none focus:border-primary/50"
          />
          <span className="text-muted text-xs">—</span>
          <input
            type="date"
            value={customRange.end}
            onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))}
            className="bg-surface border border-base text-[9px] font-black text-base rounded-xl px-3 py-1.5 focus:outline-none focus:border-primary/50"
          />
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
          <option key={ad.id} value={ad.id}>
            {ad.name}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
    </div>

    <div className="w-px h-5 bg-base" />

    {/* Comparar con el Período Anterior */}
    <div className="flex items-center gap-2.5 bg-main/30 px-3.5 py-1.5 rounded-xl border border-base/40">
      <span className="text-[9px] font-black uppercase tracking-widest text-muted">Comparar</span>
      <button
        onClick={() => setCompare(!compare)}
        type="button"
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none ${
          compare ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-surface-hover border border-base'
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

    {loading && <Loader2 size={14} className="animate-spin text-primary ml-auto" />}
  </div>
);

export default FilterBar;
