import { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, ChevronLeft, ChevronRight, Calendar, User, CreditCard } from 'lucide-react';

const SalesHistory = () => {
    const [data, setData] = useState({ sales: [], total: 0, pages: 1, current_page: 1 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => {
        fetchSales();
    }, [page]);

    const fetchSales = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/finance/sales', { params: { search, page } });
            setData(res.data);
        } catch (err) {
            console.error("Error fetching sales", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-black text-white italic tracking-tighter">Registro de Ventas</h1>
                <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.2em]">Historial completo de ingresos</p>
            </header>

            <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente..."
                        className="w-full pl-11 pr-4 py-4 bg-slate-800/40 border border-slate-800 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onBlur={fetchSales}
                    />
                </div>
                <div className="flex bg-slate-800/50 rounded-2xl p-1 border border-slate-800">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                        className="p-3 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div className="px-4 flex items-center text-xs font-black text-white uppercase tracking-widest">
                        Pagina {page} de {data.pages}
                    </div>
                    <button
                        disabled={page === data.pages}
                        onClick={() => setPage(page + 1)}
                        className="p-3 text-slate-400 hover:text-white disabled:opacity-20"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-800 bg-slate-800/30">
                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Cliente / Programa</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Monto</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Metodo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {data.sales.map(sale => (
                            <tr key={sale.id} className="hover:bg-slate-800/20 transition-all">
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-3 text-slate-400">
                                        <Calendar size={14} className="text-indigo-500" />
                                        <span className="text-xs font-medium">{new Date(sale.date).toLocaleDateString()}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex flex-col">
                                        <span className="text-white font-bold text-sm tracking-tight">{sale.student}</span>
                                        <span className="text-[10px] text-slate-500 uppercase font-black tracking-tighter">{sale.program}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-5 text-right">
                                    <span className="text-emerald-400 font-black text-lg">${sale.amount?.toLocaleString()}</span>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sale.method}</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SalesHistory;
