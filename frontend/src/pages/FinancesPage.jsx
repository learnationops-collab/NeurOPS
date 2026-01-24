import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Activity,
    Plus,
    Trash2,
    Calendar as CalendarIcon,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react';

const FinancesPage = () => {
    const [data, setData] = useState({ expenses: [], recurring: [], kpis: {} });
    const [loading, setLoading] = useState(true);
    const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'variable', date: new Date().toISOString().split('T')[0] });

    useEffect(() => {
        fetchFinances();
    }, []);

    const fetchFinances = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/finance/overview');
            setData(res.data);
        } catch (err) {
            console.error("Error fetching finances", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/finance/expenses', newExpense);
            setNewExpense({ description: '', amount: '', category: 'variable', date: new Date().toISOString().split('T')[0] });
            fetchFinances();
        } catch (err) {
            alert("Error al agregar gasto");
        }
    };

    const handleDeleteExpense = async (id) => {
        if (!confirm("¿Eliminar este gasto?")) return;
        try {
            await api.delete(`/admin/finance/expenses/${id}`);
            fetchFinances();
        } catch (err) {
            alert("Error al eliminar");
        }
    };

    if (loading) return <div className="p-8 text-white">Cargando finanzas...</div>;

    const kpis = data.kpis;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black text-white italic tracking-tighter">Gestion Financiera</h1>
                    <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.2em]">Balance Mensual y Gastos</p>
                </div>
            </header>

            {/* Principal KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-800 relative overflow-hidden group">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ingresos Brutos</span>
                        <h2 className="text-3xl font-black text-white">${kpis.gross_revenue?.toLocaleString()}</h2>
                    </div>
                    <ArrowUpRight className="absolute -right-2 -top-2 text-indigo-500/20 group-hover:text-indigo-500/40 transition-colors" size={80} />
                </div>
                <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-800 relative overflow-hidden group">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recaudacion Neta</span>
                        <h2 className="text-3xl font-black text-emerald-500">${kpis.cash_collected?.toLocaleString()}</h2>
                    </div>
                    <DollarSign className="absolute -right-2 -top-2 text-emerald-500/10" size={80} />
                </div>
                <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-800 relative overflow-hidden group">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gastos Totales</span>
                        <h2 className="text-3xl font-black text-rose-500">${kpis.total_expenses?.toLocaleString()}</h2>
                    </div>
                    <ArrowDownRight className="absolute -right-2 -top-2 text-rose-500/10" size={80} />
                </div>
                <div className={`p-6 rounded-3xl border relative overflow-hidden group ${kpis.net_profit >= 0 ? 'bg-indigo-600/10 border-indigo-500/20' : 'bg-rose-600/10 border-rose-500/20'}`}>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Utilidad Neta</span>
                        <h2 className={`text-3xl font-black ${kpis.net_profit >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                            ${kpis.net_profit?.toLocaleString()}
                        </h2>
                    </div>
                    <Activity className={`absolute -right-2 -top-2 opacity-10 ${kpis.net_profit >= 0 ? 'text-indigo-500' : 'text-rose-500'}`} size={80} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Add Expense Form */}
                <div className="space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[2rem] border border-slate-800 shadow-2xl">
                        <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                            <Plus className="text-indigo-500" size={20} />
                            Registrar Gasto
                        </h3>
                        <form onSubmit={handleAddExpense} className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Descripcion</label>
                                <input
                                    type="text" required placeholder="Ej: Publicidad Meta"
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    value={newExpense.description}
                                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Monto ($)</label>
                                <input
                                    type="number" step="0.01" required
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    value={newExpense.amount}
                                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Fecha</label>
                                <input
                                    type="date" required
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    value={newExpense.date}
                                    onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                                />
                            </div>
                            <button className="col-span-2 mt-2 w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-600/20">
                                Confirmar Gasto
                            </button>
                        </form>
                    </div>
                </div>

                {/* Expenses List */}
                <div className="space-y-6">
                    <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl">
                        <div className="px-8 py-6 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Ultimos Gastos</h3>
                            <button onClick={fetchFinances} className="text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors">Refrescar</button>
                        </div>
                        <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <tbody className="divide-y divide-slate-800/50">
                                    {data.expenses.map(exp => (
                                        <tr key={exp.id || Math.random()} className="hover:bg-slate-800/20 transition-colors group">
                                            <td className="px-8 py-5">
                                                <p className="text-white font-bold text-sm">{exp.description}</p>
                                                <p className="text-[10px] text-slate-500 uppercase">{exp.category}</p>
                                            </td>
                                            <td className="px-8 py-5 text-right font-black text-rose-400">
                                                ${exp.amount?.toLocaleString()}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                {exp.id && (
                                                    <button
                                                        onClick={() => handleDeleteExpense(exp.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-600 hover:text-rose-500 transition-all"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinancesPage;
