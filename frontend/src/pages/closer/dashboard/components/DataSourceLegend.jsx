import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import { SOURCE_LEGEND, SOURCE_STYLES } from '../metricSources';

/* Franja "de dónde salen estos datos". El dashboard cruza cuatro fuentes con reglas distintas y
   esa mezcla es la causa de casi todos los números raros, así que conviene tenerla a la vista
   antes de leer nada. Arranca colapsada para no robarle espacio a los KPIs. */

const DataSourceLegend = ({ coverage }) => {
    const [open, setOpen] = useState(false);
    const faltantes = coverage?.faltantes || 0;

    return (
        <Card variant="surface" padding="p-0" className="overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-surface-hover transition-colors cursor-pointer text-left"
            >
                <div className="flex items-center gap-3 min-w-0 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted shrink-0">
                        De dónde salen estos datos
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {SOURCE_LEGEND.map(s => (
                            <span
                                key={s.key}
                                className="text-[8.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border"
                                style={{
                                    color: SOURCE_STYLES[s.key].color,
                                    borderColor: `${SOURCE_STYLES[s.key].color}44`,
                                    background: `${SOURCE_STYLES[s.key].color}14`
                                }}
                            >
                                {SOURCE_STYLES[s.key].short}
                            </span>
                        ))}
                    </div>
                    {faltantes > 0 && (
                        <span className="text-[10px] font-bold text-amber-400 shrink-0">
                            · {faltantes} reporte(s) sin enviar afectan lo que salga del reporte diario
                        </span>
                    )}
                </div>
                <ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 border-t border-base">
                    {SOURCE_LEGEND.map(s => (
                        <div key={s.key} className="bg-main/60 border border-base rounded-2xl p-3.5">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SOURCE_STYLES[s.key].color }} />
                                <b className="text-[11.5px]">{s.title}</b>
                            </div>
                            <p className="text-[10.5px] text-muted leading-snug">{s.text}</p>
                        </div>
                    ))}
                    <p className="text-[10.5px] text-muted sm:col-span-2 xl:col-span-4 leading-snug">
                        Pasá el mouse (o tocá) el <span className="inline-grid place-items-center w-3.5 h-3.5 rounded-full border border-slate-500 text-[8px] font-black align-middle">i</span> de
                        cualquier dato para ver su fuente y su fórmula exacta.
                    </p>
                </div>
            )}
        </Card>
    );
};

export default DataSourceLegend;
