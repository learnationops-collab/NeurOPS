import React, { useEffect, useMemo, useState } from 'react';
import {
    Layers, Globe, Users, Sparkles, MessageCircle, Briefcase, Clock, Target, Trophy, ListChecks, Info,
} from 'lucide-react';
import api from '../../../../services/api';
import { Humo } from '../../../comercial/components/Shared';
import { APPS } from '../lib/vista';
import { COLOR_PAIS, cima, embudo, esFinalista, panorama } from '../lib/estadisticas';
import { App, Bandera, Chip, Riel } from './Piezas';
import EmbudoFormulario from './EmbudoFormulario';

// Stats: Panorama (embudo, tarjetas por pregunta, qué país conviene, embudo del
// formulario) y Comparar países (todas las características país por país). Las
// pestañas y el corte Generales/Finalistas viven en la cabecera de la página.

const HUMO_MARCA = ['var(--brand-secondary)', 'var(--brand-primary)', 'var(--brand-secondary-light)', 'var(--focus-blue)'];

const Tarjeta = ({ icono: Icono, titulo, pie, children }) => (
    <section className="panel tl-st-card">
        <div className="tl-cab"><span className="tl-rotulo"><Icono size={14} />{titulo}</span></div>
        {children}
        {pie && <p className="tl-st-pie">{pie}</p>}
    </section>
);

const Niveles = ({ items }) => {
    const max = Math.max(1, ...items.map((x) => x[1]));
    return (
        <div className="tl-niveles">
            {items.map(([l, n], j) => {
                const top = n === max && n > 0;
                return (
                    <div key={l} className={`tl-niv${top ? ' top' : ''}`}>
                        <span>{l}</span>
                        <Riel pct={(n / max) * 100} color={top ? 'var(--brand-secondary)' : 'var(--barra)'} demora={j * 60} />
                        <b>{n}</b>
                    </div>
                );
            })}
        </div>
    );
};

const Verticales = ({ items }) => {
    const max = Math.max(1, ...items.map((x) => x[1]));
    return (
        <div className="tl-vbars">
            {items.map(([l, n], j) => {
                const top = n === max && n > 0;
                return (
                    <div key={l} className="tl-vb">
                        <b style={top ? { color: 'var(--brand-secondary)' } : undefined}>{n}</b>
                        <i style={{ height: `${Math.max(3, Math.round((n / max) * 100))}%`, background: top ? 'var(--brand-secondary)' : 'var(--barra)', animationDelay: `${j * 60}ms` }} />
                        <span>{l}</span>
                    </div>
                );
            })}
        </div>
    );
};

const Dona = ({ items, total }) => {
    let acc = 0;
    return (
        <div className="tl-dona">
            <div className="tl-dona-svg">
                <svg viewBox="0 0 42 42" aria-hidden="true">
                    <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--hueco)" strokeWidth="6" />
                    {total > 0 && items.map(([pais, n]) => {
                        const p = (n / total) * 100;
                        const seg = (
                            <circle key={pais} cx="21" cy="21" r="15.9155" fill="none" stroke={COLOR_PAIS[pais]} strokeWidth="6"
                                strokeDasharray={`${Math.max(0, p - 0.8).toFixed(2)} ${(100 - p + 0.8).toFixed(2)}`} strokeDashoffset={(-acc).toFixed(2)}>
                                <title>{`${pais}: ${n}`}</title>
                            </circle>
                        );
                        acc += p;
                        return seg;
                    })}
                </svg>
                <div className="tl-dona-c"><b>{total}</b><span className="tl-rotulo" style={{ fontSize: 9 }}>total</span></div>
            </div>
            <div className="tl-dona-ley">
                {items.map(([pais, n]) => (
                    <span key={pais} className="tl-ley">
                        <i style={{ background: COLOR_PAIS[pais] }} />{pais}<b>{n}</b>
                        <span className="mut40 num" style={{ width: 38, textAlign: 'right', fontSize: 11.5, fontWeight: 700 }}>
                            {total ? Math.round((n / total) * 100) : 0} %
                        </span>
                    </span>
                ))}
            </div>
        </div>
    );
};

const Panorama = ({ todas, segmento, formulario }) => {
    const finalistas = useMemo(() => todas.filter(esFinalista), [todas]);
    const pool = segmento === 'fin' ? finalistas : todas;
    const d = useMemo(() => panorama(pool), [pool]);
    const emb = embudo(todas, finalistas, segmento);
    const mejorScore = Math.max(...d.porPais.filter((c) => c.n).map((c) => c.score), 0);
    const pie = (items, pre = 'Pico') => {
        const [l, n] = cima(items);
        return n ? <>{pre}: <b>{l} · {n}</b></> : 'Sin datos todavía';
    };

    return (
        <>
            <section className="tl-embudo caja">
                <Humo colores={HUMO_MARCA} tarjeta />
                <div className="tl-cab">
                    <span className="tl-rotulo"><Layers size={14} />{emb.titulo}</span>
                    <span className="tl-cab-der">{emb.sub}</span>
                </div>
                <div className="tl-emb-grid">
                    {emb.pasos.map(([l, n, c], j) => {
                        const p = emb.base ? Math.round((n / emb.base) * 100) : 0;
                        return (
                            <div key={l} className="tl-emb">
                                <div className="tl-emb-n"><span className="tl-cifra" style={{ color: c }}>{n}</span><span>{p} %</span></div>
                                <Riel pct={p} color={c} alto={10} demora={j * 90} />
                                <span className="tl-emb-lbl">{l}</span>
                            </div>
                        );
                    })}
                </div>
            </section>

            <div className="tl-st-grid">
                <Tarjeta icono={Globe} titulo="País"><Dona items={d.pais} total={d.total} /></Tarjeta>
                <Tarjeta icono={Users} titulo="Edades" pie={pie(d.edad, 'Franja más grande')}><Verticales items={d.edad} /></Tarjeta>
                <Tarjeta icono={Sparkles} titulo="Nivel de IA declarado" pie={pie(d.ia)}><Niveles items={d.ia} /></Tarjeta>
                <Tarjeta icono={MessageCircle} titulo="Inglés" pie={pie(d.ingles)}><Niveles items={d.ingles} /></Tarjeta>
                <Tarjeta icono={MessageCircle} titulo="Portugués o español" pie={pie(d.idioma2)}><Niveles items={d.idioma2} /></Tarjeta>
                <Tarjeta icono={Briefcase} titulo="Presupuesto pedido (USD)" pie={d.pideMedia ? <>Media pedida: <b>{d.pideMedia} USD</b></> : 'Sin datos todavía'}>
                    <Verticales items={d.pide} />
                </Tarjeta>
                <Tarjeta icono={Layers} titulo="Herramientas que manejan">
                    <div className="tl-tools">
                        {d.herramientas.map(([id, n], j) => {
                            const a = APPS.find((x) => x.id === id);
                            const p = d.total ? Math.round((n / d.total) * 100) : 0;
                            return (
                                <div key={id} className="tl-tool">
                                    <App img={a.img} titulo={a.t} />
                                    <div>
                                        <span className="tl-tool-cab"><span>{a.t}</span><span>{n} · {p} %</span></span>
                                        <Riel pct={p} demora={j * 60} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Tarjeta>
                <Tarjeta icono={Clock} titulo="Años de experiencia" pie={pie(d.experiencia)}><Niveles items={d.experiencia} /></Tarjeta>
            </div>

            <section className="panel">
                <div className="tl-cab">
                    <span className="tl-rotulo"><Target size={14} />{segmento === 'fin' ? 'Qué país rinde mejor entre las finalistas' : 'Qué país conviene'}</span>
                    <span className="tl-cab-der">promedio del grupo, sobre 100</span>
                </div>
                <div className="tl-paises">
                    {d.porPais.map((c) => (
                        <div key={c.pais} className="tl-pais" style={{ '--c': COLOR_PAIS[c.pais] }}>
                            <div className="tl-pais-cab">
                                <Bandera de={c.pais} grande />
                                <b>{c.pais}</b>
                                {c.n > 0 && c.score === mejorScore && <Chip c="var(--success)" icono={Trophy} chico>Mejor score</Chip>}
                                <span className="mut40 num t-cap" style={{ fontWeight: 700 }}>{c.n}</span>
                            </div>
                            {[['Score', c.score], ['IA', c.ia], ['Inglés', c.ingles]].map(([l, v]) => (
                                <div key={l} className="tl-pais-m">
                                    <span>{l}<b>{v}</b></span>
                                    <Riel pct={v} color={COLOR_PAIS[c.pais]} />
                                </div>
                            ))}
                            <div className="tl-pais-pide"><span className="tl-rotulo">Pide</span><b>{c.pide ? `${c.pide} USD` : '—'}</b></div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="panel">
                <div className="tl-cab">
                    <span className="tl-rotulo"><ListChecks size={14} />Embudo del formulario</span>
                    <span className="tl-cab-der">dónde se queda la gente, pregunta por pregunta</span>
                </div>
                {formulario === null
                    ? <span className="t-cap mut40">Cargando…</span>
                    : <EmbudoFormulario items={formulario} />}
            </section>
        </>
    );
};

const formato = (f, x) => {
    if (f.tipo === 'pct') return `${x} %`;
    if (f.tipo === 'usd') return `${x} USD`;
    return String(x);
};

const ComparaPaises = ({ comparacion, segmento }) => {
    if (!comparacion) return <section className="panel"><span className="t-cap mut40">Cargando la comparación…</span></section>;
    const paises = comparacion.paises.map((p) => p.pais);
    const total = comparacion.paises.reduce((a, p) => a + p.cantidad, 0);
    return (
        <section className="panel">
            <div className="tl-cab">
                <span className="tl-rotulo"><Globe size={14} />Todas las características, país por país</span>
                <span className="tl-cab-der">
                    sobre {total} {segmento === 'fin' ? 'finalistas' : 'postulaciones'} · lo mejor de cada fila resaltado
                </span>
            </div>
            <div className="tl-mtx-scroll">
                <div className="tl-mtx">
                    <span />
                    {paises.map((p) => <span key={p} className="tl-mtx-h"><Bandera de={p} grande />{p}</span>)}
                    {comparacion.filas.map((f) => {
                        if (f.grupo) return <span key={f.grupo} className="tl-mtx-g">{f.grupo}</span>;
                        const max = Math.max(...f.valores);
                        const conDato = f.valores.filter((v) => v > 0);
                        const mejor = f.menor_mejor ? Math.min(...(conDato.length ? conDato : [0])) : max;
                        return (
                            <React.Fragment key={f.label}>
                                <span className="tl-mtx-l">{f.label}</span>
                                {f.valores.map((x, j) => {
                                    const es = x === mejor && x > 0;
                                    return (
                                        <span key={paises[j]} className={`tl-mtx-c${es ? ' mejor' : ''}`}>
                                            <b>{formato(f, x)}</b>
                                            <Riel pct={max ? (x / max) * 100 : 0} color={es ? COLOR_PAIS[paises[j]] : 'var(--border-control)'} alto={4} />
                                        </span>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-2xl border p-4" style={{ background: 'var(--info-surface)', borderColor: 'var(--info-border)' }}>
                <Info size={18} style={{ color: 'var(--info)', marginTop: 2 }} />
                <p className="t-sm" style={{ fontWeight: 600, maxWidth: '80ch' }}>
                    Los porcentajes son sobre las postulaciones de cada país; los puntajes de IA, herramientas, aporte y
                    criterio van de 0 a 100. En «Pide por mes» lo mejor es lo más bajo.
                </p>
            </div>
        </section>
    );
};

const HiringStats = ({ todas, pestana, segmento }) => {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        let vigente = true;
        setStats(null);
        api.get(`/assistant-applications/stats?segmento=${segmento === 'fin' ? 'finalistas' : 'todos'}`)
            .then((res) => { if (vigente) setStats(res.data); })
            .catch(() => { if (vigente) setStats({ error: true }); });
        return () => { vigente = false; };
    }, [segmento]);

    if (pestana === 'paises') return <ComparaPaises comparacion={stats?.comparacion} segmento={segmento} />;
    return <Panorama todas={todas} segmento={segmento} formulario={stats ? (stats.embudo_formulario || []) : null} />;
};

export default HiringStats;
