import { useState, useEffect } from 'react';
import api from '../services/api';
import { LayoutDashboard, FileText, Kanban, BarChart3, PlusCircle, Calendar, ChevronDown } from 'lucide-react';
import SetterReportModal from '../components/SetterReportModal';

const SetterDashboard = () => {
    const [stats, setStats] = useState({ total_agendas: 0, total_openings: 0, total_leads: 0, conversion: 0 });
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('this_month'); // default

    const periods = [
        { id: 'today', label: 'Hoy' },
        { id: 'yesterday', label: 'Ayer' },
        { id: 'last_7_days', label: 'Últimos 7 días' },
        { id: 'this_month', label: 'Este Mes' },
        { id: 'last_month', label: 'Mes Pasado' },
        { id: 'all', label: 'Todo el tiempo' },
    ];

    useEffect(() => {
        fetchStats();
    }, [period]);

    const getDatesFromPeriod = (p) => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (p) {
            case 'today':
                break;
            case 'yesterday':
                start.setDate(now.getDate() - 1);
                end.setDate(now.getDate() - 1);
                break;
            case 'last_7_days':
                start.setDate(now.getDate() - 7);
                break;
            case 'this_month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'last_month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'all':
                return { start: null, end: null };
            default:
                return { start: null, end: null };
        }

        const formatDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        return {
            start: formatDate(start),
            end: formatDate(end)
        };
    };

    const fetchStats = async () => {
        setLoading(true);
        try {
            const { start, end } = getDatesFromPeriod(period);
            const params = {};
            if (start) params.start_date = start;
            if (end) params.end_date = end;

            const res = await api.get('/setter/stats/summary', { params });
            setStats(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-12">
            {/* Header / Hero */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        <span className="text-slate-500 font-black uppercase text-[10px] tracking-[0.3em]">Setter Workspace</span>
                    </div>
                    <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase">Panel de Control</h1>
                </div>

                <div className="flex items-center gap-4">
                    {/* Period Selector */}
                    <div className="relative group">
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="appearance-none bg-slate-900 border border-slate-800 text-white pl-12 pr-10 py-4 rounded-[1.5rem] font-bold text-xs uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer hover:bg-slate-800/80"
                        >
                            {periods.map(p => (
                                <option key={p.id} value={p.id}>{p.label}</option>
                            ))}
                        </select>
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-focus-within:text-indigo-500 transition-colors">
                            <Calendar size={18} />
                        </div>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                            <ChevronDown size={16} />
                        </div>
                    </div>

                    <button
                        id="btn-new-report"
                        onClick={() => setIsReportOpen(true)}
                        className="bg-white hover:bg-slate-100 text-slate-950 px-8 py-4 rounded-[1.5rem] font-black uppercase text-xs tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl flex items-center gap-3"
                    >
                        <FileText size={18} />
                        Reporte Diario
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div id="stats-summary" className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 group hover:border-indigo-500/50 transition-all">
                    <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest mb-4">Agendas del Periodo</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-white tracking-tighter">
                            {loading ? '...' : stats.total_agendas}
                        </span>
                        <BarChart3 size={20} className="text-indigo-500" />
                    </div>
                </div>
                <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 group hover:border-emerald-500/50 transition-all">
                    <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest mb-4">Aperturas del Periodo</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-white tracking-tighter">
                            {loading ? '...' : stats.total_openings}
                        </span>
                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 group hover:border-amber-500/50 transition-all">
                    <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest mb-4">Conversión Periodo</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-white tracking-tighter">
                            {loading ? '...' : stats.conversion}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Kanban Placeholder Section */}
            <div className="space-y-6">
                <h2 className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                        {/* Placeholder for Kanban icon */}
                        <div className="w-4 h-4 border-2 border-indigo-500 rounded-sm" />
                    </div>
                    Embudo de Gestión (Próximamente)
                </h2>

                <div className="bg-slate-900/20 border-2 border-dashed border-slate-800 rounded-[3rem] p-20 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center">
                        <PlusCircle size={32} className="text-slate-600" />
                    </div>
                    <div className="max-w-md">
                        <h3 className="text-white font-black text-lg">El Kanban del Setter está en desarrollo</h3>
                        <p className="text-slate-500 text-sm font-medium">Pronto podrás mover tus leads de etapa a etapa directamente desde esta vista para automatizar el seguimiento.</p>
                    </div>
                </div>
            </div>

            <SetterReportModal
                isOpen={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                onSuccess={fetchStats}
            />
        </div>
    );
};

export default SetterDashboard;
