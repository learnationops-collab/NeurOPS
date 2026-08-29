import React from 'react';
import { Settings2, Target, Sparkles, ArrowRight } from 'lucide-react';
import InfoTooltip from '../../../../components/ui/InfoTooltip';
import { STAGE_ORDER, aggregateTotals, stageRates, computeFuga, computeClarityScore, money } from '../funnelMath';

const ESTADO_STYLE = {
    ok: { bar: 'bg-emerald-500', text: 'text-emerald-400', chip: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
    al_limite: { bar: 'bg-amber-500', text: 'text-amber-400', chip: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
    fuga: { bar: 'bg-rose-500', text: 'text-rose-400', chip: 'bg-rose-500/10 border-rose-500/20 text-rose-400' },
};

const ClarityBar = ({ label, value }) => (
    <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span>{label}</span>
            <span className="text-slate-300">{value}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all" style={{ width: `${value}%` }} />
        </div>
    </div>
);

// Panel "Diagnóstico" — vive siempre visible arriba de las pestañas (como la
// sección General de la herramienta de referencia), no es una pestaña más:
// es la lectura rápida de "qué está frenando las ventas" antes de bajar al
// detalle de un evento, simular un escenario, o cargar una acción.
const WorkshopDiagnostico = ({ events, goals, actions, onEditGoals, onGoToSimulador }) => {
    if (!goals) return null;

    const totals = aggregateTotals(events);
    const rates = stageRates(totals);
    const fugas = computeFuga(totals, rates, goals);
    const clarity = computeClarityScore(goals, actions, fugas);
    const fugaPrincipal = fugas.find((f) => f.estado === 'fuga') || fugas.find((f) => f.estado === 'al_limite');

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Salud del embudo */}
            <div className="lg:col-span-2 bg-slate-900/30 border border-slate-900 rounded-[2.5rem] p-8 space-y-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                        Salud del embudo
                        <InfoTooltip label="Salud del embudo" text="La tasa real de cada etapa contra la meta configurada. Verde: en meta. Ámbar: al límite (dentro de la banda de tolerancia). Rojo: fuga — acá se está perdiendo la mayor parte de las ventas posibles." />
                    </h3>
                    <button
                        onClick={onEditGoals}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
                    >
                        <Settings2 size={12} /> Editar metas
                    </button>
                </div>
                <div className="space-y-3">
                    {fugas.map((f) => {
                        const st = ESTADO_STYLE[f.estado];
                        return (
                            <div key={f.key} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-300">{f.label}</span>
                                    <span className={`font-black ${st.text}`}>
                                        {f.real}% <span className="text-slate-600 font-semibold">/ meta {f.meta}%</span>
                                    </span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-950 overflow-hidden">
                                    <div className={`h-full rounded-full ${st.bar} transition-all`} style={{ width: `${Math.min(100, f.real)}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-6">
                {/* Prioridad del sistema */}
                <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900/40 border border-indigo-500/20 rounded-[2.5rem] p-6 space-y-3">
                    <h3 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
                        <Target size={12} /> Prioridad del sistema
                    </h3>
                    {fugaPrincipal ? (
                        <>
                            <p className="text-xl font-black text-white italic tracking-tighter">{fugaPrincipal.label}</p>
                            <p className="text-xs text-slate-400 font-semibold">
                                Hoy está en <b className="text-white">{fugaPrincipal.real}%</b>. Llegar a <b className="text-white">{fugaPrincipal.meta}%</b> puede sumar
                                {' '}<b className="text-emerald-400">+{fugaPrincipal.impactoVentas.toFixed(1)} ventas</b> por taller.
                            </p>
                            <button
                                onClick={() => onGoToSimulador?.(fugaPrincipal.key)}
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-300 hover:text-white transition-all cursor-pointer"
                            >
                                Simular mejora <ArrowRight size={12} />
                            </button>
                        </>
                    ) : (
                        <p className="text-sm font-bold text-emerald-400">Todas las etapas están en meta. 🎉</p>
                    )}
                </div>

                {/* Clarity Score */}
                <div className="bg-slate-900/30 border border-slate-900 rounded-[2.5rem] p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Sparkles size={12} /> Clarity Score
                        </h3>
                        <span className="text-2xl font-black text-white italic">{clarity.score}<span className="text-xs text-slate-600">/100</span></span>
                    </div>
                    <div className="space-y-3">
                        <ClarityBar label="Diagnóstico" value={clarity.diagnostico} />
                        <ClarityBar label="Plan" value={clarity.plan} />
                        <ClarityBar label="Ejecución" value={clarity.ejecucion} />
                    </div>
                    <p className="text-[10px] text-slate-600 font-semibold leading-relaxed">
                        El diagnóstico está; cubrí las fugas con acciones para subir el puntaje. Sirve para priorizar, no es una predicción.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default WorkshopDiagnostico;
