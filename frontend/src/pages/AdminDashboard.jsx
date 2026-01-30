import { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, DollarSign, TrendingUp, Activity, Plus, Filter, Calendar } from 'lucide-react';
import ExpensesManagerModal from '../components/ExpensesManagerModal';
import DashboardFilter from '../components/DashboardFilter';
import Button from '../components/ui/Button';
import StatsCard from '../components/StatsCard';
import AnalysisSection from '../components/AnalysisSection';
import RevenueChart from '../components/RevenueChart';
import Counter from '../components/ui/Counter';

import { useAuth } from '../contexts/AuthContext';

// ... imports

const AdminDashboard = () => {
  const { user } = useAuth();
  const [kpiData, setKpiData] = useState(null);
  const [chartsData, setChartsData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeGraphTab, setActiveGraphTab] = useState('sales'); // New state for tabs

  // Centralized state for all filters with persistence
  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem(`dashboard_filters_${user?.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved filters", e);
      }
    }
    return {
      period: 'this_month',
      closer_ids: [],
      program_ids: [],
      start_date: '',
      end_date: ''
    };
  });

  // Save filters persistence
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`dashboard_filters_${user.id}`, JSON.stringify(filters));
    }
  }, [filters, user?.id]);

  useEffect(() => {
    fetchAllData();
  }, [filters]);

  const fetchAllData = () => {
    setLoading(true);
    setError(null);

    // Build query params
    const queryParams = new URLSearchParams({
      period: filters.period
    });

    if (filters.closer_ids.length) queryParams.append('closer_ids', filters.closer_ids.join(','));
    if (filters.program_ids.length) queryParams.append('program_ids', filters.program_ids.join(','));
    if (filters.start_date) queryParams.append('start_date', filters.start_date);
    if (filters.end_date) queryParams.append('end_date', filters.end_date);

    const queryString = queryParams.toString();

    // Fetch KPIs and Charts in parallel
    Promise.all([
      api.get(`/admin/dashboard/kpis?${queryString}`),
      api.get(`/admin/dashboard/charts?${queryString}`)
    ])
      .then(([kpiRes, chartsRes]) => {
        setKpiData(kpiRes.data);
        setChartsData(chartsRes.data.charts || chartsRes.data);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setError("Error al cargar los datos del tablero");
        setLoading(false);
      });
  };

  const handleApplyFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handlePeriodChange = (newPeriod) => {
    setFilters(prev => ({ ...prev, period: newPeriod }));
  };

  if (loading && !kpiData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-primary font-bold uppercase tracking-widest text-sm">Cargando Tablero...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center">
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl inline-block">
          <p className="text-red-400 font-bold text-lg">{error}</p>
          <Button onClick={fetchAllData} variant="outline" className="mt-4">Reintentar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-12 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-base/50 pb-8">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">Panel Principal</h1>
          <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Vista General del Negocio</p>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={() => setIsModalOpen(true)}
            size="md"
            icon={Plus}
            className="bg-gradient-primary border-none shadow-glow hover:brightness-110 !rounded-2xl"
          >
            Gasto
          </Button>

          {/* Period Filters */}
          <div className="flex bg-surface/50 backdrop-blur-sm rounded-2xl p-1 gap-1 overflow-x-auto custom-scrollbar items-center border border-base/50">
            {[
              { label: '7D', value: 'last_7_days' },
              { label: '14D', value: 'last_14_days' },
              { label: '1M', value: 'last_1_month' },
              { label: '3M', value: 'last_3_months' },
              { label: 'Este Mes', value: 'this_month' },
              { label: 'Todo', value: 'all_time' },
            ].map(filter => (
              <button
                key={filter.value}
                onClick={() => handlePeriodChange(filter.value)}
                className={`relative px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all duration-300 whitespace-nowrap ${filters.period === filter.value
                  ? 'bg-primary text-white shadow-glow'
                  : 'text-muted hover:text-white hover:bg-white/5'
                  }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Optimized Filter Button */}
          <button
            onClick={() => setIsFilterOpen(true)}
            className="flex items-center gap-2 px-6 py-2 bg-surface/50 backdrop-blur-sm rounded-2xl border border-base/50 text-white hover:bg-white/5 transition-all duration-300"
          >
            <Filter size={18} className="text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider">Filtros</span>
            {(filters.closer_ids.length > 0 || filters.program_ids.length > 0 || filters.period === 'custom') && (
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            )}
          </button>
        </div>
      </header>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Revenue"
          value={<Counter value={kpiData.financials.gross_revenue} prefix="$" />}
          subtitle={
            <div className="flex flex-col gap-0.5 mt-2 opacity-90 text-right">
              <span className="text-xs text-rose-400 font-medium">Pendiente: ${kpiData.financials.pending_revenue?.toLocaleString()}</span>
            </div>
          }
          icon={TrendingUp}
          color={{ bg: "bg-emerald-500", text: "text-emerald-500", from: "from-emerald-500" }}
        />
        <StatsCard
          title="Cash Collect"
          value={<Counter value={kpiData.financials.income} prefix="$" />}
          subtitle={
            <div className="flex flex-col gap-0.5 mt-2 opacity-90 text-right">
              {/* "En el cash collect solo debe verse el ingreso bruto en las letras pequeñas, o sea, quita a FEES" 
                  Wait, if main value is Cash Collected (Net), showing Gross in subtitle makes sense?
                  User said: "En el cash collect solo debe verse el ingreso bruto en las letras pequeñas"
                  And "quita a FEES".
                  Let's check what was calculated. 
                  kpiData.financials.cash_collected = income - fees.
                  kpiData.financials.income = Gross Income (Bruto).
                  
                  If user wants to remove FEES, I should just show Bruto? 
                  But usually Cash Collect IS the Net... 
                  Wait, "En el cash collect solo debe verse el ingreso bruto en las letras pequeñas" implies the MAIN value is NOT the Gross?
                  Main value was `cash_collected` (Net). 
                  Subtitle was `Bruto` and `Fees`.
                  So I should keep Main Value as Net (or whatever user expects for "Cash Collect", usually actual money in bank i.e. Net) and Subtitle only Bruto.
                  BUT, user might mean "Show Gross as Main and nothing else"? 
                  "En el cash collect solo debe verse el ingreso bruto en las letras pequeñas" -> In the small letters, only Gross Income should be seen.
                  So Main Value = Net? Or Main Value = Gross? 
                  "Cash Collect" usually implies money collected. 
                  I will keep Main Value as `cash_collected` (Net) and Subtitle as `Bruto: $X`.
              */}
              <div className="flex justify-end items-center text-[10px] uppercase tracking-wider font-bold text-indigo-400/80">
                <span>Bruto: ${kpiData.financials.income?.toLocaleString()}</span>
              </div>
            </div>
          }
          icon={DollarSign}
          color={{ bg: "bg-indigo-500", text: "text-indigo-500", from: "from-indigo-500" }}
        />
        <StatsCard
          title="Gastos"
          value={<Counter value={kpiData.financials.total_expenses} prefix="$" />}
          subtitle={<span className="text-emerald-400 font-bold">Profit: ${kpiData.financials.net_profit?.toLocaleString()}</span>}
          icon={Activity}
          color={{ bg: "bg-rose-500", text: "text-rose-500", from: "from-rose-500" }}
        />
        <StatsCard
          title="Ticket Promedio"
          value={<Counter value={kpiData.financials.average_ticket || 0} prefix="$" />}
          subtitle={<span className="text-blue-400 font-bold">{kpiData.financials.enrollments_count} inscripciones</span>}
          icon={TrendingUp}
          color={{ bg: "bg-blue-500", text: "text-blue-500", from: "from-blue-500" }}
        />
      </div>

      {/* Analysis Graphic Section */}
      {/* Analysis Graphic Section */}
      <div className="space-y-6">
        {/* Tabs for Graphs */}
        <div className="flex bg-slate-900/40 p-1.5 rounded-[2rem] border border-slate-800 w-fit">
          <button
            onClick={() => setActiveGraphTab('sales')}
            className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeGraphTab === 'sales'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-slate-500 hover:text-white hover:bg-slate-800'
              }`}
          >
            Ventas
          </button>
          <button
            onClick={() => setActiveGraphTab('marketing')}
            className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeGraphTab === 'marketing'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-slate-500 hover:text-white hover:bg-slate-800'
              }`}
          >
            Marketing
          </button>
        </div>

        {activeGraphTab === 'sales' ? (
          <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <RevenueChart filters={filters} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 border border-dashed border-slate-700/50 rounded-[2.5rem] bg-slate-900/20 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[400px]">
            <div className="w-16 h-16 mb-4 rounded-full bg-slate-800 flex items-center justify-center">
              <TrendingUp className="text-slate-500" size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-300">Análisis de Marketing</h3>
            <p className="text-slate-500 text-sm mt-2 font-medium">Próximamente disponible</p>
          </div>
        )}
      </div>

      <ExpensesManagerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchAllData}
      />

      {isFilterOpen && (
        <DashboardFilter
          currentFilters={filters}
          onApply={handleApplyFilters}
          onClose={() => setIsFilterOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
