import { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, Filter, ArrowRight, UserCheck, CreditCard, AlertCircle, Loader2, X } from 'lucide-react';
import Button from '../components/ui/Button';
import DateRangeFilter from '../components/DateRangeFilter';
import MultiSelectFilter from '../components/MultiSelectFilter';
import usePersistentFilters from '../hooks/usePersistentFilters';

const LeadsPage = () => {
    const [data, setData] = useState({ leads: [], kpis: {} });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Filter Configuration
    const { filters, updateFilter } = usePersistentFilters('admin_leads_filters', {
        dateRange: { type: 'all', start: '', end: '' },
        program: []
    });

    useEffect(() => {
        fetchLeads();
    }, [filters]);

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const params = {
                search,
                start_date: filters.dateRange?.start,
                end_date: filters.dateRange?.end,
                program: filters.program?.join(',')
            };

            const res = await api.get('/admin/leads', { params });
            setData(res.data);
        } catch (err) {
            console.error("Error fetching leads", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        if (e.key === 'Enter') fetchLeads();
    };

    const programOptions = [
        { value: 'Closer', label: 'Closer' },
        { value: 'Master', label: 'Master' },
        { value: 'Workshop', label: 'Workshop' }
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
            <header>
                <h1 className="text-3xl font-black text-white italic tracking-tighter">Gestión de Clientes</h1>
                <p className="text-slate-400 font-medium uppercase text-xs tracking-[0.2em]">Listado Maestro de Leads y Estudiantes</p>
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
            <div className="space-y-4">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o email..."
                            className="w-full pl-11 pr-4 py-4 bg-slate-900/40 border border-slate-800 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onBlur={fetchLeads}
                            onKeyDown={handleSearch}
                        />
                    </div>
                    <Button
                        variant="ghost"
                        className={`border-slate-800 text-slate-400 hover:text-white h-14 px-6 ${showFilters ? 'bg-slate-800 text-white' : ''}`}
                        icon={Filter}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        Filtros
                    </Button>
                </div>

                {/* Filter Panel */}
                {showFilters && (
                    <div className="bg-slate-900/40 border border-slate-800 rounded-[1.5rem] p-6 animate-in slide-in-from-top-4 fade-in duration-300">
                        <div className="flex flex-wrap gap-4 items-center">
                            <DateRangeFilter
                                value={filters.dateRange}
                                onChange={(val) => updateFilter('dateRange', val)}
                            />

                            <MultiSelectFilter
                                label="Programa"
                                options={programOptions}
                                value={filters.program}
                                onChange={(val) => updateFilter('program', val)}
                            />

                            {(filters.dateRange?.type !== 'all' || filters.program?.length > 0) && (
                                <button
                                    onClick={() => {
                                        updateFilter('dateRange', { type: 'all', start: '', end: '' });
                                        updateFilter('program', []);
                                    }}
                                    className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-400 flex items-center gap-1 ml-auto"
                                >
                                    <X size={14} /> Limpiar Filtros
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Leads Table */}
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
                {loading ? (
                    <div className="py-32 text-center">
                        <Loader2 className="animate-spin text-slate-700 mx-auto mb-4" size={32} />
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Sincronizando Base de Datos...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-800/20">
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Cliente</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Email</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha Registro</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Contacto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {data.leads.length > 0 ? data.leads.map(lead => (
                                    <tr key={lead.id} className="hover:bg-slate-800/10 transition-all group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-black border border-indigo-500/20">
                                                    {lead.username[0].toUpperCase()}
                                                </div>
                                                <p className="text-white font-black text-sm tracking-tight">{lead.username}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-xs text-slate-400 font-medium">
                                            {lead.email}
                                        </td>
                                        <td className="px-8 py-6 text-[10px] text-slate-500 uppercase font-bold">
                                            {new Date(lead.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                <button className="p-3 text-slate-500 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-slate-700">
                                                    <ArrowRight size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" className="py-20 text-center text-slate-600 font-black uppercase tracking-widest text-xs italic">
                                            No se encontraron resultados
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeadsPage;
