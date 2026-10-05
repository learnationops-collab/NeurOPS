// Piezas de los gráficos de Stats, hechas a mano en SVG y HTML (sin librerías), igual que el prototipo.

import React from 'react';
import { Humo, HUMO_MARCA, Icono } from '../../ui/base';
import { DIAS } from '../../core/catalogos';
import { fmt, mayus, pad } from '../../core/util';

const DIA = 86400000;

// Tarjeta de un gráfico: título, bajada y algo extra a la derecha (leyenda, escala).
export function Grafico({ t, sub, extra, ancho, aura = HUMO_MARCA, children }) {
    return (
        <section className={'grafico caja' + (ancho ? ' grafico--ancho' : '')}>
            <Humo clase="humo--tarjeta humo--suave" cols={aura} />
            <div className="g-cab">
                <div className="g-tit"><h3 className="t-h3">{t}</h3>{sub && <span>{sub}</span>}</div>
                {extra}
            </div>
            {children}
        </section>
    );
}

export function VacioGrafico({ icono, txt, accion, onAccion }) {
    return (
        <div className="g-vacio">
            <span className="g-vacio-ico"><Icono n={icono} s={18} /></span>
            <p>{txt}</p>
            <button type="button" className="link-btn" data-nav="" onClick={onAccion}><Icono n="plus" />{accion}</button>
        </div>
    );
}

// Ranking: cada fila con su color de identidad, valor y parte del total. Las barras crecen al entrar.
// items: [{k, v, c, av?, sub?}]
export function Ranking({ items }) {
    if (!items.length) return <p className="t-sm mut40">Sin datos en este período.</p>;
    const tot = items.reduce((a, x) => a + x.v, 0), max = Math.max(...items.map(x => x.v)) || 1;
    return (
        <div className="rk-lista">
            {items.slice(0, 8).map((x, i) => {
                const pc = tot ? x.v / tot * 100 : 0;
                return (
                    <div key={x.k + i} className="rk" style={{ '--c': x.c, '--d': (i * 70) + 'ms' }} data-tip={x.k + '|' + x.v + ' agendas · ' + fmt(pc, 0) + '% del total'}>
                        {x.av || <i className="rk-punto" aria-hidden="true" />}
                        <span className="rk-n">{x.k}{x.sub && <em>{x.sub}</em>}</span>
                        <span className="rk-v num"><b>{x.v}</b><em>{fmt(pc, 0)}%</em></span>
                        <span className="rk-pista"><i style={{ width: (x.v / max * 100) + '%' }} /></span>
                    </div>
                );
            })}
        </div>
    );
}

// Calificación: escala 0–10 con marca del promedio del equipo. items: [{k, v, n, c}]
export function Gauges({ items, prom }) {
    if (!items.length) return <p className="t-sm mut40">Sin calificaciones en este período.</p>;
    return (
        <div className="gg-lista">
            {items.map((x, i) => (
                <div key={x.k + i} className="gg" style={{ '--c': x.c, '--d': (i * 90) + 'ms' }} data-tip={x.k + '|' + fmt(x.v, 1) + ' de 10 · ' + x.n + ' leads'}>
                    <span className="gg-n"><i className="rk-punto" />{x.k}<em>{x.n} leads</em></span>
                    <span className="gg-escala">
                        <i className="gg-fill" style={{ width: (x.v * 10) + '%' }} />
                        {prom != null && <i className="gg-prom" style={{ left: (prom * 10) + '%' }} title="Promedio general" />}
                        <i className="gg-pin" style={{ left: (x.v * 10) + '%' }} />
                    </span>
                    <b className="gg-v num">{fmt(x.v, 1)}</b>
                </div>
            ))}
            <div className="gg-eje" aria-hidden="true">
                <span>0</span><span>5</span><span>10</span>
                {prom != null && <em style={{ left: (prom * 10) + '%' }}>promedio {fmt(prom, 1)}</em>}
            </div>
        </div>
    );
}

// Embudo: barras centradas, conversión desde el inicio y la caída más grande explicada.
// pasos: [[nombre, índice de llegada, ícono]], vals: cuántos llegaron a cada paso.
export function Embudo({ pasos, vals }) {
    let peor = -1, peorI = -1;
    for (let j = 1; j < vals.length; j++) { const c = vals[j - 1] - vals[j]; if (c > peor) { peor = c; peorI = j; } }
    const base = vals[0] || 1;
    return (
        <>
            {peorI > 0 && (
                <div className="emb-alerta">
                    <Icono n="fuego" s={16} />
                    <span><b>Mayor caída:</b> en «{pasos[peorI][0]}» se van <b className="num">{peor}</b> leads ({fmt(vals[peorI - 1] ? peor / vals[peorI - 1] * 100 : 0, 0)}% de los que llegaron ahí).</span>
                </div>
            )}
            <div className="emb2">
                {pasos.map((p, j) => {
                    const pc = vals[j] / base * 100, caida = j ? vals[j - 1] - vals[j] : 0, mal = j === peorI;
                    return (
                        <div key={j} className={'emb2-f' + (mal ? ' emb2-f--mal' : '')} style={{ '--d': (j * 45) + 'ms' }} data-tip={p[0] + '|' + vals[j] + ' leads · ' + fmt(pc, 0) + '% de los que entraron'}>
                            <span className="emb2-ico"><Icono n={mal ? 'fuego' : p[2]} s={13} /></span>
                            <span className="emb2-n">{p[0]}</span>
                            <span className="emb2-pista"><i style={{ width: Math.max(pc, 1.5) + '%' }} /></span>
                            <span className="emb2-v num"><b>{vals[j]}</b><em>{fmt(pc, 0)}%</em></span>
                            <span className="emb2-c num">{caida ? '−' + caida : ''}</span>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

// Curva suave que no se pasa de los puntos.
function suave(ps) {
    if (ps.length < 3) return ps.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    let d = 'M' + ps[0][0].toFixed(1) + ' ' + ps[0][1].toFixed(1);
    for (let i = 0; i < ps.length - 1; i++) {
        const a = ps[i], b = ps[i + 1], dx = (b[0] - a[0]) / 2.6;
        d += 'C' + (a[0] + dx).toFixed(1) + ' ' + a[1].toFixed(1) + ',' + (b[0] - dx).toFixed(1) + ' ' + b[1].toFixed(1) + ',' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
    }
    return d;
}
function diaMes(ts) { const f = new Date(ts); return f.getDate() + '/' + (f.getMonth() + 1); }

// Agendas por día: área con degradé, línea que se dibuja al entrar y guía al pasar el mouse.
export function Linea({ s, s2, ahora }) {
    const W = 760, H = 200, P = 30, max = Math.max(4, ...s, ...s2), n = s.length;
    const x = (i) => P + (W - P - 8) * (n > 1 ? i / (n - 1) : 0);
    const y = (v) => 10 + (H - 34) * (1 - v / max);
    const paso = Math.ceil(max / 4), grilla = [];
    for (let v = 0; v <= max; v += paso) grilla.push(v);
    const pts = s.map((v, i) => [x(i), y(v)]);
    const d1 = suave(pts);
    const area = d1 + 'L' + x(n - 1).toFixed(1) + ' ' + y(0) + 'L' + x(0).toFixed(1) + ' ' + y(0) + 'Z';
    const d2 = suave(s2.map((v, i) => [x(i), y(v)]));
    const ancho = (W - P) / n, ul = pts[n - 1];
    const fecha = (i) => ahora - (n - 1 - i) * DIA;
    return (
        <svg className="svg-g lg" viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label="Agendas por día">
            <defs>
                <linearGradient id="lgArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--brand-secondary)" stopOpacity=".34" />
                    <stop offset="1" stopColor="var(--brand-secondary)" stopOpacity="0" />
                </linearGradient>
            </defs>
            {grilla.map(v => (
                <g key={v}>
                    <line className="grilla-l" x1={P} x2={W} y1={y(v)} y2={y(v)} />
                    <text x={P - 8} y={y(v) + 3} textAnchor="end">{v}</text>
                </g>
            ))}
            <path className="lg-area" d={area} fill="url(#lgArea)" />
            <path d={d2} fill="none" stroke="var(--idle)" strokeWidth="1.5" strokeDasharray="4 5" opacity=".8" />
            <path className="lg-linea" d={d1} fill="none" stroke="var(--brand-secondary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" pathLength="1" />
            <circle className="lg-ult" cx={ul[0]} cy={ul[1]} r="5" />
            <text className="lg-ult-t" x={ul[0] - 10} y={ul[1] - 10} textAnchor="end">{s[n - 1]} hoy</text>
            {[...new Set([0, Math.floor((n - 1) / 2), n - 1])].map(i => (
                <text key={'e' + i} x={x(i)} y={H - 4} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{diaMes(fecha(i))}</text>
            ))}
            {s.map((v, i) => (
                <g key={'h' + i} className="lg-hit" data-tip={diaMes(fecha(i)) + '|' + v + ' agendas · antes ' + s2[i]}>
                    <rect x={x(i) - ancho / 2} y="0" width={ancho} height={H} fill="transparent" />
                    <line className="lg-cruz" x1={x(i)} x2={x(i)} y1="8" y2={y(0)} />
                    <circle className="lg-pt" cx={x(i)} cy={y(v)} r="5" />
                </g>
            ))}
        </svg>
    );
}

// Horarios más elegidos: días en columnas, horas (8 a 21) en filas; intensidad = agendas. Los 3 más elegidos van marcados.
export function MapaHorarios({ agendas }) {
    const mat = [];
    let mx = 1;
    for (let dw = 0; dw < 7; dw++) {
        mat[dw] = [];
        for (let hr = 8; hr < 22; hr++) {
            const v = agendas.filter(l => l.dow === dw && l.hora === hr).length;
            mat[dw].push(v); mx = Math.max(mx, v);
        }
    }
    const celdas = [];
    DIAS.forEach(dd => { mat[dd.d].forEach((v, j) => { celdas.push({ d: dd, h: 8 + j, v }); }); });
    const top3 = celdas.slice().sort((a, b) => b.v - a.v).slice(0, 3);
    const filas = [];
    for (let hh = 8; hh < 22; hh++) filas.push(hh);
    return (
        <>
            <div className="hc-top">
                {top3.map((c, i) => (
                    <span key={i} className="hc-chip"><b className="num">{i + 1}</b>{mayus(c.d.n).slice(0, 3)} {pad(c.h)}:00<em className="num">{c.v}</em></span>
                ))}
            </div>
            <div className="hc">
                <span />
                {DIAS.map(dd => <span key={dd.d} className="hc-d">{mayus(dd.n).slice(0, 3)}</span>)}
                {filas.map(hh => (
                    <React.Fragment key={hh}>
                        <span className="hc-h num">{pad(hh)}:00</span>
                        {DIAS.map(dd => {
                            const v = mat[dd.d][hh - 8], r = mx ? v / mx : 0, rk = top3.findIndex(c => c.d === dd && c.h === hh);
                            return (
                                <i key={dd.d} className={'hc-c' + (rk >= 0 ? ' hc-c--top' : '')} style={{ '--a': Math.round(6 + r * 88) + '%' }} data-tip={mayus(dd.n) + ' ' + pad(hh) + ':00|' + v + ' agendas'}>
                                    {r >= 0.55 && <b className="num">{v}</b>}
                                    {rk >= 0 && <em>{rk + 1}</em>}
                                </i>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </>
    );
}
