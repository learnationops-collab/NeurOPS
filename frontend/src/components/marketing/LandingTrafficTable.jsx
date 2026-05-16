import React, { useState, useEffect, useMemo } from 'react';
import { 
    Activity, 
    RefreshCw, 
    Globe, 
    Calendar, 
    Search,
    ExternalLink,
    Filter,
    Trash2
} from 'lucide-react';
import Card from '../ui/Card';
import { toast } from 'react-hot-toast';

import api from '../../services/api';

const LandingTrafficTable = () => {
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchVisits = async () => {
        try {
            setLoading(true);
            const response = await api.get('/v1/metrics/track-visits');
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
        fetchVisits();
    }, []);

    const filteredVisits = visits.filter(v => 
        (v.utm_source?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (v.page_path?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (v.utm_campaign?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    // Agregación para el resumen con mapeo de nombres amigables
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

            // Normalizar la ruta: quitar dominio, quitar query strings (?, #) y slash final
            let path = v.page_path
                .replace('https://institute.thelearnation.com', '')
                .replace('https://work.thelearnation.com', '')
                .split('?')[0]
                .split('#')[0];
            
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                        <Activity className="text-emerald-400" size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black italic uppercase tracking-tighter">Tráfico en Tiempo Real</h2>
                        <p className="text-[9px] font-bold text-muted uppercase tracking-widest">Últimas 500 visitas registradas</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                        <input 
                            type="text"
                            placeholder="Buscar fuente, campaña o ruta..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-xs focus:border-primary/50 transition-all outline-none text-white min-w-[250px]"
                        />
                    </div>
                    <button 
                        onClick={fetchVisits}
                        disabled={loading}
                        className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`text-muted ${loading ? 'animate-spin' : ''}`} size={18} />
                    </button>
                </div>
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
                            filteredVisits.map((visit) => (
                                <tr key={visit.id} className="group hover:translate-x-1 transition-all duration-300">
                                    <td className="px-6 py-4 bg-white/[0.02] border-y border-l border-white/5 rounded-l-2xl whitespace-nowrap">
                                        <div className="flex items-center gap-2 text-muted font-medium">
                                            <Calendar size={12} />
                                            {formatDate(visit.created_at)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 bg-white/[0.02] border-y border-white/5">
                                        <div className="flex items-center gap-2 font-bold text-white group-hover:text-primary transition-colors">
                                            <Globe size={12} className="text-primary/50" />
                                            {visit.page_path || <span className="text-muted font-normal italic">ruta desconocida</span>}
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
        </Card>
    );
};

export default LandingTrafficTable;
