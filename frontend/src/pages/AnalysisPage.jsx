import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Activity,
    Calendar as CalendarIcon,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

const AnalysisPage = () => {
    const [financeData, setFinanceData] = useState({ expenses: [], kpis: {} });
    const [salesData, setSalesData] = useState({ sales: [], pages: 1 });
    const [loading, setLoading] = useState(true);
    const [salesPage, setSalesPage] = useState(1);

    useEffect(() => {
        fetchAll();
    }, [salesPage]);

    const fetchAll = async () => {
        try {
            setLoading(true);
            const [f, s] = await Promise.all([
                api.get('/admin/finance/overview'),
                api.get('/admin/finance/sales', { params: { page: salesPage } })
            ]);
            setFinanceData(f.data);
            setSalesData(s.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-indigo-500 font-black animate-pulse uppercase tracking-widest">Calculando Rendimiento...</div>;

    const kpis = financeData.kpis;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10">
            <header>
                <h1 className="text-4xl font-black text-white italic tracking-tighter">Analisis Detallado</h1>
                <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.2em]">Rendimiento Economico y Comercial</p>
            </header>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-2">Ingresos Brutos</p>
                    <h3 className="text-2xl font-black text-white">${kpis.gross_revenue?.toLocaleString()}</h3>
                </div>
                <div className="bg-emerald-500/10 p-6 rounded-3xl border border-emerald-500/20">
                    <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest leading-none mb-2">Caja Neta</p>
                    <h3 className="text-2xl font-black text-emerald-500">${kpis.cash_collected?.toLocaleString()}</h3>
                </div>
                <div className="bg-rose-500/10 p-6 rounded-3xl border border-rose-500/20">
                    <p className="text-[10px] font-black text-rose-500/60 uppercase tracking-widest leading-none mb-2">Egresos Totales</p>
                    <h3 className="text-2xl font-black text-rose-500">${kpis.total_expenses?.toLocaleString()}</h3>
                </div>
                <div className="bg-indigo-600 p-6 rounded-3xl shadow-xl shadow-indigo-600/20">
                    <p className="text-[10px] font-black text-white/60 uppercase tracking-widest leading-none mb-2">Utilidad Estimada</p>
                    <h3 className="text-2xl font-black text-white">${kpis.net_profit?.toLocaleString()}</h3>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Graph Placeholder / Expenses List */}
                <div className="bg-slate-900/40 rounded-[2.5rem] border border-slate-800 p-8 space-y-6">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <ArrowDownRight className="text-rose-500" size={16} />
                        Detalle de Gastos
                    </h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {financeData.expenses.map((exp, i) => (
                            <div key={i} className="flex justify-between items-center bg-slate-800/30 p-4 rounded-2xl border border-slate-700/30 group">
                                <div>
                                    <p className="text-sm font-bold text-white">{exp.description}</p>
                                    <p className="text-[10px] text-slate-500 font-black uppercase">{exp.category}</p>
                                </div>
                                <span className="text-rose-400 font-black">${exp.amount?.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sales List */}
                <div className="bg-slate-900/40 rounded-[2.5rem] border border-slate-800 p-8 space-y-6">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <ArrowUpRight className="text-emerald-500" size={16} />
                        Ultimos Movimientos
                    </h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {salesData.sales.map((sale, i) => (
                            <div key={i} className="flex justify-between items-center bg-slate-800/30 p-4 rounded-2xl border border-slate-700/30">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-xs">
                                        {sale.student[0]}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">{sale.student}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">{sale.program}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-emerald-400 font-black text-sm">${sale.amount?.toLocaleString()}</p>
                                    <p className="text-[9px] text-slate-600 uppercase font-bold">{new Date(sale.date).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalysisPage;
