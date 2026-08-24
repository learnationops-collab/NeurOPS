import React from 'react';
import { CalendarRange } from 'lucide-react';

const PERIODS = [
    { id: 'hoy', label: 'Hoy' },
    { id: '7d', label: '7 días' },
    { id: '30d', label: '30 días' },
    { id: 'mes', label: 'Este mes' },
    { id: 'mes_pasado', label: 'Mes pasado' },
    { id: '90', label: '90 días' },
    { id: 'custom', label: 'Personalizado' }
];

/* El período de comparación se elige aparte del rango: comparar una semana contra "el mes
   anterior" no dice nada. `prev` se adapta solo al largo del rango filtrado (una semana contra
   la semana anterior, tres días contra los tres previos). */
const COMPARES = [
    { id: 'prev', label: 'Período anterior' },
    { id: 'month', label: 'Mismo rango del mes anterior' },
    { id: 'year', label: 'Mismo rango del año anterior' },
    { id: 'none', label: 'Sin comparación' }
];

const PerformanceFilters = ({
    closers, closerId, setCloserId, period, setPeriod, compare, setCompare,
    showClosersFilter, customRange, setCustomRange
}) => {
    const onPeriodClick = (id) => {
        setPeriod(id);
        // Al abrir "Personalizado" sin fechas cargadas se precarga el mes en curso: sin esto la
        // vista quedaría en blanco hasta que el usuario elija las dos puntas del rango.
        if (id === 'custom' && (!customRange?.start || !customRange?.end)) {
            const hoy = new Date();
            const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            const iso = (d) => d.toISOString().split('T')[0];
            setCustomRange({ start: iso(primero), end: iso(hoy) });
        }
    };

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
                        onClick={() => onPeriodClick(p.id)}
                        className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${period === p.id ? 'bg-primary text-white' : 'text-muted hover:text-base'}`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {period === 'custom' && (
                <div className="flex items-center gap-2 h-11 px-4 rounded-xl bg-surface border border-primary/40">
                    <CalendarRange size={14} className="text-primary shrink-0" />
                    <input
                        type="date"
                        value={customRange?.start || ''}
                        max={customRange?.end || undefined}
                        onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                        className="bg-transparent text-xs font-bold text-base outline-none cursor-pointer"
                    />
                    <span className="text-muted text-xs">–</span>
                    <input
                        type="date"
                        value={customRange?.end || ''}
                        min={customRange?.start || undefined}
                        onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                        className="bg-transparent text-xs font-bold text-base outline-none cursor-pointer"
                    />
                </div>
            )}

            <div className="flex items-center gap-2 h-11 px-4 rounded-xl bg-surface border border-base">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted">Comparar con</span>
                <select
                    value={compare}
                    onChange={(e) => setCompare(e.target.value)}
                    className="bg-transparent text-xs font-bold text-base outline-none"
                >
                    {COMPARES.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default PerformanceFilters;
