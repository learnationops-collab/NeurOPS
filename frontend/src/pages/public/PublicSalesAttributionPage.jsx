import { useState, useEffect } from 'react';
import api from '../../services/api';
import {
    TrendingUp,
    Search,
    Calendar,
    DollarSign,
    Target,
    Activity,
    CheckCircle2,
    HelpCircle,
    AlertCircle,
    BarChart3,
    Instagram,
    Layers,
    Clock,
    ArrowLeft,
    Sparkles,
    Plus,
    X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

// ─────────────────────────────────────────────
// Sub-componente: tarjeta de KPI de resumen
// ─────────────────────────────────────────────
const KpiCard = ({ label, value, subtext, color = 'text-slate-900', icon: Icon, accentClass }) => (
    <div className={`flex flex-col justify-between rounded-[2.5rem] p-8 relative overflow-hidden group bg-white border border-slate-100 shadow-sm ${accentClass || ''}`}>
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <Icon size={80} />
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
        <h3 className={`text-4xl font-black italic tracking-tighter ${color}`}>{value}</h3>
        {subtext && <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 italic">{subtext}</p>}
    </div>
);

// ─────────────────────────────────────────────
// Sub-componente: badge de atribución
// ─────────────────────────────────────────────
const AtribucionBadge = ({ status }) => {
    if (status === 'encontrado') {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle2 size={12} /> Atribuido
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-400 border border-slate-100">
            <HelpCircle size={12} /> Indeterminado
        </span>
    );
};

const PublicSalesAttributionPage = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAtribucion, setFilterAtribucion] = useState('all');

    // States for Manual Attribution
    const [adsList, setAdsList] = useState([]);
    const [manualModalOpen, setManualModalOpen] = useState(false);
    const [selectedSale, setSelectedSale] = useState(null);
    const [manualIg, setManualIg] = useState('');
    const [manualAdId, setManualAdId] = useState('');
    const [submittingManual, setSubmittingManual] = useState(false);

    useEffect(() => {
        const fetchAds = async () => {
            try {
                const res = await api.get('/public/ads');
                setAdsList(res.data);
            } catch (err) {
                console.error("Error fetching ads", err);
            }
        };
        fetchAds();
    }, []);

    const openManualModal = (row) => {
        setSelectedSale(row);
        setManualIg(row.instagram && row.instagram !== 'N/A' ? row.instagram.replace('@', '') : '');
        setManualAdId('');
        setManualModalOpen(true);
    };

    const handleManualAttribution = async () => {
        if (!manualIg || !manualAdId) return;
        setSubmittingManual(true);
        try {
            await api.post('/public/marketing/manual-attribution', {
                sale_id: selectedSale.sale_id,
                ad_id: parseInt(manualAdId),
                instagram: manualIg
            });
            setManualModalOpen(false);
            await handleGenerateReport();
        } catch (err) {
            alert('Error al forzar atribución: ' + (err.response?.data?.error || err.message));
        } finally {
            setSubmittingManual(false);
        }
    };

    const handleGenerateReport = async () => {
        if (!startDate || !endDate) {
            setError('Selecciona el rango de fechas.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await api.get('/sheets/sync', { params: { tabla: 'Ventas_DB' } });
            
            const res = await api.get('/public/reports/sales-attribution', {
                params: { start_date: startDate, end_date: endDate }
            });
            setReport(res.data);
        } catch (err) {
            setError('Error al conectar con la base de datos.');
        } finally {
            setLoading(false);
        }
    };

    const filteredRows = (report?.rows || []).filter(row => {
        const matchesSearch = !searchTerm || 
            row.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (row.instagram || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (row.ad_name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesAtribucion = filterAtribucion === 'all' || row.atribucion === filterAtribucion;
        return matchesSearch && matchesAtribucion;
    });

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans p-4 md:p-8 lg:p-12 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-100 blur-[120px] rounded-full opacity-50" />
            <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-emerald-50 blur-[100px] rounded-full opacity-50" />

            <div className="w-full max-w-7xl mx-auto z-10 relative space-y-12">
                
                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-3">
                        <Link to="/publico" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-black uppercase text-[10px] tracking-widest transition-all hover:-translate-x-1">
                            <ArrowLeft size={16} /> Volver al Hub
                        </Link>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full">Reporte de Auditoría</span>
                                <Badge variant="surface" className="border-slate-200">Alpha v1.0</Badge>
                            </div>
                            <h1 className="text-5xl md:text-6xl font-black text-slate-800 italic tracking-tighter leading-none uppercase">
                                Atribución de <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500">Ventas Registradas</span>
                            </h1>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4 w-full md:w-auto min-w-[320px]">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Calendar size={14} className="text-indigo-500" />
                            Rango de Análisis
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold"
                            />
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold"
                            />
                        </div>
                        <button
                            onClick={handleGenerateReport}
                            disabled={loading || !startDate || !endDate}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {loading ? <Activity size={18} className="animate-spin" /> : <TrendingUp size={18} />}
                            {loading ? 'Analizando Datos...' : 'Generar Reporte'}
                        </button>
                    </div>
                </header>

                {error && (
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-500 animate-in slide-in-from-top">
                        <AlertCircle size={20} />
                        <p className="font-bold text-sm">{error}</p>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-6">
                        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        <div className="text-center">
                            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Sincronizando registros...</p>
                            <p className="text-[10px] text-slate-300 uppercase mt-2">Cruzando FinancialSales con LeadAnswers</p>
                        </div>
                    </div>
                ) : report ? (
                    <div className="space-y-12 animate-in fade-in duration-1000">
                        
                        {/* Summary Metrics */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <KpiCard 
                                label="Total Ventas" 
                                value={report.summary.total_ventas} 
                                icon={DollarSign} 
                                subtext="En el periodo seleccionado"
                            />
                            <KpiCard 
                                label="Atribuidas" 
                                value={`${report.summary.porcentaje_atribucion}%`} 
                                color="text-emerald-500"
                                icon={CheckCircle2} 
                                subtext={`${report.summary.atribuidas} ventas con origen`}
                                accentClass="border-emerald-100 bg-emerald-50/30"
                            />
                            <KpiCard 
                                label="Indeterminadas" 
                                value={report.summary.indeterminadas} 
                                color="text-slate-400"
                                icon={HelpCircle} 
                                subtext="Sin match de anuncio"
                            />
                            <KpiCard 
                                label="Sin Instagram" 
                                value={report.summary.sin_instagram} 
                                color="text-amber-500"
                                icon={Instagram} 
                                subtext="No se pueden trazar"
                            />
                        </div>

                        {/* Revenue by Ad */}
                        {report.revenue_by_ad.length > 0 && (
                            <section className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/20">
                                        <Target size={20} />
                                    </div>
                                    <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">Revenue por Campaña / Anuncio</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {report.revenue_by_ad.map((ad, idx) => (
                                        <div key={idx} className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                                                <BarChart3 size={40} />
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Anuncio Orien</p>
                                                    <h4 className="text-lg font-black text-slate-900 leading-none">{ad.ad_name}</h4>
                                                    {ad.ad_keyword && <span className="inline-block mt-2 px-2 py-0.5 bg-slate-100 text-[8px] font-black uppercase text-slate-500 rounded-md tracking-widest">{ad.ad_keyword}</span>}
                                                </div>
                                                <div className="flex items-end justify-between border-t border-slate-50 pt-4">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Ventas</p>
                                                        <p className="text-2xl font-black text-slate-900 italic tracking-tighter">{ad.ventas}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-bold text-emerald-500 uppercase">Monto Total</p>
                                                        <p className="text-2xl font-black text-emerald-500 italic tracking-tighter">${ad.monto_total.toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Detailed Table */}
                        <section className="bg-white border border-slate-100 rounded-[3rem] p-8 shadow-sm space-y-8">
                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-900 rounded-xl text-white">
                                        <Layers size={20} />
                                    </div>
                                    <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">Detalle Transaccional</h2>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                                    <div className="relative flex-1 sm:w-64">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Buscar por cliente o ad..."
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                                        {[
                                            { id: 'all', label: 'Todos' },
                                            { id: 'encontrado', label: 'Trazados' },
                                            { id: 'indeterminado', label: 'Sin Traza' }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setFilterAtribucion(opt.id)}
                                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filterAtribucion === opt.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-separate border-spacing-y-2">
                                    <thead>
                                        <tr className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">
                                            <th className="pb-4 pl-4">Estado</th>
                                            <th className="pb-4">Fecha Venta</th>
                                            <th className="pb-4">Cliente / IG</th>
                                            <th className="pb-4">Monto</th>
                                            <th className="pb-4">Anuncio de Origen</th>
                                            <th className="pb-4">Ciclo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredRows.map((row, idx) => (
                                            <tr key={idx} className="group hover:bg-slate-50/80 transition-all">
                                                <td className="py-4 pl-4 bg-white rounded-l-3xl border-y border-l border-slate-50">
                                                    <AtribucionBadge status={row.atribucion} />
                                                </td>
                                                <td className="py-4 bg-white border-y border-slate-50">
                                                    <div className="flex items-center gap-2 text-slate-500">
                                                        <Calendar size={14} />
                                                        <span className="text-sm font-bold">{new Date(row.fecha_venta).toLocaleDateString()}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 bg-white border-y border-slate-50">
                                                    <div className="space-y-0.5">
                                                        <p className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase italic">{row.cliente}</p>
                                                        {row.instagram && row.instagram !== 'N/A' && (
                                                            <div className="flex items-center gap-1.5 text-indigo-400">
                                                                <Instagram size={10} />
                                                                <span className="text-[10px] font-bold">{row.instagram}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 bg-white border-y border-slate-50 font-black text-emerald-500 italic text-xl tracking-tighter">
                                                    ${row.monto.toLocaleString()}
                                                </td>
                                                <td className="py-4 bg-white border-y border-slate-50">
                                                    {row.atribucion === 'encontrado' ? (
                                                        <div className="space-y-1">
                                                            <p className="text-xs font-black text-slate-700 uppercase leading-none">{row.ad_name}</p>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{row.ad_keyword}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-start gap-2">
                                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] italic">Sin Traza</span>
                                                            <button 
                                                                onClick={() => openManualModal(row)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors shadow-sm"
                                                            >
                                                                <Plus size={10} /> Forzar Atribución
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-4 bg-white border-y border-r border-slate-50 rounded-r-3xl text-right pr-6">
                                                    {row.dias_hasta_venta != null ? (
                                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl">
                                                            <Clock size={12} className="text-slate-400" />
                                                            <span className="text-xs font-black text-slate-600">{row.dias_hasta_venta}d</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-200">•</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="bg-white border border-slate-100 rounded-[3rem] p-20 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center shadow-inner">
                            <Sparkles size={40} />
                        </div>
                        <div className="max-w-md space-y-2">
                            <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Pronto para Analizar</h3>
                            <p className="text-slate-400 text-sm font-medium">Selecciona un rango de fechas arriba para comenzar el proceso de atribución automática entre tus ventas y webhooks de anuncios.</p>
                        </div>
                    </div>
                )}

                <footer className="pt-12 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-8 text-slate-400">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white border border-slate-100 rounded-2xl">
                            <TrendingUp size={18} className="text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">NeurOPS Attribution System</p>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-300">© 2026 • Auditoría Independiente</p>
                        </div>
                    </div>
                    <Link to="/publico" className="text-[10px] font-black uppercase tracking-widest hover:text-indigo-600 transition-colors">Volver al Portal de Operaciones</Link>
                </footer>
            </div>

            {/* Modal de Atribución Manual */}
            {manualModalOpen && selectedSale && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                                    <Target size={18} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 uppercase italic tracking-tighter">Atribución Manual</h3>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Venta de {selectedSale.cliente}</p>
                                </div>
                            </div>
                            <button onClick={() => setManualModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Instagram size={12} className="text-indigo-500" />
                                    Instagram del Cliente
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
                                    <input
                                        type="text"
                                        value={manualIg}
                                        onChange={(e) => setManualIg(e.target.value.replace('@', ''))}
                                        placeholder="usuario_ig"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-8 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold"
                                    />
                                </div>
                                <p className="text-[9px] text-slate-400 font-medium">Es fundamental para cruzarlo orgánicamente desde ahora.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <BarChart3 size={12} className="text-indigo-500" />
                                    Anuncio de Origen
                                </label>
                                <select
                                    value={manualAdId}
                                    onChange={(e) => setManualAdId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-700"
                                >
                                    <option value="">-- Seleccionar Anuncio --</option>
                                    {adsList.map(ad => (
                                        <option key={ad.id} value={ad.id}>
                                            {ad.name} {ad.keyword ? `(${ad.keyword})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <button 
                                onClick={() => setManualModalOpen(false)}
                                className="flex-1 py-3 font-black text-xs text-slate-500 uppercase tracking-widest hover:bg-slate-200/50 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleManualAttribution}
                                disabled={submittingManual || !manualIg || !manualAdId}
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {submittingManual ? <Activity size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                Forzar Origen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PublicSalesAttributionPage;
