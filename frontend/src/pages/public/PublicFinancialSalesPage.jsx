import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { RefreshCcw, Search, Edit2, Check, X, Calendar, DollarSign, Users, Percent, TrendingUp } from 'lucide-react';
import Card from '../../components/ui/Card';
import usePersistentFilters from '../../hooks/usePersistentFilters';

const getFirstDayOfCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
};

const getTodayDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

const getSourceColors = (name) => {
    const norm = name ? name.toLowerCase() : '';
    if (norm === 'elias') return { gradient: 'from-violet-500 to-indigo-600', dot: 'bg-violet-500', text: 'text-violet-400', bg: 'bg-violet-500/10' };
    if (norm === 'workshop') return { gradient: 'from-emerald-400 to-teal-500', dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (norm === 'vsl') return { gradient: 'from-rose-500 to-fuchsia-600', dot: 'bg-rose-500', text: 'text-rose-400', bg: 'bg-rose-500/10' };
    if (norm === 'laura') return { gradient: 'from-amber-400 to-orange-500', dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10' };
    if (norm === 'brisa') return { gradient: 'from-pink-400 to-rose-400', dot: 'bg-pink-400', text: 'text-pink-400', bg: 'bg-pink-500/10' };
    if (norm === 'domingo') return { gradient: 'from-sky-400 to-blue-500', dot: 'bg-sky-400', text: 'text-sky-400', bg: 'bg-sky-500/10' };
    return { gradient: 'from-slate-500 to-slate-600', dot: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-500/10' };
};

const PublicFinancialSalesPage = () => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const [totalSalesAmount, setTotalSalesAmount] = useState(0);
    const [sourcesBreakdown, setSourcesBreakdown] = useState([]);
    const [customPercentage, setCustomPercentage] = useState(10); // default 10%
    const [agendaBreakdown, setAgendaBreakdown] = useState(null);
    const [paymentTypesBreakdown, setPaymentTypesBreakdown] = useState([]);
    const [uniquePaymentTypes, setUniquePaymentTypes] = useState([]);
    
    const { filters, updateFilter: setFilters } = usePersistentFilters('filters_financial_sales', {
        searchTerm: '',
        startDate: getFirstDayOfCurrentMonth(),
        endDate: getTodayDate(),
        tipoPago: ''
    });

    const { searchTerm, startDate, endDate, tipoPago } = filters;
    const setSearchTerm = (val) => setFilters({ searchTerm: val });
    const setStartDate = (val) => setFilters({ startDate: val });
    const setEndDate = (val) => setFilters({ endDate: val });
    const setTipoPago = (val) => setFilters({ tipoPago: val });

    // Forzar inicio en el mes actual si los filtros cargados de localStorage están vacíos
    useEffect(() => {
        if (!startDate || !endDate) {
            setFilters({
                startDate: startDate || getFirstDayOfCurrentMonth(),
                endDate: endDate || getTodayDate(),
                tipoPago: tipoPago || ''
            });
        }
    }, [startDate, endDate]);

    // Estado del modal de edición
    const [editingSale, setEditingSale] = useState(null);
    const [editData, setEditData] = useState({});
    
    const loaderRef = useRef(null);

    const fetchSales = async (pageToFetch = 1) => {
        if (pageToFetch === 1) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }
        try {
            const res = await api.get('/public/financial-sales', {
                params: {
                    page: pageToFetch,
                    limit: 10,
                    search: searchTerm,
                    start_date: startDate,
                    end_date: endDate,
                    tipo_pago: tipoPago
                }
            });
            const newSales = res.data.data || [];
            if (pageToFetch === 1) {
                setSales(newSales);
            } else {
                setSales(prev => {
                    const existingIds = new Set(prev.map(s => s.id));
                    const uniqueNew = newSales.filter(s => !existingIds.has(s.id));
                    return [...prev, ...uniqueNew];
                });
            }
            setHasMore(res.data.has_more);
            setPage(pageToFetch);
            
            // Atribuir valores agregados retornados del backend
            setTotalSalesAmount(res.data.total_monto || 0);
            setSourcesBreakdown(res.data.sources_breakdown || []);
            setAgendaBreakdown(res.data.agenda_breakdown || null);
            setPaymentTypesBreakdown(res.data.payment_types_breakdown || []);
            setUniquePaymentTypes(res.data.unique_payment_types || []);
        } catch (error) {
            toast.error('Error al cargar las ventas');
            console.error(error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Búsqueda con debounce
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchSales(1);
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, startDate, endDate, tipoPago]);

    // Observador para scroll infinito
    useEffect(() => {
        if (loading || loadingMore || !hasMore) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                fetchSales(page + 1);
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
        setSyncing(true);
        try {
            const res = await api.post('/public/financial-sales/sync');
            toast.success(res.data.message || 'Sincronización exitosa');
            fetchSales(1);
        } catch (error) {
            toast.error('Error al sincronizar');
            console.error(error);
        } finally {
            setSyncing(false);
        }
    };

    const handleEditClick = (sale) => {
        setEditingSale(sale.id);
        setEditData({
            instagram: sale.instagram || '',
            nombre_cliente: sale.nombre_cliente || '',
            email_vendedor: sale.email_vendedor || '',
            amount: sale.monto || 0,
            product: sale.tipo_pago || '',
            payment_type: sale.metodo_pago || '',
            setter_name: sale.setter || '',
            estado: sale.estado || 'Completada'
        });
    };

    const handleSave = async (id) => {
        try {
            const res = await api.put(`/public/financial-sales/${id}`, editData);
            toast.success('Venta actualizada correctamente');
            
            setSales(sales.map(s => s.id === id ? { ...s, ...res.data.sale } : s));
            setEditingSale(null);
        } catch (error) {
            toast.error('Error al actualizar venta');
            console.error(error);
        }
    };

    return (
        <div className="w-full p-4 lg:p-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white">Registro de Ventas</h1>
                    <p className="text-sm text-slate-400">Verifica y corrige las ventas para correcta atribución.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent border-none text-xs text-slate-200 focus:outline-none focus:ring-0 cursor-pointer"
                        />
                        <span className="text-slate-500 text-xs">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent border-none text-xs text-slate-200 focus:outline-none focus:ring-0 cursor-pointer"
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pago:</span>
                        <select
                            value={tipoPago}
                            onChange={(e) => setTipoPago(e.target.value)}
                            className="bg-transparent border-none text-xs text-slate-200 focus:outline-none focus:ring-0 cursor-pointer max-w-[130px] pr-8 focus:ring-0"
                        >
                            <option value="" className="bg-slate-900 text-white">Todos</option>
                            {uniquePaymentTypes
                                .sort((a, b) => a.localeCompare(b))
                                .map((type) => (
                                    <option key={type} value={type} className="bg-slate-900 text-white">
                                        {type}
                                    </option>
                                ))
                            }
                        </select>
                    </div>

                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por cliente o IG..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                    </div>
                    
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white text-sm font-semibold transition-all shadow-lg"
                    >
                        <RefreshCcw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Sincronizar Sheets'}</span>
                    </button>
                </div>
            </div>

            {/* KPIs Panels */}
            {agendaBreakdown && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* KPI 1: Cash Collect por Agendas */}
                    <Card variant="surface" className="p-6 rounded-[2rem] border-slate-800 space-y-6 relative overflow-hidden bg-slate-900/40 backdrop-blur-md">
                        <div className="space-y-1">
                            <h2 className="text-lg font-black text-white italic tracking-tight uppercase flex items-center gap-2">
                                <Users className="text-indigo-400" size={18} />
                                Atribución por Agendas
                            </h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">
                                Total del Período: <span className="text-emerald-400 font-black text-sm">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(totalSalesAmount)} USD</span>
                            </p>
                        </div>

                        {(() => {
                            const total = agendaBreakdown.con_agenda.total_monto + agendaBreakdown.sin_agenda.total_monto;
                            const pctCon = total > 0 ? (agendaBreakdown.con_agenda.total_monto / total) * 100 : 0;
                            const pctSin = total > 0 ? (agendaBreakdown.sin_agenda.total_monto / total) * 100 : 0;
                            
                            const conCount = agendaBreakdown.con_agenda.count || 0;
                            const conMonto = agendaBreakdown.con_agenda.total_monto || 0;
                            const totalAgendas = agendaBreakdown.con_agenda.total_agendas || 0;
                            const ticketCon = conCount > 0 ? conMonto / conCount : 0;
                            const promCita = totalAgendas > 0 ? conMonto / totalAgendas : 0;

                            const sinCount = agendaBreakdown.sin_agenda.count || 0;
                            const sinMonto = agendaBreakdown.sin_agenda.total_monto || 0;
                            const ticketSin = sinCount > 0 ? sinMonto / sinCount : 0;

                            return (
                                <div className="space-y-4">
                                    <div className="flex h-3.5 w-full rounded-full bg-slate-950 overflow-hidden shadow-inner border border-slate-800/40">
                                        {pctCon > 0 && (
                                            <div
                                                style={{ width: `${pctCon}%` }}
                                                className="h-full bg-gradient-to-r from-violet-500 to-indigo-600 transition-all duration-500"
                                                title={`Con Agenda: ${pctCon.toFixed(1)}%`}
                                            />
                                        )}
                                        {pctSin > 0 && (
                                            <div
                                                style={{ width: `${pctSin}%` }}
                                                className="h-full bg-gradient-to-r from-slate-600 to-slate-500 transition-all duration-500"
                                                title={`Sin Agenda / Orgánico: ${pctSin.toFixed(1)}%`}
                                            />
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all">
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-violet-500" />
                                                        Con Agenda
                                                    </span>
                                                    <span className="text-[10px] font-black text-slate-500">{pctCon.toFixed(1)}%</span>
                                                </div>
                                                <div className="flex justify-between items-baseline mt-1">
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase">{conCount} {conCount === 1 ? 'venta' : 'ventas'}</span>
                                                    <span className="text-lg font-black text-violet-400 italic">
                                                        ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(conMonto)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-3 pt-3 border-t border-slate-900/60 space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span className="text-slate-500 font-semibold uppercase">Tkt Promedio</span>
                                                    <span className="text-indigo-300 font-black">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(ticketCon)} USD</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span className="text-slate-500 font-semibold uppercase flex items-center gap-1">
                                                        Rec. x Agenda
                                                        <span className="text-[9px] lowercase text-slate-600">({totalAgendas})</span>
                                                    </span>
                                                    <span className="text-emerald-400 font-black">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(promCita)} USD</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all">
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full bg-slate-500" />
                                                        Sin Agenda
                                                    </span>
                                                    <span className="text-[10px] font-black text-slate-500">{pctSin.toFixed(1)}%</span>
                                                </div>
                                                <div className="flex justify-between items-baseline mt-1">
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase">{sinCount} {sinCount === 1 ? 'venta' : 'ventas'}</span>
                                                    <span className="text-lg font-black text-slate-400 italic">
                                                        ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(sinMonto)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-3 pt-3 border-t border-slate-900/60 space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span className="text-slate-500 font-semibold uppercase">Tkt Promedio</span>
                                                    <span className="text-slate-300 font-black">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(ticketSin)} USD</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] opacity-0 pointer-events-none select-none">
                                                    <span className="text-slate-500 font-semibold uppercase">Placeholder</span>
                                                    <span className="font-black">$0 USD</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </Card>

                    {/* KPI 2: Cash Collect por Tipo de Pago */}
                    <Card variant="surface" className="p-6 rounded-[2rem] border-slate-800 space-y-4 relative overflow-hidden bg-slate-900/40 backdrop-blur-md">
                        <div className="space-y-1">
                            <h2 className="text-lg font-black text-white italic tracking-tight uppercase flex items-center gap-2">
                                <DollarSign className="text-emerald-400" size={18} />
                                Cash Collect por Tipo de Pago
                            </h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">
                                Formatos de Recaudación Activos
                            </p>
                        </div>

                        <div className="max-h-[160px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                            {paymentTypesBreakdown
                                .sort((a, b) => b.total_monto - a.total_monto)
                                .map((pt) => {
                                    const pct = totalSalesAmount > 0 ? (pt.total_monto / totalSalesAmount) * 100 : 0;
                                    
                                    let payColor = "text-sky-400 bg-sky-500/10 border-sky-500/20";
                                    const norm = pt.tipo_pago.toLowerCase();
                                    if (norm.includes("completo") || norm.includes("pif") || norm.includes("learner")) {
                                        payColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                                    } else if (norm.includes("seña") || norm.includes("sena")) {
                                        payColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
                                    } else if (norm.includes("cuota")) {
                                        payColor = "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20";
                                    } else if (norm.includes("parcial") || norm.includes("split")) {
                                        payColor = "text-violet-400 bg-violet-500/10 border-violet-500/20";
                                    }

                                    return (
                                        <div key={pt.tipo_pago} className="flex items-center justify-between bg-slate-950/30 border border-slate-900 p-2.5 rounded-xl hover:border-slate-800 transition-all">
                                            <div className="flex items-center gap-2.5">
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${payColor}`}>
                                                    {pt.tipo_pago}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase">
                                                    {pt.count} {pt.count === 1 ? 'Venta' : 'Ventas'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-slate-500 font-black tracking-tighter">
                                                    {pct.toFixed(0)}%
                                                </span>
                                                <span className="text-sm font-black text-white italic">
                                                    ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(pt.total_monto)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </Card>
                </div>
            )}

            {/* Sales breakdown by source (setter) */}
            {sourcesBreakdown.length > 0 && (
                <Card variant="surface" className="p-6 rounded-[2rem] border-slate-800 space-y-6 relative overflow-hidden bg-slate-900/40">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="space-y-1">
                            <h2 className="text-lg font-black text-white italic tracking-tight uppercase flex items-center gap-2">
                                <TrendingUp className="text-violet-500" size={18} />
                                Ventas por Fuente (Setter)
                            </h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">
                                Total Acumulado: <span className="text-emerald-400 font-black text-sm">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(totalSalesAmount)} USD</span>
                            </p>
                        </div>

                        {/* Interactive Commission Input */}
                        <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                            <Percent className="text-violet-400 w-4 h-4" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calcular % Atribución:</span>
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={customPercentage}
                                    onChange={(e) => setCustomPercentage(parseFloat(e.target.value) || 0)}
                                    className="w-12 bg-white border border-slate-300 text-xs font-black text-black rounded-lg px-2 py-1 text-center focus:outline-none focus:border-violet-500 font-bold"
                                />
                                <span className="text-xs font-black text-slate-400">%</span>
                            </div>
                        </div>
                    </div>

                    {/* Visual Segmented Progress Bar */}
                    <div className="flex h-3 w-full rounded-full bg-slate-950 overflow-hidden shadow-inner border border-slate-800/40">
                        {sourcesBreakdown
                            .sort((a, b) => b.total_monto - a.total_monto)
                            .map((source) => {
                                const pct = totalSalesAmount > 0 ? (source.total_monto / totalSalesAmount) * 100 : 0;
                                if (pct <= 0) return null;
                                const colors = getSourceColors(source.source);
                                return (
                                    <div
                                        key={source.source}
                                        style={{ width: `${pct}%` }}
                                        className={`h-full bg-gradient-to-r ${colors.gradient} transition-all duration-500`}
                                        title={`${source.source}: ${pct.toFixed(1)}%`}
                                    />
                                );
                            })}
                    </div>

                    {/* Breakdown Sources Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {sourcesBreakdown
                            .sort((a, b) => b.total_monto - a.total_monto)
                            .map((source) => {
                                const pct = totalSalesAmount > 0 ? (source.total_monto / totalSalesAmount) * 100 : 0;
                                const colors = getSourceColors(source.source);
                                const customShare = (source.total_monto * customPercentage) / 100;
                                
                                return (
                                    <div key={source.source} className="bg-slate-950/50 border border-slate-800/60 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700/80 transition-all group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                                                <span className="text-xs font-black text-white uppercase tracking-tight">
                                                    {source.source.charAt(0).toUpperCase() + source.source.slice(1)}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                {pct.toFixed(1)}%
                                            </span>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Recaudado</span>
                                                <span className="text-base font-black text-emerald-400 italic">
                                                    ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(source.total_monto)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] text-slate-400">
                                                <span>{source.count} {source.count === 1 ? 'venta' : 'ventas'}</span>
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">Volumen</span>
                                            </div>
                                        </div>

                                        {/* Dynamic commission box */}
                                        <div className="mt-3 pt-3 border-t border-slate-900 flex justify-between items-center bg-slate-950/80 p-2 rounded-xl">
                                            <span className="text-[9px] font-bold text-violet-400 uppercase tracking-widest">{customPercentage}% Calc</span>
                                            <span className="text-xs font-black text-white italic">
                                                ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(customShare)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </Card>
            )}

            <Card className="overflow-x-auto">
                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                                    <th className="p-4 font-semibold">Fecha</th>
                                    <th className="p-4 font-semibold">Cliente</th>
                                    <th className="p-4 font-semibold">Instagram</th>
                                    <th className="p-4 font-semibold text-right">Monto</th>
                                    <th className="p-4 font-semibold">Producto/Pago</th>
                                    <th className="p-4 font-semibold">Roles</th>
                                    <th className="p-4 font-semibold">Estado</th>
                                    <th className="p-4 font-semibold text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm text-slate-300 divide-y divide-slate-800/50">
                                {sales.map((sale) => {
                                    const isEditing = editingSale === sale.id;
                                    
                                    return (
                                        <tr key={sale.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="p-4 whitespace-nowrap">
                                                {new Date(sale.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            
                                            <td className="p-4">
                                                {isEditing ? (
                                                    <input 
                                                        type="text" 
                                                        value={editData.nombre_cliente} 
                                                        onChange={e => setEditData({...editData, nombre_cliente: e.target.value})}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                                    />
                                                ) : (
                                                    <span className="font-medium text-white">{sale.nombre_cliente || 'N/A'}</span>
                                                )}
                                            </td>
                                            
                                            <td className="p-4">
                                                {isEditing ? (
                                                    <input 
                                                        type="text" 
                                                        value={editData.instagram} 
                                                        onChange={e => setEditData({...editData, instagram: e.target.value})}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                                        placeholder="Sin @"
                                                    />
                                                ) : (
                                                    <span className={`${!sale.instagram || sale.instagram === 'N/A' ? 'text-red-400 font-semibold' : 'text-slate-300'}`}>
                                                        {sale.instagram ? `@${sale.instagram}` : 'Falta IG'}
                                                    </span>
                                                )}
                                            </td>
                                            
                                            <td className="p-4 text-right">
                                                {isEditing ? (
                                                    <input 
                                                        type="number" 
                                                        value={editData.amount} 
                                                        onChange={e => setEditData({...editData, amount: e.target.value})}
                                                        className="w-20 bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs text-right"
                                                    />
                                                ) : (
                                                    <span className="text-emerald-400 font-bold">${sale.monto}</span>
                                                )}
                                            </td>
                                            
                                            <td className="p-4 space-y-1">
                                                {isEditing ? (
                                                    <>
                                                        <input 
                                                            type="text" 
                                                            value={editData.product} 
                                                            onChange={e => setEditData({...editData, product: e.target.value})}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs mb-1"
                                                            placeholder="Producto"
                                                        />
                                                        <input 
                                                            type="text" 
                                                            value={editData.payment_type} 
                                                            onChange={e => setEditData({...editData, payment_type: e.target.value})}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                                            placeholder="Tipo Pago"
                                                        />
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="font-medium text-slate-200">{sale.tipo_pago || 'N/A'}</div>
                                                        <div className="text-xs text-slate-500">{sale.metodo_pago || 'N/A'}</div>
                                                    </>
                                                )}
                                            </td>
                                            
                                            <td className="p-4 space-y-1">
                                                {isEditing ? (
                                                    <>
                                                        <input 
                                                            type="text" 
                                                            value={editData.email_vendedor} 
                                                            onChange={e => setEditData({...editData, email_vendedor: e.target.value})}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs mb-1"
                                                            placeholder="Closer (Email)"
                                                        />
                                                        <input 
                                                            type="text" 
                                                            value={editData.setter_name} 
                                                            onChange={e => setEditData({...editData, setter_name: e.target.value})}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                                            placeholder="Setter"
                                                        />
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="text-xs text-slate-300">C: {sale.email_vendedor?.split('@')[0] || 'N/A'}</div>
                                                        <div className="text-xs text-slate-400">S: {sale.setter || 'N/A'}</div>
                                                    </>
                                                )}
                                            </td>
                                            
                                            <td className="p-4 whitespace-nowrap">
                                                {isEditing ? (
                                                    <select 
                                                        value={editData.estado} 
                                                        onChange={e => setEditData({...editData, estado: e.target.value})}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                                    >
                                                        <option value="Completada">Completada</option>
                                                        <option value="Pendiente">Pendiente</option>
                                                        <option value="Reembolsada">Reembolsada</option>
                                                        <option value="Cancelada">Cancelada</option>
                                                    </select>
                                                ) : (
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                        sale.estado === 'Completada' || !sale.estado ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                        sale.estado === 'Pendiente' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                        'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    }`}>
                                                        {sale.estado || 'Completada'}
                                                    </span>
                                                )}
                                            </td>
                                            
                                            <td className="p-4 text-center">
                                                {isEditing ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => handleSave(sale.id)} className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors">
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setEditingSale(null)} className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => handleEditClick(sale)} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                
                                {sales.length === 0 && (
                                     <tr>
                                         <td colSpan="8" className="p-8 text-center text-slate-500">
                                             No se encontraron ventas con esos criterios.
                                         </td>
                                     </tr>
                                 )}
                            </tbody>
                        </table>
                        
                        {hasMore && (
                            <div ref={loaderRef} className="flex justify-center p-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                            </div>
                        )}
                        {!hasMore && sales.length > 0 && (
                            <div className="text-center p-4 text-xs text-slate-500 font-bold uppercase tracking-widest">
                                Todas las ventas cargadas
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default PublicFinancialSalesPage;

