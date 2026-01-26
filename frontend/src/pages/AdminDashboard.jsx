import { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, DollarSign, TrendingUp, Activity, Plus } from 'lucide-react';
import NewSaleModal from '../components/NewSaleModal';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const KPICard = ({ title, value, subtitle, icon: Icon, color }) => (
  <Card variant="surface" className="group">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-4 rounded-2xl bg-opacity-10 ${color.bg} ${color.text}`}>
        <Icon size={28} />
      </div>
      <div className="flex flex-col items-end">
        <span className="text-muted text-[10px] font-black uppercase tracking-widest">{title}</span>
        <h3 className="text-3xl font-black text-base italic tracking-tighter mt-1">{value}</h3>
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = () => {
    setLoading(true);
    api.get("/admin/dashboard")
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || "Error al cargar datos"))
      .finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-primary font-bold uppercase tracking-widest text-sm">Cargando Datos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center">
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl inline-block">
          <p className="text-red-400 font-bold text-lg">{error}</p>
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
            <Badge variant="primary" className="cursor-pointer">Este Mes</Badge>
            <span className="text-muted text-[10px] font-bold uppercase px-2 cursor-pointer hover:text-base">Personalizado</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <KPICard
          title="Ingresos"
          value={`$${data.financials.income.toLocaleString()}`}
          subtitle={`Pendiente: $${data.cohort.p_debt.toLocaleString()}`}
          icon={TrendingUp}
          color={{ bg: "bg-blue-500", text: "text-blue-500" }}
        />
        <KPICard
          title="Efectivo"
          value={`$${data.financials.cash_collected.toLocaleString()}`}
          subtitle="Neto recaudado"
          icon={DollarSign}
          color={{ bg: "bg-emerald-500", text: "text-emerald-500" }}
        />
        <KPICard
          title="Gastos"
          value={`$${data.financials.total_expenses.toLocaleString()}`}
          subtitle={`Profit: $${data.financials.net_profit.toLocaleString()}`}
          icon={Activity}
          color={{ bg: "bg-red-500", text: "text-red-500" }}
        />
        <KPICard
          title="Leads"
          value={data.cohort.active_leads}
          subtitle="Registros nuevos"
          icon={Users}
          color={{ bg: "bg-purple-500", text: "text-purple-500" }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card variant="surface" className="lg:col-span-2 h-80 flex items-center justify-center bg-main">
          <p className="text-muted font-bold uppercase tracking-widest italic opacity-20">Graficos Tendencia</p>
        </Card>
        <Card variant="surface" className="h-80 flex flex-col" padding="p-0">
          <CardHeader className="px-8 py-6 border-b border-base bg-surface-hover mb-0">
            <h3 className="text-base font-black uppercase text-xs tracking-widest">Actividad Reciente</h3>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-4 p-8 custom-scrollbar">
            {data.recent_activity.map((activity, i) => (
              <div key={i} className="flex items-center gap-4 group">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]"></div>
                <div className="flex-1">
                  <p className="text-base text-xs font-bold">{activity.message}</p>
                  <p className="text-muted text-[10px] uppercase">{activity.sub}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <NewSaleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchDashboard}
      />
    </div>
  );
};

export default AdminDashboard;
