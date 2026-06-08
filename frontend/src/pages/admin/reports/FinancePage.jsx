import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Calendar,
    Users,
    Percent,
    X,
    Plus,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Edit2,
    Trash2,
    Wallet,
    Laptop,
    Settings,
    ShieldAlert,
    Check,
    BookmarkCheck
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';

// Helper to get current YYYY-MM
const getCurrentMonthStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

const FinancePage = () => {
    const { user } = useAuth();
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr());
    const [activeTab, setActiveTab] = useState('summary');
    const [summary, setSummary] = useState(null);
    const [balances, setBalances] = useState([]);
    const [payroll, setPayroll] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [savings, setSavings] = useState(0);
    const [loading, setLoading] = useState(true);

    // Expenses CRUD State
    const [expensesList, setExpensesList] = useState([]);
    const [loadingExpenses, setLoadingExpenses] = useState(false);
    const [newExpense, setNewExpense] = useState({
        description: '',
        amount: '',
        category: 'software',
        date: new Date().toISOString().split('T')[0]
    });

    // Team member Modal CRUD state
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [memberModalType, setMemberModalType] = useState('create'); // 'create' | 'edit'
    const [selectedMember, setSelectedMember] = useState(null);
    const [memberForm, setMemberForm] = useState({
        name: '',
        role: 'Setter',
        salary_type: 'fijo',
        base_salary: '',
        payment_method: 'Stripe'
    });

    // Permission check
    const isAuthorized = user?.role === 'admin' && user?.can_view_finance;

    useEffect(() => {
        if (isAuthorized) {
            fetchData();
        }
    }, [selectedMonth, activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'summary') {
                const [sumRes, savRes] = await Promise.all([
                    api.get(`/public/finance/summary?month=${selectedMonth}`),
                    api.get(`/public/finance/savings?month=${selectedMonth}`)
                ]);
                setSummary(sumRes.data);
                setSavings(savRes.data.savings);
            } else if (activeTab === 'balances') {
                const res = await api.get(`/public/finance/balances?month=${selectedMonth}`);
                setBalances(res.data.balances);
            } else if (activeTab === 'payroll') {
                const [payRes, teamRes] = await Promise.all([
                    api.get(`/public/finance/payroll?month=${selectedMonth}`),
                    api.get('/public/finance/team-members')
                ]);
                setPayroll(payRes.data);
                setTeamMembers(teamRes.data);
            } else if (activeTab === 'expenses') {
                fetchExpenses();
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar datos financieros');
        } finally {
            setLoading(false);
        }
    };

    const fetchExpenses = async () => {
        setLoadingExpenses(true);
        try {
            const [year, month] = selectedMonth.split('-');
            const startDate = `${year}-${month}-01`;
            // Último día del mes seleccionado
            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
            const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

            const res = await api.get(`/admin/finance/overview?start_date=${startDate}&end_date=${endDate}`);
            const expensesFiltered = (res.data.expenses || []).filter(e =>
                e.category?.toLowerCase() === 'software'
            );
            setExpensesList(expensesFiltered);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar detalle de gastos');
        } finally {
            setLoadingExpenses(false);
        }
    };

    // Save Savings manual input
    const handleSaveSavings = async (val) => {
        try {
            await api.post('/public/finance/savings', { month: selectedMonth, savings: parseFloat(val) || 0.0 });
            setSavings(parseFloat(val) || 0.0);
            // Refetch summary to update net balance
            const sumRes = await api.get(`/public/finance/summary?month=${selectedMonth}`);
            setSummary(sumRes.data);
            toast.success('Ahorros guardados');
        } catch (error) {
            toast.error('Error al guardar ahorros');
        }
    };

    // Update balances (Lo que hay & Lo que debe haber)
    const handleBalanceChange = async (methodName, field, value) => {
        const numVal = parseFloat(value) || 0.0;
        try {
            await api.post('/public/finance/balances', {
                month: selectedMonth,
                payment_method: methodName,
                [field]: numVal
            });
            // Update state locally
            setBalances(prev => prev.map(b => b.payment_method === methodName ? { ...b, [field]: numVal } : b));
        } catch (error) {
            toast.error('Error al guardar balance');
        }
    };

    // Save/Update payroll member entry in month
    const handlePayrollChange = async (memberId, field, value) => {
        const currentPayroll = payroll.find(p => p.member_id === memberId);
        if (!currentPayroll) return;

        let payload = {
            member_id: memberId,
            month: selectedMonth,
            base_salary: currentPayroll.base_salary,
            commissions: currentPayroll.commissions,
            bonuses: currentPayroll.bonuses,
            payment_method: currentPayroll.payment_method || '',
            is_paid: currentPayroll.is_paid
        };

        if (field === 'is_paid') {
            payload.is_paid = value;
        } else if (field === 'payment_method') {
            payload.payment_method = value;
        } else {
            payload[field] = parseFloat(value) || 0.0;
        }

        try {
            const res = await api.post('/public/finance/payroll', payload);
            setPayroll(prev => prev.map(p => p.member_id === memberId ? res.data : p));
            toast.success('Cambio en nómina guardado');
        } catch (error) {
            toast.error('Error al actualizar nómina');
        }
    };

    // Team Member CRUD
    const handleOpenMemberModal = (type, member = null) => {
        setMemberModalType(type);
        setSelectedMember(member);
        if (type === 'edit' && member) {
            setMemberForm({
                name: member.name,
                role: member.role,
                salary_type: member.salary_type,
                base_salary: member.base_salary,
                payment_method: member.payment_method || 'Stripe'
            });
        } else {
            setMemberForm({
                name: '',
                role: 'Setter',
                salary_type: 'fijo',
                base_salary: '',
                payment_method: 'Stripe'
            });
        }
        setIsMemberModalOpen(true);
    };

    const handleSaveMember = async (e) => {
        e.preventDefault();
        try {
            if (memberModalType === 'create') {
                await api.post('/public/finance/team-members', memberForm);
                toast.success('Integrante creado');
            } else {
                await api.put(`/public/finance/team-members/${selectedMember.id}`, memberForm);
                toast.success('Integrante actualizado');
            }
            setIsMemberModalOpen(false);
            // Refresh payroll tab data
            const [payRes, teamRes] = await Promise.all([
                api.get(`/public/finance/payroll?month=${selectedMonth}`),
                api.get('/public/finance/team-members')
            ]);
            setPayroll(payRes.data);
            setTeamMembers(teamRes.data);
        } catch (error) {
            toast.error('Error al guardar integrante');
        }
    };

    const handleDeleteMember = async (id, name) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar a ${name}?`)) return;
        try {
            await api.delete(`/public/finance/team-members/${id}`);
            toast.success('Integrante eliminado');
            setTeamMembers(prev => prev.filter(m => m.id !== id));
            setPayroll(prev => prev.filter(p => p.member_id !== id));
        } catch (error) {
            toast.error('Error al eliminar integrante');
        }
    };

    // Expenses category EQUIPO and SOFTWARE CRUD
    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!newExpense.description || !newExpense.amount) {
            toast.error('Completa los campos obligatorios');
            return;
        }

        try {
            await api.post('/admin/finance/expenses', {
                description: newExpense.description,
                amount: parseFloat(newExpense.amount),
                category: newExpense.category,
                date: newExpense.date
            });
            toast.success('Gasto registrado con éxito');
            setNewExpense({
                description: '',
                amount: '',
                category: 'software',
                date: new Date().toISOString().split('T')[0]
            });
            fetchExpenses();
        } catch (error) {
            toast.error('Error al registrar gasto');
        }
    };

    const handleDeleteExpense = async (id) => {
        if (!window.confirm('¿Deseas eliminar este gasto?')) return;
        try {
            await api.delete(`/admin/finance/expenses/${id}`);
            toast.success('Gasto eliminado');
            fetchExpenses();
        } catch (error) {
            toast.error('Error al eliminar gasto');
        }
    };

    // Non-authorized screen
    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 max-w-xl mx-auto space-y-6 text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 rounded-[2.5rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-xl shadow-rose-500/5">
                    <ShieldAlert size={48} />
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white">Acceso Restringido</h1>
                    <p className="text-sm font-bold uppercase tracking-wider text-slate-400">No tienes permisos para ver el Panel de Finanzas.</p>
                    <p className="text-xs text-slate-500 leading-relaxed mt-2">
                        Esta sección contiene datos financieros privados de alta confidencialidad. Solicita autorización al administrador de operaciones si es necesario.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header with Selector */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-2">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase flex items-center gap-2">
                        <Wallet className="text-indigo-400" size={32} />
                        Hub de Finanzas
                    </h1>
                    <p className="text-muted font-medium uppercase text-xs tracking-[0.25em]">Centro operativo y análisis de rentabilidad corporativa</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 hover:border-slate-700 px-4 py-2.5 rounded-2xl transition-all focus-within:border-indigo-500 shrink-0">
                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider shrink-0">Período:</span>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none text-xs font-bold text-slate-200 focus:outline-none focus:ring-0 cursor-pointer w-28 text-center"
                        />
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div className="flex bg-slate-900/40 p-1.5 rounded-[2rem] border border-slate-800/80 max-w-3xl overflow-x-auto shrink-0 custom-scrollbar">
                {[
                    { id: 'summary', label: 'Resumen' },
                    { id: 'balances', label: 'Medios de Pago' },
                    { id: 'payroll', label: 'Nómina (Equipo)' },
                    { id: 'expenses', label: 'Software' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 min-w-[120px] px-6 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                            activeTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20'
                                : 'text-slate-500 hover:text-white hover:bg-slate-800/40'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Loader2 className="animate-spin text-indigo-500 w-12 h-12" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Cargando datos del período...</span>
                </div>
            ) : (
                <>
                    {/* TAB 1: SUMMARY */}
                    {activeTab === 'summary' && summary && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* KPI Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <Card variant="surface" className="flex flex-col justify-center rounded-[2rem] bg-indigo-950/10 border-indigo-900/30">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Profit (Balances - Gastos)</p>
                                    <h3 className={`text-2xl font-black italic tracking-tighter ${summary.kpis.profit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                        ${summary.kpis.profit?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </h3>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Rentabilidad según saldos de pasarelas</p>
                                </Card>

                                <Card variant="surface" className="flex flex-col justify-center rounded-[2rem] bg-emerald-950/10 border-emerald-900/30">
                                    <p className="text-[10px] font-black text-emerald-400/80 uppercase tracking-widest mb-1.5">Ingresos Totales (Cash Collect)</p>
                                    <h3 className="text-2xl font-black text-emerald-400 italic tracking-tighter">
                                        ${summary.kpis.total_income?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </h3>
                                    <p className="text-[9px] font-bold text-slate-550 uppercase mt-1">Monto neto de ventas completadas</p>
                                </Card>

                                <Card variant="surface" className="flex flex-col justify-center rounded-[2rem] bg-rose-950/10 border-rose-900/30">
                                    <p className="text-[10px] font-black text-rose-400/80 uppercase tracking-widest mb-1.5">Gastos Totales</p>
                                    <h3 className="text-2xl font-black text-rose-500 italic tracking-tighter">
                                        ${summary.kpis.total_expenses?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </h3>
                                    <p className="text-[9px] font-bold text-slate-550 uppercase mt-1">Sueldos, Anuncios, Software y Equipos</p>
                                </Card>

                                <Card variant="surface" className="flex flex-col justify-center rounded-[2rem] bg-slate-900/40 border-slate-800/80">
                                    <p className="text-[10px] font-black text-indigo-400/80 uppercase tracking-widest mb-1.5">Balances en Pasarelas</p>
                                    <h3 className="text-2xl font-black text-slate-200 italic tracking-tighter">
                                        ${summary.kpis.total_actual_balances?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </h3>
                                    <p className="text-[9px] font-bold text-slate-550 uppercase mt-1">Total acumulado en medios de pago</p>
                                </Card>
                            </div>

                            {/* Inner Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Left Side: Expenses and Income breakdown */}
                                <div className="space-y-6">
                                    {/* Breakdown de Gastos */}
                                    <Card variant="surface" className="p-6 rounded-[2.5rem] border-slate-800/80 bg-slate-900/10">
                                        <h3 className="text-xs font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                                            <TrendingDown className="text-rose-500" size={16} />
                                            Distribución de Gastos
                                        </h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            {[
                                                { label: 'Equipo (Nómina)', amount: summary.expenses_breakdown.sueldos, color: 'text-rose-400', bg: 'bg-rose-500/5' },
                                                { label: 'Inversión Anuncios', amount: summary.expenses_breakdown.anuncios, color: 'text-violet-400', bg: 'bg-violet-500/5' },
                                                { label: 'Suscripciones Software', amount: summary.expenses_breakdown.software, color: 'text-amber-400', bg: 'bg-amber-500/5' },
                                            ].map((item, idx) => (
                                                <div key={idx} className={`p-4 rounded-2xl border border-slate-800 bg-slate-950/40 hover:border-slate-700 transition-all ${item.bg}`}>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{item.label}</p>
                                                    <h4 className={`text-lg font-black tracking-tight mt-1 ${item.color}`}>
                                                        ${item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </h4>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>

                                    {/* Ingresos por Método de Pago */}
                                    <Card variant="surface" className="p-6 rounded-[2.5rem] border-slate-800/80 bg-slate-900/10">
                                        <h3 className="text-xs font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                                            <TrendingUp className="text-emerald-400" size={16} />
                                            Ingresos por Método de Pago
                                        </h3>
                                        <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                            {summary.income_breakdown.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-slate-950/60 p-4 rounded-2xl border border-slate-800 hover:border-emerald-500/20 transition-all">
                                                    <div>
                                                        <span className="text-xs font-black uppercase text-slate-200">{item.metodo_pago}</span>
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase ml-2">({item.count} {item.count === 1 ? 'venta' : 'ventas'})</span>
                                                    </div>
                                                    <span className="text-emerald-400 font-black tracking-tighter">
                                                        ${item.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            ))}
                                            {summary.income_breakdown.length === 0 && (
                                                <p className="text-center text-slate-500 text-xs italic py-4">No se registraron ingresos en este mes.</p>
                                            )}
                                        </div>
                                    </Card>
                                </div>

                                {/* Right Side: Balance Sheet */}
                                <Card variant="surface" className="p-6 rounded-[2.5rem] border-slate-800/80 bg-slate-900/10 flex flex-col">
                                    <h3 className="text-xs font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                                        <BookmarkCheck className="text-indigo-400" size={16} />
                                        Balance del Período
                                    </h3>
                                    <div className="flex-1 flex flex-col justify-between space-y-6">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
                                                <span className="text-xs font-bold text-slate-300 uppercase">Ingresos Totales (A)</span>
                                                <span className="text-sm font-black text-emerald-400">${summary.kpis.total_income?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
                                                <span className="text-xs font-bold text-slate-300 uppercase">Gastos Totales (B)</span>
                                                <span className="text-sm font-black text-rose-400">-${summary.kpis.total_expenses?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
                                                <div className="space-y-0.5">
                                                    <span className="text-xs font-bold text-slate-300 uppercase block">Ahorros Mensuales (C)</span>
                                                    <span className="text-[10px] text-slate-500 uppercase font-black block">Ingreso manual</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-400 font-bold">$</span>
                                                    <input
                                                        type="number"
                                                        placeholder="0.00"
                                                        value={savings}
                                                        onChange={(e) => setSavings(e.target.value)}
                                                        onBlur={(e) => handleSaveSavings(e.target.value)}
                                                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-right font-black text-slate-200 outline-none w-32 focus:border-indigo-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6 bg-indigo-950/15 border border-indigo-900/30 rounded-3xl mt-4 space-y-3">
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Balance General (A - B)</span>
                                                <span className={`text-xl font-black italic tracking-tighter ${summary.kpis.balance >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                                    ${summary.kpis.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-800/50 h-px" />
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Balance Neto (A - B - C)</span>
                                                <span className={`text-xl font-black italic tracking-tighter ${summary.kpis.balance_neto >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                                    ${summary.kpis.balance_neto?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: BALANCES */}
                    {activeTab === 'balances' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <Card variant="surface" className="p-6 rounded-[2.5rem] border-slate-800/80 bg-slate-900/10">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="text-xs font-black text-white uppercase tracking-wider">Saldos en Medios de Pago</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-1">Saldo actual vs. lo que se debe pagar al equipo por pasarela.</p>
                                    </div>
                                </div>

                                <div className="overflow-x-auto w-full">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                                                <th className="p-4 font-semibold">Pasarela</th>
                                                <th className="p-4 font-semibold text-right">Saldo Actual</th>
                                                <th className="p-4 font-semibold text-right">Por Pagar (Nómina)</th>
                                                <th className="p-4 font-semibold text-right">Diferencia</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm text-slate-300 divide-y divide-slate-800/40">
                                            {balances.map((item, idx) => {
                                                const diff = item.actual_amount - item.expected_amount;
                                                const absDiff = Math.abs(diff);
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-800/10 transition-colors">
                                                        <td className="p-4 font-black text-slate-100 uppercase tracking-wide">{item.payment_method}</td>
                                                        <td className="p-4 text-right">
                                                            <div className="flex justify-end items-center gap-2">
                                                                <span className="text-slate-500 text-xs">$</span>
                                                                <input
                                                                    type="number"
                                                                    defaultValue={item.actual_amount}
                                                                    onBlur={(e) => handleBalanceChange(item.payment_method, 'actual_amount', e.target.value)}
                                                                    placeholder="0.00"
                                                                    className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-right font-mono font-bold text-slate-200 outline-none w-32 focus:border-indigo-500 transition-all"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <span className="text-sm font-black font-mono text-amber-300">
                                                                ${item.expected_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </span>
                                                            <p className="text-[9px] text-slate-500 uppercase font-black mt-0.5">Auto-calc</p>
                                                        </td>
                                                        <td className={`p-4 text-right font-mono font-black italic ${
                                                            diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-emerald-400' : 'text-rose-500'
                                                        }`}>
                                                            {diff === 0 ? '$0.00' : (diff > 0
                                                                ? `+$${diff.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                                                : `-$${absDiff.toLocaleString(undefined, { minimumFractionDigits: 2 })}`)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        {balances.length > 0 && (() => {
                                            const totalActual = balances.reduce((s, b) => s + b.actual_amount, 0);
                                            const totalExpected = balances.reduce((s, b) => s + b.expected_amount, 0);
                                            const totalDiff = totalActual - totalExpected;
                                            const absTotalDiff = Math.abs(totalDiff);
                                            return (
                                                <tfoot>
                                                    <tr className="border-t-2 border-slate-700 bg-slate-900/30">
                                                        <td className="p-4 text-xs font-black text-white uppercase tracking-widest">Total</td>
                                                        <td className="p-4 text-right">
                                                            <span className="text-sm font-black font-mono text-slate-200">${totalActual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <span className="text-sm font-black font-mono text-amber-300">${totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        </td>
                                                        <td className={`p-4 text-right font-mono font-black italic ${
                                                            totalDiff === 0 ? 'text-slate-400' : totalDiff > 0 ? 'text-emerald-400' : 'text-rose-500'
                                                        }`}>
                                                            {totalDiff === 0 ? '$0.00' : (totalDiff > 0
                                                                ? `+$${totalDiff.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                                                : `-$${absTotalDiff.toLocaleString(undefined, { minimumFractionDigits: 2 })}`)}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            );
                                        })()}
                                    </table>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* TAB 3: PAYROLL */}
                    {activeTab === 'payroll' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Payroll Table */}
                            <Card variant="surface" className="p-6 rounded-[2.5rem] border-slate-800/80 bg-slate-900/10">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="text-xs font-black text-white uppercase tracking-wider">Nómina del Mes</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-1">Registra sueldos fijos, comisiones variables, bonos e indicadores de pago.</p>
                                    </div>
                                    <Button
                                        onClick={() => handleOpenMemberModal('create')}
                                        variant="primary"
                                        size="sm"
                                        icon={Plus}
                                        className="text-[10px] font-black uppercase tracking-wider px-4 rounded-xl shadow-brand-glow"
                                    >
                                        Nuevo Integrante
                                    </Button>
                                </div>

                                <div className="overflow-x-auto w-full">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                                                <th className="p-4 font-semibold">Miembro / Rol</th>
                                                <th className="p-4 font-semibold text-right">Sueldo Base</th>
                                                <th className="p-4 font-semibold text-right">Comisión</th>
                                                <th className="p-4 font-semibold text-right">Bonos</th>
                                                <th className="p-4 font-semibold">Medio de Pago</th>
                                                <th className="p-4 font-semibold text-center">Pagado</th>
                                                <th className="p-4 font-semibold text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm text-slate-300 divide-y divide-slate-800/40">
                                            {/* Equipo Fijo */}
                                            <tr>
                                                <td colSpan={7} className="pt-3 pb-1 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                                        <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">Equipo Fijo</span>
                                                    </div>
                                                </td>
                                            </tr>
                                            {payroll.filter(item => {
                                                const m = teamMembers.find(t => t.id === item.member_id);
                                                return m?.salary_type !== 'variable';
                                            }).map((item) => {
                                                const member = teamMembers.find(m => m.id === item.member_id);
                                                const baseSal = item.base_salary;
                                                const comm = item.commissions;
                                                const bon = item.bonuses;
                                                return (
                                                    <tr key={`fijo-${item.member_id}`} className={`hover:bg-slate-800/10 transition-colors ${item.is_paid ? 'opacity-80' : ''}`}>
                                                        <td className="p-4">
                                                            <p className="font-black text-slate-100 uppercase tracking-wide text-xs">{item.member_name}</p>
                                                            <p className="text-[9px] text-slate-500 font-black uppercase mt-0.5">{member?.role || 'Miembro'}</p>
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-slate-200">
                                                            <input type="number" defaultValue={baseSal} onBlur={(e) => handlePayrollChange(item.member_id, 'base_salary', e.target.value)} placeholder="0.00" className="bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold text-slate-200 outline-none w-24 focus:border-indigo-500 transition-all" />
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-slate-200">
                                                            <input type="number" defaultValue={comm} onBlur={(e) => handlePayrollChange(item.member_id, 'commissions', e.target.value)} placeholder="0.00" className="bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold text-slate-200 outline-none w-24 focus:border-indigo-500 transition-all" />
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-slate-200">
                                                            <input type="number" defaultValue={bon} onBlur={(e) => handlePayrollChange(item.member_id, 'bonuses', e.target.value)} placeholder="0.00" className="bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold text-slate-200 outline-none w-24 focus:border-indigo-500 transition-all" />
                                                        </td>
                                                        <td className="p-4 text-xs font-semibold">
                                                            <select defaultValue={item.payment_method || 'Stripe'} onChange={(e) => handlePayrollChange(item.member_id, 'payment_method', e.target.value)} className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1 text-xs font-bold text-slate-200 outline-none focus:border-indigo-500 cursor-pointer">
                                                                <option value="Stripe">Stripe</option>
                                                                <option value="AirTM">AirTM</option>
                                                            </select>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <button onClick={() => handlePayrollChange(item.member_id, 'is_paid', !item.is_paid)} className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${item.is_paid ? 'bg-indigo-650 text-white border-indigo-600' : 'border-slate-850 bg-slate-950/60 text-slate-700 hover:border-slate-700'}`}>
                                                                {item.is_paid && <Check size={14} strokeWidth={3} />}
                                                            </button>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <div className="flex gap-2 justify-center">
                                                                <button onClick={() => handleOpenMemberModal('edit', member)} className="p-1.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 hover:text-white hover:border-indigo-500 transition-all" title="Editar"><Edit2 size={12} /></button>
                                                                <button onClick={() => handleDeleteMember(item.member_id, item.member_name)} className="p-1.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 hover:text-rose-500 hover:border-rose-500/50 transition-all" title="Eliminar"><Trash2 size={12} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {/* Equipo Variable */}
                                            <tr>
                                                <td colSpan={7} className="pt-6 pb-1 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                                        <span className="text-[10px] font-black text-emerald-300 uppercase tracking-[0.2em]">Equipo Variable (Comisiones)</span>
                                                    </div>
                                                </td>
                                            </tr>
                                            {payroll.filter(item => {
                                                const m = teamMembers.find(t => t.id === item.member_id);
                                                return m?.salary_type === 'variable';
                                            }).map((item) => {
                                                const member = teamMembers.find(m => m.id === item.member_id);
                                                const baseSal = item.base_salary;
                                                const comm = item.commissions;
                                                const bon = item.bonuses;
                                                return (
                                                    <tr key={`var-${item.member_id}`} className={`hover:bg-slate-800/10 transition-colors ${item.is_paid ? 'opacity-80' : ''}`}>
                                                        <td className="p-4">
                                                            <p className="font-black text-slate-100 uppercase tracking-wide text-xs">{item.member_name}</p>
                                                            <p className="text-[9px] text-slate-500 font-black uppercase mt-0.5">{member?.role || 'Miembro'}</p>
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-slate-200">
                                                            <input type="number" defaultValue={baseSal} onBlur={(e) => handlePayrollChange(item.member_id, 'base_salary', e.target.value)} placeholder="0.00" className="bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold text-slate-200 outline-none w-24 focus:border-indigo-500 transition-all" />
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-slate-200">
                                                            <input type="number" defaultValue={comm} onBlur={(e) => handlePayrollChange(item.member_id, 'commissions', e.target.value)} placeholder="0.00" className="bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold text-slate-200 outline-none w-24 focus:border-indigo-500 transition-all" />
                                                        </td>
                                                        <td className="p-4 text-right font-mono text-slate-200">
                                                            <input type="number" defaultValue={bon} onBlur={(e) => handlePayrollChange(item.member_id, 'bonuses', e.target.value)} placeholder="0.00" className="bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1 text-xs text-right font-mono font-bold text-slate-200 outline-none w-24 focus:border-indigo-500 transition-all" />
                                                        </td>
                                                        <td className="p-4 text-xs font-semibold">
                                                            <select defaultValue={item.payment_method || 'Stripe'} onChange={(e) => handlePayrollChange(item.member_id, 'payment_method', e.target.value)} className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1 text-xs font-bold text-slate-200 outline-none focus:border-indigo-500 cursor-pointer">
                                                                <option value="Stripe">Stripe</option>
                                                                <option value="AirTM">AirTM</option>
                                                            </select>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <button onClick={() => handlePayrollChange(item.member_id, 'is_paid', !item.is_paid)} className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${item.is_paid ? 'bg-indigo-650 text-white border-indigo-600' : 'border-slate-850 bg-slate-950/60 text-slate-700 hover:border-slate-700'}`}>
                                                                {item.is_paid && <Check size={14} strokeWidth={3} />}
                                                            </button>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <div className="flex gap-2 justify-center">
                                                                <button onClick={() => handleOpenMemberModal('edit', member)} className="p-1.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 hover:text-white hover:border-indigo-500 transition-all" title="Editar"><Edit2 size={12} /></button>
                                                                <button onClick={() => handleDeleteMember(item.member_id, item.member_name)} className="p-1.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 hover:text-rose-500 hover:border-rose-500/50 transition-all" title="Eliminar"><Trash2 size={12} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {payroll.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="p-12 text-center text-slate-500 italic">
                                                        No hay integrantes registrados en el equipo.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* TAB 4: EXPENSES */}
                    {activeTab === 'expenses' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Add Expense Form */}
                            <Card variant="surface" className="p-6 rounded-[2.5rem] border-slate-800/80 bg-slate-900/10 lg:col-span-4 self-start">
                                <h3 className="text-xs font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <Plus className="text-indigo-400" size={16} />
                                    Nuevo Gasto
                                </h3>
                                <form onSubmit={handleAddExpense} className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Descripción</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej: Suscripción Zoom"
                                            value={newExpense.description}
                                            onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-all font-bold"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monto ($)</label>
                                        <input
                                            type="number"
                                            required
                                            placeholder="0.00"
                                            value={newExpense.amount}
                                            onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-all font-mono font-bold"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fecha de Pago</label>
                                        <input
                                            type="date"
                                            required
                                            value={newExpense.date}
                                            onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-all font-bold"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Categoría</label>
                                        <select
                                            value={newExpense.category}
                                            onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-all font-bold cursor-pointer"
                                        >
                                            <option value="software">Software / Herramientas</option>
                                        </select>
                                    </div>

                                    <Button
                                        type="submit"
                                        variant="primary"
                                        className="w-full py-4 mt-6 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-brand-glow"
                                    >
                                        Registrar Gasto
                                    </Button>
                                </form>
                            </Card>

                            {/* Expenses List */}
                            <Card variant="surface" className="p-6 rounded-[2.5rem] border-slate-800/80 bg-slate-900/10 lg:col-span-8">
                                <h3 className="text-xs font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <Laptop className="text-indigo-400" size={16} />
                                    Detalle Gastos de Equipo / Software
                                </h3>

                                {loadingExpenses ? (
                                    <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
                                ) : (
                                    <div className="overflow-x-auto w-full">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                                                    <th className="p-4 font-semibold">Descripción</th>
                                                    <th className="p-4 font-semibold">Categoría</th>
                                                    <th className="p-4 font-semibold">Fecha</th>
                                                    <th className="p-4 font-semibold text-right">Monto</th>
                                                    <th className="p-4 font-semibold text-center">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-sm text-slate-350 divide-y divide-slate-800/40">
                                                {expensesList.map((exp) => (
                                                    <tr key={exp.id} className="hover:bg-slate-800/10 transition-colors">
                                                        <td className="p-4 font-bold text-slate-200">
                                                            {exp.description}
                                                        </td>
                                                        <td className="p-4">
                                                            <Badge className="text-[8px] font-black uppercase px-2 py-0.5 bg-slate-800 border-slate-700 text-slate-300">
                                                                {exp.category === 'software' ? 'Software' : 'Equipos'}
                                                            </Badge>
                                                        </td>
                                                        <td className="p-4 text-xs font-semibold">
                                                            {new Date(exp.date).toLocaleDateString()}
                                                        </td>
                                                        <td className="p-4 text-right font-mono font-black text-rose-400">
                                                            -${exp.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <button
                                                                onClick={() => handleDeleteExpense(exp.id)}
                                                                className="p-1.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 hover:text-rose-550 hover:border-rose-500/50 transition-all cursor-pointer"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {expensesList.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="p-12 text-center text-slate-500 italic">
                                                            No hay gastos registrados en este período.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </Card>
                        </div>
                    )}
                </>
            )}

            {/* INTEGRANTE CRUD MODAL */}
            {isMemberModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={() => setIsMemberModalOpen(false)} />
                    <div className="bg-surface border border-base w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-base flex justify-between items-center bg-main/30">
                            <div>
                                <h2 className="text-2xl font-black text-base italic tracking-tighter uppercase text-white">
                                    {memberModalType === 'create' ? 'Nuevo Integrante' : 'Editar Integrante'}
                                </h2>
                                <p className="text-muted text-[9px] font-black uppercase tracking-[0.2em] mt-1">Configuración salarial del equipo</p>
                            </div>
                            <button
                                onClick={() => setIsMemberModalOpen(false)}
                                className="p-3 bg-main hover:bg-slate-800/40 border border-base rounded-[1rem] text-slate-400 hover:text-white transition-all cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveMember} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: Juan Pérez"
                                        className="w-full px-5 py-4 bg-slate-950 border border-slate-850 rounded-2xl text-xs outline-none focus:border-indigo-500 transition-all font-bold text-slate-200"
                                        value={memberForm.name}
                                        onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Rol Operativo</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej: Setter, Closer"
                                            className="w-full px-5 py-4 bg-slate-950 border border-slate-850 rounded-2xl text-xs outline-none focus:border-indigo-500 transition-all font-bold text-slate-200"
                                            value={memberForm.role}
                                            onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Sueldo</label>
                                        <select
                                            className="w-full px-5 py-4 bg-slate-950 border border-slate-850 rounded-2xl text-xs outline-none focus:border-indigo-500 transition-all font-bold text-slate-200 cursor-pointer"
                                            value={memberForm.salary_type}
                                            onChange={(e) => setMemberForm({ ...memberForm, salary_type: e.target.value })}
                                        >
                                            <option value="fijo">Sueldo Fijo</option>
                                            <option value="variable">Sueldo Variable (Comisión)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Sueldo Base ($)</label>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            className="w-full px-5 py-4 bg-slate-950 border border-slate-850 rounded-2xl text-xs outline-none focus:border-indigo-500 transition-all font-mono font-bold text-slate-200"
                                            value={memberForm.base_salary}
                                            onChange={(e) => setMemberForm({ ...memberForm, base_salary: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Medio de Pago</label>
                                        <select
                                            className="w-full px-5 py-4 bg-slate-950 border border-slate-850 rounded-2xl text-xs outline-none focus:border-indigo-500 transition-all font-bold text-slate-200 cursor-pointer"
                                            value={memberForm.payment_method}
                                            onChange={(e) => setMemberForm({ ...memberForm, payment_method: e.target.value })}
                                        >
                                            <option value="Stripe">Stripe</option>
                                            <option value="AirTM">AirTM</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                className="w-full py-4 mt-6 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-brand-glow"
                            >
                                {memberModalType === 'create' ? 'Crear Integrante' : 'Guardar Cambios'}
                            </Button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancePage;
