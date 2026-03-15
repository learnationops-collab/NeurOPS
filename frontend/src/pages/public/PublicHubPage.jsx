import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, BarChart3, Target, Layers, TrendingUp, CalendarDays, 
  MessageSquare, LayoutGrid, ArrowRight, ShieldCheck, 
  Zap, PieChart, Sparkles
} from 'lucide-react';

const HubCard = ({ title, description, icon: Icon, links, colorClass, gradientClass }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group hover:border-slate-700 transition-all duration-500">
    <div className={`absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-10 group-hover:opacity-30 transition-opacity ${gradientClass}`} />
    
    <div className="flex flex-col h-full relative z-10">
      <div className="flex items-start justify-between mb-6">
        <div className={`p-4 rounded-2xl bg-slate-800 border border-slate-700/50 ${colorClass}`}>
          <Icon size={24} />
        </div>
      </div>
      
      <div className="space-y-2 mb-8">
        <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">{title}</h3>
        <p className="text-slate-500 text-xs font-bold leading-relaxed uppercase tracking-wider">{description}</p>
      </div>
      
      <div className="mt-auto grid grid-cols-1 gap-3">
        {links.map((link, idx) => (
          <Link 
            key={idx}
            to={link.to}
            className={`flex items-center justify-between px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
              link.primary 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 hover:-translate-y-1' 
                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <span>{link.label}</span>
            <ArrowRight size={14} className={link.primary ? 'animate-pulse' : ''} />
          </Link>
        ))}
      </div>
    </div>
  </div>
);

const PublicHubPage = () => {
  const sections = [
    {
      title: "Equipo Setters",
      description: "Reporte diario de conversaciones y estadísticas de prospección.",
      icon: MessageSquare,
      colorClass: "text-indigo-400",
      gradientClass: "bg-indigo-500",
      links: [
        { label: "Reportar Hoy", to: "/reporte-setter", primary: true },
        { label: "Ver Estadísticas", to: "/estadisticas-setters" }
      ]
    },
    {
      title: "Equipo Closers",
      description: "Registro de ventas, llamadas y métricas de cierre.",
      icon: Target,
      colorClass: "text-emerald-400",
      gradientClass: "bg-emerald-500",
      links: [
        { label: "Reportar Hoy", to: "/reporte-closer", primary: true },
        { label: "Ver Estadísticas", to: "/estadisticas-closers" }
      ]
    },
    {
      title: "Equipo Triage",
      description: "Seguimiento de agendas nuevas, asistencias y cancelaciones.",
      icon: Layers,
      colorClass: "text-cyan-400",
      gradientClass: "bg-cyan-500",
      links: [
        { label: "Reportar Hoy", to: "/reporte-triage", primary: true },
        { label: "Ver Estadísticas", to: "/estadisticas-triage" }
      ]
    },
    {
      title: "Marketing & Ads",
      description: "Gestión de campañas, anuncios y KPIs de tráfico.",
      icon: TrendingUp,
      colorClass: "text-amber-400",
      gradientClass: "bg-amber-500",
      links: [
        { label: "Gestionar Anuncios", to: "/gestion-anuncios", primary: true }
      ]
    },
    {
      title: "Finanzas & Ventas",
      description: "Análisis financiero detallado y control de recaudación.",
      icon: PieChart,
      colorClass: "text-rose-400",
      gradientClass: "bg-rose-500",
      links: [
        { label: "Sales Board", to: "/sales-board", primary: true }
      ]
    },
    {
      title: "Agendamiento",
      description: "Portal público de reservas y gestión de agendas externas.",
      icon: CalendarDays,
      colorClass: "text-violet-400",
      gradientClass: "bg-violet-500",
      links: [
        { label: "Ir al Booking", to: "/book/general", primary: false }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-12 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-cyan-600/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto z-10 relative space-y-16">
        {/* Header Section */}
        <div className="space-y-6 text-center lg:text-left max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Sparkles size={14} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">NeurOPS Public Ecosystem</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-black text-white italic tracking-tighter uppercase leading-[0.9]">
              Operations <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">Central Hub</span>
            </h1>
          </div>
          <p className="text-slate-500 font-bold text-sm md:text-base leading-relaxed uppercase tracking-wider">
            Bienvenido al portal centralizado de NeurOPS. Desde aquí puedes acceder a todos los formularios de reporte y tableros de rendimiento público.
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
          {sections.map((section, idx) => (
            <HubCard key={idx} {...section} />
          ))}
        </div>

        {/* Footer */}
        <div className="pt-20 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-8 pb-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <ShieldCheck className="text-indigo-500" size={24} />
            </div>
            <div>
              <p className="text-white font-black uppercase tracking-widest text-xs">Acceso Público Seguro</p>
              <p className="text-slate-600 font-bold text-[10px] uppercase">No se requiere autenticación para reportar</p>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-slate-500 font-bold text-[9px] uppercase tracking-[0.3em]">NeurOPS Intelligence Platform</p>
              <p className="text-slate-700 font-bold text-[9px] uppercase tracking-[0.3em]">© 2026 • AI Powered Dashboard</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicHubPage;
