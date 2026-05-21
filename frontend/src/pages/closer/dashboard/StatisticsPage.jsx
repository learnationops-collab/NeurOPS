import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../services/api';
import {
    Activity, Loader2, BarChart3, List
} from 'lucide-react';
import DateRangeFilter from '../../../components/shared/DateRangeFilter';
import CloserPerformanceTab from '../../public/CloserPerformanceTab';
import CloserReportsTable from '../../public/CloserReportsTable';

const StatisticsPage = () => {
    const [activeTab, setActiveTab] = useState('performance');
    const [statsData, setStatsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ type: 'week', start: '', end: '' });
    const [aggType, setAggType] = useState('sum');

    useEffect(() => {
        fetchStats();
    }, [dateRange, aggType]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const params = { agg_type: aggType };
            
            if (dateRange.type === 'today') {
                const today = new Date().toISOString().split('T')[0];
                params.start_date = today;
                params.end_date = today;
            } else if (dateRange.type === 'week') {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 7);
                params.start_date = start.toISOString().split('T')[0];
                params.end_date = end.toISOString().split('T')[0];
            } else if (dateRange.type === 'month') {
                const end = new Date();
                const start = new Date();
                start.setMonth(end.getMonth() - 1);
                params.start_date = start.toISOString().split('T')[0];
                params.end_date = end.toISOString().split('T')[0];
            } else if (dateRange.type === 'custom') {
                if (dateRange.start) params.start_date = dateRange.start;
                if (dateRange.end) params.end_date = dateRange.end;
            }

            const res = await api.get('/closer/stats', { params });
            setStatsData(res.data);
        } catch (err) {
            console.error("Error fetching stats", err);
        } finally {
            setLoading(false);
        }
    };

    const TabButton = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === id
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-muted-foreground hover:bg-surface'
                }`}
        >
            <Icon size={14} />
            {label}
        </button>
    );

    if (loading && !statsData) return (
        <div className="flex items-center justify-center p-20 min-h-screen">
            <Loader2 className="animate-spin text-primary" size={48} />
        </div>
    );

    return (
        <div className="p-8 max-w-[1800px] mx-auto space-y-12 animate-in fade-in duration-700">
            {/* Header & Main Filters */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-base">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-primary/10 rounded-3xl text-primary shadow-inner">
                        <Activity size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter italic uppercase">
                            Tus <span className="text-primary">Estadísticas</span>
                        </h1>
                        <p className="text-[10px] font-bold text-muted-foreground tracking-[0.3em] uppercase mt-1">Análisis de rendimiento y conversiones detalladas</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-surface/50 border border-base rounded-[2.5rem] p-2 pr-6">
                    <DateRangeFilter
                        value={dateRange}
                        onChange={setDateRange}
                        label="Rango de Fechas"
                    />
                    
                    <div className="h-8 w-px bg-base mx-2 hidden sm:block" />

                    <div className="flex bg-background p-1 rounded-2xl border border-base shadow-sm">
                        <button
                            onClick={() => setAggType('sum')}
                            className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${aggType === 'sum' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Total Suma
                        </button>
                        <button
                            onClick={() => setAggType('avg')}
                            className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${aggType === 'avg' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Promedio Diario
                        </button>
                    </div>
                </div>
            </header>

            {/* TABS SELECTION */}
            <div className="flex flex-wrap items-center gap-4 bg-surface/40 p-2 rounded-[2.5rem] border border-base w-fit">
                <TabButton id="performance" label="Rendimiento" icon={BarChart3} />
                <TabButton id="history" label="Tu Historial" icon={List} />
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'performance' && (
                    <motion.div
                        key="performance"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        {statsData && (
                            <CloserPerformanceTab stats={statsData} loading={loading} />
                        )}
                    </motion.div>
                )}

                {activeTab === 'history' && (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                    >
                        <CloserReportsTable closers={[]} isDashboardView={true} />
                    </motion.div>
                )}
            </AnimatePresence>

            <footer className="pt-20 pb-10 text-center border-t border-base">
                <p className="text-[9px] text-muted-foreground/40 font-black tracking-[0.5em] uppercase italic">
                    NeurOPS Closer Intelligence Core • Performance Analysis Session
                </p>
            </footer>
        </div>
    );
};

export default StatisticsPage;
