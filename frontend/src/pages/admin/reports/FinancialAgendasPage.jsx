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
    FilterX,
    Phone,
    ChevronDown,
    ChevronUp,
    Clock,
    CheckCircle,
    UserX,
    DollarSign,
    Building,
    RefreshCw,
    Download,
    X
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import usePersistentFilters from '../../../hooks/usePersistentFilters';
import LeadRoadmapModal from '../../../components/modals/LeadRoadmapModal';
import { useAuth } from '../../../contexts/AuthContext';


// Celda que muestra el número y el porcentaje en lugares diferentes de forma vertical
const HoverPercentCell = ({ value, total, className = "" }) => {
    const numericValue = Number(value) || 0;
    const numericTotal = Number(total) || 0;
    const percentage = numericTotal > 0 ? ((numericValue / numericTotal) * 100).toFixed(0) : '0';
    
    return (
        <td className={`${className} select-none transition-all duration-150`}>
            <div className="flex flex-col items-center justify-center">
                <span className="font-bold">{value}</span>
                <span className="text-[9px] text-slate-400/80 font-normal">({percentage}%)</span>
            </div>
        </td>
    );
};

// Tabla interactiva reutilizable para los nuevos desgloses de rendimiento
const PerformanceTable = ({ dataMap, labelName }) => {
    const calculateTotalRow = (statesMap) => {
        const totalRow = {
            Pendiente: 0, Contactado: 0, Confirmado: 0, Reagendada: 0, Cancelada: 0, Cerrada: 0,
            "Show Up": 0, "No Show": 0, "2TH Call": 0,
            Ventas: 0, Depósitos: 0, "Follow Ups": 0, "No Leads": 0,
            total: 0
        };
        Object.values(statesMap).forEach(stats => {
            totalRow.Pendiente += stats.Pendiente || 0;
            totalRow.Contactado += stats.Contactado || 0;
            totalRow.Confirmado += stats.Confirmado || 0;
            totalRow.Reagendada += stats.Reagendada || 0;
            totalRow.Cancelada += stats.Cancelada || 0;
            totalRow.Cerrada += stats.Cerrada || 0;
            totalRow["Show Up"] += stats["Show Up"] || 0;
            totalRow["No Show"] += stats["No Show"] || 0;
            totalRow["2TH Call"] += stats["2TH Call"] || 0;
            totalRow.Ventas += stats.Ventas || 0;
            totalRow.Depósitos += stats.Depósitos || 0;
            totalRow["Follow Ups"] += stats["Follow Ups"] || 0;
            totalRow["No Leads"] += stats["No Leads"] || 0;
            totalRow.total += stats.total || 0;
        });
        return totalRow;
    };

    const totalStats = calculateTotalRow(dataMap);
    const sortedEntries = Object.entries(dataMap).sort((a, b) => b[1].total - a[1].total);

    const renderRow = (name, stats, isTotal = false) => {
        const showUp = stats["Show Up"] || 0;
        // Total de la fila para Preparation y Execution
        const rowTotal = (stats.Pendiente || 0) + (stats.Contactado || 0) + (stats.Confirmado || 0) + 
                         (stats.Reagendada || 0) + (stats.Cancelada || 0) + (stats.Cerrada || 0) + 
                         (stats["Show Up"] || 0) + (stats["No Show"] || 0) + (stats["2TH Call"] || 0);

        return (
            <tr key={name} className={`transition-colors ${isTotal ? 'bg-slate-900/60 font-black border-t border-slate-700' : 'hover:bg-white/5'}`}>
                <td className={`py-3 px-2 text-[10px] uppercase tracking-wider ${isTotal ? 'font-black text-white italic' : 'font-bold text-slate-200'}`}>
                    {name}
                </td>
                
                {/* PREPARATION */}
                <HoverPercentCell value={stats.Pendiente || 0} total={rowTotal} className="py-3 px-1 text-center text-slate-400 border-r border-slate-900/40" />
                <HoverPercentCell value={stats.Contactado || 0} total={rowTotal} className="py-3 px-1 text-center text-indigo-400 border-r border-slate-900/40" />
                <HoverPercentCell value={stats.Confirmado || 0} total={rowTotal} className="py-3 px-1 text-center text-cyan-400 border-r border-slate-900/40" />
                <HoverPercentCell value={stats.Reagendada || 0} total={rowTotal} className="py-3 px-1 text-center text-amber-500 border-r border-slate-900/40" />
                <HoverPercentCell value={stats.Cancelada || 0} total={rowTotal} className="py-3 px-1 text-center text-rose-500 border-r border-slate-900/40" />
                <HoverPercentCell value={stats.Cerrada || 0} total={rowTotal} className="py-3 px-1 text-center text-violet-400 border-r-2 border-slate-800" />
                
                {/* EXECUTION */}
                <HoverPercentCell value={stats["Show Up"] || 0} total={rowTotal} className="py-3 px-1 text-center text-emerald-400 border-r border-slate-900/40 font-bold" />
                <HoverPercentCell value={stats["No Show"] || 0} total={rowTotal} className="py-3 px-1 text-center text-rose-500 border-r border-slate-900/40" />
                <HoverPercentCell value={stats["2TH Call"] || 0} total={rowTotal} className="py-3 px-1 text-center text-indigo-400 border-r-2 border-slate-800" />
                
                {/* RESULTS */}
                <HoverPercentCell value={stats.Ventas || 0} total={showUp} className="py-3 px-1 text-center text-emerald-400 border-r border-slate-900/40 font-bold" />
                <HoverPercentCell value={stats.Depósitos || 0} total={showUp} className="py-3 px-1 text-center text-violet-400 border-r border-slate-900/40" />
                <HoverPercentCell value={stats["Follow Ups"] || 0} total={showUp} className="py-3 px-1 text-center text-amber-500 border-r border-slate-900/40" />
                <HoverPercentCell value={stats["No Leads"] || 0} total={showUp} className="py-3 px-1 text-center text-slate-500" />
            </tr>
        );
    };

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-slate-900 bg-slate-950/20">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        {/* Fila 1: Grupos Principales */}
                        <tr className="border-b border-slate-900 bg-slate-950/80">
                            <th className="py-3 px-2 font-black text-slate-400 uppercase tracking-wider text-[9px] w-24">
                                {labelName}
                            </th>
                            
                            <th colSpan="6" className="py-2.5 text-center bg-blue-950/20 border-r border-slate-800/80 text-[10px] font-black uppercase text-blue-300 tracking-wider">
                                <div className="flex items-center justify-center gap-1.5">
                                    <Clock size={11} className="text-blue-400" />
                                    PREPARATION
                                    <span className="text-[8px] font-medium text-slate-450 lowercase tracking-normal italic block md:inline md:ml-1">(Antes de la llamada)</span>
                                </div>
                            </th>
                            
                            <th colSpan="3" className="py-2.5 text-center bg-emerald-950/10 border-r border-slate-800/80 text-[10px] font-black uppercase text-emerald-300 tracking-wider">
                                <div className="flex items-center justify-center gap-1.5">
                                    <Users size={11} className="text-emerald-400" />
                                    EXECUTION
                                    <span className="text-[8px] font-medium text-slate-450 lowercase tracking-normal italic block md:inline md:ml-1">(Durante la ejecución)</span>
                                </div>
                            </th>
                            
                            <th colSpan="4" className="py-2.5 text-center bg-violet-950/15 text-[10px] font-black uppercase text-violet-300 tracking-wider">
                                <div className="flex items-center justify-center gap-1.5">
                                    <Activity size={11} className="text-violet-400" />
                                    RESULTS
                                    <span className="text-[8px] font-medium text-slate-450 lowercase tracking-normal italic block md:inline md:ml-1">(De los show up, en qué terminaron)</span>
                                </div>
                            </th>
                        </tr>
                        
                        {/* Fila 2: Sub-encabezados de Estados */}
                        <tr className="border-b border-slate-900/60 bg-slate-950/40 text-[9px] text-slate-400 font-bold uppercase text-center">
                            <th className="py-2 px-2 text-left text-slate-500">Nombre</th>
                            
                            {/* PREPARATION */}
                            <th className="py-2 px-1 text-slate-400 border-r border-slate-900/40">Pendiente</th>
                            <th className="py-2 px-1 text-indigo-400 border-r border-slate-900/40">Contactado</th>
                            <th className="py-2 px-1 text-cyan-400 border-r border-slate-900/40">Confirmado</th>
                            <th className="py-2 px-1 text-amber-500 border-r border-slate-900/40">Reprogramado</th>
                            <th className="py-2 px-1 text-rose-500 border-r border-slate-900/40">Cancelado</th>
                            <th className="py-2 px-1 text-violet-400 border-r-2 border-slate-800">Cerrado</th>
                            
                            {/* EXECUTION */}
                            <th className="py-2 px-1 text-emerald-450 border-r border-slate-900/40">Show Up</th>
                            <th className="py-2 px-1 text-rose-500 border-r border-slate-900/40">No Show</th>
                            <th className="py-2 px-1 text-indigo-400 border-r-2 border-slate-800">2TH Call</th>
                            
                            {/* RESULTS */}
                            <th className="py-2 px-1 text-emerald-450 border-r border-slate-900/40">Ventas</th>
                            <th className="py-2 px-1 text-violet-400 border-r border-slate-900/40">Depósitos</th>
                            <th className="py-2 px-1 text-amber-500 border-r border-slate-900/40">Follow Ups</th>
                            <th className="py-2 px-1 text-slate-500">No Leads</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/30">
                        {sortedEntries.map(([name, stats]) => renderRow(name, stats))}
                        {sortedEntries.length > 0 && renderRow("TOTAL GENERAL", totalStats, true)}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


const toLocalDateString = (d) => {
    if (!d) return '';
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
};

const getFirstDayOfCurrentMonth = () => {
    const now = new Date();
    return toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
};

const getTodayDate = () => {
    return toLocalDateString(new Date());
};

const getEstadoBadgeVariant = (estado) => {
    switch (estado) {
        case 'Show Up':
            return 'primary';
        case 'Contactado':
            return 'indigo';
        case 'Confirmado':
            return 'success';
        case 'Cerrada':
            return 'indigo';
        case 'No show':
        case 'No Show':
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

const formatDateOnly = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {
            if (typeof dateStr === 'string') {
                const parts = dateStr.split(/[ T]/);
                if (parts[0] && parts[0].includes('-')) {
                    const subparts = parts[0].split('-');
                    if (subparts.length === 3 && subparts[0].length === 4) {
                        const dateObj = new Date(subparts[0], subparts[1] - 1, subparts[2]);
                        if (!isNaN(dateObj.getTime())) {
                            return dateObj.toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                            });
                        }
                    }
                }
            }
            return dateStr;
        }
        return d.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch {
        return dateStr;
    }
};

const formatToDatetimeLocal = (dateStr) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {
            const parsed = Date.parse(dateStr);
            if (isNaN(parsed)) return '';
            const dp = new Date(parsed);
            const year = dp.getFullYear();
            const month = String(dp.getMonth() + 1).padStart(2, '0');
            const day = String(dp.getDate()).padStart(2, '0');
            const hours = String(dp.getHours()).padStart(2, '0');
            const minutes = String(dp.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
        return '';
    }
};

const FinancialAgendasPage = () => {
    const { user } = useAuth();
    const [agendas, setAgendas] = useState([]);
    const [selectedRoadmapLead, setSelectedRoadmapLead] = useState(null);
    const [statusActionModal, setStatusActionModal] = useState({
        isOpen: false,
        agenda: null,
        nuevoEstado: '',
        isConfirmer: false,
        requiresDate: false,
        razon: '',
        fechaHora: ''
    });

    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const [totalAgendados, setTotalAgendados] = useState(0);
    const [proximasCitas, setProximasCitas] = useState(0);
    const [sortedClosers, setSortedClosers] = useState([]);
    const [byCloserState, setByCloserState] = useState({});
    const [bySourceState, setBySourceState] = useState({});
    const [byTriageState, setByTriageState] = useState({});

    const [uniqueStates, setUniqueStates] = useState([]);
    const [uniqueClosers, setUniqueClosers] = useState([]);
    const [uniqueSources, setUniqueSources] = useState([]);
    const [uniqueTriage, setUniqueTriage] = useState([]);
    const [isSummaryMinimized, setIsSummaryMinimized] = useState(true);
    const [activeSummaryTab, setActiveSummaryTab] = useState('fuente');

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
        estado: '',
        encargado_triage: ''
    });

    const handleStatusActionSubmit = async (e) => {
        if (e) e.preventDefault();
        const { agenda, nuevoEstado, isConfirmer, requiresDate, razon, fechaHora } = statusActionModal;
        if (!razon || razon.trim() === '') {
            alert('La razón es obligatoria');
            return;
        }
        if (requiresDate && !fechaHora) {
            alert('La fecha y hora de reprogramación son obligatorias');
            return;
        }
        
        const payload = isConfirmer ? {
            estado: nuevoEstado,
            note: razon,
            reschedule_date: fechaHora
        } : {
            closer_result: nuevoEstado,
            note: razon,
            reschedule_date: fechaHora
        };
        
        try {
            const response = await api.put(`/public/financial-agendas/${agenda.id}`, payload);
            const updated = response.data.agenda;
            setAgendas(prev => prev.map(a => a.id === updated.id ? updated : a));
            setStatusActionModal({ isOpen: false, agenda: null, nuevoEstado: '', isConfirmer: false, requiresDate: false, razon: '', fechaHora: '' });
        } catch (err) {
            console.error("Error al procesar cambio de estado in-line:", err);
            alert("Error al actualizar el estado de la agenda");
        }
    };

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
            estado: agenda.estado || 'Pendiente',
            encargado_triage: agenda.encargado_triage || ''
        });
    };

    const handleExportPotentialClientsCSV = async () => {
        setExporting(true);
        try {
            const response = await api.get('/public/financial-agendas', {
                params: {
                    search: searchTerm,
                    start_date: startDate,
                    end_date: endDate,
                    date_filter_by: dateFilterBy,
                    estado: estado,
                    closer: closer,
                    fuente: fuente,
                    encargado_triage: encargadoTriage
                }
            });

            const allAgendas = response.data || [];
            const potentials = allAgendas.filter(a => (a.sales_count || 0) === 0);
            
            if (potentials.length === 0) {
                alert("No se encontraron clientes potenciales (leads agendados sin ventas registradas) en este periodo.");
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

            const headers = ['Fecha', 'Nombre', 'Telefono', 'Email', 'Instagram'];
            const rows = potentials.map(a => [
                a.date ? a.date.split('T')[0] : '',
                a.lead || '',
                a.whatsapp || '',
                a.mail || '',
                a.instagram || ''
            ]);

            const csvContent = [
                headers.map(escapeCSVValue).join(','),
                ...rows.map(row => row.map(escapeCSVValue).join(','))
            ].join('\n');

            const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `clientes_potenciales_${startDate}_al_${endDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("Error al exportar clientes potenciales:", err);
            alert("Error al exportar clientes potenciales a CSV");
        } finally {
            setExporting(false);
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...editForm,
                date: editForm.fecha_meet
            };
            const response = await api.put(`/public/financial-agendas/${editingAgenda.id}`, payload);
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
        encargadoTriage: '',
        dateFilterBy: 'meet'
    });

    const { searchTerm, startDate, endDate, estado, closer, fuente, encargadoTriage, dateFilterBy } = filters;
    const setSearchTerm = (val) => setFilters({ searchTerm: val });
    const setStartDate = (val) => setFilters({ startDate: val });
    const setEndDate = (val) => setFilters({ endDate: val });
    const setEstado = (val) => setFilters({ estado: val });
    const setCloser = (val) => setFilters({ closer: val });
    const setFuente = (val) => setFilters({ fuente: val });
    const setEncargadoTriage = (val) => setFilters({ encargadoTriage: val });
    const setDateFilterBy = (val) => setFilters({ dateFilterBy: val });

    const applyDatePreset = (preset) => {
        const today = new Date();
        const todayStr = toLocalDateString(today);
        let start = '';
        let end = todayStr;

        if (preset === 'today') {
            start = todayStr;
            end = todayStr;
        } else if (preset === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);
            start = toLocalDateString(yesterday);
            end = start;
        } else if (preset === 'this_month') {
            start = toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
            end = todayStr;
        } else if (preset === 'last_month') {
            const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            start = toLocalDateString(firstOfLastMonth);
            end = toLocalDateString(lastOfLastMonth);
        } else if (preset === 'upcoming') {
            start = todayStr;
            end = '';
        }

        setFilters({ startDate: start, endDate: end });
    };

    const getActiveDatePreset = () => {
        const today = new Date();
        const todayStr = toLocalDateString(today);
        
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = toLocalDateString(yesterday);

        const thisMonthStart = toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
        
        const lastMonthFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthLast = new Date(today.getFullYear(), today.getMonth(), 0);
        const lastMonthStartStr = toLocalDateString(lastMonthFirst);
        const lastMonthEndStr = toLocalDateString(lastMonthLast);
        
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
                    encargado_triage: encargadoTriage,
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
                setByTriageState(resData.by_triage_state || {});

                setUniqueStates(resData.unique_states || []);
                setUniqueClosers(resData.unique_closers || []);
                setUniqueSources(resData.unique_sources || []);
                setUniqueTriage(resData.unique_triage || []);
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
    }, [searchTerm, startDate, endDate, estado, closer, fuente, encargadoTriage, dateFilterBy]);

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
                            {['Pendiente', 'Contactado', 'Confirmado', 'Show Up', 'No Show', 'Reagendada', 'Cancelada', 'Cerrada'].map(st => (
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

                    {/* Selector de Triage */}
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-2.5 rounded-2xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Call Confirmer</span>
                        <select
                            value={encargadoTriage}
                            onChange={(e) => setEncargadoTriage(e.target.value)}
                            className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 cursor-pointer pr-8 font-bold uppercase tracking-wider p-0"
                        >
                            <option value="" className="bg-slate-900 text-white font-semibold">Todos</option>
                            <option value="Sin Asignar" className="bg-slate-900 text-white font-semibold">Sin Asignar</option>
                            {uniqueTriage.map(tg => (
                                <option key={tg} value={tg} className="bg-slate-900 text-white font-semibold">{tg}</option>
                            ))}
                        </select>
                    </div>

                    {/* Botón para Limpiar todos los Filtros */}
                    {(estado || closer || fuente || encargadoTriage || searchTerm || startDate !== getFirstDayOfCurrentMonth() || endDate !== getTodayDate()) && (
                        <button
                            type="button"
                            onClick={() => setFilters({
                                searchTerm: '',
                                startDate: getFirstDayOfCurrentMonth(),
                                endDate: getTodayDate(),
                                estado: '',
                                closer: '',
                                fuente: '',
                                encargadoTriage: ''
                            })}
                            className="p-3 bg-rose-600/10 border border-rose-500/20 hover:bg-rose-600 hover:text-white text-rose-400 rounded-2xl transition-all cursor-pointer shadow-sm shadow-rose-950/20"
                            title="Limpiar Filtros"
                        >
                            <FilterX size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Desgloses de Rendimiento */}
            <Card variant="surface" className="p-6 space-y-6 rounded-[2rem] border-base relative overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-[10px] font-black text-base uppercase tracking-widest flex items-center gap-2">
                        <Activity className="text-primary" size={16} />
                        Desglose de Rendimiento
                    </h3>
                    <button
                        type="button"
                        onClick={() => setIsSummaryMinimized(!isSummaryMinimized)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title={isSummaryMinimized ? "Maximizar desgloses" : "Minimizar desgloses"}
                    >
                        {isSummaryMinimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                </div>
                
                {!isSummaryMinimized && (
                    <div className="space-y-6">
                        {/* Selector de Pestañas */}
                        <div className="flex flex-wrap gap-2 p-1.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl max-w-max">
                            {[
                                { id: 'fuente', label: 'Fuente' },
                                { id: 'closer', label: 'Closer' },
                                { id: 'todos', label: 'Todos' }
                            ].map((tab) => {
                                const isActive = activeSummaryTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveSummaryTab(tab.id)}
                                        className={`text-[9px] font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-all cursor-pointer ${
                                            isActive
                                                ? 'bg-white/5 border border-white/10 text-white shadow-md'
                                                : 'border border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Renderizado de tablas según pestaña activa */}
                        <div className="space-y-8">
                            {/* Pestaña: Fuente */}
                            {(activeSummaryTab === 'fuente' || activeSummaryTab === 'todos') && (
                                <div className="space-y-4">
                                    {activeSummaryTab === 'todos' && (
                                        <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 pl-1">
                                            <Activity size={12} />
                                            Desglose por Fuente
                                        </h4>
                                    )}
                                    {Object.keys(bySourceState).length > 0 ? (
                                        <PerformanceTable dataMap={bySourceState} labelName="Fuente" />
                                    ) : (
                                        !loading && (
                                            <div className="py-8 text-center text-muted text-xs font-bold tracking-widest uppercase">
                                                Sin datos de Fuente en el periodo
                                            </div>
                                        )
                                    )}
                                </div>
                            )}

                            {/* Pestaña: Closer */}
                            {(activeSummaryTab === 'closer' || activeSummaryTab === 'todos') && (
                                <div className="space-y-4">
                                    {activeSummaryTab === 'todos' && (
                                        <h4 className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 pl-1">
                                            <Users size={12} />
                                            Desglose por Closer
                                        </h4>
                                    )}
                                    {Object.keys(byCloserState).length > 0 ? (
                                        <PerformanceTable dataMap={byCloserState} labelName="Closer" />
                                    ) : (
                                        !loading && (
                                            <div className="py-8 text-center text-muted text-xs font-bold tracking-widest uppercase">
                                                Sin datos de Closer en el periodo
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Card>

            {/* List Section */}
            <Card variant="surface" className="p-8 space-y-6 rounded-[2.5rem] border-base relative">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <h3 className="text-[10px] font-black text-base uppercase tracking-widest flex items-center gap-2">
                        <Table className="text-primary" size={16} />
                        Historial de Agendas
                    </h3>
                    
                    <button
                        onClick={handleExportPotentialClientsCSV}
                        disabled={exporting}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-teal-500/20"
                    >
                        <Download className="w-4 h-4" />
                        <span>{exporting ? 'Exportando...' : 'Exportar Clientes Potenciales'}</span>
                    </button>
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
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Fuente</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Call Confirmer</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest">Closer</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest text-center">Estado</th>
                                        <th className="py-4 px-4 text-[10px] font-black text-muted uppercase tracking-widest text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-base/50">
                                    {agendas.map((agenda) => (
                                        <tr key={agenda.id} className={`group hover:bg-white/5 transition-colors ${agenda.has_sale ? 'bg-emerald-500/[0.02]' : ''}`}>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-2">
                                                    <CalendarIcon size={14} className="text-muted" />
                                                    <span className="text-xs font-bold text-slate-400">
                                                        {formatDateOnly(agenda.registro)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-2">
                                                    <CalendarIcon size={14} className="text-primary/70" />
                                                    <input 
                                                        type="datetime-local" 
                                                        value={formatToDatetimeLocal(agenda.date || agenda.fecha_meet)}
                                                        onChange={async (e) => {
                                                            const newVal = e.target.value;
                                                            if (!newVal) return;
                                                            try {
                                                                const response = await api.put(`/public/financial-agendas/${agenda.id}`, {
                                                                    date: newVal,
                                                                    fecha_meet: newVal
                                                                });
                                                                const updated = response.data.agenda;
                                                                setAgendas(prev => prev.map(a => a.id === updated.id ? updated : a));
                                                            } catch (err) {
                                                                console.error("Error updating agenda date in-line:", err);
                                                                alert("Error al actualizar la fecha de la agenda");
                                                            }
                                                        }}
                                                        className="bg-transparent border-none text-xs font-bold text-slate-200 focus:outline-none focus:ring-0 cursor-pointer p-0 w-36 hover:text-primary transition-colors"
                                                    />
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex flex-col gap-1 text-left">
                                                    <div className="flex items-center gap-2 flex-wrap">
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
                                                        {agenda.has_sale && (
                                                            <Badge variant="success" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] py-0.5 px-1.5 font-bold shrink-0">
                                                                ✓ {agenda.sales_count} {agenda.sales_count === 1 ? 'cierre' : 'cierres'}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-400 font-medium">
                                                        {agenda.instagram && agenda.instagram !== 'N/A' && (
                                                            <div className="flex items-center gap-1">
                                                                <a 
                                                                    href={`https://instagram.com/${agenda.instagram.replace('@', '')}`} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="text-primary hover:underline flex items-center gap-0.5"
                                                                >
                                                                    <Instagram size={10} />
                                                                    {agenda.instagram.startsWith('@') ? agenda.instagram : `@${agenda.instagram}`}
                                                                </a>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigator.clipboard.writeText(agenda.instagram.startsWith('@') ? agenda.instagram : `@${agenda.instagram}`);
                                                                    }}
                                                                    className="text-muted hover:text-primary transition-colors p-0.5"
                                                                    title="Copiar usuario"
                                                                >
                                                                    <Copy size={10} />
                                                                </button>
                                                            </div>
                                                        )}
                                                        {agenda.whatsapp && agenda.whatsapp !== 'N/A' && (
                                                            <span className="flex items-center gap-0.5 text-slate-400">
                                                                <Phone size={10} className="text-emerald-500" />
                                                                {agenda.whatsapp}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <Badge variant="indigo" className="rounded-lg px-2 py-0.5 text-[10px] uppercase font-black tracking-wider">
                                                    {agenda.nombre}
                                                </Badge>
                                            </td>
                                            <td className="py-4 px-4">
                                                <select
                                                    value={agenda.encargado_triage || ''}
                                                    onChange={async (e) => {
                                                        const nuevoTriage = e.target.value;
                                                        try {
                                                            const response = await api.put(`/public/financial-agendas/${agenda.id}`, { encargado_triage: nuevoTriage });
                                                            const updated = response.data.agenda;
                                                            setAgendas(prev => prev.map(a => a.id === updated.id ? updated : a));
                                                        } catch (err) {
                                                            console.error("Error updating agenda triage in-line:", err);
                                                            alert("Error al actualizar el encargado de triage");
                                                        }
                                                    }}
                                                    className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wider border cursor-pointer outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all text-left bg-slate-950 text-slate-350 border-slate-800 hover:bg-slate-900/60
                                                        ${agenda.encargado_triage ? 'bg-slate-900 text-slate-200 border-slate-800' : 'bg-slate-950/20 text-slate-500 border-dashed border-slate-850'}
                                                    `}
                                                >
                                                    <option value="" className="bg-slate-900 text-slate-500 font-semibold">Sin Asignar</option>
                                                    {uniqueTriage.map(tg => (
                                                        <option key={tg} value={tg} className="bg-slate-900 text-white font-semibold">{tg}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-4 px-4">
                                                <select
                                                    value={agenda.closer || ''}
                                                    onChange={async (e) => {
                                                        const nuevoCloser = e.target.value;
                                                        try {
                                                            const response = await api.put(`/public/financial-agendas/${agenda.id}`, { closer: nuevoCloser });
                                                            const updated = response.data.agenda;
                                                            setAgendas(prev => prev.map(a => a.id === updated.id ? updated : a));
                                                        } catch (err) {
                                                            console.error("Error updating agenda closer in-line:", err);
                                                            alert("Error al actualizar el closer");
                                                        }
                                                    }}
                                                    className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wider border cursor-pointer outline-none focus:ring-1 focus:ring-amber-500/50 transition-all text-left bg-slate-950 text-slate-350 border-slate-800 hover:bg-slate-900/60
                                                        ${agenda.closer && agenda.closer !== 'Sin asignar' ? 'bg-amber-950/40 text-amber-300 border-amber-500/30' : 'bg-slate-950/20 text-slate-500 border-dashed border-slate-850'}
                                                    `}
                                                >
                                                    <option value="Sin asignar" className="bg-slate-900 text-slate-500 font-semibold">Sin Asignar</option>
                                                    {uniqueClosers.map(cl => (
                                                        <option key={cl} value={cl} className="bg-slate-900 text-white font-semibold">{cl}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                {(() => {
                                                    const isConfirmer = user?.role === 'triage' || user?.role === 'setter';
                                                    const selectValue = isConfirmer ? (agenda.estado || 'Pendiente') : (agenda.closer_result || 'Pendiente');
                                                    const selectOptions = isConfirmer 
                                                        ? ['Pendiente', 'Contactado', 'Confirmado', 'Sin respuesta', 'Reagendada', 'Cancelada']
                                                        : ['Pendiente', 'Show Up', 'No Show', '2TH Call', 'Reagendada', 'Cancelada', 'Cerrada'];
                                                    
                                                    return (
                                                        <select
                                                            value={selectValue}
                                                            onChange={async (e) => {
                                                                const nuevoEstado = e.target.value;
                                                                const isSpecial = isConfirmer 
                                                                    ? ['Cancelada', 'Reagendada'].includes(nuevoEstado)
                                                                    : ['Cancelada', 'Reagendada', '2TH Call'].includes(nuevoEstado);
                                                                    
                                                                if (isSpecial) {
                                                                    setStatusActionModal({
                                                                        isOpen: true,
                                                                        agenda: agenda,
                                                                        nuevoEstado: nuevoEstado,
                                                                        isConfirmer: isConfirmer,
                                                                        requiresDate: ['Reagendada', '2TH Call'].includes(nuevoEstado),
                                                                        razon: '',
                                                                        fechaHora: ''
                                                                    });
                                                                    return;
                                                                }
                                                                
                                                                const payload = isConfirmer ? { estado: nuevoEstado } : { closer_result: nuevoEstado };
                                                                try {
                                                                    const response = await api.put(`/public/financial-agendas/${agenda.id}`, payload);
                                                                    const updated = response.data.agenda;
                                                                    setAgendas(prev => prev.map(a => a.id === updated.id ? updated : a));
                                                                } catch (err) {
                                                                    console.error("Error updating agenda status in-line:", err);
                                                                    alert("Error al actualizar el estado de la agenda");
                                                                }
                                                            }}
                                                            className={`rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border cursor-pointer outline-none focus:ring-1 focus:ring-primary/50 transition-all text-center border-box
                                                                ${selectValue === 'Show Up' || selectValue === 'Show up' ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20' : ''}
                                                                ${selectValue === 'Contactado' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20' : ''}
                                                                ${selectValue === 'Confirmado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : ''}
                                                                ${selectValue === 'No Show' || selectValue === 'No show' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' : ''}
                                                                ${selectValue === 'Reagendada' || selectValue === 'Reagendado' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' : ''}
                                                                ${selectValue === 'Cerrada' || selectValue === 'Cerrado' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20' : ''}
                                                                ${selectValue === 'Cancelada' || selectValue === 'Cancelado' ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' : ''}
                                                                ${selectValue === 'Sin respuesta' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20 hover:bg-pink-500/20' : ''}
                                                                ${selectValue === '2TH Call' || selectValue === '2da call' ? 'bg-blue-500/10 text-blue-450 border-blue-500/20 hover:bg-blue-500/20' : ''}
                                                                ${selectValue === 'Pendiente' ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' : ''}
                                                            `}
                                                        >
                                                            {selectOptions.map(st => (
                                                                <option key={st} value={st} className="bg-slate-900 text-white font-semibold">
                                                                    {st}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    );
                                                })()}
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
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Meet</label>
                                        <input 
                                            type="datetime-local"
                                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 text-sm font-semibold cursor-pointer"
                                            value={formatToDatetimeLocal(editForm.fecha_meet)}
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
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp / Teléfono</label>
                                        <input 
                                            type="text"
                                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 outline-none focus:border-indigo-500 text-sm font-semibold"
                                            value={editForm.whatsapp}
                                            onChange={e => setEditForm({...editForm, whatsapp: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Closer</label>
                                        <select 
                                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 text-sm font-semibold cursor-pointer"
                                            value={editForm.closer}
                                            onChange={e => setEditForm({...editForm, closer: e.target.value})}
                                            required
                                        >
                                            <option value="Sin asignar" className="bg-slate-900 text-slate-500">Sin Asignar</option>
                                            {uniqueClosers.map(cl => (
                                                <option key={cl} value={cl} className="bg-slate-900 text-white">{cl}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</label>
                                        <select 
                                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 text-sm font-semibold cursor-pointer"
                                            value={editForm.estado}
                                            onChange={e => setEditForm({...editForm, estado: e.target.value})}
                                            required
                                        >
                                            {['Pendiente', 'Contactado', 'Confirmado', 'Show Up', 'No Show', 'Reagendada', 'Cancelada', 'Cerrada'].map(st => (
                                                <option key={st} value={st} className="bg-slate-900 text-white">{st}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Call Confirmer</label>
                                        <select 
                                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 text-sm font-semibold cursor-pointer"
                                            value={editForm.encargado_triage || ''}
                                            onChange={e => setEditForm({...editForm, encargado_triage: e.target.value})}
                                        >
                                            <option value="" className="bg-slate-900 text-slate-500">Sin Asignar</option>
                                            {uniqueTriage.map(tg => (
                                                <option key={tg} value={tg} className="bg-slate-900 text-white">{tg}</option>
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

            {statusActionModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-800/60 flex justify-between items-center bg-slate-950/20 shrink-0">
                            <h3 className="text-sm font-black uppercase tracking-widest text-white italic">
                                Confirmar {statusActionModal.nuevoEstado}
                            </h3>
                            <button 
                                onClick={() => setStatusActionModal(prev => ({ ...prev, isOpen: false }))}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleStatusActionSubmit} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                            <div className="p-6 space-y-5 flex-1">
                                <div className="space-y-1 text-left">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Cliente</p>
                                    <p className="text-sm font-black text-white">{statusActionModal.agenda?.lead}</p>
                                </div>

                                {statusActionModal.requiresDate && (
                                    <div className="space-y-1.5 text-left">
                                        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1 flex items-center gap-1.5 animate-pulse">
                                            <CalendarIcon size={10} />
                                            Fecha y Hora de Reprogramación (Click para abrir)
                                        </label>
                                        <div className="relative group">
                                            <input 
                                                type="datetime-local"
                                                className="w-full pl-4 pr-12 py-3.5 bg-indigo-950/20 border border-indigo-500/40 rounded-xl text-white outline-none focus:border-indigo-500 text-xs font-black cursor-pointer transition-all hover:bg-indigo-950/30 hover:border-indigo-500/60"
                                                value={statusActionModal.fechaHora}
                                                onChange={e => setStatusActionModal(prev => ({ ...prev, fechaHora: e.target.value }))}
                                                required
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none group-hover:text-indigo-300 transition-colors">
                                                <CalendarIcon size={18} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5 text-left">
                                    <label className="text-[9px] font-black text-slate-455 uppercase tracking-widest ml-1">Razón del cambio (Obligatoria)</label>
                                    <textarea 
                                        placeholder="Ingresa detalladamente por qué se está realizando este cambio..."
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 text-xs font-semibold resize-none h-28"
                                        value={statusActionModal.razon}
                                        onChange={e => setStatusActionModal(prev => ({ ...prev, razon: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="p-5 border-t border-slate-800/60 bg-slate-950/20 flex gap-3 shrink-0">
                                <button 
                                    type="button"
                                    onClick={() => setStatusActionModal(prev => ({ ...prev, isOpen: false }))}
                                    className="flex-1 py-3 bg-slate-800 border border-slate-700 text-xs font-black uppercase tracking-widest text-slate-450 rounded-xl hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-3 bg-indigo-600 text-xs font-black uppercase tracking-widest text-white rounded-xl hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/30"
                                >
                                    Confirmar
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
