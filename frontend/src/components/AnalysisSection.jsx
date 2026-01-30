import { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import api from '../services/api'; // Import api to fetch data locally
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import Card from './ui/Card';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const AnalysisSection = ({ data, loading, period, onPeriodChange }) => {
    // State lifted to parent. 

    const filters = [
        { label: '7D', value: 'last_7_days' },
        { label: '14D', value: 'last_14_days' },
        { label: '3S', value: 'last_3_weeks' },
        { label: '1M', value: 'last_1_month' },
        { label: '3M', value: 'last_3_months' },
        { label: '6M', value: 'last_6_months' },
    ];

    // Gradient creation helper
    const createGradient = (ctx, area) => {
        const gradient = ctx.createLinearGradient(0, area.bottom, 0, area.top);
        // Purple to transparent/lighter purple
        gradient.addColorStop(0, 'rgba(124, 58, 237, 0.2)'); // Violet-600 low opacity
        gradient.addColorStop(1, 'rgba(139, 92, 246, 1)');   // Violet-500 solid
        return gradient;
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 2000,
            easing: 'easeOutQuart',
        },
        plugins: {
            legend: {
                display: false, // Minimalist: Hide legend if it's just one metric obvious by title
            },
            tooltip: {
                backgroundColor: 'rgba(17, 17, 20, 0.8)', // Glass dark
                titleColor: '#fff',
                bodyColor: '#e2e8f0',
                padding: 12,
                cornerRadius: 12,
                displayColors: false, // Hide color box for cleaner look
                callbacks: {
                    title: (items) => {
                        return items[0].label;
                    },
                    label: (context) => {
                        return `Ingresos: $${context.raw.toLocaleString()}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    display: false, // No grid lines
                    drawBorder: false,
                },
                ticks: {
                    color: '#64748b', // Slate-500
                    font: {
                        family: 'Inter',
                        size: 10
                    },
                    callback: (value) => value >= 1000 ? `${value / 1000}k` : value, // Minimalist compact numbers
                    padding: 10
                },
                border: {
                    display: false
                }
            },
            x: {
                grid: {
                    display: false,
                    drawBorder: false,
                },
                ticks: {
                    color: '#94a3b8',
                    font: {
                        family: 'Inter',
                        size: 11,
                        weight: '500'
                    },
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 7
                },
                border: {
                    display: false
                }
            },
        },
        elements: {
            bar: {
                borderRadius: 20, // Fully rounded top and bottom if possible, or high number
                borderSkipped: false, // Round all corners
            }
        }
    };

    const formattedData = {
        labels: data?.dates_labels || [],
        datasets: [
            {
                label: 'Cobrado',
                data: data?.revenue_values || [],
                backgroundColor: (context) => {
                    const { ctx, chartArea } = context.chart;
                    if (!chartArea) {
                        return null;
                    }
                    return createGradient(ctx, chartArea);
                },
                hoverBackgroundColor: '#a78bfa', // Violet-400
                barThickness: 'flex',
                maxBarThickness: 40, // Slightly wider for modern look
                minBarLength: 5, // Always show a little bar even if 0 to show presence
            },
        ],
    };

    return (
        <Card variant="surface" className="flex flex-col h-[400px] border border-base/50 bg-surface/50 backdrop-blur-sm shadow-glass" padding="p-0">
            <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-base/50 gap-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">Análisis de Ingresos</h3>

                {/* Neon Tabs */}
                <div className="flex bg-black/40 rounded-lg p-1 gap-1 overflow-x-auto custom-scrollbar">
                    {filters.map(filter => (
                        <button
                            key={filter.value}
                            onClick={() => onPeriodChange(filter.value)}
                            className={`relative px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all duration-300 min-w-[32px] ${period === filter.value
                                ? 'text-white'
                                : 'text-muted hover:text-white'
                                }`}
                        >
                            {period === filter.value && (
                                <span className="absolute inset-0 bg-primary/20 rounded-md border border-primary/20 shadow-[0_0_10px_rgba(157,78,221,0.3)]"></span>
                            )}
                            <span className="relative z-10">{filter.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 p-6 min-h-0 relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface/20 backdrop-blur-sm z-10 text-xs font-bold uppercase tracking-widest text-primary animate-pulse">
                        Cargando...
                    </div>
                ) : (
                    <Bar data={formattedData} options={options} />
                )}
            </div>
        </Card>
    );
};

export default AnalysisSection;
