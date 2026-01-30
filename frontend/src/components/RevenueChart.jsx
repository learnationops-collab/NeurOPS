import { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import api from '../services/api';
import Card from './ui/Card';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const RevenueChart = ({ filters }) => {
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Internal state for chart controls
    const [granularity, setGranularity] = useState('day');
    const [groupBy, setGroupBy] = useState('program'); // 'program' | 'payment_type'

    useEffect(() => {
        fetchChartData();
    }, [filters, granularity, groupBy]);

    const fetchChartData = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                period: filters.period,
                granularity: granularity,
                group_by: groupBy,
                start_date: filters.start_date || '',
                end_date: filters.end_date || ''
            });

            if (filters.closer_ids?.length) queryParams.append('closer_ids', filters.closer_ids.join(','));

            // Program filter? Usually if we filter by program, grouping by program shows only that program.
            // But user might want to see breakdown of Payment Types for that program.
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
        '#10b981', // Emerald-500
        '#3b82f6', // Blue-500
        '#8b5cf6', // Violet-500
        '#f43f5e', // Rose-500
        '#f59e0b', // Amber-500
        '#06b6d4', // Cyan-500
        '#ec4899', // Pink-500
        '#6366f1'  // Indigo-500
    ];

    const data = {
        labels: chartData?.labels || [],
        datasets: chartData?.datasets?.map((ds, index) => ({
            label: ds.label,
            data: ds.data,
            backgroundColor: colors[index % colors.length],
            borderRadius: 4,
            stack: 'stack1', // All in same stack
        })) || []
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
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
                backgroundColor: 'rgba(17, 17, 20, 0.9)',
                titleColor: '#fff',
                bodyColor: '#e2e8f0',
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: (context) => `${context.dataset.label}: $${context.raw.toLocaleString()}`
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
                    callback: (value) => `$${value >= 1000 ? value / 1000 + 'k' : value}`
                }
            }
        }
    };

    return (
        <Card variant="surface" className="flex flex-col h-[450px] border border-base/50 bg-surface/50 backdrop-blur-sm shadow-glass" padding="p-0">
            {/* Header with Controls */}
            <div className="flex flex-col md:flex-row items-center justify-between px-6 py-4 border-b border-base/50 gap-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">Desglose de Ingresos</h3>

                <div className="flex gap-4">
                    {/* Group By Selector using Tabs style */}
                    <div className="flex bg-black/40 rounded-lg p-1 gap-1">
                        <button
                            onClick={() => setGroupBy('program')}
                            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors ${groupBy === 'program' ? 'bg-primary/20 text-white border border-primary/20' : 'text-muted hover:text-white'}`}
                        >
                            Por Programa
                        </button>
                        <button
                            onClick={() => setGroupBy('payment_type')}
                            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors ${groupBy === 'payment_type' ? 'bg-primary/20 text-white border border-primary/20' : 'text-muted hover:text-white'}`}
                        >
                            Por Tipo Pago
                        </button>
                    </div>

                    {/* Granularity Selector */}
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

            <div className="flex-1 p-6 relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface/20 backdrop-blur-sm z-10">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <Bar data={data} options={options} />
                )}
            </div>
        </Card>
    );
};

export default RevenueChart;
