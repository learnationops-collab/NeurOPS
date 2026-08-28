import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import PerformanceFilters from './components/PerformanceFilters';
import PerformanceHighlights from './components/PerformanceHighlights';
import PerformanceKpis from './components/PerformanceKpis';
import PerformancePendientes from './components/PerformancePendientes';
import PerformanceFunnel, { ConfirmacionesCard } from './components/PerformanceFunnel';
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
    // Rangos libres: cada uno solo viaja al backend cuando su selector está en 'custom'.
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [compareRange, setCompareRange] = useState({ start: '', end: '' });
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const rangoIncompleto = (period === 'custom' && !(customRange.start && customRange.end))
        || (compare === 'custom' && !(compareRange.start && compareRange.end));

    const fetchData = useCallback(async () => {
        // Con el rango libre a medio elegir no se pide nada: se espera a que estén las dos puntas.
        if (rangoIncompleto) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/closer/performance-dashboard', {
                params: {
                    period, compare, closer_id: closerId,
                    ...(period === 'custom' ? { start_date: customRange.start, end_date: customRange.end } : {}),
                    ...(compare === 'custom' ? { compare_start: compareRange.start, compare_end: compareRange.end } : {})
                }
            });
            setData(res.data);
        } catch (err) {
            console.error('Error fetching performance dashboard', err);
            setError('No se pudo cargar el dashboard de performance.');
        } finally {
            setLoading(false);
        }
    }, [period, compare, closerId, customRange.start, customRange.end,
        compareRange.start, compareRange.end, rangoIncompleto]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const minHeightClass = embedded ? 'min-h-[60vh]' : 'min-h-screen';

    if (rangoIncompleto && !data) {
        return (
            <div className={`flex items-center justify-center ${minHeightClass}`}>
                <p className="text-muted text-sm">Elegí las dos fechas de cada rango personalizado.</p>
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

    const hayComparacion = Boolean(data.dates?.compare_start && data.dates?.compare_end);
    const compareNote = hayComparacion
        ? `· ${periodLabel(period, data.dates)} vs. ${compareLabel(compare, data.dates)}`
        : `· ${periodLabel(period, data.dates)}`;

    return (
        <div className={`dash-v6 ${embedded ? '' : 'min-h-screen bg-v6 p-6 md:p-10'}`}>
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
                        compareRange={compareRange}
                        setCompareRange={setCompareRange}
                    />
                </header>

                {/* "Mirá esto primero", calcada de la referencia (28/ago/2026): antes de cualquier
                    sección numerada, lo único que el closer necesita ver de entrada — su eslabón
                    más débil con el $ que ganaría si lo arregla, la deuda sin plan y qué tan bien
                    responden sus seguimientos. Sin número de sección: no es un bloque más, es la
                    lectura rápida antes de bajar al detalle. */}
                <h2 className="text-[11.5px] font-black tracking-widest uppercase text-muted mb-4">Mirá esto primero</h2>
                <PerformanceHighlights
                    rings={data.current.rings}
                    funnel={data.current.funnel}
                    confirmaciones={data.current.confirmaciones}
                    cuotas={data.cuotas_por_cobrar}
                    actividad={data.current.actividad}
                    ticketPromedio={data.current.kpis.ticket_promedio}
                    onNavigate={onNavigate}
                />

                {/* Re-secciona el dashboard calcando el agrupamiento del HTML de referencia que
                    pasó el usuario (27/ago/2026) — 5 bloques simples (Dinero / Dónde se cae /
                    Calidad de la llamada / Equipo / Para cerrar) en vez de 9 secciones sueltas.
                    Se mantiene todo lo que ya funcionaba: filtros, comparación, el detalle de
                    señas y el resumen de seguimientos — solo cambia dónde vive cada tarjeta. */}
                <SectionTitle>01 · Dinero <span className="normal-case text-[10px] font-medium text-muted/80 lowercase">{compareNote}</span></SectionTitle>
                <div className="space-y-4">
                    <PerformanceKpis current={data.current} previous={data.previous} deuda={data.cuotas_por_cobrar.total} />
                    <PerformanceMoney cuotas={data.cuotas_por_cobrar} programas={data.current.programas} />
                    <PerformanceSenas senas={data.current.senas} />
                </div>

                <SectionTitle>02 · Dónde se cae</SectionTitle>
                <PerformanceFunnel funnel={data.current.funnel} perdidas={data.current.perdidas} coverage={data.reports_coverage} cashMix={data.current.cash_mix} />

                <SectionTitle>03 · Calidad de la llamada</SectionTitle>
                <div className="space-y-4">
                    <PerformanceQuality rings={data.current.rings} funnel={data.current.funnel} confirmaciones={data.current.confirmaciones} />
                    {data.current.confirmaciones && <ConfirmacionesCard confirmaciones={data.current.confirmaciones} />}
                    <PerformanceActivity
                        fuente={data.fuente}
                        actividad={data.current.actividad}
                        referidos={data.current.referidos}
                        reportsProductivity={data.reports_productivity}
                    />
                </div>

                <SectionTitle>04 · Equipo</SectionTitle>
                <PerformanceRanking ranking={data.ranking} selectedCloserId={closerId} alerts={data.alerts} />

                {/* "Lo que falta completar" va al final a pedido del usuario (27/ago/2026): lo
                    primero que el closer debe ver al abrir la pestaña es su resultado, no su
                    lista de pendientes — esta sección queda como cierre del dashboard. */}
                <SectionTitle>Lo que falta completar <span className="normal-case text-[10px] font-medium text-muted/80 lowercase">· a hoy, fuera del período filtrado</span></SectionTitle>
                <PerformancePendientes pendientes={data.pendientes} onNavigate={onNavigate} />

                {/* Lo que hay que cargar para que los números de arriba cierren: los cupos de
                    agenda (el único dato que no sale de la bandeja) y los reportes sin enviar.
                    Va al final a pedido del usuario (24/ago/2026): son tareas de mantenimiento
                    del dato, no lo que el closer viene a leer al abrir el dashboard. */}
                <SectionTitle>05 · Para cerrar <span className="normal-case text-[10px] font-medium text-muted/80 lowercase">· lo que falta cargar</span></SectionTitle>
                <div className="space-y-4">
                    {user?.role === 'closer' && <SlotsPrompt period={period} range={customRange} onSaved={fetchData} />}
                    <DataIssuesPanel issues={detectIssues(data)} onNavigate={onNavigate} />
                    {/* La leyenda de fuentes baja acá a pedido del usuario (24/ago/2026): es
                        material de consulta, no algo que haya que leer antes de los KPIs. */}
                    <DataSourceLegend coverage={data.reports_coverage} />
                </div>
            </div>
        </div>
    );
};

export default CloserDashboard;
