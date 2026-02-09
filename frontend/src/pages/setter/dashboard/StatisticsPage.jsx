import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    LineChart,
    TrendingUp,
    Users,
    MessageCircle,
    CalendarCheck,
    Loader2,
    Calendar,
    Target
} from 'lucide-react';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import api from '../../../services/api';

const SetterStatisticsPage = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [dateRange, setDateRange] = useState('month'); // 'today', 'week', 'month', 'all'

    useEffect(() => {
        fetchStats();
    }, [dateRange]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            // Calculate detailed dates based on range
            const end = new Date();
            let start = new Date();

            if (dateRange === 'today') {
                // start remains today
            } else if (dateRange === 'week') {
                start.setDate(end.getDate() - 7);
            } else if (dateRange === 'month') {
                start.setMonth(end.getMonth() - 1);
            } else {
                start = null; // all time
            }

            const params = {};
            if (start) params.start_date = start.toISOString().split('T')[0];
            params.end_date = end.toISOString().split('T')[0];

            const res = await api.get('/setter/stats/summary', { params });
            setStats(res.data);
        } catch (err) {
            console.error("Error fetching stats:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !stats) return <div className="h-screen flex items-center justify-center bg-main"><Loader2 className="animate-spin text-primary" /></div>;

    const kpis = [
        {
            label: 'Total Agendas',
            value: stats?.total_agendas || 0,
            icon: CalendarCheck,
            color: 'text-primary'
        },
        {
            label: 'Openings',
            value: stats?.total_openings || 0,
            icon: MessageCircle,
            color: 'text-violet-500'
        },
        {
            label: 'Leads (Inbound)',
            value: stats?.total_leads || 0,
            icon: Users,
            color: 'text-blue-500'
        },
        {
            label: 'Conversión (Open/Book)',
            value: `${stats?.conversion || 0}%`,
            icon: Target,
            color: 'text-emerald-500'
        }
    ];

    return (
        <div className="min-h-screen bg-main p-8 md:p-12 pb-32">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="space-y-4">
                        <Badge variant="neutral" className="bg-surface border border-base text-muted mb-2">Analytics</Badge>
                        <h1 className="text-4xl md:text-5xl font-black text-base italic uppercase tracking-tighter">
                            Estadísticas
                        </h1>
                        <p className="text-sm font-bold text-muted uppercase tracking-widest">
                            Rendimiento y conversión de tu gestión.
                        </p>
                    </div>

                    {/* Time Filter */}
                    <div className="flex bg-surface border border-base rounded-2xl p-1">
                        {[
                            { id: 'today', label: 'Hoy' },
                            { id: 'week', label: '7D' },
                            { id: 'month', label: '30D' },
                            { id: 'all', label: 'Todo' }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setDateRange(t.id)}
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${dateRange === t.id
                                        ? 'bg-primary text-white shadow-lg'
                                        : 'text-muted hover:text-base hover:bg-main'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* KPIs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {kpis.map((kpi, idx) => (
                        <Card key={idx} variant="surface" className="p-6 border-base/50 hover:border-primary/20 transition-all group">
                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-3 rounded-2xl bg-main border border-base ${kpi.color.replace('text-', 'text-opacity-20 bg-opacity-10 ')}`}>
                                    <kpi.icon size={20} className={kpi.color} />
                                </div>
                                <TrendingUp size={16} className="text-muted opacity-50" />
                            </div>
                            <h3 className="text-3xl font-black text-base italic tracking-tighter mb-1">
                                {kpi.value}
                            </h3>
                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{kpi.label}</p>
                        </Card>
                    ))}
                </div>

                {/* NOTE: More charts can be added here in the future */}
                <Card variant="surface" className="p-12 flex flex-col items-center justify-center text-center opacity-50 hover:opacity-100 transition-opacity border-dashed border-2 border-base">
                    <LineChart size={48} className="text-muted mb-4" />
                    <h3 className="text-lg font-black text-base uppercase tracking-widest mb-2">Más Gráficos Próximamente</h3>
                    <p className="text-sm text-muted">Estamos trabajando en visualizaciones detalladas de tu embudo.</p>
                </Card>
            </div>
        </div>
    );
};

export default SetterStatisticsPage;
