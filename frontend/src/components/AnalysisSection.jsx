import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import api from '../services/api'; // Import api to fetch data locally
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import Card from './ui/Card';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const AnalysisSection = ({ data, loading, period, onPeriodChange }) => {
    // State lifted to parent. 



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
            line: {
                tension: 0 // Straight lines ("rectas")
            },
            point: {
                radius: 4,
                hitRadius: 10,
                hoverRadius: 6,
            }
        }
    };

    const formattedData = {
        labels: data?.dates_labels || [],
        datasets: [
            {
                label: 'Cobrado',
                data: data?.revenue_values || [],
                fill: true, // Area chart
                backgroundColor: (context) => {
                    const { ctx, chartArea } = context.chart;
                    if (!chartArea) {
                        return null;
                    }
                    return createGradient(ctx, chartArea);
                },
                borderColor: '#8b5cf6', // Violet-500
                borderWidth: 2,
                pointBackgroundColor: '#18181b', // Zinc-950 (dark background)
                pointBorderColor: '#8b5cf6', // Violet-500
                pointBorderWidth: 2,
            },
        ],
    };

    return (
        <Card variant="surface" className="flex flex-col h-[400px] border border-base/50 bg-surface/50 backdrop-blur-sm shadow-glass" padding="p-0">
            <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-base/50 gap-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white">Análisis de Ingresos</h3>
            </div>

            <div className="flex-1 p-6 min-h-0 relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface/20 backdrop-blur-sm z-10 text-xs font-bold uppercase tracking-widest text-primary animate-pulse">
                        Cargando...
                    </div>
                ) : (
                    <Line data={formattedData} options={options} />
                )}
            </div>
        </Card>
    );
};

export default AnalysisSection;
