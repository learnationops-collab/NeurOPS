import { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, DollarSign, TrendingUp, Activity, Plus } from 'lucide-react';
import NewSaleModal from '../components/NewSaleModal';

const KPICard = ({ title, value, subtitle, icon: Icon, color }) => (
  <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-3xl border border-slate-700 shadow-xl">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-4 rounded-2xl bg-opacity-10 ${color.bg} ${color.text}`}>
        <Icon size={28} />
      </div>
      <div className="flex flex-col items-end">
        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">{title}</span>
        <h3 className="text-3xl font-black text-white mt-1">{value}</h3>
      </div>
    </div>
    {subtitle && (
      <div className="pt-4 border-t border-slate-700/50 mt-2">
        <p className="text-slate-500 text-xs font-bold uppercase tracking-tighter">{subtitle}</p>
      </div>
    )}
  </div>
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
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-indigo-500 font-bold uppercase tracking-widest text-sm">Cargando Datos...</p>
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
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      <header className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white italic tracking-tighter">Panel Principal</h1>
          <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.2em]">Vista General del Negocio</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
          >
            <Plus size={20} />
            <span>Nueva Venta</span>
          </button>
          <div className="p-1 bg-slate-800 rounded-2xl border border-slate-700 flex gap-1 items-center">
            <button className="px-4 py-2 bg-slate-700 text-white text-xs font-bold rounded-xl">Este Mes</button>
            <button className="px-4 py-2 text-slate-400 text-xs font-bold hover:text-white transition-colors">Personalizado</button>
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
        <div className="lg:col-span-2 bg-slate-800/30 rounded-[2.5rem] border border-slate-800 p-8 h-80 flex items-center justify-center">
          <p className="text-slate-600 font-bold uppercase tracking-widest italic">Graficos Tendencia</p>
        </div>
        <div className="bg-slate-800/30 rounded-[2.5rem] border border-slate-800 p-8 h-80 flex flex-col">
          <h3 className="text-white font-black uppercase text-sm tracking-widest mb-6 border-b border-slate-800 pb-4">Actividad Reciente</h3>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {data.recent_activity.map((activity, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                <div className="flex-1">
                  <p className="text-slate-300 text-xs font-bold">{activity.message}</p>
                  <p className="text-slate-500 text-[10px] uppercase">{activity.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
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
