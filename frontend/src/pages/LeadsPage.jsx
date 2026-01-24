import { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, Filter, ArrowRight, UserCheck, CreditCard, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const StatusBadge = ({ status }) => {
    const config = {
        'new': 'bg-blue-500/10 text-blue-500',
        'pending': 'bg-amber-500/10 text-amber-500',
        'completed': 'bg-emerald-500/10 text-emerald-500',
        'renovado': 'bg-purple-500/10 text-purple-500',
        'dropped': 'bg-rose-500/10 text-rose-500'
    };
    return (
        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${config[status] || 'bg-slate-500/10 text-slate-500'}`}>
            {status}
        </span>
    );
};

const LeadsPage = () => {
    const [data, setData] = useState({ leads: [], kpis: {} });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => {
        fetchLeads();
    }, [statusFilter]);

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/leads', { params: { search, status: statusFilter } });
            setData(res.data);
        } catch (err) {
            console.error("Error fetching leads", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-black text-white italic tracking-tighter">Gestion de Clientes</h1>
                <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.2em]">Leads y Estudiantes</p>
            </header>

            {/* KPI Cards Mini */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Leads</p>
                        <h4 className="text-xl font-black text-white">{data.kpis.total || 0}</h4>
                    </div>
                    <UserCheck className="text-indigo-500" size={24} />
                </div>
                <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Caja Neta</p>
                        <h4 className="text-xl font-black text-emerald-500">${data.kpis.cash_collected?.toLocaleString() || 0}</h4>
                    </div>
                    <CreditCard size={24} />
                </div>
                <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Deuda Pendiente</p>
                        <h4 className="text-xl font-black text-rose-500">${data.kpis.debt?.toLocaleString() || 0}</h4>
                    </div>
                    <AlertCircle size={24} />
                </div>
                <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Proyectado</p>
                        <h4 className="text-xl font-black text-white">${data.kpis.projected_revenue?.toLocaleString() || 0}</h4>
                    </div>
                    <ArrowRight className="text-slate-600" size={24} />
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-800 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onBlur={fetchLeads}
                        onKeyDown={(e) => e.key === 'Enter' && fetchLeads()}
                    />
                </div>
                <div className="flex items-center gap-3">
                    <Filter className="text-slate-500" size={18} />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-slate-800 border-none rounded-2xl px-4 py-3 text-white text-xs font-bold uppercase tracking-wider outline-none"
                    >
                        <option value="">Todos los Estados</option>
                        <option value="new">Nuevo</option>
                        <option value="pending">Pendiente</option>
                        <option value="completed">Completado</option>
                        <option value="dropped">Baja</option>
                    </select>
                </div>
            </div>

            {/* Leads Table */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                {loading ? (
                    <div className="p-20 text-center text-slate-500 font-bold uppercase tracking-widest animate-pulse">Filtrando Clientes...</div>
                ) : (
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-800/30">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Cliente</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Closer</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Contacto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {data.leads.map(lead => (
                                <tr key={lead.id} className="hover:bg-slate-800/20 transition-all group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-white font-bold text-xs ring-1 ring-slate-700">
                                                {lead.username[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-white font-bold text-sm">{lead.username}</p>
                                                <p className="text-[10px] text-slate-500">{lead.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5"><StatusBadge status={lead.status} /></td>
                                    <td className="px-8 py-5 text-xs text-slate-400 font-medium">
                                        {lead.assigned_closer || 'Sin Asignar'}
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 text-slate-500 hover:text-white bg-slate-800 rounded-xl transition-all"><ArrowRight size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default LeadsPage;
