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
    ChevronRight,
    Receipt,
    Construction
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ExpensesManagerModal from '../components/ExpensesManagerModal';

const AdminFinancePage = () => {
    const [activeTab, setActiveTab] = useState('general');
    const [financeData, setFinanceData] = useState({ expenses: [], kpis: {} });
    const [salesData, setSalesData] = useState({ sales: [], pages: 1 });
    const [loading, setLoading] = useState(true);
    const [salesPage, setSalesPage] = useState(1);
    const [isExpensesModalOpen, setIsExpensesModalOpen] = useState(false);

    useEffect(() => {
        if (activeTab === 'general') {
            fetchAll();
        }
    }, [salesPage, activeTab]);

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

    const renderGeneralTab = () => {
        const kpis = financeData.kpis;
        return (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* KPI Section */}
                <div id="finance-kpis" className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card variant="surface" className="flex flex-col justify-center rounded-[2rem]">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Revenue</p>
                        <h3 className="text-2xl font-black text-base italic tracking-tighter">${kpis.gross_revenue?.toLocaleString()}</h3>
                        <p className="text-[9px] font-bold text-emerald-400 uppercase mt-1">{kpis.enrollments_count} inscripciones</p>
                    </Card>
                    <Card id="finance-summary-card" variant="surface" className="flex flex-col justify-center border-success/20 bg-success/5 rounded-[2rem]">
                        <p className="text-[10px] font-black text-success/60 uppercase tracking-widest mb-2">Cash Collect</p>
                        <h3 className="text-2xl font-black text-success italic tracking-tighter">${kpis.cash_collected?.toLocaleString()}</h3>
                        <div className="flex flex-col gap-0.5 mt-2 opacity-80">
                            <div className="flex justify-between items-center text-[9px] uppercase tracking-wider font-bold text-success/70">
                                <span>Bruto</span>
                                <span>${kpis.total_payments?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] uppercase tracking-wider font-bold text-rose-400/70">
                                <span>Fees</span>
                                <span>-${kpis.total_commission?.toLocaleString()}</span>
                            </div>
                        </div>
                    </Card>
                    <Card variant="surface" className="flex flex-col justify-center border-accent/20 bg-accent/5 rounded-[2rem]">
                        <p className="text-[10px] font-black text-accent/60 uppercase tracking-widest mb-2">Egresos Totales</p>
                        <h3 className="text-2xl font-black text-accent italic tracking-tighter">${kpis.total_expenses?.toLocaleString()}</h3>
                    </Card>
                    <Card variant="surface" className="flex flex-col justify-center bg-primary border-primary shadow-xl shadow-primary/20 rounded-[2rem]">
                        <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-2">Agendas</p>
                        <h3 className="text-2xl font-black text-white italic tracking-tighter">{kpis.agendas_count?.toLocaleString()}</h3>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Expenses List */}
                    <Card variant="surface" className="p-8 space-y-6 rounded-[2.5rem]">
                        <div className="flex justify-between items-center">
                            <h3 className="text-[10px] font-black text-base uppercase tracking-widest flex items-center gap-2">
                                <ArrowDownRight className="text-accent" size={16} />
                                Detalle de Gastos
                            </h3>
                            <Button
                                onClick={() => setIsExpensesModalOpen(true)}
                                variant="ghost"
                                size="sm"
                                icon={Receipt}
                                className="text-[10px] uppercase tracking-widest hover:bg-white/5"
                            >
                                Gestionar
                            </Button>
                        </div>
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
                    <Card variant="surface" className="p-8 space-y-6 rounded-[2.5rem]">
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
                                            <p className="text-sm font-bold text-base">{sale.student[1]}</p>
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

    const renderConstructionState = (title) => (
        <div className="flex flex-col items-center justify-center h-[50vh] gap-6 text-muted animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 rounded-3xl bg-surface border border-base flex items-center justify-center">
                <Construction size={40} className="text-primary/60" />
            </div>
            <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-base italic">Sección {title}</h3>
                <p className="text-xs font-bold uppercase tracking-widest opacity-60">Esta vista está actualmente en construcción</p>
            </div>
        </div>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-white italic tracking-tighter">Finanzas</h1>
                    <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Gestión y Análisis Financiero</p>
                </div>

                <div id="finance-tabs" className="flex bg-slate-900/40 p-1.5 rounded-[2rem] border border-slate-800">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'general'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                            : 'text-slate-500 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        General
                    </button>
                    <button
                        onClick={() => setActiveTab('closers')}
                        className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'closers'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                            : 'text-slate-500 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        Closers
                    </button>
                    <button
                        onClick={() => setActiveTab('setters')}
                        className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'setters'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                            : 'text-slate-500 hover:text-white hover:bg-slate-800'
                            }`}
                    >
                        Setters
                    </button>
                </div>
            </header>

            <ExpensesManagerModal
                isOpen={isExpensesModalOpen}
                onClose={() => setIsExpensesModalOpen(false)}
                onSuccess={fetchAll}
            />

            {activeTab === 'general' ? (
                loading ? (
                    <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-primary font-bold uppercase tracking-widest text-sm">Cargando Finanzas...</p>
                    </div>
                ) : renderGeneralTab()
            ) : activeTab === 'closers' ? (
                renderConstructionState('de Closers')
            ) : (
                renderConstructionState('de Setters')
            )}
        </div>
    );
};

export default AdminFinancePage;
