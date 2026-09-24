import React from 'react';

// Qué falta para poder guardar, en palabras y al lado del botón. Nace de un reporte real: un
// closer completaba todo lo que la pantalla marcaba como obligatorio, tocaba "Completar
// Seguimiento" y no pasaba nada — el botón estaba deshabilitado por un requisito que no se
// mostraba en ningún lado, y un botón deshabilitado no da ninguna señal al tocarlo.
export const MissingFieldsHint = ({ items }) => (
    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
            {items.length === 1 ? 'Falta esto para poder guardar' : `Faltan ${items.length} cosas para poder guardar`}
        </p>
        <ul className="space-y-1">
            {items.map(t => (
                <li key={t} className="text-[11px] font-bold text-amber-200/90 flex gap-1.5">
                    <span className="text-amber-400">•</span>{t}
                </li>
            ))}
        </ul>
    </div>
);

// Aviso por WhatsApp del seguimiento que se está programando: si lo quiere y a qué hora.
// La hora es la del closer y es obligatoria para que salga el mensaje, así que al activar el
// check sin hora se repone 09:00 en vez de dejar un aviso que nunca se enviaría.
export const AvisoSeguimientoWhatsApp = ({ enabled, time, onChange, fecha }) => (
    <div className="space-y-2 p-3 bg-slate-950/40 border border-slate-850 rounded-2xl">
        <label className="flex items-center gap-2 cursor-pointer">
            <input
                type="checkbox"
                checked={!!enabled}
                onChange={(e) => onChange({ enabled: e.target.checked, time: time || '09:00' })}
                className="w-4 h-4 accent-violet-500"
            />
            <h4 className="text-[10px] font-black uppercase text-slate-400">
                Avisarme por WhatsApp este seguimiento
            </h4>
        </label>
        {enabled && (
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase text-slate-500">A las</span>
                <input
                    type="time"
                    value={time || '09:00'}
                    onChange={(e) => onChange({ enabled: true, time: e.target.value })}
                    className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200"
                />
                <span className="text-[9px] font-medium text-slate-500 normal-case">
                    hora tuya{fecha ? `, el ${fecha}` : ''}
                </span>
            </div>
        )}
    </div>
);
