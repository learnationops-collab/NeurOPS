import React from 'react';
import { Ban, Minus, Plus } from 'lucide-react';
import { PREGUNTAS } from '../shared/mockData';

// Cuánto vale cada respuesta del formulario de agenda. El puntaje final se normaliza a 0-100, así
// que el director piensa en pesos relativos y no en sumas.
export default function SeccionPuntaje({ estrategia, editar }) {
    const segmentos = estrategia.segmentos.map(s => s.id);
    const descalif = (pid, op) => estrategia.descalificadores.find(d => d.pregunta === pid && d.opcion === op);

    const toggleDescalif = (pid, op) => editar(e => {
        const i = e.descalificadores.findIndex(d => d.pregunta === pid && d.opcion === op);
        if (i >= 0) e.descalificadores.splice(i, 1);
        else e.descalificadores.push({ pregunta: pid, opcion: op, segmento: segmentos[segmentos.length - 1] });
    });

    return (
        <section className="ag2-card" aria-labelledby="ag2-puntaje">
            <div className="ag2-card-h">
                <div>
                    <h2 id="ag2-puntaje">Puntaje del formulario</h2>
                    <p>Puntos de 0 a 10 por respuesta y un peso por pregunta. Una respuesta marcada con <Ban size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> manda al lead directo a un segmento.</p>
                </div>
                <span className="ag2-label">Opciones de ejemplo</span>
            </div>

            {PREGUNTAS.filter(p => estrategia.scoring[p.id]).map(p => {
                const cfg = estrategia.scoring[p.id];
                return (
                    <div key={p.id} className="ag2-qrow">
                        <div className="ag2-qhead">
                            <span className="ag2-qtext">{p.texto}</span>
                            <span className="ag2-step" aria-label={`Peso de ${p.id}`}>
                                <button type="button" aria-label="Bajar peso" onClick={() => editar(e => { e.scoring[p.id].peso = Math.max(0, cfg.peso - 1); })}><Minus size={13} /></button>
                                <span>×{cfg.peso}</span>
                                <button type="button" aria-label="Subir peso" onClick={() => editar(e => { e.scoring[p.id].peso = Math.min(5, cfg.peso + 1); })}><Plus size={13} /></button>
                            </span>
                        </div>
                        <div className="ag2-chips">
                            {p.opciones.map(op => {
                                const d = descalif(p.id, op);
                                return (
                                    <span key={op} className={`ag2-chip ${d ? 'ko' : ''}`}>
                                        {op}
                                        <input className="ag2-num" type="number" min={0} max={10} aria-label={`Puntos de ${op}`}
                                            value={cfg.opciones[op] ?? 0}
                                            onChange={(ev) => editar(e => { e.scoring[p.id].opciones[op] = Math.max(0, Math.min(10, Number(ev.target.value) || 0)); })} />
                                        {d && (
                                            <select className="ag2-sel" style={{ height: 24, fontSize: 11 }} aria-label="Segmento destino" value={d.segmento}
                                                onChange={(ev) => editar(e => { descalifDe(e, p.id, op).segmento = ev.target.value; })}>
                                                {segmentos.map(s => <option key={s} value={s}>→ {s}</option>)}
                                            </select>
                                        )}
                                        <button type="button" className={`ag2-icon ${d ? 'on' : ''}`} aria-pressed={!!d}
                                            aria-label={d ? 'Quitar descalificador' : 'Marcar como descalificador'} title={d ? 'Quitar descalificador' : 'Mandar directo a un segmento'}
                                            onClick={() => toggleDescalif(p.id, op)}><Ban size={13} /></button>
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </section>
    );
}

function descalifDe(e, pid, op) {
    return e.descalificadores.find(d => d.pregunta === pid && d.opcion === op);
}
