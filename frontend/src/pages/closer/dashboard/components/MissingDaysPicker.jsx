import React, { useState } from 'react';
import { CalendarDays } from 'lucide-react';

/* Accesos directos a cada día que falta reportar. Sin esto el closer sabía que "faltan 11
   reportes" pero no cuáles, y tenía que ir probando fecha por fecha en el selector del reporte.
   Cada chip abre la pestaña del reporte YA posicionada en ese día. */

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const VISIBLES = 8;

// Se parsea a mano y no con `new Date(iso)`: un 'YYYY-MM-DD' se interpreta como UTC y en zonas
// al oeste de Greenwich termina mostrando el día anterior.
const formatDay = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return { dow: DIAS[date.getDay()], day: d, month: MESES[m - 1] };
};

const MissingDaysPicker = ({ days = [], onPick, dense = false }) => {
    const [showAll, setShowAll] = useState(false);
    if (!days.length || !onPick) return null;

    const visibles = showAll ? days : days.slice(0, VISIBLES);
    const restantes = days.length - visibles.length;

    return (
        <div className={dense ? '' : 'mt-3'}>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5">
                <CalendarDays size={11} /> Días sin reportar — tocá uno para ir directo
            </p>
            <div className="flex flex-wrap gap-1.5">
                {visibles.map(iso => {
                    const { dow, day, month } = formatDay(iso);
                    return (
                        <button
                            key={iso}
                            onClick={() => onPick(iso)}
                            title={`Abrir el reporte del ${iso}`}
                            className="px-2.5 py-1.5 rounded-xl bg-surface border border-base hover:border-primary/60 hover:bg-primary/10 transition-colors cursor-pointer text-left"
                        >
                            <span className="block text-[8px] font-black uppercase tracking-widest text-muted leading-none">{dow}</span>
                            <span className="block text-[12px] font-black leading-tight mt-0.5">{day} {month}</span>
                        </button>
                    );
                })}
                {restantes > 0 && (
                    <button
                        onClick={() => setShowAll(true)}
                        className="px-2.5 py-1.5 rounded-xl border border-dashed border-base text-[10px] font-black uppercase tracking-wider text-muted hover:border-primary/60 hover:text-base transition-colors cursor-pointer"
                    >
                        +{restantes} más
                    </button>
                )}
            </div>
        </div>
    );
};

export default MissingDaysPicker;
