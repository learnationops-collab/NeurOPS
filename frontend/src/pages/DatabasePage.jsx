import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    Database,
    Package,
    CreditCard,
    Radio,
    HelpCircle,
    Users,
    TrendingUp,
    Calendar,
    Search,
    Edit3,
    Check,
    X,
    ChevronLeft,
    ChevronRight,
    Filter
} from 'lucide-react';

const DatabasePage = () => {
    const [activeTab, setActiveTab] = useState('programs');
    const [data, setData] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    const tabs = [
        { id: 'programs', label: 'Programas', icon: Package },
        { id: 'payment-methods', label: 'Metodos de Pago', icon: CreditCard },
        { id: 'events', label: 'Eventos / Canales', icon: Radio },
        { id: 'questions', label: 'Reporte Diario', icon: HelpCircle },
        { id: 'leads_raw', label: 'Leads / Clientes', icon: Users },
        { id: 'sales_raw', label: 'Historial Ventas', icon: TrendingUp },
        { id: 'agendas', label: 'Agenda General', icon: Calendar },
    ];

    useEffect(() => {
        setPagination({ ...pagination, page: 1 });
        fetchData(1);
    }, [activeTab]);

    const fetchData = async (page = 1) => {
        try {
            setLoading(true);
            let endpoint = '';
            let params = { page, search };

            if (activeTab === 'leads_raw') endpoint = '/admin/leads';
            else if (activeTab === 'sales_raw') endpoint = '/admin/finance/sales';
            else if (activeTab === 'agendas') endpoint = '/admin/db/agendas';
            else endpoint = `/admin/db/${activeTab}`;

            const res = await api.get(endpoint, { params });

            // Handle different API response structures
            if (res.data.data) {
                setData(res.data.data);
                setPagination({ page, total: res.data.total, pages: res.data.pages });
            } else if (res.data.leads || res.data.sales) {
                setData(res.data.leads || res.data.sales);
                setPagination({ page, total: res.data.total, pages: res.data.pages });
            } else {
                setData(res.data);
                setPagination({ page: 1, total: res.data.length, pages: 1 });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (item) => {
        try {
            const body = editingId ? { ...editForm, id: editingId } : item;
            await api.post(`/admin/db/${activeTab}`, body);
            setEditingId(null);
            fetchData(pagination.page);
        } catch (err) {
            alert("Accion no permitida para este tipo de dato");
        }
    };

    const renderHeader = () => {
        if (activeTab === 'leads_raw') return (
            <>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Cliente</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Closer</th>
            </>
        );
        if (activeTab === 'sales_raw') return (
            <>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Detalle Venta</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Monto</th>
            </>
        );
        if (activeTab === 'agendas') return (
            <>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha/Hora</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Lead / Closer</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
            </>
        );
        return (
            <>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">ID</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre / Detalle</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
            </>
        );
    };

    const renderRow = (item) => {
        if (activeTab === 'leads_raw') return (
            <>
                <td className="px-8 py-5">
                    <p className="text-white font-bold text-sm tracking-tight">{item.username}</p>
                    <p className="text-[10px] text-slate-500 uppercase">{item.email}</p>
                </td>
                <td className="px-8 py-5">
                    <span className="px-2 py-1 bg-slate-800 rounded text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.status}</span>
                </td>
                <td className="px-8 py-5 text-xs text-slate-400 font-medium">{item.assigned_closer || '-'}</td>
            </>
        );
        if (activeTab === 'sales_raw') return (
            <>
                <td className="px-8 py-5 text-xs text-slate-500 font-mono italic">{new Date(item.date).toLocaleDateString()}</td>
                <td className="px-8 py-5">
                    <p className="text-white font-bold text-sm">{item.student}</p>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">{item.program}</p>
                </td>
                <td className="px-8 py-5 text-right font-black text-emerald-400">${item.amount?.toLocaleString()}</td>
            </>
        );
        if (activeTab === 'agendas') return (
            <>
                <td className="px-8 py-5 text-xs text-slate-300 font-bold">
                    {new Date(item.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-8 py-5">
                    <p className="text-white font-bold text-sm">{item.lead}</p>
                    <p className="text-[10px] text-indigo-500 font-black uppercase">Closer: {item.closer}</p>
                </td>
                <td className="px-8 py-5">
                    <span className="px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded text-[9px] font-black uppercase tracking-widest">{item.status}</span>
                </td>
            </>
        );
        return (
            <>
                <td className="px-8 py-5 text-indigo-500 font-black text-xs">#{item.id}</td>
                <td className="px-8 py-5">
                    <p className="text-white font-bold text-sm">{item.name || item.text}</p>
                    {item.price && <p className="text-emerald-500 text-[10px] font-black uppercase tracking-tighter">${item.price}</p>}
                </td>
                <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${item.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {item.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
            </>
        );
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-white italic tracking-tighter">Bases de Datos Maestro</h1>
                    <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.2em]">Acceso consolidado a registros del sistema</p>
                </div>
            </header>

            <div className="flex flex-wrap gap-2 p-1 bg-slate-800/20 border border-slate-800/50 rounded-2xl">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-3 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'
                            }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl pl-11 pr-4 py-4 text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Buscar registros..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onBlur={() => fetchData(1)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchData(1)}
                    />
                </div>
                {pagination.pages > 1 && (
                    <div className="flex bg-slate-800/40 rounded-xl p-1 border border-slate-800">
                        <button disabled={pagination.page === 1} onClick={() => fetchData(pagination.page - 1)} className="p-2 text-slate-400 hover:text-white disabled:opacity-20"><ChevronLeft size={20} /></button>
                        <div className="px-4 flex items-center text-[10px] font-black text-white uppercase tracking-widest">Pag {pagination.page} / {pagination.pages}</div>
                        <button disabled={pagination.page === pagination.pages} onClick={() => fetchData(pagination.page + 1)} className="p-2 text-slate-400 hover:text-white disabled:opacity-20"><ChevronRight size={20} /></button>
                    </div>
                )}
            </div>

            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                {loading ? (
                    <div className="p-32 text-center text-slate-600 font-black uppercase tracking-[0.5em] animate-pulse">Sincronizando Nodo...</div>
                ) : (
                    <div className="overflow-x-auto min-h-[400px]">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-800/10">
                                    {renderHeader()}
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/30">
                                {data.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-800/10 transition-all group">
                                        {renderRow(item)}
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-2 text-slate-500 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-all"><Edit3 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DatabasePage;
