import { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, DollarSign, TrendingUp, Activity, Plus } from 'lucide-react';
import ExpensesManagerModal from '../components/ExpensesManagerModal';
import Button from '../components/ui/Button';
import StatsCard from '../components/StatsCard';
import AnalysisSection from '../components/AnalysisSection';
import Counter from '../components/ui/Counter';

const AdminDashboard = () => {
  const [kpiData, setKpiData] = useState(null);
  const [chartsData, setChartsData] = useState(null);

  const [loadingKpi, setLoadingKpi] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [period, setPeriod] = useState('this_month');

  useEffect(() => {
    fetchAllData();
  }, [period]);

  const fetchAllData = () => {
    setLoadingKpi(true);
    setChartsData(null);
    setError(null);

    // 1. Fetch KPIs
    api.get(`/admin/dashboard/kpis?period=${period}`)
      .then(r => {
        setKpiData(r.data);
        setLoadingKpi(false);
      })
      .catch(e => {
        setError("Error al cargar KPIs");
        setLoadingKpi(false);
      });

    // 2. Fetch Charts
    api.get(`/admin/dashboard/charts?period=${period}`)
      .then(r => setChartsData(r.data.charts || r.data))
      .catch(console.error);
  };



  if (loadingKpi && !kpiData) {
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
          <div className="p-1 px-1.5 bg-surface/50 backdrop-blur-sm rounded-2xl border border-base/50 flex gap-1 items-center">
            {['this_month', 'last_month', 'all_time'].map(p => (
              <div
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all duration-300 ${period === p ? 'bg-white/10 text-white shadow-inner' : 'text-muted hover:text-white hover:bg-white/5'}`}
              >
                {p === 'this_month' ? 'Este Mes' : p === 'last_month' ? 'Mes Pasado' : 'Todo'}
              </div>
            ))}
          </div>
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
        <AnalysisSection data={chartsData} />
      </div>

      <ExpensesManagerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchAllData}
      />
    </div>
  );
};

export default AdminDashboard;
