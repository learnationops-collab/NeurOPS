import { useState, useEffect, useRef } from 'react';
import api from '../../../../services/api';
import { Loader2, TrendingUp, Users, DollarSign } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip as ChartTooltip,
    Legend,
    Filler
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    ChartTooltip,
    Legend,
    Filler
);

const COLOR_MAP = {
    'agendas': { main: 'rgba(59, 130, 246, 0.8)', border: 'rgb(59, 130, 246)', icon: 'text-primary' },
    'sales': { main: 'rgba(168, 85, 247, 0.8)', border: 'rgb(168, 85, 247)', icon: 'text-secondary' },
    'cash_collect': { main: 'rgba(16, 185, 129, 0.8)', border: 'rgb(16, 185, 129)', icon: 'text-emerald-500' }
};

const ICON_MAP = {
    'agendas': Users,
    'sales': TrendingUp,
    'cash_collect': DollarSign
};

const ChartTile = ({ metric, filters, size = '2x2' }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const chartRef = useRef(null);

    const [width, height] = size.split('x').map(Number);
    const isLarge = width >= 3;
    const isShort = height === 1;

    const Icon = ICON_MAP[metric] || TrendingUp;
    const colors = COLOR_MAP[metric] || COLOR_MAP['agendas'];

    useEffect(() => {
        const fetchSeries = async () => {
            setLoading(true);
            try {
                const queryParams = new URLSearchParams({
                    metric,
                    period: filters.period,
                    start_date: filters.start_date || '',
                    end_date: filters.end_date || ''
                });
                const res = await api.get(`/analytics/time-series?${queryParams.toString()}`);
                setData(res.data);
            } catch (err) {
                console.error("Error fetching time series", err);
            } finally {
                setLoading(false);
            }
        };

        if (filters) {
            fetchSeries();
        }
    }, [metric, filters]);

    const chartData = {
        labels: data?.labels?.map(l => {
            if (typeof l !== 'string') return String(l);
            // Shorten dates: 2024-03-01 -> 01/03
            const parts = l.split('-');
            return parts.length === 3 ? `${parts[2]}/${parts[1]}` : l;
        }) || [],
        datasets: [
            {
                label: metric.replace('_', ' '),
                data: data?.values || [],
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return colors.main;

                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, colors.main.replace('0.8', '0.1'));
                    gradient.addColorStop(1, colors.main);
                    return gradient;
                },
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 4,
                hoverBackgroundColor: colors.border,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 10, weight: 'bold' },
                bodyFont: { size: 12, weight: 'black' },
                displayColors: false,
                callbacks: {
                    label: (context) => (metric === 'cash_collect' ? `$${context.raw.toLocaleString()}` : context.raw)
                }
            }
        },
        scales: {
            x: {
                display: !isShort,
                grid: { display: false },
                ticks: {
                    color: 'rgba(255, 255, 255, 0.3)',
                    font: { size: 9, weight: 'bold' },
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: isLarge ? 12 : 6
                }
            },
            y: {
                display: false,
                grid: { display: false },
                beginAtZero: true
            }
        },
        interaction: {
            intersect: false,
            mode: 'index',
        },
    };

    return (
        <Card variant="surface" className="relative group overflow-hidden border-base/50 hover:border-primary/40 transition-all duration-700 h-full bg-surface/30 backdrop-blur-xl p-6">
            <div className="flex flex-col h-full relative z-10">

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl bg-surface-hover/50 ${colors.icon} border border-base/50`}>
                            <Icon size={16} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em] leading-none mb-1">
                                {metric.replace('_', ' ')}
                            </span>
                            <span className="text-[8px] font-bold text-primary/60 uppercase tracking-widest leading-none">Tendencia</span>
                        </div>
                    </div>
                </div>

                {/* Chart Area */}
                <div className="flex-1 min-h-0 w-full">
                    {loading ? (
                        <div className="h-full flex items-center justify-center">
                            <Loader2 className="animate-spin text-primary/30" size={24} />
                        </div>
                    ) : (
                        <div className="h-full w-full">
                            <Bar ref={chartRef} data={chartData} options={options} />
                        </div>
                    )}
                </div>
            </div>

            {/* Premium decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 bg-primary/5 rounded-full blur-3xl" />
        </Card>
    );
};

export default ChartTile;
