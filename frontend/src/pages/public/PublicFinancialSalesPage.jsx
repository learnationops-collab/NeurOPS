import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { RefreshCcw, Search, Edit2, Check, X, Calendar, DollarSign, Users, Percent, TrendingUp, AlertCircle, Plus, Trash2, BookOpen, CreditCard, Wallet, UserCheck, Compass, ChevronDown, Filter, Send, Download } from 'lucide-react';
import Card from '../../components/ui/Card';
import usePersistentFilters from '../../hooks/usePersistentFilters';
import AttributionModal from '../../components/modals/AttributionModal';
import LeadRoadmapModal from '../../components/modals/LeadRoadmapModal';
import { useNavigate } from 'react-router-dom';


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

const getCloserColors = (name) => {
    const norm = name ? name.toLowerCase() : '';
    if (norm.includes('marlon')) return { gradient: 'from-blue-500 to-sky-600', dot: 'bg-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10' };
    if (norm.includes('jean carlo') || norm.includes('jeancarlo')) return { gradient: 'from-amber-400 to-yellow-500', dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10' };
    if (norm.includes('guillermo')) return { gradient: 'from-emerald-400 to-teal-500', dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (norm.includes('tomas')) return { gradient: 'from-rose-500 to-fuchsia-600', dot: 'bg-rose-500', text: 'text-rose-400', bg: 'bg-rose-500/10' };
    if (norm.includes('mario')) return { gradient: 'from-violet-500 to-purple-600', dot: 'bg-violet-500', text: 'text-violet-400', bg: 'bg-violet-500/10' };
    if (norm.includes('mercari')) return { gradient: 'from-pink-400 to-rose-400', dot: 'bg-pink-400', text: 'text-pink-400', bg: 'bg-pink-500/10' };
    if (norm.includes('iñaki') || norm.includes('inaki')) return { gradient: 'from-cyan-400 to-blue-500', dot: 'bg-cyan-400', text: 'text-cyan-400', bg: 'bg-cyan-500/10' };
    if (norm.includes('rafael')) return { gradient: 'from-orange-400 to-red-500', dot: 'bg-orange-400', text: 'text-orange-400', bg: 'bg-orange-500/10' };
    if (norm.includes('mateo')) return { gradient: 'from-indigo-400 to-purple-500', dot: 'bg-indigo-400', text: 'text-indigo-400', bg: 'bg-indigo-500/10' };
    if (norm.includes('belen') || norm.includes('belén')) return { gradient: 'from-teal-400 to-emerald-500', dot: 'bg-teal-400', text: 'text-teal-400', bg: 'bg-teal-500/10' };
    if (norm.includes('valery')) return { gradient: 'from-fuchsia-400 to-pink-500', dot: 'bg-fuchsia-400', text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' };
    if (norm.includes('gabriel')) return { gradient: 'from-lime-400 to-green-500', dot: 'bg-lime-400', text: 'text-lime-400', bg: 'bg-lime-500/10' };
    return { gradient: 'from-slate-500 to-slate-600', dot: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-500/10' };
};

const normalizeKeyGlobal = (s) => {
    const ig = s.instagram ? s.instagram.trim().replace(/^@/, '').toLowerCase() : null;
    const email = s.mail_cliente ? s.mail_cliente.trim().toLowerCase() : null;
    return ig || email || `solo_${s.id}`;
};

const INDIVIDUAL_COLUMNS = [
    { id: 'dateVal', label: 'Fecha de pago', getValue: (s) => s.date ? s.date.split('T')[0] : (s.created_at ? s.created_at.split('T')[0] : '') },
    { id: 'entryDate', label: 'Fecha de ingreso', getValue: (s, entryDatesMap) => entryDatesMap[normalizeKeyGlobal(s)] || '' },
    { id: 'nombre_cliente', label: 'Cliente', getValue: (s) => s.nombre_cliente || '' },
    { id: 'mail_cliente', label: 'Email', getValue: (s) => s.mail_cliente || '' },
    { id: 'telefono', label: 'Teléfono', getValue: (s) => s.telefono || '' },
    { id: 'instagram', label: 'Instagram', getValue: (s) => s.instagram || '' },
    { id: 'monto_bruto', label: 'Monto bruto', getValue: (s) => s.monto_bruto !== undefined ? s.monto_bruto : (s.monto || 0) },
    { id: 'monto', label: 'Monto neto (ajustado)', getValue: (s) => s.monto || 0 },
    { id: 'metodo_pago', label: 'Método de pago', getValue: (s) => s.metodo_pago || '' },
    { id: 'tipo_pago_simple', label: 'Tipo de pago', getValue: (s) => s.tipo_pago_simple || '' },
    { id: 'programa', label: 'Programa', getValue: (s) => s.programa || '' },
    { id: 'closer_name', label: 'Closer', getValue: (s) => s.closer_name || '' },
    { id: 'setter', label: 'Setter', getValue: (s) => s.setter || '' },
    { id: 'estado', label: 'Estado', getValue: (s) => s.estado || '' },
    { id: 'segundo_pago', label: 'Segundo pago', getValue: (s) => s.segundo_pago || '' },
    { id: 'examen', label: 'Examen', getValue: (s) => s.examen || '' }
];

const GROUPED_COLUMNS = [
    { id: 'entryDate', label: 'Fecha de ingreso', getValue: (group, ref, entryDatesMap) => entryDatesMap[normalizeKeyGlobal(ref)] || '' },
    { id: 'lead', label: 'Lead', getValue: (group, ref) => ref.nombre_cliente || '' },
    { id: 'email', label: 'Email', getValue: (group, ref) => ref.mail_cliente || '' },
    { id: 'telefono', label: 'Teléfono', getValue: (group, ref) => ref.telefono || '' },
    { id: 'instagram', label: 'Instagram', getValue: (group, ref) => ref.instagram || '' },
    { id: 'tipos', label: 'Tipos de pago', getValue: (group) => [...new Set(group.map(s => s.tipo_pago_simple || '').filter(Boolean))].join(' | ') },
    { id: 'metodos', label: 'Métodos de pago', getValue: (group) => [...new Set(group.map(s => s.metodo_pago || '').filter(Boolean))].join(' | ') },
    { id: 'totalBruto', label: 'Total bruto', getValue: (group) => Math.round(group.reduce((sum, s) => sum + parseFloat(s.monto_bruto || s.monto || 0), 0) * 100) / 100 },
    { id: 'totalNeto', label: 'Total neto (ajustado)', getValue: (group) => Math.round(group.reduce((sum, s) => sum + parseFloat(s.monto || 0), 0) * 100) / 100 },
    { id: 'cantidadPagos', label: 'Cantidad de pagos', getValue: (group) => group.length },
    { id: 'closer', label: 'Closer', getValue: (group) => [...new Set(group.map(s => s.closer_name || '').filter(Boolean))].join(' | ') },
    { id: 'setter', label: 'Setter', getValue: (group) => [...new Set(group.map(s => s.setter || '').filter(Boolean))].join(' | ') },
    { id: 'programas', label: 'Programas', getValue: (group) => [...new Set(group.map(s => s.programa || '').filter(Boolean))].join(' | ') }
];

const MultiSelectFilter = ({ label, options, selectedValues, onChange, icon: Icon, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedList = selectedValues ? selectedValues.split(',').filter(Boolean) : [];

    const handleToggle = (val) => {
        let newList;
        if (selectedList.includes(val)) {
            newList = selectedList.filter(v => v !== val);
        } else {
            newList = [...selectedList, val];
        }
        onChange(newList.join(','));
    };

    const handleSelectAll = () => {
        onChange('');
    };

    return (
        <div ref={containerRef} className="relative flex flex-col gap-1 w-full">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">{label}</span>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="relative w-full flex items-center justify-between bg-slate-950/80 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 text-xs text-slate-200 rounded-xl pl-8 pr-3 py-2 text-left transition-all focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 shrink-0"
            >
                {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-550 pointer-events-none" />}
                <span className="truncate pr-2">
                    {selectedList.length === 0 
                        ? placeholder 
                        : `${placeholder} (${selectedList.length})`}
                </span>
                <ChevronDown className={`w-3 h-3 text-slate-550 transition-transform ${isOpen ? 'rotate-180' : ''} shrink-0`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 z-[100] mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2.5 backdrop-blur-md space-y-1.5">
                    <div className="flex items-center justify-between px-1 pb-1.5 border-b border-slate-850">
                        <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider">Opciones</span>
                        {selectedList.length > 0 && (
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="text-[9px] text-rose-450 hover:text-rose-400 font-bold uppercase tracking-wider transition-colors"
                            >
                                Limpiar
                            </button>
                        )}
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                        {options.map((option) => {
                            const isSelected = selectedList.includes(option);
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => handleToggle(option)}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-all ${
                                        isSelected 
                                            ? 'bg-violet-650/20 text-violet-300' 
                                            : 'text-slate-450 hover:bg-slate-850/50 hover:text-slate-200'
                                    }`}
                                >
                                    <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border flex-shrink-0 transition-all ${isSelected ? 'bg-violet-500 border-violet-500' : 'border-slate-650'}`}>
                                        {isSelected && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                    </span>
                                    <span className="truncate">{option}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const PublicFinancialSalesPage = () => {
    const navigate = useNavigate();
    const [sales, setSales] = useState([]);
    const [selectedRoadmapLead, setSelectedRoadmapLead] = useState(null);

    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [showPaymentExportModal, setShowPaymentExportModal] = useState(false);
    const [paymentExportTypes, setPaymentExportTypes] = useState([]);
    const [paymentExportGroupByLead, setPaymentExportGroupByLead] = useState(false);
    const [selectedSaleIds, setSelectedSaleIds] = useState([]);
    const [exportingSelectedOnly, setExportingSelectedOnly] = useState(false);
    const [selectedIndividualCols, setSelectedIndividualCols] = useState(INDIVIDUAL_COLUMNS.map(c => c.id));
    const [selectedGroupedCols, setSelectedGroupedCols] = useState(GROUPED_COLUMNS.map(c => c.id));
    const [showBulkEditModal, setShowBulkEditModal] = useState(false);
    const [bulkEditField, setBulkEditField] = useState('');
    const [bulkEditValue, setBulkEditValue] = useState('');
    const [bulkEditValueCustom, setBulkEditValueCustom] = useState(false);
    const [bulkUpdating, setBulkUpdating] = useState(false);
    // Alcance de la edición masiva: las tildadas o todo el recorte filtrado
    const [bulkScope, setBulkScope] = useState('seleccion');
    const [bulkConfirm, setBulkConfirm] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Cantidad de ventas del recorte filtrado (la devuelve el backend). Se usa para
    // decir cuántas tocaría la edición masiva en modo "todo el filtro".
    const [totalSalesCount, setTotalSalesCount] = useState(0);
    const [totalSalesAmount, setTotalSalesAmount] = useState(0);
    const [totalSalesAmountBruto, setTotalSalesAmountBruto] = useState(0);
    const [sourcesBreakdown, setSourcesBreakdown] = useState([]);
    const [closersBreakdown, setClosersBreakdown] = useState([]);
    const [agendaBreakdown, setAgendaBreakdown] = useState(null);
    const [paymentTypesBreakdown, setPaymentTypesBreakdown] = useState([]);
    const [uniquePrograms, setUniquePrograms] = useState([]);
    const [uniquePaymentTypes, setUniquePaymentTypes] = useState([]);
    const [paymentMethodsBreakdown, setPaymentMethodsBreakdown] = useState([]);
    const [uniquePaymentMethods, setUniquePaymentMethods] = useState([]);
    const [uniqueClosers, setUniqueClosers] = useState([]);
    const [uniqueSetters, setUniqueSetters] = useState([]);
    
    const { filters, updateFilter: setFilters } = usePersistentFilters('filters_financial_sales', {
        searchTerm: '',
        startDate: getFirstDayOfCurrentMonth(),
        endDate: getTodayDate(),
        programa: '',
        tipoPagoSimple: '',
        metodoPago: '',
        closer: '',
        source: '',
        sinAtribucion: false
    });

    const { searchTerm, startDate, endDate, programa, tipoPagoSimple, metodoPago, closer, source, sinAtribucion } = filters;
    const setSearchTerm = (val) => setFilters({ searchTerm: val });
    const setStartDate = (val) => setFilters({ startDate: val });
    const setEndDate = (val) => setFilters({ endDate: val });
    const setPrograma = (val) => setFilters({ programa: val });
    const setTipoPagoSimple = (val) => setFilters({ tipoPagoSimple: val });
    const setMetodoPago = (val) => setFilters({ metodoPago: val });
    const setCloser = (val) => setFilters({ closer: val });
    const setSource = (val) => setFilters({ source: val });
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
    const startDateRef = useRef(null);
    const endDateRef = useRef(null);

    const applyDatePreset = (preset) => {
        const today = new Date();
        let start = '';
        let end = today.toISOString().split('T')[0];

        if (preset === 'today') {
            start = end;
        } else if (preset === 'this_month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        } else if (preset === 'last_month') {
            const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            start = firstOfLastMonth.toISOString().split('T')[0];
            end = lastOfLastMonth.toISOString().split('T')[0];
        } else if (preset === 'last_30_days') {
            const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            start = thirtyDaysAgo.toISOString().split('T')[0];
        }

        setFilters({ startDate: start, endDate: end });
    };

    const getActiveDatePreset = () => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        
        const lastMonthFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthLast = new Date(today.getFullYear(), today.getMonth(), 0);
        const lastMonthStartStr = lastMonthFirst.toISOString().split('T')[0];
        const lastMonthEndStr = lastMonthLast.toISOString().split('T')[0];
        
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        if (startDate === todayStr && endDate === todayStr) return 'today';
        if (startDate === thisMonthStart && endDate === todayStr) return 'this_month';
        if (startDate === lastMonthStartStr && endDate === lastMonthEndStr) return 'last_month';
        if (startDate === thirtyDaysAgo && endDate === todayStr) return 'last_30_days';
        return 'custom';
    };

    const getActiveFiltersCount = () => {
        let count = 0;
        if (searchTerm) count++;
        if (startDate !== getFirstDayOfCurrentMonth() || endDate !== getTodayDate()) count++;
        if (programa) count++;
        if (tipoPagoSimple) count++;
        if (metodoPago) count++;
        if (closer) count++;
        if (source) count++;
        if (sinAtribucion) count++;
        return count;
    };

    const handleClearFilters = () => {
        setFilters({
            searchTerm: '',
            startDate: getFirstDayOfCurrentMonth(),
            endDate: getTodayDate(),
            programa: '',
            tipoPagoSimple: '',
            metodoPago: '',
            closer: '',
            source: '',
            sinAtribucion: false
        });
    };

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
                    closer: closer,
                    source: source,
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
            setTotalSalesCount(res.data.total || 0);
            setTotalSalesAmount(res.data.total_monto || 0);
            setTotalSalesAmountBruto(res.data.total_monto_bruto || 0);
            setSourcesBreakdown(res.data.sources_breakdown || []);
            setClosersBreakdown(res.data.closers_breakdown || []);
            setAgendaBreakdown(res.data.agenda_breakdown || null);
            setPaymentTypesBreakdown(res.data.payment_types_breakdown || []);
            setPaymentMethodsBreakdown(res.data.payment_methods_breakdown || []);
            setUniquePrograms(res.data.unique_programs || []);
            setUniquePaymentTypes(res.data.unique_payment_types || []);
            setUniquePaymentMethods(res.data.unique_payment_methods || []);
            setUniqueClosers(res.data.unique_closers || []);
            setUniqueSetters(res.data.unique_setters || []);
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
    }, [searchTerm, startDate, endDate, programa, tipoPagoSimple, metodoPago, closer, source, sinAtribucion]);

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

    const handleExportCSV = async () => {
        setExporting(true);
        const toastId = toast.loading('Generando CSV consolidado por cliente...');
        try {
            const res = await api.get('/public/financial-sales', {
                params: {
                    search: searchTerm,
                    start_date: startDate,
                    end_date: endDate,
                    programa: programa,
                    tipo_pago_simple: tipoPagoSimple,
                    metodo_pago: metodoPago,
                    closer: closer,
                    source: source,
                    sin_atribucion: sinAtribucion
                }
            });
            
            const allSales = res.data || [];
            if (allSales.length === 0) {
                toast.error('No hay ventas registradas en este periodo para exportar', { id: toastId });
                return;
            }

            const normalizeIg = (ig) => {
                if (!ig || typeof ig !== 'string' || ig.trim() === '' || ig.toLowerCase() === 'n/a') return null;
                return ig.trim().replace(/^@/, '').toLowerCase();
            };

            const normalizeEmail = (email) => {
                if (!email || typeof email !== 'string' || email.trim() === '' || email.toLowerCase() === 'n/a') return null;
                return email.trim().toLowerCase();
            };

            class UnionFindJS {
                constructor() {
                    this.parent = {};
                }
                find(item) {
                    if (!(item in this.parent)) {
                        this.parent[item] = item;
                        return item;
                    }
                    let path = [];
                    while (this.parent[item] !== this.parent[this.parent[item]]) {
                        path.push(item);
                        item = this.parent[item];
                    }
                    for (let node of path) {
                        this.parent[node] = item;
                    }
                    return item;
                }
                union(item1, item2) {
                    let root1 = this.find(item1);
                    let root2 = this.find(item2);
                    if (root1 !== root2) {
                        this.parent[root1] = root2;
                    }
                }
            }

            const uf = new UnionFindJS();
            allSales.forEach(s => {
                const ig = normalizeIg(s.instagram);
                const email = normalizeEmail(s.mail_cliente);
                if (ig && email) {
                    uf.union(ig, email);
                }
            });

            const leads = {};
            allSales.forEach(s => {
                const ig = normalizeIg(s.instagram);
                const email = normalizeEmail(s.mail_cliente);
                let key = null;
                if (ig) {
                    key = uf.find(ig);
                } else if (email) {
                    key = uf.find(email);
                } else {
                    key = `sale_${s.id}`;
                }
                if (!leads[key]) {
                    leads[key] = [];
                }
                leads[key].push(s);
            });

            const getSaleDate = (s) => s.date ? new Date(s.date) : (s.created_at ? new Date(s.created_at) : new Date(0));
            const clientsRows = [];

            Object.keys(leads).forEach(key => {
                const salesGroup = leads[key];
                const sortedSales = salesGroup.sort((a, b) => getSaleDate(a) - getSaleDate(b));
                
                const firstSale = sortedSales[0];
                const entryDate = firstSale.date ? firstSale.date.split('T')[0] : '';
                const clientName = sortedSales[sortedSales.length - 1].nombre_cliente || firstSale.nombre_cliente || 'Desconocido';

                const senaSale = sortedSales.find(s => ['seña', 'sena'].includes((s.tipo_pago_simple || '').toLowerCase().trim()));
                const senaAmount = senaSale ? parseFloat(senaSale.monto_bruto || senaSale.monto || 0) : 0;

                const completoSale = sortedSales.find(s => (s.tipo_pago_simple || '').toLowerCase().trim() === 'completo');
                const completoAmount = completoSale ? parseFloat(completoSale.monto_bruto || completoSale.monto || 0) : 0;

                const parcialSale = sortedSales.find(s => (s.tipo_pago_simple || '').toLowerCase().trim() === 'parcial');
                const parcialAmount = parcialSale ? parseFloat(parcialSale.monto_bruto || parcialSale.monto || 0) : 0;

                const cuotaSales = sortedSales.filter(s => (s.tipo_pago_simple || '').toLowerCase().trim() === 'cuota');
                const totalCuotas = cuotaSales.reduce((sum, s) => sum + parseFloat(s.monto_bruto || s.monto || 0), 0);
                const qtyCuotas = cuotaSales.length;

                const renovacionSales = sortedSales.filter(s => ['renovación', 'renovacion'].includes((s.tipo_pago_simple || '').toLowerCase().trim()));
                const totalRenovaciones = renovacionSales.reduce((sum, s) => sum + parseFloat(s.monto_bruto || s.monto || 0), 0);
                const qtyRenovaciones = renovacionSales.length;

                const upsellSales = sortedSales.filter(s => (s.tipo_pago_simple || '').toLowerCase().trim() === 'upsell');
                const totalUpsells = upsellSales.reduce((sum, s) => sum + parseFloat(s.monto_bruto || s.monto || 0), 0);

                const latestUpsell = [...sortedSales].reverse().find(s => (s.tipo_pago_simple || '').toLowerCase().trim() === 'upsell');
                const programName = latestUpsell ? latestUpsell.programa : firstSale.programa;

                const totalPaid = sortedSales.reduce((sum, s) => sum + parseFloat(s.monto_bruto || s.monto || 0), 0);

                let totalToPay = 0;
                const cleanProg = (programName || '').toUpperCase().trim();
                if (cleanProg === 'AL') totalToPay = 750;
                else if (cleanProg === 'RR') totalToPay = 1500;
                else if (cleanProg === 'SI') totalToPay = 2000;

                const debt = Math.max(0, totalToPay - totalPaid);

                clientsRows.push([
                    entryDate,
                    clientName,
                    senaAmount > 0 ? senaAmount : '',
                    completoAmount > 0 ? completoAmount : '',
                    parcialAmount > 0 ? parcialAmount : '',
                    totalCuotas > 0 ? totalCuotas : '',
                    qtyCuotas > 0 ? qtyCuotas : '',
                    totalRenovaciones > 0 ? totalRenovaciones : '',
                    qtyRenovaciones > 0 ? qtyRenovaciones : '',
                    totalUpsells > 0 ? totalUpsells : '',
                    programName || '',
                    totalPaid,
                    totalToPay > 0 ? totalToPay : '',
                    debt > 0 ? debt : ''
                ]);
            });

            const escapeCSVValue = (val) => {
                if (val === null || val === undefined) return '';
                let valStr = String(val).replace(/"/g, '""');
                if (valStr.includes(',') || valStr.includes('\n') || valStr.includes('\r') || valStr.includes('"')) {
                    return `"${valStr}"`;
                }
                return valStr;
            };

            const headers = [
                'Fecha', 'Nombre', 'Seña', 'Completo', 'Parcial', 'Cuota', 
                'Cantidad de cuotas', 'Renovación', 'Cantidad de Renovaciones', 
                'Upsells', 'Programa', 'Total pagado', 'Total a Pagar', 'Deuda'
            ];

            const csvContent = [
                headers.map(escapeCSVValue).join(','),
                ...clientsRows.map(row => row.map(escapeCSVValue).join(','))
            ].join('\n');

            const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `registro_pagos_${startDate}_al_${endDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('CSV exportado con éxito', { id: toastId });

        } catch (error) {
            toast.error('Error al exportar a CSV', { id: toastId });
            console.error(error);
        } finally {
            setExporting(false);
        }
    };

    const handleExportPaymentsOnlyCSV = async ({ selectedTypes, groupByLead }) => {
        setShowPaymentExportModal(false);
        setExporting(true);
        const toastId = toast.loading(exportingSelectedOnly ? 'Generando CSV de pagos seleccionados...' : 'Generando CSV de pagos...');
        try {
            const params = exportingSelectedOnly
                ? { ids: selectedSaleIds.join(',') }
                : {
                    search: searchTerm,
                    start_date: startDate,
                    end_date: endDate,
                    programa: programa,
                    tipo_pago_simple: tipoPagoSimple,
                    metodo_pago: metodoPago,
                    closer: closer,
                    source: source,
                    sin_atribucion: sinAtribucion
                };

            const res = await api.get('/public/financial-sales', { params });
            
            const rawSales = res.data || [];
            if (rawSales.length === 0) {
                toast.error(exportingSelectedOnly ? 'No hay pagos seleccionados para exportar' : 'No hay pagos registrados en este periodo para exportar', { id: toastId });
                return;
            }

            const normalizeKey = (s) => {
                const ig = s.instagram ? s.instagram.trim().replace(/^@/, '').toLowerCase() : null;
                const email = s.mail_cliente ? s.mail_cliente.trim().toLowerCase() : null;
                return ig || email || `solo_${s.id}`;
            };

            // Calcular la fecha de ingreso (primer pago) del lead en base a todos los registros devueltos
            const entryDatesMap = {};
            const leadsTemp = {};
            rawSales.forEach(s => {
                const key = normalizeKey(s);
                if (!leadsTemp[key]) leadsTemp[key] = [];
                leadsTemp[key].push(s);
            });

            Object.keys(leadsTemp).forEach(key => {
                const group = leadsTemp[key];
                const sorted = group.sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at));
                const first = sorted[0];
                const entryDate = first.date ? first.date.split('T')[0] : (first.created_at ? first.created_at.split('T')[0] : '');
                entryDatesMap[key] = entryDate;
            });

            // Ahora aplicamos el filtro de tipo de pago
            let allSales = [...rawSales];
            if (selectedTypes && selectedTypes.length > 0) {
                allSales = allSales.filter(s => {
                    const tp = (s.tipo_pago_simple || '').toLowerCase().trim();
                    return selectedTypes.some(t => t.toLowerCase() === tp);
                });
                if (allSales.length === 0) {
                    toast.error('No hay pagos del tipo seleccionado en este periodo', { id: toastId });
                    return;
                }
            }

            const escapeCSVValue = (val) => {
                if (val === null || val === undefined) return '';
                let valStr = String(val).replace(/"/g, '""');
                if (valStr.includes(',') || valStr.includes('\n') || valStr.includes('\r') || valStr.includes('"')) {
                    return `"${valStr}"`;
                }
                return valStr;
            };

            let rows = [];
            let headers = [];

            const activeCols = groupByLead
                ? GROUPED_COLUMNS.filter(c => selectedGroupedCols.includes(c.id))
                : INDIVIDUAL_COLUMNS.filter(c => selectedIndividualCols.includes(c.id));

            if (activeCols.length === 0) {
                toast.error('Debes seleccionar al menos una columna para exportar', { id: toastId });
                setExporting(false);
                return;
            }

            headers = activeCols.map(c => c.label);

            if (groupByLead) {
                // Agrupar pagos por lead (mismo Instagram o email)
                const leadsMap = {};
                allSales.forEach(s => {
                    const key = normalizeKey(s);
                    if (!leadsMap[key]) leadsMap[key] = [];
                    leadsMap[key].push(s);
                });

                Object.values(leadsMap).forEach(group => {
                    const sorted = group.sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at));
                    const ref = sorted[sorted.length - 1];
                    const rowData = activeCols.map(col => col.getValue(group, ref, entryDatesMap));
                    rows.push(rowData);
                });
            } else {
                // Un registro por pago
                rows = allSales.map(s => {
                    return activeCols.map(col => col.getValue(s, entryDatesMap));
                });
            }

            const csvContent = [
                headers.map(escapeCSVValue).join(','),
                ...rows.map(row => row.map(escapeCSVValue).join(','))
            ].join('\n');

            const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            const fileName = exportingSelectedOnly
                ? `pagos_seleccionados_${new Date().toISOString().split('T')[0]}.csv`
                : `pagos_${startDate}_al_${endDate}.csv`;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(exportingSelectedOnly ? 'Pagos seleccionados exportados con éxito' : 'Pagos exportados con éxito', { id: toastId });

        } catch (error) {
            toast.error('Error al exportar pagos a CSV', { id: toastId });
            console.error(error);
        } finally {
            setExporting(false);
        }
    };

    const handleExportNewClientsCSV = async () => {
        setExporting(true);
        const toastId = toast.loading('Generando reporte de clientes nuevos...');
        try {
            const res = await api.get('/public/financial-sales', {
                params: {
                    search: searchTerm,
                    start_date: startDate,
                    end_date: endDate,
                    programa: programa,
                    tipo_pago_simple: tipoPagoSimple,
                    metodo_pago: metodoPago,
                    closer: closer,
                    source: source,
                    sin_atribucion: sinAtribucion
                }
            });
            
            const allSales = res.data || [];
            if (allSales.length === 0) {
                toast.error('No hay ventas registradas en este periodo para exportar', { id: toastId });
                return;
            }

            const normalizeIg = (ig) => {
                if (!ig || typeof ig !== 'string' || ig.trim() === '' || ig.toLowerCase() === 'n/a') return null;
                return ig.trim().replace(/^@/, '').toLowerCase();
            };

            const normalizeEmail = (email) => {
                if (!email || typeof email !== 'string' || email.trim() === '' || email.toLowerCase() === 'n/a') return null;
                return email.trim().toLowerCase();
            };

            class UnionFindJS {
                constructor() {
                    this.parent = {};
                }
                find(item) {
                    if (!(item in this.parent)) {
                        this.parent[item] = item;
                        return item;
                    }
                    let path = [];
                    while (this.parent[item] !== this.parent[this.parent[item]]) {
                        path.push(item);
                        item = this.parent[item];
                    }
                    for (let node of path) {
                        this.parent[node] = item;
                    }
                    return item;
                }
                union(item1, item2) {
                    let root1 = this.find(item1);
                    let root2 = this.find(item2);
                    if (root1 !== root2) {
                        this.parent[root1] = root2;
                    }
                }
            }

            const uf = new UnionFindJS();
            allSales.forEach(s => {
                const ig = normalizeIg(s.instagram);
                const email = normalizeEmail(s.mail_cliente);
                if (ig && email) {
                    uf.union(ig, email);
                }
            });

            const leads = {};
            allSales.forEach(s => {
                const ig = normalizeIg(s.instagram);
                const email = normalizeEmail(s.mail_cliente);
                let key = null;
                if (ig) {
                    key = uf.find(ig);
                } else if (email) {
                    key = uf.find(email);
                } else {
                    key = `sale_${s.id}`;
                }
                if (!leads[key]) {
                    leads[key] = [];
                }
                leads[key].push(s);
            });

            const getSaleDate = (s) => s.date ? new Date(s.date) : (s.created_at ? new Date(s.created_at) : new Date(0));
            const newClientsRows = [];

            Object.keys(leads).forEach(key => {
                const salesGroup = leads[key];
                const sortedSales = salesGroup.sort((a, b) => getSaleDate(a) - getSaleDate(b));
                
                const firstSale = sortedSales[0];
                const firstType = (firstSale.tipo_pago_simple || '').toLowerCase().trim();
                const isNewClient = ['seña', 'sena', 'completo', 'parcial'].includes(firstType);
                
                if (!isNewClient) {
                    return;
                }

                const entryDate = firstSale.date ? firstSale.date.split('T')[0] : '';
                const clientName = sortedSales[sortedSales.length - 1].nombre_cliente || firstSale.nombre_cliente || 'Desconocido';

                const senaSale = sortedSales.find(s => ['seña', 'sena'].includes((s.tipo_pago_simple || '').toLowerCase().trim()));
                const senaAmount = senaSale ? parseFloat(senaSale.monto_bruto || senaSale.monto || 0) : 0;

                const completoSale = sortedSales.find(s => (s.tipo_pago_simple || '').toLowerCase().trim() === 'completo');
                const completoAmount = completoSale ? parseFloat(completoSale.monto_bruto || completoSale.monto || 0) : 0;

                const parcialSale = sortedSales.find(s => (s.tipo_pago_simple || '').toLowerCase().trim() === 'parcial');
                const parcialAmount = parcialSale ? parseFloat(parcialSale.monto_bruto || parcialSale.monto || 0) : 0;

                const cuotaSales = sortedSales.filter(s => (s.tipo_pago_simple || '').toLowerCase().trim() === 'cuota');
                const totalCuotas = cuotaSales.reduce((sum, s) => sum + parseFloat(s.monto_bruto || s.monto || 0), 0);
                const qtyCuotas = cuotaSales.length;

                const renovacionSales = sortedSales.filter(s => ['renovación', 'renovacion'].includes((s.tipo_pago_simple || '').toLowerCase().trim()));
                const totalRenovaciones = renovacionSales.reduce((sum, s) => sum + parseFloat(s.monto_bruto || s.monto || 0), 0);
                const qtyRenovaciones = renovacionSales.length;

                const upsellSales = sortedSales.filter(s => (s.tipo_pago_simple || '').toLowerCase().trim() === 'upsell');
                const totalUpsells = upsellSales.reduce((sum, s) => sum + parseFloat(s.monto_bruto || s.monto || 0), 0);

                const latestUpsell = [...sortedSales].reverse().find(s => (s.tipo_pago_simple || '').toLowerCase().trim() === 'upsell');
                const programName = latestUpsell ? latestUpsell.programa : firstSale.programa;

                const totalPaid = sortedSales.reduce((sum, s) => sum + parseFloat(s.monto_bruto || s.monto || 0), 0);

                let totalToPay = 0;
                const cleanProg = (programName || '').toUpperCase().trim();
                if (cleanProg === 'AL') totalToPay = 750;
                else if (cleanProg === 'RR') totalToPay = 1500;
                else if (cleanProg === 'SI') totalToPay = 2000;

                const debt = Math.max(0, totalToPay - totalPaid);

                newClientsRows.push([
                    entryDate,
                    clientName,
                    senaAmount > 0 ? senaAmount : '',
                    completoAmount > 0 ? completoAmount : '',
                    parcialAmount > 0 ? parcialAmount : '',
                    totalCuotas > 0 ? totalCuotas : '',
                    qtyCuotas > 0 ? qtyCuotas : '',
                    totalRenovaciones > 0 ? totalRenovaciones : '',
                    qtyRenovaciones > 0 ? qtyRenovaciones : '',
                    totalUpsells > 0 ? totalUpsells : '',
                    programName || '',
                    totalPaid,
                    totalToPay > 0 ? totalToPay : '',
                    debt > 0 ? debt : ''
                ]);
            });

            if (newClientsRows.length === 0) {
                toast.error('No hay clientes nuevos registrados en este periodo', { id: toastId });
                return;
            }

            const escapeCSVValue = (val) => {
                if (val === null || val === undefined) return '';
                let valStr = String(val).replace(/"/g, '""');
                if (valStr.includes(',') || valStr.includes('\n') || valStr.includes('\r') || valStr.includes('"')) {
                    return `"${valStr}"`;
                }
                return valStr;
            };

            const headers = [
                'Fecha', 'Nombre', 'Seña', 'Completo', 'Parcial', 'Cuota', 
                'Cantidad de cuotas', 'Renovación', 'Cantidad de Renovaciones', 
                'Upsells', 'Programa', 'Total pagado', 'Total a Pagar', 'Deuda'
            ];

            const csvContent = [
                headers.map(escapeCSVValue).join(','),
                ...newClientsRows.map(row => row.map(escapeCSVValue).join(','))
            ].join('\n');

            const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `clientes_nuevos_${startDate}_al_${endDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('Reporte de clientes nuevos exportado con éxito', { id: toastId });

        } catch (error) {
            toast.error('Error al exportar clientes nuevos', { id: toastId });
            console.error(error);
        } finally {
            setExporting(false);
        }
    };

    // Filtros tal cual los espera el backend. Se reutilizan en el GET, en la
    // exportación y en el modo "todo el filtro" de la edición masiva, para que los
    // tres operen exactamente sobre el mismo recorte.
    const filtrosActuales = () => ({
        search: searchTerm,
        start_date: startDate,
        end_date: endDate,
        programa: programa,
        tipo_pago_simple: tipoPagoSimple,
        metodo_pago: metodoPago,
        closer: closer,
        source: source,
        sin_atribucion: sinAtribucion
    });

    const bulkPorFiltro = bulkScope === 'filtro';
    const bulkConfirmOk = !bulkPorFiltro || bulkConfirm.trim().toUpperCase() === 'APLICAR';

    const cerrarBulkModal = () => {
        setShowBulkEditModal(false);
        setBulkEditField('');
        setBulkEditValue('');
        setBulkEditValueCustom(false);
        setBulkConfirm('');
    };

    const handleBulkUpdate = async () => {
        if (!bulkPorFiltro && selectedSaleIds.length === 0) {
            toast.error('Seleccioná ventas o cambiá el alcance a "todo el filtro"');
            return;
        }
        if (!bulkEditField) {
            toast.error('Selecciona un campo para actualizar');
            return;
        }
        if (bulkEditValue === '' && !bulkEditValueCustom) {
            toast.error('Especifica un valor para la modificación masiva');
            return;
        }
        if (!bulkConfirmOk) {
            toast.error('Escribí APLICAR para confirmar el cambio sobre todo el filtro');
            return;
        }

        setBulkUpdating(true);
        const toastId = toast.loading('Actualizando ventas en lote...');
        try {
            const payload = bulkPorFiltro
                ? { apply_filters: true, [bulkEditField]: bulkEditValue }
                : { sale_ids: selectedSaleIds, [bulkEditField]: bulkEditValue };
            // En modo "todo el filtro" los filtros viajan en la query string, igual
            // que en el GET que alimenta la tabla.
            const res = await api.post('/public/financial-sales/bulk-update', payload, {
                params: bulkPorFiltro ? filtrosActuales() : undefined
            });
            toast.success(res.data.message || 'Actualización masiva completada', { id: toastId });

            setSelectedSaleIds([]);
            cerrarBulkModal();
            fetchSales(1);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Error al realizar la actualización masiva', { id: toastId });
            console.error(error);
        } finally {
            setBulkUpdating(false);
        }
    };

    const handleEditClick = (sale) => {
        const isCustomProg = sale.programa && !['RR', 'AL', 'SI'].includes(sale.programa);
        const isCustomPay = sale.tipo_pago_simple && !['Seña', 'Parcial', 'Cuota', 'Completo', 'Renovación', 'Upsell'].includes(sale.tipo_pago_simple);
        const isCustomCloser = sale.email_vendedor && sale.email_vendedor !== 'jeancarlo@thelearnation.com';
        const isCustomSetter = sale.setter && !['workshop', 'vsl', 'Elias'].includes(sale.setter);
        const isCustomMethod = sale.metodo_pago && !['Stripe', 'PayPal', 'Paypal', 'Binance', 'Hotmart'].includes(sale.metodo_pago);

        setEditingSale(sale.id);
        setEditData({
            instagram: sale.instagram || '',
            nombre_cliente: sale.nombre_cliente || '',
            email_vendedor: sale.email_vendedor || '',
            closer_custom: isCustomCloser,
            amount: sale.monto_bruto || sale.monto || 0,
            programa: sale.programa || '',
            programa_custom: isCustomProg,
            tipo_pago_simple: sale.tipo_pago_simple || '',
            tipo_pago_custom: isCustomPay,
            payment_type: sale.metodo_pago || '',
            payment_type_custom: isCustomMethod,
            setter_name: sale.setter || '',
            setter_custom: isCustomSetter,
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

    const handleResendWebhook = async (sale) => {
        const confirmResend = window.confirm(
            `¿Estás seguro de que deseas volver a enviar la venta de "${sale.nombre_cliente}" por $${sale.monto} a n8n?`
        );
        if (!confirmResend) return;

        const loadingToast = toast.loading('Reenviando webhook a n8n...');
        try {
            await api.post(`/public/financial-sales/${sale.id}/resend-webhook`);
            toast.success('Webhook reenviado a n8n con éxito', { id: loadingToast });
        } catch (error) {
            toast.error(error.response?.data?.error || 'Error al reenviar webhook', { id: loadingToast });
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
        programa_custom: false,
        tipo_pago_simple: 'Completo',
        tipo_pago_custom: false,
        monto: '',
        metodo_pago: 'Stripe',
        metodo_pago_custom: false,
        estado: 'Completada',
        email_vendedor: '',
        closer_custom: false,
        setter_name: '',
        setter_custom: false,
        examen: '',
        segundo_pago: '',
        notas: '',
        date: new Date().toISOString().split('T')[0],
        enviar_mensaje: true
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
        const closerEmail = agenda.closer && agenda.closer !== 'Sin asignar' ? agenda.closer : createData.email_vendedor;
        const setterName = agenda.nombre || '';
        const isCustomCloser = closerEmail && closerEmail !== 'jeancarlo@thelearnation.com';
        const isCustomSetter = setterName && !['workshop', 'vsl', 'Elias'].includes(setterName);

        setCreateData(prev => ({
            ...prev,
            nombre_cliente: agenda.lead || '',
            instagram: agenda.instagram && agenda.instagram !== 'N/A' ? agenda.instagram : '',
            mail_cliente: agenda.mail && agenda.mail !== 'N/A' ? agenda.mail : '',
            telefono: agenda.whatsapp && agenda.whatsapp !== 'N/A' ? agenda.whatsapp : '',
            setter_name: setterName,
            setter_custom: isCustomSetter,
            email_vendedor: closerEmail,
            closer_custom: isCustomCloser,
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
            setter_custom: false,
            closer_custom: false,
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
            programa_custom: false,
            tipo_pago_simple: 'Completo',
            tipo_pago_custom: false,
            monto: '',
            metodo_pago: 'Stripe',
            metodo_pago_custom: false,
            estado: 'Completada',
            email_vendedor: '',
            closer_custom: false,
            setter_name: '',
            setter_custom: false,
            examen: '',
            segundo_pago: '',
            notas: '',
            date: new Date().toISOString().split('T')[0],
            enviar_mensaje: true
        });
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!createData.date) {
            toast.error('La fecha de la venta es obligatoria');
            return;
        }
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
                marca_temporal: marcaTemporalStr,
                enviar_webhook: true,
                enviar_mensaje: createData.enviar_mensaje
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
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                    <button
                        onClick={() => setSinAtribucion(!sinAtribucion)}
                        className={`flex items-center justify-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all shadow-lg ${
                            sinAtribucion 
                            ? 'bg-rose-600 border-rose-500 hover:bg-rose-700 text-white font-black' 
                            : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-300'
                        }`}
                    >
                        <Users className="w-4 h-4" />
                        <span>{sinAtribucion ? 'Ver Todas' : 'Atribuir (Sin Agenda)'}</span>
                    </button>

                    {/* Antes este botón solo existía dentro de la barra que aparece al tildar
                        filas, así que no había forma de descubrir la edición masiva sin saber
                        de antemano que estaba ahí. Ahora vive con el resto de las acciones. */}
                    <button
                        onClick={() => {
                            setBulkScope(selectedSaleIds.length > 0 ? 'seleccion' : 'filtro');
                            setBulkConfirm('');
                            setShowBulkEditModal(true);
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
                        title="Aplicar un mismo valor a varias ventas a la vez"
                    >
                        <Edit2 className="w-4 h-4" />
                        <span>
                            Modificación Masiva
                            {selectedSaleIds.length > 0 ? ` (${selectedSaleIds.length})` : ''}
                        </span>
                    </button>

                    <button
                        onClick={handleExportCSV}
                        disabled={exporting}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20"
                    >
                        <Download className="w-4 h-4" />
                        <span>{exporting ? 'Exportando...' : 'Exportar CSV'}</span>
                    </button>

                    <button
                        onClick={() => {
                            // Precargar los tipos disponibles del periodo actual
                            const tiposDisponibles = uniquePaymentTypes.length > 0
                                ? uniquePaymentTypes
                                : ['Completo', 'Seña', 'Cuota', 'Parcial', 'Renovación', 'Upsell'];
                            setPaymentExportTypes(tiposDisponibles);
                            setPaymentExportGroupByLead(false);
                            setExportingSelectedOnly(false);
                            setShowPaymentExportModal(true);
                        }}
                        disabled={exporting}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
                    >
                        <Download className="w-4 h-4" />
                        <span>{exporting ? 'Exportando...' : 'Exportar pagos'}</span>
                    </button>

                    <button
                        onClick={handleExportNewClientsCSV}
                        disabled={exporting}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-teal-500/20"
                    >
                        <Download className="w-4 h-4" />
                        <span>{exporting ? 'Exportando...' : 'Exportar Clientes Nuevos'}</span>
                    </button>

                    <button
                        onClick={() => navigate('/closer/sales/new')}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Registrar Venta</span>
                    </button>
                </div>
            </div>

            {/* Panel de Filtros Reorganizado */}
            <Card variant="surface" className="p-6 rounded-[2rem] border-slate-800 bg-slate-900/20 backdrop-blur-md space-y-5 shadow-2xl relative overflow-visible z-30">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2 text-violet-405">
                        <Filter size={16} className="text-violet-400" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-200">Filtros Inteligentes</span>
                    </div>
                    {getActiveFiltersCount() > 0 && (
                        <button
                            onClick={handleClearFilters}
                            className="text-xs text-rose-400 hover:text-rose-300 font-bold transition-all uppercase tracking-wider flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 px-3.5 py-1.5 rounded-full border border-rose-500/20 hover:scale-[1.02]"
                        >
                            <X size={12} /> Limpiar Filtros ({getActiveFiltersCount()})
                        </button>
                    )}
                </div>

                {/* Fila Principal: Búsqueda y Rango de Fechas */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                    {/* Barra de Búsqueda */}
                    <div className="relative lg:col-span-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar cliente, IG, email o setter..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950/80 border border-slate-850 hover:border-slate-700 focus:border-violet-500 rounded-xl pl-9 pr-9 py-2 text-xs text-white focus:outline-none placeholder:text-slate-500 transition-all focus:ring-1 focus:ring-violet-500/30"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-450 hover:text-white hover:bg-slate-800 rounded-full transition-all"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {/* Rango de Fechas */}
                    <div className="lg:col-span-4">
                        <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-850 hover:border-slate-700 px-3 py-2 rounded-xl transition-all focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500/30">
                            <Calendar 
                                className="w-3.5 h-3.5 text-slate-450 hover:text-white cursor-pointer shrink-0 transition-colors" 
                                onClick={() => {
                                    try {
                                        startDateRef.current?.showPicker();
                                    } catch (e) {
                                        startDateRef.current?.focus();
                                    }
                                }}
                            />
                            <input
                                ref={startDateRef}
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent border-none text-xs text-slate-200 focus:outline-none focus:ring-0 cursor-pointer w-full text-center p-0"
                            />
                            <span className="text-slate-600 text-xs shrink-0">-</span>
                            <input
                                ref={endDateRef}
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent border-none text-xs text-slate-200 focus:outline-none focus:ring-0 cursor-pointer w-full text-center p-0"
                            />
                        </div>
                    </div>

                    {/* Atajos de Fecha (Presets compactos y alineados) */}
                    <div className="flex flex-wrap items-center gap-1.5 lg:col-span-4 justify-start lg:justify-end">
                        {[
                            { id: 'today', label: 'Hoy' },
                            { id: 'this_month', label: 'Este Mes' },
                            { id: 'last_month', label: 'Mes Anterior' },
                            { id: 'last_30_days', label: '30 días' }
                        ].map((preset) => {
                            const isActive = getActiveDatePreset() === preset.id;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => applyDatePreset(preset.id)}
                                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-1.5 rounded-lg border transition-all ${
                                        isActive
                                            ? 'bg-violet-500/15 border-violet-550/40 text-violet-300 shadow-sm shadow-violet-550/5'
                                            : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:text-slate-350 hover:border-slate-800 hover:scale-[1.01]'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="w-full bg-gradient-to-r from-transparent via-slate-800/40 to-transparent h-px" />

                {/* Fila Secundaria: Selectores de Filtro Avanzado Iconográficos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {/* Programa */}
                    <MultiSelectFilter
                        label="Programa"
                        options={uniquePrograms.sort((a, b) => a.localeCompare(b))}
                        selectedValues={programa}
                        onChange={setPrograma}
                        icon={BookOpen}
                        placeholder="Todos los Programas"
                    />

                    {/* Tipo de Pago */}
                    <MultiSelectFilter
                        label="Tipo de Pago"
                        options={uniquePaymentTypes.sort((a, b) => a.localeCompare(b))}
                        selectedValues={tipoPagoSimple}
                        onChange={setTipoPagoSimple}
                        icon={CreditCard}
                        placeholder="Todos los Pagos"
                    />

                    {/* Método de Pago */}
                    <MultiSelectFilter
                        label="Método"
                        options={uniquePaymentMethods.sort((a, b) => a.localeCompare(b))}
                        selectedValues={metodoPago}
                        onChange={setMetodoPago}
                        icon={Wallet}
                        placeholder="Todos los Métodos"
                    />

                    {/* Closer */}
                    <MultiSelectFilter
                        label="Closer"
                        options={['Sin Closer', ...uniqueClosers.filter(c => c !== "Sin Closer").sort((a, b) => a.localeCompare(b))]}
                        selectedValues={closer}
                        onChange={setCloser}
                        icon={UserCheck}
                        placeholder="Todos los Closers"
                    />

                    {/* Fuente (Setter) */}
                    <MultiSelectFilter
                        label="Fuente (Setter)"
                        options={['Sin Setter', ...uniqueSetters.filter(s => s !== "Sin Setter").sort((a, b) => a.localeCompare(b))]}
                        selectedValues={source}
                        onChange={setSource}
                        icon={Compass}
                        placeholder="Todas las Fuentes"
                    />
                </div>

                {/* Pills/Badges de Filtros Activos */}
                {(() => {
                    const activeFilters = [];
                    if (programa) activeFilters.push({ key: 'programa', label: `Programa: ${programa}`, clear: () => setPrograma('') });
                    if (tipoPagoSimple) activeFilters.push({ key: 'tipoPagoSimple', label: `Pago: ${tipoPagoSimple}`, clear: () => setTipoPagoSimple('') });
                    if (metodoPago) activeFilters.push({ key: 'metodoPago', label: `Método: ${metodoPago}`, clear: () => setMetodoPago('') });
                    if (closer) activeFilters.push({ key: 'closer', label: `Closer: ${closer}`, clear: () => setCloser('') });
                    if (source) activeFilters.push({ key: 'source', label: `Fuente: ${source}`, clear: () => setSource('') });
                    if (sinAtribucion) activeFilters.push({ key: 'sinAtribucion', label: 'Sin Atribución', clear: () => setSinAtribucion(false) });

                    if (activeFilters.length === 0) return null;

                    return (
                        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-900/60 animate-in fade-in duration-200">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                <Filter size={10} className="text-violet-405" /> Filtros Activos:
                            </span>
                            {activeFilters.map((f) => (
                                <div
                                    key={f.key}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20 shadow-sm"
                                >
                                    <span className="text-[10px] font-bold">{f.label}</span>
                                    <button
                                        type="button"
                                        onClick={f.clear}
                                        className="p-0.5 hover:bg-violet-500/20 hover:text-white rounded-full transition-colors"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    );
                })()}
            </Card>

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
                                    } else if (norm.includes("upsell")) {
                                        payColor = "text-pink-400 bg-pink-500/10 border-pink-500/20";
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
                                Ventas por Fuente
                            </h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide flex flex-wrap items-baseline gap-1">
                                Total Acumulado: <span className="text-emerald-400 font-black text-sm">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(totalSalesAmount)} USD <span className="text-[10px] text-slate-500 font-normal uppercase tracking-wider">neto</span></span>
                                {totalSalesAmountBruto && totalSalesAmountBruto !== totalSalesAmount && (
                                    <span className="text-slate-400 font-medium text-xs ml-2">
                                        (Bruto: ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(totalSalesAmountBruto)} USD)
                                    </span>
                                )}
                            </p>
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
                                    </div>
                                );
                            })}
                    </div>
                </Card>
            )}

            {/* Sales breakdown by closer */}
            {closersBreakdown.length > 0 && (
                <Card variant="surface" className="p-6 rounded-[2rem] border-slate-800 space-y-6 relative overflow-hidden bg-slate-900/40">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="space-y-1">
                            <h2 className="text-lg font-black text-white italic tracking-tight uppercase flex items-center gap-2">
                                <Users className="text-violet-500" size={18} />
                                Ventas por Closer
                            </h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide flex flex-wrap items-baseline gap-1">
                                Total Acumulado: <span className="text-emerald-400 font-black text-sm">${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(totalSalesAmount)} USD <span className="text-[10px] text-slate-500 font-normal uppercase tracking-wider">neto</span></span>
                                {totalSalesAmountBruto && totalSalesAmountBruto !== totalSalesAmount && (
                                    <span className="text-slate-400 font-medium text-xs ml-2">
                                        (Bruto: ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(totalSalesAmountBruto)} USD)
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Visual Segmented Progress Bar */}
                    <div className="flex h-3 w-full rounded-full bg-slate-950 overflow-hidden shadow-inner border border-slate-800/40">
                        {closersBreakdown
                            .sort((a, b) => b.total_monto - a.total_monto)
                            .map((item) => {
                                const pct = totalSalesAmount > 0 ? (item.total_monto / totalSalesAmount) * 100 : 0;
                                if (pct <= 0) return null;
                                const colors = getCloserColors(item.closer);
                                return (
                                    <div
                                        key={item.closer}
                                        style={{ width: `${pct}%` }}
                                        className={`h-full bg-gradient-to-r ${colors.gradient} transition-all duration-500`}
                                        title={`${item.closer}: ${pct.toFixed(1)}%`}
                                    />
                                );
                            })}
                    </div>

                    {/* Breakdown Closers Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {closersBreakdown
                            .sort((a, b) => b.total_monto - a.total_monto)
                            .map((item) => {
                                const pct = totalSalesAmount > 0 ? (item.total_monto / totalSalesAmount) * 100 : 0;
                                const colors = getCloserColors(item.closer);
                                
                                return (
                                    <div key={item.closer} className="bg-slate-950/50 border border-slate-800/60 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700/80 transition-all group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                                                <span className="text-xs font-black text-white uppercase tracking-tight">
                                                    {item.closer}
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
                                                    ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(item.total_monto)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] text-slate-400">
                                                <span>{item.count} {item.count === 1 ? 'venta' : 'ventas'}</span>
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">Volumen</span>
                                            </div>
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
                        {selectedSaleIds.length > 0 && (
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-indigo-950/30 border border-indigo-800/50 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                                    <span className="text-sm font-bold text-indigo-200">
                                        {selectedSaleIds.length} {selectedSaleIds.length === 1 ? 'venta seleccionada' : 'ventas seleccionadas'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={() => setShowBulkEditModal(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-500/10"
                                    >
                                        <Edit2 size={12} />
                                        Modificación Masiva
                                    </button>
                                    <button
                                        onClick={() => {
                                            const tiposDisponibles = uniquePaymentTypes.length > 0
                                                ? uniquePaymentTypes
                                                : ['Completo', 'Seña', 'Cuota', 'Parcial', 'Renovación', 'Upsell'];
                                            setPaymentExportTypes(tiposDisponibles);
                                            setPaymentExportGroupByLead(false);
                                            setExportingSelectedOnly(true);
                                            setShowPaymentExportModal(true);
                                        }}
                                        disabled={exporting}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-850 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-blue-500/10"
                                    >
                                        <Download size={12} />
                                        {exporting ? 'Exportando...' : 'Exportar Seleccionados'}
                                    </button>
                                    <button
                                        onClick={() => setSelectedSaleIds([])}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-350 rounded-xl text-xs font-semibold transition-all"
                                    >
                                        Desmarcar Todos
                                    </button>
                                </div>
                            </div>
                        )}
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                                    <th className="p-4 font-semibold text-center w-10">
                                        <input
                                            type="checkbox"
                                            checked={sales.length > 0 && selectedSaleIds.length === sales.length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedSaleIds(sales.map(s => s.id));
                                                } else {
                                                    setSelectedSaleIds([]);
                                                }
                                            }}
                                            className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer w-3.5 h-3.5"
                                        />
                                    </th>
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
                                    const isChecked = selectedSaleIds.includes(sale.id);
                                    
                                    return (
                                        <tr key={sale.id} className={`hover:bg-slate-800/30 transition-colors ${isChecked ? 'bg-indigo-650/10 hover:bg-indigo-650/15' : ''}`}>
                                            <td className="p-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedSaleIds([...selectedSaleIds, sale.id]);
                                                        } else {
                                                            setSelectedSaleIds(selectedSaleIds.filter(id => id !== sale.id));
                                                        }
                                                    }}
                                                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer w-3.5 h-3.5"
                                                />
                                            </td>
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
                                                    <div className="flex flex-col">
                                                        <span 
                                                            className="font-medium text-white hover:text-indigo-400 hover:underline cursor-pointer"
                                                            onClick={() => setSelectedRoadmapLead({ 
                                                                instagram: sale.instagram, 
                                                                email: sale.mail_cliente, 
                                                                phone: sale.telefono,
                                                                full_name: sale.nombre_cliente
                                                            })}
                                                        >
                                                            {sale.nombre_cliente || 'N/A'}
                                                        </span>
                                                        {sale.mail_cliente && (
                                                            <span className="text-[10px] text-slate-400 select-all">
                                                                {sale.mail_cliente}
                                                            </span>
                                                        )}
                                                    </div>
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
                                                        <span className="text-emerald-400 font-bold">
                                                            ${sale.monto}
                                                            {sale.monto_bruto && sale.monto_bruto !== sale.monto && (
                                                                <span className="text-[9px] text-slate-500 font-normal uppercase tracking-wider ml-1">neto</span>
                                                            )}
                                                        </span>
                                                        {sale.monto_bruto && sale.monto_bruto !== sale.monto && (
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                Bruto: ${sale.monto_bruto}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            
                                            <td className="p-4 whitespace-nowrap">
                                                {isEditing ? (
                                                    <div className="flex flex-col gap-1">
                                                        <select
                                                            value={editData.programa_custom ? 'otro' : editData.programa}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                if (val === 'otro') {
                                                                    setEditData({ ...editData, programa: '', programa_custom: true });
                                                                } else {
                                                                    setEditData({ ...editData, programa: val, programa_custom: false });
                                                                }
                                                            }}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs cursor-pointer focus:border-indigo-500 focus:outline-none"
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            <option value="RR">RR</option>
                                                            <option value="AL">AL</option>
                                                            <option value="SI">SI</option>
                                                            <option value="otro">Otro...</option>
                                                        </select>
                                                        {editData.programa_custom && (
                                                            <input 
                                                                type="text" 
                                                                value={editData.programa} 
                                                                onChange={e => setEditData({...editData, programa: e.target.value})}
                                                                className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs mt-1"
                                                                placeholder="Especificar programa"
                                                            />
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="font-medium text-slate-200">{sale.programa || 'N/A'}</span>
                                                )}
                                            </td>
                                            
                                            <td className="p-4 space-y-1">
                                                {isEditing ? (
                                                    <>
                                                        <div className="flex flex-col gap-1 mb-1">
                                                            <select
                                                                value={editData.tipo_pago_custom ? 'otro' : editData.tipo_pago_simple}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    if (val === 'otro') {
                                                                        setEditData({ ...editData, tipo_pago_simple: '', tipo_pago_custom: true });
                                                                    } else {
                                                                        setEditData({ ...editData, tipo_pago_simple: val, tipo_pago_custom: false });
                                                                    }
                                                                }}
                                                                className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs cursor-pointer focus:border-indigo-500 focus:outline-none"
                                                            >
                                                                <option value="">Seleccionar...</option>
                                                                <option value="Seña">Seña</option>
                                                                <option value="Parcial">Parcial</option>
                                                                <option value="Cuota">Cuota</option>
                                                                <option value="Completo">Completo</option>
                                                                <option value="Renovación">Renovación</option>
                                                                <option value="Upsell">Upsell</option>
                                                                <option value="otro">Otro...</option>
                                                            </select>
                                                            {editData.tipo_pago_custom && (
                                                                <input 
                                                                    type="text" 
                                                                    value={editData.tipo_pago_simple} 
                                                                    onChange={e => setEditData({...editData, tipo_pago_simple: e.target.value})}
                                                                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                                                    placeholder="Especificar tipo pago"
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <select
                                                                value={editData.payment_type_custom ? 'otro' : editData.payment_type}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    if (val === 'otro') {
                                                                        setEditData({ ...editData, payment_type: '', payment_type_custom: true });
                                                                    } else {
                                                                        setEditData({ ...editData, payment_type: val, payment_type_custom: false });
                                                                    }
                                                                }}
                                                                className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs cursor-pointer focus:border-indigo-500 focus:outline-none"
                                                            >
                                                                <option value="">Seleccionar...</option>
                                                                <option value="Stripe">Stripe</option>
                                                                <option value="PayPal">PayPal</option>
                                                                <option value="Binance">Binance</option>
                                                                <option value="Hotmart">Hotmart</option>
                                                                <option value="otro">Otro...</option>
                                                            </select>
                                                            {editData.payment_type_custom && (
                                                                <input 
                                                                    type="text" 
                                                                    value={editData.payment_type} 
                                                                    onChange={e => setEditData({...editData, payment_type: e.target.value})}
                                                                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                                                    placeholder="Especificar método"
                                                                />
                                                            )}
                                                        </div>
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
                                                        <div className="flex flex-col gap-1 mb-1">
                                                            <select
                                                                value={editData.closer_custom ? 'otro' : editData.email_vendedor}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    if (val === 'otro') {
                                                                        setEditData({ ...editData, email_vendedor: '', closer_custom: true });
                                                                    } else {
                                                                        setEditData({ ...editData, email_vendedor: val, closer_custom: false });
                                                                    }
                                                                }}
                                                                className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs cursor-pointer focus:border-indigo-500 focus:outline-none"
                                                            >
                                                                <option value="">Seleccionar...</option>
                                                                <option value="jeancarlo@thelearnation.com">Jean Carlo</option>
                                                                <option value="otro">Otro...</option>
                                                            </select>
                                                            {editData.closer_custom && (
                                                                <input 
                                                                    type="text" 
                                                                    value={editData.email_vendedor} 
                                                                    onChange={e => setEditData({...editData, email_vendedor: e.target.value})}
                                                                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                                                    placeholder="Closer (Email)"
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <select
                                                                value={editData.setter_custom ? 'otro' : editData.setter_name}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    if (val === 'otro') {
                                                                        setEditData({ ...editData, setter_name: '', setter_custom: true });
                                                                    } else {
                                                                        setEditData({ ...editData, setter_name: val, setter_custom: false });
                                                                    }
                                                                }}
                                                                className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs cursor-pointer focus:border-indigo-500 focus:outline-none"
                                                            >
                                                                <option value="">Seleccionar...</option>
                                                                <option value="workshop">workshop</option>
                                                                <option value="vsl">vsl</option>
                                                                <option value="Elias">Elias</option>
                                                                <option value="otro">Otro...</option>
                                                            </select>
                                                            {editData.setter_custom && (
                                                                <input 
                                                                    type="text" 
                                                                    value={editData.setter_name} 
                                                                    onChange={e => setEditData({...editData, setter_name: e.target.value})}
                                                                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs"
                                                                    placeholder="Especificar Setter"
                                                                />
                                                            )}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="text-xs text-slate-300">C: {sale.closer_name || sale.email_vendedor?.split('@')[0] || 'N/A'}</div>
                                                        <div className="text-xs text-slate-400">F: {sale.setter || 'N/A'}</div>
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
                                                        <button onClick={() => handleResendWebhook(sale)} className="p-1.5 text-indigo-400 hover:text-white bg-indigo-950/40 border border-indigo-900/30 hover:bg-indigo-900 rounded-lg transition-colors" title="Volver a enviar a n8n">
                                                            <Send className="w-3.5 h-3.5" />
                                                        </button>
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
                                <div className="space-y-1 md:col-span-2">
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
                                        value={createData.programa_custom ? 'otro' : createData.programa}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === 'otro') {
                                                setCreateData({ ...createData, programa: '', programa_custom: true });
                                            } else {
                                                setCreateData({ ...createData, programa: val, programa_custom: false });
                                            }
                                        }}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="RR">Residency Roadmap (RR)</option>
                                        <option value="AL">Ace Learner (AL)</option>
                                        <option value="SI">Specialist Initiative (SI)</option>
                                        <option value="otro">Otro / Agregar nuevo...</option>
                                    </select>
                                    {createData.programa_custom && (
                                        <input
                                            type="text"
                                            value={createData.programa}
                                            onChange={e => setCreateData({...createData, programa: e.target.value})}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold mt-1"
                                            placeholder="Especificar programa"
                                        />
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Tipo de Pago *</label>
                                    <select
                                        value={createData.tipo_pago_custom ? 'otro' : createData.tipo_pago_simple}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === 'otro') {
                                                setCreateData({ ...createData, tipo_pago_simple: '', tipo_pago_custom: true });
                                            } else {
                                                setCreateData({ ...createData, tipo_pago_simple: val, tipo_pago_custom: false });
                                            }
                                        }}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="Seña">Seña</option>
                                        <option value="Parcial">Parcial</option>
                                        <option value="Cuota">Cuota</option>
                                        <option value="Completo">Completo</option>
                                        <option value="Renovación">Renovación</option>
                                        <option value="Upsell">Upsell</option>
                                        <option value="otro">Otro / Agregar nuevo...</option>
                                    </select>
                                    {createData.tipo_pago_custom && (
                                        <input
                                            type="text"
                                            value={createData.tipo_pago_simple}
                                            onChange={e => setCreateData({...createData, tipo_pago_simple: e.target.value})}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold mt-1"
                                            placeholder="Especificar tipo pago"
                                        />
                                    )}
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
                                        value={createData.metodo_pago_custom ? 'otro' : createData.metodo_pago}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === 'otro') {
                                                setCreateData({ ...createData, metodo_pago: '', metodo_pago_custom: true });
                                            } else {
                                                setCreateData({ ...createData, metodo_pago: val, metodo_pago_custom: false });
                                            }
                                        }}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="Stripe">Stripe</option>
                                        <option value="PayPal">PayPal</option>
                                        <option value="Binance">Binance</option>
                                        <option value="Hotmart">Hotmart</option>
                                        <option value="otro">Otro / Agregar nuevo...</option>
                                    </select>
                                    {createData.metodo_pago_custom && (
                                        <input
                                            type="text"
                                            value={createData.metodo_pago}
                                            onChange={e => setCreateData({...createData, metodo_pago: e.target.value})}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-indigo-500 outline-none transition-all font-semibold mt-1"
                                            placeholder="Especificar método"
                                        />
                                    )}
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
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Closer (Email del Vendedor)</label>
                                    <select
                                        value={createData.closer_custom ? 'otro' : createData.email_vendedor}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === 'otro') {
                                                setCreateData({ ...createData, email_vendedor: '', closer_custom: true });
                                            } else {
                                                setCreateData({ ...createData, email_vendedor: val, closer_custom: false });
                                            }
                                        }}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="jeancarlo@thelearnation.com">Jean Carlo</option>
                                        <option value="otro">Otro / Agregar nuevo...</option>
                                    </select>
                                    {createData.closer_custom && (
                                        <input
                                            type="text"
                                            value={createData.email_vendedor}
                                            onChange={e => setCreateData({...createData, email_vendedor: e.target.value})}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-indigo-500 outline-none transition-all font-semibold mt-1"
                                            placeholder="ej. closer@neurops.com"
                                        />
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Setter (Fuente)</label>
                                    <select
                                        value={createData.setter_custom ? 'otro' : createData.setter_name}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === 'otro') {
                                                setCreateData({ ...createData, setter_name: '', setter_custom: true });
                                            } else {
                                                setCreateData({ ...createData, setter_name: val, setter_custom: false });
                                            }
                                        }}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="workshop">workshop</option>
                                        <option value="vsl">vsl</option>
                                        <option value="Elias">Elias</option>
                                        <option value="otro">Otro / Agregar nuevo...</option>
                                    </select>
                                    {createData.setter_custom && (
                                        <input
                                            type="text"
                                            value={createData.setter_name}
                                            onChange={e => setCreateData({...createData, setter_name: e.target.value})}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:border-indigo-500 outline-none transition-all font-semibold mt-1"
                                            placeholder="ej. elias"
                                        />
                                    )}
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

                                {/* Switch de Automatización */}
                                <div className="space-y-2 md:col-span-2 flex items-center justify-between bg-slate-950/20 p-4 rounded-2xl border border-slate-850/80">
                                    <div className="space-y-0.5 text-left">
                                        <label className="text-[10px] font-black text-slate-405 uppercase tracking-widest block">Enviar mensaje de WhatsApp</label>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">Activar o desactivar el envío de mensaje al cliente tras registrar la venta</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setCreateData({ ...createData, enviar_mensaje: !createData.enviar_mensaje })}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            createData.enviar_mensaje ? 'bg-indigo-600' : 'bg-slate-700'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                createData.enviar_mensaje ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
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

            <LeadRoadmapModal 
                isOpen={!!selectedRoadmapLead}
                instagram={selectedRoadmapLead?.instagram}
                email={selectedRoadmapLead?.email}
                phone={selectedRoadmapLead?.phone}
                onClose={() => setSelectedRoadmapLead(null)}
                onSuccess={() => fetchSales(1)}
            />

            {/* Modal de Modificación Masiva */}
            {showBulkEditModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 max-w-md w-full space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in duration-300">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
                        
                        <div>
                            <h2 className="text-xl font-black text-white flex items-center gap-2">
                                <Edit2 className="text-indigo-400 w-5 h-5" />
                                Modificación Masiva
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">
                                Aplicá un mismo valor a varias ventas de una sola vez.
                            </p>
                        </div>

                        {/* Alcance: las tildadas o todo el recorte filtrado */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">¿A cuáles se aplica?</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    disabled={selectedSaleIds.length === 0}
                                    onClick={() => setBulkScope('seleccion')}
                                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                        bulkScope === 'seleccion'
                                            ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                                >
                                    <span className="block text-[9px] font-black uppercase tracking-widest">Seleccionadas</span>
                                    <span className="block text-2xl font-black italic tracking-tighter">{selectedSaleIds.length}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBulkScope('filtro')}
                                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                        bulkScope === 'filtro'
                                            ? 'bg-amber-600/20 border-amber-500/40 text-white'
                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                                >
                                    <span className="block text-[9px] font-black uppercase tracking-widest">Todo el filtro</span>
                                    <span className="block text-2xl font-black italic tracking-tighter">{totalSalesCount}</span>
                                </button>
                            </div>
                            {bulkPorFiltro && (
                                <p className="text-[10px] text-amber-300/80 font-semibold bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                                    Se aplica a todas las ventas del recorte actual, incluidas las que todavía
                                    no se cargaron en pantalla. Los lotes de más de 50 ventas no se propagan a
                                    Google Sheets (quedan corregidas en NeurOPS).
                                </p>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Campo a Modificar</label>
                                <select
                                    value={bulkEditField}
                                    onChange={(e) => {
                                        setBulkEditField(e.target.value);
                                        setBulkEditValue('');
                                        setBulkEditValueCustom(false);
                                    }}
                                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                >
                                    <option value="">Seleccionar campo...</option>
                                    <option value="programa">Programa</option>
                                    <option value="tipo_pago_simple">Tipo de Pago</option>
                                    <option value="metodo_pago">Método de Pago</option>
                                    <option value="estado">Estado</option>
                                    <option value="email_vendedor">Closer (Email Vendedor)</option>
                                    <option value="setter">Setter (Fuente)</option>
                                </select>
                            </div>

                            {bulkEditField && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Nuevo Valor</label>
                                    {bulkEditField === 'programa' && (
                                        <>
                                            <select
                                                value={bulkEditValueCustom ? 'otro' : bulkEditValue}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'otro') {
                                                        setBulkEditValue('');
                                                        setBulkEditValueCustom(true);
                                                    } else {
                                                        setBulkEditValue(val);
                                                        setBulkEditValueCustom(false);
                                                    }
                                                }}
                                                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                            >
                                                <option value="">Seleccionar programa...</option>
                                                <option value="RR">Residency Roadmap (RR)</option>
                                                <option value="AL">Ace Learner (AL)</option>
                                                <option value="SI">Specialist Initiative (SI)</option>
                                                <option value="otro">Otro / Especificar nuevo...</option>
                                            </select>
                                            {bulkEditValueCustom && (
                                                <input
                                                    type="text"
                                                    value={bulkEditValue}
                                                    onChange={e => setBulkEditValue(e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold mt-2"
                                                    placeholder="Especificar programa"
                                                />
                                            )}
                                        </>
                                    )}

                                    {bulkEditField === 'tipo_pago_simple' && (
                                        <>
                                            <select
                                                value={bulkEditValueCustom ? 'otro' : bulkEditValue}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'otro') {
                                                        setBulkEditValue('');
                                                        setBulkEditValueCustom(true);
                                                    } else {
                                                        setBulkEditValue(val);
                                                        setBulkEditValueCustom(false);
                                                    }
                                                }}
                                                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                            >
                                                <option value="">Seleccionar tipo pago...</option>
                                                <option value="Seña">Seña</option>
                                                <option value="Parcial">Parcial</option>
                                                <option value="Cuota">Cuota</option>
                                                <option value="Completo">Completo</option>
                                                <option value="Renovación">Renovación</option>
                                                <option value="Upsell">Upsell</option>
                                                <option value="otro">Otro / Especificar nuevo...</option>
                                            </select>
                                            {bulkEditValueCustom && (
                                                <input
                                                    type="text"
                                                    value={bulkEditValue}
                                                    onChange={e => setBulkEditValue(e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold mt-2"
                                                    placeholder="Especificar tipo pago"
                                                />
                                            )}
                                        </>
                                    )}

                                    {bulkEditField === 'metodo_pago' && (
                                        <>
                                            <select
                                                value={bulkEditValueCustom ? 'otro' : bulkEditValue}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'otro') {
                                                        setBulkEditValue('');
                                                        setBulkEditValueCustom(true);
                                                    } else {
                                                        setBulkEditValue(val);
                                                        setBulkEditValueCustom(false);
                                                    }
                                                }}
                                                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                            >
                                                <option value="">Seleccionar método...</option>
                                                <option value="Stripe">Stripe</option>
                                                <option value="PayPal">PayPal</option>
                                                <option value="Binance">Binance</option>
                                                <option value="Hotmart">Hotmart</option>
                                                <option value="otro">Otro / Especificar nuevo...</option>
                                            </select>
                                            {bulkEditValueCustom && (
                                                <input
                                                    type="text"
                                                    value={bulkEditValue}
                                                    onChange={e => setBulkEditValue(e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold mt-2"
                                                    placeholder="Especificar método"
                                                />
                                            )}
                                        </>
                                    )}

                                    {bulkEditField === 'estado' && (
                                        <select
                                            value={bulkEditValue}
                                            onChange={e => setBulkEditValue(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                        >
                                            <option value="">Seleccionar estado...</option>
                                            <option value="Completada">Completada</option>
                                            <option value="Pendiente">Pendiente</option>
                                            <option value="Reembolsada">Reembolsada</option>
                                            <option value="Cancelada">Cancelada</option>
                                        </select>
                                    )}

                                    {bulkEditField === 'email_vendedor' && (
                                        <>
                                            <select
                                                value={bulkEditValueCustom ? 'otro' : bulkEditValue}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'otro') {
                                                        setBulkEditValue('');
                                                        setBulkEditValueCustom(true);
                                                    } else {
                                                        setBulkEditValue(val);
                                                        setBulkEditValueCustom(false);
                                                    }
                                                }}
                                                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                            >
                                                <option value="">Seleccionar closer...</option>
                                                {/* Antes acá solo estaba Jean Carlo escrito a mano. Se usan los
                                                    mismos closers que ofrece el filtro, resueltos a nombre único. */}
                                                {uniqueClosers.filter(c => c !== 'Sin Closer').map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                                <option value="otro">Otro / Especificar email...</option>
                                            </select>
                                            {bulkEditValueCustom && (
                                                <input
                                                    type="email"
                                                    value={bulkEditValue}
                                                    onChange={e => setBulkEditValue(e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold mt-2"
                                                    placeholder="ej. closer@neurops.com"
                                                />
                                            )}
                                        </>
                                    )}

                                    {bulkEditField === 'setter' && (
                                        <>
                                            <select
                                                value={bulkEditValueCustom ? 'otro' : bulkEditValue}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'otro') {
                                                        setBulkEditValue('');
                                                        setBulkEditValueCustom(true);
                                                    } else {
                                                        setBulkEditValue(val);
                                                        setBulkEditValueCustom(false);
                                                    }
                                                }}
                                                className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold cursor-pointer"
                                            >
                                                <option value="">Seleccionar setter...</option>
                                                {/* Antes estaban escritas a mano workshop/vsl/Elias. Se usan las
                                                    fuentes que existen en el recorte, que ya incluyen el catálogo
                                                    oficial (workshop, workshop_landing, vsl, setting, y los setters). */}
                                                {uniqueSetters.filter(x => x !== 'Sin Setter').map(x => (
                                                    <option key={x} value={x}>{x}</option>
                                                ))}
                                                <option value="otro">Otro / Especificar nuevo...</option>
                                            </select>
                                            {bulkEditValueCustom && (
                                                <input
                                                    type="text"
                                                    value={bulkEditValue}
                                                    onChange={e => setBulkEditValue(e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500 transition-all font-semibold mt-2"
                                                    placeholder="Especificar setter"
                                                />
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* El modo "todo el filtro" puede tocar cientos de ventas de una vez,
                            así que pide confirmación escrita antes de habilitar el botón. */}
                        {bulkPorFiltro && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
                                    Escribí APLICAR para confirmar
                                </label>
                                <input
                                    type="text"
                                    value={bulkConfirm}
                                    onChange={e => setBulkConfirm(e.target.value)}
                                    placeholder="APLICAR"
                                    className="w-full bg-slate-950 border border-amber-700/40 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500 transition-all font-black tracking-widest uppercase"
                                />
                            </div>
                        )}

                        <div className="pt-4 flex justify-end gap-3 border-t border-slate-805">
                            <button
                                type="button"
                                onClick={cerrarBulkModal}
                                disabled={bulkUpdating}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBulkUpdate}
                                disabled={bulkUpdating || !bulkEditField || (bulkEditValue === '' && !bulkEditValueCustom) || !bulkConfirmOk || (!bulkPorFiltro && selectedSaleIds.length === 0)}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 disabled:bg-indigo-800 disabled:opacity-50"
                            >
                                {bulkUpdating ? 'Actualizando...' : `Aplicar a ${bulkPorFiltro ? totalSalesCount : selectedSaleIds.length}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Configuración de exportación de pagos */}
            {showPaymentExportModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-black text-white tracking-wide">Exportar Pagos</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Configura qué incluir en el CSV</p>
                            </div>
                            <button
                                onClick={() => setShowPaymentExportModal(false)}
                                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Tipos de pago */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Tipos de pago a incluir</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPaymentExportTypes(uniquePaymentTypes.length > 0 ? uniquePaymentTypes : ['Completo', 'Seña', 'Cuota', 'Parcial', 'Renovación', 'Upsell'])}
                                        className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider"
                                    >
                                        Todos
                                    </button>
                                    <span className="text-slate-600">·</span>
                                    <button
                                        onClick={() => setPaymentExportTypes([])}
                                        className="text-[10px] text-slate-400 hover:text-slate-300 font-bold uppercase tracking-wider"
                                    >
                                        Ninguno
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {(uniquePaymentTypes.length > 0
                                    ? uniquePaymentTypes
                                    : ['Completo', 'Seña', 'Cuota', 'Parcial', 'Renovación', 'Upsell']
                                ).map(tipo => {
                                    const isSelected = paymentExportTypes.some(t => t.toLowerCase() === tipo.toLowerCase());
                                    return (
                                        <button
                                            key={tipo}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setPaymentExportTypes(prev => prev.filter(t => t.toLowerCase() !== tipo.toLowerCase()));
                                                } else {
                                                    setPaymentExportTypes(prev => [...prev, tipo]);
                                                }
                                            }}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                                                isSelected
                                                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                                            }`}
                                        >
                                            <span className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-600'}`}>
                                                {isSelected && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                            </span>
                                            {tipo}
                                        </button>
                                    );
                                })}
                            </div>
                            {paymentExportTypes.length === 0 && (
                                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                                    Sin selección = se exportan todos los tipos
                                </p>
                            )}
                        </div>

                        {/* Agrupar por Lead */}
                        <div className="border-t border-slate-800 pt-4">
                            <button
                                onClick={() => setPaymentExportGroupByLead(v => !v)}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                                    paymentExportGroupByLead
                                        ? 'bg-violet-600/20 border-violet-500/50'
                                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                                }`}
                            >
                                <div className="text-left">
                                    <p className={`text-sm font-bold ${paymentExportGroupByLead ? 'text-violet-300' : 'text-slate-300'}`}>
                                        Agrupar por Lead
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {paymentExportGroupByLead
                                            ? 'Una fila por lead con total y tipos combinados'
                                            : 'Una fila por pago (vista detallada)'}
                                    </p>
                                </div>
                                <div className={`w-10 h-5.5 rounded-full flex items-center transition-all px-0.5 ${paymentExportGroupByLead ? 'bg-violet-600' : 'bg-slate-700'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all ${paymentExportGroupByLead ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                            </button>
                        </div>

                        {/* Columnas a Exportar */}
                        <div className="space-y-2 border-t border-slate-800 pt-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Columnas a exportar</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            if (paymentExportGroupByLead) {
                                                setSelectedGroupedCols(GROUPED_COLUMNS.map(c => c.id));
                                            } else {
                                                setSelectedIndividualCols(INDIVIDUAL_COLUMNS.map(c => c.id));
                                            }
                                        }}
                                        className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider"
                                    >
                                        Todas
                                    </button>
                                    <span className="text-slate-600">·</span>
                                    <button
                                        onClick={() => {
                                            if (paymentExportGroupByLead) {
                                                setSelectedGroupedCols([]);
                                            } else {
                                                setSelectedIndividualCols([]);
                                            }
                                        }}
                                        className="text-[10px] text-slate-400 hover:text-slate-300 font-bold uppercase tracking-wider"
                                    >
                                        Ninguna
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                                {(paymentExportGroupByLead ? GROUPED_COLUMNS : INDIVIDUAL_COLUMNS).map(col => {
                                    const isSelected = paymentExportGroupByLead
                                        ? selectedGroupedCols.includes(col.id)
                                        : selectedIndividualCols.includes(col.id);
                                    return (
                                        <button
                                            key={col.id}
                                            onClick={() => {
                                                if (paymentExportGroupByLead) {
                                                    setSelectedGroupedCols(prev =>
                                                        isSelected ? prev.filter(id => id !== col.id) : [...prev, col.id]
                                                    );
                                                } else {
                                                    setSelectedIndividualCols(prev =>
                                                        isSelected ? prev.filter(id => id !== col.id) : [...prev, col.id]
                                                    );
                                                }
                                            }}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                                                isSelected
                                                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                                            }`}
                                        >
                                            <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border flex-shrink-0 transition-all ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'}`}>
                                                {isSelected && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                            </span>
                                            <span className="truncate">{col.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {((paymentExportGroupByLead ? selectedGroupedCols : selectedIndividualCols).length === 0) && (
                                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                                    Debes seleccionar al menos una columna para exportar.
                                </p>
                            )}
                        </div>

                        {/* Botones */}
                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={() => setShowPaymentExportModal(false)}
                                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleExportPaymentsOnlyCSV({
                                    selectedTypes: paymentExportTypes,
                                    groupByLead: paymentExportGroupByLead
                                })}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
                            >
                                <Download size={15} />
                                Exportar CSV
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PublicFinancialSalesPage;
