import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import PerformanceFilters from './components/PerformanceFilters';
import PerformanceKpis from './components/PerformanceKpis';
import PerformancePendientes from './components/PerformancePendientes';
import PerformanceFunnel from './components/PerformanceFunnel';
import PerformanceQuality from './components/PerformanceQuality';
import PerformanceSenas from './components/PerformanceSenas';
import PerformanceMoney from './components/PerformanceMoney';
import PerformanceActivity from './components/PerformanceActivity';
import PerformanceRanking from './components/PerformanceRanking';
import DataSourceLegend from './components/DataSourceLegend';
import DataIssuesPanel from './components/DataIssuesPanel';
import SlotsPrompt from './components/SlotsPrompt';
import { periodLabel, compareLabel } from './performanceUtils';
import { detectIssues } from './dataIssues';

const SectionTitle = ({ children }) => (
    <h2 className="text-[11.5px] font-black tracking-widest uppercase text-muted mt-10 mb-4 flex items-center gap-3 first:mt-0">
        {children}
        <span className="flex-1 h-px bg-base" />
    </h2>
);

/* `onNavigate` lo pasa CloserWorkflowPage: permite que los botones de "arreglar este dato"
   lleven directo a la pestaña donde se corrige (el reporte del día o la bandeja). Cuando el
   dashboard se abre suelto (ruta de admin) no se pasa, y los avisos muestran solo los pasos. */
const CloserDashboard = ({ embedded = false, onNavigate = null }) => {
    const { user } = useAuth();

    const [period, setPeriod] = useState('mes');
    const [compare, setCompare] = useState('prev');
    const [closerId, setCloserId] = useState('all');
    // Rango libre: solo viaja al backend con period === 'custom'.
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const rangoIncompleto = period === 'custom' && !(customRange.start && customRange.end);

    const fetchData = useCallback(async () => {
        // Con el rango libre a medio elegir no se pide nada: se espera a que estén las dos puntas.
        if (rangoIncompleto) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/closer/performance-dashboard', {
                params: {
                    period, compare, closer_id: closerId,
                    ...(period === 'custom' ? { start_date: customRange.start, end_date: customRange.end } : {})
                }
            });
            setData(res.data);
        } catch (err) {
            console.error('Error fetching performance dashboard', err);
            setError('No se pudo cargar el dashboard de performance.');
        } finally {
            setLoading(false);
        }
    }, [period, compare, closerId, customRange.start, customRange.end, rangoIncompleto]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const minHeightClass = embedded ? 'min-h-[60vh]' : 'min-h-screen';

    if (rangoIncompleto && !data) {
        return (
            <div className={`flex items-center justify-center ${minHeightClass}`}>
                <p className="text-muted text-sm">Elegí las dos fechas del rango personalizado.</p>
            </div>
        );
    }

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
        ? `· ${periodLabel(period, data.dates)}`
        : `· ${periodLabel(period, data.dates)} vs. ${compareLabel(compare, data.dates)}`;

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
                        customRange={customRange}
                        setCustomRange={setCustomRange}
                    />
                </header>

                <div className="mt-6">
                    <DataSourceLegend coverage={data.reports_coverage} />
                </div>

                <SectionTitle>Resultado <span className="normal-case text-[10px] font-medium text-muted/80 lowercase">{compareNote}</span></SectionTitle>
                <PerformanceKpis current={data.current} previous={data.previous} deuda={data.cuotas_por_cobrar.total} coverage={data.reports_coverage} />

                <SectionTitle>Lo que falta completar <span className="normal-case text-[10px] font-medium text-muted/80 lowercase">· a hoy, fuera del período filtrado</span></SectionTitle>
                <PerformancePendientes pendientes={data.pendientes} onNavigate={onNavigate} />

                <SectionTitle>Dónde se cae el embudo</SectionTitle>
                <PerformanceFunnel funnel={data.current.funnel} perdidas={data.current.perdidas} coverage={data.reports_coverage} confirmaciones={data.current.confirmaciones} />

                <SectionTitle>Calidad de la llamada</SectionTitle>
                <PerformanceQuality rings={data.current.rings} funnel={data.current.funnel} confirmaciones={data.current.confirmaciones} />

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

                {/* Lo que hay que cargar para que los números de arriba cierren: los cupos de
                    agenda (el único dato que no sale de la bandeja) y los reportes sin enviar.
                    Va al final a pedido del usuario (24/ago/2026): son tareas de mantenimiento
                    del dato, no lo que el closer viene a leer al abrir el dashboard. */}
                <SectionTitle>Para actualizar <span className="normal-case text-[10px] font-medium text-muted/80 lowercase">· lo que falta cargar</span></SectionTitle>
                <div className="space-y-4">
                    {user?.role === 'closer' && <SlotsPrompt period={period} range={customRange} onSaved={fetchData} />}
                    <DataIssuesPanel issues={detectIssues(data)} onNavigate={onNavigate} />
                </div>
            </div>
        </div>
    );
};

export default CloserDashboard;
