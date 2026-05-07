import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Loader2, 
    Users, 
    Search, 
    Filter, 
    ChevronLeft, 
    ChevronRight, 
    User, 
    CreditCard, 
    ArrowUpRight,
    Mail,
    Phone,
    Instagram,
    DollarSign,
    CheckCircle2,
    Clock,
    X
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import SaleDetailModal from '../../../components/modals/SaleDetailModal';
import MultiSelectFilter from '../../../components/shared/MultiSelectFilter';

const CloserClientsPage = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [programFilter, setProgramFilter] = useState([]);

    useEffect(() => {
        fetchCustomers();
    }, [page, programFilter]);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/closer/customers', {
                params: {
                    page,
                    search,
                    program: programFilter.join(',')
                }
            });
            setData(res.data.data);
            setTotalPages(res.data.pages);
        } catch (err) {
            console.error("Error fetching customers", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchCustomers();
    };

    const programOptions = [
        { value: '1', label: 'Mentoria Learnation' },
        { value: '2', label: 'Curso Workers Pro' },
        { value: '3', label: 'NeuroOps Masterclass' },
        { value: '4', label: 'Residency Roadmap v1' }
    ];

    return (
        <div className="p-8 max-w-[1800px] mx-auto space-y-8 pb-32">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="text-5xl font-black text-base tracking-tighter leading-none flex items-center gap-4">
                        <Users className="text-primary" size={40} />
                        Cartera de Clientes
                    </h1>
                    <p className="text-muted font-medium text-[10px] tracking-[0.2em] uppercase">Gestión de alumnos y pagos activos</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                    <form onSubmit={handleSearch} className="relative flex-1 md:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, email o ig..."
                            className="w-full pl-12 pr-4 py-4 bg-surface border border-base rounded-2xl text-sm placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </form>
                    
                    <MultiSelectFilter
                        label="Programa"
                        options={programOptions}
                        value={programFilter}
                        onChange={(val) => { setProgramFilter(val); setPage(1); }}
                    />
                </div>
            </header>

            {loading ? (
                <div className="h-[60vh] flex flex-col items-center justify-center gap-6">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-muted font-black uppercase tracking-[0.3em] text-[10px]">Cargando Base de Clientes...</p>
                </div>
            ) : data.length === 0 ? (
                <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-base rounded-full flex items-center justify-center text-muted">
                        <Users size={40} />
                    </div>
                    <p className="text-muted font-bold tracking-widest text-sm uppercase">No se encontraron clientes que coincidan</p>
                    <button 
                        onClick={() => { setSearch(''); setProgramFilter([]); setPage(1); }}
                        className="text-primary font-black text-[10px] tracking-widest hover:underline"
                    >
                        LIMPIAR FILTROS
                    </button>
                </div>
            ) : (
                <div className="bg-surface/30 border border-base rounded-[2.5rem] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="bg-surface-hover/50 border-b border-base">
                                    <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-[0.2em]">Cliente</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-[0.2em]">Contacto</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-[0.2em]">Programas e Inversión</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-[0.2em]">Miembro Desde</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-primary uppercase tracking-[0.2em] text-right">Gestión</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-base">
                                {data.map((customer) => (
                                    <tr key={customer.id} className="hover:bg-surface-hover/30 transition-all group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center text-primary font-black text-lg border border-primary/10 shadow-inner">
                                                    {customer.full_name ? customer.full_name[0] : 'U'}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-base font-black text-base italic leading-none">{customer.full_name}</p>
                                                    <p className="text-[11px] font-medium text-muted">{customer.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2 text-muted">
                                                    <Phone size={12} className="text-primary" />
                                                    <span className="text-[11px] font-bold">{customer.phone || 'S/N'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted">
                                                    <Instagram size={12} className="text-primary" />
                                                    <span className="text-[11px] font-bold">@{customer.instagram || 'No vinculado'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="space-y-3 max-w-xs">
                                                {customer.enrollments.map((enr) => (
                                                    <div key={enr.id} className="space-y-1">
                                                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter">
                                                            <span className="text-base truncate max-w-[120px]">{enr.program_name}</span>
                                                            <span className={enr.status === 'completed' ? 'text-emerald-500' : 'text-primary'}>
                                                                {((enr.total_paid / enr.program_price) * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-1 bg-base rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full transition-all duration-1000 ${enr.status === 'completed' ? 'bg-emerald-500' : 'bg-primary'}`}
                                                                style={{ width: `${Math.min(100, (enr.total_paid / enr.program_price) * 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                                {customer.enrollments.length === 0 && (
                                                    <span className="text-[10px] font-bold text-muted italic">Sin inscripciones activas</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-muted">
                                                <Clock size={12} />
                                                <span className="text-[11px] font-bold italic">{new Date(customer.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button 
                                                onClick={() => {
                                                    if (customer.enrollments.length > 0) {
                                                        setSelectedEnrollmentId(customer.enrollments[0].id);
                                                        setIsDetailModalOpen(true);
                                                    }
                                                }}
                                                className="inline-flex items-center gap-2 px-6 py-3 bg-surface border border-base rounded-xl text-[10px] font-black text-base tracking-widest hover:bg-primary hover:text-white hover:border-primary transition-all group/btn"
                                            >
                                                PAGOS
                                                <ArrowUpRight size={14} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
                <div className="flex justify-between items-center py-10">
                    <p className="text-[10px] font-black text-muted tracking-widest uppercase">Página {page} de {totalPages}</p>
                    <div className="flex gap-3">
                        <button 
                            disabled={page === 1} 
                            onClick={() => setPage(p => p - 1)} 
                            className="w-12 h-12 flex items-center justify-center bg-surface border border-base rounded-2xl text-muted hover:text-base disabled:opacity-20 transition-all hover:border-primary/50 shadow-xl"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button 
                            disabled={page === totalPages} 
                            onClick={() => setPage(p => p + 1)} 
                            className="w-12 h-12 flex items-center justify-center bg-surface border border-base rounded-2xl text-muted hover:text-base disabled:opacity-20 transition-all hover:border-primary/50 shadow-xl"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            )}

            <SaleDetailModal
                isOpen={isDetailModalOpen}
                enrollmentId={selectedEnrollmentId}
                onClose={() => { setIsDetailModalOpen(false); setSelectedEnrollmentId(null); }}
                onSuccess={fetchCustomers}
            />
        </div>
    );
};

export default CloserClientsPage;
