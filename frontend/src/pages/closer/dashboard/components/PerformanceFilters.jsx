import React from 'react';

const PERIODS = [
    { id: 'hoy', label: 'Hoy' },
    { id: '7d', label: '7 días' },
    { id: 'mes', label: 'Este mes' },
    { id: '90', label: '90 días' }
];

const PerformanceFilters = ({ closers, closerId, setCloserId, period, setPeriod, compare, setCompare, showClosersFilter }) => {
    return (
        <div className="flex flex-wrap items-center gap-3">
            {showClosersFilter && (
                <select
                    value={closerId}
                    onChange={(e) => setCloserId(e.target.value)}
                    className="h-11 px-4 rounded-xl bg-surface border border-base text-xs font-bold text-base outline-none"
                >
                    <option value="all">Todo el equipo</option>
                    {closers.map(c => (
                        <option key={c.id} value={c.id}>{c.username}</option>
                    ))}
                </select>
            )}

            <div className="inline-flex gap-1 bg-surface border border-base rounded-full p-1">
                {PERIODS.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setPeriod(p.id)}
                        className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${period === p.id ? 'bg-primary text-white' : 'text-muted hover:text-base'}`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-2 h-11 px-4 rounded-xl bg-surface border border-base">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted">Comparar con</span>
                <select
                    value={compare}
                    onChange={(e) => setCompare(e.target.value)}
                    className="bg-transparent text-xs font-bold text-base outline-none"
                >
                    <option value="prev">Período anterior</option>
                    <option value="month">Mismo rango del mes anterior</option>
                    <option value="none">Sin comparación</option>
                </select>
            </div>
        </div>
    );
};

export default PerformanceFilters;
