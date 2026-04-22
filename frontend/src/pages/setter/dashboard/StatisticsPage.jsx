import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Loader2, TrendingUp, Users, Target, CalendarDays, PieChart, BarChart3, X, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import { ResponsiveContainer, FunnelChart, Funnel, LabelList, Tooltip, Cell, PieChart as RePieChart, Pie } from 'recharts';

const SetterStatisticsPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const statsRes = await api.get('/setter/stats/summary', {
                    params: {
                        start_date: dateRange.start,
                        end_date: dateRange.end
                    }
                });
                setStats(statsRes.data || {});
            } catch (err) {
                console.error("Error fetching stats:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [dateRange]);

    const handleDateChange = (e) => {
        setDateRange(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    // --- CALCULATIONS ---
    const rawStages = stats?.stage_metrics || [];
    const funnelData = rawStages.map((stage, index) => {
        let conversion = 0;
        let conversionBase = 'N/A';
        if (index === 0) {
            conversion = 100;
        } else if (rawStages[index - 1].value > 0) {
            conversion = ((stage.value / rawStages[index - 1].value) * 100).toFixed(0);
            conversionBase = rawStages[index - 1].name;
        }
        return {
            ...stage,
            conversion,
            conversionBase
        };
    });

    const noLeadValue = stats?.total_not_lead || 0;
    const totalInbound = stats?.total_leads || 0;
    const qualifiedLeads = Math.max(0, totalInbound - noLeadValue);

    const leadQualityData = [
        { name: 'Cualificados', value: qualifiedLeads, fill: 'var(--color-primary)' },
        { name: 'Descartados', value: noLeadValue, fill: '#ef4444' }
    ];

    const bookingPct = qualifiedLeads > 0
        ? ((funnelData[funnelData.length - 1]?.value || 0) / qualifiedLeads * 100).toFixed(0)
        : 0;

    return (
        <div className="min-h-screen text-base p-4 md:p-12 font-main selection:bg-primary/20 overflow-y-auto custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-12">

                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-base pb-10">
                    <div className="space-y-6">
                        <button
                            onClick={() => navigate('/setter/report')}
                            className="flex items-center gap-2 text-primary hover:text-white transition-all group border border-primary/30 px-4 py-2 rounded-full hover:bg-primary/10 shadow-lg shadow-primary/5"
                        >
                            <Target size={16} className="group-hover:scale-110 transition-transform duration-300" />
                            <span className="font-black uppercase tracking-widest text-[10px]">Ir al Reporte Diario</span>
                        </button>
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-primary/10 rounded-[2rem] text-primary border border-primary/20 shadow-lg shadow-primary/5">
                                <TrendingUp size={32} />
                            </div>
                            <div>
                                <h1 className="text-5xl font-black italic tracking-tighter uppercase text-base leading-none">
                                    Rendimiento <span className="text-primary underline decoration-primary/20 underline-offset-8">Setter</span>
                                </h1>
                                <p className="text-[10px] font-black text-muted uppercase tracking-[0.3em] mt-3">
                                    Analytics & Performance Metrics
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-surface p-2 rounded-2xl shadow-xl border border-base">
                        <Calendar size={18} className="text-primary ml-3" />
                        <div className="flex items-center gap-3 pr-2">
                            <input
                                type="date"
                                name="start"
                                value={dateRange.start}
                                onChange={handleDateChange}
                                className="bg-transparent border-none text-[10px] font-black text-base focus:ring-0 p-0 uppercase"
                            />
                            <span className="text-muted font-black">—</span>
                            <input
                                type="date"
                                name="end"
                                value={dateRange.end}
                                onChange={handleDateChange}
                                className="bg-transparent border-none text-[10px] font-black text-base focus:ring-0 p-0 uppercase"
                            />
                        </div>
                        {loading && (
                            <div className="pr-2 border-l border-base ml-2 pl-3">
                                <Loader2 className="animate-spin text-primary" size={16} />
                            </div>
                        )}
                    </div>
                </header>

                {loading && !stats ? (
                    <div className="h-[50vh] flex flex-col items-center justify-center gap-6">
                        <Loader2 className="animate-spin text-primary" size={56} />
                        <div className="text-center space-y-2">
                            <p className="font-black italic uppercase text-sm text-base tracking-tighter">Sincronizando Métricas...</p>
                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Calculando kpis en tiempo real</p>
                        </div>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-16"
                    >
                        {/* 1. Main Metrics Grid */}
                        <div className="space-y-8">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xs font-black uppercase tracking-[0.4em] text-muted">Resumen Operativo</h2>
                                <div className="h-px bg-base flex-1" />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <MetricCard label="Leads Totales" value={totalInbound} icon={<Users size={20} />} tooltipInfo="Suma de leads recibidos en el inbox (Entrantes)." />
                                    <MetricCard label="Cualificados" value={qualifiedLeads} icon={<Target size={20} />} tooltipInfo="Leads reales filtrados. Cálculo: (Entrantes - Descartados)." />
                                    <MetricCard
                                        label="% Agendamiento"
                                        value={`${bookingPct}%`}
                                        icon={<CalendarDays size={20} />}
                                        highlight
                                        tooltipInfo="Porcentaje de leads cualificados que finalmente agendaron. Cálculo: (Agendas / Cualificados)."
                                    />
                                </div>

                                <Card variant="surface" className="lg:col-span-4 p-8 flex items-center gap-8 border-base/50 shadow-2xl">
                                    <div className="w-32 h-32 flex-shrink-0 relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RePieChart>
                                                <Pie
                                                    data={leadQualityData}
                                                    innerRadius={35}
                                                    outerRadius={55}
                                                    paddingAngle={8}
                                                    dataKey="value"
                                                    stroke="none"
                                                >
                                                    {leadQualityData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.fill} cornerRadius={6} />
                                                    ))}
                                                </Pie>
                                            </RePieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <PieChart className="text-muted/20" size={24} />
                                        </div>
                                    </div>
                                    <div className="space-y-4 flex-1">
                                        <h4 className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">Calidad de Leads</h4>
                                        <div className="space-y-3">
                                            <LegendItem color="bg-primary" label="Cualificados" percent={totalInbound > 0 ? ((qualifiedLeads / totalInbound) * 100).toFixed(0) : 0} />
                                            <LegendItem color="bg-rose-500" label="Descartados" percent={totalInbound > 0 ? ((noLeadValue / totalInbound) * 100).toFixed(0) : 0} />
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>

                        {/* 2. Funnel Visualization */}
                        <div className="space-y-8">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xs font-black uppercase tracking-[0.4em] text-muted">Pipeline de Conversión</h2>
                                <div className="h-px bg-base flex-1" />
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                                {/* Table View */}
                                <div className="xl:col-span-5 self-start">
                                    <Card variant="surface" padding="p-0" className="border-base/50 overflow-hidden shadow-2xl">
                                        <div className="p-6 border-b border-base bg-surface-hover/30">
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                <BarChart3 size={14} /> Detalle por Etapa
                                            </h3>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-main/20 border-b border-base">
                                                    <tr>
                                                        <th className="px-6 py-4 text-[9px] font-black text-muted uppercase tracking-widest">#</th>
                                                        <th className="px-6 py-4 text-[9px] font-black text-muted uppercase tracking-widest">Etapa</th>
                                                        <th className="px-6 py-4 text-[9px] font-black text-muted uppercase tracking-widest text-right">Total</th>
                                                        <th className="px-6 py-4 text-[9px] font-black text-muted uppercase tracking-widest text-right">% Conv.</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-base/30">
                                                    {funnelData.map((item, i) => (
                                                        <tr key={item.id} className="hover:bg-primary/5 transition-all group">
                                                            <td className="px-6 py-4 text-[10px] font-bold text-muted/50">{i + 1}</td>
                                                            <td className="px-6 py-4 text-[10px] font-black uppercase text-base tracking-tight group-hover:text-primary transition-colors">{item.name}</td>
                                                            <td className="px-6 py-4 text-xs font-black text-base text-right font-mono">{item.value}</td>
                                                            <td className="px-6 py-4 text-[10px] font-black text-primary text-right italic">
                                                                <Badge variant="primary" className="px-2 py-0.5">{item.conversion}%</Badge>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {funnelData.length === 0 && (
                                                        <tr>
                                                            <td colSpan="4" className="px-6 py-12 text-center text-muted italic text-[10px] font-bold uppercase tracking-widest">No hay datos de embudo disponibes</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </Card>
                                </div>

                                {/* Recharts Funnel */}
                                <Card variant="surface" className="xl:col-span-12 lg:xl:col-span-7 h-[500px] flex flex-col items-center justify-center p-8 border-base/50 shadow-2xl">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <FunnelChart>
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'var(--color-surface)',
                                                    borderRadius: '16px',
                                                    border: '1px solid var(--color-border)',
                                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
                                                    padding: '12px'
                                                }}
                                                itemStyle={{ fontWeight: '900', color: 'var(--color-text-base)', textTransform: 'uppercase', fontSize: '10px' }}
                                                labelStyle={{ display: 'none' }}
                                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            />
                                            <Funnel
                                                dataKey="value"
                                                data={funnelData}
                                                isAnimationActive
                                            >
                                                <LabelList
                                                    position="right"
                                                    fill="var(--color-text-muted)"
                                                    stroke="none"
                                                    dataKey="name"
                                                    className="font-black text-[9px] uppercase tracking-tighter"
                                                />
                                                <LabelList
                                                    position="center"
                                                    fill="#ffffff"
                                                    stroke="none"
                                                    dataKey="value"
                                                    content={({ x, y, width, height, value }) => (
                                                        <text x={x + width / 2} y={y + height / 2} fill="#fff" textAnchor="middle" className="font-black text-xl drop-shadow-md">
                                                            {value}
                                                        </text>
                                                    )}
                                                />
                                                {funnelData.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={index === 0 ? 'var(--color-primary)' : index === funnelData.length - 1 ? 'var(--color-primary)' : 'var(--color-border)'}
                                                        stroke="var(--color-bg)"
                                                        strokeWidth={2}
                                                        opacity={1 - (index * 0.12)}
                                                    />
                                                ))}
                                            </Funnel>
                                        </FunnelChart>
                                    </ResponsiveContainer>
                                    <div className="mt-8 flex items-center gap-4 text-[9px] font-black text-muted uppercase tracking-[0.2em] bg-main/50 px-6 py-2 rounded-full border border-base">
                                        <span>Progresión de Conversión</span>
                                        <div className="w-1 h-1 bg-primary rounded-full" />
                                        <span>Últimos 30 días</span>
                                    </div>
                                </Card>
                            </div>
                        </div>

                        {/* Footer decorative */}
                        <footer className="pt-20 text-center border-t border-base/30">
                            <p className="text-[9px] font-black text-muted/30 uppercase tracking-[0.8em] italic">
                                ALTO RENDIMIENTO • © {new Date().getFullYear()} NEUROPS ANALYTICS SYSTEM
                            </p>
                        </footer>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

const MetricCard = ({ label, value, icon, highlight, tooltipInfo }) => (
    <Card variant="surface" className={`p-8 border-base/50 shadow-xl border-b-4 ${highlight ? 'border-primary shadow-primary/5' : 'border-base'} transition-all hover:translate-y-[-4px] group overflow-visible`}>
        <div className="flex justify-between items-start mb-8">
            <span className={`p-3 rounded-2xl ${highlight ? 'bg-primary/20 text-primary shadow-glow shadow-primary/20' : 'bg-surface-hover/50 text-muted'} border border-white/5 transition-all duration-500 group-hover:scale-110`}>
                {icon}
            </span>
        </div>
        <div className="space-y-1">
            <div className="flex items-center gap-1.5 mb-2">
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${highlight ? 'text-primary' : 'text-muted'}`}>
                    {label}
                </p>
                {tooltipInfo && (
                    <div className="relative group/tooltip inline-block z-50">
                        <HelpCircle size={12} className="text-muted cursor-help hover:text-primary transition-colors" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-surface border border-base text-base text-[10px] font-medium normal-case tracking-normal rounded-xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-all pointer-events-none shadow-xl">
                            {tooltipInfo}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface"></div>
                        </div>
                    </div>
                )}
            </div>
            <p className={`text-5xl font-black italic tracking-tighter ${highlight ? 'text-base' : 'text-base opacity-90'}`}>
                {value}
            </p>
        </div>
    </Card>
);

const LegendItem = ({ color, label, percent }) => (
    <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${color} shadow-lg ${color === 'bg-primary' ? 'shadow-primary/40' : 'shadow-rose-500/40'}`} />
            <span className="text-[10px] font-black text-muted uppercase tracking-tight">{label}</span>
        </div>
        <Badge variant={color === 'bg-primary' ? 'primary' : 'rose'} className="px-2 py-0.5 font-mono text-[10px]">{percent}%</Badge>
    </div>
);

export default SetterStatisticsPage;
