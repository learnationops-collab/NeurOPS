import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Loader2, HelpCircle } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import { CATEGORIES } from './FilterBar';

const CAT_COLORS = {
  cualificacion: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  dolor: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
  seguimiento: 'text-amber-400 bg-amber-400/10 border-amber-400/20'
};

const pct = (a, b) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '0%');
const fmt = (n) => (n ?? 0).toLocaleString();

const MessageTable = ({ rows, totals, loading, compareActive, comparisonTable, comparisonKpis }) => {
  // Crear un mapa para buscar rápidamente filas del periodo anterior por message_id
  const comparisonMap = useMemo(() => {
    if (!comparisonTable) return {};
    const map = {};
    comparisonTable.forEach(row => {
      map[row.message_id] = row;
    });
    return map;
  }, [comparisonTable]);

  return (
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
                <MessageRow 
                  key={row.message_id} 
                  row={row} 
                  index={i + 1} 
                  totalSends={totals.sends} 
                  compareActive={compareActive}
                  prevRow={comparisonMap[row.message_id]}
                />
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 border-primary/20 bg-primary/5">
                <tr>
                  <td className="px-5 py-4 text-[9px] font-black text-primary uppercase tracking-widest" colSpan={2}>TOTALES</td>
                  <td className="px-5 py-4 text-xs font-black text-base font-mono">
                    <div>{fmt(totals.sends)}</div>
                    {compareActive && comparisonKpis && (
                      <div className="text-[9px] text-muted/60 font-mono mt-0.5">Ant: {fmt(comparisonKpis.total_sends)}</div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-[10px] font-black text-primary">100%</td>
                  <td className="px-5 py-4 text-xs font-black text-base font-mono">
                    <div>{fmt(totals.responses)}</div>
                    {compareActive && comparisonKpis && (
                      <div className="text-[9px] text-muted/60 font-mono mt-0.5">Ant: {fmt(comparisonKpis.total_responses)}</div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-[10px] font-black text-primary">
                    <div>{pct(totals.responses, totals.sends)}</div>
                    {compareActive && comparisonKpis && (
                      <div className="text-[9px] text-muted/60 font-mono mt-0.5">Ant: {pct(comparisonKpis.total_responses, comparisonKpis.total_sends)}</div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs font-black text-base font-mono">
                    <div>{fmt(totals.leads)}</div>
                    {compareActive && comparisonKpis && (
                      <div className="text-[9px] text-muted/60 font-mono mt-0.5">Ant: {fmt(comparisonKpis.total_leads)}</div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs font-black text-base font-mono">
                    <div>{fmt(totals.agendas)}</div>
                    {compareActive && comparisonKpis && (
                      <div className="text-[9px] text-muted/60 font-mono mt-0.5">Ant: {fmt(comparisonKpis.total_agendas)}</div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs font-black text-base font-mono">
                    <div>{fmt(totals.ventas)}</div>
                    {compareActive && comparisonKpis && (
                      <div className="text-[9px] text-muted/60 font-mono mt-0.5">Ant: {fmt(comparisonKpis.total_ventas)}</div>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
};

const MessageRow = ({ row, index, totalSends, compareActive, prevRow }) => {
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
      <td className="px-5 py-4 text-xs font-black font-mono text-base">
        <div>{fmt(row.total_sends)}</div>
        {compareActive && prevRow && (
          <div className="text-[9px] text-muted/60 font-mono mt-0.5">Ant: {fmt(prevRow.total_sends)}</div>
        )}
      </td>

      {/* % del total */}
      <td className="px-5 py-4">
        <Badge variant="primary" className="text-[9px] px-2 py-0.5 font-mono">{row.pct_of_total_sends}%</Badge>
        {compareActive && prevRow && (
          <div className="text-[9px] text-muted/60 font-mono mt-0.5">Ant: {prevRow.pct_of_total_sends}%</div>
        )}
      </td>

      {/* Respuestas */}
      <td className="px-5 py-4 text-xs font-black font-mono text-base">
        <div>{fmt(row.total_responses)}</div>
        {compareActive && prevRow && (
          <div className="text-[9px] text-muted/60 font-mono mt-0.5">Ant: {fmt(prevRow.total_responses)}</div>
        )}
      </td>

      {/* Tasa de respuesta con barra */}
      <td className="px-5 py-4 min-w-[120px]">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-base">{responseRate}%</span>
            {compareActive && prevRow && (
              <span className="text-[9px] text-muted/60 font-mono">Ant: {prevRow.response_rate}%</span>
            )}
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
          {compareActive && prevRow && (
            <div className="text-[9px] text-muted/60 font-mono mt-0.5">
              Ant: {fmt(prevRow.leads_generated)} ({prevRow.qualification_rate}% cual.)
            </div>
          )}
        </div>
      </td>

      {/* Agendas */}
      <td className="px-5 py-4">
        <div>
          <p className="text-xs font-black font-mono text-base">{fmt(row.agendas)}</p>
          <p className="text-[8px] text-muted">{row.agenda_rate}% agenda</p>
          {compareActive && prevRow && (
            <div className="text-[9px] text-muted/60 font-mono mt-0.5">
              Ant: {fmt(prevRow.agendas)} ({prevRow.agenda_rate}% agenda)
            </div>
          )}
        </div>
      </td>

      {/* Ventas */}
      <td className="px-5 py-4">
        <div>
          <p className="text-xs font-black font-mono text-base">{fmt(row.ventas)}</p>
          <p className="text-[8px] text-muted">{row.venta_rate}% cierre</p>
          {compareActive && prevRow && (
            <div className="text-[9px] text-muted/60 font-mono mt-0.5">
              Ant: {fmt(prevRow.ventas)} ({prevRow.venta_rate}% cierre)
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};

const SectionTitle = ({ children }) => (
  <div className="flex items-center gap-4">
    <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted whitespace-nowrap">{children}</h2>
    <div className="h-px bg-base flex-1" />
  </div>
);

export default MessageTable;
