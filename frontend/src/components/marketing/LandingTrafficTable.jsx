import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Activity, 
    RefreshCw, 
    Globe, 
    Calendar, 
    Search,
    Trash2
} from 'lucide-react';
import Card from '../ui/Card';
import { toast } from 'react-hot-toast';

import api from '../../services/api';

// Definición de presets de fechas en zona horaria local
const DATE_PRESETS = [
    { 
        label: 'Hoy', 
        getValue: () => {
            const d = new Date();
            const yyyymmdd = d.toLocaleDateString('sv-SE');
            return { start: yyyymmdd, end: yyyymmdd };
        }
    },
    { 
        label: 'Ayer', 
        getValue: () => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            const yyyymmdd = d.toLocaleDateString('sv-SE');
            return { start: yyyymmdd, end: yyyymmdd };
        }
    },
    { 
        label: 'Últimos 7 días', 
        getValue: () => {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 6);
            return { start: start.toLocaleDateString('sv-SE'), end: end.toLocaleDateString('sv-SE') };
        }
    },
    { 
        label: 'Este mes', 
        getValue: () => {
            const end = new Date();
            const start = new Date(end.getFullYear(), end.getMonth(), 1);
            return { start: start.toLocaleDateString('sv-SE'), end: end.toLocaleDateString('sv-SE') };
        }
    },
    { 
        label: 'Personalizado', 
        getValue: () => null 
    }
];

const LandingTrafficTable = () => {
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);
    const sentinelRef = useRef(null);
    
    // Estados de filtrado por fechas (predeterminado: últimos 7 días)
    const [preset, setPreset] = useState('Últimos 7 días');
    const [startDate, setStartDate] = useState(() => {
        const start = new Date();
        start.setDate(start.getDate() - 6);
        return start.toLocaleDateString('sv-SE');
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toLocaleDateString('sv-SE');
    });

    const fetchVisits = async (start = startDate, end = endDate) => {
        try {
            setLoading(true);
            const response = await api.get('/v1/metrics/track-visits', {
                params: {
                    start_date: start,
                    end_date: end
                }
            });
            setVisits(response.data);
        } catch (err) {
            toast.error('Error al cargar datos de tráfico');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este registro?')) return;
        
        try {
            await api.delete(`/v1/metrics/track-visit/${id}`);
            toast.success('Registro eliminado');
            setVisits(prev => prev.filter(v => v.id !== id));
        } catch (err) {
            toast.error('Error al eliminar');
            console.error(err);
        }
    };

    useEffect(() => {
        fetchVisits(startDate, endDate);
    }, [startDate, endDate]);

    const handlePresetChange = (presetName) => {
        setPreset(presetName);
        const presetObj = DATE_PRESETS.find(p => p.label === presetName);
        if (presetObj) {
            const vals = presetObj.getValue();
            if (vals) {
                setStartDate(vals.start);
                setEndDate(vals.end);
            }
        }
    };

    // Búsqueda textual local en la tabla
    const filteredVisits = visits.filter(v => 
        (v.utm_source?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (v.page_path?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (v.utm_campaign?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (v.utm_medium?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    // Restablecer el contador al cambiar filtros o búsqueda
    useEffect(() => {
        setVisibleCount(10);
    }, [searchTerm, startDate, endDate]);

    // Visitas que se muestran actualmente (paginadas)
    const displayedVisits = useMemo(() => {
        return filteredVisits.slice(0, visibleCount);
    }, [filteredVisits, visibleCount]);

    // Lógica del IntersectionObserver para el scroll infinito
    useEffect(() => {
        if (loading || filteredVisits.length <= visibleCount) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setVisibleCount(prev => Math.min(prev + 10, filteredVisits.length));
            }
        }, { threshold: 0.1 });

        const currentSentinel = sentinelRef.current;
        if (currentSentinel) observer.observe(currentSentinel);

        return () => {
            if (currentSentinel) observer.unobserve(currentSentinel);
        };
    }, [filteredVisits.length, visibleCount, loading]);

    // Agregación de Top Páginas
    const pageStats = useMemo(() => {
        const mainLandings = {
            '/acceso': 'Acceso',
            '/bienvenido': 'Bienvenido',
            '/live-class': 'Live Class',
            '/live': 'Live'
        };

        const stats = {
            'Acceso': 0,
            'Bienvenido': 0,
            'Live Class': 0,
            'Live': 0,
            'Otros': 0
        };

        visits.forEach(v => {
            if (!v.page_path) {
                stats['Otros']++;
                return;
            }

            let path = v.page_path || '';
            try {
                if (path.includes('://')) {
                    path = new URL(path).pathname;
                } else {
                    path = path.split('?')[0].split('#')[0];
                }
            } catch (e) {
                path = path.split('?')[0].split('#')[0];
            }
            
            if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
            if (!path.startsWith('/')) path = '/' + path;

            const name = mainLandings[path];
            if (name) {
                stats[name]++;
            } else {
                stats['Otros']++;
            }
        });

        return Object.entries(stats)
            .filter(([_, count]) => count > 0 || ['Acceso', 'Bienvenido', 'Live Class', 'Live'].includes(_))
            .sort((a, b) => {
                if (a[0] === 'Otros') return 1;
                if (b[0] === 'Otros') return -1;
                return b[1] - a[1];
            });
    }, [visits]);

    // Agregación para estadísticas UTM (Origen, Medio y Campaña)
    const utmStats = useMemo(() => {
        const sources = {};
        const mediums = {};
        const campaigns = {};
        const total = visits.length;

        visits.forEach(v => {
            const src = v.utm_source || 'directo';
            const med = v.utm_medium || 'ninguno';
            const camp = v.utm_campaign || 'ninguno';

            sources[src] = (sources[src] || 0) + 1;
            mediums[med] = (mediums[med] || 0) + 1;
            campaigns[camp] = (campaigns[camp] || 0) + 1;
        });

        const sortAndFormat = (obj) => {
            return Object.entries(obj)
                .map(([name, count]) => ({
                    name,
                    count,
                    percentage: total > 0 ? Math.round((count / total) * 100) : 0
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
        };

        return {
            sources: sortAndFormat(sources),
            mediums: sortAndFormat(mediums),
            campaigns: sortAndFormat(campaigns)
        };
    }, [visits]);

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    return (
        <Card variant="surface" className="border-white/5 bg-[#0a0b0e]/80 backdrop-blur-xl">
            {/* Cabecera Principal */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                        <Activity className="text-emerald-400" size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black italic uppercase tracking-tighter">Tráfico en Tiempo Real</h2>
                        <p className="text-[9px] font-bold text-muted uppercase tracking-widest">
                            {preset === 'Personalizado' 
                                ? `Visitas desde ${startDate} hasta ${endDate}` 
                                : `Visitas de: ${preset}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                        <input 
                            type="text"
                            placeholder="Buscar fuente, campaña, medio o ruta..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-xs focus:border-primary/50 transition-all outline-none text-white min-w-[250px]"
                        />
                    </div>
                    <button 
                        onClick={() => fetchVisits(startDate, endDate)}
                        disabled={loading}
                        className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all disabled:opacity-50"
                        title="Refrescar datos"
                    >
                        <RefreshCw className={`text-muted ${loading ? 'animate-spin' : ''}`} size={18} />
                    </button>
                </div>
            </div>

            {/* Controles de Filtros de Fechas */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-8 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest mr-2 flex items-center gap-1.5">
                        <Calendar size={12} className="text-primary" /> Rango de Fechas:
                    </span>
                    {DATE_PRESETS.map((p) => (
                        <button
                            key={p.label}
                            onClick={() => handlePresetChange(p.label)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                preset === p.label
                                    ? 'bg-primary/20 text-primary border border-primary/30'
                                    : 'bg-white/5 hover:bg-white/10 text-muted border border-transparent'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {preset === 'Personalizado' && (
                    <div className="flex items-center gap-3 animate-fade-in">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted uppercase">Desde</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-3 py-1.5 bg-[#12131a] border border-white/10 rounded-lg text-xs text-white focus:border-primary/50 transition-all outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted uppercase">Hasta</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-3 py-1.5 bg-[#12131a] border border-white/10 rounded-lg text-xs text-white focus:border-primary/50 transition-all outline-none"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Resumen de Top Páginas */}
            {!loading && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    {pageStats.map(([name, count], idx) => (
                        <div key={name} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col justify-between group hover:border-primary/30 transition-all">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[9px] font-black text-muted uppercase tracking-widest">{name === 'Otros' ? 'Resto' : 'Landing'}</p>
                                <Globe size={10} className={name === 'Otros' ? 'text-slate-500' : 'text-primary/50'} />
                            </div>
                            <div className="min-w-0">
                                <h4 className={`text-xs font-black uppercase truncate ${name === 'Otros' ? 'text-slate-400' : 'text-white'}`}>{name}</h4>
                                <div className="mt-1 flex items-baseline gap-1">
                                    <span className="text-xl font-black text-primary">{count}</span>
                                    <span className="text-[8px] font-bold text-muted uppercase">visitas</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Estadísticas Detalladas de UTM (Source, Medium, Campaign) */}
            {!loading && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Tarjeta de Origen (Source) */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-emerald-500/20 transition-all">
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400">Top Orígenes (Source)</h3>
                            <span className="text-[10px] font-bold text-muted uppercase">Visitas</span>
                        </div>
                        <div className="space-y-3">
                            {utmStats.sources.length === 0 ? (
                                <p className="text-xs text-muted text-center py-4">Sin datos de origen</p>
                            ) : (
                                utmStats.sources.map((s) => (
                                    <div key={s.name} className="relative p-2 rounded-lg bg-white/[0.01] overflow-hidden group">
                                        <div 
                                            className="absolute inset-y-0 left-0 bg-emerald-500/5 transition-all duration-500 rounded-lg"
                                            style={{ width: `${s.percentage}%` }}
                                        />
                                        <div className="relative flex items-center justify-between text-xs">
                                            <span className="font-bold text-white/90 truncate max-w-[70%] group-hover:text-emerald-300 transition-colors uppercase text-[10px] tracking-wider">
                                                {s.name}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-white">{s.count}</span>
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                                                    {s.percentage}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Tarjeta de Medio (Medium) */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-indigo-500/20 transition-all">
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">Top Medios (Medium)</h3>
                            <span className="text-[10px] font-bold text-muted uppercase">Visitas</span>
                        </div>
                        <div className="space-y-3">
                            {utmStats.mediums.length === 0 ? (
                                <p className="text-xs text-muted text-center py-4">Sin datos de medios</p>
                            ) : (
                                utmStats.mediums.map((m) => (
                                    <div key={m.name} className="relative p-2 rounded-lg bg-white/[0.01] overflow-hidden group">
                                        <div 
                                            className="absolute inset-y-0 left-0 bg-indigo-500/5 transition-all duration-500 rounded-lg"
                                            style={{ width: `${m.percentage}%` }}
                                        />
                                        <div className="relative flex items-center justify-between text-xs">
                                            <span className="font-bold text-white/90 truncate max-w-[70%] group-hover:text-indigo-300 transition-colors uppercase text-[10px] tracking-wider">
                                                {m.name}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-white">{m.count}</span>
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
                                                    {m.percentage}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Tarjeta de Campaña (Campaign) */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-purple-500/20 transition-all">
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                            <h3 className="text-xs font-black uppercase tracking-widest text-purple-400">Top Campañas (Campaign)</h3>
                            <span className="text-[10px] font-bold text-muted uppercase">Visitas</span>
                        </div>
                        <div className="space-y-3">
                            {utmStats.campaigns.length === 0 ? (
                                <p className="text-xs text-muted text-center py-4">Sin datos de campañas</p>
                            ) : (
                                utmStats.campaigns.map((c) => (
                                    <div key={c.name} className="relative p-2 rounded-lg bg-white/[0.01] overflow-hidden group">
                                        <div 
                                            className="absolute inset-y-0 left-0 bg-purple-500/5 transition-all duration-500 rounded-lg"
                                            style={{ width: `${c.percentage}%` }}
                                        />
                                        <div className="relative flex items-center justify-between text-xs">
                                            <span className="font-bold text-white/90 truncate max-w-[70%] group-hover:text-purple-300 transition-colors italic text-[10px] tracking-wider">
                                                {c.name}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-white">{c.count}</span>
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
                                                    {c.percentage}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Tabla Detallada */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-y-2">
                    <thead>
                        <tr className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                            <th className="px-6 py-4">Fecha</th>
                            <th className="px-6 py-4">Página / Ruta</th>
                            <th className="px-6 py-4">Origen (Source)</th>
                            <th className="px-6 py-4">Medio (Medium)</th>
                            <th className="px-6 py-4">Campaña</th>
                            <th className="px-6 py-4">Referrer</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs">
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="text-center py-20 text-muted font-bold uppercase tracking-widest animate-pulse">
                                    Cargando datos de tráfico...
                                </td>
                            </tr>
                        ) : filteredVisits.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="text-center py-20 text-muted font-bold uppercase tracking-widest">
                                    No se encontraron visitas registradas
                                </td>
                            </tr>
                        ) : (
                            displayedVisits.map((visit) => (
                                <tr key={visit.id} className="group hover:translate-x-1 transition-all duration-300">
                                    <td className="px-6 py-4 bg-white/[0.02] border-y border-l border-white/5 rounded-l-2xl whitespace-nowrap">
                                        <div className="flex items-center gap-2 text-muted font-medium">
                                            <Calendar size={12} />
                                            {formatDate(visit.created_at)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 bg-white/[0.02] border-y border-white/5">
                                        <div className="flex flex-col gap-0.5 group-hover:text-primary transition-colors">
                                            <div className="flex items-center gap-2 font-bold text-white">
                                                <Globe size={12} className="text-primary/50" />
                                                {(() => {
                                                    let p = visit.page_path || '';
                                                    try {
                                                        if (p.includes('://')) p = new URL(p).pathname;
                                                        else p = p.split('?')[0].split('#')[0];
                                                    } catch (e) {
                                                        p = p.split('?')[0].split('#')[0];
                                                    }
                                                    const cleanPath = p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : (p || '/');
                                                    const names = { '/acceso': 'Acceso', '/bienvenido': 'Bienvenido', '/live-class': 'Live Class', '/live': 'Live' };
                                                    return names[cleanPath] || cleanPath;
                                                })()}
                                            </div>
                                            <span className="text-[10px] text-muted truncate max-w-[200px] font-medium opacity-50">
                                                {visit.page_path || 'ruta desconocida'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 bg-white/[0.02] border-y border-white/5">
                                        <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-lg text-primary font-black uppercase text-[9px] tracking-widest">
                                            {visit.utm_source || 'directo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 bg-white/[0.02] border-y border-white/5 text-muted font-medium">
                                        {visit.utm_medium || '-'}
                                    </td>
                                    <td className="px-6 py-4 bg-white/[0.02] border-y border-white/5">
                                        <span className="font-bold text-white/80 italic">{visit.utm_campaign || '-'}</span>
                                    </td>
                                    <td className="px-6 py-4 bg-white/[0.02] border-y border-white/5 text-muted font-medium italic truncate max-w-[200px]">
                                        {visit.referrer || 'ninguno'}
                                    </td>
                                    <td className="px-6 py-4 bg-white/[0.02] border-y border-r border-white/5 rounded-r-2xl text-right">
                                        <button 
                                            onClick={() => handleDelete(visit.id)}
                                            className="p-2 text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                                            title="Eliminar registro"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Centinela e indicador de carga para el scroll infinito */}
            <div ref={sentinelRef} className="w-full">
                {filteredVisits.length > displayedVisits.length && (
                    <div className="text-center py-5 text-[10px] font-black text-muted uppercase tracking-[0.2em] animate-pulse border-t border-white/5 mt-4">
                        Cargando más registros... (Mostrando {displayedVisits.length} de {filteredVisits.length})
                    </div>
                )}
            </div>
        </Card>
    );
};

export default LandingTrafficTable;
