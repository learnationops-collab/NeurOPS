import React, { useState, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
import api from '../../../../services/api';

const SEGMENTOS = [
    { id: 'todos', label: 'Todos los postulantes' },
    { id: 'seleccionados', label: 'Seleccionados' },
];

const Panel = ({ title, subtitle, children, delay = 0 }) => (
    <div
        className="flex flex-col gap-5 rounded-3xl border border-white/12 bg-white/[.04] p-7"
        style={{ animation: `ln-stats-up .5s ${delay}ms cubic-bezier(.2,.7,.3,1) both` }}
    >
        <div className="flex flex-col gap-1">
            <span className="text-lg font-black text-white">{title}</span>
            {subtitle && <span className="text-[13px] text-white/55">{subtitle}</span>}
        </div>
        {children}
    </div>
);

const KpiTile = ({ label, valor, unidad, color, delay }) => (
    <div
        className="flex flex-col gap-2 rounded-3xl border border-white/12 bg-white/5 p-6"
        style={{ animation: `ln-stats-up .5s ${delay}ms cubic-bezier(.2,.7,.3,1) both` }}
    >
        <span className="text-[13px] text-white/55">{label}</span>
        <span className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-white" style={{ color }}>{valor}</span>
            {unidad && <span className="text-[13px] font-bold text-white/45">{unidad}</span>}
        </span>
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

const csvCell = (valor) => {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

const PostulacionesStatsTab = () => {
    const [segmento, setSegmento] = useState('todos');
    const [stats, setStats] = useState(null);
    const [exportando, setExportando] = useState(false);

    useEffect(() => {
        setStats(null);
        api.get(`/job-applications/stats?segmento=${segmento}`)
            .then(res => setStats(res.data))
            .catch(err => console.error('Error al cargar estadísticas:', err));
    }, [segmento]);

    const exportarCsv = useCallback(async () => {
        setExportando(true);
        try {
            const filtro = segmento === 'seleccionados' ? 'preseleccionadas' : 'todas';
            const res = await api.get(`/job-applications?filtro=${filtro}`);
            const columnas = ['nombre', 'email', 'veredicto', 'score', 'conocimiento', 'ingles', 'cierre', 'respondidas', 'total_preguntas', 'created_at'];
            const filas = [columnas.join(',')].concat(
                res.data.postulaciones.map(p => columnas.map(c => csvCell(p[c])).join(','))
            );
            const blob = new Blob([filas.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `postulaciones_${segmento}_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error al exportar postulaciones:', err);
        } finally {
            setExportando(false);
        }
    }, [segmento]);

    return (
        <div className="flex flex-col gap-6">
            <style>{`@keyframes ln-stats-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[.03] p-1.5 w-fit">
                    {SEGMENTOS.map(s => (
                        <button
                            key={s.id}
                            onClick={() => setSegmento(s.id)}
                            className={`rounded-xl px-6 py-3 text-[13px] font-bold transition-all ${
                                segmento === s.id ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'text-white/60 hover:text-white'
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={exportarCsv}
                    disabled={exportando || !stats}
                    className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-[13px] font-bold text-white transition-all hover:bg-white/10 disabled:opacity-40"
                >
                    <Download size={15} /> {exportando ? 'Exportando...' : 'Exportar CSV'}
                </button>
            </div>

            {!stats && <div className="py-10 text-center text-white/50">Cargando estadísticas...</div>}

            {stats && (
                <StatsBody key={segmento} stats={stats} segmento={segmento} />
            )}
        </div>
    );
};

const StatsBody = ({ stats, segmento }) => {
    const maxHist = Math.max(1, ...stats.histograma.map(h => h.cantidad));
    const maxTramo = Math.max(1, ...stats.distribucion_tramos.map(t => t.cantidad));
    const maxEmbudo = stats.embudo ? Math.max(1, ...stats.embudo.map(e => e.cantidad)) : 1;

    const kpis = segmento === 'seleccionados'
        ? [
            { label: 'Seleccionados', valor: stats.total, unidad: `de ${stats.total_completas} completas`, color: '#34d399' },
            { label: 'Score medio', valor: stats.score_medio, unidad: '/ 100', color: '#FF6AD5' },
            { label: 'Score 85 o más', valor: stats.score_85, unidad: `de ${stats.total}`, color: '#34d399' },
            { label: 'Con video y llamada', valor: stats.con_material, unidad: `de ${stats.total}`, color: '#60a5fa' },
        ]
        : [
            { label: 'Completaron', valor: stats.total, unidad: `de ${stats.abrieron_formulario} que abrieron`, color: '#FF6AD5' },
            { label: 'Score medio', valor: stats.score_medio, unidad: '/ 100', color: '#FF6AD5' },
            { label: 'Score 85 o más', valor: stats.score_85, unidad: `de ${stats.total}`, color: '#34d399' },
            { label: 'Con video y llamada', valor: stats.con_material, unidad: `de ${stats.total}`, color: '#60a5fa' },
        ];

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {kpis.map((k, i) => <KpiTile key={k.label} {...k} delay={i * 40} />)}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel title="Calidad del pool" subtitle="Distribución de score por tramo" delay={0}>
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
                                        <div className="h-full rounded-full bg-pink-500 transition-all duration-700" style={{ width: `${(t.cantidad / maxTramo) * 100}%` }} />
                                    </div>
                                    <span className="text-[12px] font-black text-white">{t.cantidad}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Panel>

                <Panel title="Histograma de scores" subtitle="Cantidad de candidatos por decena" delay={40}>
                    <div className="flex h-40 items-end gap-2">
                        {stats.histograma.map(h => (
                            <div key={h.decena} className="flex flex-1 flex-col items-center gap-1.5">
                                <span className="text-[11px] font-bold text-white/60">{h.cantidad || ''}</span>
                                <div
                                    className="w-full origin-bottom rounded-t-md bg-gradient-to-t from-blue-600 to-pink-500 transition-all duration-500"
                                    style={{ height: `${(h.cantidad / maxHist) * 100}%`, minHeight: h.cantidad ? 4 : 0 }}
                                />
                                <span className="text-[9px] text-white/40">{h.decena}</span>
                            </div>
                        ))}
                    </div>
                </Panel>

                {stats.embudo && (
                    <Panel title="Embudo de búsqueda" subtitle="De abrir el formulario a candidato fuerte" delay={80}>
                        <div className="flex flex-col gap-1">
                            {stats.embudo.map((e, i) => {
                                const anterior = i > 0 ? stats.embudo[i - 1].cantidad : null;
                                const caida = anterior ? Math.round(((anterior - e.cantidad) / anterior) * 100) : null;
                                return (
                                    <div key={e.etapa} className="flex flex-col gap-1.5">
                                        {i > 0 && (
                                            <div className="flex items-center gap-2 pl-1 text-[11px] font-bold text-white/35">
                                                <span>↓</span>
                                                <span className={caida >= 50 ? 'text-rose-400' : 'text-white/35'}>
                                                    {caida}% no siguió
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-[13px]">
                                            <span className="text-white/75">{e.etapa}</span>
                                            <span className="font-black text-white">{e.cantidad}</span>
                                        </div>
                                        <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                                            <div className="h-full origin-left rounded-full bg-gradient-to-r from-blue-600 to-pink-500 transition-all duration-700" style={{ width: `${(e.cantidad / maxEmbudo) * 100}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Panel>
                )}

                <Panel title="Postulaciones por día" subtitle="Últimas 2 semanas" delay={120}>
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

                <Panel title="Conocimiento como closer" delay={160}>
                    <BarraDistribucion items={stats.distribucion_conocimiento} max={Math.max(1, ...stats.distribucion_conocimiento.map(i => i.cantidad))} />
                </Panel>
                <Panel title="Nivel de inglés" delay={160}>
                    <BarraDistribucion items={stats.distribucion_ingles} max={Math.max(1, ...stats.distribucion_ingles.map(i => i.cantidad))} />
                </Panel>
                <Panel title="Lugar de residencia" delay={200}>
                    <BarraDistribucion items={stats.distribucion_pais} max={Math.max(1, ...stats.distribucion_pais.map(i => i.cantidad))} />
                </Panel>
                <Panel title="Edad" delay={200}>
                    <BarraDistribucion items={stats.distribucion_edad} max={Math.max(1, ...stats.distribucion_edad.map(i => i.cantidad))} />
                </Panel>
                <Panel title="Herramientas que usan" delay={240}>
                    <BarraDistribucion items={stats.distribucion_herramientas} max={Math.max(1, ...stats.distribucion_herramientas.map(i => i.cantidad))} />
                </Panel>
                <Panel title="Disclaimer de frustración" delay={240}>
                    <BarraDistribucion items={stats.distribucion_disclaimer} max={Math.max(1, ...stats.distribucion_disclaimer.map(i => i.cantidad))} />
                </Panel>
            </div>
        </div>
    );
};

export default PostulacionesStatsTab;
