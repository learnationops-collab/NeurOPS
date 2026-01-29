import { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, DollarSign, TrendingUp, Activity, Plus } from 'lucide-react';
import NewSaleModal from '../components/NewSaleModal';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import DashboardCharts from '../components/DashboardCharts';
import Counter from '../components/ui/Counter';

const KPICard = ({ title, value, subtitle, icon: Icon, color }) => (
  <Card variant="surface" className="group h-full">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-4 rounded-2xl bg-opacity-10 ${color.bg} ${color.text}`}>
        <Icon size={28} />
      </div>
      <div className="flex flex-col items-end">
        <span className="text-muted text-[10px] font-black uppercase tracking-widest">{title}</span>
        <h3 className="text-3xl font-black text-base italic tracking-tighter mt-1">
          {value}
        </h3>
      </div>
    </div>
    {subtitle && (
      <div className="pt-4 border-t border-base mt-2">
        <p className="text-muted text-[10px] font-bold uppercase tracking-widest">{subtitle}</p>
      </div>
    )}
  </Card>
);

const AdminDashboard = () => {
  const [kpiData, setKpiData] = useState(null);
  const [chartsData, setChartsData] = useState(null);
  const [activityData, setActivityData] = useState(null);

  const [loadingKpi, setLoadingKpi] = useState(true);
  // Charts and Activity load independently, non-blocking for KPIs

  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [period, setPeriod] = useState('this_month');

  useEffect(() => {
    fetchAllData();
  }, [period]);

  const fetchAllData = () => {
    setLoadingKpi(true);
    setChartsData(null); // Reset to trigger loading state in UI if desired
    setActivityData(null);
    setError(null);

    // 1. Fetch KPIs (Critical First Content Paint)
    api.get(`/admin/dashboard/kpis?period=${period}`)
      .then(r => {
        setKpiData(r.data);
        setLoadingKpi(false);
      })
      .catch(e => {
        setError("Error al cargar KPIs");
        setLoadingKpi(false);
      });

    // 2. Fetch Charts (Parallel)
    api.get(`/admin/dashboard/charts?period=${period}`)
      .then(r => setChartsData(r.data.charts || r.data)) // Fixed comment syntax
      .catch(console.error);

    // 3. Fetch Activity (Parallel)
    api.get(`/admin/dashboard/activity?period=${period}`)
      .then(r => setActivityData(r.data))
      .catch(console.error);
  };

  const handleSaleSuccess = () => {
    fetchAllData();
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
    <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-base italic tracking-tighter">Panel Principal</h1>
          <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Vista General del Negocio</p>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
            icon={Plus}
          >
            Nueva Venta
          </Button>
          <div className="p-1 px-1.5 bg-surface rounded-2xl border border-base flex gap-1 items-center">
            {['this_month', 'last_month', 'all_time'].map(p => (
              <div
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase cursor-pointer transition-all ${period === p ? 'bg-primary text-white' : 'text-muted hover:text-base'}`}
              >
                {p === 'this_month' ? 'Este Mes' : p === 'last_month' ? 'Mes Pasado' : 'Todo'}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* KPIs Section - Always renders first due to loading state above */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <KPICard
          title="Ingresos"
          value={<Counter value={kpiData.financials.income} prefix="$" />}
          subtitle={<span className="flex items-center gap-1">Pendiente: <Counter value={kpiData.cohort.p_debt} prefix="$" /></span>}
          icon={TrendingUp}
          color={{ bg: "bg-blue-500", text: "text-blue-500" }}
        />
        <KPICard
          title="Efectivo"
          value={<Counter value={kpiData.financials.cash_collected} prefix="$" />}
          subtitle="Neto recaudado"
          icon={DollarSign}
          color={{ bg: "bg-emerald-500", text: "text-emerald-500" }}
        />
        <KPICard
          title="Gastos"
          value={<Counter value={kpiData.financials.total_expenses} prefix="$" />}
          subtitle={<span className="flex items-center gap-1">Profit: <Counter value={kpiData.financials.net_profit} prefix="$" /></span>}
          icon={Activity}
          color={{ bg: "bg-red-500", text: "text-red-500" }}
        />
        <KPICard
          title="Leads"
          value={<Counter value={kpiData.cohort.active_leads} />}
          subtitle="Registros nuevos"
          icon={Users}
          color={{ bg: "bg-purple-500", text: "text-purple-500" }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {chartsData ? (
            <DashboardCharts chartsData={chartsData} />
          ) : (
            <Card variant="surface" className="h-[400px] flex items-center justify-center">
              <div className="animate-pulse flex flex-col items-center gap-2">
                <div className="h-8 w-8 bg-muted/20 rounded-full"></div>
                <span className="text-xs font-bold uppercase text-muted">Cargando Gráficos...</span>
              </div>
            </Card>
          )}
        </div>

        <Card variant="surface" className="h-[500px] flex flex-col" padding="p-0">
          <CardHeader className="px-8 py-6 border-b border-base bg-surface-hover mb-0">
            <h3 className="text-base font-black uppercase text-xs tracking-widest">Actividad Reciente</h3>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-4 p-8 custom-scrollbar">
            {activityData ? (
              <>
                {activityData.recent_activity.map((activity, i) => (
                  <div key={i} className="flex items-center gap-4 group">
                    <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_10px] ${activity.type === 'payment' ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-primary shadow-primary/50'}`}></div>
                    <div className="flex-1">
                      <p className="text-base text-xs font-bold">{activity.message}</p>
                      <p className="text-muted text-[10px] uppercase">{activity.sub}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{new Date(activity.time).toLocaleDateString()}</span>
                  </div>
                ))}

                {/* Optional: Show Top Debtors here if desired, or maybe in a separate tab? 
                    User asked for "optimization", let's stick to showing recent activity as before. 
                    Top Debtors is data available if needed.
                */}
              </>
            ) : (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted/20"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 bg-muted/20 rounded"></div>
                      <div className="h-2 w-1/2 bg-muted/20 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <NewSaleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSaleSuccess}
      />
    </div>
  );
};

export default AdminDashboard;
