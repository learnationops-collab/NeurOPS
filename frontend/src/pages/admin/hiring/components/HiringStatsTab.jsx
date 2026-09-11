import React, { useState, useEffect } from 'react';
import { Grid3x3, CheckCircle2, Target, Users, TrendingUp, DollarSign } from 'lucide-react';
import api from '../../../../services/api';
import { COLOR_PAIS, BANDERA, PAISES } from '../lib/escalas';

// Dos pools: todo lo que llegó, o sólo los finalistas (video verificado). Sin
// video no se revisa la postulación, así que promediar los dos juntos
// distorsiona cualquier lectura.
const SEGMENTOS = [
    { id: 'todos', label: 'Generales', icon: Grid3x3, color: '#5B7CFF' },
    { id: 'finalistas', label: 'Finalistas', icon: CheckCircle2, color: '#2FBF8F' },
];

const TABS = [
    { id: 'panorama', label: 'Panorama', icon: Target },
    { id: 'paises', label: 'Comparar países', icon: Grid3x3 },
];

const Panel = ({ titulo, children, pie }) => (
    <div className="flex flex-col gap-5 rounded-[24px] border border-white/[.13] bg-white/[.045] p-6">
        <span className="flex items-center gap-2.5 text-[11.5px] font-extrabold uppercase tracking-[.16em] text-white/55">
            {titulo}
        </span>
        {children}
        {pie && <span className="mt-auto pt-1 text-[12px] font-bold text-white/50">{pie}</span>}
    </div>
);

/** Barras horizontales; la más alta se pinta en magenta. */
const Escalera = ({ items, color = '#5B7CFF', totalPara }) => {
    const max = Math.max(1, ...items.map((x) => x.cantidad));
    return (
        <div className="flex flex-col gap-2.5">
            {items.length === 0 && <span className="text-[13px] text-white/35">Todavía sin datos.</span>}
            {items.map((x) => {
                const top = x.cantidad === max;
                return (
                    <div key={x.opcion} className="grid items-center gap-2.5 [grid-template-columns:minmax(84px,140px)_minmax(0,1fr)_36px]">
                        <span className="truncate text-[11.5px] font-bold text-white/60" title={x.opcion}>{x.opcion}</span>
                        <span className="h-2 w-full overflow-hidden rounded-full bg-white/[.07]">
                            <span
                                className="block h-full rounded-full"
                                style={{
                                    width: `${Math.round((x.cantidad / max) * 100)}%`,
                                    background: top ? 'linear-gradient(90deg,#FF3FA4,#FF6AD5)' : `linear-gradient(90deg,#1323C6,${color})`,
                                }}
                            />
                        </span>
                        <span
                            className="text-right text-[13px] tabular-nums"
                            style={{ color: top ? '#FF6AD5' : 'rgba(255,255,255,.72)', fontWeight: top ? 900 : 700 }}
                        >
                            {totalPara ? `${Math.round((x.cantidad / totalPara) * 100)}%` : x.cantidad}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

/** Barras verticales para las distribuciones ordinales (edad, pretensión). */
const Verticales = ({ items }) => {
    const max = Math.max(1, ...items.map((x) => x.cantidad));
    return (
        <div className="flex h-[142px] items-end justify-between gap-2.5">
            {items.map((x) => (
                <div key={x.opcion} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[12px] font-black tabular-nums text-white/70">{x.cantidad}</span>
                    <span
                        className="w-full rounded-t-md"
                        style={{
                            height: `${Math.max(4, Math.round((x.cantidad / max) * 100))}%`,
                            background: x.cantidad === max
                                ? 'linear-gradient(180deg,#FF6AD5,#FF3FA4)'
                                : 'linear-gradient(180deg,#5B7CFF,#1323C6)',
                        }}
                    />
                    <span className="w-full truncate text-center text-[10px] font-bold text-white/45">{x.opcion}</span>
                </div>
            ))}
            {items.length === 0 && <span className="self-center text-[13px] text-white/35">Todavía sin datos.</span>}
        </div>
    );
};

const HiringStatsTab = () => {
    const [segmento, setSegmento] = useState('todos');
    const [tab, setTab] = useState('panorama');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let vivo = true;
        setLoading(true);
        api.get(`/assistant-applications/stats?segmento=${segmento}`)
            .then((res) => { if (vivo) setData(res.data); })
            .catch((err) => console.error('Error al cargar estadísticas:', err))
            .finally(() => { if (vivo) setLoading(false); });
        return () => { vivo = false; };
    }, [segmento]);

    if (loading && !data) return <div className="py-20 text-center text-white/40">Cargando estadísticas…</div>;
    if (!data) return <div className="py-20 text-center text-white/40">No se pudieron cargar las estadísticas.</div>;

    const total = data.total || 0;
    const donutTotal = data.distribucion_pais.reduce((a, x) => a + x.cantidad, 0) || 1;
    let acumulado = 0;
    const stops = PAISES.map((pais) => {
        const n = data.distribucion_pais.find((x) => x.opcion === pais)?.cantidad || 0;
        const desde = (acumulado / donutTotal) * 100;
        acumulado += n;
        return `${COLOR_PAIS[pais]} ${desde.toFixed(2)}% ${((acumulado / donutTotal) * 100).toFixed(2)}%`;
    });

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-stretch gap-1 rounded-[18px] border border-white/[.12] bg-white/[.045] p-1.5">
                    {SEGMENTOS.map((s) => {
                        const activo = segmento === s.id;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setSegmento(s.id)}
                                className={`flex h-11 items-center gap-2.5 whitespace-nowrap rounded-[14px] px-4 text-[13.5px] font-bold transition-all ${activo ? 'text-white' : 'text-white/60 hover:bg-[#5B7CFF]/10 hover:text-white'}`}
                                style={activo ? { background: 'linear-gradient(100deg,#1323C6,#5B7CFF)' } : undefined}
                            >
                                <s.icon size={16} style={{ color: activo ? '#fff' : s.color }} />
                                {s.label}
                                <span className="tabular-nums text-white/45">
                                    {s.id === 'todos' ? data.total_general : data.total_finalistas}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="inline-flex items-stretch gap-1 rounded-[18px] border border-white/[.12] bg-white/[.045] p-1.5">
                    {TABS.map((t) => {
                        const activo = tab === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                className={`flex h-11 items-center gap-2.5 whitespace-nowrap rounded-[14px] px-4 text-[13.5px] font-bold transition-all ${activo ? 'text-white' : 'text-white/60 hover:bg-[#5B7CFF]/10 hover:text-white'}`}
                                style={activo ? { background: 'linear-gradient(100deg,#1323C6,#5B7CFF)' } : undefined}
                            >
                                <t.icon size={16} /> {t.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {tab === 'panorama' && (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            { icon: Users, n: data.total_general, label: 'Postulaciones', color: '#fff' },
                            { icon: Target, n: data.sin_analizar, label: 'Sin analizar', color: '#D9A441' },
                            { icon: CheckCircle2, n: data.analizadas, label: 'Analizadas', color: '#8AA3FF' },
                            { icon: DollarSign, n: data.pretension_media ? `${data.pretension_media} USD` : '—', label: 'Pretensión media', color: '#FF6AD5' },
                        ].map((m) => (
                            <div key={m.label} className="flex items-center gap-3.5 rounded-[18px] border border-white/[.12] bg-white/[.045] px-5 py-5">
                                <m.icon size={19} style={{ color: m.color }} />
                                <span className="flex flex-col leading-none">
                                    <span className="text-[26px] font-black tabular-nums" style={{ color: m.color }}>{m.n}</span>
                                    <span className="mt-2 text-[11.5px] font-bold text-white/50">{m.label}</span>
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                        <Panel titulo="Embudo de la búsqueda" pie={`sobre ${data.total_general} postulaciones`}>
                            <div className="flex flex-col gap-3">
                                {data.embudo.map((e, i) => {
                                    const base = data.embudo[0].cantidad || 1;
                                    const colores = ['#4E8BD8', '#5B7CFF', '#8AA3FF', '#2FBF8F'];
                                    return (
                                        <div key={e.etapa} className="flex flex-col gap-1.5">
                                            <span className="flex items-baseline justify-between gap-3">
                                                <span className="text-[12.5px] font-bold text-white/65">{e.etapa}</span>
                                                <span className="text-[13px] font-black tabular-nums">
                                                    {e.cantidad}
                                                    <span className="ml-1.5 text-[11px] font-bold text-white/40">
                                                        {Math.round((e.cantidad / base) * 100)}%
                                                    </span>
                                                </span>
                                            </span>
                                            <span className="h-2.5 w-full overflow-hidden rounded-full bg-white/[.07]">
                                                <span
                                                    className="block h-full rounded-full"
                                                    style={{ width: `${Math.round((e.cantidad / base) * 100)}%`, background: colores[i] }}
                                                />
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </Panel>

                        <Panel titulo="De dónde vienen" pie={`${total} en este segmento`}>
                            <div className="flex flex-wrap items-center gap-7">
                                <span className="relative h-[136px] w-[136px] flex-none rounded-full" style={{ background: `conic-gradient(${stops.join(', ')})` }}>
                                    <span className="absolute inset-[26px] flex flex-col items-center justify-center gap-0.5 rounded-full bg-[#0D1129]">
                                        <span className="text-[26px] font-black leading-none tabular-nums">{donutTotal}</span>
                                        <span className="text-[9px] font-extrabold uppercase tracking-[.16em] text-white/40">Total</span>
                                    </span>
                                </span>
                                <div className="flex min-w-[150px] flex-1 flex-col gap-3">
                                    {PAISES.map((pais) => {
                                        const n = data.distribucion_pais.find((x) => x.opcion === pais)?.cantidad || 0;
                                        return (
                                            <span key={pais} className="flex items-center gap-2.5">
                                                <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: COLOR_PAIS[pais] }} />
                                                <span className="flex-1 text-[13px] font-bold">{pais}</span>
                                                <span className="text-[13px] font-black tabular-nums">{n}</span>
                                                <span className="w-10 text-right text-[11.5px] font-bold text-white/40">
                                                    {Math.round((n / donutTotal) * 100)}%
                                                </span>
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </Panel>

                        <Panel titulo="Nivel de IA declarado">
                            <Escalera items={data.distribucion_ia} />
                        </Panel>
                        <Panel titulo="Lo más avanzado que hicieron con IA">
                            <Escalera items={data.distribucion_ia_avanzado.slice(0, 8)} color="#8AA3FF" />
                        </Panel>
                        <Panel titulo="Nivel de Google Sheets">
                            <Escalera items={data.distribucion_sheets} color="#2FBF8F" />
                        </Panel>
                        <Panel titulo="Nivel de inglés">
                            <Escalera items={data.distribucion_ingles} color="#8AA3FF" />
                        </Panel>
                        <Panel titulo="Años de experiencia en operaciones">
                            <Escalera items={data.distribucion_experiencia} />
                        </Panel>
                        <Panel titulo="Manejo de pendientes">
                            <Escalera items={data.distribucion_pendientes} color="#FF6AD5" />
                        </Panel>
                        <Panel titulo="Edad" pie="tramos de edad declarada">
                            <Verticales items={data.distribucion_edad} />
                        </Panel>
                        <Panel titulo="Cuánto piden por mes" pie={data.pretension_media ? `Media: ${data.pretension_media} USD` : 'Sin datos todavía'}>
                            <Verticales items={data.distribucion_presupuesto} />
                        </Panel>
                        <Panel titulo="Excluyentes: dónde se cayeron" pie={`${data.descartadas_ko} descartadas por el formulario`}>
                            <Escalera items={data.excluyentes.filter((x) => x.cantidad > 0)} color="#E85C4A" />
                        </Panel>
                        <Panel titulo="Postulaciones por día" pie="últimos 14 días">
                            <Verticales items={data.por_dia.map((x) => ({ opcion: x.fecha.slice(5), cantidad: x.cantidad }))} />
                        </Panel>
                    </div>
                </>
            )}

            {tab === 'paises' && (
                <div className="rounded-[24px] border border-white/[.13] bg-white/[.045] p-6">
                    <span className="flex items-center gap-2.5 text-[11.5px] font-extrabold uppercase tracking-[.16em] text-white/55">
                        <TrendingUp size={16} className="text-[#5B7CFF]" />
                        Qué país conviene
                    </span>
                    <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-white/45">
                        Cada fila compara la misma métrica entre los tres países. El mejor valor de cada
                        fila va resaltado; en «Pide por mes» el mejor es el más bajo.
                    </p>

                    <div className="mt-6 overflow-x-auto">
                        <div className="min-w-[580px]">
                            <div className="grid items-center gap-x-4 [grid-template-columns:minmax(130px,1.5fr)_repeat(3,minmax(92px,1fr))]">
                                <span />
                                {data.comparacion.paises.map((p) => (
                                    <span key={p.pais} className="flex items-center gap-2 pb-3">
                                        <span className="h-3 w-4 flex-none rounded-[2px]" style={{ background: BANDERA[p.pais] }} />
                                        <span className="min-w-0">
                                            <span className="block truncate text-[12.5px] font-black">{p.pais}</span>
                                            <span className="block text-[10.5px] font-bold text-white/40">{p.cantidad}</span>
                                        </span>
                                    </span>
                                ))}

                                {data.comparacion.filas.map((f, i) => {
                                    if (f.grupo) {
                                        return (
                                            <span key={`g-${f.grupo}`} className="col-span-full pb-2 pt-5 text-[10px] font-extrabold uppercase tracking-[.18em] text-white/40">
                                                {f.grupo}
                                            </span>
                                        );
                                    }
                                    const max = Math.max(...f.valores, 1);
                                    const mejor = f.menor_mejor
                                        ? Math.min(...f.valores.filter((v) => v > 0), Infinity)
                                        : max;
                                    const fmt = (x) => (f.tipo === 'pct' ? `${x} %` : f.tipo === 'usd' ? `${x} USD` : String(x));
                                    return (
                                        <React.Fragment key={`f-${i}`}>
                                            <span className="border-b border-white/[.06] py-3 text-[12.5px] font-bold leading-snug text-white/70">
                                                {f.label}
                                            </span>
                                            {f.valores.map((v, j) => (
                                                <span key={j} className="flex min-w-0 flex-col gap-1.5 border-b border-white/[.06] py-3">
                                                    <span
                                                        className="text-[13.5px] font-black tabular-nums"
                                                        style={{ color: v === mejor ? '#8AA3FF' : '#fff' }}
                                                    >
                                                        {fmt(v)}
                                                    </span>
                                                    <span className="h-1.5 w-full overflow-hidden rounded-full bg-white/[.07]">
                                                        <span
                                                            className="block h-full rounded-full"
                                                            style={{
                                                                width: `${Math.round((v / max) * 100)}%`,
                                                                background: v === mejor ? COLOR_PAIS[PAISES[j]] : 'rgba(255,255,255,.22)',
                                                            }}
                                                        />
                                                    </span>
                                                </span>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HiringStatsTab;
