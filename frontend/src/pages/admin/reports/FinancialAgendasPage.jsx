import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import {
    Calendar as CalendarIcon,
    Activity,
    Search,
    Table,
    Users,
    Instagram,
    Copy
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import usePersistentFilters from '../../../hooks/usePersistentFilters';

const getFirstDayOfCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
};

const getTodayDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

const FinancialAgendasPage = () => {
    const [agendas, setAgendas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const [totalAgendados, setTotalAgendados] = useState(0);
    const [proximasCitas, setProximasCitas] = useState(0);
    const [sortedClosers, setSortedClosers] = useState([]);
    
    const { filters, updateFilter: setFilters } = usePersistentFilters('filters_financial_agendas', {
        searchTerm: '',
        startDate: getFirstDayOfCurrentMonth(),
        endDate: getTodayDate()
    });

    const { searchTerm, startDate, endDate } = filters;
    const setSearchTerm = (val) => setFilters({ searchTerm: val });
    const setStartDate = (val) => setFilters({ startDate: val });
    const setEndDate = (val) => setFilters({ endDate: val });

    // Forzar inicio en el mes actual si los filtros cargados de localStorage están vacíos
    useEffect(() => {
        if (!startDate || !endDate) {
            setFilters({
                startDate: startDate || getFirstDayOfCurrentMonth(),
                endDate: endDate || getTodayDate()
            });
        }
    }, [startDate, endDate]);

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
                    end_date: endDate
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
    }, [searchTerm, startDate, endDate]);

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

    const handleSync = async () => {
        try {
            setLoading(true);
            setSyncing(true);
            setError(null);
            await api.get('/sheets/sync', { params: { tabla: 'Llamadas_DB' } });
        } catch (err) {
            console.warn('Sync failed:', err);
        } finally {
            setSyncing(false);
            await fetchAgendas(1);
        }
    };

    return (
        <div className="p-8 pt-24 max-w-[98%] mx-auto space-y-10 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-white italic tracking-tighter text-balance">Tablero de Agendas</h1>
                    <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Registro de Citas Externas (Sheets)</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 bg-surface p-2 rounded-2xl border border-base">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0"
                        />
                        <span className="text-muted text-xs">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0"
                        />
                    </div>
                     <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar setter o cliente..."
                            className="bg-surface border border-base rounded-2xl pl-12 pr-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all w-64 text-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={handleSync} variant="surface" size="md" icon={Activity} className="rounded-2xl border-base hover:border-primary/50" disabled={loading}>
                        {loading && syncing ? 'Sincronizando...' : 'Actualizar Agendas'}
                    </Button>
                </div>
            </header>

            {/* KPI Section */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl py-2 px-4 hover:bg-white/10 transition-colors">
                    <Users className="text-slate-400" size={14} />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Agendados</span>
                    <span className="text-lg font-black text-white italic tracking-tight">{totalAgendados}</span>
                </div>

                <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl py-2 px-4 hover:bg-primary/10 transition-colors shadow-sm">
                    <CalendarIcon className="text-primary" size={14} />
                    <span className="text-[9px] font-black text-primary/80 uppercase tracking-widest font-black">Próximas Citas</span>
                    <span className="text-lg font-black text-white italic tracking-tight">{proximasCitas}</span>
                </div>
            </div>

            {/* Summary by Closer Section */}
            <Card variant="surface" className="p-8 space-y-6 rounded-[2.5rem] border-base relative overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black text-base uppercase tracking-widest flex items-center gap-2">
                        <Users className="text-primary" size={16} />
                        Agendas por Closer
                    </h3>
                </div>
                
                {sortedClosers.length > 0 ? (
                    <div className="space-y-6">
                        {/* Stacked/Segmented bar chart */}
                        <div className="h-6 w-full bg-slate-900 border border-slate-700/30 rounded-full flex overflow-hidden shadow-inner">
                            {(() => {
                                const totalCloserAgendas = sortedClosers.reduce((acc, [_, count]) => acc + count, 0);
                                const SEGMENT_COLORS = [
                                    'from-indigo-500 to-purple-500 shadow-indigo-500/20',
                                    'from-pink-500 to-rose-500 shadow-pink-500/20',
                                    'from-amber-400 to-orange-500 shadow-amber-500/20',
                                    'from-cyan-400 to-blue-500 shadow-cyan-500/20',
                                    'from-emerald-400 to-teal-500 shadow-emerald-500/20',
                                    'from-violet-500 to-fuchsia-500 shadow-violet-500/20',
                                ];
                                
                                return sortedClosers.map(([closerName, count], idx) => {
                                    const pct = totalCloserAgendas > 0 ? (count / totalCloserAgendas) * 100 : 0;
                                    if (pct <= 0) return null;
                                    const colorClass = SEGMENT_COLORS[idx % SEGMENT_COLORS.length];
                                    
                                    return (
                                        <div 
                                            key={closerName}
                                            style={{ width: `${pct}%` }}
                                            className={`h-full bg-gradient-to-r ${colorClass} hover:opacity-90 transition-all duration-300 relative group cursor-pointer border-r border-slate-950/20 last:border-0`}
                                            title={`${closerName}: ${count} agendas (${pct.toFixed(1)}%)`}
                                        >
                                            {pct >= 8 && (
                                                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white italic tracking-tighter drop-shadow-sm select-none">
                                                    {count}
                                                </span>
                                            )}
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Premium dynamic legend */}
                        <div className="flex flex-wrap gap-x-6 gap-y-3 justify-center">
                            {(() => {
                                const totalCloserAgendas = sortedClosers.reduce((acc, [_, count]) => acc + count, 0);
                                const SEGMENT_COLORS = [
                                    'from-indigo-500 to-purple-500 shadow-indigo-500/20',
                                    'from-pink-500 to-rose-500 shadow-pink-500/20',
                                    'from-amber-400 to-orange-500 shadow-amber-500/20',
                                    'from-cyan-400 to-blue-500 shadow-cyan-500/20',
                                    'from-emerald-400 to-teal-500 shadow-emerald-500/20',
                                    'from-violet-500 to-fuchsia-500 shadow-violet-500/20',
                                ];
                                
                                return sortedClosers.map(([closerName, count], idx) => {
                                    const pct = totalCloserAgendas > 0 ? ((count / totalCloserAgendas) * 100).toFixed(1) : 0;
                                    const colorClass = SEGMENT_COLORS[idx % SEGMENT_COLORS.length];
                                    
                                    return (
                                        <div 
                                            key={closerName} 
                                            className="flex items-center gap-2 text-xs font-bold text-slate-300 bg-white/5 border border-white/10 hover:border-white/20 transition-all rounded-full px-3 py-1.5 shadow-sm hover:bg-white/10 cursor-pointer"
                                        >
                                            <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-tr ${colorClass.split(' ')[0]} ${colorClass.split(' ')[1]}`} />
                                            <span className="uppercase text-[9px] tracking-widest text-slate-400 font-black">{closerName}</span>
                                            <span className="text-white font-black italic">
                                                {count} 
                                                <span className="text-[9px] text-muted normal-case font-medium ml-1">({pct}%)</span>
                                            </span>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                ) : (
                    !loading && (
                        <div className="py-8 text-center text-muted text-xs font-bold tracking-widest uppercase">
                            No hay agendas en el rango seleccionado
                        </div>
                    )
                )}
            </Card>

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
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Fecha</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Cliente</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Closer</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Setter</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest text-center">Instagram</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest text-right">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-base/50">
                                    {agendas.map((agenda) => (
                                        <tr key={agenda.id} className="group hover:bg-white/5 transition-colors">
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-2">
                                                    <CalendarIcon size={14} className="text-muted" />
                                                    <span className="text-sm font-bold text-base">
                                                        {agenda.fecha_meet}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="text-sm font-bold text-white">{agenda.nombre}</span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <Badge variant="amber" className="rounded-lg px-2 py-0.5 text-[10px] uppercase font-black tracking-wider border-amber-500/30">
                                                    {agenda.closer}
                                                </Badge>
                                            </td>
                                            <td className="py-4 px-4">
                                                <Badge variant="indigo" className="rounded-lg px-2 py-0.5 text-[10px] uppercase font-black tracking-wider">
                                                    {agenda.lead}
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
                                            <td className="py-4 px-4 text-right">
                                                <Badge variant="success" className="rounded-lg">
                                                    Sincronizado
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                    {agendas.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="py-20 text-center text-muted uppercase text-xs font-bold tracking-widest">
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
        </div>
    );
};

export default FinancialAgendasPage;
