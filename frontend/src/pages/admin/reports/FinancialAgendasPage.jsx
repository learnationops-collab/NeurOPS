import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import {
    Calendar as CalendarIcon,
    Activity,
    Search,
    Table,
    Users,
    Instagram,
    Copy,
    Edit,
    Trash2,
    FilterX
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import usePersistentFilters from '../../../hooks/usePersistentFilters';
import LeadRoadmapModal from '../../../components/modals/LeadRoadmapModal';


const getFirstDayOfCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
};

const getTodayDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

const getEstadoBadgeVariant = (estado) => {
    switch (estado) {
        case 'Show Up':
            return 'primary';
        case 'No show':
            return 'rose';
        case 'Reagendada':
            return 'warning';
        case 'Cancelada':
            return 'neutral';
        case 'Pendiente':
        default:
            return 'neutral';
    }
};

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
};

const FinancialAgendasPage = () => {
    const [agendas, setAgendas] = useState([]);
    const [selectedRoadmapLead, setSelectedRoadmapLead] = useState(null);

    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const [totalAgendados, setTotalAgendados] = useState(0);
    const [proximasCitas, setProximasCitas] = useState(0);
    const [sortedClosers, setSortedClosers] = useState([]);
    const [byCloserState, setByCloserState] = useState({});
    const [bySourceState, setBySourceState] = useState({});

    const [uniqueStates, setUniqueStates] = useState([]);
    const [uniqueClosers, setUniqueClosers] = useState([]);
    const [uniqueSources, setUniqueSources] = useState([]);

    // Estados para edición
    const [editingAgenda, setEditingAgenda] = useState(null);
    const [editForm, setEditForm] = useState({
        nombre: '',
        lead: '',
        closer: '',
        fecha_meet: '',
        instagram: '',
        whatsapp: '',
        mail: '',
        estado: ''
    });

    const handleEditClick = (agenda) => {
        setEditingAgenda(agenda);
        setEditForm({
            nombre: agenda.nombre || '',
            lead: agenda.lead || '',
            closer: agenda.closer || '',
            fecha_meet: agenda.fecha_meet || '',
            instagram: agenda.instagram || '',
            whatsapp: agenda.whatsapp || '',
            mail: agenda.mail || '',
            estado: agenda.estado || 'Pendiente'
        });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await api.put(`/public/financial-agendas/${editingAgenda.id}`, editForm);
            const updated = response.data.agenda;
            setAgendas(prev => prev.map(a => a.id === updated.id ? updated : a));
            setEditingAgenda(null);
            alert("Agenda actualizada correctamente");
        } catch (err) {
            console.error("Error updating agenda:", err);
            alert("Error al actualizar la agenda");
        }
    };

    const handleDeleteClick = async (id) => {
        if (!window.confirm("¿Seguro que quieres eliminar este registro de agenda permanentemente?")) return;
        try {
            await api.delete(`/public/financial-agendas/${id}`);
            setAgendas(prev => prev.filter(a => a.id !== id));
            setTotalAgendados(prev => Math.max(0, prev - 1));
            alert("Agenda eliminada correctamente");
        } catch (err) {
            console.error("Error deleting agenda:", err);
            alert("Error al eliminar la agenda");
        }
    };
    
    const { filters, updateFilter: setFilters } = usePersistentFilters('filters_financial_agendas', {
        searchTerm: '',
        startDate: getFirstDayOfCurrentMonth(),
        endDate: getTodayDate(),
        estado: '',
        closer: '',
        fuente: '',
        dateFilterBy: 'meet'
    });

    const { searchTerm, startDate, endDate, estado, closer, fuente, dateFilterBy } = filters;
    const setSearchTerm = (val) => setFilters({ searchTerm: val });
    const setStartDate = (val) => setFilters({ startDate: val });
    const setEndDate = (val) => setFilters({ endDate: val });
    const setEstado = (val) => setFilters({ estado: val });
    const setCloser = (val) => setFilters({ closer: val });
    const setFuente = (val) => setFilters({ fuente: val });
    const setDateFilterBy = (val) => setFilters({ dateFilterBy: val });

    const applyDatePreset = (preset) => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        let start = '';
        let end = todayStr;

        if (preset === 'today') {
            start = todayStr;
            end = todayStr;
        } else if (preset === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);
            start = yesterday.toISOString().split('T')[0];
            end = start;
        } else if (preset === 'this_month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            end = todayStr;
        } else if (preset === 'last_month') {
            const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            start = firstOfLastMonth.toISOString().split('T')[0];
            end = lastOfLastMonth.toISOString().split('T')[0];
        } else if (preset === 'upcoming') {
            start = todayStr;
            end = '';
        }

        setFilters({ startDate: start, endDate: end });
    };

    const getActiveDatePreset = () => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        
        const lastMonthFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthLast = new Date(today.getFullYear(), today.getMonth(), 0);
        const lastMonthStartStr = lastMonthFirst.toISOString().split('T')[0];
        const lastMonthEndStr = lastMonthLast.toISOString().split('T')[0];
        
        if (startDate === todayStr && endDate === todayStr) return 'today';
        if (startDate === yesterdayStr && endDate === yesterdayStr) return 'yesterday';
        if (startDate === thisMonthStart && endDate === todayStr) return 'this_month';
        if (startDate === lastMonthStartStr && endDate === lastMonthEndStr) return 'last_month';
        if (startDate === todayStr && endDate === '') return 'upcoming';
        return 'custom';
    };

    // Forzar inicio en el mes actual si los filtros cargados de localStorage están vacíos
    useEffect(() => {
        if (!startDate && !endDate) {
            setFilters({
                startDate: getFirstDayOfCurrentMonth(),
                endDate: getTodayDate()
            });
        }
    }, []);

    const loaderRef = useRef(null);

    const fetchAgendas = async (pageToFetch = 1) => {
        if (pageToFetch === 1) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }
        try {
            setError(null);
            const response = await api.get('/public/financial-agendas', {
                params: {
                    page: pageToFetch,
                    limit: 10,
                    search: searchTerm,
                    start_date: startDate,
                    end_date: endDate,
                    estado: estado,
                    closer: closer,
                    fuente: fuente,
                    date_filter_by: dateFilterBy
                }
            });
            const resData = response.data;
            const newAgendas = resData.data || [];
            
            if (pageToFetch === 1) {
                setAgendas(newAgendas);
                setTotalAgendados(resData.total || 0);
                setProximasCitas(resData.upcoming_count || 0);
                
                // Parse de conteo de closer
                const byCloser = resData.by_closer || {};
                const sorted = Object.entries(byCloser).sort((a, b) => b[1] - a[1]);
                setSortedClosers(sorted);

                setByCloserState(resData.by_closer_state || {});
                setBySourceState(resData.by_source_state || {});

                setUniqueStates(resData.unique_states || []);
                setUniqueClosers(resData.unique_closers || []);
                setUniqueSources(resData.unique_sources || []);
            } else {
                setAgendas(prev => {
                    const existingIds = new Set(prev.map(a => a.id));
                    const uniqueNew = newAgendas.filter(a => !existingIds.has(a.id));
                    return [...prev, ...uniqueNew];
                });
            }
            setHasMore(resData.has_more);
            setPage(pageToFetch);
        } catch (err) {
            console.error('Error fetching financial agendas:', err);
            setError('No se pudo conectar con el servidor de agendas.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Búsqueda con debounce
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchAgendas(1);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, startDate, endDate, estado, closer, fuente, dateFilterBy]);

    // Observador para scroll infinito
    useEffect(() => {
        if (loading || loadingMore || !hasMore) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                fetchAgendas(page + 1);
            }
        }, {
            threshold: 0.1,
            rootMargin: '100px'
        });

        if (loaderRef.current) {
            observer.observe(loaderRef.current);
        }

        return () => {
            if (loaderRef.current) {
                observer.unobserve(loaderRef.current);
            }
        };
    }, [loading, loadingMore, hasMore, page]);



    return (
        <div className="p-8 pt-24 max-w-[98%] mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex flex-wrap items-center gap-6">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-black text-white italic tracking-tighter text-balance">Tablero de Agendas</h1>
                        <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Registro de Citas Externas (Sheets)</p>
                    </div>

                    {/* KPI Section integrada en la cabecera */}
                    <div className="flex flex-wrap gap-2.5 items-center">
                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl py-2.5 px-4 hover:bg-white/10 transition-colors">
                            <Users className="text-slate-400" size={13} />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Agendados</span>
                            <span className="text-base font-black text-white italic tracking-tight">{totalAgendados}</span>
                        </div>

                        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl py-2.5 px-4 hover:bg-primary/10 transition-colors shadow-sm">
                            <CalendarIcon className="text-primary" size={13} />
                            <span className="text-[9px] font-black text-primary/80 uppercase tracking-widest">Próximas Citas</span>
                            <span className="text-base font-black text-white italic tracking-tight">{proximasCitas}</span>
                        </div>
                    </div>
                </div>

                <div className="relative group w-full lg:w-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar fuente o cliente..."
                        className="bg-surface border border-base rounded-2xl pl-12 pr-6 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all w-full lg:w-64 text-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </header>

            {/* Barra de Filtros y Control Unificada */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-[1.8rem] p-4 flex flex-wrap items-center justify-between gap-4">
                {/* Controles de Rango de Fecha */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Botón deslizable (Toggle Switch) para escoger el tipo de fecha */}
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filtrar por:</span>
                        <div className="relative flex items-center bg-slate-950 border border-white/5 p-0.5 rounded-xl h-7 w-44">
                            {/* Deslizable de fondo */}
                            <div 
                                className={`absolute top-0.5 bottom-0.5 rounded-lg bg-primary/20 border border-primary/30 transition-all duration-300 ${
                                    dateFilterBy === 'created' ? 'left-[calc(50%+1px)] right-0.5' : 'left-0.5 right-[calc(50%+1px)]'
                                }`}
                            />
                            <button
                                type="button"
                                onClick={() => setDateFilterBy('meet')}
                                className={`flex-1 text-[9px] font-black uppercase tracking-wider text-center relative z-10 transition-colors duration-300 cursor-pointer ${
                                    dateFilterBy === 'meet' ? 'text-white font-bold' : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                Fecha Meet
                            </button>
                            <button
                                type="button"
                                onClick={() => setDateFilterBy('created')}
                                className={`flex-1 text-[9px] font-black uppercase tracking-wider text-center relative z-10 transition-colors duration-300 cursor-pointer ${
                                    dateFilterBy === 'created' ? 'text-white font-bold' : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                F. Creación
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 bg-white/5 border border-white/10 p-1.5 rounded-2xl">
                        {[
                            { id: 'today', label: 'Hoy' },
                            { id: 'yesterday', label: 'Ayer' },
                            { id: 'this_month', label: 'Este mes' },
                            { id: 'last_month', label: 'Mes pasado' },
                            { id: 'upcoming', label: 'Próximas' }
                        ].map((preset) => {
                            const isActive = getActiveDatePreset() === preset.id;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => applyDatePreset(preset.id)}
                                    className={`text-[9px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                                        isActive
                                            ? 'bg-primary/20 text-white shadow-md border border-primary/30'
                                            : 'border border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-2.5 rounded-2xl">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 cursor-pointer p-0 w-[100px] font-semibold"
                        />
                        <span className="text-muted text-xs font-bold">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 cursor-pointer p-0 w-[100px] font-semibold"
                        />
                    </div>
                </div>

                {/* Filtros de Clasificación (Estado, Closer, Fuente) */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Selector de Estado */}
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-2.5 rounded-2xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Estado</span>
                        <select
                            value={estado}
                            onChange={(e) => setEstado(e.target.value)}
                            className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 cursor-pointer pr-8 font-bold uppercase tracking-wider p-0"
                        >
                            <option value="" className="bg-slate-900 text-white font-semibold">Todos</option>
                            {['Pendiente', 'Show Up', 'No show', 'Reagendada', 'Cancelada'].map(st => (
                                <option key={st} value={st} className="bg-slate-900 text-white font-semibold">{st}</option>
                            ))}
                        </select>
                    </div>

                    {/* Selector de Closer */}
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-2.5 rounded-2xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Closer</span>
                        <select
                            value={closer}
                            onChange={(e) => setCloser(e.target.value)}
                            className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 cursor-pointer pr-8 font-bold uppercase tracking-wider p-0"
                        >
                            <option value="" className="bg-slate-900 text-white font-semibold">Todos</option>
                            {uniqueClosers.map(cl => (
                                <option key={cl} value={cl} className="bg-slate-900 text-white font-semibold">{cl}</option>
                            ))}
                        </select>
                    </div>

                    {/* Selector de Fuente */}
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-2.5 rounded-2xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Fuente</span>
                        <select
                            value={fuente}
                            onChange={(e) => setFuente(e.target.value)}
                            className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 cursor-pointer pr-8 font-bold uppercase tracking-wider p-0"
                        >
                            <option value="" className="bg-slate-900 text-white font-semibold">Todas</option>
                            {uniqueSources.map(src => (
                                <option key={src} value={src} className="bg-slate-900 text-white font-semibold">{src}</option>
                            ))}
                        </select>
                    </div>

                    {/* Botón para Limpiar todos los Filtros */}
                    {(estado || closer || fuente || searchTerm || startDate !== getFirstDayOfCurrentMonth() || endDate !== getTodayDate()) && (
                        <button
                            type="button"
                            onClick={() => setFilters({
                                searchTerm: '',
                                startDate: getFirstDayOfCurrentMonth(),
                                endDate: getTodayDate(),
                                estado: '',
                                closer: '',
                                fuente: ''
                            })}
                            className="p-3 bg-rose-600/10 border border-rose-500/20 hover:bg-rose-600 hover:text-white text-rose-400 rounded-2xl transition-all cursor-pointer shadow-sm shadow-rose-950/20"
                            title="Limpiar Filtros"
                        >
                            <FilterX size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Summary by Closer Section */}
            {/* Grid de Desgloses por Closer y por Fuente */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Desglose por Closer */}
                <Card variant="surface" className="p-6 space-y-6 rounded-[2rem] border-base relative overflow-hidden">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-[10px] font-black text-base uppercase tracking-widest flex items-center gap-2">
                            <Users className="text-primary" size={16} />
                            Desglose por Closer
                        </h3>
                    </div>
                    
                    {Object.keys(byCloserState).length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-base/60">
                                        <th className="py-3 px-2 font-black text-muted uppercase tracking-wider">Closer</th>
                                        <th className="py-3 px-2 font-black text-center text-slate-400 uppercase tracking-wider">Pnd</th>
                                        <th className="py-3 px-2 font-black text-center text-primary uppercase tracking-wider">Shw</th>
                                        <th className="py-3 px-2 font-black text-center text-rose-400 uppercase tracking-wider">Nsh</th>
                                        <th className="py-3 px-2 font-black text-center text-amber-400 uppercase tracking-wider">Rea</th>
                                        <th className="py-3 px-2 font-black text-center text-slate-500 uppercase tracking-wider">Can</th>
                                        <th className="py-3 px-2 font-black text-center text-white uppercase tracking-wider">Total</th>
                                        <th className="py-3 px-2 font-black text-right text-emerald-400 uppercase tracking-wider">Show Rate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-base/40">
                                    {Object.entries(byCloserState).map(([closerName, stats]) => {
                                        const showUp = stats["Show Up"] || 0;
                                        const noShow = stats["No show"] || 0;
                                        const totalAttended = showUp + noShow;
                                        const showRate = totalAttended > 0 ? ((showUp / totalAttended) * 100).toFixed(0) : 0;
                                        
                                        return (
                                            <tr key={closerName} className="hover:bg-white/5 transition-colors">
                                                <td className="py-3 px-2 font-bold text-slate-200 uppercase tracking-wider">{closerName}</td>
                                                <td className="py-3 px-2 text-center font-semibold text-slate-400">{stats["Pendiente"] || 0}</td>
                                                <td className="py-3 px-2 text-center font-bold text-primary">{stats["Show Up"] || 0}</td>
                                                <td className="py-3 px-2 text-center font-semibold text-rose-400">{stats["No show"] || 0}</td>
                                                <td className="py-3 px-2 text-center font-semibold text-amber-400">{stats["Reagendada"] || 0}</td>
                                                <td className="py-3 px-2 text-center font-semibold text-slate-500">{stats["Cancelada"] || 0}</td>
                                                <td className="py-3 px-2 text-center font-black text-white italic">{stats["total"] || 0}</td>
                                                <td className="py-3 px-2 text-right font-black text-emerald-400 italic">
                                                    {showRate}%
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        !loading && (
                            <div className="py-8 text-center text-muted text-xs font-bold tracking-widest uppercase">
                                Sin datos en el periodo
                            </div>
                        )
                    )}
                </Card>

                {/* Desglose por Fuente */}
                <Card variant="surface" className="p-6 space-y-6 rounded-[2rem] border-base relative overflow-hidden">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-[10px] font-black text-base uppercase tracking-widest flex items-center gap-2">
                            <Activity className="text-primary" size={16} />
                            Desglose por Fuente
                        </h3>
                    </div>
                    
                    {Object.keys(bySourceState).length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-base/60">
                                        <th className="py-3 px-2 font-black text-muted uppercase tracking-wider">Fuente</th>
                                        <th className="py-3 px-2 font-black text-center text-slate-400 uppercase tracking-wider">Pnd</th>
                                        <th className="py-3 px-2 font-black text-center text-primary uppercase tracking-wider">Shw</th>
                                        <th className="py-3 px-2 font-black text-center text-rose-400 uppercase tracking-wider">Nsh</th>
                                        <th className="py-3 px-2 font-black text-center text-amber-400 uppercase tracking-wider">Rea</th>
                                        <th className="py-3 px-2 font-black text-center text-slate-500 uppercase tracking-wider">Can</th>
                                        <th className="py-3 px-2 font-black text-center text-white uppercase tracking-wider">Total</th>
                                        <th className="py-3 px-2 font-black text-right text-emerald-400 uppercase tracking-wider">Show Rate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-base/40">
                                    {Object.entries(bySourceState).map(([sourceName, stats]) => {
                                        const showUp = stats["Show Up"] || 0;
                                        const noShow = stats["No show"] || 0;
                                        const totalAttended = showUp + noShow;
                                        const showRate = totalAttended > 0 ? ((showUp / totalAttended) * 100).toFixed(0) : 0;
                                        
                                        return (
                                            <tr key={sourceName} className="hover:bg-white/5 transition-colors">
                                                <td className="py-3 px-2 font-bold text-slate-200 uppercase tracking-wider">{sourceName}</td>
                                                <td className="py-3 px-2 text-center font-semibold text-slate-400">{stats["Pendiente"] || 0}</td>
                                                <td className="py-3 px-2 text-center font-bold text-primary">{stats["Show Up"] || 0}</td>
                                                <td className="py-3 px-2 text-center font-semibold text-rose-400">{stats["No show"] || 0}</td>
                                                <td className="py-3 px-2 text-center font-semibold text-amber-400">{stats["Reagendada"] || 0}</td>
                                                <td className="py-3 px-2 text-center font-semibold text-slate-500">{stats["Cancelada"] || 0}</td>
                                                <td className="py-3 px-2 text-center font-black text-white italic">{stats["total"] || 0}</td>
                                                <td className="py-3 px-2 text-right font-black text-emerald-400 italic">
                                                    {showRate}%
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        !loading && (
                            <div className="py-8 text-center text-muted text-xs font-bold tracking-widest uppercase">
                                Sin datos en el periodo
                            </div>
                        )
                    )}
                </Card>
            </div>

            {/* List Section */}
            <Card variant="surface" className="p-8 space-y-6 rounded-[2.5rem] border-base relative">
                <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-black text-base uppercase tracking-widest flex items-center gap-2">
                        <Table className="text-primary" size={16} />
                        Historial de Agendas
                    </h3>
                </div>

                {loading && !syncing ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted">Cargando registros...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-base">
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">F. Creación</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">F. Reunión</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Cliente</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Closer</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Fuente</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest text-center">Instagram</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest text-center">Estado</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-base/50">
                                    {agendas.map((agenda) => (
                                        <tr key={agenda.id} className="group hover:bg-white/5 transition-colors">
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-2">
                                                    <CalendarIcon size={14} className="text-muted" />
                                                    <span className="text-xs font-bold text-slate-400">
                                                        {formatDate(agenda.registro)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-2">
                                                    <CalendarIcon size={14} className="text-primary/70" />
                                                    <span className="text-sm font-bold text-slate-200">
                                                        {formatDate(agenda.date || agenda.fecha_meet)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span 
                                                    className="text-sm font-bold text-white hover:text-indigo-400 hover:underline cursor-pointer"
                                                    onClick={() => setSelectedRoadmapLead({
                                                        instagram: agenda.instagram,
                                                        email: agenda.mail,
                                                        phone: agenda.whatsapp,
                                                        full_name: agenda.lead
                                                    })}
                                                >
                                                    {agenda.lead}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <Badge variant="amber" className="rounded-lg px-2 py-0.5 text-[10px] uppercase font-black tracking-wider border-amber-500/30">
                                                    {agenda.closer}
                                                </Badge>
                                            </td>
                                            <td className="py-4 px-4">
                                                <Badge variant="indigo" className="rounded-lg px-2 py-0.5 text-[10px] uppercase font-black tracking-wider">
                                                    {agenda.nombre}
                                                </Badge>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                {agenda.instagram && agenda.instagram !== 'N/A' ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <a 
                                                            href={`https://instagram.com/${agenda.instagram.replace('@', '')}`} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                                        >
                                                            <Instagram size={10} />
                                                            {agenda.instagram.startsWith('@') ? agenda.instagram : `@${agenda.instagram}`}
                                                        </a>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigator.clipboard.writeText(agenda.instagram.startsWith('@') ? agenda.instagram : `@${agenda.instagram}`);
                                                            }}
                                                            className="text-muted hover:text-primary transition-colors p-1"
                                                            title="Copiar usuario"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted">No IG</span>
                                                )}
                                            </td>
                                             <td className="py-4 px-4 text-center">
                                                 <select
                                                     value={agenda.estado || 'Pendiente'}
                                                     onChange={async (e) => {
                                                         const nuevoEstado = e.target.value;
                                                         try {
                                                             const response = await api.put(`/public/financial-agendas/${agenda.id}`, { estado: nuevoEstado });
                                                             const updated = response.data.agenda;
                                                             setAgendas(prev => prev.map(a => a.id === updated.id ? updated : a));
                                                         } catch (err) {
                                                             console.error("Error updating agenda status in-line:", err);
                                                             alert("Error al actualizar el estado de la agenda");
                                                         }
                                                     }}
                                                     className={`rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border cursor-pointer outline-none focus:ring-1 focus:ring-primary/50 transition-all text-center border-box
                                                         ${agenda.estado === 'Show Up' ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20' : ''}
                                                         ${agenda.estado === 'No show' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' : ''}
                                                         ${agenda.estado === 'Reagendada' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' : ''}
                                                         ${agenda.estado === 'Cancelada' ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' : ''}
                                                         ${!agenda.estado || agenda.estado === 'Pendiente' ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' : ''}
                                                     `}
                                                 >
                                                     {['Pendiente', 'Show Up', 'No show', 'Reagendada', 'Cancelada'].map(st => (
                                                         <option key={st} value={st} className="bg-slate-900 text-white font-semibold">
                                                             {st}
                                                         </option>
                                                     ))}
                                                 </select>
                                             </td>
                                            <td className="py-4 px-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => handleEditClick(agenda)}
                                                        className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                                                        title="Editar Agenda"
                                                    >
                                                        <Edit size={12} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteClick(agenda.id)}
                                                        className="p-2 bg-rose-600/20 text-rose-400 border border-rose-600/30 rounded-lg hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                                                        title="Eliminar Agenda"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {agendas.length === 0 && (
                                        <tr>
                                            <td colSpan="8" className="py-20 text-center text-muted uppercase text-xs font-bold tracking-widest">
                                                No se encontraron agendas
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {hasMore && (
                            <div ref={loaderRef} className="flex justify-center p-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                            </div>
                        )}
                        {!hasMore && agendas.length > 0 && (
                            <div className="text-center p-4 text-xs text-slate-500 font-bold uppercase tracking-widest">
                                Todas las agendas cargadas
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Modal de Edición de Agenda */}
            {editingAgenda && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] max-w-2xl w-full max-h-[80dvh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        {/* Cabecera Fija */}
                        <div className="p-5 md:p-6 pb-3 border-b border-slate-800/60 flex-shrink-0">
                            <h3 className="text-lg font-black text-white italic uppercase">Editar Registro de Agenda</h3>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Modificar datos de la cita</p>
                        </div>
                        
                        <form onSubmit={handleEditSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            {/* Cuerpo con Scroll */}
                            <div className="p-5 md:p-6 space-y-4 text-left overflow-y-auto flex-1 min-h-0 custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente</label>
                                        <input 
                                            type="text"
                                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 outline-none focus:border-indigo-500 text-sm font-semibold"
                                            value={editForm.lead}
                                            onChange={e => setEditForm({...editForm, lead: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Meet (Texto)</label>
                                        <input 
                                            type="text"
                                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 outline-none focus:border-indigo-500 text-sm font-semibold"
                                            value={editForm.fecha_meet}
                                            onChange={e => setEditForm({...editForm, fecha_meet: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fuente</label>
                                        <input 
                                            type="text"
                                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 outline-none focus:border-indigo-500 text-sm font-semibold"
                                            value={editForm.nombre}
                                            onChange={e => setEditForm({...editForm, nombre: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Instagram</label>
                                        <input 
                                            type="text"
                                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 outline-none focus:border-indigo-500 text-sm font-semibold"
                                            value={editForm.instagram}
                                            onChange={e => setEditForm({...editForm, instagram: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Closer</label>
                                        <input 
                                            type="text"
                                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 outline-none focus:border-indigo-500 text-sm font-semibold"
                                            value={editForm.closer}
                                            onChange={e => setEditForm({...editForm, closer: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</label>
                                        <select 
                                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 text-sm font-semibold cursor-pointer"
                                            value={editForm.estado}
                                            onChange={e => setEditForm({...editForm, estado: e.target.value})}
                                            required
                                        >
                                            {['Pendiente', 'Show Up', 'No show', 'Reagendada', 'Cancelada'].map(st => (
                                                <option key={st} value={st} className="bg-slate-900 text-white">{st}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                                
                            {/* Footer Fijo */}
                            <div className="p-5 border-t border-slate-800/60 bg-slate-900/50 shrink-0 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setEditingAgenda(null)}
                                    className="flex-1 py-3 bg-slate-800 border border-slate-700 text-xs font-black uppercase tracking-widest text-slate-400 rounded-xl hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-3 bg-indigo-600 text-xs font-black uppercase tracking-widest text-white rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/30"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <LeadRoadmapModal 
                isOpen={!!selectedRoadmapLead}
                instagram={selectedRoadmapLead?.instagram}
                email={selectedRoadmapLead?.email}
                phone={selectedRoadmapLead?.phone}
                onClose={() => setSelectedRoadmapLead(null)}
                onSuccess={() => fetchAgendas(1)}
            />
        </div>
    );
};

export default FinancialAgendasPage;
