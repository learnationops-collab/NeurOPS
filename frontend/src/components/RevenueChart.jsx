import { useState, useEffect } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import api from '../services/api';
import Card from './ui/Card';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Activity, Layers, Users, CreditCard, DollarSign, Hash } from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

// Control Button Helper
const ControlBtn = ({ active, onClick, icon: Icon, label }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${active
            ? 'bg-primary/20 text-white border-primary/20 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
            : 'bg-black/20 text-slate-400 border-transparent hover:text-white hover:bg-white/5'
            }`}
    >
        {Icon && <Icon size={12} />}
        {label}
    </button>
);

const RevenueChart = ({ filters }) => {
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Chart Builder States
    const [granularity, setGranularity] = useState('day');
    const [groupBy, setGroupBy] = useState('program');
    const [metric, setMetric] = useState('amount'); // 'amount', 'count'
    const [chartType, setChartType] = useState('bar'); // 'bar', 'line'

    useEffect(() => {
        fetchChartData();
    }, [filters, granularity, groupBy, metric]);

    const fetchChartData = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                period: filters.period,
                granularity: granularity,
                group_by: groupBy,
                metric: metric,
                start_date: filters.start_date || '',
                end_date: filters.end_date || ''
            });

            if (filters.closer_ids?.length) queryParams.append('closer_ids', filters.closer_ids.join(','));
            if (filters.program_ids?.length) queryParams.append('program_ids', filters.program_ids.join(','));

            const response = await api.get(`/admin/dashboard/revenue-chart?${queryParams.toString()}`);
            setChartData(response.data);
        } catch (error) {
            console.error("Error fetching revenue chart", error);
        } finally {
            setLoading(false);
        }
    };

    // Color Palette
    const colors = [
        '#10b981', '#3b82f6', '#8b5cf6', '#f43f5e',
        '#f59e0b', '#06b6d4', '#ec4899', '#6366f1',
        '#d946ef', '#14b8a6', '#f97316', '#22c55e'
    ];

    const data = {
        labels: chartData?.labels || [],
        datasets: chartData?.datasets?.map((ds, index) => ({
            label: ds.label,
            data: ds.data,
            backgroundColor: chartType === 'line' ? `${colors[index % colors.length]}33` : colors[index % colors.length], // Transparent for area
            borderColor: colors[index % colors.length],
            borderWidth: 2,
            borderRadius: 4,
            stack: chartType === 'bar' ? 'stack1' : undefined,
            tension: 0.4,
            fill: chartType === 'line',
            pointBackgroundColor: colors[index % colors.length],
        })) || []
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#94a3b8',
                    font: { family: 'Inter', size: 10 },
                    usePointStyle: true,
                    boxWidth: 6
                }
            },
            tooltip: {
                backgroundColor: 'rgba(17, 17, 20, 0.95)',
                titleColor: '#fff',
                bodyColor: '#e2e8f0',
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: (context) => {
                        let val = context.raw;
                        if (metric === 'amount') val = `$${val.toLocaleString()}`;
                        return `${context.dataset.label}: ${val}`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#64748b', font: { size: 10 } }
            },
            y: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: {
                    color: '#64748b',
                    font: { size: 10 },
                    callback: (value) => {
                        if (metric === 'amount') return `$${value >= 1000 ? value / 1000 + 'k' : value}`;
                        return value;
                    }
                }
            }
        }
    };

    return (
        <Card variant="surface" className="flex flex-col h-[500px] border border-base/50 bg-surface/50 backdrop-blur-sm shadow-glass" padding="p-0">
            {/* Header: Controls */}
            <div className="flex flex-col gap-4 p-4 border-b border-base/30">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2">
                        <Activity className="text-primary" size={16} />
                        Explorador de Ventas
                    </h3>

                    {/* Visual Type */}
                    <div className="flex bg-black/40 rounded-lg p-1 gap-1">
                        <button title="Barras" onClick={() => setChartType('bar')} className={`p-1.5 rounded-md transition-colors ${chartType === 'bar' ? 'text-primary bg-white/10' : 'text-slate-500 hover:text-white'}`}><Activity size={14} /></button>
                        <button title="Lineas" onClick={() => setChartType('line')} className={`p-1.5 rounded-md transition-colors ${chartType === 'line' ? 'text-primary bg-white/10' : 'text-slate-500 hover:text-white'}`}><Activity size={14} /></button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Metric & Dimensions */}
                    <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-2 mr-4 border-r border-white/10 pr-4">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Métrica:</span>
                            <div className="flex gap-1">
                                <ControlBtn active={metric === 'amount'} onClick={() => setMetric('amount')} icon={DollarSign} label="Ingresos" />
                                <ControlBtn active={metric === 'count'} onClick={() => setMetric('count')} icon={Hash} label="Cantidad" />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Agrupar Por:</span>
                            <div className="flex flex-wrap gap-1">
                                <ControlBtn active={groupBy === 'general'} onClick={() => setGroupBy('general')} icon={Activity} label="General" />
                                <ControlBtn active={groupBy === 'program'} onClick={() => setGroupBy('program')} icon={Layers} label="Programa" />
                                <ControlBtn active={groupBy === 'payment_type'} onClick={() => setGroupBy('payment_type')} icon={CreditCard} label="Tipo Pago" />
                                <ControlBtn active={groupBy === 'closer'} onClick={() => setGroupBy('closer')} icon={Users} label="Closer" />
                                <ControlBtn active={groupBy === 'payment_method'} onClick={() => setGroupBy('payment_method')} icon={CreditCard} label="Método" />
                            </div>
                        </div>
                    </div>

                    {/* Time Granularity */}
                    <div className="flex bg-black/40 rounded-lg p-1 gap-1">
                        {['day', 'week', 'month'].map(g => (
                            <button
                                key={g}
                                onClick={() => setGranularity(g)}
                                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors ${granularity === g ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/20' : 'text-muted hover:text-white'}`}
                            >
                                {g === 'day' ? 'Día' : g === 'week' ? 'Sem' : 'Mes'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 p-4 relative min-h-0">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface/20 backdrop-blur-sm z-10 rounded-b-2xl">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="h-full w-full">
                        {chartType === 'bar' ? <Bar data={data} options={options} /> : <Line data={data} options={options} />}
                    </div>
                )}
            </div>
        </Card>
    );
};

export default RevenueChart;
