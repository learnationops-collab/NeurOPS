import React, { useState, useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import Card, { CardHeader, CardContent } from './ui/Card';
import Button from './ui/Button';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const ChartSelector = ({ active, setActive, options }) => (
    <div className="flex flex-wrap gap-2 mb-4">
        {options.map(opt => (
            <button
                key={opt.key}
                onClick={() => setActive(opt.key)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${active === opt.key
                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                        : 'bg-surface hover:bg-surface-hover text-muted hover:text-base border border-base'
                    }`}
            >
                {opt.label}
            </button>
        ))}
    </div>
);

const DashboardCharts = ({ chartsData }) => {
    const [activeChart, setActiveChart] = useState('revenue');

    const options = [
        { key: 'revenue', label: 'Ventas Diarias' },
        { key: 'agendas', label: 'Agendas Diarias' },
        { key: 'status', label: 'Estado de Agendas' },
        { key: 'programs', label: 'Programas' },
        { key: 'finance', label: 'Deuda vs Cobrado' },
    ];

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                    font: { family: 'Inter', size: 10, weight: 'bold' },
                    color: '#94a3b8' // text-muted
                }
            },
            tooltip: {
                backgroundColor: '#1e293b',
                titleFont: { family: 'Inter', size: 12, weight: 'bold' },
                bodyFont: { family: 'Inter', size: 12 },
                padding: 12,
                cornerRadius: 8,
                displayColors: false
            }
        },
        scales: {
            x: {
                grid: { display: false, drawBorder: false },
                ticks: { font: { family: 'Inter', size: 10 }, color: '#64748b' }
            },
            y: {
                grid: { color: '#334155', borderDash: [4, 4], drawBorder: false }, // border-base
                ticks: { font: { family: 'Inter', size: 10 }, color: '#64748b' }
            }
        }
    };

    const renderChart = () => {
        switch (activeChart) {
            case 'revenue':
                return (
                    <Line
                        data={{
                            labels: chartsData.dates_labels,
                            datasets: [{
                                label: 'Ventas ($)',
                                data: chartsData.revenue_values,
                                borderColor: '#6366f1', // primary
                                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                fill: true,
                                tension: 0.4,
                                pointRadius: 4,
                                pointHoverRadius: 6,
                                borderWidth: 2
                            }]
                        }}
                        options={commonOptions}
                    />
                );
            case 'agendas':
                return (
                    <Line
                        data={{
                            labels: chartsData.dates_labels,
                            datasets: [{
                                label: 'Agendas',
                                data: chartsData.agendas_values,
                                borderColor: '#10b981', // emerald-500
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                fill: true,
                                tension: 0.4,
                                pointRadius: 4,
                                borderWidth: 2
                            }]
                        }}
                        options={commonOptions}
                    />
                );
            case 'status':
                return (
                    <div className="w-full h-64 flex justify-center">
                        <Doughnut
                            data={{
                                labels: chartsData.status_labels,
                                datasets: [{
                                    data: chartsData.status_values,
                                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#6366f1'],
                                    borderWidth: 0
                                }]
                            }}
                            options={{ ...commonOptions, scales: {} }}
                        />
                    </div>
                );
            case 'programs':
                return (
                    <Bar
                        data={{
                            labels: chartsData.program_labels,
                            datasets: [{
                                label: 'Inscritos',
                                data: chartsData.program_values,
                                backgroundColor: '#8b5cf6', // violet-500
                                borderRadius: 6,
                            }]
                        }}
                        options={commonOptions}
                    />
                );
            case 'finance':
                return (
                    <div className="w-full h-64 flex justify-center">
                        <Doughnut
                            data={{
                                labels: ['Cobrado', 'Por Cobrar (Deuda)'],
                                datasets: [{
                                    data: [chartsData.finance_breakdown.collected, chartsData.finance_breakdown.debt],
                                    backgroundColor: ['#10b981', '#ef4444'],
                                    borderWidth: 0
                                }]
                            }}
                            options={{ ...commonOptions, scales: {} }}
                        />
                    </div>
                );
            default: return null;
        }
    };

    return (
        <Card variant="surface" className="h-[500px] flex flex-col">
            <CardHeader className="px-6 py-4 border-b border-base flex justify-between items-center">
                <h3 className="text-base font-black uppercase text-xs tracking-widest">Análisis Gráfico</h3>
            </CardHeader>
            <CardContent className="flex-1 p-6 flex flex-col">
                <ChartSelector active={activeChart} setActive={setActiveChart} options={options} />
                <div className="flex-1 w-full min-h-0 relative">
                    {renderChart()}
                </div>
            </CardContent>
        </Card>
    );
};

export default DashboardCharts;
