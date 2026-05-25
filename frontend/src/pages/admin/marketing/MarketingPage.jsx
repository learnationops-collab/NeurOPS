import { useState, useEffect } from 'react';
import api from '../../../services/api';
import {
    Megaphone,
    Layers,
    Image,
    Search,
    TrendingUp,
    Activity,
    Plus,
    X,
    Trash2,
    Edit2,
    Save,
    BarChart2,
    DollarSign,
    Users,
    Calendar,
    ShoppingBag,
    ArrowUpDown,
    ChevronUp,
    ChevronDown
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Input from '../../../components/ui/Input';
import { AnimatePresence, motion } from 'framer-motion';
import usePersistentFilters from '../../../hooks/usePersistentFilters';

const MarketingPage = () => {
    const { filters: tabFilters, updateFilter: setTabFilters } = usePersistentFilters('marketing_active_tab', {

        active: 'campaigns'
    });
    const activeTab = tabFilters.active;
    const setActiveTab = (val) => setTabFilters({ active: val });

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    const { filters: searchFilters, updateFilter: setSearchFilters } = usePersistentFilters('marketing_search_filters', {
        general: '',
        performance: ''
    });
    const search = searchFilters.general;
    const setSearch = (val) => setSearchFilters({ general: val });
    const perfSearch = searchFilters.performance;
    const setPerfSearch = (val) => setSearchFilters({ performance: val });

    // CRUD State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
    const [selectedItem, setSelectedItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Dynamic Options for Relationships
    const [campaignsList, setCampaignsList] = useState([]);
    const [adSetsList, setAdSetsList] = useState([]);

    // Estado de rendimiento persistente
    const [performanceData, setPerformanceData] = useState([]);
    const [perfLoading, setPerfLoading] = useState(false);
    
    // Sorting state
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const getSortedPerformanceData = () => {
        let sortableData = [...performanceData];
        if (sortConfig.key) {
            sortableData.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];
                
                if (aValue == null) aValue = '';
                if (bValue == null) bValue = '';
                
                if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableData;
    };
    
    const { filters: perfFilters, updateFilter: setPerfFilters } = usePersistentFilters('filters_marketing_perf', {
        period: 'last_month',
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    const perfPeriod = perfFilters.period;
    const setPerfPeriod = (val) => setPerfFilters({ period: val });
    const startDate = perfFilters.start;
    const endDate = perfFilters.end;
    const setCustomDates = (val) => setPerfFilters({ start: val.start, end: val.end });



    const tabs = [
        { id: 'campaigns', label: 'Campañas', icon: Megaphone, endpoint: '/marketing/campaigns' },
        { id: 'ad-sets', label: 'AdSets', icon: Layers, endpoint: '/marketing/ad-sets' },
        { id: 'ads', label: 'Ads', icon: Image, endpoint: '/marketing/ads' },
        { id: 'performance', label: 'Rendimiento', icon: BarChart2, endpoint: null },
    ];

    useEffect(() => {
        if (activeTab !== 'performance') {
            fetchData();
        } else {
            fetchPerformance();
        }
    }, [activeTab, perfPeriod, startDate, endDate]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const tab = tabs.find(t => t.id === activeTab);
            if (!tab?.endpoint) return;
            const res = await api.get(tab.endpoint);
            setData(res.data);
        } catch (err) {
            console.error("Error fetching marketing data:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchPerformance = async () => {
        try {
            setPerfLoading(true);
            const params = { period: perfPeriod };
            if (perfPeriod === 'custom') {
                params.start_date = startDate;
                params.end_date = endDate;
            }
            const res = await api.get('/marketing/ads/performance', { params });
            setPerformanceData(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Error fetching ad performance:", err);
        } finally {
            setPerfLoading(false);
        }
    };

    const fetchCampaignsList = async () => {
        try {
            const res = await api.get('/marketing/campaigns');
            setCampaignsList(res.data || []);
        } catch (e) { console.error(e); }
    };

    const fetchAdSetsList = async () => {
        try {
            const res = await api.get('/marketing/ad-sets');
            setAdSetsList(res.data || []);
        } catch (e) { console.error(e); }
    };

    const handleOpenModal = (item = null, tabOverride = null) => {
        const targetTab = tabOverride || activeTab;

        if (tabOverride && tabOverride !== activeTab) {
            setActiveTab(tabOverride);
        }

        // Fetch needed lists for selectors
        if (targetTab === 'ad-sets') fetchCampaignsList();
        if (targetTab === 'ads') {
            fetchCampaignsList();
            fetchAdSetsList();
        }

        if (item) {
            setModalMode('edit');
            setSelectedItem(item);
            setFormData({ ...item });
        } else {
            setModalMode('create');
            setSelectedItem(null);
            setFormData({});
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedItem(null);
        setFormData({});
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const tab = tabs.find(t => t.id === activeTab);

            if (modalMode === 'create') {
                await api.post(tab.endpoint, formData);
            } else {
                await api.put(`${tab.endpoint}/${selectedItem.id}`, formData);
            }

            fetchData();
            handleCloseModal();
        } catch (err) {
            console.error("Error saving record:", err);
            alert("Error al guardar los datos. Revisa la consola.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.")) return;

        try {
            const tab = tabs.find(t => t.id === activeTab);
            await api.delete(`${tab.endpoint}/${id}`);
            fetchData();
        } catch (err) {
            console.error("Error deleting record:", err);
            alert("Error al eliminar. Es posible que tenga dependencias activas.");
        }
    };

    const renderHeader = () => {
        if (activeTab === 'campaigns') {
            return (
                <>
                    <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest text-left">ID</th>
                    <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest text-left">Campaña</th>
                    <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest text-left">Tipo / Tráfico</th>
                    <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest text-left">Funnel / Objetivo</th>
                    <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest text-left text-right">Acciones</th>
                </>
            );
        }
        if (activeTab === 'ad-sets') {
            return (
                <>
                    <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest text-left">ID</th>
                    <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest text-left">Conjunto de Anuncios</th>
                    <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest text-left">Evento Conversión</th>
                    <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest text-left text-right">Acciones</th>
                </>
            );
        }
        return (
            <>
                <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest text-left">ID</th>
                <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest text-left">Anuncio</th>
                <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest text-left">Keyword</th>
                <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest text-left text-right">Acciones</th>
            </>
        );
    };

    const renderRow = (item) => {
        const commonActions = (
            <td className="px-8 py-5 text-right">
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => handleOpenModal(item)}
                        className="p-2 hover:bg-white/10 rounded-lg text-muted hover:text-white transition-colors"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 hover:bg-rose-500/10 rounded-lg text-muted hover:text-rose-500 transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </td>
        );

        if (activeTab === 'campaigns') {
            return (
                <>
                    <td className="px-8 py-5 text-primary font-black">#{item.id}</td>
                    <td className="px-8 py-5">
                        <p className="font-bold text-white tracking-tight">{item.name}</p>
                    </td>
                    <td className="px-8 py-5">
                        <Badge variant={item.type === 'pago' ? 'indigo' : 'neutral'} className="mr-2 uppercase text-[9px]">{item.type || 'N/A'}</Badge>
                        <span className="text-xs text-muted font-bold">{item.traffic || 'N/A'}</span>
                    </td>
                    <td className="px-8 py-5">
                        <p className="text-xs text-white font-bold">{item.funnel_type || 'N/A'}</p>
                        <p className="text-[9px] text-primary font-black uppercase tracking-widest">{item.objective || 'N/A'}</p>
                    </td>
                    {commonActions}
                </>
            );
        }
        if (activeTab === 'ad-sets') {
            return (
                <>
                    <td className="px-8 py-5 text-primary font-black">#{item.id}</td>
                    <td className="px-8 py-5 font-bold text-white tracking-tight">{item.name}</td>
                    <td className="px-8 py-5">
                        <Badge variant="indigo" className="text-[9px] uppercase">{item.conversion_event || 'N/A'}</Badge>
                    </td>
                    {commonActions}
                </>
            );
        }
        return (
            <>
                <td className="px-8 py-5 text-primary font-black">#{item.id}</td>
                <td className="px-8 py-5 font-bold text-white tracking-tight">{item.name}</td>
                <td className="px-8 py-5">
                    <p className="text-xs text-primary font-black uppercase">#{item.keyword || 'S/K'}</p>
                </td>
                {commonActions}
            </>
        );
    };

    // Totales para la tab de rendimiento
    const perfTotals = performanceData.reduce((acc, row) => ({
        leads: acc.leads + (row.leads || 0),
        agendas: acc.agendas + (row.agendas || 0),
        ventas: acc.ventas + (row.ventas || 0),
        spend: acc.spend + (row.spend || 0),
        cash_collect: acc.cash_collect + (row.cash_collect || 0)
    }), { leads: 0, agendas: 0, ventas: 0, spend: 0, cash_collect: 0 });

    return (
        <div className="p-8 max-w-[98%] mx-auto space-y-8 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-white italic tracking-tighter">Marketing Intelligence</h1>
                    <p className="text-muted font-medium uppercase text-xs tracking-[0.2em]">Gestión de pauta y rendimiento publicitario</p>
                </div>
                {activeTab !== 'performance' && (
                    <div className="flex flex-wrap gap-3">
                        <Button
                            variant="primary"
                            size="sm"
                            icon={Megaphone}
                            className="bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                            onClick={() => handleOpenModal(null, 'campaigns')}
                        >
                            Nueva Campaña
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            icon={Layers}
                            className="bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20"
                            onClick={() => handleOpenModal(null, 'ad-sets')}
                        >
                            Nuevo AdSet
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            icon={Plus}
                            className="bg-primary hover:bg-primary-hover shadow-primary/20"
                            onClick={() => handleOpenModal(null, 'ads')}
                        >
                            Nuevo Anuncio
                        </Button>
                    </div>
                )}
            </header>

            {/* 1. Pestañas */}
            <div className="flex gap-2 p-1 bg-surface border border-base rounded-2xl">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            activeTab === tab.id 
                                ? tab.id === 'performance' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20' : 'bg-primary text-white shadow-lg shadow-primary/20'
                                : 'text-muted hover:text-white'
                        }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Vista Rendimiento por Anuncio */}
            {activeTab === 'performance' && (
                <>
                    {/* 2. Tarjetas de resumen (KPIs) */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-5 animate-in slide-in-from-top-4 duration-500">
                        <Card variant="glass" className="p-5 border-l-4 border-l-violet-500">
                            <div className="flex items-center gap-3 mb-2">
                                <Users className="text-violet-400" size={18} />
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest">Total Leads</p>
                            </div>
                            <h3 className="text-3xl font-black text-white">{perfTotals.leads.toLocaleString()}</h3>
                        </Card>
                        <Card variant="glass" className="p-5 border-l-4 border-l-sky-500">
                            <div className="flex items-center gap-3 mb-2">
                                <Calendar className="text-sky-400" size={18} />
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest">Total Agendas</p>
                            </div>
                            <h3 className="text-3xl font-black text-white">{perfTotals.agendas.toLocaleString()}</h3>
                        </Card>
                        <Card variant="glass" className="p-5 border-l-4 border-l-emerald-400">
                            <div className="flex items-center gap-3 mb-2">
                                <ShoppingBag className="text-emerald-300" size={18} />
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest">Total Ventas</p>
                            </div>
                            <h3 className="text-3xl font-black text-white">{perfTotals.ventas.toLocaleString()}</h3>
                        </Card>
                        <Card variant="glass" className="p-5 border-l-4 border-l-emerald-500">
                            <div className="flex items-center gap-3 mb-2">
                                <DollarSign className="text-emerald-400" size={18} />
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest">Cash Collect</p>
                            </div>
                            <h3 className="text-3xl font-black text-white">${perfTotals.cash_collect.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                        </Card>
                        <Card variant="glass" className="p-5 border-l-4 border-l-amber-500">
                            <div className="flex items-center gap-3 mb-2">
                                <DollarSign className="text-amber-400" size={18} />
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest">Inversión Total</p>
                            </div>
                            <h3 className="text-3xl font-black text-white">${perfTotals.spend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
                        </Card>
                    </div>

                    {/* 3. Filtros (Debajo de las tarjetas) */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-surface/50 p-6 rounded-[2.5rem] border border-base shadow-xl">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-1.5 p-1.5 bg-black/20 border border-base/30 rounded-2xl">
                                {[
                                    { id: 'last_month', label: 'Mes' },
                                    { id: 'last_week',  label: 'Semana' },
                                    { id: 'yesterday',  label: 'Ayer' },
                                    { id: 'custom',     label: 'Personalizado' },
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setPerfPeriod(opt.id)}
                                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                            perfPeriod === opt.id
                                                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/40'
                                                : 'text-muted hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {perfPeriod === 'custom' && (
                                <div className="flex items-center gap-2 animate-in zoom-in-95 duration-300">
                                    <input 
                                        type="date"
                                        value={startDate}
                                        onChange={e => setCustomDates({start: e.target.value, end: endDate})}
                                        className="bg-black/20 border border-base/30 rounded-xl px-4 py-2.5 text-[10px] font-black text-white outline-none focus:border-violet-500 transition-all cursor-pointer"
                                    />
                                    <span className="text-muted font-black text-[10px] uppercase">a</span>
                                    <input 
                                        type="date"
                                        value={endDate}
                                        onChange={e => setCustomDates({start: startDate, end: e.target.value})}
                                        className="bg-black/20 border border-base/30 rounded-xl px-4 py-2.5 text-[10px] font-black text-white outline-none focus:border-violet-500 transition-all cursor-pointer"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="relative group w-full md:w-96">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-violet-400 transition-colors" size={16} />
                            <input 
                                placeholder="Buscar por nombre de anuncio..."
                                value={perfSearch}
                                onChange={e => setPerfSearch(e.target.value)}
                                className="w-full bg-black/20 border border-base/30 rounded-[1.5rem] pl-12 pr-6 py-4 text-[11px] font-bold text-white outline-none focus:border-violet-500 transition-all placeholder:text-muted/30 shadow-inner"
                            />
                        </div>
                    </div>

                    {/* Tabla de rendimiento */}
                    <Card variant="surface" padding="p-0 overflow-hidden" className="border-base">
                        {perfLoading ? (
                            <div className="p-32 flex flex-col items-center gap-4">
                                <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest">Calculando rendimiento...</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto min-h-[300px]">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-base bg-base/50">
                                            {[
                                                { key: 'ad_name', label: 'Anuncio', align: 'text-left' },
                                                { key: 'spend', label: 'Inversión', align: 'text-right' },
                                                { key: 'leads', label: 'Leads', align: 'text-center' },
                                                { key: 'cpl', label: 'CPL', align: 'text-center' },
                                                { key: 'agendas', label: 'Agendas', align: 'text-center' },
                                                { key: 'cpa', label: 'CP Agenda', align: 'text-center' },
                                                { key: 'ventas', label: 'Ventas', align: 'text-center' },
                                                { key: 'cpv', label: 'CP Venta', align: 'text-center' },
                                                { key: 'cash_collect', label: 'Cash Collect', align: 'text-right' },
                                                { key: 'roas', label: 'ROAS', align: 'text-center' },
                                            ].map((col) => (
                                                <th 
                                                    key={col.key}
                                                    onClick={() => handleSort(col.key)}
                                                    className={`px-6 py-5 text-[10px] font-black text-muted uppercase tracking-widest cursor-pointer hover:text-white transition-colors group/th ${col.align}`}
                                                >
                                                    <div className={`flex items-center gap-1.5 ${
                                                        col.align === 'text-right' ? 'justify-end' :
                                                        col.align === 'text-center' ? 'justify-center' : 'justify-start'
                                                    }`}>
                                                        {col.label}
                                                        {sortConfig.key === col.key ? (
                                                            sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-violet-400" /> : <ChevronDown size={12} className="text-violet-400" />
                                                        ) : (
                                                            <ArrowUpDown size={12} className="opacity-30 group-hover/th:opacity-100 transition-opacity" />
                                                        )}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-base">
                                        {getSortedPerformanceData().filter(row => row.ad_name.toLowerCase().includes(perfSearch.toLowerCase())).length > 0 && (
                                            <tr className="bg-violet-950/40 border-b-2 border-violet-900/30 font-black relative z-10">
                                                <td className="px-6 py-5">
                                                    <p className="font-black text-violet-400 text-sm uppercase tracking-widest">TOTAL GENERAL</p>
                                                    <p className="text-[10px] text-muted font-bold uppercase">Consolidado</p>
                                                </td>
                                                <td className="px-6 py-5 text-right font-mono">
                                                    <span className="font-black text-amber-400 text-sm">
                                                        ${perfTotals.spend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-center font-mono">
                                                    <span className="font-black text-violet-300 text-base">{perfTotals.leads}</span>
                                                </td>
                                                <td className="px-6 py-5 text-center font-mono">
                                                    <span className="font-black text-sm text-violet-400">
                                                        {perfTotals.leads > 0 ? `$${(perfTotals.spend / perfTotals.leads).toFixed(2)}` : '—'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-center font-mono">
                                                    <span className="font-black text-sky-300 text-base">{perfTotals.agendas}</span>
                                                </td>
                                                <td className="px-6 py-5 text-center font-mono">
                                                    <span className="font-black text-sm text-sky-400">
                                                        {perfTotals.agendas > 0 ? `$${(perfTotals.spend / perfTotals.agendas).toFixed(2)}` : '—'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-center font-mono">
                                                    <span className="font-black text-emerald-300 text-base">{perfTotals.ventas}</span>
                                                </td>
                                                <td className="px-6 py-5 text-center font-mono">
                                                    <span className="font-black text-sm text-emerald-400">
                                                        {perfTotals.ventas > 0 ? `$${(perfTotals.spend / perfTotals.ventas).toFixed(2)}` : '—'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-right bg-emerald-500/5 font-mono">
                                                    <span className="font-black text-emerald-400 text-sm">
                                                        ${perfTotals.cash_collect.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-center font-mono">
                                                    <span className="font-black text-sm text-indigo-400">
                                                        {perfTotals.spend > 0 ? `${(perfTotals.cash_collect / perfTotals.spend).toFixed(2)}x` : '—'}
                                                    </span>
                                                </td>
                                            </tr>
                                        )}
                                        {getSortedPerformanceData().filter(row => row.ad_name.toLowerCase().includes(perfSearch.toLowerCase())).length > 0 ? (
                                            getSortedPerformanceData()
                                                .filter(row => row.ad_name.toLowerCase().includes(perfSearch.toLowerCase()))
                                                .map(row => (
                                                <tr key={row.ad_id} className="hover:bg-violet-500/5 transition-all group">
                                                    <td className="px-6 py-5">
                                                        <p className="font-bold text-white text-sm">{row.ad_name}</p>
                                                        <p className="text-[10px] text-muted font-bold uppercase">{row.adset_name || '—'} · {row.campaign_name || '—'}</p>
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <span className="font-black text-amber-400">
                                                            ${row.spend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className="font-black text-violet-300 text-lg">{row.leads}</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className={`font-black text-sm ${
                                                            row.cpl === 0 ? 'text-muted' :
                                                            row.cpl < 20 ? 'text-emerald-400' :
                                                            row.cpl < 50 ? 'text-amber-400' : 'text-rose-400'
                                                        }`}>
                                                            {row.cpl > 0 ? `$${row.cpl}` : '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className="font-black text-sky-300 text-lg">{row.agendas}</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className={`font-black text-sm ${
                                                            row.cpa === 0 ? 'text-muted' :
                                                            row.cpa < 100 ? 'text-emerald-400' :
                                                            row.cpa < 300 ? 'text-amber-400' : 'text-rose-400'
                                                        }`}>
                                                            {row.cpa > 0 ? `$${row.cpa}` : '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className="font-black text-emerald-300 text-lg">{row.ventas}</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className={`font-black text-sm ${
                                                            row.cpv === 0 ? 'text-muted' :
                                                            row.cpv < 500 ? 'text-emerald-400' :
                                                            row.cpv < 1500 ? 'text-amber-400' : 'text-rose-400'
                                                        }`}>
                                                            {row.cpv > 0 ? `$${row.cpv}` : '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <span className="font-black text-emerald-400">
                                                            {row.cash_collect > 0 ? `$${row.cash_collect.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className={`font-black text-sm ${
                                                            !row.roas || row.roas === 0 ? 'text-muted' :
                                                            row.roas >= 3 ? 'text-emerald-400' :
                                                            row.roas >= 1 ? 'text-amber-400' : 'text-rose-400'
                                                        }`}>
                                                            {row.roas > 0 ? `${row.roas}x` : '—'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="10" className="p-20 text-center">
                                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest italic opacity-50">No hay datos de rendimiento disponibles</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </>
            )}

            {/* Vista CRUD normal (Campañas, AdSets, Ads) */}
            {activeTab !== 'performance' && (
                <>

                <div className="relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors" size={20} />
                    <input
                        className="w-full bg-surface border border-base rounded-3xl pl-14 pr-6 py-5 text-white text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold placeholder:text-muted/40"
                        placeholder={`Buscar en ${tabs.find(t => t.id === activeTab)?.label || 'Marketing'}...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card variant="glass" className="p-6 border-l-4 border-l-primary">
                        <div className="flex items-center justify-between mb-2">
                            <TrendingUp className="text-primary" size={20} />
                            <Badge variant="success">Activos</Badge>
                        </div>
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">Inversión Total</p>
                        <h3 className="text-2xl font-black text-white">$0.00</h3>
                    </Card>
                    <Card variant="glass" className="p-6 border-l-4 border-l-secondary">
                        <div className="flex items-center justify-between mb-2">
                            <Megaphone className="text-secondary" size={20} />
                            <Badge variant="neutral">{data.filter(i => i.status === 'active').length} Activos</Badge>
                        </div>
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">{tabs.find(t => t.id === activeTab)?.label || 'Registros'}</p>
                        <h3 className="text-2xl font-black text-white">{Array.isArray(data) ? data.length : 0} Totales</h3>
                    </Card>
                    <Card variant="glass" className="p-6 border-l-4 border-l-accent">
                        <div className="flex items-center justify-between mb-2">
                            <Activity className="text-accent" size={20} />
                            <Badge variant="indigo">En curso</Badge>
                        </div>
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">Rendimiento Promedio</p>
                        <h3 className="text-2xl font-black text-white">—</h3>
                    </Card>
                </div>

                <Card variant="surface" padding="p-0 overflow-hidden" className="border-base">
                    {loading ? (
                        <div className="p-32 flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Consultando NeurOPS...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto min-h-[400px]">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-base bg-base/50">
                                        {renderHeader()}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-base">
                                    {data.length > 0 ? (
                                        data.filter(item => item.name.toLowerCase().includes(search.toLowerCase())).map(item => (
                                            <tr key={item.id} className="hover:bg-primary/5 transition-all group cursor-default">
                                                {renderRow(item)}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="p-20 text-center">
                                                <p className="text-[10px] font-black text-muted uppercase tracking-widest italic opacity-50">No hay registros disponibles en esta sección</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </>
            )}

            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleCloseModal}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-xl bg-surface border border-base rounded-3xl shadow-2xl overflow-hidden"
                        >
                            <header className={`p-8 border-b border-base flex justify-between items-center ${activeTab === 'campaigns' ? 'bg-emerald-500/10' :
                                activeTab === 'ad-sets' ? 'bg-indigo-500/10' :
                                    'bg-primary/10'
                                }`}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl ${activeTab === 'campaigns' ? 'bg-emerald-500 text-white shadow-emerald-500/20' :
                                        activeTab === 'ad-sets' ? 'bg-indigo-500 text-white shadow-indigo-500/20' :
                                            'bg-primary text-white shadow-primary/20'
                                        } shadow-lg`}>
                                        {activeTab === 'campaigns' ? <Megaphone size={24} /> :
                                            activeTab === 'ad-sets' ? <Layers size={24} /> :
                                                <Image size={24} />}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white italic tracking-tighter">
                                            {modalMode === 'create' ?
                                                (activeTab === 'campaigns' ? 'Nueva Campaña' : activeTab === 'ad-sets' ? 'Nuevo AdSet' : 'Nuevo Anuncio') :
                                                'Editar Registro'}
                                        </h2>
                                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">
                                            Sección de Marketing • {activeTab.replace('-', ' ')}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={handleCloseModal} className="p-2 hover:bg-white/10 rounded-xl text-muted hover:text-white transition-all">
                                    <X size={20} />
                                </button>
                            </header>

                            <form onSubmit={handleSave} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Nombre"
                                        placeholder="Ej: Lanzamiento Enero"
                                        value={formData.name || ''}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        className="col-span-2"
                                    />

                                    {activeTab === 'campaigns' && (
                                        <>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 block">Tipo</label>
                                                <select
                                                    className="w-full bg-black/40 border border-base rounded-2xl py-4 px-6 text-white text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                                    value={formData.type || ''}
                                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    <option value="pago">Pago</option>
                                                    <option value="organico">Orgánico</option>
                                                </select>
                                            </div>
                                            <Input
                                                label="Tráfico"
                                                placeholder="Ej: Facebook Ads"
                                                value={formData.traffic || ''}
                                                onChange={e => setFormData({ ...formData, traffic: e.target.value })}
                                            />
                                            <Input
                                                label="Tipo de Funnel"
                                                placeholder="Ej: VSL"
                                                value={formData.funnel_type || ''}
                                                onChange={e => setFormData({ ...formData, funnel_type: e.target.value })}
                                            />
                                            <Input
                                                label="Objetivo"
                                                placeholder="Ej: Leads"
                                                value={formData.objective || ''}
                                                onChange={e => setFormData({ ...formData, objective: e.target.value })}
                                            />
                                        </>
                                    )}

                                    {activeTab === 'ad-sets' && (
                                        <>
                                            <div className="space-y-2 col-span-2">
                                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 block">Campaña Relacionada</label>
                                                <select
                                                    className="w-full bg-black/40 border border-base rounded-2xl py-4 px-6 text-white text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                                    value={formData.campaign_id || ''}
                                                    onChange={e => setFormData({ ...formData, campaign_id: parseInt(e.target.value) })}
                                                    required
                                                >
                                                    <option value="">Seleccionar Campaña...</option>
                                                    {campaignsList.map(c => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.name} (#{c.id})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <Input
                                                label="Evento de Conversión"
                                                placeholder="Ej: Lead"
                                                value={formData.conversion_event || ''}
                                                onChange={e => setFormData({ ...formData, conversion_event: e.target.value })}
                                                className="col-span-2"
                                            />
                                        </>
                                    )}

                                    {activeTab === 'ads' && (
                                        <>
                                            <div className="space-y-2 col-span-2">
                                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 block">AdSet Relacionado</label>
                                                <select
                                                    className="w-full bg-black/40 border border-base rounded-2xl py-4 px-6 text-white text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold"
                                                    value={formData.ad_set_id || ''}
                                                    onChange={e => setFormData({ ...formData, ad_set_id: parseInt(e.target.value) })}
                                                    required
                                                >
                                                    <option value="">Seleccionar AdSet...</option>
                                                    {adSetsList.map(a => (
                                                        <option key={a.id} value={a.id}>
                                                            {a.name} (#{a.id})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <Input
                                                label="Keyword"
                                                placeholder="Ej: Negocios"
                                                value={formData.keyword || ''}
                                                onChange={e => setFormData({ ...formData, keyword: e.target.value })}
                                                className="col-span-2"
                                            />
                                        </>
                                    )}


                                    <div className="col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 block">Detalles / Notas</label>
                                        <textarea
                                            className="w-full bg-black/40 border border-base rounded-2xl py-4 px-6 text-white text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all font-bold min-h-[100px]"
                                            value={formData.details || ''}
                                            onChange={e => setFormData({ ...formData, details: e.target.value })}
                                            placeholder="Notas adicionales sobre este registro..."
                                        />
                                    </div>
                                </div>

                                <footer className="pt-4 flex gap-3">
                                    <Button
                                        type="button"
                                        variant="neutral"
                                        className="flex-1"
                                        onClick={handleCloseModal}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        className="flex-1 shadow-brand-glow"
                                        disabled={isSubmitting}
                                        icon={modalMode === 'create' ? Plus : Save}
                                    >
                                        {isSubmitting ? 'Guardando...' : (modalMode === 'create' ? 'Crear' : 'Guardar Cambios')}
                                    </Button>
                                </footer>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MarketingPage;
