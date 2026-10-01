import React, { useMemo, useState } from 'react';
import { ASIGNADAS_SEMANA, CLOSERS, closerPorId, PREGUNTAS } from '../shared/mockData';
import { puntuar, rankear, segmentoPara, simular } from '../shared/engine';
import { explicarEstrategia } from '../shared/explain';
import { colorSeg } from './SeccionSegmentos';

const PRUEBA_INICIAL = Object.fromEntries(PREGUNTAS.filter(p => p.opciones).map(p => [p.id, p.opciones[0]]));

export function PanelLectura({ estrategia }) {
    const bloques = useMemo(() => explicarEstrategia(estrategia), [estrategia]);
    return (
        <section className="ag2-card ag2-read" aria-labelledby="ag2-lee">
            <div className="ag2-card-h"><h2 id="ag2-lee">Así lo lee el sistema</h2></div>
            {bloques.map(b => (
                <div key={b.titulo}>
                    <h3>{b.titulo}</h3>
                    {b.frases.map((f, i) => <p key={i}>{f}</p>)}
                </div>
            ))}
        </section>
    );
}

export function PanelPrueba({ estrategia }) {
    const [resp, setResp] = useState(PRUEBA_INICIAL);
    const puntaje = puntuar(estrategia, resp);
    const seg = segmentoPara(estrategia, puntaje);
    const rk = rankear(estrategia, seg, ASIGNADAS_SEMANA);
    const primero = rk.candidatos[0];

    return (
        <section className="ag2-card" aria-labelledby="ag2-prueba">
            <div className="ag2-card-h"><h2 id="ag2-prueba">Probar con un lead</h2></div>
            <div className="ag2-test">
                {PREGUNTAS.filter(p => p.opciones).map(p => (
                    <select key={p.id} className="ag2-sel" aria-label={p.texto} value={resp[p.id]}
                        onChange={(e) => setResp(r => ({ ...r, [p.id]: e.target.value }))}>
                        {p.opciones.map(o => <option key={o} value={o}>{p.id}: {o}</option>)}
                    </select>
                ))}
            </div>
            <div className="ag2-result">
                <div className="ag2-result-big">
                    <b>{puntaje.score}</b>
                    <span style={{ color: colorSeg(seg), fontWeight: 900 }}>{seg}</span>
                    {rk.segmentoFinal !== seg && <span style={{ fontSize: 12, color: 'var(--v6-warn)' }}>desborda a {rk.segmentoFinal}</span>}
                </div>
                {puntaje.descalificador && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--v6-dgr)' }}>Descalificador: “{puntaje.descalificador.opcion}”</p>}
                <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--v6-tx2)' }}>
                    {primero
                        ? <>Va primero a <b style={{ color: '#fff' }}>{closerPorId(primero.closer)?.nombre}</b>: {primero.motivo.toLowerCase()}. Si no tiene el horario libre, sigue {rk.candidatos.slice(1).map(c => closerPorId(c.closer)?.nombre.split(' ')[0]).join(', ') || 'nadie'}.</>
                        : 'No hay closers disponibles para este lead.'}
                </p>
            </div>
        </section>
    );
}

export function PanelSimulacion({ estrategia }) {
    const [n, setN] = useState(60);
    const sim = useMemo(() => simular(estrategia, ASIGNADAS_SEMANA, n), [estrategia, n]);
    const segs = estrategia.segmentos.map(s => s.id);
    const max = Math.max(1, ...Object.values(sim.porCloser).map(c => c.total));

    return (
        <section className="ag2-card" aria-labelledby="ag2-sim">
            <div className="ag2-card-h">
                <div>
                    <h2 id="ag2-sim">Si entran {n} leads más</h2>
                    <p>Respuestas al azar, partiendo de lo que cada closer ya tiene esta semana.</p>
                </div>
            </div>
            <input className="ag2-range" type="range" min={10} max={200} step={10} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Cantidad de leads simulados" />
            <div style={{ marginTop: 12 }}>
                {CLOSERS.map(c => {
                    const d = sim.porCloser[c.id];
                    return (
                        <div key={c.id} className="ag2-sim-row">
                            <span>{c.nombre.split(' ')[0]}</span>
                            <span className="ag2-sim-bar" aria-label={`${d.total} leads`}>
                                {segs.map(s => <i key={s} style={{ width: `${((d[s] || 0) / max) * 100}%`, background: colorSeg(s) }} />)}
                            </span>
                            <b style={{ textAlign: 'right' }}>{d.total}</b>
                        </div>
                    );
                })}
            </div>
            <div className="ag2-legend">
                {segs.map(s => <span key={s}><i style={{ background: colorSeg(s) }} />{s}: {sim.porSegmento[s] || 0}</span>)}
                {sim.sinCloser > 0 && <span style={{ color: 'var(--v6-dgr)' }}>Sin closer: {sim.sinCloser}</span>}
            </div>
        </section>
    );
}
