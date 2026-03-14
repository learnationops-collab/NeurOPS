import { Loader2, Megaphone, RefreshCw, TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import AdDetailModal from '../../components/modals/AdDetailModal';

const AdDashboardTab = () => {
    const [stats, setStats] = useState([]);
    const [segmentationStats, setSegmentationStats] = useState({ variantes: [], openings: [] });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedAdId, setSelectedAdId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const [adsRes, segRes] = await Promise.all([
                api.get('/manychat-webhook/stats/dashboard'),
                api.get('/manychat-webhook/stats/segmentation')
            ]);
            setStats(adsRes.data);
            setSegmentationStats(segRes.data);
        } catch (err) {
            console.error('Error fetching ad stats:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const maxLeads = Math.max(...stats.map(s => s.total_leads), 1);
    
    // Función auxiliar para renderizar tarjetas pequeñas de segmentación
    const renderSegmentationCard = (stat, maxSegLeads) => {
        let qualColor = "text-slate-400";
        let qualBg = "bg-slate-500/10";
        if (stat.qualified_percentage >= 50) {
            qualColor = "text-emerald-400";
            qualBg = "bg-emerald-500/10";
        } else if (stat.qualified_percentage >= 20) {
            qualColor = "text-yellow-400";
            qualBg = "bg-yellow-500/10";
        } else if (stat.total_leads > 0 && stat.qualified_percentage < 20) {
            qualColor = "text-red-400";
            qualBg = "bg-red-500/10";
        }

        const barWidth = `${stat.qualified_percentage}%`; // Cambiado a % de cualificación

        return (
            <div key={stat.name} className="bg-slate-800/20 border border-slate-700/30 rounded-xl p-4 hover:bg-slate-800/40 transition-colors">
                <div className="flex justify-between items-start mb-3">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider truncate pr-2" title={stat.name}>
                        {stat.name}
                    </h4>
                    <span className="bg-slate-900/50 px-2 py-0.5 rounded text-xs font-black text-slate-300">
                        {stat.total_leads} <span className="text-[9px] text-slate-500 uppercase">Leads</span>
                    </span>
                </div>
                
                <div className="flex items-center gap-3 mb-3">
                    <div className={`flex-1 rounded-lg p-2 border ${qualBg.replace('10', '20').replace('bg-', 'border-')}`}>
                        <div className="flex items-center justify-between">
                            <p className={`text-[9px] font-black uppercase tracking-wider ${qualColor}`}>Cualificación</p>
                            <TrendingUp size={10} className={qualColor} />
                        </div>
                        <div className="flex items-baseline gap-1 mt-0.5">
                            <p className={`text-lg font-black leading-none ${qualColor}`}>{stat.qualified_percentage}%</p>
                            <span className="text-[9px] text-slate-500 font-bold">({stat.qualified_leads})</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase tracking-widest">
                        <span>Cualificación</span>
                        <span>{stat.qualified_percentage}% / 100%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${qualColor.replace('text-', 'bg-')}/80`} style={{ width: barWidth }} />
                    </div>
                </div>
            </div>
        );
    };

    const maxVarianteLeads = Math.max(...(segmentationStats.variantes || []).map(s => s.total_leads), 1);
    const maxOpeningLeads = Math.max(...(segmentationStats.openings || []).map(s => s.total_leads), 1);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 rounded-xl">
                        <Megaphone className="text-blue-400" size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-white">Rendimiento por Anuncio</h3>
                        <p className="text-xs text-slate-500">Comparativa de leads entrantes y % de cualificación</p>
                    </div>
                </div>
                <button
                    onClick={() => fetchStats(true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                    Actualizar
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-blue-500" size={28} />
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Sección Segmentación */}
                    {((segmentationStats.variantes && segmentationStats.variantes.length > 0) || 
                      (segmentationStats.openings && segmentationStats.openings.length > 0)) && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 border-b border-slate-800/50 pb-2">
                                <Users className="text-amber-400" size={18} />
                                <h3 className="text-sm font-black uppercase tracking-wider text-slate-300">Rendimiento por Fragmentos (Segmentación)</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Variantes */}
                                {segmentationStats.variantes && segmentationStats.variantes.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Variantes</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {segmentationStats.variantes.map(stat => renderSegmentationCard(stat, maxVarianteLeads))}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Openings */}
                                {segmentationStats.openings && segmentationStats.openings.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Openings</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {segmentationStats.openings.map(stat => renderSegmentationCard(stat, maxOpeningLeads))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Separador */}
                    {(stats.length > 0) && (
                         <div className="flex items-center gap-2 border-b border-slate-800/50 pb-2 pt-2">
                             <Megaphone className="text-blue-400" size={18} />
                             <h3 className="text-sm font-black uppercase tracking-wider text-slate-300">Rendimiento por Anuncio (Keyword)</h3>
                         </div>
                    )}

                    {stats.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Megaphone size={40} className="mx-auto mb-3 opacity-20" />
                            <p className="font-medium text-sm">Sin datos de anuncios</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.map((stat, index) => {
                        // Determinar color de cualificación basado en el %
                        let qualColor = "text-slate-400";
                        let qualBg = "bg-slate-500/10";
                        if (stat.qualified_percentage >= 50) {
                            qualColor = "text-emerald-400";
                            qualBg = "bg-emerald-500/10";
                        } else if (stat.qualified_percentage >= 20) {
                            qualColor = "text-yellow-400";
                            qualBg = "bg-yellow-500/10";
                        } else if (stat.total_leads > 0 && stat.qualified_percentage < 20) {
                            qualColor = "text-red-400";
                            qualBg = "bg-red-500/10";
                        }

                        // Ancho de la barra de progreso relativo al 100% de cualificación
                        const barWidth = `${stat.qualified_percentage}%`;

                        return (
                            <div 
                                key={stat.ad_id} 
                                onClick={() => {
                                    setSelectedAdId(stat.ad_id);
                                    setIsModalOpen(true);
                                }}
                                className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 hover:border-blue-500/30 transition-all relative overflow-hidden group cursor-pointer"
                            >
                                {/* Decoración de fondo topo-izq */}
                                <div className="absolute -top-4 -left-4 w-16 h-16 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-colors"></div>

                                <div className="relative">
                                    {/* Header de la tarjeta */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Anuncio</p>
                                            <h4 className="text-base font-black text-white px-2 py-0.5 bg-slate-900 rounded font-bold border border-slate-700 leading-tight truncate">
                                                {stat.ad_name}
                                            </h4>
                                            <p className="text-[10px] font-mono text-slate-500 mt-1">ID: {stat.ad_id}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <span className="text-slate-600 text-[10px] font-bold">#{index + 1}</span>
                                            <div className="p-1.5 bg-slate-900/50 rounded-lg text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Activity size={12} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Métricas Principales */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800">
                                            <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                                <Users size={12} className="text-blue-400" />
                                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-wider">Entrantes</p>
                                            </div>
                                            <p className="text-2xl font-black text-white leading-none">{stat.total_leads}</p>
                                        </div>

                                        <div className={`rounded-xl p-3 border ${qualBg.replace('10', '20').replace('bg-', 'border-')}`}>
                                            <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                                <TrendingUp size={12} className={qualColor} />
                                                <p className={`text-[9px] font-black uppercase tracking-wider ${qualColor}`}>% Cualificados</p>
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <p className="text-2xl font-black leading-none">{stat.qualified_percentage}%</p>
                                                <span className="text-[10px] opacity-70 font-bold">({stat.qualified_leads})</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Métricas Financieras (Si hay spend) */}
                                    <div className="grid grid-cols-2 gap-3 mb-5 pt-3 border-t border-slate-700/30">
                                        <div className="flex flex-col">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">CPL</p>
                                            <p className="text-sm font-black text-white flex items-center gap-1">
                                                <DollarSign size={12} className="text-amber-500" />
                                                {stat.cpl || '—'}
                                            </p>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">CPQL</p>
                                            <p className="text-sm font-black text-white flex items-center justify-end gap-1">
                                                <DollarSign size={12} className="text-violet-500" />
                                                {stat.cpql || '—'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Barra de progreso visual (Cualificación vs 100%) */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                            <span>Rendimiento</span>
                                            <span>{stat.qualified_percentage}% / 100%</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-700/30">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${qualColor.replace('text-', 'bg-')}/80`}
                                                style={{ width: barWidth }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
                </div>
            )}

            {/* Modal de Detalle */}
            <AdDetailModal 
                isOpen={isModalOpen} 
                adId={selectedAdId} 
                onClose={() => setIsModalOpen(false)} 
            />
        </div>
    );
};

export default AdDashboardTab;
