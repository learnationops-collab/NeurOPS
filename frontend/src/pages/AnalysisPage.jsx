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
    ChevronRight
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

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

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-primary font-bold uppercase tracking-widest text-sm">Calculando Rendimiento...</p>
        </div>
    );

    const kpis = financeData.kpis;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="space-y-1">
                <h1 className="text-4xl font-black text-base italic tracking-tighter">Análisis Detallado</h1>
                <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Rendimiento Económico y Comercial</p>
            </header>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card variant="surface" className="flex flex-col justify-center">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Ingresos Brutos</p>
                    <h3 className="text-2xl font-black text-base italic tracking-tighter">${kpis.gross_revenue?.toLocaleString()}</h3>
                </Card>
                <Card variant="surface" className="flex flex-col justify-center border-success/20 bg-success/5">
                    <p className="text-[10px] font-black text-success/60 uppercase tracking-widest mb-2">Caja Neta</p>
                    <h3 className="text-2xl font-black text-success italic tracking-tighter">${kpis.cash_collected?.toLocaleString()}</h3>
                </Card>
                <Card variant="surface" className="flex flex-col justify-center border-accent/20 bg-accent/5">
                    <p className="text-[10px] font-black text-accent/60 uppercase tracking-widest mb-2">Egresos Totales</p>
                    <h3 className="text-2xl font-black text-accent italic tracking-tighter">${kpis.total_expenses?.toLocaleString()}</h3>
                </Card>
                <Card variant="surface" className="flex flex-col justify-center bg-primary border-primary shadow-xl shadow-primary/20">
                    <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-2">Utilidad Estimada</p>
                    <h3 className="text-2xl font-black text-white italic tracking-tighter">${kpis.net_profit?.toLocaleString()}</h3>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Graph Placeholder / Expenses List */}
                <Card variant="surface" className="p-8 space-y-6">
                    <h3 className="text-[10px] font-black text-base uppercase tracking-widest flex items-center gap-2">
                        <ArrowDownRight className="text-accent" size={16} />
                        Detalle de Gastos
                    </h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {financeData.expenses.map((exp, i) => (
                            <div key={i} className="flex justify-between items-center bg-main p-4 rounded-2xl border border-base group hover:border-accent/30 transition-all">
                                <div>
                                    <p className="text-sm font-bold text-base">{exp.description}</p>
                                    <p className="text-[10px] text-muted font-black uppercase">{exp.category}</p>
                                </div>
                                <span className="text-accent font-black tracking-tighter">${exp.amount?.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Sales List */}
                <Card variant="surface" className="p-8 space-y-6">
                    <h3 className="text-[10px] font-black text-base uppercase tracking-widest flex items-center gap-2">
                        <ArrowUpRight className="text-success" size={16} />
                        Últimos Movimientos
                    </h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {salesData.sales.map((sale, i) => (
                            <div key={i} className="flex justify-between items-center bg-main p-4 rounded-2xl border border-base hover:border-success/30 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center font-black text-sm">
                                        {sale.student[0]}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-base">{sale.student}</p>
                                        <p className="text-[10px] text-muted font-black uppercase">{sale.program}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-success font-black text-sm tracking-tighter">${sale.amount?.toLocaleString()}</p>
                                    <p className="text-[9px] text-muted uppercase font-bold">{new Date(sale.date).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AnalysisPage;
