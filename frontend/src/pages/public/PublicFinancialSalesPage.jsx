import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { RefreshCcw, Search, Edit2, Check, X, Calendar, DollarSign, Users, Percent, TrendingUp, AlertCircle, Plus, Trash2 } from 'lucide-react';
import Card from '../../components/ui/Card';
import usePersistentFilters from '../../hooks/usePersistentFilters';
import AttributionModal from '../../components/modals/AttributionModal';

const getFirstDayOfCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
};

const getTodayDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

const formatSaleDate = (dateStr) => {
    if (!dateStr) return 'Sin Fecha';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        return dateStr;
    }
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
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
    const [uniquePrograms, setUniquePrograms] = useState([]);
    const [uniquePaymentTypes, setUniquePaymentTypes] = useState([]);
    const [paymentMethodsBreakdown, setPaymentMethodsBreakdown] = useState([]);
    const [uniquePaymentMethods, setUniquePaymentMethods] = useState([]);
    
    const { filters, updateFilter: setFilters } = usePersistentFilters('filters_financial_sales', {
        searchTerm: '',
        startDate: getFirstDayOfCurrentMonth(),
        endDate: getTodayDate(),
        programa: '',
        tipoPagoSimple: '',
        metodoPago: '',
        sinAtribucion: false
    });

    const { searchTerm, startDate, endDate, programa, tipoPagoSimple, metodoPago, sinAtribucion } = filters;
    const setSearchTerm = (val) => setFilters({ searchTerm: val });
    const setStartDate = (val) => setFilters({ startDate: val });
    const setEndDate = (val) => setFilters({ endDate: val });
    const setPrograma = (val) => setFilters({ programa: val });
    const setTipoPagoSimple = (val) => setFilters({ tipoPagoSimple: val });
    const setMetodoPago = (val) => setFilters({ metodoPago: val });
    const setSinAtribucion = (val) => setFilters({ sinAtribucion: val });

    // Forzar inicio en el mes actual si los filtros cargados de localStorage están vacíos
    useEffect(() => {
        if (!startDate || !endDate) {
            setFilters({
                startDate: startDate || getFirstDayOfCurrentMonth(),
                endDate: endDate || getTodayDate(),
                programa: programa || '',
                tipoPagoSimple: tipoPagoSimple || '',
                metodoPago: metodoPago || '',
                sinAtribucion: sinAtribucion || false
            });
        }
    }, [startDate, endDate]);

    // Estado del modal de edición
    const [editingSale, setEditingSale] = useState(null);
    const [editData, setEditData] = useState({});
    const [attributionSale, setAttributionSale] = useState(null);
    
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
                    programa: programa,
                    tipo_pago_simple: tipoPagoSimple,
                    metodo_pago: metodoPago,
                    sin_atribucion: sinAtribucion
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
            setPaymentMethodsBreakdown(res.data.payment_methods_breakdown || []);
            setUniquePrograms(res.data.unique_programs || []);
            setUniquePaymentTypes(res.data.unique_payment_types || []);
            setUniquePaymentMethods(res.data.unique_payment_methods || []);
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
    }, [searchTerm, startDate, endDate, programa, tipoPagoSimple, metodoPago, sinAtribucion]);

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
            amount: sale.monto_bruto || sale.monto || 0,
            programa: sale.programa || '',
            tipo_pago_simple: sale.tipo_pago_simple || '',
            payment_type: sale.metodo_pago || '',
            setter_name: sale.setter || '',
            estado: sale.estado || 'Completada',
            date: sale.date && typeof sale.date === 'string' ? sale.date.split('T')[0] : ''
        });
    };

    const handleSave = async (id) => {
        try {
            const combinedProduct = editData.programa && editData.tipo_pago_simple
                ? `${editData.programa.trim()} - ${editData.tipo_pago_simple.trim()}`
                : (editData.programa || editData.tipo_pago_simple || '').trim();

            const payload = {
                instagram: editData.instagram,
                nombre_cliente: editData.nombre_cliente,
                email_vendedor: editData.email_vendedor,
                amount: editData.amount,
                product: combinedProduct,
                payment_type: editData.payment_type,
                setter_name: editData.setter_name,
                estado: editData.estado,
                date: editData.date
            };

            const res = await api.put(`/public/financial-sales/${id}`, payload);
            toast.success('Venta actualizada correctamente');
            
            setSales(sales.map(s => s.id === id ? { ...s, ...res.data.sale } : s));
            setEditingSale(null);
        } catch (error) {
            toast.error('Error al actualizar venta');
            console.error(error);
        }
    };

    const handleDelete = async (sale) => {
        const confirmDelete = window.confirm(
            `¿Deseas eliminar la venta de "${sale.nombre_cliente}" por $${sale.monto}? Se ocultará localmente pero seguirá en Google Sheets.`
        );
        if (!confirmDelete) return;

        try {
            await api.delete(`/public/financial-sales/${sale.id}`);
            toast.success('Venta eliminada localmente');
            fetchSales(1);
        } catch (error) {
            toast.error('Error al eliminar la venta');
            console.error(error);
        }
    };

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createData, setCreateData] = useState({
        nombre_cliente: '',
        instagram: '',
        mail_cliente: '',
        telefono: '',
        programa: 'RR',
        tipo_pago_simple: 'completo',
        monto: '',
        metodo_pago: 'Stripe',
        estado: 'Completada',
        email_vendedor: '',
        setter_name: '',
        examen: '',
        segundo_pago: '',
        notas: '',
        date: new Date().toISOString().split('T')[0]
    });

    const [agendaSearchQuery, setAgendaSearchQuery] = useState('');
    const [agendaSearchResults, setAgendaSearchResults] = useState([]);
    const [searchingAgendas, setSearchingAgendas] = useState(false);
    const [selectedAgenda, setSelectedAgenda] = useState(null);

    const handleAgendaSearch = async (query) => {
        setAgendaSearchQuery(query);
        if (query.trim().length < 2) {
            setAgendaSearchResults([]);
            return;
        }
        setSearchingAgendas(true);
        try {
            const res = await api.get('/public/financial-agendas', {
                params: { search: query, limit: 10, page: 1 }
            });
            const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setAgendaSearchResults(data);
        } catch (error) {
            console.error("Error al buscar agendas", error);
        } finally {
            setSearchingAgendas(false);
        }
    };

    const handleSelectAgenda = (agenda) => {
        setSelectedAgenda(agenda);
        setCreateData(prev => ({
            ...prev,
            nombre_cliente: agenda.lead || '',
            instagram: agenda.instagram && agenda.instagram !== 'N/A' ? agenda.instagram : '',
            mail_cliente: agenda.mail && agenda.mail !== 'N/A' ? agenda.mail : '',
            telefono: agenda.whatsapp && agenda.whatsapp !== 'N/A' ? agenda.whatsapp : '',
            setter_name: agenda.nombre || '',
            email_vendedor: agenda.closer && agenda.closer !== 'Sin asignar' ? agenda.closer : prev.email_vendedor,
            date: agenda.date ? agenda.date.split('T')[0] : prev.date
        }));
        setAgendaSearchResults([]);
        setAgendaSearchQuery('');
    };

    const handleClearSelectedAgenda = () => {
        setSelectedAgenda(null);
        setCreateData(prev => ({
            ...prev,
            nombre_cliente: '',
            instagram: '',
            mail_cliente: '',
            telefono: '',
            setter_name: '',
            date: new Date().toISOString().split('T')[0]
        }));
    };

    const handleCloseCreateModal = () => {
        setShowCreateModal(false);
        setAgendaSearchQuery('');
        setAgendaSearchResults([]);
        setSelectedAgenda(null);
        setCreateData({
            nombre_cliente: '',
            instagram: '',
            mail_cliente: '',
            telefono: '',
            programa: 'RR',
            tipo_pago_simple: 'completo',
            monto: '',
            metodo_pago: 'Stripe',
            estado: 'Completada',
            email_vendedor: '',
            setter_name: '',
            examen: '',
            segundo_pago: '',
            notas: '',
            date: new Date().toISOString().split('T')[0]
        });
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!createData.nombre_cliente || !createData.monto) {
            toast.error('Nombre y monto son obligatorios');
            return;
        }

        try {
            const combinedProduct = createData.programa && createData.tipo_pago_simple
                ? `${createData.programa.trim()} - ${createData.tipo_pago_simple.trim()}`
                : (createData.programa || createData.tipo_pago_simple || '').trim();

            const combinedExamen = createData.examen + (createData.notas ? ` | ${createData.notas}` : '');

            const selectedDate = new Date(createData.date);
            const now = new Date();
            selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
            const marcaTemporalStr = selectedDate.toLocaleString("es-ES");

            const payload = {
                nombre_cliente: createData.nombre_cliente,
                instagram: createData.instagram.replace(/@/g, '').trim(),
                mail_cliente: createData.mail_cliente,
                telefono: createData.telefono,
                tipo_pago: combinedProduct,
                monto: parseFloat(createData.monto) || 0.0,
                metodo_pago: createData.metodo_pago,
                estado: createData.estado,
                email_vendedor: createData.email_vendedor,
                setter: createData.setter_name,
                examen: combinedExamen,
                segundo_pago: createData.segundo_pago,
                marca_temporal: marcaTemporalStr
            };

            const res = await api.post('/public/financial-sales/new', payload);
            if (res.data.status === 'success') {
                toast.success('Venta registrada con éxito');
                handleCloseCreateModal();
                fetchSales(1);
            } else {
                toast.error(res.data.error || 'Error al registrar venta');
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Error de comunicación al registrar venta');
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
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Programa:</span>
                        <select
                            value={programa}
                            onChange={(e) => setPrograma(e.target.value)}
                            className="bg-transparent border-none text-xs text-slate-200 focus:outline-none focus:ring-0 cursor-pointer max-w-[130px] pr-8 focus:ring-0"
                        >
                            <option value="" className="bg-slate-900 text-white">Todos</option>
                            {uniquePrograms
                                .sort((a, b) => a.localeCompare(b))
                                .map((p) => (
                                    <option key={p} value={p} className="bg-slate-900 text-white">
                                        {p}
                                    </option>
                                ))
                            }
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pago:</span>
                        <select
                            value={tipoPagoSimple}
                            onChange={(e) => setTipoPagoSimple(e.target.value)}
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

                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Método:</span>
                        <select
                            value={metodoPago}
                            onChange={(e) => setMetodoPago(e.target.value)}
                            className="bg-transparent border-none text-xs text-slate-200 focus:outline-none focus:ring-0 cursor-pointer max-w-[130px] pr-8 focus:ring-0"
                        >
                            <option value="" className="bg-slate-900 text-white">Todos</option>
                            {uniquePaymentMethods
                                .sort((a, b) => a.localeCompare(b))
                                .map((method) => (
                                    <option key={method} value={method} className="bg-slate-900 text-white">
                                        {method}
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
                        onClick={() => setSinAtribucion(!sinAtribucion)}
                        className={`flex items-center justify-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all shadow-lg ${
                            sinAtribucion 
                            ? 'bg-rose-600 border-rose-500 hover:bg-rose-700 text-white font-black' 
                            : 'bg-slate-850 border-slate-700 hover:bg-slate-800 text-slate-300'
                        }`}
                    >
                        <Users className="w-4 h-4" />
                        <span>{sinAtribucion ? 'Ver Todas' : 'Atribuir (Sin Agenda)'}</span>
                    </button>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Registrar Venta</span>
                    </button>
                </div>
            </div>

            {/* KPIs Panels */}
            {agendaBreakdown && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* KPI 1: Atribución por Agendas Simplificado */}
                    <Card variant="surface" className="p-6 rounded-[2rem] border-slate-800 space-y-5 relative overflow-hidden bg-slate-900/40 backdrop-blur-md">
                        <div className="space-y-1">
                            <h2 className="text-lg font-black text-white italic tracking-tight uppercase flex items-center gap-2">
                                <Users className="text-indigo-400" size={18} />
                                Atribución por Agendas
                            </h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">
                                Resumen de Atribución del Período
                            </p>
                        </div>

                        {(() => {
                            const conCount = agendaBreakdown.con_agenda.count || 0;
                            const conMonto = agendaBreakdown.con_agenda.total_monto || 0;
                            const totalAgendas = agendaBreakdown.con_agenda.total_agendas || 0;
                            const ticketCon = conCount > 0 ? conMonto / conCount : 0;
                            const promCita = totalAgendas > 0 ? conMonto / totalAgendas : 0;
                            const sinCount = agendaBreakdown.sin_agenda.count || 0;

                            return (
                                <div className="space-y-4">
                                    {/* Promedio por Agenda */}
                                    <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl hover:border-slate-700 transition-all">
                                        <div className="space-y-0.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                                                Promedio por Agenda
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">
                                                {conCount} {conCount === 1 ? 'venta' : 'ventas'} con agenda
                                            </span>
                                        </div>
                                        <span className="text-xl font-black text-violet-400 italic">
                                            ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(ticketCon)} USD
                                        </span>
                                    </div>

                                    {/* Promedio por Llamada (Show Up) */}
                                    <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl hover:border-slate-700 transition-all">
                                        <div className="space-y-0.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                                                Promedio por Llamada (Show Up)
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">
                                                {totalAgendas} {totalAgendas === 1 ? 'llamada' : 'llamadas'}
                                            </span>
                                        </div>
                                        <span className="text-xl font-black text-emerald-400 italic">
                                            ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(promCita)} USD
                                        </span>
                                    </div>

                                    {/* Ventas sin Agenda */}
                                    <div className="flex items-center justify-between p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl hover:border-slate-700 transition-all">
                                        <div className="space-y-0.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                                                Ventas sin Agenda
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-bold uppercase">
                                                Requieren atribución
                                            </span>
                                        </div>
                                        <span className="text-xl font-black text-rose-400 italic">
                                            {sinCount}
                                        </span>
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

                        <div className="grid grid-cols-2 gap-2">
                            {paymentTypesBreakdown
                                .sort((a, b) => b.total_monto - a.total_monto)
                                .map((pt) => {
                                    const pct = totalSalesAmount > 0 ? (pt.total_monto / totalSalesAmount) * 100 : 0;
                                    
                                    let payColor = "text-sky-400 bg-sky-500/10 border-sky-500/20";
                                    const norm = (pt.tipo_pago || '').toLowerCase();
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
                                        <div key={pt.tipo_pago} className="flex flex-col justify-between bg-slate-950/40 border border-slate-900/80 p-2.5 rounded-xl hover:border-slate-800 transition-all space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${payColor}`}>
                                                    {pt.tipo_pago}
                                                </span>
                                                <span className="text-[9px] text-slate-500 font-bold uppercase">
                                                    {pt.count} {pt.count === 1 ? 'Vta' : 'Vtas'}
                                                </span>
                                            </div>
                                            <div className="flex items-baseline justify-between pt-1">
                                                <span className="text-[9px] text-slate-500 font-black tracking-tighter">
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

                    {/* KPI 3: Cash Collect por Método de Pago */}
                    <Card variant="surface" className="p-6 rounded-[2rem] border-slate-800 space-y-4 relative overflow-hidden bg-slate-900/40 backdrop-blur-md">
                        <div className="space-y-1">
                            <h2 className="text-lg font-black text-white italic tracking-tight uppercase flex items-center gap-2">
                                <DollarSign className="text-sky-400" size={18} />
                                Cash Collect por Método de Pago
                            </h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">
                                Métodos de Recaudación Activos
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {paymentMethodsBreakdown
                                .sort((a, b) => b.total_monto - a.total_monto)
                                .map((pm) => {
                                    const pct = totalSalesAmount > 0 ? (pm.total_monto / totalSalesAmount) * 100 : 0;
                                    
                                    let payColor = "text-sky-400 bg-sky-500/10 border-sky-500/20";
                                    const norm = (pm.metodo_pago || '').toLowerCase();
                                    if (norm.includes("stripe")) {
                                        payColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                                    } else if (norm.includes("wise")) {
                                        payColor = "text-sky-400 bg-sky-500/10 border-sky-500/20";
                                    } else if (norm.includes("paypal")) {
                                        payColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
                                    } else if (norm.includes("transferencia") || norm.includes("banco")) {
                                        payColor = "text-violet-400 bg-violet-500/10 border-violet-500/20";
                                    } else if (norm.includes("hotmart")) {
                                        payColor = "text-rose-400 bg-rose-500/10 border-rose-500/20";
                                    }

                                    return (
                                        <div key={pm.metodo_pago} className="flex flex-col justify-between bg-slate-950/40 border border-slate-900/80 p-2.5 rounded-xl hover:border-slate-800 transition-all space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${payColor}`}>
                                                    {pm.metodo_pago}
                                                </span>
                                                <span className="text-[9px] text-slate-500 font-bold uppercase">
                                                    {pm.count} {pm.count === 1 ? 'Vta' : 'Vtas'}
                                                </span>
                                            </div>
                                            <div className="flex items-baseline justify-between pt-1">
                                                <span className="text-[9px] text-slate-500 font-black tracking-tighter">
                                                    {pct.toFixed(0)}%
                                                </span>
                                                <span className="text-sm font-black text-white italic">
                                                    ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(pm.total_monto)}
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
                                    <th className="p-4 font-semibold">Programa</th>
                                    <th className="p-4 font-semibold">Pago</th>
                                    <th className="p-4 font-semibold">Roles</th>
                                    <th className="p-4 font-semibold text-center">Atribución</th>
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
                                                {isEditing ? (
                                                    <input 
                                                        type="date" 
                                                        value={editData.date} 
                                                        onChange={e => setEditData({...editData, date: e.target.value})}
                                                        className="bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs cursor-pointer focus:border-indigo-500 focus:outline-none"
                                                    />
                                                ) : (
                                                    formatSaleDate(sale.date)
                                                )}
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
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span className="text-emerald-400 font-bold">${sale.monto} <span className="text-[9px] text-slate-500 font-normal uppercase tracking-wider">neto</span></span>
                                                        {sale.metodo_pago && sale.metodo_pago.toLowerCase().trim() === 'stripe' && sale.monto_bruto && sale.monto_bruto !== sale.monto && (
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                Bruto: ${sale.monto_bruto}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            
                                            <td className="p-4 whitespace-nowrap">
                                                {isEditing ? (
                                                    <input 
                                                        type="text" 
                                                        value={editData.programa} 
                                                        onChange={e => setEditData({...editData, programa: e.target.value})}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                                        placeholder="Prog (ej: RR)"
                                                    />
                                                ) : (
                                                    <span className="font-medium text-slate-200">{sale.programa || 'N/A'}</span>
                                                )}
                                            </td>
                                            
                                            <td className="p-4 space-y-1">
                                                {isEditing ? (
                                                    <>
                                                        <input 
                                                            type="text" 
                                                            value={editData.tipo_pago_simple} 
                                                            onChange={e => setEditData({...editData, tipo_pago_simple: e.target.value})}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs mb-1"
                                                            placeholder="Pago (ej: completo)"
                                                        />
                                                        <input 
                                                            type="text" 
                                                            value={editData.payment_type} 
                                                            onChange={e => setEditData({...editData, payment_type: e.target.value})}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                                            placeholder="Método (ej: Stripe)"
                                                        />
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="font-medium text-slate-300">{sale.tipo_pago_simple || 'N/A'}</div>
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

                                            <td className="p-4 text-center whitespace-nowrap">
                                                {sale.has_agenda ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                                        <Check size={10} className="text-indigo-405" /> Con Agenda
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                            <AlertCircle size={10} className="text-rose-405" /> Sin Agenda
                                                        </span>
                                                        <button
                                                            onClick={() => setAttributionSale(sale)}
                                                            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-black uppercase tracking-wider transition-all"
                                                        >
                                                            Atribuir
                                                        </button>
                                                    </div>
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
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => handleEditClick(sale)} className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => handleDelete(sale)} className="p-1.5 text-rose-450 hover:text-white bg-rose-950/40 border border-rose-900/30 hover:bg-rose-900 rounded-lg transition-colors" title="Eliminar Venta (Ocultar localmente)">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                
                                {sales.length === 0 && (
                                     <tr>
                                         <td colSpan="10" className="p-8 text-center text-slate-500">
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

            {attributionSale && (
                <AttributionModal 
                    sale={attributionSale}
                    onClose={() => setAttributionSale(null)}
                    onSuccess={() => fetchSales(1)}
                />
            )}

            {showCreateModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-white italic tracking-tight uppercase">Registrar Nueva Venta</h2>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Ingresa los datos para registrar la venta en la app y Google Sheets</p>
                            </div>
                            <button onClick={handleCloseCreateModal} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-left">
                            {/* Buscador de Agenda del Cliente */}
                            <div className="relative space-y-2 p-4 bg-slate-950/40 border border-slate-800 rounded-2xl">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">
                                    Buscar Agenda del Cliente para Autocompletar
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={agendaSearchQuery}
                                        onChange={(e) => handleAgendaSearch(e.target.value)}
                                        placeholder="Buscar por nombre, email, instagram o teléfono..."
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-indigo-500 outline-none transition-all font-semibold"
                                    />
                                    {searchingAgendas && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent"></div>
                                        </div>
                                    )}
                                </div>

                                {/* Resultados de la Búsqueda */}
                                {agendaSearchResults.length > 0 && (
                                    <div className="absolute left-0 right-0 z-50 top-full mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
                                        {agendaSearchResults.map((agenda) => (
                                            <button
                                                key={agenda.id}
                                                type="button"
                                                onClick={() => handleSelectAgenda(agenda)}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-800/65 border-b border-slate-850/50 transition-colors flex flex-col gap-0.5"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-white text-sm">{agenda.lead}</span>
                                                    <span className="text-[10px] text-slate-405 font-bold uppercase">
                                                        {agenda.date ? new Date(agenda.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'S/F'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs text-slate-400">
                                                    <span>IG: @{agenda.instagram || 'N/A'}</span>
                                                    <span>Setter: {agenda.nombre || 'N/A'}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Mensaje de Sin Resultados */}
                                {agendaSearchQuery.trim().length >= 2 && !searchingAgendas && agendaSearchResults.length === 0 && (
                                    <div className="text-xs text-slate-500 italic mt-1 pl-1">
                                        No se encontraron agendas coincidentes.
                                    </div>
                                )}

                                {/* Indicador de Agenda Seleccionada */}
                                {selectedAgenda && (
                                    <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-2 rounded-xl mt-2 animate-in fade-in duration-200">
                                        <div className="space-y-0.5">
                                            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block">
                                                Agenda Vinculada
                                            </span>
                                            <span className="text-xs font-semibold text-slate-200">
                                                {selectedAgenda.lead} • @{selectedAgenda.instagram || 'N/A'}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleClearSelectedAgenda}
                                            className="p-1 text-slate-405 hover:text-white bg-slate-850/50 hover:bg-slate-800 rounded-lg transition-all"
                                            title="Desvincular Agenda"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Nombre del Cliente *</label>
                                    <input
                                        type="text"
                                        required
                                        value={createData.nombre_cliente}
                                        onChange={e => setCreateData({...createData, nombre_cliente: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-indigo-500 outline-none transition-all font-semibold"
                                        placeholder="ej. Juan Pérez"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Instagram (@ usuario)</label>
                                    <input
                                        type="text"
                                        value={createData.instagram}
                                        onChange={e => setCreateData({...createData, instagram: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-indigo-500 outline-none transition-all font-semibold"
                                        placeholder="ej. juan_perez"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Email del Cliente</label>
                                    <input
                                        type="email"
                                        value={createData.mail_cliente}
                                        onChange={e => setCreateData({...createData, mail_cliente: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-855 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-indigo-500 outline-none transition-all font-semibold"
                                        placeholder="ej. juan@gmail.com"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Teléfono del Cliente</label>
                                    <input
                                        type="text"
                                        value={createData.telefono}
                                        onChange={e => setCreateData({...createData, telefono: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-indigo-500 outline-none transition-all font-semibold"
                                        placeholder="ej. +34 600 000 000"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Programa *</label>
                                    <select
                                        value={createData.programa}
                                        onChange={e => setCreateData({...createData, programa: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                    >
                                        <option value="RR">Residency Roadmap (RR)</option>
                                        <option value="AL">Ace Learner (AL)</option>
                                        <option value="SI">Specialist Initiative (SI)</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Tipo de Pago *</label>
                                    <select
                                        value={createData.tipo_pago_simple}
                                        onChange={e => setCreateData({...createData, tipo_pago_simple: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                    >
                                        <option value="completo">Completo (PIF)</option>
                                        <option value="parcial">Parcial (Primer Pago)</option>
                                        <option value="Seña">Seña (Reserva)</option>
                                        <option value="Cuota">Cuota</option>
                                        <option value="Renovacion">Renovación</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Monto Cobrado (USD) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={createData.monto}
                                        onChange={e => setCreateData({...createData, monto: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-655 focus:border-indigo-500 outline-none transition-all font-semibold"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Método de Pago *</label>
                                    <select
                                        value={createData.metodo_pago}
                                        onChange={e => setCreateData({...createData, metodo_pago: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                    >
                                        <option value="Stripe">Stripe</option>
                                        <option value="PayPal">PayPal</option>
                                        <option value="Wise">Wise</option>
                                        <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                                        <option value="Binance / USDT">Binance / USDT</option>
                                        <option value="Hotmart">Hotmart</option>
                                        <option value="Otro">Otro Método</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Estado *</label>
                                    <select
                                        value={createData.estado}
                                        onChange={e => setCreateData({...createData, estado: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                    >
                                        <option value="Completada">Completada</option>
                                        <option value="Pendiente">Pendiente</option>
                                        <option value="Reembolsada">Reembolsada</option>
                                        <option value="Cancelada">Cancelada</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Fecha de la Venta *</label>
                                    <input
                                        type="date"
                                        required
                                        value={createData.date}
                                        onChange={e => setCreateData({...createData, date: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 outline-none transition-all font-semibold cursor-pointer"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Closer (Email del Vendedor)</label>
                                    <input
                                        type="email"
                                        value={createData.email_vendedor}
                                        onChange={e => setCreateData({...createData, email_vendedor: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-indigo-500 outline-none transition-all font-semibold"
                                        placeholder="ej. closer@neurops.com"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Setter (Nombre del Setter)</label>
                                    <input
                                        type="text"
                                        value={createData.setter_name}
                                        onChange={e => setCreateData({...createData, setter_name: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-indigo-500 outline-none transition-all font-semibold"
                                        placeholder="ej. elias"
                                    />
                                </div>

                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Examen (ej. USMLE Step 1)</label>
                                    <input
                                        type="text"
                                        value={createData.examen}
                                        onChange={e => setCreateData({...createData, examen: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-indigo-500 outline-none transition-all font-semibold"
                                        placeholder="ej. USMLE Step 1"
                                    />
                                </div>

                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Fecha o Info Siguientes Pagos (segundo_pago)</label>
                                    <input
                                        type="text"
                                        value={createData.segundo_pago}
                                        onChange={e => setCreateData({...createData, segundo_pago: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-indigo-500 outline-none transition-all font-semibold"
                                        placeholder="ej. Cobro de $500 programado para el 15/06"
                                    />
                                </div>

                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Notas / Observaciones</label>
                                    <textarea
                                        value={createData.notas}
                                        onChange={e => setCreateData({...createData, notas: e.target.value})}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-indigo-500 outline-none transition-all font-semibold min-h-[80px] resize-none"
                                        placeholder="Observaciones de la venta..."
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-805">
                                <button type="button" onClick={handleCloseCreateModal} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-all">
                                    Cancelar
                                </button>
                                <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20">
                                    Registrar Venta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PublicFinancialSalesPage;

