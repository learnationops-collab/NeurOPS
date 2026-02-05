import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../../services/api';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import {
    Activity,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Loader2,
    BarChart3
} from 'lucide-react';

const StatisticsPage = () => {
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await api.get('/closer/stats');
            setStatsData(res.data);
        } catch (err) {
            console.error("Error fetching stats", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center p-20 min-h-screen">
            <Loader2 className="animate-spin text-primary" size={48} />
        </div>
    );

    return (
        <div className="p-8 max-w-[1800px] mx-auto space-y-12 animate-in fade-in duration-700">
            <header className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                    <BarChart3 size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tighter italic">Estadísticas de Agenda</h1>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">Análisis de rendimiento y resultados</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card variant="main" className="p-8 border-rose-500/20 bg-rose-500/5 relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">Pendientes</p>
                        <h2 className="text-5xl font-black text-rose-500 tracking-tighter italic mt-2">{statsData?.pending || 0}</h2>
                        <p className="text-[9px] font-bold text-rose-500/60 mt-2 uppercase">Agendas sin resultado</p>
                    </div>
                    <Activity size={100} className="absolute -right-8 -bottom-8 text-rose-500 opacity-[0.05] group-hover:scale-110 transition-transform duration-700" />
                </Card>

                {Object.entries(statsData?.outcomes || {}).map(([key, val]) => {
                    const config = {
                        'Terminada': { color: 'text-emerald-500', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', icon: CheckCircle2 },
                        'No Show': { color: 'text-rose-500', bg: 'bg-rose-500/5', border: 'border-rose-500/20', icon: XCircle },
                        'Cancelada': { color: 'text-muted', bg: 'bg-main', border: 'border-base', icon: XCircle },
                        'Reprogramada': { color: 'text-primary', bg: 'bg-primary/5', border: 'border-primary/20', icon: RefreshCw },
                    }[key] || { color: 'text-muted', bg: 'bg-main', border: 'border-base', icon: Activity };

                    return (
                        <Card key={key} variant="surface" className={`p-8 ${config.border} ${config.bg} relative overflow-hidden group`}>
                            <div className="relative z-10">
                                <p className={`text-[10px] font-black ${config.color} uppercase tracking-[0.2em]`}>{key}</p>
                                <h2 className={`text-5xl font-black ${config.color} tracking-tighter italic mt-2`}>{val}</h2>
                            </div>
                            <config.icon size={100} className={`absolute -right-8 -bottom-8 ${config.color} opacity-[0.05] group-hover:scale-110 transition-transform duration-700`} />
                        </Card>
                    );
                })}
            </div>

            <div className="space-y-6">
                <h3 className="text-sm font-black italic uppercase tracking-widest text-muted border-l-4 border-primary pl-4">Desglose por Tipo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {Object.entries(statsData?.type_stats || {}).map(([type, s]) => (
                        <div key={type} className="bg-main/30 rounded-[2.5rem] border border-base p-8 space-y-6">
                            <div className="flex justify-between items-center">
                                <h4 className="text-sm font-black uppercase tracking-tight italic text-primary">{type}</h4>
                                <Badge variant="neutral" className="bg-primary text-white h-7 px-4 rounded-full font-black text-[10px] italic">
                                    {s.total} TOTAL
                                </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {Object.entries(s.results).map(([res, count]) => (
                                    <div key={res} className="bg-surface p-4 rounded-2xl border border-base flex justify-between items-center group hover:border-primary/30 transition-all">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted group-hover:text-base">{res}</span>
                                        <span className="text-sm font-black italic text-primary">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StatisticsPage;
