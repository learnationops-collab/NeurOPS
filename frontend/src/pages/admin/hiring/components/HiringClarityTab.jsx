import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RotateCcw, Save, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../../../../services/api';
import { BANDERA } from '../lib/escalas';

// Panel de pesos del score. Los criterios son los del puesto de Asistente
// (criterio operativo, escritura, IA real, Sheets…), no los del Closer.
const HiringClarityTab = () => {
    const [pesos, setPesos] = useState([]);
    const [guardado, setGuardado] = useState(true);
    const [ranking, setRanking] = useState([]);
    // Snapshot del score con los pesos guardados, para mostrar cuánto movió a
    // cada candidata el cambio que estás probando.
    const [base, setBase] = useState({});
    const [loading, setLoading] = useState(true);

    const cargarPesos = useCallback(async () => {
        const res = await api.get('/assistant-applications/clarity-weights');
        setPesos(res.data);
    }, []);

    const cargarRanking = useCallback(async (fijarBase) => {
        const res = await api.get('/assistant-applications?filtro=todas');
        setRanking(res.data.postulaciones);
        if (fijarBase) {
            const mapa = {};
            res.data.postulaciones.forEach((p) => { mapa[p.id] = p.score; });
            setBase(mapa);
        }
    }, []);

    useEffect(() => {
        Promise.all([cargarPesos(), cargarRanking(true)]).finally(() => setLoading(false));
    }, [cargarPesos, cargarRanking]);

    const totalPesos = useMemo(() => pesos.reduce((a, p) => a + (p.weight || 0), 0), [pesos]);

    const cambiarPeso = (criterion, valor) => {
        setPesos((prev) => prev.map((p) => (p.criterion === criterion ? { ...p, weight: Number(valor) } : p)));
        setGuardado(false);
    };

    const guardar = async () => {
        const weights = {};
        pesos.forEach((p) => { weights[p.criterion] = p.weight; });
        await api.put('/assistant-applications/clarity-weights', { weights });
        setGuardado(true);
        await cargarRanking(false);
    };

    const resetear = () => {
        setPesos((prev) => prev.map((p) => ({ ...p, weight: p.default_weight })));
        setGuardado(false);
    };

    const rankingOrdenado = useMemo(() => [...ranking].sort((a, b) => b.score - a.score), [ranking]);

    if (loading) return <div className="py-20 text-center text-white/40">Cargando Clarity…</div>;

    return (
        <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-6 rounded-[24px] border border-white/[.13] bg-white/[.045] p-7">
                <div className="flex flex-col gap-2">
                    <span className="text-[19px] font-black tracking-tight">Pesos del score</span>
                    <span className="text-[13.5px] leading-relaxed text-white/55">
                        Movés un peso y el ranking se recalcula. Se normalizan sobre el total, así que no
                        hace falta que sumen 100 — lo que importa es la proporción entre ellos.
                    </span>
                </div>

                <div className="flex flex-col gap-5">
                    {pesos.map((p) => (
                        <div key={p.criterion} className="flex flex-col gap-2">
                            <span className="flex items-baseline justify-between gap-3">
                                <span className="text-[13.5px] font-bold text-white/80">{p.label}</span>
                                <span className="text-[13px] font-black tabular-nums text-[#8AA3FF]">{p.weight} pts</span>
                            </span>
                            <input
                                type="range"
                                min="0"
                                max="40"
                                value={p.weight}
                                onChange={(e) => cambiarPeso(p.criterion, e.target.value)}
                                aria-label={p.label}
                                className="w-full accent-[#5B7CFF]"
                            />
                        </div>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
                    <span
                        className="flex items-center gap-2 text-[12.5px] font-bold"
                        style={{ color: guardado ? '#2FBF8F' : '#D9A441' }}
                    >
                        {guardado ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                        {guardado ? 'Guardado · se aplica al ranking' : 'Cambios sin guardar'}
                    </span>
                    <span className="text-[12.5px] font-bold tabular-nums text-white/40">Total: {totalPesos} pts</span>
                    <span className="ml-auto flex gap-2.5">
                        <button
                            type="button"
                            onClick={resetear}
                            className="flex items-center gap-2 rounded-full border border-white/[.38] bg-white/5 px-4 py-2.5 text-[12.5px] font-bold transition-all hover:bg-white/10"
                        >
                            <RotateCcw size={14} /> Volver a los de fábrica
                        </button>
                        <button
                            type="button"
                            onClick={guardar}
                            disabled={guardado}
                            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[12.5px] font-black text-[#0B0F26] transition-all disabled:opacity-40"
                            style={{ background: 'linear-gradient(100deg,#FF3FA4,#FF6AD5)' }}
                        >
                            <Save size={14} /> Guardar
                        </button>
                    </span>
                </div>
            </div>

            <div className="flex flex-col gap-5 rounded-[24px] border border-white/[.13] bg-white/[.045] p-7">
                <div className="flex flex-col gap-2">
                    <span className="text-[19px] font-black tracking-tight">Ranking</span>
                    <span className="text-[13.5px] text-white/55">
                        Con los pesos guardados. El delta compara contra el score que tenía al abrir esta pestaña.
                    </span>
                </div>

                <div className="flex flex-col gap-1.5">
                    {rankingOrdenado.map((p, i) => {
                        const delta = base[p.id] == null ? 0 : p.score - base[p.id];
                        return (
                            <div key={p.id} className="flex items-center gap-3.5 border-t border-white/[.07] py-3">
                                <span className="w-6 flex-none text-[12px] font-black tabular-nums text-white/30">{i + 1}</span>
                                <span className="h-3 w-4 flex-none rounded-[2px]" style={{ background: BANDERA[p.pais] || 'rgba(255,255,255,.2)' }} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13.5px] font-bold">{p.nombre}</span>
                                    <span className="block text-[11px] text-white/40">
                                        {[p.pais, p.edad && `${p.edad} años`].filter(Boolean).join(' · ') || '—'}
                                    </span>
                                </span>
                                <span
                                    className="w-14 flex-none text-right text-[11px] font-bold tabular-nums"
                                    style={{ color: delta > 0 ? '#2FBF8F' : delta < 0 ? '#E85C4A' : 'rgba(255,255,255,.3)' }}
                                >
                                    {delta === 0 ? '—' : delta > 0 ? `+${delta}` : delta}
                                </span>
                                <span
                                    className="w-10 flex-none text-right text-[17px] font-black tabular-nums"
                                    style={{ color: p.score >= 85 ? '#5B7CFF' : '#fff' }}
                                >
                                    {p.score}
                                </span>
                            </div>
                        );
                    })}
                    {rankingOrdenado.length === 0 && (
                        <span className="py-10 text-center text-[13px] text-white/35">Todavía no hay postulaciones para rankear.</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HiringClarityTab;
