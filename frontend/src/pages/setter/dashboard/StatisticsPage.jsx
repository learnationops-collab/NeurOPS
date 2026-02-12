import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Loader2, TrendingUp, Users, Target, CalendarDays, PieChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import Button from '../../../components/ui/Button';
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
        { name: 'Cualificados', value: qualifiedLeads, fill: '#0d9488' },
        { name: 'Descartados', value: noLeadValue, fill: '#e11d48' }
    ];

    const bookingPct = qualifiedLeads > 0
        ? ((funnelData[funnelData.length - 1]?.value || 0) / qualifiedLeads * 100).toFixed(0)
        : 0;

    return (
        <div className="min-h-screen bg-[#f3f4f6] text-[#111827] p-4 md:p-8 font-inter selection:bg-primary/20">
            <div className="max-w-6xl mx-auto space-y-10">

                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-gray-200 pb-8">
                    <div className="space-y-4">
                        <button
                            onClick={() => window.close()}
                            className="flex items-center gap-2 text-gray-400 hover:text-gray-900 transition-all group"
                        >
                            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="font-bold uppercase tracking-widest text-[10px]">Cerrar Panel</span>
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-500 rounded-2xl text-white shadow-lg shadow-blue-200">
                                <TrendingUp size={32} />
                            </div>
                            <div>
                                <h1 className="text-4xl font-extrabold tracking-tighter text-gray-900">
                                    RENDIMIENTO <span className="text-blue-600">SETTER</span>
                                </h1>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    Dashboard Operativo • NeurOPS Analytics
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                        <Calendar size={18} className="text-blue-500 ml-2" />
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                name="start"
                                value={dateRange.start}
                                onChange={handleDateChange}
                                className="bg-transparent border-none text-xs font-black text-gray-700 focus:ring-0 p-0"
                            />
                            <span className="text-gray-300 font-bold">—</span>
                            <input
                                type="date"
                                name="end"
                                value={dateRange.end}
                                onChange={handleDateChange}
                                className="bg-transparent border-none text-xs font-black text-gray-700 focus:ring-0 p-0"
                            />
                        </div>
                        {loading && <Loader2 className="animate-spin text-blue-500 ml-2" size={16} />}
                    </div>
                </header>

                {loading ? (
                    <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                        <Loader2 className="animate-spin text-blue-500" size={48} />
                        <p className="font-black italic uppercase text-xs text-gray-400 tracking-tighter">Sincronizando Metricas...</p>
                    </div>
                ) : (
                    <div className="space-y-12">

                        {/* 1. Main Metrics Grid */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <i className="w-1.5 h-6 bg-blue-600 rounded-full" />
                                <h2 className="text-lg font-black uppercase tracking-tight">Cualificación de Entrada</h2>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <MetricCard label="Leads Totales" value={totalInbound} icon={<Users size={20} />} />
                                    <MetricCard label="Cualificados" value={qualifiedLeads} icon={<Target size={20} />} />
                                    <MetricCard
                                        label="% Agendamiento"
                                        value={`${bookingPct}%`}
                                        icon={<CalendarDays size={20} />}
                                        highlight
                                    />
                                </div>

                                <div className="bg-white rounded-[32px] p-6 shadow-xl shadow-gray-200/50 border border-gray-100 flex items-center gap-6">
                                    <div className="w-24 h-24 flex-shrink-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RePieChart>
                                                <Pie
                                                    data={leadQualityData}
                                                    innerRadius={30}
                                                    outerRadius={45}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {leadQualityData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.fill} cornerRadius={4} />
                                                    ))}
                                                </Pie>
                                            </RePieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Calidad de Leads</h4>
                                        <div className="space-y-1.5">
                                            <LegendItem color="bg-teal-600" label="Cualificados" percent={totalInbound > 0 ? ((qualifiedLeads / totalInbound) * 100).toFixed(0) : 0} />
                                            <LegendItem color="bg-rose-600" label="Descartados" percent={totalInbound > 0 ? ((noLeadValue / totalInbound) * 100).toFixed(0) : 0} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 2. Funnel Visualization */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <i className="w-1.5 h-6 bg-teal-600 rounded-full" />
                                <h2 className="text-lg font-black uppercase tracking-tight">Evaluación del Embudo</h2>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 bg-white rounded-[40px] p-8 shadow-2xl shadow-gray-200/60 border border-gray-100">
                                {/* Table View */}
                                <div className="xl:col-span-2 border rounded-3xl overflow-hidden self-start">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50/80">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">#</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Etapa</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">% Conv.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {funnelData.map((item, i) => (
                                                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                                                    <td className="px-6 py-4 text-xs font-bold text-gray-400">{i + 1}</td>
                                                    <td className="px-6 py-4 text-xs font-black uppercase text-gray-700 group-hover:text-blue-600 transition-colors">{item.name}</td>
                                                    <td className="px-6 py-4 text-sm font-black text-gray-900 text-right">{item.value}</td>
                                                    <td className="px-6 py-4 text-xs font-black text-blue-500 text-right italic">{item.conversion}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Recharts Funnel */}
                                <div className="xl:col-span-3 h-[450px] flex flex-col items-center justify-center p-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <FunnelChart>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                                itemStyle={{ fontWeight: 'bold' }}
                                                cursor={{ fill: '#f8fafc' }}
                                            />
                                            <Funnel
                                                dataKey="value"
                                                data={funnelData}
                                                isAnimationActive
                                            >
                                                <LabelList
                                                    position="right"
                                                    fill="#64748b"
                                                    stroke="none"
                                                    dataKey="name"
                                                    className="font-black text-[10px] uppercase tracking-tighter"
                                                />
                                                <LabelList
                                                    position="center"
                                                    fill="#ffffff"
                                                    stroke="none"
                                                    dataKey="value"
                                                    content={({ x, y, width, height, value }) => (
                                                        <text x={x + width / 2} y={y + height / 2} fill="#fff" textAnchor="middle" className="font-black text-lg drop-shadow m-0">
                                                            {value}
                                                        </text>
                                                    )}
                                                />
                                                {funnelData.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={index === 0 ? '#3b82f6' : index === funnelData.length - 1 ? '#0d9488' : '#94a3b8'}
                                                        stroke="#fff"
                                                        strokeWidth={0.5}
                                                        opacity={1 - (index * 0.1)}
                                                    />
                                                ))}
                                            </Funnel>
                                        </FunnelChart>
                                    </ResponsiveContainer>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-4">Progresión de Conversión • Datos en Tiempo Real</p>
                                </div>
                            </div>
                        </section>

                        {/* Footer decorative */}
                        <footer className="pt-10 text-center">
                            <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.5em] italic">
                                ALTO RENDIMIENTO • © {new Date().getFullYear()} NeurOPS SYSTEM
                            </p>
                        </footer>
                    </div>
                )}
            </div>
        </div>
    );
};

const MetricCard = ({ label, value, icon, highlight }) => (
    <div className={`bg-white rounded-[32px] p-8 shadow-xl shadow-gray-200/40 border-b-4 ${highlight ? 'border-teal-500' : 'border-gray-100'} transition-transform hover:scale-[1.02]`}>
        <div className="flex justify-between items-start mb-6">
            <span className={`p-2 rounded-xl ${highlight ? 'bg-teal-50 text-teal-600' : 'bg-gray-50 text-gray-400'}`}>
                {icon}
            </span>
        </div>
        <div>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${highlight ? 'text-teal-600/70' : 'text-gray-400'}`}>
                {label}
            </p>
            <p className={`text-4xl font-extrabold tracking-tighter ${highlight ? 'text-teal-700' : 'text-gray-900'}`}>
                {value}
            </p>
        </div>
    </div>
);

const LegendItem = ({ color, label, percent }) => (
    <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-[10px] font-bold text-gray-500 uppercase">{label}</span>
        </div>
        <span className="text-[10px] font-black text-gray-900 italic">{percent}%</span>
    </div>
);

export default SetterStatisticsPage;
