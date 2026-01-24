import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    Database,
    Calendar,
    DollarSign,
    Search,
    Filter,
    Download,
    ChevronLeft,
    ChevronRight,
    Clock,
    User,
    CheckCircle2,
    XCircle,
    Loader2,
    ArrowUpRight
} from 'lucide-react';

const CloserLeadsPage = () => {
    const [activeTab, setActiveTab] = useState('agendas');
    const [data, setData] = useState({ agendas: [], sales: [] });
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');

    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
    }, [activeTab, page]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const endpoint = activeTab === 'agendas' ? '/api/closer/agendas' : '/api/closer/sales';
            const res = await api.get(`${endpoint}?page=${page}&search=${search}`);

            // Ensure data key exists and is array
            const tabData = Array.isArray(res.data.data) ? res.data.data : [];

            setData(prev => ({ ...prev, [activeTab]: tabData }));
            setTotalPages(res.data.pages || 1);
        } catch (err) {
            console.error("Error fetching leads data", err);
            setError("Error al cargar los datos. Por favor reintenta.");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchData();
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">Gestionar Leads</h1>
                    <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.2em]">Historial completo de ventas y agendamientos</p>
                </div>
                <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800 backdrop-blur-md">
                    <button
                        onClick={() => { setActiveTab('agendas'); setPage(1); }}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${activeTab === 'agendas' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Calendar size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Base Agendas</span>
                    </button>
                    <button
                        onClick={() => { setActiveTab('sales'); setPage(1); }}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${activeTab === 'sales' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <DollarSign size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Base Ventas</span>
                    </button>
                </div>
            </header>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800/50 backdrop-blur-xl">
                <form onSubmit={handleSearch} className="relative w-full md:max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre..."
                        className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </form>
                <div className="flex gap-4 w-full md:w-auto">
                    <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition-all border border-slate-700/50">
                        <Filter size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Filtros</span>
                    </button>
                    <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-2xl transition-all border border-indigo-500/20">
                        <Download size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Exportar</span>
                    </button>
                </div>
            </div>

            {/* Main Table Database */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-800/50 overflow-hidden shadow-2xl overflow-x-auto">
                {error ? (
                    <div className="p-20 flex flex-col items-center justify-center text-rose-400 gap-4">
                        <p className="font-bold uppercase tracking-widest text-xs">{error}</p>
                        <button onClick={fetchData} className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg text-xs font-black uppercase tracking-widest transition-all">Reintentar</button>
                    </div>
                ) : loading ? (
                    <div className="p-20 flex justify-center items-center">
                        <Loader2 className="animate-spin text-indigo-500" size={40} />
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-800/20">
                                <th className="px-8 py-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Lead / Cliente</th>
                                <th className="px-8 py-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Fecha / Hora</th>
                                {activeTab === 'agendas' ? (
                                    <>
                                        <th className="px-8 py-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Tipo</th>
                                        <th className="px-8 py-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Estado</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-8 py-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Programa</th>
                                        <th className="px-8 py-6 text-xs font-bold text-slate-500 uppercase tracking-widest">Monto</th>
                                    </>
                                )}
                                <th className="px-8 py-6 text-xs font-bold text-slate-500 uppercase tracking-widest text-right text-indigo-500">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {data[activeTab]?.length > 0 ? data[activeTab].map(item => (
                                <tr key={item.id} className="hover:bg-slate-800/20 transition-all group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 font-black border border-slate-700 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all">
                                                {activeTab === 'agendas' ? item.lead_name[0].toUpperCase() : item.student_name[0].toUpperCase()}
                                            </div>
                                            <p className="text-white font-black">{activeTab === 'agendas' ? item.lead_name : item.student_name}</p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2 text-slate-400 font-medium">
                                            <Calendar size={14} className="text-indigo-500/50" />
                                            <span className="text-sm">{new Date(item.date).toLocaleDateString()}</span>
                                            <span className="text-[10px] opacity-50 ml-1">{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </td>
                                    {activeTab === 'agendas' ? (
                                        <>
                                            <td className="px-8 py-6">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-700 px-3 py-1 rounded-full">
                                                    {item.type}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${item.status === 'completed' ? 'text-emerald-400' :
                                                    item.status === 'scheduled' ? 'text-indigo-400' : 'text-slate-500'
                                                    }`}>
                                                    {item.status === 'completed' ? <CheckCircle2 size={12} /> : item.status === 'canceled' ? <XCircle size={12} /> : <Clock size={12} />}
                                                    {item.status}
                                                </span>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-8 py-6">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.program_name}</p>
                                            </td>
                                            <td className="px-8 py-6">
                                                <p className="text-emerald-400 font-black tracking-tight">${item.amount?.toLocaleString()}</p>
                                            </td>
                                        </>
                                    )}
                                    <td className="px-8 py-6 text-right">
                                        <button className="p-3 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all border border-transparent hover:border-slate-700">
                                            <ArrowUpRight size={18} />
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="p-20 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">No se encontraron registros</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center pb-10">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pagina {page} de {totalPages}</p>
                <div className="flex gap-2">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 hover:text-white disabled:opacity-20 transition-all"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 hover:text-white disabled:opacity-20 transition-all"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CloserLeadsPage;
