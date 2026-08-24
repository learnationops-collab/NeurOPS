import React from 'react';
import { CalendarRange } from 'lucide-react';

const PERIODS = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'ayer', label: 'Ayer' },
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
    { id: 'custom', label: 'Rango personalizado' },
    { id: 'none', label: 'Sin comparación' }
];

// Mes en curso, como arranque de cualquiera de los dos rangos libres.
const mesEnCurso = () => {
    const hoy = new Date();
    const iso = (d) => d.toISOString().split('T')[0];
    return { start: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), end: iso(hoy) };
};

/* Las dos puntas de un rango libre. Se repite para el período y para la comparación, con el
   mismo comportamiento (mín/máx cruzados para que no se pueda elegir un rango invertido). */
const RangeInputs = ({ value, onChange, accent }) => (
    <div className={`flex items-center gap-2 h-11 px-4 rounded-xl bg-surface border ${accent}`}>
        <CalendarRange size={14} className="text-primary shrink-0" />
        <input
            type="date"
            value={value?.start || ''}
            max={value?.end || undefined}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
            className="bg-transparent text-xs font-bold text-base outline-none cursor-pointer"
        />
        <span className="text-muted text-xs">–</span>
        <input
            type="date"
            value={value?.end || ''}
            min={value?.start || undefined}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
            className="bg-transparent text-xs font-bold text-base outline-none cursor-pointer"
        />
    </div>
);

const PerformanceFilters = ({
    closers, closerId, setCloserId, period, setPeriod, compare, setCompare,
    showClosersFilter, customRange, setCustomRange, compareRange, setCompareRange
}) => {
    // Al abrir cualquiera de los dos "Personalizado" sin fechas cargadas se precarga el mes en
    // curso: sin esto la vista queda esperando a que el usuario elija las dos puntas.
    const onPeriodClick = (id) => {
        setPeriod(id);
        if (id === 'custom' && !(customRange?.start && customRange?.end)) setCustomRange(mesEnCurso());
    };

    const onCompareChange = (id) => {
        setCompare(id);
        if (id === 'custom' && !(compareRange?.start && compareRange?.end)) setCompareRange(mesEnCurso());
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
                <RangeInputs value={customRange} onChange={setCustomRange} accent="border-primary/40" />
            )}

            <div className="flex items-center gap-2 h-11 px-4 rounded-xl bg-surface border border-base">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted">Comparar con</span>
                <select
                    value={compare}
                    onChange={(e) => onCompareChange(e.target.value)}
                    className="bg-transparent text-xs font-bold text-base outline-none"
                >
                    {COMPARES.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                </select>
            </div>

            {compare === 'custom' && (
                <RangeInputs value={compareRange} onChange={setCompareRange} accent="border-amber-500/40" />
            )}
        </div>
    );
};

export default PerformanceFilters;
