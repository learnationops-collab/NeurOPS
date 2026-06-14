import { useState, useEffect, useMemo } from 'react';
import api from '../../../services/api';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
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
    ArrowUpRight,
    X,
    Kanban,
    Plus,
    BarChart3,
    ClipboardCheck
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import AgendaManagerModal from '../../../components/modals/AgendaManagerModal';
import SaleDetailModal from '../../../components/modals/SaleDetailModal';
import DateRangeFilter from '../../../components/shared/DateRangeFilter';
import MultiSelectFilter from '../../../components/shared/MultiSelectFilter';
import usePersistentFilters from '../../../hooks/usePersistentFilters';
import CloserKanbanBoard from '../../../components/closer/CloserKanbanBoard';

const CloserLeadsPage = () => {
    const [selectedDb, setSelectedDb] = useState(null); // 'agendas' or 'sales' or null
    const [kanbanSubTab, setKanbanSubTab] = useState('tracking'); // 'tracking' or 'closing'
    const [kanbanData, setKanbanData] = useState({ stages: [], board: {} });
    const [data, setData] = useState({ agendas: [], sales: [], notifications: [] });
    const [loading, setLoading] = useState(true);
    const [kanbanLoading, setKanbanLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [error, setError] = useState(null);
    const [updating, setUpdating] = useState(false);
    const [selectedAgenda, setSelectedAgenda] = useState(null);
    const [activeSection, setActiveSection] = useState(0); // 0: Kanban, 1: Tables
    const [editStartTime, setEditStartTime] = useState('');
    const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [viewMode, setViewMode] = useState(() => {
        const saved = localStorage.getItem('closer_view_mode');
        if (saved) return saved;
        return window.innerWidth < 768 ? 'list' : 'kanban';
    });

    useEffect(() => {
        localStorage.setItem('closer_view_mode', viewMode);
    }, [viewMode]);

    // Kanban splitting logic
    const trackingStages = ["Nueva", "Respondido", "Confirmado"];
    const closingStages = ["Asistido", "Contexto", "Decisor", "Presentado"];

    const filteredKanbanStages = kanbanSubTab === 'tracking' ? trackingStages : closingStages;
    const filteredKanbanBoard = useMemo(() => {
        const board = {};
        filteredKanbanStages.forEach(stage => {
            board[stage] = kanbanData.board[stage] || [];
        });
        return board;
    }, [kanbanData.board, kanbanSubTab, filteredKanbanStages]);

    // Filter Configuration
    const { filters, updateFilter } = usePersistentFilters(`closer_filters_${selectedDb || 'general'}`, {
        dateRange: { type: 'all', start: '', end: '' },
        program: [],
        paymentMethod: []
    });

    useEffect(() => {
        fetchKanbanData();
    }, []);

    useEffect(() => {
        if (selectedDb) fetchData();
    }, [selectedDb, page, filters]);

    // Listen for section change requests from DOCK
    useEffect(() => {
        const handleRequest = (e) => {
            const { index } = e.detail;
            setActiveSection(index);
        };
        window.addEventListener('request-section-change', handleRequest);
        return () => window.removeEventListener('request-section-change', handleRequest);
    }, []);

    // Dispatch activeSection to Dock
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('page-section-changed', {
            detail: { activeSection, category: 'Leads' }
        }));
    }, [activeSection]);

    const fetchKanbanData = async () => {
        setKanbanLoading(true);
        try {
            const res = await api.get('/closer/kanban');
            setKanbanData(res.data);
        } catch (err) {
            console.error("Error fetching kanban", err);
        } finally {
            setKanbanLoading(false);
        }
    };

    const fetchData = async () => {
        if (!selectedDb) return;
        setLoading(true);
        setError(null);
        try {
            const endpointMap = {
                'agendas': '/closer/agendas',
                'sales': '/closer/sales',
                'notifications': '/closer/notifications'
            };
            const res = await api.get(endpointMap[selectedDb], {
                params: {
                    page,
                    search,
                    start_date: filters.dateRange?.start,
                    end_date: filters.dateRange?.end,
                    program: filters.program?.join(','),
                    payment_method: filters.paymentMethod?.join(',')
                }
            });

            setData(prev => ({
                ...prev,
                [selectedDb]: selectedDb === 'notifications'
                    ? (Array.isArray(res.data) ? res.data : [])
                    : (Array.isArray(res.data.data) ? res.data.data : [])
            }));
            setTotalPages(res.data.pages || 1);
        } catch (err) {
            console.error("Error fetching leads data:", err);
            setError("Error al cargar los datos.");
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

    const handleKanbanMove = async (id, fromStage, toStage) => {
        if (fromStage === toStage) return;
        setKanbanData(prev => {
            const newBoard = { ...prev.board };
            const fromItems = [...(newBoard[fromStage] || [])];
            const toItems = [...(newBoard[toStage] || [])];
            const itemIndex = fromItems.findIndex(i => i.id === id);
            if (itemIndex === -1) return prev;
            const [movedItem] = fromItems.splice(itemIndex, 1);
            toItems.push({ ...movedItem, last_stage: toStage });
            newBoard[fromStage] = fromItems;
            newBoard[toStage] = toItems;
            return { ...prev, board: newBoard };
        });
        try {
            await api.patch(`/closer/appointments/${id}/stage`, { stage: toStage });
            fetchData();
        } catch (err) {
            fetchData();
        }
    };

    const handleSetOutcome = async (id, outcome) => {
        try {
            setKanbanData(prev => {
                const newBoard = { ...prev.board };
                for (const stage in newBoard) {
                    newBoard[stage] = newBoard[stage].filter(item => item.id !== id);
                }
                return { ...prev, board: newBoard };
            });
            await api.patch(`/closer/appointments/${id}/outcome`, { outcome });
            fetchData();
        } catch (err) {
            fetchData();
        }
    };

    const programOptions = [
        { value: 'Mentoria Learnation', label: 'Mentoria Learnation' },
        { value: 'Curso Workers Pro', label: 'Curso Workers Pro' },
        { value: 'NeuroOps Masterclass', label: 'NeuroOps Masterclass' },
        { value: 'Residency Roadmap v1', label: 'Residency Roadmap v1' },
        { value: 'Specialist Iniciative v1', label: 'Specialist Iniciative v1' },
        { value: 'Ace Learner v1', label: 'Ace Learner v1' },
        { value: 'Residency Roadmap v2', label: 'Residency Roadmap v2' },
        { value: 'Residency Roadmap v3', label: 'Residency Roadmap v3' },
        { value: 'Ace Learner v2', label: 'Ace Learner v2' },
        { value: 'Ace Learner v3', label: 'Ace Learner v3' }
    ];

    const paymentOptions = [
        { value: 'Stripe', label: 'Stripe' },
        { value: 'PayPal', label: 'PayPal' },
        { value: 'Transferencia', label: 'Transferencia' }
    ];

    return (
        <div className="h-screen overflow-hidden relative">
            <motion.div
                className="absolute top-0 left-0 w-full h-[200%]"
                animate={{ y: `-${activeSection * 50}%` }}
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            >
                {/* SECTION 0: KANBAN BOARD (Top 50%) */}
                <div className="absolute top-0 left-0 w-full h-[50%] p-8 flex flex-col items-center justify-start overflow-hidden">
                    <div className="w-full max-w-[1800px] flex-1 flex flex-col space-y-6 text-center">
                        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="space-y-1 text-left">
                                <h1 className="text-5xl font-black text-base tracking-tighter leading-none">Pipeline</h1>
                                <p className="text-muted font-medium text-[10px] tracking-[0.2em]">Embudo de ventas y seguimiento activo</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex bg-main p-1.5 rounded-2xl border border-base shadow-sm">
                                    <button
                                        onClick={() => setViewMode('kanban')}
                                        className={`p-2.5 rounded-xl transition-all ${viewMode === 'kanban' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-muted hover:text-base'}`}
                                        title="Vista Kanban"
                                    >
                                        <BarChart3 size={18} className="rotate-90" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-muted hover:text-base'}`}
                                        title="Vista Lista"
                                    >
                                        <ClipboardCheck size={18} />
                                    </button>
                                </div>
                            </div>
                        </header>

                        <div className="flex justify-between items-center">
                            <h2 className="text-xs font-black tracking-widest text-muted flex items-center gap-2">
                                <Kanban size={14} className="text-primary" />
                                Embudo de Pre-call
                            </h2>
                            <div className="flex bg-main p-1 rounded-full border border-base shadow-inner">
                                <button
                                    onClick={() => setKanbanSubTab('tracking')}
                                    className={`px-8 py-2 rounded-full text-[10px] font-black tracking-tighter transition-all ${kanbanSubTab === 'tracking' ? 'bg-primary text-white shadow-md' : 'text-muted hover:text-base'}`}
                                >
                                    Pre-call
                                </button>
                                <button
                                    onClick={() => setKanbanSubTab('closing')}
                                    className={`px-8 py-2 rounded-full text-[10px] font-black tracking-tighter transition-all ${kanbanSubTab === 'closing' ? 'bg-primary text-white shadow-md' : 'text-muted hover:text-base'}`}
                                >
                                    Cierre
                                </button>
                            </div>
                        </div>

                        <div className="bg-surface/30 backdrop-blur-md border border-base rounded-[2.5rem] p-8 flex-1 overflow-hidden flex flex-col">
                            {kanbanLoading ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <Loader2 className="animate-spin text-primary" size={32} />
                                </div>
                            ) : (
                                <div className="flex-1 overflow-x-auto custom-scrollbar">
                                    <CloserKanbanBoard
                                        stages={filteredKanbanStages}
                                        board={filteredKanbanBoard}
                                        onMove={handleKanbanMove}
                                        onSetOutcome={handleSetOutcome}
                                        onCardClick={(item) => {
                                            setSelectedAgenda(item);
                                            setIsAgendaModalOpen(true);
                                        }}
                                        viewMode={viewMode}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-center pt-2">
                            <button
                                onClick={() => setActiveSection(1)}
                                className="group flex flex-col items-center gap-2 text-muted hover:text-primary transition-all animate-bounce focus:outline-none"
                            >
                                <span className="text-[8px] font-black tracking-widest">Ver Bases de Datos</span>
                                <div className="w-px h-8 bg-gradient-to-b from-muted group-hover:from-primary text-primary" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* SECTION 1: DATABASE TABLES (Bottom 50%) */}
                <div className="absolute top-[50%] left-0 w-full h-[50%] p-8 flex flex-col items-center justify-start overflow-y-auto">
                    <div className="w-full max-w-[1800px] space-y-8 pb-32">
                        <header className="flex items-center gap-6 border-b border-base pb-6">
                            <button
                                onClick={() => setActiveSection(0)}
                                className="p-3 bg-surface border border-base rounded-2xl text-muted hover:text-primary transition-all group"
                            >
                                <Plus className="rotate-45" size={20} />
                            </button>
                            <div className="space-y-1 text-left">
                                <h1 className="text-4xl font-black text-base tracking-tighter leading-none">
                                    {selectedDb ? (selectedDb === 'agendas' ? 'Base Agendas' : selectedDb === 'sales' ? 'Base Ventas' : 'Notificaciones') : 'Bases de Datos'}
                                </h1>
                                <p className="text-muted font-medium text-[10px] tracking-[0.2em]">Gestión unificada de registros</p>
                            </div>
                            {selectedDb && (
                                <button
                                    onClick={() => setSelectedDb(null)}
                                    className="ml-auto px-4 py-2 bg-surface border border-base rounded-xl text-[10px] font-black tracking-widest text-muted hover:text-primary transition-all flex items-center gap-2"
                                >
                                    <ChevronLeft size={14} /> Cambiar Base
                                </button>
                            )}
                        </header>

                        {!selectedDb ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-12">
                                <button
                                    onClick={() => setSelectedDb('agendas')}
                                    className="group relative h-[300px] bg-surface border-2 border-base rounded-[3rem] p-12 text-left hover:border-primary/50 transition-all overflow-hidden flex flex-col justify-end"
                                >
                                    <div className="absolute top-12 right-12 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Calendar size={180} />
                                    </div>
                                    <div className="relative z-10 space-y-4">
                                        <Badge variant="neutral" className="bg-primary/10 text-primary border-primary/20">Registros de Llamadas</Badge>
                                        <h2 className="text-5xl font-black tracking-tighter text-base">Agendas</h2>
                                        <p className="text-sm font-bold text-muted tracking-widest max-w-[250px]">Consulta el historial completo de agendas y prospectos.</p>
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>

                                <button
                                    onClick={() => setSelectedDb('sales')}
                                    className="group relative h-[300px] bg-surface border-2 border-base rounded-[3rem] p-12 text-left hover:border-emerald-500/50 transition-all overflow-hidden flex flex-col justify-end"
                                >
                                    <div className="absolute top-12 right-12 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <DollarSign size={180} />
                                    </div>
                                    <div className="relative z-10 space-y-4">
                                        <Badge variant="neutral" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Facturación</Badge>
                                        <h2 className="text-5xl font-black tracking-tighter text-base">Ventas</h2>
                                        <p className="text-sm font-bold text-muted tracking-widest max-w-[250px]">Seguimiento de cierres, pagos y programas vendidos.</p>
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>

                                <button
                                    onClick={() => setSelectedDb('notifications')}
                                    className="group relative h-[300px] bg-surface border-2 border-base rounded-[3rem] p-12 text-left hover:border-primary/50 transition-all overflow-hidden flex flex-col justify-end"
                                >
                                    <div className="absolute top-12 right-12 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Database size={180} />
                                    </div>
                                    <div className="relative z-10 space-y-4">
                                        <Badge variant="neutral" className="bg-primary/10 text-primary border-primary/20">Registro Interno</Badge>
                                        <h2 className="text-5xl font-black tracking-tighter text-base">Avisos</h2>
                                        <p className="text-sm font-bold text-muted tracking-widest max-w-[250px]">Consulta todas las notificaciones del sistema.</p>
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                                    <div className="space-y-2 text-left">
                                        <h2 className="text-xs font-black tracking-widest text-muted flex items-center gap-2">
                                            <Database size={14} className="text-primary" />
                                            Filtros y Búsqueda
                                        </h2>
                                    </div>

                                    <form onSubmit={handleSearch} className="relative w-full md:max-w-md group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Buscar por nombre..."
                                            className="w-full pl-12 pr-4 py-4 bg-surface border border-base rounded-2xl text-sm placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                        />
                                    </form>
                                </div>

                                <div className="bg-surface/50 border border-base rounded-[1.5rem] p-6">
                                    <div className="flex flex-wrap gap-4 items-center">
                                        <DateRangeFilter
                                            value={filters.dateRange}
                                            onChange={(val) => { updateFilter('dateRange', val); setPage(1); }}
                                        />
                                        <MultiSelectFilter
                                            label="Programa"
                                            options={programOptions}
                                            value={filters.program}
                                            onChange={(val) => { updateFilter('program', val); setPage(1); }}
                                        />
                                        {selectedDb === 'sales' && (
                                            <MultiSelectFilter
                                                label="Método Pago"
                                                options={paymentOptions}
                                                value={filters.paymentMethod}
                                                onChange={(val) => { updateFilter('paymentMethod', val); setPage(1); }}
                                            />
                                        )}
                                        {(filters.dateRange?.type !== 'all' || filters.program?.length > 0 || filters.paymentMethod?.length > 0) && (
                                            <button
                                                onClick={() => {
                                                    updateFilter('dateRange', { type: 'all', start: '', end: '' });
                                                    updateFilter('program', []);
                                                    updateFilter('paymentMethod', []);
                                                    setPage(1);
                                                }}
                                                className="text-[10px] font-black text-rose-500 tracking-widest hover:text-rose-400 flex items-center gap-1 ml-auto"
                                            >
                                                <X size={14} /> Limpiar Filtros
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <Card variant="surface" padding="p-0 overflow-hidden" className="shadow-2xl border-base/50">
                                    {error ? (
                                        <div className="p-20 text-center text-accent font-black text-xs">{error}</div>
                                    ) : loading ? (
                                        <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse min-w-[800px]">
                                                <thead>
                                                    <tr className="border-b border-base bg-surface-hover">
                                                        <th className="px-8 py-6 text-[10px] font-black text-muted tracking-widest">Lead / Cliente</th>
                                                        <th className="px-8 py-6 text-[10px] font-black text-muted tracking-widest">Creado</th>
                                                        {selectedDb === 'agendas' ? (
                                                            <>
                                                                <th className="px-8 py-6 text-[10px] font-black text-primary tracking-widest">Fecha Cita</th>
                                                                <th className="px-8 py-6 text-[10px] font-black text-muted tracking-widest">Ultima Etapa</th>
                                                                <th className="px-8 py-6 text-[10px] font-black text-muted tracking-widest">Resultado</th>
                                                            </>
                                                        ) : selectedDb === 'sales' ? (
                                                            <>
                                                                <th className="px-8 py-6 text-[10px] font-black text-muted tracking-widest">Programa</th>
                                                                <th className="px-8 py-6 text-[10px] font-black text-muted tracking-widest">Monto</th>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <th className="px-8 py-6 text-[10px] font-black text-muted tracking-widest">Contenido</th>
                                                                <th className="px-8 py-6 text-[10px] font-black text-muted tracking-widest">Estado</th>
                                                            </>
                                                        )}
                                                        <th className="px-8 py-6 text-[10px] font-black text-primary tracking-widest text-right">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-base">
                                                    {data[selectedDb]?.length > 0 ? data[selectedDb].map(item => (
                                                        <tr key={item.id} className={`hover:bg-surface-hover/50 transition-all group ${selectedDb === 'agendas' && item.has_sale ? 'bg-emerald-500/[0.02]' : ''}`}>
                                                            <td className="px-8 py-6 font-black">
                                                                {selectedDb === 'agendas' ? (
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span>{item.lead_name}</span>
                                                                        {item.has_sale && (
                                                                            <Badge variant="success" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] py-0.5 px-1.5 font-bold shrink-0">
                                                                                ✓ {item.sales_count} {item.sales_count === 1 ? 'cierre' : 'cierres'}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                ) : selectedDb === 'sales' ? item.student_name :
                                                                    item.subject}
                                                            </td>
                                                            <td className="px-8 py-6 text-[10px] font-bold text-muted">
                                                                {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                                                            </td>
                                                            {selectedDb === 'agendas' ? (
                                                                <>
                                                                    <td className="px-8 py-6 text-sm font-black text-primary">
                                                                        {new Date(item.date).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                                    </td>
                                                                    <td className="px-8 py-6 text-[10px] font-black">{item.last_stage || 'N/A'}</td>
                                                                    <td className="px-8 py-6"><Badge variant={item.result === 'Sold' ? 'success' : 'neutral'}>{item.result || 'Sin resultado'}</Badge></td>
                                                                </>
                                                            ) : selectedDb === 'sales' ? (
                                                                <>
                                                                    <td className="px-8 py-6 text-[10px] font-black">{item.program_name}</td>
                                                                    <td className="px-8 py-6 text-lg font-black text-success">${item.amount?.toLocaleString()}</td>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <td className="px-8 py-6 text-[10px] text-muted line-clamp-1 max-w-xs">{item.content}</td>
                                                                    <td className="px-8 py-6"><Badge variant={item.is_read ? 'neutral' : 'success'}>{item.is_read ? 'Leída' : 'Nueva'}</Badge></td>
                                                                </>
                                                            )}
                                                            <td className="px-8 py-6 text-right">
                                                                <button
                                                                    onClick={() => {
                                                                        if (selectedDb === 'agendas') { setSelectedAgenda(item); setIsAgendaModalOpen(true); }
                                                                        else { setSelectedEnrollmentId(item.id); setIsDetailModalOpen(true); }
                                                                    }}
                                                                    className="p-3 bg-surface-hover hover:bg-main text-muted hover:text-primary rounded-xl transition-all border border-base"
                                                                >
                                                                    <ArrowUpRight size={18} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )) : (
                                                        <tr><td colSpan="6" className="p-20 text-center text-muted font-bold tracking-widest text-xs">No se encontraron registros</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </Card>

                                <div className="flex justify-between items-center py-6">
                                    <p className="text-[10px] font-black text-muted tracking-widest">Página {page} de {totalPages}</p>
                                    <div className="flex gap-2">
                                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-3 bg-surface border border-base rounded-xl text-muted hover:text-base disabled:opacity-20 transition-all"><ChevronLeft size={20} /></button>
                                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-3 bg-surface border border-base rounded-xl text-muted hover:text-base disabled:opacity-20 transition-all"><ChevronRight size={20} /></button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </motion.div >

            {isAgendaModalOpen && selectedAgenda && (
                <AgendaManagerModal
                    isOpen={isAgendaModalOpen}
                    onClose={() => { setIsAgendaModalOpen(false); setSelectedAgenda(null); }}
                    appointment={selectedAgenda}
                    onSuccess={() => { fetchData(); fetchKanbanData(); }}
                />
            )}
            <SaleDetailModal
                isOpen={isDetailModalOpen}
                enrollmentId={selectedEnrollmentId}
                onClose={() => { setIsDetailModalOpen(false); setSelectedEnrollmentId(null); }}
                onSuccess={fetchData}
            />
        </div >
    );
};

export default CloserLeadsPage;
