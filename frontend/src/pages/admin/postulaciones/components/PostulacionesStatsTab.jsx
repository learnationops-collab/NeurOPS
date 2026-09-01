import React, { useState, useEffect } from 'react';
import api from '../../../../services/api';

const Panel = ({ title, subtitle, children }) => (
    <div className="flex flex-col gap-5 rounded-3xl border border-white/12 bg-white/[.04] p-7">
        <div className="flex flex-col gap-1">
            <span className="text-lg font-black text-white">{title}</span>
            {subtitle && <span className="text-[13px] text-white/55">{subtitle}</span>}
        </div>
        {children}
    </div>
);

const BarraDistribucion = ({ items, max }) => (
    <div className="flex flex-col gap-3">
        {items.map(it => (
            <div key={it.opcion} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <span className="truncate text-[13px] text-white/80">{it.opcion}</span>
                <span className="text-[12px] font-black text-pink-400">{it.cantidad}</span>
                <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-pink-500 transition-all duration-700"
                        style={{ width: `${max ? (it.cantidad / max) * 100 : 0}%` }}
                    />
                </div>
            </div>
        ))}
        {items.length === 0 && <span className="text-[13px] text-white/40">Sin datos todavía.</span>}
    </div>
);

const PostulacionesStatsTab = () => {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        api.get('/job-applications/stats')
            .then(res => setStats(res.data))
            .catch(err => console.error('Error al cargar estadísticas:', err));
    }, []);

    if (!stats) return <div className="text-center text-white/50 py-10">Cargando estadísticas...</div>;

    const maxHist = Math.max(1, ...stats.histograma.map(h => h.cantidad));
    const maxEmbudo = Math.max(1, ...stats.embudo.map(e => e.cantidad));
    const maxTramo = Math.max(1, ...stats.distribucion_tramos.map(t => t.cantidad));

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="Calidad del pool" subtitle="Distribución de score por tramo">
                <div className="flex items-center gap-8">
                    <div className="relative flex h-36 w-36 flex-none items-center justify-center rounded-full"
                        style={{ background: `conic-gradient(#FF3FA4 0deg ${(stats.score_medio / 100) * 360}deg, rgba(255,255,255,.08) 0deg)` }}
                    >
                        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[#111634]">
                            <span className="text-2xl font-black text-white">{stats.score_medio}</span>
                            <span className="text-[10px] uppercase tracking-widest text-white/45">score medio</span>
                        </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-3">
                        {stats.distribucion_tramos.map(t => (
                            <div key={t.desde} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                                <span className="w-16 text-[12px] text-white/60">{t.desde}-{t.hasta - 1}</span>
                                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                    <div className="h-full rounded-full bg-pink-500" style={{ width: `${(t.cantidad / maxTramo) * 100}%` }} />
                                </div>
                                <span className="text-[12px] font-black text-white">{t.cantidad}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </Panel>

            <Panel title="Histograma de scores" subtitle="Cantidad de candidatos por decena">
                <div className="flex h-40 items-end gap-2">
                    {stats.histograma.map(h => (
                        <div key={h.decena} className="flex flex-1 flex-col items-center gap-2">
                            <div
                                className="w-full origin-bottom rounded-t-md bg-gradient-to-t from-blue-600 to-pink-500 transition-all duration-500"
                                style={{ height: `${(h.cantidad / maxHist) * 100}%`, minHeight: h.cantidad ? 4 : 0 }}
                            />
                            <span className="text-[9px] text-white/40">{h.decena}</span>
                        </div>
                    ))}
                </div>
            </Panel>

            <Panel title="Embudo" subtitle="De completar el formulario a candidato fuerte">
                <div className="flex flex-col gap-3">
                    {stats.embudo.map(e => (
                        <div key={e.etapa} className="flex flex-col gap-1.5">
                            <div className="flex justify-between text-[13px]">
                                <span className="text-white/75">{e.etapa}</span>
                                <span className="font-black text-white">{e.cantidad}</span>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                                <div className="h-full origin-left rounded-full bg-gradient-to-r from-blue-600 to-pink-500 transition-all duration-700" style={{ width: `${(e.cantidad / maxEmbudo) * 100}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            </Panel>

            <Panel title="Postulaciones por día" subtitle="Últimas 2 semanas">
                {stats.por_dia.length === 0 ? (
                    <span className="text-[13px] text-white/40">Sin postulaciones recientes.</span>
                ) : (
                    <div className="flex h-32 items-end gap-2">
                        {stats.por_dia.map(d => {
                            const max = Math.max(1, ...stats.por_dia.map(x => x.cantidad));
                            return (
                                <div key={d.fecha} className="flex flex-1 flex-col items-center gap-2">
                                    <div className="w-full rounded-t-md bg-pink-500/80 transition-all duration-500" style={{ height: `${(d.cantidad / max) * 100}%`, minHeight: 4 }} />
                                    <span className="text-[9px] text-white/40">{d.fecha.slice(5)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Panel>

            <Panel title="Conocimiento como closer">
                <BarraDistribucion items={stats.distribucion_conocimiento} max={Math.max(1, ...stats.distribucion_conocimiento.map(i => i.cantidad))} />
            </Panel>
            <Panel title="Nivel de inglés">
                <BarraDistribucion items={stats.distribucion_ingles} max={Math.max(1, ...stats.distribucion_ingles.map(i => i.cantidad))} />
            </Panel>
            <Panel title="Lugar de residencia">
                <BarraDistribucion items={stats.distribucion_pais} max={Math.max(1, ...stats.distribucion_pais.map(i => i.cantidad))} />
            </Panel>
            <Panel title="Edad">
                <BarraDistribucion items={stats.distribucion_edad} max={Math.max(1, ...stats.distribucion_edad.map(i => i.cantidad))} />
            </Panel>
            <Panel title="Herramientas que usan">
                <BarraDistribucion items={stats.distribucion_herramientas} max={Math.max(1, ...stats.distribucion_herramientas.map(i => i.cantidad))} />
            </Panel>
            <Panel title="Disclaimer de frustración">
                <BarraDistribucion items={stats.distribucion_disclaimer} max={Math.max(1, ...stats.distribucion_disclaimer.map(i => i.cantidad))} />
            </Panel>
        </div>
    );
};

export default PostulacionesStatsTab;
