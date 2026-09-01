import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../../../services/api';

const PostulacionesClarityTab = () => {
    const [pesos, setPesos] = useState([]);
    const [guardado, setGuardado] = useState(true);
    const [ranking, setRanking] = useState([]);
    const [loading, setLoading] = useState(true);

    const cargarPesos = useCallback(async () => {
        const res = await api.get('/job-applications/clarity-weights');
        setPesos(res.data);
    }, []);

    const cargarRanking = useCallback(async () => {
        const res = await api.get('/job-applications?filtro=todas');
        setRanking(res.data.postulaciones);
    }, []);

    useEffect(() => {
        Promise.all([cargarPesos(), cargarRanking()]).finally(() => setLoading(false));
    }, [cargarPesos, cargarRanking]);

    const totalPesos = useMemo(() => pesos.reduce((a, p) => a + (p.weight || 0), 0), [pesos]);

    const cambiarPeso = (criterion, valor) => {
        setPesos(prev => prev.map(p => p.criterion === criterion ? { ...p, weight: Number(valor) } : p));
        setGuardado(false);
    };

    const guardar = async () => {
        const weights = {};
        pesos.forEach(p => { weights[p.criterion] = p.weight; });
        await api.put('/job-applications/clarity-weights', { weights });
        setGuardado(true);
        cargarRanking();
    };

    const resetear = () => {
        setPesos(prev => prev.map(p => ({ ...p, weight: p.default_weight })));
        setGuardado(false);
    };

    const rankingOrdenado = useMemo(
        () => [...ranking].sort((a, b) => b.score - a.score),
        [ranking]
    );

    if (loading) return <div className="text-center text-white/50 py-10">Cargando...</div>;

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-6 rounded-3xl border border-white/12 bg-white/[.04] p-7">
                <div className="flex flex-col gap-1.5">
                    <span className="text-lg font-black text-white">Pesos de Clarity</span>
                    <span className="text-[14px] text-white/60">
                        Movés un peso y el score de todos los candidatos se recalcula. Los pesos se normalizan sobre el total, así que no hace falta que sumen 100.
                    </span>
                </div>

                <div className="flex flex-col gap-5">
                    {pesos.map(p => (
                        <div key={p.criterion} className="flex flex-col gap-2">
                            <div className="flex items-baseline justify-between gap-4">
                                <span className="text-[14px] font-bold text-white">{p.label}</span>
                                <span className="whitespace-nowrap text-[14px] font-black text-pink-400">{p.weight} pts</span>
                            </div>
                            <input
                                type="range" min="0" max="40" step="1"
                                value={p.weight}
                                onChange={(e) => cambiarPeso(p.criterion, e.target.value)}
                                className="w-full accent-pink-500"
                            />
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-3.5 border-t border-white/12 pt-4">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-[13px] text-white/55">Total repartido: {totalPesos} pts</span>
                        <span className={`text-[13px] font-bold ${guardado ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {guardado ? 'Clarity guardado · se aplica al ranking' : 'Cambios sin guardar'}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                        <button
                            onClick={guardar}
                            className="rounded-full bg-gradient-to-r from-blue-700 to-pink-500 px-6.5 py-3.5 text-[14px] font-black text-white transition-all hover:brightness-110"
                        >
                            Guardar Clarity
                        </button>
                        <button
                            onClick={resetear}
                            className="rounded-full border border-white/22 px-5.5 py-3.5 text-[14px] font-bold text-white hover:bg-white/10"
                        >
                            Volver a los pesos por defecto
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-5 rounded-3xl border border-white/12 bg-white/[.04] p-7">
                <div className="flex flex-col gap-1.5">
                    <span className="text-lg font-black text-white">Ranking con estos pesos</span>
                    <span className="text-[14px] text-white/60">Ordenado por score. Guardá los pesos para que el orden refleje los cambios.</span>
                </div>
                <div className="flex flex-col gap-3">
                    {rankingOrdenado.map((r, i) => (
                        <div key={r.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 transition-all hover:border-pink-400/40">
                            <span className="w-6 flex-none text-[13px] font-black text-white/40">{i + 1}</span>
                            <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-white">{r.nombre}</span>
                            <span className="flex-none text-xl font-black text-pink-400">{r.score}</span>
                        </div>
                    ))}
                    {rankingOrdenado.length === 0 && <span className="text-[13px] text-white/40">Todavía no hay postulaciones.</span>}
                </div>
            </div>
        </div>
    );
};

export default PostulacionesClarityTab;
