import React, { useState, useEffect, useMemo } from 'react';
import api from '../../../services/api';
import { 
    Loader2, 
    Search, 
    Calendar, 
    TrendingUp, 
    CalendarDays, 
    Instagram, 
    MessageSquare, 
    DollarSign, 
    User, 
    ArrowUpRight, 
    Link, 
    X, 
    Info, 
    Phone, 
    RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

// Componente de Badge de Atribucion
const AttributedBadge = ({ label, type }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider
        ${type === 'sale' 
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
        }`}
    >
        <span className={`w-1.5 h-1.5 rounded-full ${type === 'sale' ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
        {label}
    </span>
);

const UnattributedLeadsPage = () => {
    // Rango de fechas por defecto: ultimos 30 dias
    const getPastDateStr = (days) => {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString().split('T')[0];
    };
    
    const getTodayStr = () => new Date().toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(getPastDateStr(30));
    const [endDate, setEndDate] = useState(getTodayStr());
    const [leadType, setLeadType] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({ summary: { unattributed_sales: 0, unattributed_agendas: 0, total_unattributed: 0 }, sales: [], agendas: [] });
    const [activeTab, setActiveTab] = useState('sales');

    // Listado de anuncios para modal
    const [ads, setAds] = useState([]);
    const [loadingAds, setLoadingAds] = useState(false);

    // Modal State
    const [attributionModal, setAttributionModal] = useState(null); // { lead, type: 'sale' | 'agenda' }
    const [targetInstagram, setTargetInstagram] = useState('');
    const [selectedAdId, setSelectedAdId] = useState(null);
    const [adSearchQuery, setAdSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch data principal
    const fetchUnattributedLeads = async () => {
        setLoading(true);
        try {
            const response = await api.get('/public/marketing/unattributed-leads', {
                params: {
                    start_date: startDate,
                    end_date: endDate,
                    type: leadType,
                    search: searchQuery
                }
            });
            setData(response.data);
            
            // Auto-ajustar tab si viene filtrado
            if (leadType === 'sales') setActiveTab('sales');
            else if (leadType === 'agendas') setActiveTab('agendas');
        } catch (error) {
            console.error('Error al cargar leads sin atribucion:', error);
            toast.error('Error al obtener el listado de leads.');
        } finally {
            setLoading(false);
        }
    };

    // Cargar anuncios para el buscador del modal
    const fetchAds = async () => {
        setLoadingAds(true);
        try {
            const response = await api.get('/public/ads');
            setAds(response.data);
        } catch (error) {
            console.error('Error al cargar anuncios:', error);
            toast.error('No se pudieron cargar los anuncios.');
        } finally {
            setLoadingAds(false);
        }
    };

    useEffect(() => {
        fetchUnattributedLeads();
    }, [startDate, endDate, leadType]);

    useEffect(() => {
        fetchAds();
    }, []);

    // Filtrado local de anuncios por busqueda en modal
    const filteredAds = useMemo(() => {
        if (!adSearchQuery.trim()) return ads.slice(0, 15); // Top 15 si no busca
        const query = adSearchQuery.toLowerCase();
        return ads.filter(ad => 
            (ad.name && ad.name.toLowerCase().includes(query)) || 
            (ad.keyword && ad.keyword.toLowerCase().includes(query)) ||
            (ad.campaign_name && ad.campaign_name.toLowerCase().includes(query))
        );
    }, [ads, adSearchQuery]);

    // Handler para abrir modal de atribucion
    const handleOpenModal = (lead, type) => {
        setAttributionModal({ lead, type });
        setTargetInstagram(lead.instagram && lead.instagram !== 'N/A' ? lead.instagram : '');
        setSelectedAdId(null);
        setAdSearchQuery('');
    };

    // Submit del modal de atribucion
    const handleAttribute = async (e) => {
        e.preventDefault();
        if (!selectedAdId) {
            toast.error('Debes seleccionar un anuncio.');
            return;
        }
        if (!targetInstagram.trim()) {
            toast.error('Ingresa una cuenta de Instagram valida para el lead.');
            return;
        }

        setIsSubmitting(true);
        const toastId = toast.loading('Guardando atribucion manual...');
        try {
            if (attributionModal.type === 'sale') {
                await api.post('/public/marketing/manual-attribution', {
                    sale_id: attributionModal.lead.id,
                    ad_id: selectedAdId,
                    instagram: targetInstagram
                });
            } else {
                await api.post('/public/marketing/manual-attribution-agenda', {
                    agenda_id: attributionModal.lead.id,
                    ad_id: selectedAdId,
                    instagram: targetInstagram
                });
            }
            toast.success('Atribucion inyectada con exito.', { id: toastId });
            setAttributionModal(null);
            fetchUnattributedLeads(); // Refrescar lista
        } catch (error) {
            console.error('Error al guardar atribucion manual:', error);
            const errDetails = error.response?.data?.error || error.message;
            toast.error(`Error al guardar: ${errDetails}`, { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="p-8 space-y-8 min-h-screen bg-slate-950 text-slate-100 animate-in fade-in duration-500">
            
            {/* Cabecera Principal */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase flex items-center gap-2.5">
                        <Link size={28} className="text-primary rotate-45" />
                        Leads sin Anuncio
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Vincula manualmente ventas y agendas sin campaña asignada para mantener perfecto tu ROI.
                    </p>
                </div>
                
                <button
                    onClick={fetchUnattributedLeads}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-sm font-semibold transition-all shrink-0 w-fit"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin text-primary' : ''} />
                    Refrescar
                </button>
            </div>

            {/* Panel de KPIS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 p-6 rounded-2xl shadow-xl flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <DollarSign size={24} className="text-emerald-400 animate-pulse" />
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ventas sin Anuncio</span>
                        <h3 className="text-2xl font-black text-white italic tracking-tight mt-0.5">
                            {loading ? '...' : data.summary.unattributed_sales}
                        </h3>
                    </div>
                </div>

                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 p-6 rounded-2xl shadow-xl flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
                        <CalendarDays size={24} className="text-indigo-400" />
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Agendas sin Anuncio</span>
                        <h3 className="text-2xl font-black text-white italic tracking-tight mt-0.5">
                            {loading ? '...' : data.summary.unattributed_agendas}
                        </h3>
                    </div>
                </div>

                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 p-6 rounded-2xl shadow-xl flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                        <TrendingUp size={24} className="text-primary" />
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Desatribuido</span>
                        <h3 className="text-2xl font-black text-white italic tracking-tight mt-0.5">
                            {loading ? '...' : data.summary.total_unattributed}
                        </h3>
                    </div>
                </div>

            </div>

            {/* Panel de Filtros */}
            <div className="bg-slate-900/45 border border-slate-900 p-5 rounded-2xl shadow-lg space-y-4">
                <div className="flex flex-col lg:flex-row gap-4 items-end">
                    
                    {/* Filtro Rango Fechas */}
                    <div className="w-full lg:w-fit grid grid-cols-2 gap-3 shrink-0">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">Desde</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary/50"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">Hasta</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary/50"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Filtro Tipo de Lead */}
                    <div className="w-full lg:w-fit shrink-0">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">Tipo Lead</label>
                        <div className="flex p-1 bg-slate-950 border border-slate-850 rounded-xl">
                            <button
                                onClick={() => setLeadType('all')}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${leadType === 'all' ? 'bg-slate-850 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                Todos
                            </button>
                            <button
                                onClick={() => setLeadType('sales')}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${leadType === 'sales' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
                            >
                                Ventas
                            </button>
                            <button
                                onClick={() => setLeadType('agendas')}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${leadType === 'agendas' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white'}`}
                            >
                                Agendas
                            </button>
                        </div>
                    </div>

                    {/* Barra de Busqueda Inteligente */}
                    <div className="w-full relative">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">Buscar Prospecto</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Nombre de cliente, instagram, setter o closer..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchUnattributedLeads()}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary/50"
                            />
                            <Search size={14} className="absolute left-3.5 top-3.5 text-slate-500" />
                        </div>
                    </div>

                    <button
                        onClick={fetchUnattributedLeads}
                        className="px-6 py-2.5 bg-primary hover:bg-primary/95 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all w-full lg:w-fit shrink-0 shadow-lg shadow-primary/10 hover:shadow-primary/25 h-[38px] flex items-center justify-center"
                    >
                        Buscar
                    </button>

                </div>
            </div>

            {/* Pestañas Ventas / Agendas */}
            {leadType === 'all' && (
                <div className="flex gap-2 p-1 bg-slate-900 border border-slate-850 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('sales')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                            activeTab === 'sales'
                                ? 'bg-slate-950 text-white border border-slate-800 shadow-xl'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <DollarSign size={14} className="text-emerald-400" />
                        Ventas ({data.sales.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('agendas')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                            activeTab === 'agendas'
                                ? 'bg-slate-950 text-white border border-slate-800 shadow-xl'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <CalendarDays size={14} className="text-indigo-400" />
                        Agendas ({data.agendas.length})
                    </button>
                </div>
            )}

            {/* Listados de Leads */}
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-3 text-slate-400">
                        <Loader2 className="animate-spin text-primary" size={32} />
                        <span className="text-xs font-semibold tracking-wider">Cargando leads desatribuidos...</span>
                    </div>
                ) : (
                    <>
                        {/* Tab Ventas */}
                        {activeTab === 'sales' && (leadType === 'all' || leadType === 'sales') && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            <th className="p-4 pl-6">Fecha</th>
                                            <th className="p-4">Cliente</th>
                                            <th className="p-4">Instagram</th>
                                            <th className="p-4">Setter</th>
                                            <th className="p-4">Closer</th>
                                            <th className="p-4 text-right">Monto</th>
                                            <th className="p-4 pr-6 text-center">Accion</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-850">
                                        {data.sales.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-12 text-center text-xs text-slate-500 font-semibold tracking-wide">
                                                    Perfecto. No hay ventas sin anuncio en el periodo.
                                                </td>
                                            </tr>
                                                                                ) : (
                                            <>
                                                {data.sales.map((sale) => (
                                                    <tr key={sale.id} className="hover:bg-slate-850/40 transition-colors group">
                                                        <td className="p-4 pl-6 text-xs text-slate-300 font-mono">
                                                            {formatDate(sale.date)}
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="font-bold text-white text-xs">{sale.cliente}</div>
                                                        </td>
                                                        <td className="p-4 text-xs font-mono">
                                                            {sale.instagram && sale.instagram !== 'N/A' ? (
                                                                <a 
                                                                    href={`https://instagram.com/${sale.instagram.replace('@', '')}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1.5 text-primary hover:underline hover:text-primary-light"
                                                                >
                                                                    <Instagram size={12} />
                                                                    {sale.instagram}
                                                                    <ArrowUpRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                </a>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/25 text-[9px] font-black uppercase tracking-wider">
                                                                    Sin IG
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-xs">
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-950 rounded-md text-slate-300 font-medium">
                                                                <User size={10} className="text-slate-500" />
                                                                {sale.setter}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-xs">
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-950 rounded-md text-slate-300 font-medium">
                                                                <User size={10} className="text-slate-500" />
                                                                {sale.closer}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-xs text-right font-black text-emerald-400 font-mono">
                                                            ${sale.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="p-4 pr-6 text-center">
                                                            <button
                                                                onClick={() => handleOpenModal(sale, 'sale')}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 hover:border-emerald-500 text-[10px] font-black uppercase tracking-wider transition-all"
                                                            >
                                                                <Link size={11} />
                                                                Atribuir
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {/* Fila del total de ventas sin atribucion */}
                                                <tr className="bg-slate-950/70 border-t border-slate-800 text-slate-300">
                                                    <td colSpan={5} className="p-4 pl-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        Total Ventas Desatribuidas
                                                    </td>
                                                    <td className="p-4 text-xs text-right font-black text-emerald-400 font-mono bg-emerald-500/5">
                                                        ${data.sales.reduce((sum, s) => sum + (Number(s.monto) || 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="p-4 pr-6"></td>
                                                </tr>
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Tab Agendas */}
                        {activeTab === 'agendas' && (leadType === 'all' || leadType === 'agendas') && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            <th className="p-4 pl-6">Fecha Cita</th>
                                            <th className="p-4">Cliente</th>
                                            <th className="p-4">Instagram</th>
                                            <th className="p-4">Setter (Lead)</th>
                                            <th className="p-4">Closer</th>
                                            <th className="p-4">Whatsapp / Meet</th>
                                            <th className="p-4 pr-6 text-center">Accion</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-850">
                                        {data.agendas.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-12 text-center text-xs text-slate-500 font-semibold tracking-wide">
                                                    Perfecto. No hay agendas sin anuncio en el periodo.
                                                </td>
                                            </tr>
                                        ) : (
                                            data.agendas.map((agenda) => (
                                                <tr key={agenda.id} className="hover:bg-slate-850/40 transition-colors group">
                                                    <td className="p-4 pl-6 text-xs text-slate-300 font-mono">
                                                        {formatDate(agenda.date)}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-bold text-white text-xs">{agenda.cliente}</div>
                                                    </td>
                                                    <td className="p-4 text-xs font-mono">
                                                        {agenda.instagram && agenda.instagram !== 'N/A' ? (
                                                            <a 
                                                                href={`https://instagram.com/${agenda.instagram.replace('@', '')}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1.5 text-primary hover:underline hover:text-primary-light"
                                                            >
                                                                <Instagram size={12} />
                                                                {agenda.instagram}
                                                                <ArrowUpRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </a>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/25 text-[9px] font-black uppercase tracking-wider">
                                                                Sin IG
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-xs">
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-950 rounded-md text-slate-300 font-medium">
                                                            <User size={10} className="text-slate-500" />
                                                            {agenda.setter}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-xs">
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-950 rounded-md text-slate-300 font-medium">
                                                            <User size={10} className="text-slate-500" />
                                                            {agenda.closer}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-col gap-1">
                                                            {agenda.whatsapp && agenda.whatsapp !== 'N/A' ? (
                                                                <a
                                                                    href={`https://wa.me/${agenda.whatsapp.replace(/[^0-9]/g, '')}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:underline w-fit"
                                                                >
                                                                    <Phone size={10} />
                                                                    {agenda.whatsapp}
                                                                </a>
                                                            ) : null}
                                                            <span className="inline-flex items-center gap-1 text-[9px] text-slate-500 font-mono">
                                                                <Info size={10} />
                                                                {agenda.fecha_meet}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 pr-6 text-center">
                                                        <button
                                                            onClick={() => handleOpenModal(agenda, 'agenda')}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white border border-indigo-500/30 hover:border-indigo-500 text-[10px] font-black uppercase tracking-wider transition-all"
                                                        >
                                                            <Link size={11} />
                                                            Atribuir
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal de Atribucion Manual */}
            {attributionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        
                        {/* Cabecera Modal */}
                        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <AttributedBadge 
                                    label={attributionModal.type === 'sale' ? 'Venta sin Ad' : 'Agenda sin Ad'} 
                                    type={attributionModal.type} 
                                />
                                <h3 className="text-base font-black text-white italic uppercase tracking-tight">
                                    Atribuir Anuncio
                                </h3>
                            </div>
                            <button 
                                onClick={() => setAttributionModal(null)} 
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        
                        {/* Contenido Modal */}
                        <form onSubmit={handleAttribute} className="p-5 overflow-y-auto space-y-4 flex-1">
                            
                            {/* Resumen Lead */}
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-medium">Cliente:</span>
                                    <span className="font-bold text-white">{attributionModal.lead.cliente}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-medium">Fecha:</span>
                                    <span className="font-mono text-slate-300">{formatDate(attributionModal.lead.date)}</span>
                                </div>
                                {attributionModal.type === 'sale' && (
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400 font-medium">Monto Venta:</span>
                                        <span className="font-bold text-emerald-400">${attributionModal.lead.monto.toLocaleString('es-ES')}</span>
                                    </div>
                                )}
                            </div>

                            {/* Campo Instagram */}
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                                    Instagram del Lead
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={targetInstagram}
                                        onChange={(e) => setTargetInstagram(e.target.value)}
                                        placeholder="@ig_usuario"
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary/50"
                                    />
                                    <Instagram size={14} className="absolute left-3.5 top-3.5 text-slate-500" />
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Requerido para el matching del lead con Manychat.
                                </p>
                            </div>

                            {/* Buscador de Anuncio */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                                    Seleccionar Anuncio del que llegó
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Filtrar anuncios por nombre, palabra clave o campaña..."
                                        value={adSearchQuery}
                                        onChange={(e) => setAdSearchQuery(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary/50"
                                    />
                                    <Search size={14} className="absolute left-3.5 top-3.5 text-slate-500" />
                                </div>

                                {/* Listado scrollable de Ads */}
                                <div className="max-h-[180px] overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 divide-y divide-slate-850">
                                    {loadingAds ? (
                                        <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                                            <Loader2 size={12} className="animate-spin text-primary" />
                                            Cargando anuncios...
                                        </div>
                                    ) : filteredAds.length === 0 ? (
                                        <div className="p-6 text-center text-xs text-slate-500">
                                            No se encontraron anuncios para la busqueda.
                                        </div>
                                    ) : (
                                        filteredAds.map((ad) => (
                                            <button
                                                key={ad.id}
                                                type="button"
                                                onClick={() => setSelectedAdId(ad.id)}
                                                className={`w-full p-3 text-left transition-colors text-xs flex flex-col gap-0.5 hover:bg-slate-900
                                                    ${selectedAdId === ad.id ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
                                            >
                                                <div className="font-bold text-white flex justify-between">
                                                    <span>{ad.name}</span>
                                                    <span className="text-[9px] font-black text-primary font-mono uppercase bg-primary/10 px-1.5 py-0.5 rounded">
                                                        KW: {ad.keyword}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    Camp: {ad.campaign_name || 'Sin campaña'} • Set: {ad.ad_set_name || 'Sin grupo'}
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Botones de Accion */}
                            <div className="pt-2 flex justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setAttributionModal(null)}
                                    className="px-4 py-2 border border-slate-800 hover:bg-slate-850 text-slate-300 text-xs font-bold uppercase rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2 bg-primary hover:bg-primary/95 disabled:opacity-50 text-white text-xs font-bold uppercase rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-primary/10 hover:shadow-primary/20"
                                >
                                    {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : null}
                                    Confirmar
                                </button>
                            </div>

                        </form>

                    </div>
                </div>
            )}

        </div>
    );
};

export default UnattributedLeadsPage;
