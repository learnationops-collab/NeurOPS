import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import PerformanceFilters from './components/PerformanceFilters';
import PerformanceKpis from './components/PerformanceKpis';
import PerformanceFunnel from './components/PerformanceFunnel';
import PerformanceQuality from './components/PerformanceQuality';
import PerformanceSenas from './components/PerformanceSenas';
import PerformanceMoney from './components/PerformanceMoney';
import PerformanceActivity from './components/PerformanceActivity';
import PerformanceRanking from './components/PerformanceRanking';
import DataSourceLegend from './components/DataSourceLegend';
import { PERIOD_LABELS, COMPARE_LABELS } from './performanceUtils';

const SectionTitle = ({ children }) => (
    <h2 className="text-[11.5px] font-black tracking-widest uppercase text-muted mt-10 mb-4 flex items-center gap-3 first:mt-0">
        {children}
        <span className="flex-1 h-px bg-base" />
    </h2>
);

const CloserDashboard = ({ embedded = false }) => {
    const { user } = useAuth();

    const [period, setPeriod] = useState('mes');
    const [compare, setCompare] = useState('prev');
    const [closerId, setCloserId] = useState('all');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/closer/performance-dashboard', {
                params: { period, compare, closer_id: closerId }
            });
            setData(res.data);
        } catch (err) {
            console.error('Error fetching performance dashboard', err);
            setError('No se pudo cargar el dashboard de performance.');
        } finally {
            setLoading(false);
        }
    }, [period, compare, closerId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const minHeightClass = embedded ? 'min-h-[60vh]' : 'min-h-screen';

    if (loading && !data) {
        return (
            <div className={`flex items-center justify-center ${minHeightClass}`}>
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className={`flex flex-col items-center justify-center ${minHeightClass} gap-4`}>
                <p className="text-muted">{error || 'Sin datos.'}</p>
                <button onClick={fetchData} className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-wider">Reintentar</button>
            </div>
        );
    }

    const compareNote = compare === 'none'
        ? `· ${PERIOD_LABELS[period]}`
        : `· ${PERIOD_LABELS[period]} vs. ${COMPARE_LABELS[compare]}`;

    return (
        <div className={embedded ? '' : 'min-h-screen bg-main p-6 md:p-10'}>
            <div className={embedded ? '' : 'max-w-7xl mx-auto'}>
                <header className="flex flex-wrap justify-between items-center gap-4 border-b border-base pb-6 mb-2">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-base">Dashboard de Performance</h1>
                        <p className="text-[10px] font-bold text-muted tracking-widest mt-1 uppercase">Learnation · Analítica de closers</p>
                    </div>
                    <PerformanceFilters
                        closers={data.closers}
                        closerId={closerId}
                        setCloserId={setCloserId}
                        period={period}
                        setPeriod={setPeriod}
                        compare={compare}
                        setCompare={setCompare}
                        showClosersFilter={user?.role === 'admin'}
                    />
                </header>

                <div className="mt-6">
                    <DataSourceLegend coverage={data.reports_coverage} />
                </div>

                <SectionTitle>Resultado <span className="normal-case text-[10px] font-medium text-muted/80 lowercase">{compareNote}</span></SectionTitle>
                <PerformanceKpis current={data.current} previous={data.previous} deuda={data.cuotas_por_cobrar.total} coverage={data.reports_coverage} />

                <SectionTitle>Dónde se cae el embudo</SectionTitle>
                <PerformanceFunnel funnel={data.current.funnel} perdidas={data.current.perdidas} coverage={data.reports_coverage} confirmaciones={data.current.confirmaciones} />

                <SectionTitle>Calidad de la llamada</SectionTitle>
                <PerformanceQuality rings={data.current.rings} />

                <SectionTitle>Señas <span className="normal-case text-[10px] font-medium text-muted/80 lowercase">· reservas, no ventas</span></SectionTitle>
                <PerformanceSenas senas={data.current.senas} />

                <SectionTitle>Dinero</SectionTitle>
                <PerformanceMoney cashMix={data.current.cash_mix} cuotas={data.cuotas_por_cobrar} programas={data.current.programas} />

                <SectionTitle>Fuente, actividad y referidos</SectionTitle>
                <PerformanceActivity
                    fuente={data.fuente}
                    actividad={data.current.actividad}
                    referidos={data.current.referidos}
                    reportsProductivity={data.reports_productivity}
                />

                <SectionTitle>Equipo</SectionTitle>
                <PerformanceRanking ranking={data.ranking} selectedCloserId={closerId} alerts={data.alerts} />
            </div>
        </div>
    );
};

export default CloserDashboard;
