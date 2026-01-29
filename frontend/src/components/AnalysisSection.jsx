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

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                align: 'end',
                labels: {
                    color: '#94a3b8', // text-muted
                    font: {
                        family: 'Inter',
                        size: 9,
                        weight: 'bold'
                    },
                    boxWidth: 6,
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            tooltip: {
                backgroundColor: '#111114',
                titleColor: '#fff',
                bodyColor: '#94a3b8',
                borderColor: '#262626',
                borderWidth: 1,
                padding: 10,
                cornerRadius: 8,
                displayColors: true,
                boxPadding: 4
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: '#1f1f23', // Very faint
                    drawBorder: false,
                },
                ticks: {
                    color: '#52525b',
                    font: {
                        family: 'Inter',
                        size: 9
                    },
                    callback: (value) => `$${value}`
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
                        size: 10,
                        weight: '500'
                    },
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 8
                },
                border: {
                    display: false
                }
            },
        },
    };

    const formattedData = {
        labels: data?.dates_labels || [],
        datasets: [
            {
                label: 'Cobrado',
                data: data?.revenue_values || [],
                backgroundColor: '#9d4edd', // Neon Purple
                borderRadius: 4,
                barThickness: 'flex',
                maxBarThickness: 32
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
