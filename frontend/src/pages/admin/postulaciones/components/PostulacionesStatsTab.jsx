import React, { useState, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
import api from '../../../../services/api';

const SEGMENTOS = [
    { id: 'todos', label: 'Completaron', conteo: 'todas' },
    { id: 'preseleccionados', label: 'Seleccionados', conteo: 'preseleccionadas' },
    { id: 'en_reserva', label: 'En reserva', conteo: 'en_reserva' },
    { id: 'testeo', label: 'Testeo', conteo: 'testeo' },
    { id: 'descartados', label: 'Descartados', conteo: 'descartadas' },
    { id: 'bajas', label: 'De baja', conteo: 'bajas' },
    { id: 'incompletos', label: 'Incompletas', conteo: 'incompletas' },
];

// Filtro del listado (/job-applications?filtro=...) que trae la misma gente
// que cada segmento de estadísticas, para el export CSV.
const FILTRO_DE_SEGMENTO = {
    todos: 'todas',
    preseleccionados: 'preseleccionadas',
    en_reserva: 'en_reserva',
    testeo: 'testeo',
    descartados: 'descartadas',
    bajas: 'bajas',
    incompletos: 'incompletas',
};

// KPI principal (primera tarjeta): label y de qué total se saca la fracción,
// varía según el segmento — no tiene sentido decir "Completaron X de Y que
// abrieron" cuando X ya son los preseleccionados, por ejemplo.
const KPI_PRINCIPAL = {
    todos: (s) => ({ label: 'Completaron', valor: s.total, base: s.abrieron_formulario, unidad: `de ${s.abrieron_formulario} que abrieron`, nota: `${s.abrieron_formulario ? Math.round((s.total / s.abrieron_formulario) * 100) : 0}% de los que abrieron el formulario` }),
    preseleccionados: (s) => ({ label: 'Seleccionados', valor: s.total, base: s.total_completas, unidad: `de ${s.total_completas} completas` }),
    en_reserva: (s) => ({ label: 'En reserva', valor: s.total, base: s.total_completas, unidad: `de ${s.total_completas} completas` }),
    testeo: (s) => ({ label: 'En testeo', valor: s.total, base: s.total_completas, unidad: `de ${s.total_completas} completas` }),
    descartados: (s) => ({ label: 'Descartados', valor: s.total, base: s.total_completas, unidad: `de ${s.total_completas} completas` }),
    bajas: (s) => ({ label: 'De baja', valor: s.total, base: s.total_completas, unidad: `de ${s.total_completas} completas` }),
    incompletos: (s) => ({ label: 'Incompletos', valor: s.total, base: s.abrieron_formulario, unidad: `de ${s.abrieron_formulario} que abrieron` }),
};

// Misma paleta en todos los gráficos multi-segmento (donut, chips) — 5 colores alcanzan para
// cualquier pregunta de opción múltiple real del formulario (nunca hay más de 4-5 opciones).
const PALETA = ['#FF3FA4', '#B03BE0', '#5B4BD6', '#4E8BD8', '#2FBF8F', '#F59E0B'];
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

// Encabezado de sección numerado ("01 · Lo que hay que saber"), para agrupar los paneles en
// bloques temáticos en vez de un único grid parejo — mockup de referencia, 10/sep/2026.
const SeccionHeader = ({ n, title }) => (
    <div className="flex items-center gap-3 pt-2">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-pink-500/20 text-[11px] font-black text-pink-300">
            {n}
        </span>
        <span className="text-lg font-black text-white">{title}</span>
    </div>
);

const Panel = ({ title, subtitle, base, children, delay = 0 }) => (
    <div
        className="flex h-full flex-col gap-4 rounded-3xl border border-white/12 bg-white/[.04] p-6"
        style={{ animation: `ln-stats-up .5s ${delay}ms cubic-bezier(.2,.7,.3,1) both` }}
    >
        <div className="flex items-baseline justify-between gap-3">
            <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-black text-white">{title}</span>
                {subtitle && <span className="text-[11.5px] text-white/40">{subtitle}</span>}
            </div>
            {base !== undefined && (
                <span className="flex-none text-[10px] font-black uppercase tracking-widest text-white/35">base {base}</span>
            )}
        </div>
        {children}
    </div>
);

// Tarjeta KPI con una barrita de progreso pegada abajo (pedido del usuario: "muy diferente" al
// diseño anterior) — mockup de referencia: número grande + descripción + acento de color al pie
// que representa el % que ese número es de su base.
const KpiTile = ({ label, valor, unidad, nota, pct: porcentaje, color, delay }) => (
    <div
        className="relative flex flex-col gap-2.5 overflow-hidden rounded-3xl border border-white/12 bg-white/5 p-6 pb-7"
        style={{ animation: `ln-stats-up .5s ${delay}ms cubic-bezier(.2,.7,.3,1) both` }}
    >
        <span className="text-[11px] font-black uppercase tracking-widest text-white/45">{label}</span>
        <span className="flex items-baseline gap-2">
            <span className="text-4xl font-black leading-none tracking-tight" style={{ color }}>{valor}</span>
            {unidad && <span className="text-[13px] font-bold text-white/45">{unidad}</span>}
        </span>
        {nota && <span className="text-[12px] leading-snug text-white/45">{nota}</span>}
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/[.07]">
            <span className="block h-full transition-all duration-700" style={{ width: `${Math.min(100, porcentaje ?? 0)}%`, background: color }} />
        </span>
    </div>
);

// Anillo SVG multi-segmento (un `<circle>` por opción, con stroke-dasharray/offset) — mockup de
// referencia: reemplaza el conic-gradient de CSS que se usaba antes, que no podía mostrar más
// de un segmento. Reusado tanto para "mayoría" de una pregunta de opción múltiple como para la
// distribución de score por tramo.
const Anillo = ({ segmentos, centroValor, centroLabel }) => {
    const r = 52, c = 2 * Math.PI * r;
    let acumulado = 0;
    return (
        <div className="relative h-[124px] w-[124px] flex-none">
            <svg width="124" height="124" viewBox="0 0 124 124" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="62" cy="62" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="16" />
                {segmentos.map((s, i) => {
                    if (s.valor <= 0) return null;
                    const largo = s.valor * c;
                    const dash = `${largo} ${Math.max(0, c - largo)}`;
                    const offset = -acumulado;
                    acumulado += largo;
                    return <circle key={i} cx="62" cy="62" r={r} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={dash} strokeDashoffset={offset} />;
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black leading-none text-white">{centroValor}</span>
                <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-white/45">{centroLabel}</span>
            </div>
        </div>
    );
};

// Donut + leyenda para una pregunta de opción múltiple con pocas opciones — el centro muestra el
// % de la opción más elegida ("mayoría"), no un promedio.
const DonutLegend = ({ items }) => {
    const total = items.reduce((a, it) => a + it.cantidad, 0);
    if (!items.length || !total) return <span className="text-[13px] text-white/40">Sin datos todavía.</span>;
    const segmentos = items.map((it, i) => ({ valor: it.cantidad / total, color: PALETA[i % PALETA.length] }));
    return (
        <div className="flex flex-1 flex-wrap items-center gap-5">
            <Anillo segmentos={segmentos} centroValor={`${pct(items[0].cantidad, total)}%`} centroLabel="mayoría" />
            <div className="flex min-w-[140px] flex-1 flex-col gap-2.5">
                {items.map((it, i) => (
                    <div key={it.opcion} className="flex items-center gap-2.5">
                        <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: PALETA[i % PALETA.length] }} />
                        <span className="flex-1 truncate text-[12.5px] text-white/80">{it.opcion}</span>
                        <span className="text-[12.5px] font-black text-white">{it.cantidad}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Barras verticales con la opción líder resaltada en degradé — el resto queda en gris parejo,
// para que salte a la vista cuál es la respuesta más común sin tener que leer los números.
const BarChartVertical = ({ items }) => {
    if (!items.length) return <span className="text-[13px] text-white/40">Sin datos todavía.</span>;
    const max = Math.max(1, ...items.map(i => i.cantidad));
    const liderIdx = items.findIndex(i => i.cantidad === max);
    return (
        <div className="flex min-h-[170px] flex-1 items-end gap-2.5">
            {items.map((it, i) => {
                const esLider = i === liderIdx;
                const alturaPct = Math.max((it.cantidad / max) * 100, it.cantidad ? 4 : 0);
                return (
                    <div key={it.opcion} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                        <span className={`text-[13px] font-black tabular-nums ${esLider ? 'text-pink-400' : 'text-white/80'}`}>{it.cantidad}</span>
                        <div className="flex h-full w-full items-end">
                            <div
                                className="w-full rounded-t-lg"
                                style={{ height: `${alturaPct}%`, background: esLider ? 'linear-gradient(90deg,#1323C6,#FF3FA4)' : 'rgba(255,255,255,.26)' }}
                            />
                        </div>
                        <span className="text-center text-[10.5px] leading-tight text-white/50">{it.opcion}</span>
                    </div>
                );
            })}
        </div>
    );
};

// Filas "punto sobre una línea" — pensado para distribuciones con más opciones (países, edades)
// donde una tira de barras verticales quedaría apretada: cada fila es compacta y el punto al
// final de la línea marca el valor relativo a la opción con más respuestas.
const DotSliderList = ({ items }) => {
    if (!items.length) return <span className="text-[13px] text-white/40">Sin datos todavía.</span>;
    const max = Math.max(1, ...items.map(i => i.cantidad));
    return (
        <div className="flex flex-col gap-3.5">
            {items.map(it => {
                const w = (it.cantidad / max) * 100;
                return (
                    <div key={it.opcion} className="flex items-center gap-3">
                        <span className="w-[38%] flex-none truncate text-[12.5px] font-bold text-white">{it.opcion}</span>
                        <span className="relative h-3.5 flex-1">
                            <span className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
                            <span
                                className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full transition-all duration-700"
                                style={{ width: `${w}%`, background: 'linear-gradient(90deg,#1323C6,#FF3FA4)' }}
                            />
                            <span
                                className="absolute top-1/2 h-[11px] w-[11px] -translate-y-1/2 -translate-x-1/2 rounded-full bg-pink-500 transition-all duration-700"
                                style={{ left: `${w}%` }}
                            />
                        </span>
                        <span className="w-9 flex-none text-right text-[12.5px] font-black text-white">{it.cantidad}</span>
                    </div>
                );
            })}
        </div>
    );
};

// Nube de chips ordenados por frecuencia (Herramientas) — el más usado queda resaltado con
// borde/fondo rosa, el resto en chips neutros.
const ChipCloud = ({ items }) => {
    if (!items.length) return <span className="text-[13px] text-white/40">Sin datos todavía.</span>;
    const max = Math.max(1, ...items.map(i => i.cantidad));
    return (
        <div className="flex flex-wrap gap-2">
            {items.map(it => {
                const esLider = it.cantidad === max;
                return (
                    <span
                        key={it.opcion}
                        className={`rounded-full border px-3.5 py-2 text-[12px] font-bold ${esLider ? 'border-pink-400/50 bg-pink-500/10 text-white' : 'border-white/12 bg-white/5 text-white/70'}`}
                    >
                        {it.opcion} <span className={esLider ? 'text-pink-300' : 'text-white/40'}>{it.cantidad}</span>
                    </span>
                );
            })}
        </div>
    );
};

// Línea + área SVG a mano (mismo mecanismo que el mockup: viewBox fijo 320×160, línea de base en
// y=144, degradé de relleno que se desvanece hacia abajo) — reemplaza el gráfico de barras que
// había antes para "Postulaciones por día".
const AreaChart = ({ data }) => {
    const max = Math.max(1, ...data.map(d => d.cantidad));
    const n = data.length;
    const stepX = n > 1 ? 320 / (n - 1) : 320;
    const puntos = data.map((d, i) => [i * stepX, 144 - (d.cantidad / max) * 112]);
    const puntosStr = puntos.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const poligono = `0,144 ${puntosStr} 320,144`;
    return (
        <div className="flex flex-1 flex-col gap-2">
            <svg viewBox="0 0 320 160" preserveAspectRatio="none" style={{ width: '100%', height: 180, overflow: 'visible' }}>
                <defs>
                    <linearGradient id="lnStatLine" x1="0" y1="1" x2="1" y2="0">
                        <stop offset="0%" stopColor="#1323C6" />
                        <stop offset="100%" stopColor="#FF6AD5" />
                    </linearGradient>
                    <linearGradient id="lnStatFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255,63,164,.34)" />
                        <stop offset="100%" stopColor="rgba(255,63,164,0)" />
                    </linearGradient>
                </defs>
                <line x1="0" y1="144" x2="320" y2="144" stroke="rgba(255,255,255,.14)" strokeWidth="2" />
                <line x1="0" y1="96" x2="320" y2="96" stroke="rgba(255,255,255,.06)" strokeWidth="2" />
                <line x1="0" y1="48" x2="320" y2="48" stroke="rgba(255,255,255,.06)" strokeWidth="2" />
                <polygon points={poligono} fill="url(#lnStatFill)" />
                <polyline points={puntosStr} fill="none" stroke="url(#lnStatLine)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                {puntos.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="rgba(255,255,255,.55)" />)}
            </svg>
            <div className="flex justify-between text-[9px] text-white/35">
                {data.map((d, i) => (i % 3 === 0 || i === data.length - 1) ? <span key={d.fecha}>{d.fecha.slice(5)}</span> : <span key={d.fecha} />)}
            </div>
        </div>
    );
};

// Barra gruesa de embudo (26px, con el % de caída y el conteo en la misma fila que la etiqueta,
// no en una línea aparte arriba) — mockup de referencia.
const EmbudoFila = ({ etapa, cantidad, deltaPct, max }) => (
    <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-white/80">{etapa}</span>
            <span className="flex items-baseline gap-2 whitespace-nowrap">
                <span className={`text-[11px] font-bold ${deltaPct === null ? 'text-white/35' : deltaPct <= -50 ? 'text-amber-400' : 'text-white/35'}`}>
                    {deltaPct === null ? '100 %' : `${deltaPct} %`}
                </span>
                <span className="text-[14px] font-black tabular-nums text-white">{cantidad}</span>
            </span>
        </div>
        <div className="h-[26px] overflow-hidden rounded-[9px] bg-white/[.06]">
            <div
                className="h-full rounded-[9px] bg-gradient-to-r from-blue-600 to-pink-500 transition-all duration-700"
                style={{ width: `${Math.max((cantidad / max) * 100, 3)}%` }}
            />
        </div>
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
    // Conteos por segmento para los chips ("Completaron · 48") — se reusa el mismo `conteos`
    // que ya devuelve el listado principal en vez de agregar un endpoint nuevo solo para esto.
    const [conteosSegmento, setConteosSegmento] = useState({});

    useEffect(() => {
        api.get('/job-applications?filtro=todas')
            .then(res => setConteosSegmento(res.data.conteos || {}))
            .catch(err => console.error('Error al cargar conteos de postulaciones:', err));
    }, []);

    useEffect(() => {
        setStats(null);
        api.get(`/job-applications/stats?segmento=${segmento}`)
            .then(res => setStats(res.data))
            .catch(err => console.error('Error al cargar estadísticas:', err));
    }, [segmento]);

    const exportarCsv = useCallback(async () => {
        setExportando(true);
        try {
            const filtro = FILTRO_DE_SEGMENTO[segmento] || 'todas';
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

            <div className="flex flex-col gap-1">
                <span className="text-2xl font-black text-white">Estadísticas</span>
                <span className="text-[13px] text-white/55">De dónde llegan, dónde se caen y cómo se reparte el embudo.</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[.03] p-1.5 w-fit">
                    {SEGMENTOS.map(s => (
                        <button
                            key={s.id}
                            onClick={() => setSegmento(s.id)}
                            className={`rounded-xl px-5 py-3 text-[13px] font-bold transition-all ${
                                segmento === s.id
                                    ? 'bg-gradient-to-r from-blue-600 to-pink-500 text-white shadow-lg shadow-pink-500/20'
                                    : 'text-white/60 hover:text-white'
                            }`}
                        >
                            {s.label}
                            {typeof conteosSegmento[s.conteo] === 'number' && (
                                <span className={segmento === s.id ? 'ml-1.5 text-white/80' : 'ml-1.5 text-white/35'}>
                                    · {conteosSegmento[s.conteo]}
                                </span>
                            )}
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
    const maxEmbudo = stats.embudo ? Math.max(1, ...stats.embudo.map(e => e.cantidad)) : 1;
    const principal = (KPI_PRINCIPAL[segmento] || KPI_PRINCIPAL.todos)(stats);

    const kpis = [
        { ...principal, color: '#FF3FA4', pct: pct(principal.valor, principal.base) },
        { label: 'Score medio', valor: stats.score_medio, unidad: '/ 100', color: '#B03BE0', pct: stats.score_medio },
        { label: 'Score 85 o más', valor: stats.score_85, unidad: `de ${stats.total}`, color: '#2FBF8F', pct: pct(stats.score_85, stats.total) },
        { label: 'Con video y llamada', valor: stats.con_material, unidad: `de ${stats.total}`, color: '#4E8BD8', pct: pct(stats.con_material, stats.total) },
    ];

    // El anillo de "Calidad del pool" reusa el mismo componente que las preguntas de opción
    // múltiple: cada tramo de score es un segmento, en vez del conic-gradient de un solo tono
    // que solo alcanzaba para mostrar el score medio como una fracción del círculo.
    const totalTramos = stats.distribucion_tramos.reduce((a, t) => a + t.cantidad, 0) || 1;
    const segmentosTramo = stats.distribucion_tramos.map((t, i) => ({ valor: t.cantidad / totalTramos, color: PALETA[i % PALETA.length] }));

    return (
        <div className="flex flex-col gap-6">
            <SeccionHeader n="01" title="Lo que hay que saber" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {kpis.map((k, i) => <KpiTile key={k.label} {...k} delay={i * 40} />)}
            </div>

            <SeccionHeader n="02" title="Volumen y embudo" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {stats.embudo && (
                    <Panel title="Embudo de búsqueda" subtitle="De abrir el formulario a candidato fuerte" delay={0}>
                        <div className="flex flex-col gap-3.5">
                            {stats.embudo.map((e, i) => {
                                const anterior = i > 0 ? stats.embudo[i - 1].cantidad : null;
                                const deltaPct = anterior ? -Math.round(((anterior - e.cantidad) / anterior) * 100) : null;
                                return <EmbudoFila key={e.etapa} etapa={e.etapa} cantidad={e.cantidad} deltaPct={deltaPct} max={maxEmbudo} />;
                            })}
                        </div>
                    </Panel>
                )}

                <Panel title="Postulaciones por día" subtitle="Últimas 2 semanas" delay={40}>
                    {stats.por_dia.every(d => d.cantidad === 0) ? (
                        <span className="text-[13px] text-white/40">Sin postulaciones recientes.</span>
                    ) : (
                        <AreaChart data={stats.por_dia} />
                    )}
                </Panel>
            </div>

            <SeccionHeader n="03" title="Calidad del pool" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel title="Distribución de score" subtitle="Por tramo, sobre el score final" delay={0}>
                    <div className="flex flex-1 flex-wrap items-center gap-6">
                        <Anillo segmentos={segmentosTramo} centroValor={stats.score_medio} centroLabel="score medio" />
                        <div className="flex flex-1 flex-col gap-2.5 min-w-[140px]">
                            {stats.distribucion_tramos.map((t, i) => (
                                <div key={t.desde} className="flex items-center gap-2.5">
                                    <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: PALETA[i % PALETA.length] }} />
                                    <span className="flex-1 text-[12.5px] text-white/80">{t.desde}-{t.hasta - 1}</span>
                                    <span className="text-[12.5px] font-black text-white">{t.cantidad}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Panel>

                <Panel title="Histograma de scores" subtitle="Cantidad de candidatos por decena" delay={40}>
                    <BarChartVertical items={stats.histograma.map(h => ({ opcion: `${h.decena}s`, cantidad: h.cantidad }))} />
                </Panel>
            </div>

            <SeccionHeader n="04" title="Perfil de quienes se postulan" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                <Panel title="Conocimiento como closer" subtitle="Pregunta 8 · opción múltiple" base={stats.total} delay={0}>
                    <DonutLegend items={stats.distribucion_conocimiento} />
                </Panel>
                <Panel title="Nivel de inglés" subtitle="Pregunta 11 · opción múltiple" base={stats.total} delay={40}>
                    <BarChartVertical items={stats.distribucion_ingles} />
                </Panel>
                <Panel title="Disclaimer de frustración" base={stats.total} delay={80}>
                    <DonutLegend items={stats.distribucion_disclaimer} />
                </Panel>
                <Panel title="Lugar de residencia" base={stats.total} delay={120}>
                    <DotSliderList items={stats.distribucion_pais} />
                </Panel>
                <Panel title="Edad" base={stats.total} delay={160}>
                    <DotSliderList items={stats.distribucion_edad} />
                </Panel>
                <Panel title="Herramientas que usan" subtitle="Pregunta 13 · respuesta múltiple" base={stats.total} delay={200}>
                    <ChipCloud items={stats.distribucion_herramientas} />
                </Panel>
            </div>
        </div>
    );
};

export default PostulacionesStatsTab;
