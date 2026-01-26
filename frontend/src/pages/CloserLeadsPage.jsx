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
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const CloserLeadsPage = () => {
    const [activeTab, setActiveTab] = useState('agendas');
    const [data, setData] = useState({ agendas: [], sales: [] });
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [error, setError] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editStartTime, setEditStartTime] = useState('');
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        fetchData();
    }, [activeTab, page]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const endpoint = activeTab === 'agendas' ? '/closer/agendas' : '/closer/sales';
            const res = await api.get(`${endpoint}?page=${page}&search=${search}`);

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

    const handleUpdateDate = async (id) => {
        setUpdating(true);
        try {
            await api.patch(`/closer/appointments/${id}`, { start_time: editStartTime });
            setEditingId(null);
            fetchData();
        } catch (err) {
            alert("Error al actualizar la fecha");
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-base italic tracking-tighter uppercase">Base de Datos</h1>
                    <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Historial completo de ventas y agendamientos</p>
                </div>
                <div className="flex bg-surface p-1.5 rounded-2xl border border-base backdrop-blur-md">
                    <button
                        onClick={() => { setActiveTab('agendas'); setPage(1); }}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${activeTab === 'agendas' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-base'}`}
                    >
                        <Calendar size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Base Agendas</span>
                    </button>
                    <button
                        onClick={() => { setActiveTab('sales'); setPage(1); }}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${activeTab === 'sales' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-base'}`}
                    >
                        <DollarSign size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Base Ventas</span>
                    </button>
                </div>
            </header>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-surface p-6 rounded-[2rem] border border-base backdrop-blur-xl">
                <form onSubmit={handleSearch} className="relative w-full md:max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre..."
                        className="w-full pl-12 pr-4 py-4 bg-main border border-base rounded-2xl text-base placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </form>
                <div className="flex gap-4 w-full md:w-auto">
                    <Button variant="ghost" className="flex-1 md:flex-none border-base text-muted px-6 h-14" icon={Filter}>
                        Filtros
                    </Button>
                    <Button variant="ghost" className="flex-1 md:flex-none border-primary/20 text-primary hover:bg-primary hover:text-white px-6 h-14" icon={Download}>
                        Exportar
                    </Button>
                </div>
            </div>

            {/* Main Table Database */}
            <Card variant="surface" padding="p-0 overflow-hidden" className="shadow-2xl overflow-x-auto">
                {error ? (
                    <div className="p-20 flex flex-col items-center justify-center text-accent gap-4">
                        <p className="font-black uppercase tracking-widest text-[10px]">{error}</p>
                        <Button onClick={fetchData} variant="ghost" className="border-accent/20 text-accent">Reintentar</Button>
                    </div>
                ) : loading ? (
                    <div className="p-20 flex justify-center items-center">
                        <Loader2 className="animate-spin text-primary" size={40} />
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-base bg-surface-hover">
                                <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-widest">Lead / Cliente</th>
                                <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-widest">Fecha / Hora</th>
                                {activeTab === 'agendas' ? (
                                    <>
                                        <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-widest">Tipo</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-widest">Estado</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-widest">Programa</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-widest">Monto</th>
                                    </>
                                )}
                                <th className="px-8 py-6 text-[10px] font-black text-primary uppercase tracking-widest text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base">
                            {data[activeTab]?.length > 0 ? data[activeTab].map(item => (
                                <tr key={item.id} className="hover:bg-surface-hover/50 transition-all group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-main flex items-center justify-center text-muted font-black border border-base group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                                                {activeTab === 'agendas' ? item.lead_name[0].toUpperCase() : item.student_name[0].toUpperCase()}
                                            </div>
                                            <p className="text-base font-black italic">{activeTab === 'agendas' ? item.lead_name : item.student_name}</p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        {editingId === item.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="datetime-local"
                                                    className="bg-main border border-base rounded-lg px-2 py-1 text-base text-[10px] outline-none focus:ring-1 focus:ring-primary font-bold"
                                                    value={editStartTime}
                                                    onChange={(e) => setEditStartTime(e.target.value)}
                                                />
                                                <button
                                                    onClick={() => handleUpdateDate(item.id)}
                                                    disabled={updating}
                                                    className="p-1.5 bg-primary text-white rounded-md hover:bg-primary/80 transition-all disabled:opacity-50"
                                                >
                                                    {updating ? <Loader2 size={12} className="animate-spin" /> : <p className="text-[9px] font-black uppercase tracking-widest px-1">OK</p>}
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="p-1.5 bg-surface-hover text-muted rounded-md hover:text-base transition-all"
                                                >
                                                    <p className="text-[9px] font-black uppercase tracking-widest px-1">X</p>
                                                </button>
                                            </div>
                                        ) : (
                                            <div
                                                onClick={() => {
                                                    if (activeTab === 'agendas') {
                                                        setEditingId(item.id);
                                                        setEditStartTime(item.date ? item.date.substring(0, 16) : '');
                                                    }
                                                }}
                                                className={`flex items-center gap-2 text-muted font-bold ${activeTab === 'agendas' ? 'cursor-pointer hover:text-base transition-colors' : ''}`}
                                            >
                                                <Calendar size={14} className="text-primary" />
                                                <span className="text-sm">{new Date(item.date).toLocaleDateString()}</span>
                                                <span className="text-[10px] opacity-50 ml-1">{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        )}
                                    </td>
                                    {activeTab === 'agendas' ? (
                                        <>
                                            <td className="px-8 py-6">
                                                <Badge variant="neutral">{item.type}</Badge>
                                            </td>
                                            <td className="px-8 py-6">
                                                <Badge variant={item.status === 'completed' ? 'success' : item.status === 'scheduled' ? 'primary' : 'neutral'}>
                                                    {item.status}
                                                </Badge>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-8 py-6">
                                                <p className="text-[10px] font-black text-muted uppercase tracking-widest">{item.program_name}</p>
                                            </td>
                                            <td className="px-8 py-6">
                                                <p className="text-success font-black tracking-tighter text-lg">${item.amount?.toLocaleString()}</p>
                                            </td>
                                        </>
                                    )}
                                    <td className="px-8 py-6 text-right">
                                        <button className="p-3 bg-surface-hover hover:bg-main text-muted hover:text-primary rounded-xl transition-all border border-base">
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
            </Card>

            {/* Pagination */}
            <div className="flex justify-between items-center pb-10">
                <p className="text-[10px] font-black text-muted uppercase tracking-widest">Página {page} de {totalPages}</p>
                <div className="flex gap-2">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="p-3 bg-surface border border-base rounded-xl text-muted hover:text-base disabled:opacity-20 transition-all"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="p-3 bg-surface border border-base rounded-xl text-muted hover:text-base disabled:opacity-20 transition-all"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CloserLeadsPage;
