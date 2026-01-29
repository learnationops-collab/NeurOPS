import { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, DollarSign, TrendingUp, Activity, Plus, Filter } from 'lucide-react';
import ExpensesManagerModal from '../components/ExpensesManagerModal';
import DashboardFilter from '../components/DashboardFilter';
import Button from '../components/ui/Button';
import StatsCard from '../components/StatsCard';
import AnalysisSection from '../components/AnalysisSection';
import Counter from '../components/ui/Counter';

const AdminDashboard = () => {
  const [kpiData, setKpiData] = useState(null);
  const [chartsData, setChartsData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Centralized state for all filters
  const [filters, setFilters] = useState({
    period: 'last_3_months',
    closer_ids: [],
    program_ids: [],
    start_date: '',
    end_date: ''
  });

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
          title="Ingresos"
          value={<Counter value={kpiData.financials.income} prefix="$" />}
          subtitle={<span className="text-emerald-400">Neto Recaudado</span>}
          icon={DollarSign}
          color={{ bg: "bg-emerald-500", text: "text-emerald-500", from: "from-emerald-500" }}
        />
        <StatsCard
          title="Pendiente"
          value={<Counter value={kpiData.cohort.p_debt} prefix="$" />}
          subtitle={<span className="text-purple-400">Por Cobrar</span>}
          icon={TrendingUp}
          color={{ bg: "bg-purple-500", text: "text-purple-500", from: "from-purple-500" }}
          subtitleColor="text-purple-400"
        />
        <StatsCard
          title="Gastos"
          value={<Counter value={kpiData.financials.total_expenses} prefix="$" />}
          subtitle={<span className="text-rose-400">Profit: ${kpiData.financials.net_profit}</span>}
          icon={Activity}
          color={{ bg: "bg-rose-500", text: "text-rose-500", from: "from-rose-500" }}
        />
        <StatsCard
          title="Leads"
          value={<Counter value={kpiData.cohort.active_leads} />}
          subtitle={<span className="text-blue-400">Activos en Pipeline</span>}
          icon={Users}
          color={{ bg: "bg-blue-500", text: "text-blue-500", from: "from-blue-500" }}
        />
      </div>

      {/* Analysis Graphic Section */}
      <div className="grid grid-cols-1 gap-8">
        <AnalysisSection
          data={chartsData}
          loading={loading}
          period={filters.period}
          onPeriodChange={handlePeriodChange}
        />
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
